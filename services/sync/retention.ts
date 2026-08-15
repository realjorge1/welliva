/**
 * RETENTION — bounding the documents that grow forever.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. Every synced key re-uploads its WHOLE
 * document on every change (see DocumentSync's header — one JSONB row per key,
 * deliberately). So an unbounded log isn't just disk: a two-year user pushes a
 * multi-megabyte document on every meal tap, on whatever connection they happen
 * to be on. Gozlin's memory already models this correctly (EPISODE_CAP, age
 * bounded); these keys never did.
 *
 * COMPACT BEFORE YOU DROP. Pruning a day of raw logs must not delete a day of
 * HISTORY. The health-os L2 day summaries are the compacted record that long
 * horizon features (recap, Story, trends) read, so anything about to age out is
 * compacted first — `compactDayIfPresent` is idempotent and a no-op for days the
 * Timeline never saw, so this is safe to call on every prune.
 *
 * The compaction hook is INJECTED rather than imported: this module is used by
 * leaf services (FoodLogService), and reaching from a leaf into the health-os
 * module graph would couple the two in a way neither wants. Uninstalled, prunes
 * still work — they just don't compact, which is exactly the pre-existing
 * behavior. See connectivity.ts for the same pattern.
 */

/** Days of raw log kept per key. Beyond this, the L2 summary is the record. */
export const RETENTION_DAYS = {
  /** Ad-hoc food logs age out fastest — they're the noisiest and largest. */
  FOOD_LOG: 180,
  /** Comfortably more than a year, so every trend chart still has its data. */
  DAILY_HISTORY: 400,
  /** Feeds the fitness-fatigue fit, which looks back a year. */
  SESSION_HISTORY: 400,
} as const;

type CompactHook = (date: string) => Promise<unknown>;

let compactHook: CompactHook | null = null;

/** Install the health-os day-compaction hook. Called once, at startup. */
export function setRetentionCompactor(fn: CompactHook | null): void {
  compactHook = fn;
}

/** Compact days about to be dropped. Fail-soft — never blocks a write. */
async function compactBeforeDrop(dates: string[]): Promise<void> {
  if (!compactHook || dates.length === 0) return;
  for (const date of dates) {
    try {
      await compactHook(date);
    } catch {
      /* a failed compaction must not stop the prune, or the doc grows forever */
    }
  }
}

const isDateKey = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);

/**
 * Prune a `Record<YYYY-MM-DD, T>` document to its newest `capDays` days.
 * Returns the same object when nothing aged out, so callers can skip the write.
 */
export async function pruneDatedRecord<T>(
  store: Record<string, T>,
  capDays: number,
): Promise<Record<string, T>> {
  const dates = Object.keys(store).filter(isDateKey).sort();
  if (dates.length <= capDays) return store;

  const dropped = dates.slice(0, dates.length - capDays);
  await compactBeforeDrop(dropped);

  const next: Record<string, T> = { ...store };
  for (const date of dropped) delete next[date];
  return next;
}

/**
 * Prune an array of dated rows to its newest `capDays` entries. Order-agnostic:
 * it selects by DATE, not by position, so it's correct for both the
 * newest-first and oldest-first arrays this app writes.
 */
export async function pruneDatedArray<T extends Record<string, unknown>>(
  rows: T[],
  dateField: string,
  capDays: number,
): Promise<T[]> {
  if (rows.length <= capDays) return rows;

  const dateOf = (row: T) => String(row[dateField] ?? "");
  const keep = new Set(
    [...new Set(rows.map(dateOf))]
      .filter(Boolean)
      .sort()
      .slice(-capDays),
  );
  if (keep.size === 0) return rows;

  const dropped = rows.filter((r) => !keep.has(dateOf(r))).map(dateOf);
  await compactBeforeDrop([...new Set(dropped)].filter(Boolean));

  return rows.filter((r) => keep.has(dateOf(r)));
}
