/**
 * ACCOUNT DELETION — the client half of the right to erasure.
 *
 * Pairs with supabase/migrations/20260727130000_account_deletion.sql. Read that
 * file first: it explains why the account row can only die inside a SECURITY
 * DEFINER function, and why one `DELETE FROM auth.users` is enough to take every
 * table with it.
 *
 * This module owns the ORDER, which is the part that is easy to get wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SEQUENCE, AND WHY IT IS THIS SEQUENCE
 *
 *   0. re-auth        proves IDENTITY (`verifyPassword`, below). Runs in the
 *                     auth provider, before anything here is called, because it
 *                     is the last step that can still say no. The typed DELETE
 *                     in the UI proves INTENT; these are different questions.
 *   1. suspend sync    a background flush during teardown is wasted radio; the
 *                      FK graph already makes resurrection impossible.
 *   2. remote storage  MUST happen while the session is alive. Deleting a
 *                      `storage.objects` row does not reliably reclaim the S3
 *                      blob — only the Storage API does — and the Storage API
 *                      needs a valid JWT. After step 3 there is no JWT.
 *   3. delete_account  THE POINT OF NO RETURN. Everything before this is
 *                      recoverable; nothing after it is.
 *   4. local purge     only once the cloud is actually gone (see below).
 *
 * WHY STORAGE BEFORE THE RPC, GIVEN THAT THE RPC CAN FAIL. It can, and then the
 * user still has an account whose photos are gone. That is the correct trade:
 *   • The reverse order strands the blobs forever — after step 3 the session is
 *     dead, so no client can ever reach them again, and the SQL backstop only
 *     unlinks the rows.
 *   • A user at this point has typed DELETE into a confirmation box. Losing
 *     files they explicitly asked to erase is aligned with their intent; losing
 *     an account they still have to use is not.
 *   • It is recoverable: `deleteAccount` is idempotent, so "try again" re-runs
 *     a now-empty storage pass and re-attempts the RPC.
 * So a partial failure can only ever over-delete in the direction the user
 * chose, and we keep them signed in so they can finish the job.
 *
 * WHY THE LOCAL PURGE IS LAST. If the RPC fails and we had already wiped the
 * device, the user would be left signed in to a live account with an empty
 * phone — we would have destroyed the local copy of data the cloud still holds.
 * Local data is only worthless once the cloud copy is confirmed gone.
 *
 * FAIL-SOFT vs FAIL-LOUD. Every step here is best-effort EXCEPT the RPC, which
 * throws. That asymmetry is deliberate: an account that reports "deleted" while
 * still existing is the one outcome that breaks the promise in constants/legal.ts
 * and the store guideline this exists to satisfy.
 */
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  clearSignedUrlCache,
  listObjects,
  removeObjects,
  type Bucket,
} from "../sync/StorageSync";
import { setSyncSuspended } from "../sync/SyncEngine";
import { purgeAppData } from "../sync/UserScope";

// ---------------------------------------------------------------------------
// Re-authentication
// ---------------------------------------------------------------------------

/**
 * The password check failed — WRONG PASSWORD, or none given for an account that
 * needs one. Distinct from a generic failure so the UI can say "that password
 * isn't right" instead of "deletion failed", which would imply the account is
 * in some half-deleted state when nothing has been touched at all.
 */
export class ReauthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReauthenticationError";
  }
}

/**
 * Does this account sign in with a password?
 *
 * Google users have no password to re-enter, and demanding one would lock them
 * out of deleting their own account — which fails the very guideline this flow
 * exists to satisfy. Their possession of a live OAuth session is the identity
 * proof; the typed DELETE remains the intent proof.
 *
 * Reads `identities` (a user can have several — email AND Google) and falls back
 * to `app_metadata.provider` for sessions restored from an older token shape.
 * Both missing → assume a password IS required: the safe direction is to ask for
 * one we might not need, never to skip a check we did.
 */
export function accountHasPassword(user: User | null): boolean {
  if (!user) return false;
  if (user.identities?.length) {
    return user.identities.some((i) => i.provider === "email");
  }
  const provider = user.app_metadata?.provider;
  return provider === undefined || provider === "email";
}

/**
 * Prove the person holding the phone is the account owner.
 *
 * WHY THIS EXISTS AT ALL. The typed DELETE confirms *intent* — it cannot be hit
 * by a mis-tap. It says nothing about *identity*: an unlocked phone left on a
 * desk is enough to erase someone's entire health history. Re-auth is the only
 * part of this flow that a person other than the owner cannot satisfy.
 *
 * `signInWithPassword` is the check, because Supabase has no verify-only
 * endpoint (`reauthenticate()` mails a nonce — that is for changing a password,
 * not confirming one). It issues a fresh session for the SAME user, which is
 * harmless and mildly useful: the token about to call `delete_account` is new
 * rather than minutes from expiry. A wrong password leaves the existing session
 * untouched, so a failed attempt costs the user nothing.
 *
 * @throws ReauthenticationError — always, on any failure. The underlying message
 *         is deliberately not surfaced: Supabase's copy distinguishes "invalid
 *         credentials" from other states, and echoing that to an unlocked phone
 *         tells whoever is holding it something about the account.
 */
export async function verifyPassword(
  email: string,
  password: string,
): Promise<void> {
  if (!password) {
    throw new ReauthenticationError("Enter your password to continue.");
  }
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new ReauthenticationError("That password isn't right.");
    }
  } catch (e) {
    if (e instanceof ReauthenticationError) throw e;
    // Network failure, not a bad password — say so, or the user retypes a
    // correct password forever wondering why it keeps being rejected.
    throw new ReauthenticationError(
      "Couldn't check your password. Check your connection and try again.",
    );
  }
}

/**
 * Every bucket migration 0004 provisions. Kept as an explicit list rather than
 * derived from `Bucket`, so adding a bucket without deciding what deletion does
 * with it is a type error here, not a silent leak of the user's files.
 */
export const DELETION_BUCKETS: readonly Bucket[] = [
  "avatars",
  "progress-photos",
  "gozlin-audio",
] as const;

export interface DeletionReport {
  /** Objects the Storage API confirmed gone. */
  filesDeleted: number;
  /**
   * Buckets whose purge did not fully succeed. Not an error — migration 0007
   * unlinks whatever is left — but worth surfacing in logs when tuning this.
   */
  bucketsIncomplete: Bucket[];
}

/**
 * Delete every object this user owns, across all three buckets.
 *
 * Best-effort by contract: returns a report, never throws. A bucket that fails
 * to list or remove is recorded and skipped, because the SQL backstop in
 * migration 0007 catches the remainder — including objects nested deeper than
 * "<uid>/<file>", which `list()` (one level, non-recursive) does not return.
 */
export async function purgeRemoteStorage(
  userId: string,
): Promise<DeletionReport> {
  let filesDeleted = 0;
  const bucketsIncomplete: Bucket[] = [];

  // Sequential, not Promise.all: three buckets is not worth the parallelism, and
  // a phone mid-teardown should not open three concurrent storage connections.
  for (const bucket of DELETION_BUCKETS) {
    try {
      const paths = await listObjects(bucket, userId);
      if (paths.length === 0) continue;

      if (await removeObjects(bucket, paths)) {
        filesDeleted += paths.length;
      } else {
        bucketsIncomplete.push(bucket);
      }
    } catch (e) {
      console.warn(`AccountDeletion.purgeRemoteStorage(${bucket}):`, e);
      bucketsIncomplete.push(bucket);
    }
  }

  return { filesDeleted, bucketsIncomplete };
}

/**
 * Irreversibly delete the account: identity check, files, then the auth row
 * (which cascades every table), then this device.
 *
 * Does NOT tear down the session — that is the caller's job, because only the
 * auth provider can drop React state in the same tick. See
 * SupabaseAuthProvider.deleteAccount, which is the only intended caller.
 *
 * WHY RE-AUTH LIVES IN HERE and not in the caller: putting the check beside the
 * destructive act makes it impossible to reach one without the other. If the
 * provider owned it, any future caller — a support screen, a deep link, a
 * "delete on account closure" job — would silently skip it, and the failure
 * would be invisible until someone's data was gone.
 *
 * @param user     the signed-in user; supplies the id, and the identity/email
 *                 that decide whether a password is required.
 * @param password required for password accounts, ignored for OAuth-only ones.
 * @throws ReauthenticationError before ANYTHING is touched, if identity fails.
 * @throws if the account itself could not be deleted. Sync is restored before
 *         the throw, so a failed attempt leaves a fully working app.
 */
export async function deleteAccount(
  user: User,
  password?: string,
): Promise<DeletionReport> {
  const userId = user.id;

  // 0. IDENTITY — first, and outside the try/finally below, because nothing has
  //    been suspended or deleted yet. A failure here is a no-op by construction.
  if (accountHasPassword(user)) {
    if (!user.email) {
      throw new ReauthenticationError(
        "This account has no email on file. Contact support to delete it.",
      );
    }
    await verifyPassword(user.email, password ?? "");
  }

  const wasSuspended = setSyncSuspended(true);

  try {
    // 1. Files, while the JWT still works.
    const report = await purgeRemoteStorage(userId);

    // 2. The account. `rpc` takes no arguments on purpose — the function reads
    //    auth.uid() from the verified JWT, so this call cannot name a victim
    //    even if `userId` above were somehow wrong.
    const { error } = await supabase.rpc("delete_account");
    if (error) {
      throw new Error(`Account deletion failed: ${error.message}`);
    }

    // 3. Past the point of no return — the cloud copy is gone, so the local
    //    copy is now the only thing standing between the user and erasure.
    await purgeAppData();
    clearSignedUrlCache();

    return report;
  } catch (e) {
    // Only reached when the account still exists (the RPC threw, or storage
    // threw before it). Put sync back exactly as we found it so the app the
    // user is still signed in to keeps working normally.
    setSyncSuspended(wasSuspended);
    throw e;
  }
}
