# 04 — Migration Strategy

The load-bearing promise: **preserve existing user data**. Today's users have months
of `diet_history`, `workout_logs`, `body_logs`, etc. on their devices. The Timeline
must absorb that history without losing a byte and without a risky one-shot rewrite.

## 1. Principles

1. **Forward-only, ordered, versioned.** A single integer `@welliva_schema_version`
   gates an ordered list of migrations. Each runs exactly once, lowest-first.
2. **Idempotent.** Re-running any migration is a no-op (imported event ids are
   deterministic; see §4). A crash mid-migration is safe to retry.
3. **Additive — originals retained.** Migration 001 **reads** the existing silos and
   **writes** events; it does **not** delete the silos. The old keys remain as a
   safety net and as a fallback read path during transition. Retirement of a silo is a
   *separate, later* migration gated on the new path being proven.
4. **Atomic per step, journaled.** A migration writes a `@welliva_migration_journal`
   entry (started/completed + counts) so a partial run is detectable and resumable.
5. **No network, no blocking the UI longer than necessary.** Migrations run on-device
   at boot; large backfills chunk and yield.

## 2. The runner

```ts
// health-os/platform/migrations/runner.ts
export interface Migration {
  version: number;                 // target version after it runs
  name: string;
  /** Idempotent. Receives the store + a clock; returns a short report. */
  up(ctx: MigrationContext): Promise<MigrationReport>;
}

export async function runMigrations(store: KeyValueStore, now = new Date()): Promise<void> {
  const current = await store.get<number>(K.SCHEMA_VERSION, 0);
  const pending = REGISTRY.filter(m => m.version > current).sort((a,b)=>a.version-b.version);
  for (const m of pending) {
    await journalStart(store, m);
    const report = await m.up({ store, now });
    await store.set(K.SCHEMA_VERSION, m.version);   // commit version last
    await journalComplete(store, m, report);
  }
}
```

### Integration point (exact)

`runMigrations` is invoked at the **top of `loadData`** in
`contexts/AppContext.tsx:1183`, immediately after `setIsLoading(true)` and **before**
the first `Promise.all` read of `KEYS.*`:

```ts
const loadData = async () => {
  try {
    setIsLoading(true);
    await runMigrations(store);          // ← NEW: bring storage to current schema first
    const [bio, goals, plan, ...] = await Promise.all([ ... ]); // existing reads, now schema-safe
```

Because the runner is idempotent and version-gated, every subsequent boot after the
first is a single cheap version comparison (`current === latest` → no work).

## 3. Version timeline

| Version | Migration | Effect | Destructive? |
|---|---:|---|---|
| 0 → 1 | `001-backfill-timeline` | Encode all six silos as `HealthEvent`s in monthly partitions; build the timeline index. | **No** — originals kept |
| 1 → 2 | `002-seed-summaries` | Compact each backfilled day into a `DaySummary` (L2); roll up weeks/months. | No |
| 2 → 3 | `003-extract-settings` | Split `UserBio` prefs into the `Preferences` record; seed `ProfileMeta` completeness + `ConsentRecord` defaults. | No (copy, not move) |
| 3 → 4 | `004-retire-redundant` | *After* the new paths are proven in prod, retire silos fully superseded (guarded; see §6). | Yes (guarded, reversible via journal) |

001–003 are pure additive backfills shippable in the foundation milestone. 004 is
deferred until the Timeline is the live write path.

## 4. Migration 001 — backfill the Timeline (the important one)

### Deterministic event ids = idempotency

Each source record maps to an event whose `id` is a **pure function of the source's
identity**, so re-running never duplicates:

```ts
// stable, collision-resistant, reproducible
const id = ulidFromSeed(`diet:${entry.date}:meal:${slot}:${name}`);
```

(`ulidFromSeed` = a ULID whose timestamp is the record's local date and whose
randomness is a hash of the seed — sortable *and* deterministic.)

### Per-silo mapping

```
diet_history[]  (DietHistoryEntry per day)
   ├─ for each consumedMeals[name] → nutrition.meal.logged  (macros from entry if present)
   ├─ for each skippedMeals[name]  → nutrition.meal.skipped
   └─ the day itself               → nutrition.day.closed   (consumed*/adherence)

water_history[] (WaterHistoryEntry per day)  → hydration.day.closed { ml, goalMl, metGoal }

workout_logs[]  (WorkoutLogEntry)            → workout.session.completed
session_history[] (SessionSummaryData)       → workout.session.summary

body_logs[]     (BodyLogEntry)               → body.measurement.logged

@gozlin_checkins[] (GozlinCheckin)           → checkin.logged

@welliva_achievements.earned{id:ISO}         → achievement.unlocked (ts = ISO)
@welliva_challenges.completed[]              → challenge.completed
@welliva_tournament.trophies[]               → trophy.awarded
@gozlin_episodic[]                           → coach.episode
```

### Algorithm (chunked, idempotent)

```
1. If schema_version >= 1 → return (gate).
2. Read all source silos (Promise.all).
3. Build events in memory; group by `localDate`'s month.
4. For each month partition:
     load existing partition (may already hold events from a retried run)
     merge by id (dedupe) → sort by id (ULID = chronological)
     write partition
5. Rebuild @welliva_timeline_index from partition counts.
6. Report { perType: counts, months: n, total }.
```

### Data-loss guards

- **Validation gate:** after backfill, assert `eventCount(nutrition.day.closed) ===
  diet_history.length`, `eventCount(body.measurement.logged) === body_logs.length`,
  etc. A mismatch **aborts the version commit** (schema_version stays 0; originals
  untouched; logged for diagnosis). The user simply runs on the legacy path until
  fixed — zero data loss either way.
- **Originals retained:** silos are never deleted here. If anything about the Timeline
  is wrong, the legacy read paths still have the truth.
- **Journaled:** counts recorded; a support/debug screen can show "imported N meals,
  M workouts…".

## 5. Forward-compatibility for *new* installs

A fresh install boots at `schema_version = 0` with empty silos → 001 backfills nothing
(empty), 002 seeds nothing, 003 writes default Preferences/ProfileMeta/Consent → lands
at the latest version with no special-casing. New and existing users converge on the
same code path.

## 6. Retiring a silo (migration 004, deferred & guarded)

Only after the Timeline is the **live write path** (post-foundation milestones) and a
release has baked:

```
guard: require schema_version >= 3 AND a `timeline.live = true` flag set by the
       release that flips writes to the Timeline.
action: for each retired silo, snapshot it into @welliva_archive_<key> (compressed)
        THEN remove the live key.
reversible: the archive + the journal allow a rollback migration if needed.
```

This staged retirement means there is never a moment where data exists *only* in a
not-yet-trusted location.

## 7. Testing migrations ([11](./11-testing-strategy.md) has the full plan)

- **Golden fixtures:** committed JSON snapshots of real-shaped v0 storage (a light
  user, a heavy multi-month user, an edge user with corrections/redactions). Run the
  runner → assert exact event output + index.
- **Idempotency:** run twice → second run produces zero new events, identical state.
- **Crash-resume:** abort after partition 2 of 5 → re-run completes correctly.
- **Validation-gate:** corrupt a fixture → assert the version is NOT committed and
  originals are intact.
- **Round-trip:** events folded back into a `DaySummary` equal the legacy
  `DietHistoryEntry` for that day (proves the encoding is lossless).
