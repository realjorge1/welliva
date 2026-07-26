/**
 * PROFILE SYNC — the first cloud-sync slice.
 *
 * Round-trips the user's profile (UserBio + UserGoals) between the device and
 * the Supabase `users` row so it follows them across devices. The full objects
 * live in the `bio`/`goals` JSONB columns (lossless); the typed columns
 * (age/weight/gender/…) are also written for future SQL/analytics.
 *
 * Design rules (offline-first):
 *  - FAIL-SOFT. Every function swallows errors and logs — a sync hiccup must
 *    never surface to the UI or block a local write. The device stays the
 *    working copy; the cloud is the durable mirror.
 *  - Last-write-wins on the SERVER `updated_at` (a DB trigger stamps it, so the
 *    device clock can't skew the comparison). We remember the server timestamp
 *    we last reconciled with in KEYS.PROFILE_SYNCED_AT.
 *  - No React here — pure async functions AppContext calls.
 */
import type { Database, Json } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import type { UserBio, UserGoals } from "../../models/user";
import { KEYS, readString, writeString } from "../OfflineStorage";
import { withSyncTelemetry } from "./SyncTelemetry";

type UsersInsert = Database["public"]["Tables"]["users"]["Insert"];

/** What a pull returns; `null` = no synced profile (or the pull failed). */
export interface RemoteProfile {
  bio: UserBio | null;
  goals: UserGoals | null;
  /** Server-stamped ISO timestamp of the row. */
  updatedAt: string | null;
}

/** Derive the flat typed columns from the bio blob (analytics/queryability). */
function bioToColumns(bio: UserBio) {
  return {
    age: bio.age ?? null,
    weight: bio.weightKg ?? null,
    height: bio.heightCm ?? null,
    gender: bio.sex ?? null,
    activity_level: bio.activityLevel ?? null,
    allergies: bio.allergies ?? [],
    health_goals: bio.goals ?? (bio.primaryGoal ? [bio.primaryGoal] : []),
    dietary_preferences:
      bio.dietaryRestriction && bio.dietaryRestriction !== "none"
        ? [bio.dietaryRestriction]
        : [],
  };
}

/**
 * Push the local profile up. Upserts the user's row (the signup trigger usually
 * created it already) and returns the new server `updated_at`, or null on
 * failure. Records the timestamp locally so later pulls can compare.
 */
export async function pushProfile(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  bio: UserBio | null;
  goals: UserGoals | null;
}): Promise<string | null> {
  const { userId, email, name, avatarUrl, bio, goals } = params;
  try {
    const updatedAt = await withSyncTelemetry("profile.push", async () => {
      const payload: UsersInsert = {
        id: userId,
        bio: (bio ?? null) as unknown as Json,
        goals: (goals ?? null) as unknown as Json,
      };
      if (email) payload.email = email;
      if (name && name.trim()) payload.name = name.trim();
      if (avatarUrl) payload.avatar_url = avatarUrl;
      if (bio) Object.assign(payload, bioToColumns(bio));

      const { data, error } = await supabase
        .from("users")
        .upsert(payload, { onConflict: "id" })
        .select("updated_at")
        .single();

      // Throw so telemetry sees it and a transient failure gets retried; the
      // fail-soft swallow stays in the catch below.
      if (error) throw new Error(error.message);
      return (data as { updated_at: string } | null)?.updated_at ?? null;
    });

    if (updatedAt) await writeString(KEYS.PROFILE_SYNCED_AT, updatedAt);
    return updatedAt;
  } catch (e) {
    console.warn("ProfileSync.pushProfile:", e);
    return null;
  }
}

/** Pull the remote profile. Returns null on miss or any failure (fail-soft). */
export async function pullProfile(userId: string): Promise<RemoteProfile | null> {
  try {
    return await withSyncTelemetry("profile.pull", async () => {
      const { data, error } = await supabase
        .from("users")
        .select("bio, goals, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as {
        bio: Json | null;
        goals: Json | null;
        updated_at: string | null;
      };
      return {
        bio: (row.bio as unknown as UserBio) ?? null,
        goals: (row.goals as unknown as UserGoals) ?? null,
        updatedAt: row.updated_at ?? null,
      };
    });
  } catch (e) {
    console.warn("ProfileSync.pullProfile:", e);
    return null;
  }
}

/** The server timestamp of the last profile we reconciled with, if any. */
export async function getLastSyncedAt(): Promise<string | null> {
  return readString(KEYS.PROFILE_SYNCED_AT, null);
}

/**
 * Decide what a login-time reconcile should do, given the local and remote
 * profiles. Pure + testable; AppContext applies the result.
 *
 *  - remote has a bio the local side lacks            → ADOPT remote (new device)
 *  - both have a bio, remote is newer than last sync  → ADOPT remote (other device edited)
 *  - otherwise                                        → PUSH local up (we're source of truth)
 */
export function reconcileDecision(args: {
  localBio: UserBio | null;
  remote: RemoteProfile | null;
  lastSyncedAt: string | null;
}): "adopt-remote" | "push-local" {
  const { localBio, remote, lastSyncedAt } = args;
  const remoteHasBio = !!remote?.bio;
  if (!remoteHasBio) return "push-local";
  if (!localBio) return "adopt-remote";
  if (
    remote?.updatedAt &&
    lastSyncedAt &&
    remote.updatedAt > lastSyncedAt
  ) {
    return "adopt-remote";
  }
  // Remote exists but isn't provably newer than our last sync → keep local,
  // push it up so the cloud reflects any edits made since.
  return "push-local";
}
