/**
 * health-os/learning — shared types.
 *
 * THE PRINCIPLE, because everything here follows from it:
 *
 *   Learning = a closed loop where a prediction is recorded, an outcome is
 *   observed, and a parameter changes as a result.
 *
 * Storage is not learning. Memory tiers, summaries and an episodic log are all
 * storage — they let the coach recall, not improve. What was missing was all
 * three legs of the loop: nothing was predicted, so nothing could be checked,
 * so nothing could be updated.
 */

// ════════════════════════════════════════════════════════════════
// The outcome ledger
// ════════════════════════════════════════════════════════════════

/** Something observable in the timeline that a recommendation can move. */
export type MetricId =
  | "protein_g"
  | "calories_kcal"
  | "water_ml"
  | "session_completed"
  | "weight_trend_kg"
  | "adherence_pct";

/**
 * A delivery strategy — the bandit's ARM.
 *
 * Arms are HOW and WHETHER to say something, never WHAT: the engines already
 * decide the content. That separation is the product insight. It's also why
 * `silence` is in here — see ./bandit.ts.
 */
export type ArmId =
  | "nudge:direct"
  | "nudge:gentle"
  | "nudge:question"
  | "nudge:celebrate"
  | "nudge:silence";

export const ALL_ARMS: ArmId[] = [
  "nudge:direct",
  "nudge:gentle",
  "nudge:question",
  "nudge:celebrate",
  "nudge:silence",
];

/** Discretized state at issue time — the bandit's CONTEXT. */
export type ContextKey = string;

export interface ContextDimensions {
  goal: "lose" | "gain" | "maintain";
  adherence: "low" | "mid" | "high";
  recovery: "green" | "amber" | "red";
  daytype: "weekday" | "weekend";
}

/**
 * One piece of advice, as a falsifiable record.
 *
 * The `prediction` is written at ISSUE time, before we know how it turns out.
 * That ordering is the whole point — a prediction recorded after the fact is
 * just a description.
 */
export interface Recommendation {
  id: string;
  issuedAt: number;
  /** Local YYYY-MM-DD the advice was given for. */
  issuedOn: string;
  arm: ArmId;
  context: ContextKey;
  /** What we told them, structured so it can be replayed and compared. */
  action: { kind: string; params: Record<string, number | string> };
  prediction: {
    metric: MetricId;
    direction: "up" | "down" | "hold";
    /** Expected magnitude in the metric's own units. Optional. */
    magnitude?: number;
    horizonDays: number;
  };
  /** Written by the resolver once the horizon closes. */
  outcome?: RecommendationOutcome;
}

/**
 * The two-way split is the whole game — a recommendation can fail in two ways
 * that demand OPPOSITE responses:
 *
 *   adhered = false   The ask was wrong: too big, wrong moment, wrong tone.
 *                     → change HOW you ask. (The bandit's job.)
 *   adhered = true,
 *   but no effect     The model of this user is wrong.
 *                     → change WHAT you ask for. (The Kalman/FF models' job.)
 *
 * Collapsing these into one "did it work" bit is why most coaching apps
 * plateau: they keep re-tuning the delivery of advice that was never going to
 * work, or keep changing advice that the user simply never followed.
 */
export interface RecommendationOutcome {
  observedAt: number;
  /** Did they DO it? */
  adhered: boolean;
  /** Did it WORK? Signed change in the metric over the horizon. */
  metricDelta: number;
  /** adhered AND the direction matched. The bandit's reward. */
  success: boolean;
}

/**
 * Reads an observed metric over a closed date range. Injected so the ledger
 * stays a pure function over the event store and is trivially testable — the
 * real implementation reads the health-os timeline.
 *
 * Returns null when there's no data for the window, which the resolver treats
 * as "can't judge yet", never as zero.
 */
export type MetricReader = (
  metric: MetricId,
  fromDate: string,
  toDate: string,
) => number | null;

// ════════════════════════════════════════════════════════════════
// Bandit
// ════════════════════════════════════════════════════════════════

/** Beta(α, β) posterior over one arm's success probability in one context. */
export interface ArmPosterior {
  alpha: number;
  beta: number;
}

export interface PosteriorStore {
  get(ctx: ContextKey, arm: ArmId): ArmPosterior | undefined;
  set(ctx: ContextKey, arm: ArmId, p: ArmPosterior): void;
  entries(): [string, ArmPosterior][];
}

// ════════════════════════════════════════════════════════════════
// Adaptive TDEE (Kalman)
// ════════════════════════════════════════════════════════════════

export interface KalmanState {
  /** Filtered true weight, kg. */
  w: number;
  /** Filtered true TDEE, kcal/day. */
  e: number;
  /** 2×2 error covariance, row-major. */
  P: [[number, number], [number, number]];
  /** Days stepped — gates when the learned value is safe to show. */
  days: number;
  /** Days where a real scale reading was available. */
  observations: number;
}

// ════════════════════════════════════════════════════════════════
// Fitness–Fatigue
// ════════════════════════════════════════════════════════════════

export interface FitnessFatigueParams {
  /** Fitness decay constant, days. Population ≈ 42. */
  tau1: number;
  /** Fatigue decay constant, days. Population ≈ 7. */
  tau2: number;
  /** Fitness gain. */
  k1: number;
  /** Fatigue gain. Population ≈ 2 — fatigue hits harder but fades faster. */
  k2: number;
  /** Baseline performance. */
  p0: number;
}

/** One day of training load. */
export interface TrainingLoad {
  date: string;
  /** duration × intensity. Zero on rest days. */
  load: number;
}
