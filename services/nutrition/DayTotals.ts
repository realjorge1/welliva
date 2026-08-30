/**
 * DAY TOTALS — the one place that answers "what did this person eat today?".
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * A day's intake lives in TWO stores, on purpose:
 *
 *   · SCHEDULED_DIETS — the plan, and which of its meals were ticked off.
 *   · FOOD_LOG        — free-form foods the user logged themselves (the Foods
 *                       catalog, Gozlin, the log-food sheet).
 *
 * Splitting them is right: "did you follow the plan?" and "what did you eat?"
 * are different questions, and answering the first from the second would score
 * a banana as evidence you ate the planned lunch. What was NOT right is that
 * nothing ever added them back together. Home's calorie ring and the Diet
 * screen's totals both read the schedule alone, so every gram logged through
 * the food log — the app's primary free-form logging surface — was recorded,
 * persisted, listed back on the Foods screen, and counted as ZERO everywhere a
 * user looks for their day. The data was never lost; it was never summed.
 *
 * So: adherence still comes from the schedule alone (see ScheduleService's
 * mealsConsumed/totalMeals), and INTAKE comes from here — both halves, always.
 *
 * ── WHERE THE PLAN HALF NOW COMES FROM
 * From the INTAKE LEDGER, not from re-reading the plan. `scheduleMacros` is
 * kept for the one question that is genuinely about the plan — "what do the
 * meals currently on it add up to?" — but the day's TOTAL is counted off the
 * ledger's records. See services/nutrition/IntakeLedger for why a total
 * derived from a document six other code paths rewrite can only ever be lucky.
 *
 * ── WHY THE COERCION BELOW IS NOT PARANOIA ──────────────────────────────────
 * `ScheduledMeal.calories` is a `{min,max}` range, and these rows are JSON that
 * has survived app versions, an AI backend that types its own response, and a
 * cloud round-trip. One row with a plain number where a range belongs used to
 * turn the whole day into `NaN`, which renders as a blank or a zero — a total
 * that silently disagrees with the meals ticked right above it. A malformed row
 * must cost only its own contribution, never the day's.
 *
 * Pure: no storage, no React, no clock. Callers pass what they already hold.
 */

import type { ScheduledMeal } from "../../models/diet";
import type { NutrientPanel } from "../../models/nutrients";
import type { IntakeRecord } from "./IntakeLedger";

/** The four headline macros, in the units the whole app states them in. */
export interface MacroTotals {
  /** kcal */
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const ZERO_MACROS: MacroTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

/** A finite number, or 0. Guards against NaN/Infinity/null from stored JSON. */
function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The midpoint of a `{min,max}` macro range.
 *
 * Tolerates the three shapes a stored row can actually have: the range, a bare
 * number (older rows and hand-built meals), and missing entirely. Each falls
 * back to the next rather than to NaN.
 */
function rangeMid(value: unknown): number {
  if (typeof value === "number") return num(value);
  if (value && typeof value === "object") {
    const r = value as { min?: unknown; max?: unknown };
    const hasMin = typeof r.min === "number";
    const hasMax = typeof r.max === "number";
    if (hasMin && hasMax) return (num(r.min) + num(r.max)) / 2;
    if (hasMin) return num(r.min);
    if (hasMax) return num(r.max);
  }
  return 0;
}

function add(into: MacroTotals, from: MacroTotals): MacroTotals {
  return {
    calories: into.calories + from.calories,
    proteinG: into.proteinG + from.proteinG,
    carbsG: into.carbsG + from.carbsG,
    fatG: into.fatG + from.fatG,
  };
}

function round(m: MacroTotals): MacroTotals {
  return {
    calories: Math.round(m.calories),
    proteinG: Math.round(m.proteinG),
    carbsG: Math.round(m.carbsG),
    fatG: Math.round(m.fatG),
  };
}

/**
 * A meal's macros, whatever shape its row is in.
 *
 * THE ONE PLACE that reads a `{min,max}` off a stored meal. IntakeLedger calls it
 * to snapshot a tick, so the numbers recorded are by construction the same ones
 * a display path would compute — two copies of this arithmetic drifting apart
 * is precisely the class of failure this module exists to end.
 */
export function macrosOfMeal(meal: ScheduledMeal | null | undefined): MacroTotals {
  if (!meal) return ZERO_MACROS;
  return {
    calories: rangeMid(meal.calories),
    proteinG: rangeMid(meal.proteinG),
    carbsG: rangeMid(meal.carbsG),
    fatG: rangeMid(meal.fatG),
  };
}

/** What the ledger says was eaten. Unrounded. */
export function intakeMacrosRaw(
  records: readonly IntakeRecord[] | null | undefined,
): MacroTotals {
  if (!Array.isArray(records)) return ZERO_MACROS;
  let total = ZERO_MACROS;
  for (const r of records) {
    total = add(total, {
      calories: num(r?.calories),
      proteinG: num(r?.proteinG),
      carbsG: num(r?.carbsG),
      fatG: num(r?.fatG),
    });
  }
  return total;
}

/** What one free-form log entry's nutrient panel contributes. */
function panelMacros(panel: NutrientPanel | null | undefined): MacroTotals {
  if (!panel) return ZERO_MACROS;
  return {
    calories: num(panel.calories),
    proteinG: num(panel.protein),
    carbsG: num(panel.carbs),
    fatG: num(panel.fat),
  };
}

/** Everything the user logged free-form on a day. Unrounded. */
export function foodLogMacrosRaw(
  entries: readonly { totals?: NutrientPanel }[] | null | undefined,
): MacroTotals {
  if (!Array.isArray(entries)) return ZERO_MACROS;
  let total = ZERO_MACROS;
  for (const entry of entries) total = add(total, panelMacros(entry?.totals));
  return total;
}

/** Everything the user logged free-form on a day, rounded for display. */
export function foodLogMacros(
  entries: readonly { totals?: NutrientPanel }[] | null | undefined,
): MacroTotals {
  return round(foodLogMacrosRaw(entries));
}

/**
 * A DAY'S REAL INTAKE: the plan's ticked meals plus everything logged
 * free-form. Rounded once, at the end, so the displayed total always equals the
 * sum of its parts rather than the sum of two separately-rounded halves.
 *
 * This is the number Home's ring, the Diet screen and the day's history row all
 * state. If a new surface needs "calories today", it calls this — that is the
 * whole point of the module existing.
 */
export function dayMacros(
  intake: readonly IntakeRecord[] | null | undefined,
  foodLog: readonly { totals?: NutrientPanel }[] | null | undefined,
): MacroTotals {
  return sumMacros(intakeMacrosRaw(intake), foodLogMacrosRaw(foodLog));
}

/**
 * Add unrounded parts and round ONCE.
 *
 * For callers that already hold the halves separately — the provider keeps the
 * free-form side in state and re-derives the plan side on every schedule change,
 * and rounding each before adding them makes the card's total disagree with the
 * numbers printed under it by a kilocalorie or two. Which is exactly the sort of
 * small, permanent, unexplainable wrongness that makes a tracker untrustworthy.
 */
export function sumMacros(...parts: MacroTotals[]): MacroTotals {
  return round(parts.reduce(add, ZERO_MACROS));
}
