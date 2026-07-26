# 03 — Memory Architecture

The mission names four memory layers: **Event History, Summaries, Long-Term Memory,
Temporary Context**. The codebase already has a 4-tier Gozlin memory
(Identity/Episodic/Behavioral/Conversational). This document unifies the two: the
mission's four layers become the canonical model, and Gozlin's tiers slot into them.

## 1. The four layers

```
            volatility ↑                                  what reads it
  ┌──────────────────────────────────────────────────────────────────────┐
  │ L4  TEMPORARY CONTEXT   in-memory + conversation     the live UI, the  │
  │     today's working set, chat turns, the Twin        current chat      │
  ├──────────────────────────────────────────────────────────────────────┤
  │ L3  LONG-TERM MEMORY    durable facts, slow-changing  Context builder, │
  │     motivation, prefs, injuries, learned patterns,    every AI feature │
  │     milestones                                                          │
  ├──────────────────────────────────────────────────────────────────────┤
  │ L2  SUMMARIES           compacted day/week/month      Context builder  │
  │     rollups — THE default AI interface                (the hot read)   │
  ├──────────────────────────────────────────────────────────────────────┤
  │ L1  EVENT HISTORY       the raw append-only Timeline   compaction,     │
  │     every HealthEvent, immutable                       Memory Center,  │
  │     (source of truth)                                  audit/export    │
            durability ↑                                  rarely the AI    │
  └──────────────────────────────────────────────────────────────────────┘
```

### L1 — Event History (the Timeline)

- **What:** every `HealthEvent`, immutable, partitioned by month ([02](./02-data-and-schema.md)).
- **Role:** the single source of truth. Everything else is derived from it and can be
  rebuilt from it.
- **Who reads it:** compaction, the Memory Center (raw view + export), and *occasionally*
  a feature that needs the last N events of a type. **AI features do not page L1.**
- **Maps from:** the six existing silos, unified by migration 001.

### L2 — Summaries (the AI interface)

- **What:** persisted `DaySummary` / `WeekSummary` / `MonthSummary` records — the
  compacted projections of L1.
- **Role:** the bounded, cheap thing the **Context** builder and AI consume by default.
  This is the structural answer to *"APIs consume summarized context, not raw logs."*
- **Who reads it:** Context builder, recap, weekly review, forecast, briefing.
- **Maps from:** generalizes what `DietHistoryEntry` and `MonthlyRecapService` already
  compute on the fly — now persisted and incremental.

```ts
// health-os/memory/layers.ts (abridged)
export interface DaySummary {
  date: string;                       // YYYY-MM-DD
  // NOTE (M1, shipped): adherence is MEALS-BASED (mealsConsumed/totalMeals), not
  // calorie-target-based, so a DaySummary is self-contained — backfill needs no
  // historical target. The live `target` field is deferred until forward writes (M6).
  nutrition: { calories: number; proteinG: number; carbsG: number; fatG: number;
               adherence: number; mealsLogged: number; mealsConsumed: number; totalMeals: number; };
  hydration: { ml: number; goalMl: number; metGoal: boolean };
  workout:   { completed: boolean; durationMin: number; completionPct: number | null };
  body?:     { weightKg?: number };
  checkin?:  { mood?: number; energy?: number; stress?: number; sleepHours?: number };
  computedAt: number;                 // for staleness/recompaction
  fromEventCount: number;             // audit: how many events folded in
}
export interface WeekSummary { weekStart: string; adherence: number;
  avgMacros: {...}; sessions: number; weighIns: number; net: {...}; }
export interface MonthSummary { periodKey: string; /* feeds MonthlyRecapService */ }
```

### L3 — Long-Term Memory (durable facts)

- **What:** slow-changing truths — the user's **motivation/"why"**, stated
  **preferences** & **constraints**, **learned behavioral patterns**, and
  **episodic milestones** (first 7-day streak, goal reached).
- **Role:** identity and history the coach must never forget. Survives indefinitely
  (episodes pruned by cap/age; facts kept).
- **Maps from (exists today):** `@gozlin_identity` (motivation/preferences/constraints),
  `@gozlin_behavioral` (learned `HabitPattern[]`), `@gozlin_episodic` (milestones).
  These become the `LongTermStore`, unchanged in storage, given a domain home.

### L4 — Temporary Context (working set)

- **What:** ephemeral state — the **current conversation**, today's live counters
  before day-close, transient flags, and the **assembled Twin** (recomputed per
  session, not persisted as truth).
- **Role:** fast, disposable. Lost-on-restart is fine (except the conversation, which
  persists capped at `@gozlin_conversation`).
- **Maps from (exists):** `GozlinTwin` (in-memory read-model), `@gozlin_conversation`
  (capped at 60 turns), the live `contexts/*` state.

## 2. Gozlin tiers → four layers (reconciliation)

| Gozlin tier (today) | Storage key | Becomes |
|---|---|---|
| Identity | `@gozlin_identity` | **L3** Long-Term (facts) |
| Behavioral | `@gozlin_behavioral` | **L3** Long-Term (learned patterns) |
| Episodic | `@gozlin_episodic` | **L3** Long-Term (milestones) — *also* mirrored as `coach.episode` events in **L1** |
| Conversational | `@gozlin_conversation` | **L4** Temporary |
| (the Twin) | in-memory | **L4** working read-model → promoted to the **Context** domain |
| Check-ins | `@gozlin_checkins` | **L1** as `checkin.logged` events (source of truth) + **L4** today's |

No Gozlin storage is moved or broken; it is *re-homed* and, for episodic/check-ins,
*also* projected into L1 so the unified Timeline is complete.

## 3. Compaction — the events → summaries pipeline

```
   new events appended (L1)
            │
            ▼
   compaction.compactDay(date)   ── fold non-redacted events for `date`
            │                        into a DaySummary, write L2
            ├─ triggered on day-close (processDayEnd already runs here)
            ├─ triggered lazily on read if a day's summary is missing/stale
            ▼
   compaction.compactWeek/Month  ── roll DaySummaries up (cheap, from L2 not L1)
```

- **Incremental + idempotent.** Recompacting a day from its events yields the same
  `DaySummary` (deterministic; property-tested per [02 §8](./02-data-and-schema.md)).
- **Staleness:** a summary stores `computedAt` + `fromEventCount`. If a correction or
  redaction changes a past day, that day is marked dirty and recompacted on next read.
  Week/month summaries recompute from their day summaries — never re-scanning L1.
- **Hook point:** `processDayEnd(lastDate)` in `contexts/AppContext.tsx` (today it
  closes diet history) gains a `compactDay(lastDate)` call. The day-close path already
  exists; we extend it.

## 4. How AI consumes summaries (the boundary)

The **Context** builder ([05 §3](./05-api-and-contracts.md)) assembles the AI payload
from **L2 + L3 + a thin L1 slice** (e.g. the last 7 day-summaries, the last few
episodes, current facts) — never the raw partitions. This is the generalization of
`GozlinTwin.buildTwin`, which already does exactly this for "today".

```
buildContext(range) = {
  identity:  L3 facts (motivation, constraints, learned patterns),
  recent:    L2 last-N day summaries + this week/month summary,
  trajectory:L2-derived (weight trend, adherence, momentum),
  today:     L4 live counters,
}  // bounded, ~a few KB, stable token cost regardless of history length
```

The remote AI (`server/`) receives only this Context (minimized further by the
privacy boundary, [09](./09-privacy-and-consent.md)) — **the raw Timeline never
leaves the device**, and the network payload's size is independent of how many years
the user has been logging.

## 5. Retention & forgetting

| Layer | Default retention | Policy |
|---|---|---|
| L1 Events | indefinite (it's the truth) | user-driven erase only ([09](./09-privacy-and-consent.md)); optional age-based archive to compressed cold partitions later |
| L2 Summaries | day: 1y rolling, week/month: indefinite | days older than 1y collapse into their week/month summaries; cheap, lossless at the rollup grain |
| L3 Facts | indefinite; episodes capped (100 / 90d, as today) | matches existing `GozlinMemoryStore` caps |
| L4 Temporary | conversation capped 60 turns (as today); rest is per-session | — |

"Forget me" granularity (a single fact, a category, a date range, or everything) is a
Memory Center + Privacy concern — see [08](./08-memory-center.md), [09](./09-privacy-and-consent.md).

## 6. Why this is the right memory model for a coach

- **The coach never forgets identity** (L3) but **never drowns in detail** (it reads
  L2, not L1).
- **Corrections and forgetting are first-class** because truth is the event log, and
  summaries are rebuildable — editing the past is just a recompaction, not a data
  hazard.
- **Token cost is bounded for life.** A 10-year user and a 10-day user produce the
  same-sized Context.
