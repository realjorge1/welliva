/**
 * health-os/learning/tdee.ts — adaptive TDEE via a two-state Kalman filter.
 *
 * Mifflin–St Jeor is a POPULATION estimate with roughly ±20% individual
 * variance, and it is static — it cannot see adaptive thermogenesis, so it
 * drifts further from the truth exactly when a user is deepest into a cut.
 * Every serious user eventually notices "the app's number is wrong for me",
 * and they're usually right.
 *
 * We can learn their real maintenance from data already being collected.
 *
 *   state       x = [w, e]      true weight (kg), true TDEE (kcal/day)
 *   dynamics    w_{t+1} = w_t + (I_t − e_t) / 7700
 *               e_{t+1} = e_t + drift        ← random walk = adaptive thermogenesis
 *   observation scale weight, H = [1, 0], R = σ² with σ ≈ 0.5 kg
 *
 * σ is large on purpose: day-to-day scale noise from water, glycogen and gut
 * content genuinely is around half a kilo. That is precisely why naive
 * week-over-week deltas mislead users, and why the filter beats them.
 *
 * MISSING DAYS NEED NO SPECIAL HANDLING — skip the update step and the predict
 * step still runs. That matters enormously for real users, who log
 * inconsistently, and it's the main reason a filter beats a regression here.
 */

import type { KalmanState } from "./types";

/** kcal per kg of body mass. The standard energy-balance constant. */
const KCAL_PER_KG = 7700;

/** Process noise: how much true weight can drift unexplained, per day (kg²). */
const Q_WEIGHT = 0.01;
/**
 * Process noise on TDEE (kcal²/day). This is the adaptive-thermogenesis term —
 * set it to zero and the filter assumes metabolism is fixed, which is the exact
 * error we're correcting. ~4 lets it move ~2 kcal/day, ~60 kcal over a month.
 */
const Q_TDEE = 4;

/** Observation noise: daily scale reading variance (kg²). σ = 0.5 kg. */
const R_SCALE = 0.25;

/** Initial uncertainty. σ_w = 1 kg; σ_e = 300 kcal ≈ Mifflin's real error bar. */
const P0_WEIGHT = 1;
const P0_TDEE = 300 * 300;

/**
 * Gate for surfacing the learned number. Both must hold:
 * enough paired observations, and the filter actually confident.
 *
 * "I've watched you for three weeks — your actual maintenance looks closer to
 * 2,340 than the 2,180 I estimated at signup" is the single most
 * credibility-building sentence this product can produce. Said too early it's
 * noise, and it burns the credibility instead of building it.
 */
const MIN_OBSERVATIONS = 14;
const MAX_TDEE_SD = 120; // kcal/day

export function initKalman(weightKg: number, mifflinTdee: number): KalmanState {
  return {
    w: weightKg,
    e: mifflinTdee,
    P: [
      [P0_WEIGHT, 0],
      [0, P0_TDEE],
    ],
    days: 0,
    observations: 0,
  };
}

/**
 * Advance one day.
 *
 * @param intakeKcal logged intake, or null if they didn't log
 * @param scaleKg    scale reading, or null if they didn't weigh in
 */
export function step(
  state: KalmanState,
  intakeKcal: number | null,
  scaleKg: number | null,
): KalmanState {
  const f = -1 / KCAL_PER_KG; // ∂w_{t+1} / ∂e_t
  let { w, e } = state;
  const [[p00, p01], [p10, p11]] = state.P;

  // ── PREDICT — always runs, even with no data at all ──
  if (intakeKcal !== null) {
    w += (intakeKcal - e) / KCAL_PER_KG;
  }

  // P ← F P Fᵀ + Q, with F = [[1, f], [0, 1]]
  const n00 = p00 + f * p10 + f * p01 + f * f * p11 + Q_WEIGHT;
  const n01 = p01 + f * p11;
  const n10 = p10 + f * p11;
  const n11 = p11 + Q_TDEE;

  let P: KalmanState["P"] = [
    [n00, n01],
    [n10, n11],
  ];
  let observations = state.observations;

  // ── UPDATE — only when they actually weighed in ──
  if (scaleKg !== null) {
    const innovationVar = P[0][0] + R_SCALE;
    const k0 = P[0][0] / innovationVar;
    const k1 = P[1][0] / innovationVar;
    const innovation = scaleKg - w;

    w += k0 * innovation;
    e += k1 * innovation;

    // P ← (I − K H) P, H = [1, 0]
    P = [
      [(1 - k0) * P[0][0], (1 - k0) * P[0][1]],
      [P[1][0] - k1 * P[0][0], P[1][1] - k1 * P[0][1]],
    ];
    observations++;
  }

  return { w, e, P, days: state.days + 1, observations };
}

/** Replay a whole history. Days are consumed in order; gaps are fine. */
export function runFilter(
  initial: KalmanState,
  days: { intakeKcal: number | null; scaleKg: number | null }[],
): KalmanState {
  return days.reduce((s, d) => step(s, d.intakeKcal, d.scaleKg), initial);
}

export interface TdeeReading {
  /** The filter's current estimate, kcal/day. Always safe to use for TARGETS. */
  learnedTdee: number;
  /** Standard deviation of that estimate, kcal/day. */
  uncertainty: number;
  /** Filtered weight, kg — smoother and more honest than the last reading. */
  filteredWeightKg: number;
  /**
   * Whether the estimate is solid enough to SAY OUT LOUD. Below this, show the
   * Mifflin figure instead.
   */
  confident: boolean;
  observations: number;
}

export function read(state: KalmanState): TdeeReading {
  const uncertainty = Math.sqrt(Math.max(0, state.P[1][1]));
  return {
    learnedTdee: Math.round(state.e),
    uncertainty: Math.round(uncertainty),
    filteredWeightKg: Number(state.w.toFixed(2)),
    confident: state.observations >= MIN_OBSERVATIONS && uncertainty <= MAX_TDEE_SD,
    observations: state.observations,
  };
}

/**
 * ⚠️  UNDER-REPORTING IS REAL AND LARGE.
 *
 * Free-living intake logs run 20–30% under actual. The filter absorbs that into
 * a LOWER learned `e` — which is self-consistent and correct for prediction
 * (targets derived from it will produce the intended weight change, because the
 * same under-reporting applies going forward).
 *
 * But it is WRONG to display as physiology. "Your metabolism is 1,850 kcal" is
 * a claim about their body; the filter's number is a claim about their body AND
 * their logging habits, entangled. Use it to drive targets; never present it as
 * a measured physiological fact.
 *
 * This helper exists so the distinction is enforced at the call site rather than
 * left to whoever writes the copy.
 */
export function tdeeForTargets(state: KalmanState, mifflinFallback: number): number {
  const r = read(state);
  return r.confident ? r.learnedTdee : mifflinFallback;
}

/**
 * Phrase the learned figure honestly for display. Returns null until confident,
 * so there is no way to render a premature number by accident.
 */
export function tdeeDisclosure(
  state: KalmanState,
  mifflinEstimate: number,
): string | null {
  const r = read(state);
  if (!r.confident) return null;
  const diff = r.learnedTdee - mifflinEstimate;
  if (Math.abs(diff) < 75) return null; // not different enough to be worth saying
  const weeks = Math.floor(r.observations / 7);
  return (
    `I've been tracking you for ${weeks} weeks. Based on what you've eaten and how your ` +
    `weight has actually moved, your maintenance looks closer to ${r.learnedTdee} than the ` +
    `${mifflinEstimate} I estimated at signup — so I've been aiming at the real number.`
  );
}
