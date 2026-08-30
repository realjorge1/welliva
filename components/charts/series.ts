/**
 * Chart series builders — PURE derivations of the app's history into
 * `ChartPoint[]`, ready for the interactive trend charts.
 *
 * Every builder reads the same single-source collections the rest of the app
 * uses (DietHistoryEntry, WorkoutLogEntry, SessionSummaryData, BodyLogEntry)
 * and returns oldest → newest points for a bounded time window. No storage, no
 * React, no side effects — so they run in Node and are unit-tested alongside
 * the fitness/health-os layers.
 */

import type { DietHistoryEntry } from "@/models/diet";
import type { SessionSummaryData } from "@/models/session";
import type { BodyLogEntry, WorkoutLogEntry } from "@/models/workout";
import type { ChartPoint } from "./types";

/* ─────────────────────────── date helpers ─────────────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseYmd(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(date: string, delta: number): string {
  const d = parseYmd(date);
  d.setDate(d.getDate() + delta);
  return toYmd(d);
}

/** Monday of the week containing `date` (weeks are Monday-first here). */
export function weekStartOf(date: string): string {
  const d = parseYmd(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Mon
  d.setDate(d.getDate() - dow);
  return toYmd(d);
}

/** "Jul 3" — the compact axis label. */
export function shortDate(ymd: string): string {
  const d = parseYmd(ymd);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Sat, Jul 3" — the fuller scrub-tooltip label. */
export function fullDate(ymd: string): string {
  const d = parseYmd(ymd);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Inclusive lower bound of a `days`-wide window ending on `today`. */
function windowStart(today: string, days: number): string {
  return addDays(today, -(Math.max(1, days) - 1));
}

/* ─────────────────────────── generic core ─────────────────────────── */

/**
 * Keep only the entries whose `date` falls inside the last `days` (inclusive,
 * ending on `today`), returned oldest → newest. Entries are de-duplicated by
 * date, last-write-wins, so re-archived days never double-plot.
 */
function withinWindow<T extends { date: string }>(
  entries: T[],
  today: string,
  days: number,
): T[] {
  const start = windowStart(today, days);
  const byDate = new Map<string, T>();
  for (const e of entries) {
    if (e.date >= start && e.date <= today) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ─────────────────────────── nutrition ─────────────────────────── */

/**
 * Daily calories actually eaten, over the last `days`. Only days that recorded
 * a consumed total are plotted (a missing day is unknown, not zero) — so the
 * trend never dips to a misleading 0 on an untracked day.
 */
export function buildCaloriesTrend(
  history: DietHistoryEntry[],
  today: string,
  days: number,
): ChartPoint[] {
  return withinWindow(history, today, days)
    .filter((e) => typeof e.consumedCalories === "number")
    .map((e) => ({
      value: Math.round(e.consumedCalories as number),
      label: shortDate(e.date),
      fullLabel: fullDate(e.date),
    }));
}

/** Daily protein eaten (g), last `days`. Skips days with no recorded protein. */
export function buildProteinTrend(
  history: DietHistoryEntry[],
  today: string,
  days: number,
): ChartPoint[] {
  return withinWindow(history, today, days)
    .filter((e) => typeof e.consumedProteinG === "number")
    .map((e) => ({
      value: Math.round(e.consumedProteinG as number),
      label: shortDate(e.date),
      fullLabel: fullDate(e.date),
    }));
}

/** Daily carbs eaten (g), last `days`. Skips days with no recorded carbs. */
export function buildCarbsTrend(
  history: DietHistoryEntry[],
  today: string,
  days: number,
): ChartPoint[] {
  return withinWindow(history, today, days)
    .filter((e) => typeof e.consumedCarbsG === "number")
    .map((e) => ({
      value: Math.round(e.consumedCarbsG as number),
      label: shortDate(e.date),
      fullLabel: fullDate(e.date),
    }));
}

/** Daily fat eaten (g), last `days`. Skips days with no recorded fat. */
export function buildFatTrend(
  history: DietHistoryEntry[],
  today: string,
  days: number,
): ChartPoint[] {
  return withinWindow(history, today, days)
    .filter((e) => typeof e.consumedFatG === "number")
    .map((e) => ({
      value: Math.round(e.consumedFatG as number),
      label: shortDate(e.date),
      fullLabel: fullDate(e.date),
    }));
}

/**
 * One aligned row of every macro for a single day. Each field is that day's
 * recorded total, or `null` when the day never logged it — so all four macros
 * share the exact same x positions (and therefore the same left-edge start) in
 * the overlaid multi-macro trend chart.
 */
export interface MacroMatrixPoint {
  date: string;
  /** "Jul 3" — compact axis label. */
  label: string;
  /** "Sat, Jul 3" — fuller scrub label. */
  fullLabel: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

function numOrNull(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/**
 * Every macro (calories / protein / carbs / fat) for each of the last `days`,
 * aligned into one row per day and returned oldest → newest. Only days that
 * recorded at least one consumed macro are kept (a fully-untracked day is a
 * gap, never a fake zero); within a kept day a missing macro stays `null`.
 *
 * This is the single source the overlaid multi-macro chart reads: because every
 * series is drawn against the same rows, they line up sample-for-sample and can
 * be indexed to a shared starting point.
 */
export function buildMacroMatrix(
  history: DietHistoryEntry[],
  today: string,
  days: number,
): MacroMatrixPoint[] {
  return withinWindow(history, today, days)
    .map((e) => ({
      date: e.date,
      label: shortDate(e.date),
      fullLabel: fullDate(e.date),
      calories: numOrNull(e.consumedCalories),
      proteinG: numOrNull(e.consumedProteinG),
      carbsG: numOrNull(e.consumedCarbsG),
      fatG: numOrNull(e.consumedFatG),
    }))
    .filter(
      (r) =>
        r.calories != null ||
        r.proteinG != null ||
        r.carbsG != null ||
        r.fatG != null,
    );
}

/**
 * Re-express a series as a percent of its own first positive sample (which
 * becomes exactly 100), so wildly different-scale metrics (kcal vs. grams) can
 * share one axis and a single starting point. `null`s pass straight through as
 * gaps; a series with no positive value indexes to all-`null` (nothing to plot).
 * Rounded to 0.1% so the shape is smooth without float noise.
 */
export function indexToStart(
  values: readonly (number | null | undefined)[],
): (number | null)[] {
  const base = values.find(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  if (base == null) return values.map(() => null);
  return values.map((v) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.round((v / base) * 1000) / 10
      : null,
  );
}

/**
 * Daily meal-plan adherence (0–100%), last `days`. Every logged day counts —
 * a skipped day is a real 0 here (the plan existed, nothing was eaten).
 */
export function buildAdherenceTrend(
  history: DietHistoryEntry[],
  today: string,
  days: number,
): ChartPoint[] {
  return withinWindow(history, today, days).map((e) => ({
    value:
      e.totalMeals > 0
        ? Math.round((e.mealsConsumed / e.totalMeals) * 100)
        : 0,
    label: shortDate(e.date),
    fullLabel: fullDate(e.date),
  }));
}

/* ─────────────────────────── training ─────────────────────────── */

/**
 * Active minutes per week over the last `weeks` (oldest → newest), including
 * empty weeks so the cadence of rest vs. work is honest. This is the training
 * "load" line — smoother than raw daily bars.
 */
export function buildWeeklyMinutes(
  log: WorkoutLogEntry[],
  today: string,
  weeks: number,
): ChartPoint[] {
  const thisWeek = weekStartOf(today);
  const out: ChartPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const minutes = log
      .filter((l) => l.date >= start && l.date < end)
      .reduce((s, l) => s + (l.durationMinutes || 0), 0);
    out.push({
      value: minutes,
      label: shortDate(start),
      fullLabel: `Week of ${fullDate(start)}`,
    });
  }
  return out;
}

/**
 * Total reps completed per session over the most recent `count` sessions
 * (oldest → newest) — a clean, per-effort "volume" line where daily buckets
 * would be too sparse.
 */
export function buildSessionVolume(
  sessions: SessionSummaryData[],
  count: number,
): ChartPoint[] {
  return [...sessions]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .slice(-Math.max(1, count))
    .map((s) => ({
      value: s.totalReps || 0,
      label: shortDate(s.date),
      fullLabel: `${s.sessionLabel} · ${fullDate(s.date)}`,
    }));
}

/* ─────────────────────────── body ─────────────────────────── */

/**
 * Body-weight trend (kg), last `days`. Only logged days appear — weigh-ins are
 * irregular, so we plot the real measurements, not interpolated fills.
 */
export function buildWeightTrend(
  logs: BodyLogEntry[],
  today: string,
  days: number,
): ChartPoint[] {
  return withinWindow(logs, today, days).map((e) => ({
    value: Math.round(e.weightKg * 10) / 10,
    label: shortDate(e.date),
    fullLabel: fullDate(e.date),
  }));
}

/* ─────────────────────────── plot domain ─────────────────────────── */

/**
 * The shared y-domain for a set of overlaid series, as `[lo, hi]`.
 *
 * IT IGNORES VISIBILITY ON PURPOSE — callers pass every series, hidden ones
 * included. The domain used to be built from the visible series only, so
 * toggling one macro off silently rescaled the plot: hide calories and the
 * carbs line jumped up to sit exactly where calories had been. A line that
 * moves because you hid a DIFFERENT line cannot be read, and two people looking
 * at the same week would see the same curve at two different heights depending
 * on which chips they had tapped.
 *
 * A legend chip is a FILTER, not a zoom. One domain over everything means a
 * hidden line comes back exactly where it left.
 *
 * Degenerate input is handled rather than propagated: no finite values at all
 * yields [0, 1], and a flat series is opened out by ±1 so the divide that maps
 * a value to a pixel can never be by zero.
 */
export function sharedDomain(
  seriesValues: readonly (readonly (number | null)[])[],
  /** Fraction of the span added above and below, so strokes clear the edges. */
  padFraction = 0.18,
): [number, number] {
  const vals: number[] = [];
  for (const values of seriesValues) {
    for (const v of values) {
      if (v != null && Number.isFinite(v)) vals.push(v);
    }
  }

  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }

  const padV = (hi - lo) * padFraction;
  return [lo - padV, hi + padV];
}
