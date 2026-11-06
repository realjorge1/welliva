/**
 * NUTRITION TREND — the numbers and the geometry behind the Diet screen's
 * "Nutrition trends" card.
 *
 * WHAT IT SHOWS: calories, protein, carbs and fat on each FINISHED day, each as a
 * percent of your daily target — so all four share one honest scale and one line
 * means one thing: 100% is the target, a line above it went over, below it fell
 * short. The card it replaced indexed every macro to its own first day (= 100),
 * which made four lines that could not be read without a footnote, and the owner
 * asked what it even did (2026-10-31).
 *
 * WHICH DAYS: only days that are over, and only those with food logged. Today is
 * still being eaten, and a half-day set beside finished ones would read as a
 * collapse every afternoon. A closed day with nothing logged is stored as zeros,
 * which means "not recorded", not "ate nothing" — so it is left out, the same
 * rule the week table and every other chart keep (`buildMacroMatrix`).
 *
 * WHICH TARGET: today's. The history does not store the target each day had, so
 * every day is measured against the targets you have now, and the card says so.
 * The one exception is a day the hungrier-week plan moved: that record IS kept
 * (services/nutrition/dayTargets), so its calories are read against its own target.
 *
 * Pure: everything comes in as an argument; no React, no storage.
 */

import { buildMacroMatrix } from "@/components/charts/series";
import type { SparkTrace } from "@/components/home/sparkline";
import type { DietHistoryEntry } from "@/models/diet";

export type TrendKey = "calories" | "protein" | "carbs" | "fat";
export const TREND_KEYS: readonly TrendKey[] = ["calories", "protein", "carbs", "fat"];

export interface TrendTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface TrendDay {
  date: string;
  /** "Oct 17". */
  label: string;
  /** "Fri, Oct 17". */
  fullLabel: string;
  /** What was eaten — kcal or grams. Null where the day holds no reading. */
  amount: Record<TrendKey, number | null>;
  /** The amount as a whole percent of its target. Null with no reading or no target. */
  pct: Record<TrendKey, number | null>;
}

export interface NutritionTrend {
  /** Finished days with food logged, oldest first. */
  days: TrendDay[];
  /** The top of the scale, in percent: at least 125, in steps of 25. */
  top: number;
}

/** The scale never tops out below this, so 100% always sits well under the top. */
export const TREND_MIN_TOP = 125;
export const TREND_TOP_STEP = 25;

const pctOf = (v: number | null, target: number): number | null =>
  v != null && Number.isFinite(v) && target > 0 ? Math.round((v / target) * 100) : null;

export function buildNutritionTrend(
  history: DietHistoryEntry[],
  today: string,
  days: number,
  targets: TrendTargets | null,
  /** kcal that date's own target moved by, if any (services/nutrition/dayTargets). */
  calorieDeltaOn: (date: string) => number = () => 0,
): NutritionTrend {
  const rows = buildMacroMatrix(history, today, days).filter((r) => r.date !== today);
  let max = 0;
  const out: TrendDay[] = rows.map((r) => {
    const amount: Record<TrendKey, number | null> = {
      calories: r.calories,
      protein: r.proteinG,
      carbs: r.carbsG,
      fat: r.fatG,
    };
    const pct: Record<TrendKey, number | null> = targets
      ? {
          calories: pctOf(r.calories, targets.calories + calorieDeltaOn(r.date)),
          protein: pctOf(r.proteinG, targets.proteinG),
          carbs: pctOf(r.carbsG, targets.carbsG),
          fat: pctOf(r.fatG, targets.fatG),
        }
      : { calories: null, protein: null, carbs: null, fat: null };
    for (const k of TREND_KEYS) {
      const p = pct[k];
      if (p != null && p > max) max = p;
    }
    return { date: r.date, label: r.label, fullLabel: r.fullLabel, amount, pct };
  });
  const top = Math.max(TREND_MIN_TOP, Math.ceil(max / TREND_TOP_STEP) * TREND_TOP_STEP);
  return { days: out, top };
}

/**
 * The range a card should open on: the first one the viewer can see that has a
 * line to draw (two days or more), else simply the first one they can see. A
 * card that opens onto an empty week while last month is full reads as broken.
 */
export function pickTrendRange(
  ranges: readonly { key: string; locked: boolean; days: number }[],
): string | null {
  const open = ranges.filter((r) => !r.locked);
  return (open.find((r) => r.days >= 2) ?? open[0] ?? ranges[0])?.key ?? null;
}

/* ── Geometry ─────────────────────────────────────────────────────────────── */

export interface TrendPoint {
  x: number;
  y: number;
}

export interface TrendLine {
  /** Path data; empty when the macro has no reading in the range. */
  d: string;
  /** One per day, null where that day holds no reading for this macro. */
  points: (TrendPoint | null)[];
  /** The last reading — where the end dot sits. */
  end: TrendPoint | null;
  /** The same curve sampled, for the draw-on (see `pointAtLength`). */
  trace: SparkTrace;
}

export interface TrendGeometry {
  /** Each day's x, oldest first, evenly spaced. */
  xs: number[];
  /** Where 100% sits. */
  targetY: number;
  lines: Record<TrendKey, TrendLine>;
}

export interface TrendPad {
  x: number;
  top: number;
  bottom: number;
}

const SAMPLES_PER_SEGMENT = 8;
const n2 = (v: number) => Math.round(v * 100) / 100;

/**
 * A smooth line through points whose x only ever grows — monotone cubic
 * (Fritsch–Carlson), so between two days it never swings above the higher one
 * or below the lower one: the curve shows no intake that was not logged. Unlike
 * the sparkline's, the spacing may vary, because a macro with a missing day
 * simply joins the days either side of it.
 */
export function monotoneCurve(points: readonly TrendPoint[]): { d: string; trace: SparkTrace } {
  const n = points.length;
  if (n === 0) return { d: "", trace: { xs: [], ys: [], cum: [], length: 0 } };
  const first = points[0];
  if (n === 1) {
    return {
      d: `M${n2(first.x)} ${n2(first.y)}`,
      trace: { xs: [first.x], ys: [first.y], cum: [0], length: 0 },
    };
  }

  const h: number[] = [];
  const delta: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const dx = Math.max(1e-6, points[k + 1].x - points[k].x);
    h.push(dx);
    delta.push((points[k + 1].y - points[k].y) / dx);
  }

  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let k = 1; k < n - 1; k++) {
    m[k] = delta[k - 1] * delta[k] <= 0 ? 0 : (delta[k - 1] + delta[k]) / 2;
  }
  for (let k = 0; k < n - 1; k++) {
    if (delta[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / delta[k];
    const b = m[k + 1] / delta[k];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[k] = tau * a * delta[k];
      m[k + 1] = tau * b * delta[k];
    }
  }

  let d = `M${n2(first.x)} ${n2(first.y)}`;
  const xs = [first.x];
  const ys = [first.y];
  const cum = [0];
  let length = 0;
  for (let k = 0; k < n - 1; k++) {
    const p0 = points[k];
    const p1 = points[k + 1];
    const c1x = p0.x + h[k] / 3;
    const c1y = p0.y + (m[k] * h[k]) / 3;
    const c2x = p1.x - h[k] / 3;
    const c2y = p1.y - (m[k + 1] * h[k]) / 3;
    d += `C${n2(c1x)} ${n2(c1y)} ${n2(c2x)} ${n2(c2y)} ${n2(p1.x)} ${n2(p1.y)}`;
    for (let j = 1; j <= SAMPLES_PER_SEGMENT; j++) {
      const t = j / SAMPLES_PER_SEGMENT;
      const u = 1 - t;
      const x = u * u * u * p0.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p1.x;
      const y = u * u * u * p0.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p1.y;
      length += Math.hypot(x - xs[xs.length - 1], y - ys[ys.length - 1]);
      xs.push(x);
      ys.push(y);
      cum.push(length);
    }
  }
  return { d, trace: { xs, ys, cum, length } };
}

export function trendGeometry(
  trend: NutritionTrend,
  width: number,
  height: number,
  pad: TrendPad,
): TrendGeometry {
  const count = trend.days.length;
  const innerW = Math.max(0, width - pad.x * 2);
  const innerH = Math.max(0, height - pad.top - pad.bottom);
  const bottom = height - pad.bottom;
  const yOf = (p: number) => bottom - (Math.min(Math.max(0, p), trend.top) / trend.top) * innerH;

  const xs = trend.days.map((_, i) =>
    count <= 1 ? width / 2 : pad.x + (i / (count - 1)) * innerW,
  );

  const lines = {} as Record<TrendKey, TrendLine>;
  for (const k of TREND_KEYS) {
    const points = trend.days.map((day, i) => {
      const p = day.pct[k];
      return p == null ? null : { x: xs[i], y: yOf(p) };
    });
    const present = points.filter((p): p is TrendPoint => p != null);
    const { d, trace } = monotoneCurve(present);
    lines[k] = { d, points, end: present.length ? present[present.length - 1] : null, trace };
  }

  return { xs, targetY: yOf(100), lines };
}
