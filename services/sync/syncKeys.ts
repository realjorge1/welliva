/**
 * WHICH KEYS SYNC, AND WHICH STAY ON THE DEVICE.
 *
 * The app owns ~50 AsyncStorage keys under two namespaces: `@welliva_*` and
 * `@gozlin_*` (meals, workouts, streaks, achievements, habits, the health-os
 * event store, Gozlin's memory tiers, …).
 *
 * WHY A DENYLIST, NOT AN ALLOWLIST.
 * The obvious design is an allowlist of keys to sync. It is also a trap: an
 * allowlist silently DROPS any key nobody remembered to add. That is exactly how
 * streaks, achievements and the whole health-os timeline would fail to follow a
 * user to a new phone — they'd be quietly absent, with no error. So we invert it:
 *
 *   A key SYNCS BY DEFAULT if it is app-owned, UNLESS it is on a short, explicit
 *   device-local denylist.
 *
 * New features become sync-aware for free; the only maintenance is remembering to
 * deny a genuinely device-scoped value (a cache, a clock, an in-flight session,
 * this device's migration bookkeeping). Denying too little just syncs a
 * regenerable cache — cheap. Forgetting to sync real user data is the expensive
 * failure, and the denylist can't cause it.
 *
 * PURGE uses the SAME app-owned prefix scan (see UserScope), so a new account on
 * a shared device never inherits leftovers a static list forgot.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Everything the app persists lives under one of these namespaces. */
export const APP_KEY_PREFIXES = ["@welliva_", "@gozlin_"] as const;

// ---------------------------------------------------------------------------
// Sync-engine bookkeeping keys (device-local by nature — they describe THIS
// device's relationship to the cloud, so syncing them would be circular).
// ---------------------------------------------------------------------------
export const ACTIVE_USER_KEY = "@welliva_active_user_id";
export const WATERMARKS_KEY = "@welliva_sync_watermarks";
export const OUTBOX_KEY = "@welliva_sync_outbox";
/** Signatures of the value we last pushed per key — powers the change-detecting sweep. */
export const PUSHED_KEY = "@welliva_sync_pushed";

/**
 * Device-scoped keys that must NEVER leave the device. Grouped by why:
 *  - clocks / in-flight session state (meaningless or harmful on another device)
 *  - regenerable caches
 *  - THIS device's notification-delivery bookkeeping
 *  - THIS device's on-disk migration state (syncing it would corrupt the
 *    version-gated migration runner on a fresh device)
 *  - the sync engine's own bookkeeping (above)
 */
export const DEVICE_LOCAL_KEYS: readonly string[] = [
  // clocks / in-flight
  "@welliva_last_active_date",
  "@welliva_last_checked_date",
  "@welliva_active_session",
  // caches
  "@welliva_signals_weather",
  "@welliva_signals_wearable",
  "@gozlin_forecast_cache",
  // this device's notification delivery state (prefs DO sync; the sent-ledger
  // and local notification ids are per-device and must not)
  "@welliva_fitness_notification_ids",
  "@welliva_notifications_ledger",
  // this device's migration bookkeeping — load-bearing for the migration runner
  "@welliva_schema_version",
  "@welliva_migration_journal",
  // device UI rotation state
  "@welliva_home_greeting_rotation",
  // sync engine bookkeeping
  "@welliva_profile_synced_at",
  "@welliva_sync_telemetry",
  ACTIVE_USER_KEY,
  WATERMARKS_KEY,
  OUTBOX_KEY,
  PUSHED_KEY,
];

/** Prefix-matched device-local families (versioned caches, etc.). */
export const DEVICE_LOCAL_PREFIXES: readonly string[] = [
  "@welliva_exercise_media_", // ExerciseMediaService media cache (regenerable)
];

/** True when a key belongs to the app (either namespace). */
export function isAppKey(key: string): boolean {
  return APP_KEY_PREFIXES.some((p) => key.startsWith(p));
}

/** True when a key is deliberately confined to this device. */
export function isDeviceLocalKey(key: string): boolean {
  if (DEVICE_LOCAL_KEYS.includes(key)) return true;
  return DEVICE_LOCAL_PREFIXES.some((p) => key.startsWith(p));
}

/** True when a key's value is user data that must follow the account. */
export function isSyncedKey(key: string): boolean {
  return isAppKey(key) && !isDeviceLocalKey(key);
}

/** Every app-owned key currently in storage — the set to PURGE on a user switch. */
export async function listAppKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all.filter(isAppKey);
}

/** Every app-owned key that should sync — the set the full-push sweep scans. */
export async function listSyncedKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all.filter(isSyncedKey);
}
