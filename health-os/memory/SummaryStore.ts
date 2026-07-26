/**
 * health-os/memory/SummaryStore.ts
 *
 * Layer-2 persistence: the ONLY code that reads/writes summary keys + the summary
 * index. Talks to the storage PORT (never AsyncStorage directly), using the registry
 * keys declared in platform/storage/keys.ts.
 *
 * See docs/architecture/02-data-and-schema.md §5, 03-memory-architecture.md §1.
 */
import { store as defaultStore } from "../platform/storage/AsyncStorageAdapter";
import { K } from "../platform/storage/keys";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import {
  EMPTY_SUMMARY_INDEX,
  type DaySummary,
  type MonthSummary,
  type SummaryIndex,
  type WeekSummary,
} from "./layers";

export class SummaryStore {
  constructor(private readonly store: KeyValueStore = defaultStore) {}

  // ── day summaries ──

  getDay(date: string): Promise<DaySummary | null> {
    return this.store.get<DaySummary | null>(K.daySummary(date), null);
  }

  async setDay(summary: DaySummary): Promise<void> {
    await this.store.set(K.daySummary(summary.date), summary);
    await this.indexDay(summary.date);
  }

  async removeDay(date: string): Promise<void> {
    await this.store.remove(K.daySummary(date));
    const idx = await this.index();
    await this.writeIndex({
      days: idx.days.filter((d) => d !== date),
      dirtyDays: idx.dirtyDays.filter((d) => d !== date),
    });
  }

  // ── week / month rollups (write-through cache) ──

  getWeek(weekStart: string): Promise<WeekSummary | null> {
    return this.store.get<WeekSummary | null>(K.weekSummary(weekStart), null);
  }

  setWeek(summary: WeekSummary): Promise<void> {
    return this.store.set(K.weekSummary(summary.weekStart), summary);
  }

  getMonth(periodKey: string): Promise<MonthSummary | null> {
    return this.store.get<MonthSummary | null>(K.monthSummary(periodKey), null);
  }

  setMonth(summary: MonthSummary): Promise<void> {
    return this.store.set(K.monthSummary(summary.periodKey), summary);
  }

  // ── index ──

  index(): Promise<SummaryIndex> {
    return this.store.get<SummaryIndex>(K.SUMMARY_INDEX, EMPTY_SUMMARY_INDEX);
  }

  private async writeIndex(patch: Partial<SummaryIndex>): Promise<void> {
    const idx = await this.index();
    await this.store.set(K.SUMMARY_INDEX, {
      days: patch.days ?? idx.days,
      dirtyDays: patch.dirtyDays ?? idx.dirtyDays,
      updatedAt: Date.now(),
    });
  }

  /** Record that `date` has a summary and clear any dirty flag on it. */
  private async indexDay(date: string): Promise<void> {
    const idx = await this.index();
    const days = idx.days.includes(date)
      ? idx.days
      : [...idx.days, date].sort();
    await this.writeIndex({
      days,
      dirtyDays: idx.dirtyDays.filter((d) => d !== date),
    });
  }

  /** Mark a day's summary stale (recomputed lazily on next read). */
  async markDirty(date: string): Promise<void> {
    const idx = await this.index();
    if (idx.dirtyDays.includes(date)) return;
    await this.writeIndex({ dirtyDays: [...idx.dirtyDays, date] });
  }

  /** Remove every summary (day/week/month) + the index. Used by "forget everything". */
  async clear(): Promise<void> {
    const keys = await this.store.keys(K.SUMMARY_PREFIX);
    await Promise.all(keys.map((k) => this.store.remove(k)));
  }

  isDirty(idx: SummaryIndex, date: string): boolean {
    return idx.dirtyDays.includes(date);
  }
}

/** The default, app-wide summary store. */
export const summaries = new SummaryStore(defaultStore);
