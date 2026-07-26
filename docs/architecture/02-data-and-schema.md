# 02 — Data & Schema

The local store is treated as a **versioned, append-only database**. This document
defines the event envelope, the event catalog, the settings records, the key
registry, and the schema-versioning model. It is the contract the migration runner
([04](./04-migration-strategy.md)) and every repository depend on.

## 1. Storage substrate & the storage port

Today everything is `AsyncStorage` (key → JSON string) via `services/OfflineStorage.ts`.
We keep that, but behind a **port** so the substrate can change without touching
domain code:

```ts
// health-os/platform/storage/KeyValueStore.ts
export interface KeyValueStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  multiGet(keys: string[]): Promise<Record<string, unknown>>;
  keys(prefix?: string): Promise<string[]>;
}
```

- **Now:** `AsyncStorageAdapter` (wraps the existing `readJSON`/`writeJSON`).
- **Later, drop-in:** `SqliteAdapter` (expo-sqlite) when event volume justifies
  indexed range queries; `EncryptedAdapter` (see [09](./09-privacy-and-consent.md)).

**AsyncStorage reality check.** AsyncStorage stores whole values per key. An
append that rewrites a year of events is O(n). We therefore **partition the
Timeline by month** (§4) so a write touches one bounded array. A heavy user logging
~20 events/day produces ~600 events/month ≈ a small JSON blob — comfortably within
limits for years. The SQLite adapter removes even this concern when needed.

## 2. The event envelope

Every recorded fact is a `HealthEvent`. This is the heart of the model.

```ts
// health-os/timeline/events.ts
export type EventSource = "app" | "coach" | "user" | "import" | "system";

export interface HealthEvent<T = unknown> {
  /** ULID — globally unique AND lexicographically time-sortable. */
  id: string;
  /** Namespaced type, e.g. "nutrition.meal.logged". See the catalog (§3). */
  type: EventType;
  /** ISO 8601 timestamp WITH local offset (never bare UTC). */
  ts: string;
  /** YYYY-MM-DD in LOCAL time — the partition + daily-projection key. */
  localDate: string;
  /** Who/what produced it. "coach" = via Gozlin; "user" = manual; "import" = migration. */
  source: EventSource;
  /** Version of THIS event type's payload shape (for per-type evolution). */
  v: number;
  /** The typed body. Validated by the catalog schema for `type`. */
  payload: T;

  // ── provenance & lifecycle (powers Memory Center + privacy) ──
  /** Optional: where it came from — surface, chat session, etc. */
  origin?: { surface?: string; sessionId?: string; note?: string };
  /** Set true by a redaction; excluded from every read/summary. Never hard-deleted by edits. */
  redacted?: boolean;
  /** If this event corrects/supersedes an earlier event, its id. */
  supersedes?: string;
  /** User-applied categories/tags (Memory Center "categorize"). */
  tags?: string[];
}
```

### Design rationale

- **ULID ids** sort by time, so a month partition is already chronological and we
  get free dedupe + idempotent appends (re-importing the same source record yields
  the same deterministic id — see [04](./04-migration-strategy.md)).
- **`localDate` is denormalized** because daily projections (the hot path: "today's
  calories") must not parse timestamps across an entire partition.
- **Correction-by-append (`supersedes`)** keeps history immutable and auditable.
  Editing a past meal emits a new event that supersedes the old; projections honor
  the latest non-redacted event in a supersede-chain. This is event-sourcing
  discipline and it is what lets the Memory Center offer "edit" without corrupting
  derived stats. See [08 §3](./08-memory-center.md).
- **`redacted` is soft-delete**; a separate hard-erase exists for privacy
  ([09](./09-privacy-and-consent.md)). Reads filter `redacted` everywhere — enforced
  once, in `TimelineRepository.query`.

## 3. Event catalog

Event types are namespaced `domain.entity.verb`. Each has a zod payload schema and a
version in `timeline/catalog.ts`. The initial catalog is derived **directly from the
existing silos**, so migration is a faithful re-encoding, not an invention.

| `type` | Payload (abridged) | Backfilled from |
|---|---|---|
| `nutrition.meal.logged` | `{ slot, name, calories, proteinG, carbsG, fatG, dietId }` | `diet_history.consumedMeals` + today's `ScheduledMeal.isConsumed` |
| `nutrition.meal.skipped` | `{ slot, name }` | `diet_history.skippedMeals` |
| `nutrition.day.closed` | `{ consumedCalories, proteinG, carbsG, fatG, adherence }` | `DietHistoryEntry` (one per day) |
| `hydration.water.added` | `{ ml, totalMl, goalMl }` | live `addWater` (forward); history is daily-only (below) |
| `hydration.day.closed` | `{ ml, goalMl, metGoal }` | `water_history` (`WaterHistoryEntry`) |
| `workout.session.completed` | `{ planId, name, durationMin, completedAt }` | `workout_logs` (`WorkoutLogEntry`) |
| `workout.session.summary` | `{ exerciseId→{reps[],skipped}, completionPct }` | `session_history` (`SessionSummaryData`) |
| `body.measurement.logged` | `{ weightKg?, waistCm?, ... }` | `body_logs` (`BodyLogEntry`) |
| `checkin.logged` | `{ mood?, energy?, stress?, sleepHours?, note? }` | `@gozlin_checkins` |
| `goal.set` | `{ kind, value, prev? }` | `UserGoals` changes (forward) |
| `goal.reached` | `{ kind, value, chapter }` | `JourneyService` chapter events |
| `profile.updated` | `{ changedFields[], summary }` | `updateUserBio` re-fits (forward) |
| `preference.changed` | `{ kind, value }` | `setCuisinePreference`/`setFoodPreference` (forward) |
| `achievement.unlocked` | `{ achievementId, tier, points }` | `@welliva_achievements.earned` |
| `challenge.completed` | `{ challengeId, periodKey }` | `@welliva_challenges.completed` |
| `trophy.awarded` | `{ trophyId, periodKey, rival }` | `@welliva_tournament.trophies` |
| `coach.episode` | `{ summary, kind }` | `@gozlin_episodic` (already an episodic memory) |

> New domains add new namespaces (`sleep.*`, `mood.*`, `medication.*`) without
> touching anything above — the open/closed payoff of [01 §6](./01-domain-architecture.md).

### Catalog versioning (per-type)

Each payload schema carries a `v`. When a payload shape changes, bump its `v` and add
an **upcaster** `(oldPayload) → newPayload` in the catalog. Readers always upcast to
the current shape. This isolates schema evolution to one event type — a 2030 change
to `nutrition.meal.logged` never forces a global migration.

## 4. Timeline partitioning & indexes

```
@welliva_timeline_2026-06   → HealthEvent[]   (events whose localDate is in 2026-06)
@welliva_timeline_2026-07   → HealthEvent[]
@welliva_timeline_index     → { partitions: { "2026-06": { count, from, to } }, total }
```

- **Append**: load the current month partition, push, write. O(month-size).
- **Day read** (`byDay(date)`): load one partition, filter `localDate === date`,
  drop redacted, resolve supersede-chains. The hot daily projection.
- **Range read** (`query({from,to,types})`): load the spanned partitions only.
- **Index** is a tiny manifest for fast "what months have data" (powers the Memory
  Center timeline view and recap availability without loading partitions).

## 5. Memory layer keys

(Full semantics in [03](./03-memory-architecture.md).)

```
@welliva_summary_day_<YYYY-MM-DD>     → DaySummary       (layer 2)
@welliva_summary_week_<YYYY-Www>      → WeekSummary       (layer 2)
@welliva_summary_month_<YYYY-MM>      → MonthSummary      (layer 2)
@welliva_summary_index                → which summaries exist + last compaction
@gozlin_identity / _episodic / _behavioral   → long-term facts (layer 3, exists)
# layer 4 (temporary context) is in-memory; conversation persists at @gozlin_conversation
```

## 6. Settings records (not events)

Goals, Preferences, and Profile have a **current value** that the app reads
constantly; modeling those purely as event folds would be wasteful. They are stored
as **records**, and *every change also emits an event* (`goal.set`,
`preference.changed`, `profile.updated`) so the Timeline stays a complete audit log.

```
@welliva_user_bio        → HealthProfile      (current; existing UserBio + extensions)
@welliva_user_goals      → Goals              (current; existing UserGoals)
@welliva_preferences     → Preferences        (current; extracted from UserBio prefs)
@welliva_profile_meta    → { completeness, unlocks, updatedAt }   (new, [07])
@welliva_consent         → ConsentRecord      (new, [09])
```

This **record + change-event** duality is the one deliberate exception to "writes go
through Timeline" ([01 §4](./01-domain-architecture.md)): the record is the fast read,
the event is the history.

## 7. The key registry

All keys live in one file, `health-os/platform/storage/keys.ts`, superseding the
ad-hoc `KEYS` in `OfflineStorage.ts`. It documents owner-domain, type, and lifecycle:

```ts
export const K = {
  // platform
  SCHEMA_VERSION:   "@welliva_schema_version",   // number; gates migrations
  // timeline (partitioned)
  timelinePart:  (ym: string) => `@welliva_timeline_${ym}`,
  TIMELINE_INDEX:   "@welliva_timeline_index",
  // memory / summaries
  daySummary:    (d: string) => `@welliva_summary_day_${d}`,
  weekSummary:   (w: string) => `@welliva_summary_week_${w}`,
  monthSummary:  (m: string) => `@welliva_summary_month_${m}`,
  SUMMARY_INDEX:    "@welliva_summary_index",
  // settings records
  USER_BIO:         "@welliva_user_bio",
  USER_GOALS:       "@welliva_user_goals",
  PREFERENCES:      "@welliva_preferences",
  PROFILE_META:     "@welliva_profile_meta",
  CONSENT:          "@welliva_consent",
  // ...existing keys kept verbatim during transition (see migration 001)
} as const;
```

> **Existing keys are retained, not renamed.** The migration reads them; nothing is
> repointed until a key's owning silo is fully superseded and a later migration
> retires it. This is how "preserves existing user data" is guaranteed at the schema
> level. See [04](./04-migration-strategy.md).

## 8. Invariants (testable)

1. Events are immutable; the only post-write mutation is setting `redacted: true`.
2. A projection equals the deterministic fold of its non-redacted events
   (property-tested: `sum(meal events) === DaySummary.calories`).
3. `id` is a pure function of `(source record identity)` for imported events →
   re-running migration 001 is a no-op (idempotency test).
4. No read ever returns a `redacted` event (enforced in one place; snapshot-tested).
5. Every settings change has a corresponding change-event with the same timestamp.
