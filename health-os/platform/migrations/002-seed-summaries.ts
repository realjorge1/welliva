/**
 * Migration 002 — seed Layer-2 day summaries from the backfilled Timeline.
 *
 * After 001 has unified every silo into the Timeline (L1), this folds each day that
 * has events into a persisted `DaySummary` (L2), so the Context builder and AI
 * features read bounded summaries from day one instead of paging raw events.
 *
 * Idempotent: the fold is deterministic, so re-running rewrites identical day
 * summaries (under a fixed clock). A count mismatch THROWS → schema_version stays
 * unadvanced and the app runs on lazily-computed summaries: zero data risk.
 *
 * See docs/architecture/03-memory-architecture.md §3, 12-implementation-roadmap.md §M1.
 */
import { compactDay } from "../../memory/compaction";
import { SummaryStore } from "../../memory/SummaryStore";
import type { HealthEvent } from "../../timeline/events";
import { TimelineRepository } from "../../timeline/TimelineRepository";
import type { Migration, MigrationReport } from "./runner";

export const migration002: Migration = {
  version: 2,
  name: "seed-summaries",

  async up({ store, now }): Promise<MigrationReport> {
    const timeline = new TimelineRepository(store);
    const summaries = new SummaryStore(store);
    const computedAt = now.getTime();

    // All non-redacted, supersede-resolved events, grouped by local date.
    const all = await timeline.query();
    const byDate = new Map<string, HealthEvent[]>();
    for (const e of all) {
      const arr = byDate.get(e.localDate);
      if (arr) arr.push(e);
      else byDate.set(e.localDate, [e]);
    }

    for (const [date, events] of byDate) {
      const summary = compactDay(events, date, { now: computedAt });
      await summaries.setDay(summary);
    }

    // ── validation gate: one summary per distinct event-day (throws → no commit) ──
    const index = await summaries.index();
    if (index.days.length < byDate.size) {
      throw new Error(
        `summary seed mismatch: have ${index.days.length} day summaries, expected ≥ ${byDate.size}`,
      );
    }

    return {
      eventsScanned: all.length,
      daysSummarized: byDate.size,
      summaryDays: index.days.length,
    };
  },
};
