/**
 * FOOD LOG STORE — the persistence leaf under FoodLogService.
 *
 * WHY THIS IS SPLIT OUT. Closing a day has to read the free-form log: a history
 * row that reports only the plan's ticked meals under-reports what the user
 * actually ate, and that number is what the trend charts, the period report and
 * the TDEE learning filter all treat as intake. But ScheduleService cannot
 * import FoodLogService — that module pulls NutrientResolver and the food
 * catalogs behind it, purely to WRITE, and a cycle plus a catalog load is a
 * steep price for a read of four numbers.
 *
 * So the store (the type, the lock, the reads, retention) lives here, with no
 * dependency beyond OfflineStorage; the resolver-backed write paths stay in
 * FoodLogService, which re-exports everything below so no call site moves.
 */

import type { MealType } from "../../models/diet";
import {
  sumPanels,
  type NutrientConfidence,
  type NutrientKey,
  type NutrientPanel,
  type ResolvedFoodItem,
} from "../../models/nutrients";
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";
import { pruneDatedRecord, RETENTION_DAYS } from "../sync/retention";

export interface FoodLogEntry {
  id: string;
  /** Local YYYY-MM-DD. */
  date: string;
  /** Slot the user attributed it to, or null for "just something I ate". */
  slot: MealType | null;
  /** Display label — the user's own words where they typed them. */
  label: string;
  items: ResolvedFoodItem[];
  totals: NutrientPanel;
  /** Nutrients only some items measured — shown as "at least", never as exact. */
  partialKeys: NutrientKey[];
  confidence: NutrientConfidence;
  /** How it got here, for the UI's provenance line. */
  origin: "gozlin" | "catalog" | "manual";
  loggedAt: string;
}

export type LogStore = Record<string, FoodLogEntry[]>;

let opChain: Promise<unknown> = Promise.resolve();

/** Serialize read-modify-write cycles so two quick logs can't clobber each other. */
export function withLock<T>(op: () => Promise<T>): Promise<T> {
  const result = opChain.then(op, op);
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function newId(): string {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function readStore(): Promise<LogStore> {
  return readJSON<LogStore>(KEYS.FOOD_LOG, {});
}

/**
 * The single write path, so retention can't be forgotten at one of the five
 * call sites. This document had no cap at all: it's a Record of every day a
 * user has ever logged an ad-hoc food, re-uploaded IN FULL on every tap (see
 * services/sync/retention.ts). Days beyond the window are compacted into the
 * health-os day summaries before they're dropped, so history survives.
 */
export async function writeStore(store: LogStore): Promise<void> {
  const pruned = await pruneDatedRecord(store, RETENTION_DAYS.FOOD_LOG);
  await writeJSON(KEYS.FOOD_LOG, pruned);
}

// ============================================================================
// READ
// ============================================================================

export async function getFoodLogForDate(date: string): Promise<FoodLogEntry[]> {
  const store = await readStore();
  return store[date] ?? [];
}

export async function getFoodLogRange(
  start: string,
  end: string,
): Promise<FoodLogEntry[]> {
  const store = await readStore();
  return Object.entries(store)
    .filter(([date]) => date >= start && date <= end)
    .flatMap(([, entries]) => entries)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

/**
 * Everything logged on a date, summed.
 *
 * Uses sumPanels, so a nutrient measured for only some entries is reported in
 * `partialKeys` rather than presented as a complete daily total. A day of
 * "banana + a catalog-only meal" must not read as though it contained only the
 * banana's iron.
 */
export async function dayNutrients(date: string): Promise<{
  totals: NutrientPanel;
  partialKeys: NutrientKey[];
  entryCount: number;
}> {
  const entries = await getFoodLogForDate(date);
  const { totals, partialKeys } = sumPanels(entries.map((e) => e.totals));
  return { totals, partialKeys, entryCount: entries.length };
}

/**
 * Drop logs older than `before`. The nutrient panels are the largest thing this
 * app stores per day, and a year of them is dead weight once the period they
 * belonged to has been reported on.
 */
export async function pruneFoodLog(before: string): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    const stale = Object.keys(store).filter((date) => date < before);
    if (stale.length === 0) return 0;
    for (const date of stale) delete store[date];
    await writeStore(store);
    return stale.length;
  });
}
