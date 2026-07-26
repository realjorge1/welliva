/**
 * health-os/memory/MemoryRepository.ts
 *
 * Orchestrates the events → summaries pipeline: reads L1 (TimelineRepository), folds
 * with the pure `compaction` functions, and persists L2 (SummaryStore). This is the
 * façade the app uses — `compactDay` on day-close, lazy `getDaySummary` on read, and
 * `recompactDay` after a Memory Center correction/redaction.
 *
 * Staleness is dirty-tracked: a correction/redaction marks the day dirty; the next
 * read recomputes it. Week/month rollups read day summaries (L2), never L1.
 *
 * See docs/architecture/03-memory-architecture.md §3, 08-memory-center.md §3.
 */
import { monthKeyOf, weekKeyOf } from "../platform/clock";
import { compactDay, compactMonth, compactWeek } from "./compaction";
import type { DaySummary, MonthSummary, WeekSummary } from "./layers";
import { SummaryStore, summaries as defaultSummaries } from "./SummaryStore";
import {
  TimelineRepository,
  timeline as defaultTimeline,
} from "../timeline/TimelineRepository";

export class MemoryRepository {
  constructor(
    private readonly timeline: TimelineRepository = defaultTimeline,
    private readonly summaries: SummaryStore = defaultSummaries,
  ) {}

  // ── day ──

  /** Fold a day's L1 events into a DaySummary and persist it. Idempotent. */
  async compactDay(date: string, now?: number): Promise<DaySummary> {
    const events = await this.timeline.byDay(date); // already resolved + non-redacted
    const summary = compactDay(events, date, { now });
    await this.summaries.setDay(summary);
    return summary;
  }

  /**
   * Like `compactDay`, but a no-op when the Timeline holds no events for `date` yet.
   * Used by the live day-close hook: forward Timeline writes land in a later milestone
   * (roadmap M6), so until then this avoids seeding false "untracked" summaries for new
   * days while still compacting any day that IS represented in the Timeline.
   */
  async compactDayIfPresent(date: string, now?: number): Promise<DaySummary | null> {
    const events = await this.timeline.byDay(date);
    if (events.length === 0) return null;
    const summary = compactDay(events, date, { now });
    await this.summaries.setDay(summary);
    return summary;
  }

  /** Lazy read: the stored summary if fresh, else recompute (missing or dirty). */
  async getDaySummary(date: string): Promise<DaySummary> {
    const [stored, idx] = await Promise.all([
      this.summaries.getDay(date),
      this.summaries.index(),
    ]);
    if (stored && !this.summaries.isDirty(idx, date)) return stored;
    return this.compactDay(date);
  }

  /** Recompute a day now (after a correction / redaction / tag in the Memory Center). */
  recompactDay(date: string, now?: number): Promise<DaySummary> {
    return this.compactDay(date, now);
  }

  /** Defer recomputation — the day is recomputed on its next read. */
  markDirty(date: string): Promise<void> {
    return this.summaries.markDirty(date);
  }

  // ── week / month (rolled up FROM day summaries) ──

  async getWeekSummary(weekStart: string, now?: number): Promise<WeekSummary> {
    const idx = await this.summaries.index();
    const days = await this.daySummaries(
      idx.days.filter((d) => weekKeyOf(d) === weekStart),
    );
    const summary = compactWeek(days, weekStart, { now });
    await this.summaries.setWeek(summary);
    return summary;
  }

  async getMonthSummary(periodKey: string, now?: number): Promise<MonthSummary> {
    const idx = await this.summaries.index();
    const days = await this.daySummaries(
      idx.days.filter((d) => monthKeyOf(d) === periodKey),
    );
    const summary = compactMonth(days, periodKey, { now });
    await this.summaries.setMonth(summary);
    return summary;
  }

  /** The recent N day summaries (most recent last) — the Context builder's hot slice. */
  async recentDays(limit: number): Promise<DaySummary[]> {
    const idx = await this.summaries.index();
    const keys = idx.days.slice(-limit);
    return this.daySummaries(keys);
  }

  private daySummaries(dayKeys: string[]): Promise<DaySummary[]> {
    return Promise.all(dayKeys.map((d) => this.getDaySummary(d)));
  }
}

/** The default, app-wide memory repository over the default timeline + summary stores. */
export const memory = new MemoryRepository(defaultTimeline, defaultSummaries);
