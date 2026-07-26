/**
 * MEAL PLAN MODELS
 *
 * Introduces the PERIOD as a first-class entity. Before this, the app only knew
 * about "today" (a ScheduledDiet per date) plus a weekly generator that was
 * really just seven independent days — nothing recorded that the user had
 * COMMITTED to a diet for a stretch of time, so nothing could tell them how the
 * stretch went when it ended.
 *
 * A period answers: which plan, from when to when, in which mode, and what was
 * true about the user's body when it started (so the closing report can measure
 * change against it).
 *
 * Two modes:
 *   "diet"   — a chosen diet fills every day automatically for the whole period.
 *   "custom" — the user hand-picks meals per day/slot; unfilled slots stay empty
 *              rather than being auto-generated. ("Monday breakfast: moi-moi.")
 */

import type { MealType, ScheduledMeal } from "./diet";
import type { NutrientPanel } from "./nutrients";

// ============================================================================
// PERIOD
// ============================================================================

/** How the user chose the length. "custom" carries an explicit end date. */
export type PlanDuration = "day" | "week" | "custom";

export type PlanMode = "diet" | "custom";

export type PeriodStatus =
  /** Running now (today falls inside the window). */
  | "active"
  /** Starts in the future. */
  | "scheduled"
  /** Ran to its end date. */
  | "completed"
  /** Stopped early by the user. */
  | "ended-early";

/**
 * Body/nutrition state captured at the period's start, so the closing report can
 * report real change instead of just adherence. Every field optional — we record
 * what we have and the report omits what we don't.
 */
export interface PeriodBaseline {
  capturedAt: string;
  weightKg?: number;
  bodyFatPct?: number;
  /** Daily targets in force when the period began. */
  targetCalories?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
}

export interface MealPlanPeriod {
  id: string;
  mode: PlanMode;
  /** Null in custom mode — a hand-picked menu follows no diet. */
  dietId: string | null;
  dietName: string | null;
  /** User-facing name. Defaults to the diet name, or "My menu" for custom. */
  label: string;
  durationKind: PlanDuration;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  /** YYYY-MM-DD, inclusive. Equals startDate for a single-day period. */
  endDate: string;
  status: PeriodStatus;
  baseline: PeriodBaseline;
  createdAt: string;
  /** Set when the period stops running, whichever way it ended. */
  closedAt?: string;
  /** Set once the closing report has been generated and shown. */
  reportSeenAt?: string;
  /** Id of the period this one restarted from, if the user chose "run it again". */
  restartedFromId?: string;
}

/** Inclusive day count of a period. */
export function periodLengthDays(period: {
  startDate: string;
  endDate: string;
}): number {
  return daysBetween(period.startDate, period.endDate) + 1;
}

/** How many days of a period have elapsed as of `today` (1-based, clamped). */
export function periodDayIndex(
  period: { startDate: string; endDate: string },
  today: string,
): number {
  const total = periodLengthDays(period);
  const idx = daysBetween(period.startDate, today) + 1;
  return Math.max(1, Math.min(total, idx));
}

/** True when `date` falls inside the period window (inclusive). */
export function isDateInPeriod(
  period: { startDate: string; endDate: string },
  date: string,
): boolean {
  return date >= period.startDate && date <= period.endDate;
}

// ============================================================================
// CUSTOM MENU
// ============================================================================

/**
 * One hand-picked meal on the calendar. Sparse: the user fills only the slots
 * they care about. A day with no entries genuinely has no plan — custom mode
 * never invents meals, because inventing them is exactly what the user opted
 * out of by going custom.
 */
export interface CustomMenuEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  slot: MealType;
  /** Index within the day's snacks; slot-unique for the three main meals. */
  snackIndex?: number;
  meal: ScheduledMeal;
  /** Full panel when the meal was resolved through the nutrient engine. */
  nutrients?: NutrientPanel;
  createdAt: string;
}

/**
 * The user's hand-picked menu, keyed by date. Stored separately from generated
 * schedules so that regenerating a diet can never destroy a manual pick.
 */
export interface CustomMenu {
  periodId: string;
  /** date (YYYY-MM-DD) → entries for that date. */
  entriesByDate: Record<string, CustomMenuEntry[]>;
  updatedAt: string;
}

/**
 * A meal the user saved to reuse. Custom planning is only tolerable if picking
 * "mac and cheese" the second time takes one tap, so every custom meal the user
 * defines lands here.
 */
export interface SavedMeal {
  id: string;
  name: string;
  defaultSlot: MealType;
  meal: Omit<ScheduledMeal, "id" | "isConsumed" | "consumedAt">;
  nutrients?: NutrientPanel;
  /** Bumped on each use so the picker can surface favourites first. */
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

// ============================================================================
// CLOSING REPORT
// ============================================================================

/** Per-slot adherence — surfaces WHICH meal a user habitually skips. */
export interface SlotAdherence {
  slot: MealType;
  planned: number;
  consumed: number;
  rate: number; // 0–1
}

export interface DayOutcome {
  date: string;
  planned: number;
  consumed: number;
  /** No plan existed that day (custom mode gap, or joined mid-period). */
  empty: boolean;
  calories?: number;
}

/**
 * The end-of-period report. Every figure is DERIVED from stored history — this
 * struct is computed, never written by hand and never generated by a model, so
 * two runs over the same history always produce the same report.
 */
export interface PeriodReport {
  periodId: string;
  label: string;
  mode: PlanMode;
  dietId: string | null;
  dietName: string | null;
  startDate: string;
  endDate: string;
  /** Days that actually had a plan (excludes empty custom days). */
  daysWithPlan: number;
  totalDays: number;

  // --- Adherence ---
  mealsPlanned: number;
  mealsConsumed: number;
  mealsSkipped: number;
  adherenceRate: number; // 0–1
  perSlot: SlotAdherence[];
  /** Meals skipped most often, worst first. The actionable part. */
  mostSkipped: { name: string; times: number }[];
  /** Meals eaten most often — what actually works for this user. */
  mostEaten: { name: string; times: number }[];
  bestStreakDays: number;
  perfectDays: number;
  missedDays: number;

  // --- Nutrition ---
  /** Averaged over days that had a plan AND recorded macros. */
  avgConsumed: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  };
  targets: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  };
  /** Signed difference (consumed − target) for each macro, null when unknown. */
  vsTarget: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  };
  /** Full-panel totals across the period, where the data supports it. */
  micronutrients?: NutrientPanel;
  /** Nutrients whose period total is incomplete — labelled "at least". */
  micronutrientPartialKeys?: string[];

  // --- Body change ---
  weight: {
    startKg: number | null;
    endKg: number | null;
    deltaKg: number | null;
    /** Rate per week, so a 3-day and a 3-month period are comparable. */
    perWeekKg: number | null;
  };

  // --- Presentation ---
  days: DayOutcome[];
  /** Deterministic verdict band, drives the report's colour and headline. */
  verdict: "excellent" | "good" | "mixed" | "struggled" | "insufficient-data";
  headline: string;
  /** Plain-language observations, all computed from the numbers above. */
  highlights: string[];
  generatedAt: string;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================
// All dates in this module are LOCAL YYYY-MM-DD strings. They must never be fed
// to `new Date(str)`, which parses bare date strings as UTC and lands on the
// wrong day west of Greenwich. Parse with parseLocalDate below.

/** Parse a local YYYY-MM-DD into a Date at local midnight. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date as a local YYYY-MM-DD. */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from `a` to `b` (b − a). Negative when b precedes a. */
export function daysBetween(a: string, b: string): number {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Shift a local date string by N days. */
export function addDays(date: string, n: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

/** Every date from `start` to `end` inclusive. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const total = daysBetween(start, end);
  for (let i = 0; i <= total; i++) out.push(addDays(start, i));
  return out;
}

/**
 * Resolve a duration choice to an end date.
 * day → same day · week → 7 days total · custom → the date the user picked.
 */
export function resolveEndDate(
  start: string,
  duration: PlanDuration,
  customEnd?: string,
): string {
  if (duration === "day") return start;
  if (duration === "week") return addDays(start, 6);
  return customEnd && customEnd >= start ? customEnd : start;
}

/** "3 months, 2 weeks" style label for a period length. */
export function formatDuration(days: number): string {
  if (days <= 0) return "—";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    const rem = days % 7;
    const w = `${weeks} week${weeks > 1 ? "s" : ""}`;
    return rem ? `${w}, ${rem} day${rem > 1 ? "s" : ""}` : w;
  }
  const months = Math.floor(days / 30);
  const rem = days % 30;
  const m = `${months} month${months > 1 ? "s" : ""}`;
  if (rem === 0) return m;
  const weeks = Math.round(rem / 7);
  return weeks > 0 ? `${m}, ${weeks} week${weeks > 1 ? "s" : ""}` : `${m}, ${rem} days`;
}
