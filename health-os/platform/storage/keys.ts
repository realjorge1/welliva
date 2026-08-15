/**
 * health-os/platform/storage/keys.ts
 *
 * The single key registry for the Personal Health OS. Supersedes the ad-hoc `KEYS`
 * in services/OfflineStorage for all NEW storage, and exposes the legacy keys (read,
 * never destroyed) for the migration that backfills the Timeline.
 *
 * See docs/architecture/02-data-and-schema.md §7.
 */
import { KEYS as LEGACY_KEYS } from "@/services/OfflineStorage";

export const K = {
  // ── platform ──
  SCHEMA_VERSION: "@welliva_schema_version", // number; gates migrations
  MIGRATION_JOURNAL: "@welliva_migration_journal", // JournalEntry[]

  // ── timeline (event store, partitioned by month) ──
  TIMELINE_PREFIX: "@welliva_timeline_", // partition key prefix
  TIMELINE_INDEX: "@welliva_timeline_index", // the index manifest (NOT a partition)
  timelinePart: (ym: string) => `@welliva_timeline_${ym}`,

  // ── memory / summaries (L2) ──
  SUMMARY_PREFIX: "@welliva_summary_", // spans day/week/month + the index
  SUMMARY_INDEX: "@welliva_summary_index",
  daySummary: (d: string) => `@welliva_summary_day_${d}`,
  weekSummary: (w: string) => `@welliva_summary_week_${w}`,
  monthSummary: (m: string) => `@welliva_summary_month_${m}`,

  // ── settings records (current value; every change also emits an event) ──
  PREFERENCES: "@welliva_preferences",
  PROFILE_META: "@welliva_profile_meta",
  CONSENT: "@welliva_consent",

  // ── life context (forward-dated, auto-expiring life events) ──
  LIFECONTEXT: "@welliva_lifecontext", // LifeEvent[]

  // ── signals (external senses: calendar, weather, …) ──
  SIGNALS_WEATHER: "@welliva_signals_weather", // { snapshot, coordKey } cache
  SIGNALS_WEARABLE: "@welliva_signals_wearable", // last WearableSnapshot cache

  // ── notifications (proactive delivery: prefs + the sent ledger) ──
  NOTIFICATIONS_PREFS: "@welliva_notifications_prefs", // NotificationPrefs
  NOTIFICATIONS_LEDGER: "@welliva_notifications_ledger", // NotificationLedger (cadence)

  // ── story (long-horizon recap archive: year / anniversary / 5-year) ──
  STORY_ARCHIVE: "@welliva_story_archive", // StoryArtifact[]

  // ── learning (the closed loop: predict → observe → update a parameter) ──
  LEARNING_LEDGER: "@welliva_learning_ledger", // Recommendation[] — falsifiable record
  LEARNING_POSTERIORS: "@welliva_learning_posteriors", // Beta(α,β) per context×arm
  LEARNING_TDEE: "@welliva_learning_tdee", // KalmanState — learned maintenance
  LEARNING_FITNESS: "@welliva_learning_fitness", // FitnessFatigueParams — fitted τ/k
  LEARNING_ADHERENCE: "@welliva_learning_adherence", // LogisticModel — β weights
} as const;

/**
 * Legacy silo keys, retained verbatim during the transition. Migration 001 READS
 * these to backfill the Timeline; nothing here is deleted until a later, guarded
 * retirement migration (docs/architecture/04-migration-strategy.md §6).
 */
export const LEGACY = {
  ...LEGACY_KEYS,
  SESSION_HISTORY: "@welliva_session_history", // SessionService key (not in KEYS)
  GOZLIN_CHECKINS: "@gozlin_checkins",
  GOZLIN_EPISODIC: "@gozlin_episodic",
} as const;
