/**
 * GOZLIN — Progress Detective (Phase 8).
 *
 * The Data-Scientist brain. It doesn't just surface findings — it builds a
 * *case*: it reads adherence, the weight trend, training volume and workout
 * performance together, then names the single most likely ROOT CAUSE of what
 * the numbers are doing, backed by an auditable metric strip.
 *
 * The hallmark read it's built for:
 *   "Your weight hasn't changed in 10 days, but your workout performance is up
 *    14% — that usually means muscle gain offsetting fat loss, plus water
 *    retention hiding it on the scale."
 *
 * Pure & deterministic over local history (inject `now` for tests). It composes
 * the Twin's body trajectory, the BodyLogService trend, and the lighter
 * `detectFindings` (hidden wins / correlations) for supporting evidence. It
 * introduces no new scoring — every number traces to a named source.
 */

import type { DietHistoryEntry } from "../../models/diet";
import type { SessionSummaryData } from "../../models/session";
import type { BodyLogEntry, WorkoutLogEntry } from "../../models/workout";
import { computeWeightTrend } from "../BodyLogService";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import { detectFindings } from "./GozlinProgressEngine";
import type {
  DetectiveMetric,
  FindingKind,
  GozlinDetectiveReport,
  GozlinTwin,
  ProgressFinding,
} from "./gozlin.types";

// ── Tunables ────────────────────────────────────────────────────────
const RECENT_DAYS = 14; // "now" window for performance + weight
const PRIOR_DAYS = 28; // outer edge of the comparison window
const FLAT_RATE = 0.2; // |kg/week| below this is "the scale is flat"
const RECOMP_PERF_GAIN = 0.08; // ≥8% more training volume → performance climbing
const MIN_TRACKED = 4; // logged diet days needed to read nutrition
const MIN_SESSIONS = 2; // sessions per window needed to read performance

// ── small numeric helpers ───────────────────────────────────────────
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const sign = (n: number) => (n > 0.05 ? 1 : n < -0.05 ? -1 : 0);

function adhPct(h: DietHistoryEntry): number {
  return h.totalMeals > 0 ? h.mealsConsumed / h.totalMeals : 0;
}

function coeffVar(xs: number[]): number {
  const m = mean(xs);
  if (m <= 0) return 0;
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m;
}

function inWindow(today: string, fromDaysAgo: number, toDaysAgo: number): Set<string> {
  const end = parseLocalDate(today);
  const out = new Set<string>();
  for (let i = fromDaysAgo; i < toDaysAgo; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.add(toLocalDateString(d));
  }
  return out;
}

/**
 * Per-session work proxy. Prefers reps (the real progression signal); falls back
 * to completion% for sessions that are entirely timed (zero reps logged).
 */
function sessionVolume(s: SessionSummaryData): number {
  return s.totalReps > 0 ? s.totalReps : s.completionPercent;
}

interface PerfRead {
  /** Signed fractional change in training volume, recent vs prior. Null if thin. */
  deltaPct: number | null;
  recentN: number;
  priorN: number;
}

/** Compare training volume in the recent window vs the prior window. */
function readPerformance(history: SessionSummaryData[], today: string): PerfRead {
  const recentSet = inWindow(today, 0, RECENT_DAYS);
  const priorSet = inWindow(today, RECENT_DAYS, PRIOR_DAYS);
  const recent = history.filter((s) => recentSet.has(s.date)).map(sessionVolume);
  const prior = history.filter((s) => priorSet.has(s.date)).map(sessionVolume);
  if (recent.length < MIN_SESSIONS || prior.length < MIN_SESSIONS) {
    return { deltaPct: null, recentN: recent.length, priorN: prior.length };
  }
  const pr = mean(prior);
  const deltaPct = pr > 0 ? (mean(recent) - pr) / pr : null;
  return { deltaPct, recentN: recent.length, priorN: prior.length };
}

function fmtKg(kg: number): string {
  const a = Math.abs(round1(kg));
  if (a < 0.1) return "flat";
  return `${kg < 0 ? "−" : "+"}${a} kg`;
}

function fmtPct(frac: number): string {
  const p = Math.round(frac * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

// ════════════════════════════════════════════════════════════════════

export interface DetectiveInput {
  twin: GozlinTwin;
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  bodyLogs: BodyLogEntry[];
  /** Sessions/week the user is aiming for (training-coverage read). */
  weeklyWorkoutTarget: number;
  now?: Date;
}

interface Candidate {
  finding: ProgressFinding;
  /** Higher = stronger claim on being THE root cause. */
  priority: number;
}

export function buildDetectiveReport(input: DetectiveInput): GozlinDetectiveReport {
  const { twin, dietHistory, sessionHistory, bodyLogs, weeklyWorkoutTarget } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);

  const adherence = twin.momentum.adherence7d;
  const trainingLoad = twin.momentum.trainingLoad7d;

  // ── Coverage: how much have we actually got to work with? ──
  const last14 = inWindow(today, 0, RECENT_DAYS);
  const trackedAdh = dietHistory
    .filter((h) => last14.has(h.date) && h.totalMeals > 0)
    .map(adhPct);
  const trackedDays = trackedAdh.length;

  // ── Weight: short-window trend (the scale's recent behaviour) ──
  const trend = computeWeightTrend(bodyLogs, today, RECENT_DAYS);
  const weighIns = trend.points;
  const weightDeltaKg =
    trend.perWeek !== null && trend.spanDays > 0
      ? round1(trend.perWeek * (trend.spanDays / 7))
      : null;
  const weightFlat = trend.perWeek !== null && Math.abs(trend.perWeek) < FLAT_RATE;
  const goalDir = goalDirection(twin);

  // ── Performance: training volume, recent vs prior ──
  const perf = readPerformance(sessionHistory, today);

  const dataLimited = trackedDays < MIN_TRACKED && weighIns < 2 && perf.deltaPct === null;

  // ── Metric strip (auditable evidence) ──
  const metrics = buildMetrics({
    adherence,
    trend,
    weighIns,
    weightDeltaKg,
    goalDir,
    trainingLoad,
    weeklyWorkoutTarget,
    perf,
  });

  if (dataLimited) {
    return {
      __kind: "detective",
      headline: "Not enough logged yet to investigate.",
      rootCause: null,
      metrics,
      findings: [
        {
          kind: "inconsistency",
          icon: "documents-outline",
          title: "Give me a week of signal",
          detail:
            "Log your meals, a couple of weigh-ins and your workouts for ~7 days and I can start explaining what's actually driving your results — not just describing them.",
          evidence: [
            `${trackedDays} days of meals logged`,
            `${weighIns} weigh-ins`,
            `${perf.recentN + perf.priorN} sessions recorded`,
          ],
        },
      ],
      dataLimited: true,
    };
  }

  // ── Candidate root causes (ranked) ──
  const candidates: Candidate[] = [];

  // 1) Recomposition — the marquee read: flat scale + climbing performance.
  if (
    weightFlat &&
    weighIns >= 2 &&
    perf.deltaPct !== null &&
    perf.deltaPct >= RECOMP_PERF_GAIN
  ) {
    candidates.push({
      priority: 100 + Math.round(perf.deltaPct * 100),
      finding: {
        kind: "root_cause",
        icon: "git-branch-outline",
        title: "Likely recomposition — muscle up, fat down",
        detail: `Your weight's barely moved over ${trend.spanDays} days, but your training volume is up ${fmtPct(perf.deltaPct)}. That combination usually means you're adding muscle while losing fat — and day-to-day water shifts are hiding it on the scale.`,
        evidence: [
          `weight ${weightDeltaKg !== null ? fmtKg(weightDeltaKg) : "flat"} over ${trend.spanDays}d (${weighIns} weigh-ins)`,
          `training volume ${fmtPct(perf.deltaPct)} vs the prior 2 weeks`,
          `${adherence}/100 nutrition adherence`,
        ],
        lever:
          "Trust the trend, not the daily number. Track your waist and a monthly photo — and keep doing exactly this.",
      },
    });
  }

  // 2) True plateau — flat scale, performance NOT explaining it, goal unmet.
  if (
    weightFlat &&
    weighIns >= 2 &&
    !(perf.deltaPct !== null && perf.deltaPct >= RECOMP_PERF_GAIN) &&
    goalDir !== 0 &&
    (twin.body.goalProgress === null || twin.body.goalProgress < 0.95) &&
    adherence >= 45
  ) {
    candidates.push({
      priority: 80,
      finding: {
        kind: "plateau",
        icon: "remove-circle-outline",
        title: "A genuine plateau",
        detail: `The scale's held flat for about ${trend.spanDays} days and your training isn't climbing enough to explain it. Your body's adapted to the current plan — this is a real stall, not recomposition.`,
        evidence: [
          `weight ${weightDeltaKg !== null ? fmtKg(weightDeltaKg) : "flat"} over ${trend.spanDays}d`,
          perf.deltaPct !== null
            ? `training volume ${fmtPct(perf.deltaPct)} (not rising)`
            : `${trainingLoad}/${weeklyWorkoutTarget} sessions/wk`,
          `${adherence}/100 adherence`,
        ],
        lever:
          goalDir < 0
            ? "Change one variable for 7 days — drop intake ~200 kcal or add a session — and let's watch the needle."
            : "Push one variable for 7 days — add ~150 kcal protein-first or a heavier set — to break the adaptation.",
      },
    });
  }

  // 3) Blocker — what's measurably holding progress back.
  const blocker = detectBlocker({
    adherence,
    trackedDays,
    trainingLoad,
    weeklyWorkoutTarget,
    weightFlat,
    weightDeltaKg,
    goalDir,
  });
  if (blocker) candidates.push(blocker);

  // 4) Accelerator — what's measurably moving you forward.
  const accel = detectAccelerator({
    twin,
    adherence,
    perf,
    weightDeltaKg,
    goalDir,
  });
  if (accel) candidates.push(accel);

  // 5) Inconsistency — effort that swings too much day-to-day.
  if (trackedDays >= 6) {
    const cv = coeffVar(trackedAdh);
    const strongDays = trackedAdh.filter((a) => a >= 0.8).length;
    const zeroDays = trackedAdh.filter((a) => a <= 0.25).length;
    if (cv >= 0.5 && zeroDays >= 2 && strongDays >= 2) {
      candidates.push({
        priority: 55,
        finding: {
          kind: "inconsistency",
          icon: "pulse-outline",
          title: "Your effort swings hard day-to-day",
          detail:
            "You have genuinely strong days and near-zero days back to back. The average looks mediocre, but it's really two different people — and the all-or-nothing pattern is what's capping results.",
          evidence: [
            `${strongDays} strong days vs ${zeroDays} near-zero days (last ${trackedDays})`,
          ],
          lever: "Set a floor, not a ceiling: one protein meal + water even on bad days keeps the average up.",
        },
      });
    }
  }

  // ── Pick the root cause; the rest become supporting findings ──
  candidates.sort((a, b) => b.priority - a.priority);
  const rootCause = candidates[0]?.finding ?? null;

  const supporting: ProgressFinding[] = candidates.slice(1).map((c) => c.finding);

  // Fold in the lighter detective findings (hidden wins / correlations), deduped.
  const extra = detectFindings({
    twin,
    dietHistory,
    workoutLog: input.workoutLog,
    now,
  });
  const seen = new Set<string>([rootCause?.title, ...supporting.map((f) => f.title)].filter(Boolean) as string[]);
  for (const f of extra) {
    if (seen.has(f.title)) continue;
    seen.add(f.title);
    supporting.push(f);
  }

  return {
    __kind: "detective",
    headline: buildHeadline(rootCause),
    rootCause,
    metrics,
    findings: supporting.slice(0, 4),
    dataLimited: false,
  };
}

// ════════════════════════════════════════════════════════════════════
// Sub-routines
// ════════════════════════════════════════════════════════════════════

/** Which way we WANT the scale to move: from the goal weight if set, else goal intent. */
function goalDirection(twin: GozlinTwin): number {
  const { goalWeightKg, currentWeightKg } = twin.body;
  if (goalWeightKg != null && currentWeightKg != null) {
    return sign(goalWeightKg - currentWeightKg);
  }
  switch (twin.goal) {
    case "lose_weight":
      return -1;
    case "build_muscle":
    case "increase_energy":
    case "athletic_performance":
      return 1;
    default:
      return 0;
  }
}

function detectBlocker(a: {
  adherence: number;
  trackedDays: number;
  trainingLoad: number;
  weeklyWorkoutTarget: number;
  weightFlat: boolean;
  weightDeltaKg: number | null;
  goalDir: number;
}): Candidate | null {
  // Reversing the wrong way is the loudest blocker.
  const driftingWrong =
    a.weightDeltaKg !== null && a.goalDir !== 0 && sign(a.weightDeltaKg) === -a.goalDir && Math.abs(a.weightDeltaKg) >= 0.4;
  if (driftingWrong) {
    return {
      priority: 90,
      finding: {
        kind: "blocker",
        icon: "trending-down-outline",
        title: "You're drifting the wrong way",
        detail:
          "The scale's moving away from your goal, not toward it. Something in the daily intake has crept past where it needs to be.",
        evidence: [`weight ${fmtKg(a.weightDeltaKg!)} — wrong direction`, `${a.adherence}/100 adherence`],
        lever: "Reset this week: re-anchor your intake to plan and protect 5 clean days.",
      },
    };
  }

  // Low adherence while stalled — nutrition is the bottleneck.
  if (a.adherence < 55 && a.trackedDays >= MIN_TRACKED) {
    return {
      priority: 70,
      finding: {
        kind: "blocker",
        icon: "restaurant-outline",
        title: "Inconsistent nutrition is the bottleneck",
        detail:
          "Your training is showing up, but the plan only works as far as it's followed — and adherence is where the results are leaking out.",
        evidence: [`${a.adherence}/100 adherence`, `${a.trackedDays} days logged`],
        lever: "Pick the one meal slot you miss most and make it non-negotiable for 7 days.",
      },
    };
  }

  // Under-training relative to the target.
  if (a.trainingLoad < a.weeklyWorkoutTarget * 0.6) {
    const gap = Math.max(1, a.weeklyWorkoutTarget - a.trainingLoad);
    return {
      priority: 60,
      finding: {
        kind: "blocker",
        icon: "barbell-outline",
        title: "Training volume is short",
        detail: `You're running below your weekly training target, and that's the lever the scale is waiting on.`,
        evidence: [`${a.trainingLoad}/${a.weeklyWorkoutTarget} sessions this week`],
        lever: `Add ${gap} session${gap === 1 ? "" : "s"} this week — schedule them like appointments.`,
      },
    };
  }

  return null;
}

function detectAccelerator(a: {
  twin: GozlinTwin;
  adherence: number;
  perf: PerfRead;
  weightDeltaKg: number | null;
  goalDir: number;
}): Candidate | null {
  const movingRight =
    a.weightDeltaKg !== null && a.goalDir !== 0 && sign(a.weightDeltaKg) === a.goalDir && Math.abs(a.weightDeltaKg) >= 0.3;

  // Training clearly climbing — the strongest, most motivating accelerator.
  if (a.perf.deltaPct !== null && a.perf.deltaPct >= 0.1) {
    return {
      priority: 50,
      finding: {
        kind: "accelerator",
        icon: "trending-up-outline",
        title: "Your training is on a clear upswing",
        detail: `You're doing ${fmtPct(a.perf.deltaPct)} more work in your sessions than two weeks ago. That's the engine of every result that follows — protect it.`,
        evidence: [`training volume ${fmtPct(a.perf.deltaPct)} vs prior 2 weeks`],
        lever: "Keep the progression gentle — small weekly bumps beat heroic jumps that force a deload.",
      },
    };
  }

  // Nutrition consistency driving real movement toward the goal.
  if (movingRight && a.adherence >= 65) {
    return {
      priority: 45,
      finding: {
        kind: "accelerator",
        icon: "rocket-outline",
        title: "Consistency is doing the heavy lifting",
        detail:
          "Your adherence is high and the scale is moving the way you want it to. This is exactly the loop that compounds — the boring part that works.",
        evidence: [`weight ${fmtKg(a.weightDeltaKg!)} toward goal`, `${a.adherence}/100 adherence`],
        lever: "Don't change a thing yet — let this run and we'll only adjust when it stalls.",
      },
    };
  }

  return null;
}

function buildMetrics(a: {
  adherence: number;
  trend: ReturnType<typeof computeWeightTrend>;
  weighIns: number;
  weightDeltaKg: number | null;
  goalDir: number;
  trainingLoad: number;
  weeklyWorkoutTarget: number;
  perf: PerfRead;
}): DetectiveMetric[] {
  const metrics: DetectiveMetric[] = [];

  // Adherence
  metrics.push({
    icon: "pulse",
    label: "Adherence",
    value: `${a.adherence}/100`,
    direction: a.adherence >= 60 ? "good" : a.adherence < 40 ? "bad" : "neutral",
  });

  // Weight (only when we have a real trend)
  if (a.weighIns >= 2 && a.weightDeltaKg !== null) {
    const moving = Math.abs(a.weightDeltaKg) >= 0.1;
    const towardGoal = a.goalDir !== 0 && sign(a.weightDeltaKg) === a.goalDir;
    const direction: DetectiveMetric["direction"] = !moving
      ? a.goalDir === 0
        ? "good"
        : "neutral"
      : towardGoal
        ? "good"
        : "bad";
    metrics.push({
      icon: "scale-outline",
      label: "Weight",
      value: fmtKg(a.weightDeltaKg),
      delta: `${a.trend.spanDays}d`,
      direction,
    });
  } else {
    metrics.push({
      icon: "scale-outline",
      label: "Weight",
      value: "no trend",
      direction: "neutral",
    });
  }

  // Training load
  metrics.push({
    icon: "barbell",
    label: "Training",
    value: `${a.trainingLoad}/${a.weeklyWorkoutTarget}`,
    delta: "this wk",
    direction:
      a.trainingLoad >= a.weeklyWorkoutTarget
        ? "good"
        : a.trainingLoad < a.weeklyWorkoutTarget * 0.6
          ? "bad"
          : "neutral",
  });

  // Workout performance (only when comparable)
  if (a.perf.deltaPct !== null) {
    metrics.push({
      icon: "flash",
      label: "Performance",
      value: fmtPct(a.perf.deltaPct),
      delta: "vs 2 wks",
      direction: a.perf.deltaPct > 0.02 ? "good" : a.perf.deltaPct < -0.02 ? "bad" : "neutral",
    });
  }

  return metrics;
}

const HEADLINE_BY_KIND: Partial<Record<FindingKind, string>> = {
  root_cause: "The scale's misleading you — here's what's really happening.",
  plateau: "You've hit a real plateau. Let's break it.",
  blocker: "I found what's slowing you down.",
  accelerator: "I found what's working — let's protect it.",
  inconsistency: "Your results are hiding in the swings.",
};

function buildHeadline(rootCause: ProgressFinding | null): string {
  if (!rootCause) return "Here's the honest read on your progress.";
  return HEADLINE_BY_KIND[rootCause.kind] ?? "Here's what your data is telling me.";
}
