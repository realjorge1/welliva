/**
 * NUTRITION INSIGHT ENGINE
 *
 * The premium nutrition-intelligence layer. Turns the user's targets + what
 * they've actually eaten + their recent history into the four things that make
 * an offline diet app feel like a coach rather than a logbook:
 *
 *   1. Smart Swaps      — rank a meal slot's alternatives by how well they fit
 *                         the calories/protein you have LEFT for the day.
 *   2. Protein status   — a paced read on whether protein is on track.
 *   3. Consistency      — a 0–100 score from recent meal-logging adherence.
 *   4. Weekly summary   — a backward-looking roll-up of the current week.
 *
 * Pure functions only — same inputs → same outputs. No storage, no scoring of
 * diets (DietMatchService owns that), no persistence (ScheduleService owns
 * that). It composes the existing single-source data: NutritionTargets, the
 * derived consumed totals, the meal options in DietDatabase, and the diet
 * history that ScheduleService records at day-end.
 */

import {
  DietMealOption,
  DietSnackOption,
} from "../../constants/DietDatabase";
import { DietHistoryEntry, MealType, ScheduledMeal } from "../../models/diet";
import { NutritionTargets } from "../../models/nutrition";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";

// ────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────

export interface ConsumedTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A live, in-progress day not yet written to history. */
export interface LiveDay {
  date: string;
  mealsConsumed: number;
  totalMeals: number;
}

type Range = { min: number; max: number };

function avg(r?: Range): number {
  return r ? (r.min + r.max) / 2 : 0;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Waking window used to pace expectations (07:00 → 21:00) — matches CoachInsightEngine.
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

function dayProgress(now: Date): number {
  return clamp01((now.getHours() - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR));
}

// ════════════════════════════════════════════════════════════
// 1. SMART SWAPS
// ════════════════════════════════════════════════════════════

export interface SwapTag {
  label: string;
  /** Drives the chip color via the data-viz palette. */
  tone: "protein" | "calories" | "good";
}

export interface SmartSwap {
  option: DietMealOption | DietSnackOption;
  /** Index into the source options array (for swapping). */
  index: number;
  /** 0–100 fit score for the day's remaining budget. */
  score: number;
  /** The single best-fitting, meaningfully-better-than-current option. */
  isBest: boolean;
  tags: SwapTag[];
  reason: string;
}

export interface RankSwapsInput {
  options: (DietMealOption | DietSnackOption)[];
  /** The meal currently filling this slot (for delta tags). */
  current: ScheduledMeal | null;
  targets: NutritionTargets | null;
  consumed: ConsumedTotals;
  /**
   * Unconsumed meals still ahead today, INCLUDING this slot. Used to size the
   * per-meal budget so a single swap isn't asked to close the whole day's gap.
   */
  slotsRemaining: number;
}

function optionProtein(o: DietMealOption | DietSnackOption): number {
  return "protein" in o ? avg(o.protein) : 0;
}

/**
 * Rank a slot's alternatives by fit to the calories + protein you have left.
 * The top option is flagged `isBest` only when it clearly beats what's already
 * in the slot — so "Smart pick" means something.
 */
export function rankMealSwaps(input: RankSwapsInput): SmartSwap[] {
  const { options, current, targets, consumed, slotsRemaining } = input;
  if (options.length === 0) return [];

  const slots = Math.max(1, slotsRemaining);

  // Per-meal budget = what's left, shared across the meals still to come.
  const calBudget = targets
    ? Math.max(0, targets.calories - consumed.calories) / slots
    : 0;
  const protBudget = targets
    ? Math.max(0, targets.proteinG - consumed.proteinG) / slots
    : 0;

  const curCal = avg(current?.calories);
  const curProt = avg(current?.proteinG);

  const ranked: SmartSwap[] = options.map((option, index) => {
    const optCal = avg(option.calories);
    const optProt = optionProtein(option);

    // Calorie fit: how close to the per-meal budget (when we know it).
    let calScore = 60;
    if (targets && calBudget > 0) {
      const closeness = 1 - Math.min(1, Math.abs(optCal - calBudget) / calBudget);
      calScore = closeness * 100;
    }

    // Protein fit: reward meeting (not wildly exceeding) the protein budget.
    let protScore = 50;
    if (targets && protBudget > 0) {
      protScore = Math.min(1, optProt / protBudget) * 100;
    } else if (optProt > 0) {
      protScore = Math.min(100, optProt * 4); // no target: more protein is still better
    }

    const score = Math.round(0.55 * calScore + 0.45 * protScore);

    // Delta tags vs the current meal (only when there's a current to beat).
    const tags: SwapTag[] = [];
    if (current) {
      const dProt = Math.round(optProt - curProt);
      const dCal = Math.round(optCal - curCal);
      if ("protein" in option && dProt >= 5) {
        tags.push({ label: `+${dProt}g protein`, tone: "protein" });
      }
      if (dCal <= -40) {
        tags.push({ label: `${dCal} kcal`, tone: "calories" });
      } else if (dCal >= 60 && protBudget > 0 && optProt > curProt) {
        tags.push({ label: `+${dCal} kcal`, tone: "calories" });
      }
    }

    const reason = buildSwapReason(option, optCal, optProt, calBudget, protBudget);

    return { option, index, score, isBest: false, tags, reason };
  });

  ranked.sort((a, b) => b.score - a.score);

  // Flag the leader as "best" only if it clearly improves on the current slot.
  const leader = ranked[0];
  if (leader && current) {
    const sameMeal = leader.option.name === current.name;
    const meaningfullyBetter =
      avg(leader.option.calories) !== curCal ||
      optionProtein(leader.option) > curProt + 4;
    leader.isBest = !sameMeal && meaningfullyBetter && leader.score >= 55;
  } else if (leader && !current) {
    leader.isBest = leader.score >= 60;
  }

  return ranked;
}

function buildSwapReason(
  option: DietMealOption | DietSnackOption,
  optCal: number,
  optProt: number,
  calBudget: number,
  protBudget: number,
): string {
  const isSnack = !("protein" in option);
  if (isSnack) {
    if (calBudget > 0 && optCal <= calBudget) return "Light snack that fits your budget";
    return "A simple snack option";
  }
  if (protBudget > 0 && optProt >= protBudget * 0.9) {
    return "Protein-forward — helps you hit your target";
  }
  if (calBudget > 0 && optCal <= calBudget) {
    return "Keeps you comfortably within today's calories";
  }
  if (calBudget > 0 && optCal > calBudget * 1.25) {
    return "Heavier — best earlier in the day";
  }
  return "A balanced choice for this slot";
}

/**
 * Does a clearly-better swap exist for this slot right now? Used to surface a
 * subtle "Smart swap" hint on a meal without opening the full sheet.
 */
export function hasSmartSwap(input: RankSwapsInput): SmartSwap | null {
  const ranked = rankMealSwaps(input);
  return ranked.find((s) => s.isBest) ?? null;
}

// ════════════════════════════════════════════════════════════
// 1b. ALTERNATIVE MEAL — same slot, same cuisine, matched nutrition
// ════════════════════════════════════════════════════════════

export interface MealAlternative {
  option: DietMealOption;
  /** Index into the source options array. */
  index: number;
  /** 0–1 nutrition similarity to the meal being replaced. */
  match: number;
}

export interface MealAlternativeInput {
  /** All options for this meal slot from the active diet. */
  options: (DietMealOption | DietSnackOption)[];
  /** The meal to replace — its cuisine + nutrition are the target. */
  current: ScheduledMeal;
  /** Minimum nutrition similarity to accept (default 0.9 = 90%). */
  minMatch?: number;
}

// Per-nutrient closeness: 1 when identical, → 0 as they diverge. When the
// target is negligible (e.g. ~0g fat) any small candidate value still counts as
// a match, so a near-zero macro can't sink an otherwise-perfect swap.
function nutrientCloseness(candidate: number, target: number): number {
  if (target <= 1) return clamp01(1 - Math.max(0, candidate - target) / 20);
  return clamp01(1 - Math.abs(candidate - target) / target);
}

/**
 * Find the best drop-in alternative for `current` — a DIFFERENT meal from the
 * same slot that (1) keeps the cuisine when it can and (2) delivers ~the same
 * nutrition (calories weighted highest, then the macros). Returns the closest
 * option at or above `minMatch`, preferring the same cuisine; null if nothing
 * clears the bar. Macro-less snack options are skipped (no nutrition to match).
 */
export function findMealAlternative(
  input: MealAlternativeInput,
): MealAlternative | null {
  const { options, current, minMatch = 0.9 } = input;

  const tCal = avg(current.calories);
  const tProt = avg(current.proteinG);
  const tCarb = avg(current.carbsG);
  const tFat = avg(current.fatG);

  type Scored = MealAlternative & { sameCuisine: boolean };
  const eligible: Scored[] = [];

  options.forEach((option, index) => {
    if (!("protein" in option)) return; // need full macros to match on
    const meal = option as DietMealOption;
    if (meal.name === current.name) return; // must be a different meal

    const match =
      0.4 * nutrientCloseness(avg(meal.calories), tCal) +
      0.25 * nutrientCloseness(avg(meal.protein), tProt) +
      0.2 * nutrientCloseness(avg(meal.carbs), tCarb) +
      0.15 * nutrientCloseness(avg(meal.fat), tFat);

    if (match < minMatch) return;

    const sameCuisine =
      current.cuisine != null && meal.cuisine === current.cuisine;
    eligible.push({ option: meal, index, match, sameCuisine });
  });

  if (eligible.length === 0) return null;

  // Maintain cuisine first, then the closest nutrition match.
  eligible.sort((a, b) => {
    if (a.sameCuisine !== b.sameCuisine) return a.sameCuisine ? -1 : 1;
    return b.match - a.match;
  });

  const { option, index, match } = eligible[0];
  return { option, index, match };
}

// ════════════════════════════════════════════════════════════
// 2. PROTEIN STATUS / ALERTS
// ════════════════════════════════════════════════════════════

export type ProteinState = "none" | "ahead" | "on-track" | "behind" | "low";

export interface ProteinStatus {
  state: ProteinState;
  /** consumed / target, 0–1+. */
  pct: number;
  remainingG: number;
  consumedG: number;
  targetG: number;
  tone: "positive" | "nudge" | "warning";
  title: string;
  message: string;
}

export function getProteinStatus(input: {
  consumed: ConsumedTotals;
  targets: NutritionTargets | null;
  now?: Date;
}): ProteinStatus {
  const { consumed, targets } = input;
  const now = input.now ?? new Date();

  if (!targets || targets.proteinG <= 0) {
    return {
      state: "none",
      pct: 0,
      remainingG: 0,
      consumedG: 0,
      targetG: 0,
      tone: "nudge",
      title: "Protein",
      message: "Set up your profile to track protein.",
    };
  }

  const consumedG = Math.round(consumed.proteinG);
  const targetG = Math.round(targets.proteinG);
  const pct = consumed.proteinG / targets.proteinG;
  const remainingG = Math.max(0, targetG - consumedG);
  const progress = dayProgress(now);

  if (pct >= 0.9) {
    return {
      state: "ahead",
      pct,
      remainingG,
      consumedG,
      targetG,
      tone: "positive",
      title: "Protein goal reached",
      message: `${consumedG}g of ${targetG}g — great for recovery and staying full.`,
    };
  }

  // Paced expectation: behind only relative to how much of the day has passed.
  const expected = progress;
  if (pct >= expected - 0.1) {
    return {
      state: "on-track",
      pct,
      remainingG,
      consumedG,
      targetG,
      tone: "positive",
      title: "Protein on track",
      message: `${consumedG}g so far — ${remainingG}g to go, nicely paced.`,
    };
  }
  if (pct < expected - 0.3 && progress > 0.4) {
    return {
      state: "low",
      pct,
      remainingG,
      consumedG,
      targetG,
      tone: "warning",
      title: "Protein is running low",
      message: `Only ${consumedG}g of ${targetG}g. A protein-rich meal or snack would help you catch up.`,
    };
  }
  return {
    state: "behind",
    pct,
    remainingG,
    consumedG,
    targetG,
    tone: "nudge",
    title: "Protein is lagging",
    message: `${remainingG}g left to reach ${targetG}g — keep it in mind for your next meal.`,
  };
}

// ════════════════════════════════════════════════════════════
// 3. CONSISTENCY SCORE
// ════════════════════════════════════════════════════════════

export interface DayAdherence {
  date: string;
  /** Meals consumed / total, 0–1. */
  pct: number;
  status: "completed" | "partial" | "skipped" | "none";
}

export interface ConsistencyScore {
  /** 0–100. Rewards both adherence quality and logging regularly. */
  score: number;
  label: string;
  /** Days in the window with any record (history or live). */
  daysTracked: number;
  /** Last 7 days, oldest → newest. */
  last7: DayAdherence[];
  trend: "up" | "down" | "flat";
}

function adherenceFor(
  date: string,
  history: DietHistoryEntry[],
  live?: LiveDay,
): DayAdherence {
  if (live && live.date === date && live.totalMeals > 0) {
    const pct = clamp01(live.mealsConsumed / live.totalMeals);
    return {
      date,
      pct,
      status:
        pct >= 1 ? "completed" : live.mealsConsumed > 0 ? "partial" : "skipped",
    };
  }
  const entry = history.find((h) => h.date === date);
  if (entry && entry.totalMeals > 0) {
    return {
      date,
      pct: clamp01(entry.mealsConsumed / entry.totalMeals),
      status: entry.status,
    };
  }
  return { date, pct: 0, status: "none" };
}

function consistencyLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Consistent";
  if (score >= 50) return "Building";
  if (score >= 25) return "Getting started";
  return "Just begun";
}

/**
 * Build a 0–100 consistency score from the last 7 days. Quality (how much of
 * each day's plan was eaten) is discounted by coverage (how many days were
 * logged at all), so 7 solid days → ~100 while two good days → a modest score
 * that says "keep going".
 */
export function computeConsistency(
  history: DietHistoryEntry[],
  today: string,
  live?: LiveDay,
): ConsistencyScore {
  const last7: DayAdherence[] = [];
  const end = parseLocalDate(today);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    last7.push(adherenceFor(toLocalDateString(d), history, live));
  }

  const tracked = last7.filter((d) => d.status !== "none");
  const daysTracked = tracked.length;

  if (daysTracked === 0) {
    return { score: 0, label: consistencyLabel(0), daysTracked: 0, last7, trend: "flat" };
  }

  const adherenceAvg =
    tracked.reduce((s, d) => s + d.pct, 0) / daysTracked; // 0–1
  const coverage = daysTracked / 7; // 0–1
  const score = Math.round(adherenceAvg * 100 * (0.6 + 0.4 * coverage));

  // Trend: compare the older half of the window to the newer half.
  const older = last7.slice(0, 3).reduce((s, d) => s + d.pct, 0) / 3;
  const newer = last7.slice(4).reduce((s, d) => s + d.pct, 0) / 3;
  const trend: ConsistencyScore["trend"] =
    newer > older + 0.12 ? "up" : newer < older - 0.12 ? "down" : "flat";

  return { score, label: consistencyLabel(score), daysTracked, last7, trend };
}

// ════════════════════════════════════════════════════════════
// 4. WEEKLY SUMMARY (backward-looking, from history)
// ════════════════════════════════════════════════════════════

export interface WeeklyNutritionSummary {
  weekStart: string; // Monday, YYYY-MM-DD
  /** Mon → Sun, length 7. */
  perDay: DayAdherence[];
  daysLogged: number;
  daysCompleted: number;
  /** Average adherence across logged days, 0–1. */
  avgAdherence: number;
  /** Averages over days that recorded macros (null until any are recorded). */
  avgCalories: number | null;
  avgProteinG: number | null;
  bestDay: DayAdherence | null;
}

/**
 * Roll up the current week (Mon–Sun) from recorded history plus the live day.
 * Macro averages use the consumed totals ScheduleService now records at
 * day-end; days predating that simply don't contribute to the macro average.
 */
export function computeWeeklySummary(
  history: DietHistoryEntry[],
  weekStart: string,
  today: string,
  live?: LiveDay,
): WeeklyNutritionSummary {
  const monday = parseLocalDate(weekStart);
  const perDay: DayAdherence[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    perDay.push(adherenceFor(toLocalDateString(d), history, live));
  }

  const logged = perDay.filter((d) => d.status !== "none");
  const daysLogged = logged.length;
  const daysCompleted = perDay.filter((d) => d.status === "completed").length;
  const avgAdherence =
    daysLogged > 0 ? logged.reduce((s, d) => s + d.pct, 0) / daysLogged : 0;

  // Macro averages from recorded history within the week.
  const weekDates = new Set(perDay.map((d) => d.date));
  const withMacros = history.filter(
    (h) => weekDates.has(h.date) && typeof h.consumedCalories === "number",
  );
  const avgCalories =
    withMacros.length > 0
      ? Math.round(
          withMacros.reduce((s, h) => s + (h.consumedCalories ?? 0), 0) /
            withMacros.length,
        )
      : null;
  const avgProteinG =
    withMacros.length > 0
      ? Math.round(
          withMacros.reduce((s, h) => s + (h.consumedProteinG ?? 0), 0) /
            withMacros.length,
        )
      : null;

  const bestDay =
    logged.length > 0
      ? logged.reduce((best, d) => (d.pct > best.pct ? d : best))
      : null;

  return {
    weekStart,
    perDay,
    daysLogged,
    daysCompleted,
    avgAdherence,
    avgCalories,
    avgProteinG,
    bestDay,
  };
}

// ════════════════════════════════════════════════════════════
// 5. MEAL-TIME LEARNING (cross-day, from history's recorded mealTimes)
// ════════════════════════════════════════════════════════════

/** Learned typical eating time per slot, in minutes from midnight. */
export type LearnedMealTimes = Partial<Record<MealType, number>>;

/**
 * Learn the user's typical clock time for each meal slot by averaging the
 * `mealTimes` ScheduleService records at day-end, over a recent lookback window.
 *
 * A slot only appears in the result once it has at least `minSamples` days of
 * data, so a single outlier day can't skew the suggestion. Days predating
 * mealTimes (no field) simply don't contribute. Returns minutes from midnight.
 */
export function learnMealTimes(
  history: DietHistoryEntry[],
  today: string,
  lookbackDays = 28,
  minSamples = 2,
): LearnedMealTimes {
  const end = parseLocalDate(today);
  const cutoff = new Date(end);
  cutoff.setDate(end.getDate() - lookbackDays);

  const buckets: Record<MealType, number[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const entry of history) {
    if (!entry.mealTimes) continue;
    const d = parseLocalDate(entry.date);
    if (d < cutoff || d > end) continue;
    (Object.keys(entry.mealTimes) as MealType[]).forEach((slot) => {
      const t = entry.mealTimes![slot];
      if (typeof t === "number") buckets[slot].push(t);
    });
  }

  const result: LearnedMealTimes = {};
  (Object.keys(buckets) as MealType[]).forEach((slot) => {
    const arr = buckets[slot];
    if (arr.length >= minSamples) {
      result[slot] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
  });
  return result;
}
