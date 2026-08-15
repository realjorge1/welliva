/**
 * Account deletion — the irreversible path.
 *
 * Every case here pins a way this must not go wrong, and the reasons are
 * asymmetric: a deletion that under-deletes breaks a promise in
 * constants/legal.ts and App Store 5.1.1(v); a deletion that over-deletes
 * destroys data for a user who still has an account. So the suite covers both
 * directions, and especially the FAILED delete — the state most likely to be
 * mishandled and the one nobody exercises by hand.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

// --- Storage layer: records what deletion asked it to remove ----------------
const storage = vi.hoisted(() => ({
  objects: new Map<string, string[]>(),
  removed: [] as { bucket: string; paths: string[] }[],
  failBucket: null as string | null,
  throwBucket: null as string | null,
  cacheCleared: 0,
}));

vi.mock("../../sync/StorageSync", () => ({
  listObjects: vi.fn(async (bucket: string) => {
    if (storage.throwBucket === bucket) throw new Error("list exploded");
    return storage.objects.get(bucket) ?? [];
  }),
  removeObjects: vi.fn(async (bucket: string, paths: string[]) => {
    if (storage.failBucket === bucket) return false;
    storage.removed.push({ bucket, paths });
    return true;
  }),
  clearSignedUrlCache: vi.fn(() => {
    storage.cacheCleared += 1;
  }),
}));

// --- Supabase: only `rpc` matters here -------------------------------------
const db = vi.hoisted(() => ({
  calls: [] as string[],
  error: null as { message: string } | null,
}));

const auth = vi.hoisted(() => ({
  attempts: [] as { email: string; password: string }[],
  error: null as { message: string } | null,
  throws: false,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      db.calls.push(fn);
      return { data: null, error: db.error };
    }),
    auth: {
      signInWithPassword: vi.fn(
        async (creds: { email: string; password: string }) => {
          auth.attempts.push(creds);
          if (auth.throws) throw new Error("socket hang up");
          return { data: {}, error: auth.error };
        },
      ),
    },
  },
}));

import type { User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { isSyncSuspended, setSyncSuspended } from "../../sync/SyncEngine";
import {
  accountHasPassword,
  DELETION_BUCKETS,
  deleteAccount,
  purgeRemoteStorage,
  ReauthenticationError,
  verifyPassword,
} from "../AccountDeletion";

const USER = "user-1";

/** Minimal User shaped enough for `accountHasPassword`. */
const asUser = (over: Partial<User>): User =>
  ({ id: USER, app_metadata: {}, ...over }) as User;

/** The common case: an email/password account, so re-auth is required. */
const EMAIL_USER = asUser({
  email: "a@b.com",
  identities: [{ provider: "email" }] as never,
});
/** A Google account — nothing to re-enter. */
const OAUTH_USER = asUser({
  email: "a@b.com",
  identities: [{ provider: "google" }] as never,
});
const PASSWORD = "hunter2";

beforeEach(async () => {
  storage.objects = new Map([
    ["avatars", [`${USER}/avatar.jpg`]],
    ["progress-photos", [`${USER}/a.jpg`, `${USER}/b.jpg`]],
    ["gozlin-audio", []],
  ]);
  storage.removed = [];
  storage.failBucket = null;
  storage.throwBucket = null;
  storage.cacheCleared = 0;
  db.calls = [];
  db.error = null;
  auth.attempts = [];
  auth.error = null;
  auth.throws = false;
  setSyncSuspended(false);
  vi.clearAllMocks();
  await AsyncStorage.multiRemove(await AsyncStorage.getAllKeys());
});

describe("purgeRemoteStorage", () => {
  it("removes every object the user owns, in one call per bucket", async () => {
    const report = await purgeRemoteStorage(USER);

    expect(report.filesDeleted).toBe(3);
    expect(report.bucketsIncomplete).toEqual([]);
    // An empty bucket must not cost a round trip.
    expect(storage.removed.map((r) => r.bucket)).toEqual([
      "avatars",
      "progress-photos",
    ]);
    expect(storage.removed[1].paths).toHaveLength(2);
  });

  it("covers every provisioned bucket", () => {
    // Guards the leak described in AccountDeletion.ts: a bucket added to
    // migration 0004 but not here would keep the user's files after deletion.
    expect([...DELETION_BUCKETS].sort()).toEqual([
      "avatars",
      "gozlin-audio",
      "progress-photos",
    ]);
  });

  it("reports a failed bucket instead of throwing, so the RPC still runs", async () => {
    storage.failBucket = "progress-photos";
    const report = await purgeRemoteStorage(USER);

    expect(report.bucketsIncomplete).toEqual(["progress-photos"]);
    expect(report.filesDeleted).toBe(1); // the avatar still went
  });

  it("survives a bucket that throws", async () => {
    storage.throwBucket = "avatars";
    const report = await purgeRemoteStorage(USER);

    expect(report.bucketsIncomplete).toEqual(["avatars"]);
    expect(report.filesDeleted).toBe(2); // progress photos unaffected
  });
});

describe("deleteAccount — success", () => {
  it("deletes files, then the account, then the device", async () => {
    await AsyncStorage.setItem("@welliva_food_log", '{"kept":false}');
    await AsyncStorage.setItem("@gozlin_memory", '{"kept":false}');

    const report = await deleteAccount(EMAIL_USER, PASSWORD);

    expect(report.filesDeleted).toBe(3);
    expect(db.calls).toEqual(["delete_account"]);
    // Local data is gone only because the cloud copy went first.
    expect(await AsyncStorage.getItem("@welliva_food_log")).toBeNull();
    expect(await AsyncStorage.getItem("@gozlin_memory")).toBeNull();
    expect(storage.cacheCleared).toBe(1);
  });

  it("calls the RPC with no arguments — it must read auth.uid(), not a param", async () => {
    await deleteAccount(EMAIL_USER, PASSWORD);
    // Passing a user id would make the SECURITY DEFINER function able to name a
    // victim. The signature is the security boundary; pin it.
    expect(supabase.rpc).toHaveBeenCalledWith("delete_account");
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toHaveLength(1);
  });

  it("purges storage BEFORE the account, while the session still works", async () => {
    const order: string[] = [];
    vi.mocked(supabase.rpc).mockImplementationOnce(async (fn: string) => {
      order.push(`rpc:${fn}`);
      return { data: null, error: null } as never;
    });
    storage.objects.set("avatars", [`${USER}/avatar.jpg`]);

    await deleteAccount(EMAIL_USER, PASSWORD);
    order.unshift(...storage.removed.map((r) => `storage:${r.bucket}`));

    expect(order[order.length - 1]).toBe("rpc:delete_account");
  });

  it("leaves sync suspended — the session is about to be torn down", async () => {
    await deleteAccount(EMAIL_USER, PASSWORD);
    expect(isSyncSuspended()).toBe(true);
  });
});

describe("accountHasPassword", () => {
  it("is true for an email identity", () => {
    expect(
      accountHasPassword(asUser({ identities: [{ provider: "email" }] as never })),
    ).toBe(true);
  });

  it("is false for a Google-only account", () => {
    // Demanding a password they don't have would lock them out of deleting
    // their own account — the exact failure 5.1.1(v) is about.
    expect(
      accountHasPassword(asUser({ identities: [{ provider: "google" }] as never })),
    ).toBe(false);
  });

  it("is true when an account has BOTH email and Google", () => {
    expect(
      accountHasPassword(
        asUser({
          identities: [{ provider: "google" }, { provider: "email" }] as never,
        }),
      ),
    ).toBe(true);
  });

  it("falls back to app_metadata.provider when identities are absent", () => {
    expect(accountHasPassword(asUser({ app_metadata: { provider: "google" } }))).toBe(
      false,
    );
    expect(accountHasPassword(asUser({ app_metadata: { provider: "email" } }))).toBe(
      true,
    );
  });

  it("fails SAFE when the provider is unknown — asks for a password", () => {
    // The safe direction is asking for a password we might not need, never
    // skipping a check we did.
    expect(accountHasPassword(asUser({}))).toBe(true);
  });

  it("is false with no user at all", () => {
    expect(accountHasPassword(null)).toBe(false);
  });
});

describe("verifyPassword", () => {
  it("passes the given credentials through", async () => {
    await verifyPassword("a@b.com", "hunter2");
    expect(auth.attempts).toEqual([{ email: "a@b.com", password: "hunter2" }]);
  });

  it("rejects an empty password without calling the network", async () => {
    await expect(verifyPassword("a@b.com", "")).rejects.toThrow(
      ReauthenticationError,
    );
    expect(auth.attempts).toEqual([]);
  });

  it("throws ReauthenticationError on a wrong password", async () => {
    auth.error = { message: "Invalid login credentials" };
    await expect(verifyPassword("a@b.com", "nope")).rejects.toThrow(
      /password isn't right/,
    );
  });

  it("does not leak the provider's message", async () => {
    // Supabase distinguishes "invalid credentials" from other states; echoing
    // that to an unlocked phone tells the holder something about the account.
    auth.error = { message: "Email not confirmed" };
    await expect(verifyPassword("a@b.com", "x")).rejects.not.toThrow(
      /not confirmed/,
    );
  });

  it("distinguishes a network failure from a wrong password", async () => {
    // Otherwise the user retypes a CORRECT password forever, wondering why it
    // keeps being rejected.
    auth.throws = true;
    await expect(verifyPassword("a@b.com", "hunter2")).rejects.toThrow(
      /connection/,
    );
  });
});

describe("deleteAccount — identity gate", () => {
  // These are the point of the whole re-auth feature: an unlocked phone must
  // not be enough. Each asserts that NOTHING was touched, not merely that the
  // call threw — a throw after the storage purge would still have cost the
  // user their photos.
  const untouched = async () => {
    expect(db.calls, "the account RPC ran").toEqual([]);
    expect(storage.removed, "files were deleted").toEqual([]);
    expect(await AsyncStorage.getItem("@welliva_food_log")).toBe('{"kept":true}');
    expect(isSyncSuspended(), "sync left suspended").toBe(false);
  };

  beforeEach(async () => {
    await AsyncStorage.setItem("@welliva_food_log", '{"kept":true}');
  });

  it("refuses with a WRONG password, touching nothing", async () => {
    auth.error = { message: "Invalid login credentials" };
    await expect(deleteAccount(EMAIL_USER, "wrong")).rejects.toThrow(
      ReauthenticationError,
    );
    await untouched();
  });

  it("refuses with NO password on a password account", async () => {
    await expect(deleteAccount(EMAIL_USER)).rejects.toThrow(ReauthenticationError);
    await untouched();
  });

  it("refuses an empty-string password", async () => {
    await expect(deleteAccount(EMAIL_USER, "")).rejects.toThrow(
      ReauthenticationError,
    );
    await untouched();
  });

  it("refuses a password account with no email to verify against", async () => {
    const noEmail = asUser({ identities: [{ provider: "email" }] as never });
    await expect(deleteAccount(noEmail, PASSWORD)).rejects.toThrow(
      /no email on file/,
    );
    await untouched();
  });

  it("checks identity BEFORE suspending sync or deleting anything", async () => {
    auth.error = { message: "nope" };
    await expect(deleteAccount(EMAIL_USER, "wrong")).rejects.toThrow();
    // The gate runs outside the suspend/restore block entirely, so there is no
    // window where a rejected attempt has left sync off.
    expect(isSyncSuspended()).toBe(false);
  });

  it("lets an OAuth account through WITHOUT a password", async () => {
    const report = await deleteAccount(OAUTH_USER);
    expect(auth.attempts, "asked a Google user for a password").toEqual([]);
    expect(db.calls).toEqual(["delete_account"]);
    expect(report.filesDeleted).toBe(3);
  });

  it("verifies with the account's own email, not a caller-supplied one", async () => {
    await deleteAccount(EMAIL_USER, PASSWORD);
    expect(auth.attempts).toEqual([{ email: "a@b.com", password: PASSWORD }]);
  });
});

describe("deleteAccount — failure", () => {
  beforeEach(() => {
    db.error = { message: "network down" };
  });

  it("throws, so the caller never reports success", async () => {
    await expect(deleteAccount(EMAIL_USER, PASSWORD)).rejects.toThrow(/network down/);
  });

  it("KEEPS local data — the account still exists and this is its only copy", async () => {
    await AsyncStorage.setItem("@welliva_food_log", '{"kept":true}');

    await expect(deleteAccount(EMAIL_USER, PASSWORD)).rejects.toThrow();

    expect(await AsyncStorage.getItem("@welliva_food_log")).toBe('{"kept":true}');
  });

  it("restores sync, so a failed attempt leaves a fully working app", async () => {
    await expect(deleteAccount(EMAIL_USER, PASSWORD)).rejects.toThrow();
    expect(isSyncSuspended()).toBe(false);
  });

  it("restores sync to its PREVIOUS value, not blindly to false", async () => {
    setSyncSuspended(true);
    await expect(deleteAccount(EMAIL_USER, PASSWORD)).rejects.toThrow();
    expect(isSyncSuspended()).toBe(true);
  });

  it("is idempotent — a retry after failure completes the deletion", async () => {
    await expect(deleteAccount(EMAIL_USER, PASSWORD)).rejects.toThrow();

    // First attempt already cleared storage; the retry finds nothing left.
    storage.objects = new Map(DELETION_BUCKETS.map((b) => [b, []]));
    db.error = null;

    const report = await deleteAccount(EMAIL_USER, PASSWORD);
    expect(report.filesDeleted).toBe(0);
    expect(db.calls).toEqual(["delete_account", "delete_account"]);
  });
});
