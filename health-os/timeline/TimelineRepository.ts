/**
 * health-os/timeline/TimelineRepository.ts
 *
 * The ONLY code that reads/writes the event store. Append-only with two post-write
 * mutations allowed: redact (soft-delete) and correct (append a superseding event).
 * Partitioned by month for bounded AsyncStorage writes.
 *
 * Invariants (docs/architecture/02-data-and-schema.md §8):
 *  - No read ever returns a redacted event (enforced once, in `resolve`).
 *  - A supersede-chain resolves to its latest non-redacted event.
 *  - append is idempotent on `id` (re-importing a source record is a no-op).
 *
 * See docs/architecture/05-api-and-contracts.md §A.
 */
import { monthKeyOf } from "../platform/clock";
import { store as defaultStore } from "../platform/storage/AsyncStorageAdapter";
import { K } from "../platform/storage/keys";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import type { EventType, HealthEvent } from "./events";

export interface TimelinePartitionMeta {
  count: number;
  from: string; // earliest localDate
  to: string; // latest localDate
}
export interface TimelineIndex {
  partitions: Record<string, TimelinePartitionMeta>;
  total: number;
  updatedAt: number;
}
export interface TimelineQuery {
  from?: string;
  to?: string;
  types?: EventType[];
  limit?: number;
  /** Include soft-deleted (redacted) events. Default false. */
  includeRedacted?: boolean;
  /** Include originals that have been superseded by a correction (the audit trail). Default false. */
  includeSuperseded?: boolean;
}

const EMPTY_INDEX: TimelineIndex = { partitions: {}, total: 0, updatedAt: 0 };
const MONTH_RE = /^\d{4}-\d{2}$/;

export class TimelineRepository {
  constructor(private readonly store: KeyValueStore = defaultStore) {}

  // ── partitions ──

  private partKey(ym: string): string {
    return K.timelinePart(ym);
  }

  private loadPartition(ym: string): Promise<HealthEvent[]> {
    return this.store.get<HealthEvent[]>(this.partKey(ym), []);
  }

  private async savePartition(ym: string, events: HealthEvent[]): Promise<void> {
    // ULID ids sort chronologically, so id-sort keeps partitions ordered.
    events.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    await this.store.set(this.partKey(ym), events);
  }

  /** Month-partition keys (`YYYY-MM`) that actually hold events. Excludes the index key. */
  private async partitionMonths(): Promise<string[]> {
    const keys = await this.store.keys(K.TIMELINE_PREFIX);
    return keys
      .map((k) => k.slice(K.TIMELINE_PREFIX.length))
      .filter((suffix) => MONTH_RE.test(suffix))
      .sort();
  }

  // ── resolution (the single place redaction + supersede are enforced) ──

  private resolve(
    events: HealthEvent[],
    opts: { includeRedacted?: boolean; includeSuperseded?: boolean } = {},
  ): HealthEvent[] {
    const superseded = new Set<string>();
    if (!opts.includeSuperseded) {
      for (const e of events) if (e.supersedes) superseded.add(e.supersedes);
    }
    return events.filter(
      (e) => !superseded.has(e.id) && (opts.includeRedacted || !e.redacted),
    );
  }

  // ── writes ──

  /** Append one event. Idempotent on id (existing id → no-op). Returns the stored event. */
  async append<T>(event: HealthEvent<T>): Promise<HealthEvent<T>> {
    const ym = monthKeyOf(event.localDate);
    const list = await this.loadPartition(ym);
    if (!list.some((e) => e.id === event.id)) {
      list.push(event as HealthEvent);
      await this.savePartition(ym, list);
      await this.bumpIndex(ym, list);
    }
    return event;
  }

  /** Append many efficiently: one read+write per touched month. Idempotent on id. */
  async appendMany(events: HealthEvent[]): Promise<void> {
    if (events.length === 0) return;
    const byMonth = new Map<string, HealthEvent[]>();
    for (const e of events) {
      const ym = monthKeyOf(e.localDate);
      const arr = byMonth.get(ym);
      if (arr) arr.push(e);
      else byMonth.set(ym, [e]);
    }
    for (const [ym, incoming] of byMonth) {
      const list = await this.loadPartition(ym);
      const seen = new Set(list.map((e) => e.id));
      for (const e of incoming) if (!seen.has(e.id)) list.push(e);
      await this.savePartition(ym, list);
    }
    await this.rebuildIndex();
  }

  /** Soft-delete: mark an event redacted. Scans partitions to locate it. */
  async redact(id: string): Promise<boolean> {
    for (const ym of await this.partitionMonths()) {
      const list = await this.loadPartition(ym);
      const idx = list.findIndex((e) => e.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], redacted: true };
        await this.savePartition(ym, list);
        return true;
      }
    }
    return false;
  }

  /**
   * Correction-by-append: emit a new event that supersedes `originalId`, preserving the
   * original's `type` and `localDate` (so both live in the same partition). The
   * original is retained (auditable). Returns the new event, or null if not found.
   */
  async correct<T>(
    originalId: string,
    payload: T,
    patch?: Partial<Pick<HealthEvent<T>, "tags" | "origin">>,
  ): Promise<HealthEvent<T> | null> {
    for (const ym of await this.partitionMonths()) {
      const list = await this.loadPartition(ym);
      const original = list.find((e) => e.id === originalId);
      if (!original) continue;
      const corrected: HealthEvent<T> = {
        ...(original as HealthEvent<T>),
        id: `${originalId}~c${list.filter((e) => e.supersedes === originalId).length + 1}`,
        payload,
        source: "user",
        supersedes: originalId,
        ts: original.ts,
        ...(patch?.tags ? { tags: patch.tags } : {}),
        ...(patch?.origin ? { origin: patch.origin } : {}),
      };
      list.push(corrected as HealthEvent);
      await this.savePartition(ym, list);
      await this.bumpIndex(ym, list);
      return corrected;
    }
    return null;
  }

  /** Apply user tags to an event. */
  async tag(id: string, tags: string[]): Promise<boolean> {
    for (const ym of await this.partitionMonths()) {
      const list = await this.loadPartition(ym);
      const idx = list.findIndex((e) => e.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], tags };
        await this.savePartition(ym, list);
        return true;
      }
    }
    return false;
  }

  /** Hard delete (privacy). Truly removes matching events. Returns count removed. */
  async eraseHard(predicate: (e: HealthEvent) => boolean): Promise<number> {
    let removed = 0;
    for (const ym of await this.partitionMonths()) {
      const list = await this.loadPartition(ym);
      const kept = list.filter((e) => {
        const drop = predicate(e);
        if (drop) removed++;
        return !drop;
      });
      if (kept.length !== list.length) await this.savePartition(ym, kept);
    }
    if (removed > 0) await this.rebuildIndex();
    return removed;
  }

  // ── reads ──

  /** All non-redacted events for a local date, supersede-chains resolved. */
  async byDay(date: string): Promise<HealthEvent[]> {
    const list = await this.loadPartition(monthKeyOf(date));
    return this.resolve(list.filter((e) => e.localDate === date));
  }

  /** Range/type query. Loads only the spanned partitions. Never returns redacted (unless asked). */
  async query(q: TimelineQuery = {}): Promise<HealthEvent[]> {
    const months = await this.partitionMonths();
    const fromM = q.from ? monthKeyOf(q.from) : undefined;
    const toM = q.to ? monthKeyOf(q.to) : undefined;
    const spanned = months.filter(
      (m) => (!fromM || m >= fromM) && (!toM || m <= toM),
    );
    let acc: HealthEvent[] = [];
    for (const ym of spanned) acc = acc.concat(await this.loadPartition(ym));
    let out = this.resolve(acc, {
      includeRedacted: q.includeRedacted,
      includeSuperseded: q.includeSuperseded,
    });
    if (q.from) out = out.filter((e) => e.localDate >= q.from!);
    if (q.to) out = out.filter((e) => e.localDate <= q.to!);
    if (q.types && q.types.length) {
      const set = new Set(q.types);
      out = out.filter((e) => set.has(e.type));
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (q.limit && out.length > q.limit) out = out.slice(-q.limit);
    return out;
  }

  // ── index ──

  index(): Promise<TimelineIndex> {
    return this.store.get<TimelineIndex>(K.TIMELINE_INDEX, EMPTY_INDEX);
  }

  private metaFor(events: HealthEvent[]): TimelinePartitionMeta {
    let from = "";
    let to = "";
    for (const e of events) {
      if (!from || e.localDate < from) from = e.localDate;
      if (!to || e.localDate > to) to = e.localDate;
    }
    return { count: events.length, from, to };
  }

  private async bumpIndex(ym: string, events: HealthEvent[]): Promise<void> {
    const idx = await this.index();
    const partitions = { ...idx.partitions, [ym]: this.metaFor(events) };
    const total = Object.values(partitions).reduce((s, p) => s + p.count, 0);
    await this.store.set(K.TIMELINE_INDEX, {
      partitions,
      total,
      updatedAt: Date.now(),
    });
  }

  /** Recompute the index from scratch by scanning every partition. */
  async rebuildIndex(): Promise<TimelineIndex> {
    const partitions: Record<string, TimelinePartitionMeta> = {};
    let total = 0;
    for (const ym of await this.partitionMonths()) {
      const list = await this.loadPartition(ym);
      partitions[ym] = this.metaFor(list);
      total += list.length;
    }
    const next: TimelineIndex = { partitions, total, updatedAt: Date.now() };
    await this.store.set(K.TIMELINE_INDEX, next);
    return next;
  }
}

/** The default, app-wide repository over the default store. */
export const timeline = new TimelineRepository(defaultStore);
