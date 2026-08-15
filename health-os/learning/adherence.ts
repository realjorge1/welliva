/**
 * health-os/learning/adherence.ts — will they complete tomorrow's session?
 *
 *   P(completes) = σ(β·x)
 *
 * Logistic regression, on-device, ~10 features, fitted by SGD over the user's
 * own history with β initialised from population weights. 200 samples × 10
 * features retrains in microseconds, so it can run nightly.
 *
 * TWO USES, and the first is the one that matters:
 *
 *   1. P < 0.35 → SHRINK TOMORROW'S ASK BEFORE THEY FAIL. A coach who prevents
 *      the miss beats one who comments on it afterwards. This is the difference
 *      between a tracker and a companion.
 *   2. Feed P into the bandit's context, so arm selection knows whether it's
 *      talking to someone who is about to lapse.
 *
 * EVALUATE WITH AUC AND CALIBRATION, NOT ACCURACY. The base rate is skewed —
 * most planned sessions get done — so a model that always predicts "yes" scores
 * ~75% accuracy while being completely useless for the only decision we care
 * about. See {@link auc} and {@link calibrationError}.
 */

export interface AdherenceFeatures {
  /** 0–1 completion rate over the last 7 days. */
  recentCompletion7d: number;
  /** 0–6, Sunday = 0. One-hot expanded internally. */
  dayOfWeek: number;
  /** Hours slept last night, or null when unknown. */
  sleepHours: number | null;
  /** 0–1 how busy tomorrow's calendar is. */
  calendarLoad: number;
  /** 0–1 how adverse the weather is. */
  weatherAdversity: number;
  /** Days since the last completed session. */
  daysSinceLastSession: number;
  /** 0–100 recovery score. */
  recoveryScore: number;
  /** Current streak length in days. */
  streak: number;
}

/** Feature vector layout. Index 0 is the bias term. */
const FEATURE_COUNT = 1 + 7 + 7; // bias + day-of-week one-hot + 7 numeric

export interface LogisticModel {
  /** Weights, length FEATURE_COUNT. */
  beta: number[];
  /** How many samples this has been fitted on — gates trusting it. */
  samples: number;
}

/**
 * Population starting point. Signs encode what's known about adherence
 * generally: recent consistency and streaks help, a long gap and a heavy
 * calendar hurt. The user's own data moves these; they're a prior, not a claim.
 */
export function populationModel(): LogisticModel {
  const beta = new Array(FEATURE_COUNT).fill(0);
  beta[0] = 0.9; // bias — most planned sessions do get done
  // Day-of-week one-hot (indices 1–7, Sun…Sat) starts neutral and is learned.
  beta[8] = 2.2; // recentCompletion7d
  beta[9] = 0.15; // sleepHours (centred)
  beta[10] = -0.8; // calendarLoad
  beta[11] = -0.5; // weatherAdversity
  beta[12] = -0.25; // daysSinceLastSession
  beta[13] = 0.012; // recoveryScore
  beta[14] = 0.05; // streak
  return { beta, samples: 0 };
}

/** Build the feature vector. Numerics are centred/scaled so SGD behaves. */
export function vectorize(f: AdherenceFeatures): number[] {
  const x = new Array(FEATURE_COUNT).fill(0);
  x[0] = 1;
  const dow = Math.max(0, Math.min(6, Math.round(f.dayOfWeek)));
  x[1 + dow] = 1;
  x[8] = f.recentCompletion7d;
  // Missing sleep must not read as "zero hours" — centre it on a typical night.
  x[9] = ((f.sleepHours ?? 7.5) - 7.5) / 2;
  x[10] = f.calendarLoad;
  x[11] = f.weatherAdversity;
  x[12] = Math.min(f.daysSinceLastSession, 14) / 7;
  x[13] = (f.recoveryScore - 50) / 50;
  x[14] = Math.min(f.streak, 30) / 30;
  return x;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predict(model: LogisticModel, features: AdherenceFeatures): number {
  const x = vectorize(features);
  let z = 0;
  for (let i = 0; i < FEATURE_COUNT; i++) z += model.beta[i] * x[i];
  return sigmoid(z);
}

export interface TrainingSample {
  features: AdherenceFeatures;
  /** Did they actually complete it? */
  completed: boolean;
}

/**
 * Fit by SGD with L2 regularisation.
 *
 * Regularisation is not optional here: with 15 weights and possibly only 60
 * samples, an unregularised fit will happily conclude that this user never
 * trains on Tuesdays because of one missed Tuesday.
 */
export function fit(
  samples: TrainingSample[],
  start: LogisticModel = populationModel(),
  opts: { epochs?: number; learningRate?: number; l2?: number } = {},
): LogisticModel {
  const epochs = opts.epochs ?? 40;
  const lr = opts.learningRate ?? 0.08;
  const l2 = opts.l2 ?? 0.02;
  if (samples.length === 0) return start;

  const beta = [...start.beta];
  const rows = samples.map((s) => ({ x: vectorize(s.features), y: s.completed ? 1 : 0 }));

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const row of rows) {
      let z = 0;
      for (let i = 0; i < FEATURE_COUNT; i++) z += beta[i] * row.x[i];
      const error = sigmoid(z) - row.y;
      for (let i = 0; i < FEATURE_COUNT; i++) {
        // The bias is never regularised — shrinking it just biases the base rate.
        const penalty = i === 0 ? 0 : l2 * beta[i];
        beta[i] -= lr * (error * row.x[i] + penalty);
      }
    }
  }

  return { beta, samples: samples.length };
}

// ── Decisions ──────────────────────────────────────────────────────

/** Below this, intervene before the miss instead of commenting after it. */
export const AT_RISK_THRESHOLD = 0.35;

export type AdherenceAction =
  | { kind: "proceed" }
  | { kind: "shrink"; /** 0–1 multiplier for tomorrow's ask. */ scale: number; reason: string };

/**
 * Turn a probability into a decision.
 *
 * Shrinking is deliberately gentle — the goal is to keep the streak and the
 * identity intact, not to hit a training stimulus. A completed 12-minute
 * session beats a skipped 45-minute one on every horizon that matters.
 */
export function decide(probability: number, model: LogisticModel): AdherenceAction {
  // An unfitted model predicting doom is the prior talking, not the user.
  if (model.samples < 20) return { kind: "proceed" };
  if (probability >= AT_RISK_THRESHOLD) return { kind: "proceed" };
  const scale = probability < 0.2 ? 0.4 : 0.65;
  return {
    kind: "shrink",
    scale,
    reason:
      "Tomorrow looks like a day this usually slips. Shrinking the ask so it still happens.",
  };
}

// ── Evaluation ─────────────────────────────────────────────────────

/**
 * Area under the ROC curve, by rank comparison over all positive/negative
 * pairs. 0.5 is a coin flip; anything below means the model is worse than
 * nothing and must not be allowed to shrink anyone's session.
 */
export function auc(predictions: number[], labels: boolean[]): number {
  const pos = predictions.filter((_, i) => labels[i]);
  const neg = predictions.filter((_, i) => !labels[i]);
  if (pos.length === 0 || neg.length === 0) return 0.5;
  let wins = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (pos.length * neg.length);
}

/**
 * Expected calibration error over `bins` equal-width buckets.
 *
 * Calibration is what licenses the threshold: if the model says 0.35 it must be
 * right about 35% of the time, or AT_RISK_THRESHOLD means nothing and we shrink
 * sessions for people who were going to show up.
 */
export function calibrationError(
  predictions: number[],
  labels: boolean[],
  bins = 10,
): number {
  const buckets: { sum: number; hits: number; count: number }[] = Array.from(
    { length: bins },
    () => ({ sum: 0, hits: 0, count: 0 }),
  );
  for (let i = 0; i < predictions.length; i++) {
    const idx = Math.min(bins - 1, Math.floor(predictions[i] * bins));
    buckets[idx].sum += predictions[i];
    buckets[idx].hits += labels[i] ? 1 : 0;
    buckets[idx].count++;
  }
  let error = 0;
  for (const b of buckets) {
    if (b.count === 0) continue;
    error += (b.count / predictions.length) * Math.abs(b.hits / b.count - b.sum / b.count);
  }
  return error;
}
