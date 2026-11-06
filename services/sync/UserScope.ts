/**
 * USER SCOPE — keeps one physical device from leaking data between accounts.
 *
 * AsyncStorage is global to the app, not to the signed-in user. So if account A
 * logs data, signs out, and account B signs in on the SAME device, B would open
 * to A's meals, streaks and Gozlin memory — and worse, the login reconcile could
 * push A's leftover profile up into B's cloud row. This module draws the line.
 *
 * The purge is a PREFIX SCAN (every `@welliva_*` / `@gozlin_*` key), not a
 * hand-maintained list: a list forgets new keys, and a forgotten key is a
 * privacy leak. See syncKeys.ts for why the whole codebase uses prefix/denylist
 * semantics rather than an allowlist.
 *
 * FAIL-SOFT: cleanup must never wedge sign-in/out. Errors log and are swallowed.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { forgetSmartLedgerMemory } from "../smart/ledger";
import { __resetInstallIdCache } from "../telemetry/installId";
import { ACTIVE_USER_KEY, listAppKeys } from "./syncKeys";

/** The account this device currently holds data for, if any. */
export async function getActiveUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_USER_KEY);
  } catch (e) {
    console.warn("UserScope.getActiveUserId:", e);
    return null;
  }
}

/**
 * Remove every app-owned key from this device. Best-effort — a failure to clear
 * is logged, never thrown, so it can't leave the user stuck mid sign-out.
 */
export async function purgeAppData(): Promise<void> {
  try {
    const keys = await listAppKeys();
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    // The install id lives under the app prefix, so the sweep above already
    // deleted it — but services/telemetry memoizes it in module state, which a
    // storage wipe cannot reach. Without this, a purge leaves the next events
    // stamped with the PREVIOUS owner's install id, stitching two people's
    // funnels together on one phone. Clearing the memo makes the next read mint
    // a fresh id, which is what "a different account on this device" means.
    __resetInstallIdCache();
    // The same trap: the smart layer holds its answers in memory, and the next
    // "Not now" would write the previous owner's straight back to the wiped disk.
    forgetSmartLedgerMemory();
  } catch (e) {
    console.warn("UserScope.purgeAppData:", e);
  }
}

/**
 * Make sure this device's local data belongs to `userId`. If the device was last
 * used by a DIFFERENT account (or none), wipe all app data and claim it for the
 * new user. Returns whether a purge happened, so the caller can also reset any
 * in-memory React state the wiped user left behind.
 *
 *  - same user as before  → false (keep local data; it's theirs)
 *  - different / first user → purge + record new owner → true
 */
export async function ensureDeviceOwnedBy(userId: string): Promise<boolean> {
  const previous = await getActiveUserId();
  if (previous === userId) return false;

  await purgeAppData();
  try {
    // Written AFTER the purge (the purge removes ACTIVE_USER_KEY too) so the
    // device is correctly stamped for the incoming account.
    await AsyncStorage.setItem(ACTIVE_USER_KEY, userId);
  } catch (e) {
    console.warn("UserScope.ensureDeviceOwnedBy (claim):", e);
  }
  return true;
}
