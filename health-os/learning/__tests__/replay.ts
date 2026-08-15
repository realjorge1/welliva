/**
 * health-os/learning/__tests__/replay.ts — the offline replay harness.
 *
 * You cannot claim "learns and improves" in diligence without measuring it. This
 * generates synthetic users with KNOWN ground-truth parameters, replays them
 * through the learning stack, and lets the tests assert that the estimates
 * actually converge on the truth.
 *
 * Everything is seeded. A learning test that flakes is worse than no test:
 * people stop trusting it and then stop reading it.
 */

import type { ArmId } from "../types";

// ── Deterministic RNG ──────────────────────────────────────────────

/** mulberry32 — small, fast, good enough, and reproducible across machines. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal from a uniform source. */
export function normal(rng: () => number, mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Synthetic cohorts ──────────────────────────────────────────────

export interface SyntheticUser {
  name: string;
  /** Ground truth the Kalman filter has to find. */
  trueTdee: number;
  startWeightKg: number;
  /** Mean daily intake they actually eat. */
  meanIntake: number;
  /** Day-to-day intake variability (kcal). Erratic loggers are noisier. */
  intakeSd: number;
  /** 0–1 probability they weigh in on a given day. */
  weighInRate: number;
  /** 0–1 probability they log intake on a given day. */
  logRate: number;
  /**
   * 0–1 share of intake they fail to record. Free-living logs run 20–30%
   * under actual, and the filter absorbs this into a lower learned TDEE.
   */
  underReporting: number;
  /** True success probability per delivery arm — what the bandit must learn. */
  armResponse: Record<ArmId, number>;
  /** Baseline daily session-completion probability. */
  baseCompletion: number;
  /** Day index where behaviour shifts, or null for a stable user. */
  changePointDay: number | null;
  /** Signed change in completion probability at the change point. */
  changeMagnitude: number;
}

const ARMS_NEUTRAL: Record<ArmId, number> = {
  "nudge:direct": 0.5,
  "nudge:gentle": 0.5,
  "nudge:question": 0.5,
  "nudge:celebrate": 0.5,
  "nudge:silence": 0.5,
};

export const COHORTS: SyntheticUser[] = [
  {
    name: "consistent-logger",
    trueTdee: 2400,
    startWeightKg: 82,
    meanIntake: 2000,
    intakeSd: 120,
    weighInRate: 1,
    logRate: 1,
    underReporting: 0,
    // Responds to being told straight; questions land flat.
    armResponse: {
      ...ARMS_NEUTRAL,
      "nudge:direct": 0.78,
      "nudge:gentle": 0.5,
      "nudge:question": 0.32,
      "nudge:celebrate": 0.55,
      "nudge:silence": 0.28,
    },
    baseCompletion: 0.82,
    changePointDay: null,
    changeMagnitude: 0,
  },
  {
    name: "erratic-logger",
    trueTdee: 2150,
    startWeightKg: 74,
    meanIntake: 1900,
    intakeSd: 380,
    weighInRate: 0.45,
    logRate: 0.6,
    underReporting: 0.15,
    armResponse: {
      ...ARMS_NEUTRAL,
      "nudge:gentle": 0.7,
      "nudge:direct": 0.34,
      "nudge:celebrate": 0.6,
      "nudge:silence": 0.4,
    },
    baseCompletion: 0.55,
    changePointDay: null,
    changeMagnitude: 0,
  },
  {
    name: "plateau-prone",
    trueTdee: 2600,
    startWeightKg: 95,
    meanIntake: 2550,
    intakeSd: 200,
    weighInRate: 0.8,
    logRate: 0.85,
    underReporting: 0.25,
    armResponse: { ...ARMS_NEUTRAL, "nudge:celebrate": 0.72, "nudge:direct": 0.4 },
    baseCompletion: 0.6,
    // Falls off a cliff at week 10 — the case CUSUM exists to catch.
    changePointDay: 70,
    changeMagnitude: -0.4,
    },
  {
    name: "silence-responder",
    trueTdee: 2300,
    startWeightKg: 68,
    meanIntake: 2100,
    intakeSd: 150,
    weighInRate: 0.7,
    logRate: 0.8,
    underReporting: 0.1,
    // The user every coaching app over-communicates at: they self-correct, and
    // being nudged actively makes it worse.
    armResponse: {
      "nudge:direct": 0.25,
      "nudge:gentle": 0.4,
      "nudge:question": 0.35,
      "nudge:celebrate": 0.45,
      "nudge:silence": 0.75,
    },
    baseCompletion: 0.7,
    changePointDay: null,
    changeMagnitude: 0,
  },
];

// ── Simulation ─────────────────────────────────────────────────────

export interface SimulatedDay {
  index: number;
  date: string;
  /** What they actually ate. Not visible to the models. */
  trueIntake: number;
  /** What they recorded — under-reported, or null if they didn't log. */
  loggedIntake: number | null;
  /** True body weight. Not visible to the models. */
  trueWeightKg: number;
  /** Scale reading, or null if they didn't weigh in. */
  scaleKg: number | null;
  sessionCompleted: boolean;
}

const DAY_MS = 86400_000;

function isoDate(start: Date, offset: number): string {
  const d = new Date(start.getTime() + offset * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Replay `days` of a synthetic user.
 *
 * Weight evolves by strict energy balance off TRUE intake, while the models
 * only ever see the LOGGED figure — which is exactly the situation that makes
 * naive week-over-week arithmetic mislead real users.
 */
export function simulate(
  user: SyntheticUser,
  days: number,
  seed = 12345,
  startDate = new Date(2026, 0, 1),
): SimulatedDay[] {
  const rng = mulberry32(seed);
  const out: SimulatedDay[] = [];
  let weight = user.startWeightKg;

  for (let i = 0; i < days; i++) {
    const trueIntake = Math.max(800, normal(rng, user.meanIntake, user.intakeSd));

    // Energy balance, plus a little unexplained physiological drift.
    weight += (trueIntake - user.trueTdee) / 7700 + normal(rng, 0, 0.05);

    const logged =
      rng() < user.logRate ? Math.round(trueIntake * (1 - user.underReporting)) : null;
    // Daily scale noise: water, glycogen, gut content. σ ≈ 0.5 kg.
    const scale = rng() < user.weighInRate ? Number((weight + normal(rng, 0, 0.5)).toFixed(1)) : null;

    const completionP =
      user.changePointDay !== null && i >= user.changePointDay
        ? Math.max(0.02, user.baseCompletion + user.changeMagnitude)
        : user.baseCompletion;

    out.push({
      index: i,
      date: isoDate(startDate, i),
      trueIntake,
      loggedIntake: logged,
      trueWeightKg: Number(weight.toFixed(3)),
      scaleKg: scale,
      sessionCompleted: rng() < completionP,
    });
  }

  return out;
}

/**
 * Raw daily completion, 0/1. THIS is what the change-point detector should be
 * fed: CUSUM assumes independent observations, and a rolling average violates
 * that badly enough to wreck its false-alarm calibration.
 */
export function completionSeries(days: SimulatedDay[]): number[] {
  return days.map((d) => (d.sessionCompleted ? 1 : 0));
}

/**
 * A smoothed rate, for CHARTS only — never for the detector. Kept here so the
 * distinction is explicit rather than something a future caller has to
 * rediscover the hard way.
 */
export function smoothedCompletion(days: SimulatedDay[], window = 7): number[] {
  return days.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = days.slice(from, i + 1);
    return slice.filter((d) => d.sessionCompleted).length / slice.length;
  });
}

// ── Bandit environment ─────────────────────────────────────────────

/** Did the user respond to this arm on this occasion? */
export function armOutcome(user: SyntheticUser, arm: ArmId, rng: () => number): boolean {
  return rng() < (user.armResponse[arm] ?? 0.5);
}

/** The best achievable rate — the reference for regret. */
export function bestArmRate(user: SyntheticUser): number {
  return Math.max(...Object.values(user.armResponse));
}
