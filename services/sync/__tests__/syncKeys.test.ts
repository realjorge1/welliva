/**
 * syncKeys — the denylist that decides what follows a user across devices.
 * These assertions are the guardrail against the exact regression that motivated
 * the rewrite: real user data (streaks, health-os timeline, fitness profile,
 * Gozlin memory) MUST sync, while device-local caches, clocks, migration state
 * and the sync engine's own bookkeeping MUST NOT.
 */
import { describe, expect, it } from "vitest";
import { isAppKey, isDeviceLocalKey, isSyncedKey } from "../syncKeys";

describe("isSyncedKey — user data that must travel", () => {
  const synced = [
    "@welliva_streak_data",
    "@welliva_achievements",
    "@welliva_tournament",
    "@welliva_journey",
    "@welliva_challenges",
    "@welliva_session_history",
    "@welliva_habits",
    "@welliva_habit_logs",
    "@welliva_nutrition_history",
    // G3: these were absent from the original allowlist and would have been lost.
    "@welliva_fitness_profile",
    "@welliva_timeline_2026-07",
    "@welliva_summary_day_2026-07-23",
    "@welliva_lifecontext",
    "@welliva_consent",
    "@welliva_profile_meta",
    "@welliva_story_archive",
    "@welliva_notifications_prefs",
    // Gozlin memory (finding #2).
    "@gozlin_identity",
    "@gozlin_episodic",
    "@gozlin_behavioral",
    "@gozlin_conversation",
  ];
  it.each(synced)("%s syncs", (k) => {
    expect(isSyncedKey(k)).toBe(true);
  });
});

describe("isSyncedKey — device-local state that must NOT travel", () => {
  const local = [
    "@welliva_last_active_date",
    "@welliva_active_session",
    "@welliva_schema_version", // migration state — syncing corrupts the runner
    "@welliva_migration_journal",
    "@welliva_signals_weather", // cache
    "@welliva_fitness_notification_ids", // per-device notification ids
    "@welliva_notifications_ledger", // per-device delivery ledger
    "@welliva_home_greeting_rotation",
    "@welliva_exercise_media_v1", // prefix-denied cache
    "@gozlin_forecast_cache",
    // engine bookkeeping
    "@welliva_active_user_id",
    "@welliva_sync_watermarks",
    "@welliva_sync_outbox",
    "@welliva_sync_pushed",
    "@welliva_profile_synced_at",
    "@welliva_sync_telemetry",
  ];
  it.each(local)("%s stays local", (k) => {
    expect(isDeviceLocalKey(k)).toBe(true);
    expect(isSyncedKey(k)).toBe(false);
  });
});

describe("isAppKey", () => {
  it("recognizes both namespaces and rejects foreign keys", () => {
    expect(isAppKey("@welliva_habits")).toBe(true);
    expect(isAppKey("@gozlin_identity")).toBe(true);
    expect(isAppKey("themeMode")).toBe(false);
    expect(isAppKey("welliva.trainingNudge.v1")).toBe(false);
  });
});
