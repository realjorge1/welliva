/**
 * GOZLIN — AI Health Twin (Phase 2 §1).
 *
 * The central, normalized read-model. Every Gozlin feature consumes ONE Twin
 * snapshot instead of re-deriving from raw state, so features stay consistent
 * and cheap. Pure & deterministic (inject `now` for tests).
 *
 * Composes the existing Welliva intelligence (computeConsistency) and the
 * sibling RecoveryEngine — it introduces no new scoring of its own beyond
 * normalizing already-trusted numbers into flags + metrics.
 */

import type { PrimaryGoal } from "../../models/user";
import {
  computeWeightTrend,
  latestWeight,
  lastWeighInDate,
  startWeight as earliestWeight,
} from "../BodyLogService";
import { computeConsistency } from "../intelligence";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import { computeRecovery } from "./GozlinRecoveryEngine";
import type {
  GozlinBodyState,
  GozlinFlag,
  GozlinMetric,
  GozlinSnapshotInput,
  GozlinTwin,
  MomentumTrend,
} from "./gozlin.types";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function dayProgress(hour: number): number {
  return clamp((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR), 0, 1);
}

function metric(consumed: number, target: number): GozlinMetric {
  const t = target > 0 ? target : 0;
  const pct = t > 0 ? clamp(consumed / t, 0, 2) : 0;
  return { consumed, target: t, pct };
}

const GOAL_PHRASE: Record<PrimaryGoal, string> = {
  lose_weight: "losing fat",
  build_muscle: "building muscle",
  improve_fitness: "getting fitter",
  increase_energy: "building steady energy",
  better_health: "getting healthier",
  athletic_performance: "chasing performance",
};

/** Normalize body logs + goal weight into the Twin's trajectory snapshot. */
function buildBodyState(
  input: GozlinSnapshotInput,
  today: string,
): GozlinBodyState {
  const onboardWeight = input.bio?.weightKg ?? null;
  const current = latestWeight(input.bodyLogs) ?? onboardWeight;
  const start = earliestWeight(input.bodyLogs) ?? onboardWeight;
  const goal = input.goals.targetWeightKg ?? null;
  const trend = computeWeightTrend(input.bodyLogs, today);

  let goalProgress: number | null = null;
  if (goal != null && start != null && current != null) {
    const total = start - goal; // distance to cover (signed)
    if (Math.abs(total) >= 0.1) {
      goalProgress = clamp((start - current) / total, 0, 1);
    }
  }

  return {
    currentWeightKg: current,
    startWeightKg: start,
    goalWeightKg: goal,
    measuredRatePerWeek: trend.perWeek,
    trendFit: trend.fit,
    weighIns: trend.points,
    lastWeighInDate: lastWeighInDate(input.bodyLogs),
    goalProgress,
  };
}

/** Count workout logs within the last `days` calendar days (incl. today). */
function recentSessionCount(
  log: GozlinSnapshotInput["workoutLog"],
  today: string,
  days: number,
): number {
  const end = parseLocalDate(today);
  const window = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    window.add(toLocalDateString(d));
  }
  return log.filter((l) => window.has(l.date)).length;
}

export function buildTwin(input: GozlinSnapshotInput): GozlinTwin {
  const now = input.now ?? new Date();
  const hour = now.getHours();
  const today = toLocalDateString(now);
  const progress = dayProgress(hour);

  const hasProfile = !!input.bio;
  const goal: PrimaryGoal | null = input.bio?.primaryGoal ?? null;

  // ── Today metrics ──
  const calories = metric(input.consumed.calories, input.targets?.calories ?? 0);
  const protein = metric(input.consumed.proteinG, input.targets?.proteinG ?? 0);
  const water = metric(input.consumed.waterMl, input.waterGoalMl);

  const plannedSession =
    input.workoutSession && !input.workoutSession.isRestDay
      ? input.workoutSession
      : null;

  // ── Momentum (reuse existing consistency engine) ──
  const consistency = computeConsistency(input.dietHistory, today);
  const trainingLoad7d = recentSessionCount(input.workoutLog, today, 7);
  const trend: MomentumTrend =
    consistency.trend === "up"
      ? "rising"
      : consistency.trend === "down"
        ? "cooling"
        : "steady";

  // ── Body trajectory (weigh-ins + goal weight) ──
  const body = buildBodyState(input, today);

  // ── Recovery (sibling engine) ──
  const recovery = computeRecovery({
    workoutLog: input.workoutLog,
    todaySession: plannedSession,
    wearable: input.wearable,
    now,
  });

  // ── Flags (normalized signals) ──
  const flags: GozlinFlag[] = [];
  const hasPlan = !!input.todayDiet?.hasScheduledDiet;

  if (!hasPlan && hasProfile && hour >= 8) flags.push("NO_PLAN");

  if (hasPlan && calories.target > 0) {
    if (calories.pct > 1.08) flags.push("OVER_CALORIES");
    else if (hour >= 19 && calories.pct < 0.6) flags.push("BEHIND_CALORIES");
    else if (calories.pct >= progress - 0.2 && calories.pct <= 1.05 && calories.pct > 0.1)
      flags.push("ON_TRACK");

    if (protein.target > 0) {
      if (calories.pct > 0.5 && protein.pct < calories.pct - 0.2)
        flags.push("PROTEIN_LAG");
      else if (protein.pct >= 0.9) flags.push("PROTEIN_STRONG");
    }
  }

  if (water.target > 0) {
    if (water.pct >= 1) flags.push("WATER_DONE");
    else if (hour >= 10 && water.pct < progress - 0.25) flags.push("LOW_WATER");
  }

  if (plannedSession) {
    flags.push(input.workoutDoneToday ? "WORKOUT_DONE" : "WORKOUT_PENDING");
  } else if (hasProfile) {
    flags.push("REST_DAY");
  }

  if (input.streak.currentStreak >= 3) flags.push("STREAK_STRONG");
  else if (input.streak.currentStreak === 0 && input.streak.totalActiveDays > 0)
    flags.push("STREAK_BROKEN");

  if (consistency.score < 35 && input.streak.currentStreak === 0 && hasProfile)
    flags.push("SETBACK");

  // ── Identity summary ──
  const goalPhrase = goal ? GOAL_PHRASE[goal] : "getting started";
  const days = input.bio?.workoutDaysPerWeek;
  const identitySummary = days
    ? `${goalPhrase}, training ${days}×/week`
    : goalPhrase;

  return {
    hasProfile,
    goal,
    identitySummary,
    today: {
      calories,
      protein,
      water,
      workout: {
        planned: plannedSession ? plannedSession.focus : null,
        done: input.workoutDoneToday,
        minutes: plannedSession?.totalDurationMinutes ?? 0,
      },
      dayProgress: progress,
    },
    momentum: {
      streak: input.streak.currentStreak,
      adherence7d: consistency.score,
      trainingLoad7d,
      trend,
    },
    body,
    recovery,
    flags,
    asOf: now.toISOString(),
  };
}
