/**
 * FoodLogService — free-form food logging, alongside (not inside) the plan.
 *
 * The plan answers "did you eat what you were supposed to?". This answers "what
 * did you actually eat?" — a different question, and one the schedule can't
 * hold, because a schedule slot is a yes/no tick against a meal we chose, while
 * this is an arbitrary food the user names themselves.
 *
 * They're kept in separate stores and merged only at read time (dayNutrients).
 * Writing ad-hoc foods into the schedule would corrupt adherence: eating a
 * banana isn't evidence you ate the planned lunch, and the end-of-period report
 * would quietly start scoring the wrong thing.
 *
 * The same back-log window that governs meal ticking governs this, for the same
 * reason — a log you can rewrite indefinitely stops being a record.
 */

import type { FoodItem } from "../../constants/FoodDictionary";
import type { MealType } from "../../models/diet";
import {
  sumPanels,
  weakestConfidence,
  type FoodAnalysis,
  type NutrientConfidence,
  type NutrientKey,
  type NutrientPanel,
  type ResolvedFoodItem,
} from "../../models/nutrients";
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";
import { canLogForDate, logPermissionFor } from "../ScheduleService";
import { pruneDatedRecord, RETENTION_DAYS } from "../sync/retention";
import { resolveCatalogFood, resolveKnownFood } from "./NutrientResolver";

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

type LogStore = Record<string, FoodLogEntry[]>;

let opChain: Promise<unknown> = Promise.resolve();
function withLock<T>(op: () => Promise<T>): Promise<T> {
  const result = opChain.then(op, op);
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function newId(): string {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readStore(): Promise<LogStore> {
  return readJSON<LogStore>(KEYS.FOOD_LOG, {});
}

/**
 * The single write path, so retention can't be forgotten at one of the five
 * call sites. This document had no cap at all: it's a Record of every day a
 * user has ever logged an ad-hoc food, re-uploaded IN FULL on every tap (see
 * services/sync/retention.ts). Days beyond the window are compacted into the
 * health-os day summaries before they're dropped, so history survives.
 */
async function writeStore(store: LogStore): Promise<void> {
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

// ============================================================================
// WRITE
// ============================================================================

export interface LogAnalysisInput {
  date: string;
  slot: MealType | null;
  analysis: FoodAnalysis;
  origin?: FoodLogEntry["origin"];
  /** Override the display label; defaults to the user's original text. */
  label?: string;
}

/**
 * Persist a completed analysis. Unmatched items are stored too — the user said
 * they ate them, and dropping them would make the log quietly disagree with
 * what they typed. They simply contribute no nutrients.
 */
export async function logAnalysis(
  input: LogAnalysisInput,
): Promise<FoodLogEntry | null> {
  if (!canLogForDate(input.date)) return null;

  return withLock(async () => {
    const store = await readStore();
    const entry: FoodLogEntry = {
      id: newId(),
      date: input.date,
      slot: input.slot,
      label: input.label ?? input.analysis.input,
      items: input.analysis.items,
      totals: input.analysis.totals,
      partialKeys: input.analysis.partialKeys,
      confidence: input.analysis.confidence,
      origin: input.origin ?? "gozlin",
      loggedAt: new Date().toISOString(),
    };
    store[input.date] = [...(store[input.date] ?? []), entry];
    await writeStore(store);
    return entry;
  });
}

/**
 * Persist one already-resolved food as its own entry.
 *
 * The single-item write path, shared by every "the user picked a food and a
 * portion" caller. `partialKeys` is empty by construction: one item can't have
 * a partial total, since there is nothing for it to be partial against.
 */
export async function logResolvedItem(args: {
  date: string;
  slot: MealType | null;
  item: ResolvedFoodItem;
  /** Display label; defaults to the item's own "2 cup rice" phrasing. */
  label?: string;
  origin?: FoodLogEntry["origin"];
}): Promise<FoodLogEntry | null> {
  if (!canLogForDate(args.date)) return null;

  return withLock(async () => {
    const store = await readStore();
    const entry: FoodLogEntry = {
      id: newId(),
      date: args.date,
      slot: args.slot,
      label: (args.label ?? args.item.inputText).replace(/\s+/g, " ").trim(),
      items: [args.item],
      totals: args.item.nutrients,
      partialKeys: [],
      confidence: args.item.confidence,
      origin: args.origin ?? "catalog",
      loggedAt: new Date().toISOString(),
    };
    store[args.date] = [...(store[args.date] ?? []), entry];
    await writeStore(store);
    return entry;
  });
}

/** Log a single reference food at a chosen portion (a catalog tap). */
export async function logKnownFood(args: {
  date: string;
  slot: MealType | null;
  foodId: string;
  quantity: number;
  unit: string;
}): Promise<FoodLogEntry | null> {
  const item = resolveKnownFood(args.foodId, args.quantity, args.unit);
  if (!item) return null;
  return logResolvedItem({
    date: args.date,
    slot: args.slot,
    item,
    label: `${args.quantity} ${args.unit} ${item.name}`,
  });
}

/**
 * Log a food the user picked out of the browsable Foods catalog.
 *
 * Routed through NutrientResolver rather than reading the catalog's macros
 * directly, so a catalog food that also exists in the reference table is logged
 * with its measured panel and citation instead of four macros — the whole point
 * of moving the Foods screen onto this store.
 */
export async function logCatalogFood(args: {
  date: string;
  slot: MealType | null;
  food: FoodItem;
  quantity: number;
  unit: string;
}): Promise<FoodLogEntry | null> {
  const item = resolveCatalogFood(args.food, args.quantity, args.unit);
  return logResolvedItem({
    date: args.date,
    slot: args.slot,
    item,
    // The catalog's own name, always — the reference entry it matched may be
    // called something else ("Mackerel" for "Mackerel / Titus"), and the log
    // should read back as the thing the user actually tapped.
    label: `${formatQuantity(args.quantity)} ${args.unit} ${args.food.name}`,
  });
}

/** Trim trailing zeros so a half portion reads "0.5", not "0.50". */
function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100);
}

export async function removeFoodLog(
  date: string,
  entryId: string,
): Promise<boolean> {
  if (!canLogForDate(date)) return false;
  return withLock(async () => {
    const store = await readStore();
    const entries = store[date];
    if (!entries) return false;
    const next = entries.filter((e) => e.id !== entryId);
    if (next.length === entries.length) return false;
    if (next.length === 0) delete store[date];
    else store[date] = next;
    await writeStore(store);
    return true;
  });
}

/**
 * Replace one item within a logged entry — the "did you mean…" correction path
 * after a bad match. Recomputes the entry's totals and confidence so the
 * correction is reflected everywhere, not just in the item's name.
 */
export async function replaceLoggedItem(args: {
  date: string;
  entryId: string;
  itemId: string;
  foodId: string;
  quantity?: number;
  unit?: string;
}): Promise<FoodLogEntry | null> {
  if (!canLogForDate(args.date)) return null;

  return withLock(async () => {
    const store = await readStore();
    const entries = store[args.date];
    const entry = entries?.find((e) => e.id === args.entryId);
    if (!entry) return null;

    const original = entry.items.find((i) => i.id === args.itemId);
    if (!original) return null;

    const replacement = resolveKnownFood(
      args.foodId,
      args.quantity ?? original.quantity,
      args.unit ?? original.unit,
    );
    if (!replacement) return null;

    // Preserve the user's original words so the log still reads as what they said.
    replacement.inputText = original.inputText;
    entry.items = entry.items.map((i) => (i.id === args.itemId ? replacement : i));

    const contributing = entry.items.filter((i) => i.confidence !== "unmatched");
    const { totals, partialKeys } = sumPanels(contributing.map((i) => i.nutrients));
    entry.totals = totals;
    entry.partialKeys = partialKeys;
    entry.confidence = worst(entry.items.map((i) => i.confidence));

    await writeStore(store);
    return entry;
  });
}

/**
 * Weakest confidence in a set. Delegates to models/nutrients rather than
 * carrying its own copy of the ranking — this file used to duplicate the table,
 * which meant adding a rung in one place silently mis-ranked entries here.
 */
function worst(list: NutrientConfidence[]): NutrientConfidence {
  return weakestConfidence(list);
}

/** Whether the UI should enable logging controls for a date, and why not. */
export function loggingState(date: string) {
  return logPermissionFor(date);
}

/**
 * Drop logs older than `keepDays`. The nutrient panels are the largest thing
 * this app stores per day, and a year of them is dead weight once the period
 * they belonged to has been reported on.
 */
export async function pruneFoodLog(
  before: string,
): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    const stale = Object.keys(store).filter((date) => date < before);
    if (stale.length === 0) return 0;
    for (const date of stale) delete store[date];
    await writeStore(store);
    return stale.length;
  });
}
