/**
 * FoodLogService — free-form food logging, alongside (not inside) the plan.
 *
 * The plan answers "did you eat what you were supposed to?". This answers "what
 * did you actually eat?" — a different question, and one the schedule can't
 * hold, because a schedule slot is a yes/no tick against a meal we chose, while
 * this is an arbitrary food the user names themselves.
 *
 * They are kept in separate stores and summed only at read time, by
 * services/nutrition/DayTotals — the one module that states a day’s intake.
 * Writing ad-hoc foods into the schedule would corrupt adherence: eating a
 * banana isn't evidence you ate the planned lunch, and the end-of-period report
 * would quietly start scoring the wrong thing. Adding them up for a TOTAL is a
 * different act from filing them in the same drawer, and only the second one
 * lies.
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
  type ResolvedFoodItem,
} from "../../models/nutrients";
import {
  newId,
  readStore,
  withLock,
  writeStore,
  type FoodLogEntry,
} from "./foodLogStore";
import { canLogForDate, logPermissionFor } from "./logWindow";
import { resolveCatalogFood, resolveKnownFood } from "./NutrientResolver";

/*
 * THE STORE ITSELF LIVES IN ./foodLogStore.
 *
 * Everything below needs NutrientResolver (and the food catalogs behind it) to
 * turn "2 slices of bread" into numbers. Reading the log back needs none of
 * that, and ScheduleService has to read it to close a day honestly — so the
 * store is a leaf and this module is the resolver-backed half on top of it.
 * Re-exported here so every existing import of FoodLogService is unchanged.
 */
export {
  dayNutrients,
  getFoodLogForDate,
  getFoodLogRange,
  pruneFoodLog,
  type FoodLogEntry,
  type LogStore,
} from "./foodLogStore";

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
