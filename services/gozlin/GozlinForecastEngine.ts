/**
 * GOZLIN — AI Transformation Forecast System (Phase 3).
 *
 * Turns the user's *actual* behavior + body data into an honest, explainable
 * projection of their future self. Deterministic arithmetic over local history —
 * fully offline. See docs/gozlin/03-transformation-forecast.md.
 *
 * Five outputs, every one explainable by construction:
 *   1. Current Projection      — where the trajectory points right now
 *   2. Progress Velocity       — rate of change + its shape (accel/slow/reverse)
 *   3. Expected Goal Date      — when the goal weight is reached at this pace
 *   4. Likelihood of Success   — a 0–100 composite across all inputs
 *   5. Recommended Adjustments — the highest-leverage changes, ranked
 *
 * Core principle — ACTUALS BEAT THE MATH: when real weigh-ins exist, the
 * measured weight trend leads; the energy-balance prediction is the cross-check.
 * With no weigh-ins we fall back to the prediction and say so (`basis`).
 */

import type { DietHistoryEntry } from "../../models/diet";
import { GOAL_CALORIE_MODIFIERS } from "../../models/nutrition";
import type { PrimaryGoal } from "../../models/user";
import type { BodyLogEntry } from "../../models/workout";
import { computeWeightTrend } from "../BodyLogService";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import type {
  ForecastBasis,
  ForecastConfidence,
  GozlinAdjustment,
  GozlinForecast,
  GozlinTwin,
  GozlinVelocity,
  SuccessBand,
  VelocityTrend,
} from "./gozlin.types";

export interface ForecastInput {
  twin: GozlinTwin;
  dietHistory: DietHistoryEntry[];
  bodyLogs: BodyLogEntry[];
  /** Daily calorie target (= maintenance + goal modifier). */
  calorieTarget: number;
  goal: PrimaryGoal | null;
  /** Sessions/week the user is aiming for (training-adherence subscore). */
  weeklyWorkoutTarget: number;
  now?: Date;
}

const KCAL_PER_KG = 7700;
const WINDOW_DAYS = 28;
const MIN_DAYS = 5;
const MAX_ETA_WEEKS = 156; // beyond ~3 years we don't pretend to see a date

// ── small numeric helpers ──────────────────────────────────────────
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const sign = (n: number) => (n > 0.05 ? 1 : n < -0.05 ? -1 : 0);

function coeffVar(xs: number[]): number {
  const m = mean(xs);
  if (m === 0) return 1;
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m;
}

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
}

function fmtRate(perWeek: number): string {
  const a = Math.abs(perWeek);
  const num = a.toFixed(2).replace(/\.?0+$/, "");
  return `${num} kg/week ${perWeek < 0 ? "down" : "up"}`;
}

// ════════════════════════════════════════════════════════════════════

export function buildForecast(input: ForecastInput): GozlinForecast {
  const { twin, goal, weeklyWorkoutTarget } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const end = parseLocalDate(today);
  const body = twin.body;

  // ── 1) Energy-balance prediction (intake vs maintenance) ──
  const inWindow = new Set<string>();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    inWindow.add(toLocalDateString(d));
  }
  const cals = input.dietHistory
    .filter((h) => inWindow.has(h.date) && typeof h.consumedCalories === "number")
    .map((h) => h.consumedCalories as number);

  const trackedDays = cals.length;
  const avgConsumed = trackedDays ? Math.round(mean(cals)) : 0;
  const modifier = goal ? GOAL_CALORIE_MODIFIERS[goal] ?? 0 : 0;
  const maintenance = Math.round(input.calorieTarget - modifier);
  const dailyBalance = avgConsumed - maintenance;
  const ebRate = trackedDays >= MIN_DAYS ? round1((dailyBalance * 7) / KCAL_PER_KG) : null;
  const calCv = coeffVar(cals);

  // ── 2) Measured weight trend (the ground truth) ──
  const trend = computeWeightTrend(input.bodyLogs, today, WINDOW_DAYS);
  const reliableMeasured =
    trend.perWeek !== null && trend.points >= 2 && trend.spanDays >= 7;
  const recentTrend = computeWeightTrend(input.bodyLogs, today, 14);

  // ── 3) Pick the basis + the velocity number ──
  let basis: ForecastBasis;
  let ratePerWeek: number | null;
  if (reliableMeasured) {
    ratePerWeek = trend.perWeek;
    const agrees = ebRate !== null && sign(ebRate) === sign(trend.perWeek!);
    basis = ebRate !== null && agrees ? "blended" : "measured";
  } else if (ebRate !== null) {
    ratePerWeek = ebRate;
    basis = "energy_balance";
  } else {
    ratePerWeek = null;
    basis = "insufficient";
  }

  const adherence = twin.momentum.adherence7d;
  const adherenceLimited = adherence < 40 || trackedDays < 10;

  // ── 4) Goal direction (prefer the goal-weight vector; else the goal intent) ──
  const goalDir = goalDirection(body.goalWeightKg, body.currentWeightKg, goal);

  // ── 5) Progress Velocity (rate + shape) ──
  const velocity = classifyVelocity(ratePerWeek, recentTrend.perWeek, goalDir);

  // ── 6) Expected Goal Date ──
  const { etaWeeks, expectedGoalDate } = projectGoalDate(
    body.currentWeightKg,
    body.goalWeightKg,
    ratePerWeek,
    today,
  );

  // ── 7) Likelihood of Success (multi-input composite) ──
  const sub = successSubscores({
    adherence,
    trainingLoad7d: twin.momentum.trainingLoad7d,
    weeklyWorkoutTarget,
    streak: twin.momentum.streak,
    momentumTrend: twin.momentum.trend,
    ratePerWeek,
    goalDir,
    hasGoalWeight: body.goalWeightKg != null,
    trackedDays,
    weighIns: trend.points,
  });
  const successScore = Math.round(
    100 *
      (sub.nutrition * 0.28 +
        sub.training * 0.15 +
        sub.momentum * 0.15 +
        sub.direction * 0.27 +
        sub.coverage * 0.15),
  );
  const successBand: SuccessBand =
    basis === "insufficient"
      ? "unknown"
      : successScore >= 72
        ? "on_track"
        : successScore >= 52
          ? "achievable"
          : successScore >= 32
            ? "at_risk"
            : "off_track";

  // ── 8) Confidence ──
  const confidence = computeConfidence(basis, trend, trackedDays, calCv);

  // ── 9) Recommended Adjustments (ranked by leverage) ──
  const adjustments = buildAdjustments({
    sub,
    goal,
    goalDir,
    velocity,
    flags: twin.flags,
    weeklyWorkoutTarget,
    trainingLoad7d: twin.momentum.trainingLoad7d,
    weighIns: trend.points,
    hasGoalWeight: body.goalWeightKg != null,
  });

  // ── 10) Evidence drivers ──
  const drivers = buildDrivers({
    adherence,
    basis,
    ratePerWeek,
    trend,
    avgConsumed,
    maintenance,
    trackedDays,
    trainingLoad7d: twin.momentum.trainingLoad7d,
    weeklyWorkoutTarget,
  });

  // ── 11) Current Projection summary ──
  const summary = buildSummary({
    basis,
    ratePerWeek,
    trend,
    goal,
    body,
    etaWeeks,
    expectedGoalDate,
    adherenceLimited,
  });

  return {
    __kind: "forecast",
    summary,
    velocity,
    projectedRatePerWeek: ratePerWeek,
    unitLabel: "kg/week",
    currentWeightKg: body.currentWeightKg,
    startWeightKg: body.startWeightKg,
    goalWeightKg: body.goalWeightKg,
    goalProgress: body.goalProgress,
    etaWeeks,
    expectedGoalDate,
    successScore,
    successBand,
    confidence,
    basis,
    drivers,
    oneLever: adjustments[0]?.text ?? "Keep logging — consistency is the lever now.",
    adjustments,
    adherenceLimited,
  };
}

// ════════════════════════════════════════════════════════════════════
// Sub-routines
// ════════════════════════════════════════════════════════════════════

const GOAL_INTENT_DIR: Record<PrimaryGoal, number> = {
  lose_weight: -1,
  build_muscle: +1,
  increase_energy: +1,
  athletic_performance: +1,
  improve_fitness: 0,
  better_health: 0,
};

/** Which way we WANT weight to move: from the goal weight if set, else the goal. */
function goalDirection(
  goalWeight: number | null,
  current: number | null,
  goal: PrimaryGoal | null,
): number {
  if (goalWeight != null && current != null) return sign(goalWeight - current);
  return goal ? GOAL_INTENT_DIR[goal] : 0;
}

function classifyVelocity(
  ratePerWeek: number | null,
  recentRate: number | null,
  goalDir: number,
): GozlinVelocity {
  if (ratePerWeek === null) {
    return { perWeek: null, trend: "flat", label: "—" };
  }
  if (Math.abs(ratePerWeek) < 0.05) {
    return { perWeek: ratePerWeek, trend: "flat", label: "holding steady" };
  }
  const movingToward = goalDir === 0 || sign(ratePerWeek) === goalDir;
  let trend: VelocityTrend;
  if (!movingToward) {
    trend = "reversing";
  } else if (recentRate !== null && sign(recentRate) === sign(ratePerWeek)) {
    const r = Math.abs(recentRate);
    const o = Math.abs(ratePerWeek);
    trend = r > o * 1.15 ? "accelerating" : r < o * 0.85 ? "slowing" : "steady";
  } else if (recentRate !== null) {
    trend = "slowing"; // recent flattened/reversed within a toward-goal overall
  } else {
    trend = "steady";
  }
  return { perWeek: ratePerWeek, trend, label: fmtRate(ratePerWeek) };
}

function projectGoalDate(
  current: number | null,
  goalWeight: number | null,
  ratePerWeek: number | null,
  today: string,
): { etaWeeks: number | null; expectedGoalDate: string | null } {
  if (current === null || goalWeight === null || ratePerWeek === null) {
    return { etaWeeks: null, expectedGoalDate: null };
  }
  const need = goalWeight - current; // signed amount still to change
  if (Math.abs(need) < 0.3) {
    return { etaWeeks: 0, expectedGoalDate: today };
  }
  // Must be moving the right way, fast enough to matter.
  if (sign(need) !== sign(ratePerWeek) || Math.abs(ratePerWeek) < 0.02) {
    return { etaWeeks: null, expectedGoalDate: null };
  }
  const weeks = need / ratePerWeek; // same sign → positive
  if (weeks > MAX_ETA_WEEKS) return { etaWeeks: null, expectedGoalDate: null };
  return { etaWeeks: round1(weeks), expectedGoalDate: addDays(today, Math.round(weeks * 7)) };
}

interface Subscores {
  nutrition: number;
  training: number;
  momentum: number;
  direction: number;
  coverage: number;
}

function successSubscores(a: {
  adherence: number;
  trainingLoad7d: number;
  weeklyWorkoutTarget: number;
  streak: number;
  momentumTrend: GozlinTwin["momentum"]["trend"];
  ratePerWeek: number | null;
  goalDir: number;
  hasGoalWeight: boolean;
  trackedDays: number;
  weighIns: number;
}): Subscores {
  const nutrition = clamp(a.adherence / 100, 0, 1);
  const training = clamp(a.trainingLoad7d / Math.max(1, a.weeklyWorkoutTarget), 0, 1);
  const trendScore =
    a.momentumTrend === "rising" ? 1 : a.momentumTrend === "steady" ? 0.6 : 0.3;
  const momentum = clamp(a.streak / 14, 0, 1) * 0.5 + trendScore * 0.5;

  // Direction: are we actually moving toward the goal, fast enough?
  let direction: number;
  const moving = a.ratePerWeek !== null && Math.abs(a.ratePerWeek) >= 0.05;
  const towardGoal =
    a.ratePerWeek !== null && (a.goalDir === 0 || sign(a.ratePerWeek) === a.goalDir);
  if (!moving) {
    direction = a.goalDir === 0 ? 0.8 : 0.3; // flat is success only for maintenance
  } else if (!towardGoal) {
    direction = 0.1;
  } else if (a.hasGoalWeight) {
    const refRate = a.goalDir < 0 ? 0.5 : a.goalDir > 0 ? 0.25 : 0.15;
    direction = clamp(Math.abs(a.ratePerWeek!) / refRate, 0, 1);
  } else {
    direction = 0.7; // moving the right way, no target to measure pace against
  }

  const coverage =
    clamp(a.trackedDays / 14, 0, 1) * 0.6 + clamp(a.weighIns / 4, 0, 1) * 0.4;

  return { nutrition, training, momentum, direction, coverage };
}

function computeConfidence(
  basis: ForecastBasis,
  trend: ReturnType<typeof computeWeightTrend>,
  trackedDays: number,
  calCv: number,
): ForecastConfidence {
  if (basis === "insufficient") return "low";
  if (
    basis === "blended" ||
    (basis === "measured" && trend.points >= 3 && trend.fit >= 0.5 && trend.spanDays >= 14) ||
    (basis === "energy_balance" && trackedDays >= 14 && calCv < 0.18)
  ) {
    return "high";
  }
  if (
    (basis === "measured" && trend.points >= 2) ||
    (basis === "energy_balance" && trackedDays >= 8 && calCv < 0.3)
  ) {
    return "medium";
  }
  return "low";
}

function buildAdjustments(a: {
  sub: Subscores;
  goal: PrimaryGoal | null;
  goalDir: number;
  velocity: GozlinVelocity;
  flags: GozlinTwin["flags"];
  weeklyWorkoutTarget: number;
  trainingLoad7d: number;
  weighIns: number;
  hasGoalWeight: boolean;
}): GozlinAdjustment[] {
  const out: GozlinAdjustment[] = [];
  const f = new Set(a.flags);

  // Direction is the heaviest lever when it's weak.
  if (a.sub.direction < 0.55) {
    const impact = 0.27 * (1 - a.sub.direction) + 0.05;
    if (a.velocity.trend === "reversing") {
      out.push({ icon: "swap-vertical", text: "You're drifting the wrong way — reset intake this week and let's turn it around.", impact: impact + 0.05 });
    } else if (a.goalDir < 0) {
      out.push({ icon: "flame", text: "Deepen the deficit ~200 kcal/day or add a session — the scale isn't moving enough yet.", impact });
    } else if (a.goalDir > 0) {
      out.push({ icon: "barbell", text: "Add ~150–200 kcal/day, protein-first, to feed the build.", impact });
    } else {
      out.push({ icon: "git-compare-outline", text: "Nudge intake back toward maintenance to hold your line.", impact });
    }
  }

  if (a.sub.nutrition < 0.6) {
    out.push({ icon: "restaurant-outline", text: "Tighten adherence — aim for 5 clean days this week.", impact: 0.28 * (1 - a.sub.nutrition) });
  }

  const gap = Math.max(0, a.weeklyWorkoutTarget - a.trainingLoad7d);
  if (gap > 0 && a.sub.training < 0.75) {
    out.push({ icon: "barbell-outline", text: `Add ${gap} session${gap === 1 ? "" : "s"} to hit your weekly target — schedule them like appointments.`, impact: 0.15 * (1 - a.sub.training) });
  }

  if (f.has("PROTEIN_LAG")) {
    out.push({ icon: "egg-outline", text: "Add 15–20g protein at breakfast — the easiest lever you have.", impact: 0.12 });
  }

  if (a.weighIns < 2) {
    out.push({ icon: "scale-outline", text: "Weigh in 2–3×/week so I can track the real trend, not just the math.", impact: 0.15 * (1 - a.sub.coverage) + 0.04 });
  }

  if (a.sub.momentum < 0.45 || f.has("SETBACK")) {
    out.push({ icon: "refresh-outline", text: "One small win today restarts the momentum — that's the whole ask.", impact: 0.15 * (1 - a.sub.momentum) });
  }

  if (out.length === 0) {
    out.push({ icon: "checkmark-circle-outline", text: "Hold the course — this is working. Consistency is the lever now.", impact: 0.05 });
  }

  // Rank by leverage, dedupe identical text, keep the top 3.
  const seen = new Set<string>();
  return out
    .sort((x, y) => y.impact - x.impact)
    .filter((adj) => (seen.has(adj.text) ? false : (seen.add(adj.text), true)))
    .slice(0, 3);
}

function buildDrivers(a: {
  adherence: number;
  basis: ForecastBasis;
  ratePerWeek: number | null;
  trend: ReturnType<typeof computeWeightTrend>;
  avgConsumed: number;
  maintenance: number;
  trackedDays: number;
  trainingLoad7d: number;
  weeklyWorkoutTarget: number;
}): string[] {
  const drivers: string[] = [`${a.adherence}/100 adherence`];
  if ((a.basis === "measured" || a.basis === "blended") && a.trend.perWeek !== null) {
    drivers.push(`scale: ${fmtRate(a.trend.perWeek)} over ${a.trend.spanDays}d (${a.trend.points} weigh-ins)`);
  }
  if (a.trackedDays > 0) {
    drivers.push(`${a.avgConsumed} kcal/day vs ~${a.maintenance} maintenance`);
  }
  drivers.push(`${a.trainingLoad7d}/${a.weeklyWorkoutTarget} sessions/wk`);
  return drivers;
}

function buildSummary(a: {
  basis: ForecastBasis;
  ratePerWeek: number | null;
  trend: ReturnType<typeof computeWeightTrend>;
  goal: PrimaryGoal | null;
  body: GozlinTwin["body"];
  etaWeeks: number | null;
  expectedGoalDate: string | null;
  adherenceLimited: boolean;
}): string {
  if (a.basis === "insufficient" || a.ratePerWeek === null) {
    return "I need a few more logged days — or a couple of weigh-ins — before I can forecast your trajectory honestly.";
  }

  const rate = a.ratePerWeek;
  const measured = a.basis === "measured" || a.basis === "blended";
  const dir = rate < 0 ? "down" : "up";
  const absMonthly = Math.abs(round1(rate * 4));

  let core: string;
  if (Math.abs(rate) < 0.05) {
    core =
      a.goal === "lose_weight"
        ? "Your weight's holding flat — at this intake you're not yet in a fat-loss deficit."
        : a.goal === "build_muscle"
          ? "You're holding at maintenance — muscle gain will be slow until intake comes up a touch."
          : "You're holding close to maintenance — steady is exactly right for this goal.";
  } else if (measured) {
    const lead = a.basis === "blended" ? "The scale and your intake agree:" : "The scale says:";
    core = `${lead} you're trending ${fmtRate(rate)} — about ${absMonthly}kg ${dir} over a month.`;
  } else {
    core = `At your current intake you're projected to trend ${fmtRate(rate)} — roughly ${absMonthly}kg ${dir} over the next month.`;
  }

  // Add the goal-date sentence when we have one.
  if (a.etaWeeks != null && a.expectedGoalDate && a.body.goalWeightKg != null) {
    if (a.etaWeeks === 0) {
      core += ` You're essentially at your ${a.body.goalWeightKg}kg goal — now it's about holding it.`;
    } else {
      core += ` Hold this and you reach ${a.body.goalWeightKg}kg in about ${formatEta(a.etaWeeks)}.`;
    }
  } else if (a.body.goalWeightKg != null && Math.abs(rate) >= 0.05) {
    core += ` At this pace, though, you're not closing on your ${a.body.goalWeightKg}kg goal — see the adjustment below.`;
  }

  if (a.adherenceLimited) core += " (Reading is limited by how consistently it's logged.)";
  return core;
}

function formatEta(weeks: number): string {
  if (weeks < 1) return "under a week";
  if (weeks < 8) return `${Math.round(weeks)} week${Math.round(weeks) === 1 ? "" : "s"}`;
  const months = weeks / 4.345;
  return `${Math.round(months)} month${Math.round(months) === 1 ? "" : "s"}`;
}
