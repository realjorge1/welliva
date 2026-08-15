/**
 * health-os/learning/bandit.ts — contextual Thompson sampling.
 *
 * WHY A BANDIT AND NOT A NEURAL NET: one user, sparse data, and a standing need
 * to keep exploring. Thompson sampling on Beta posteriors converges fast on
 * small data, needs no training infrastructure, is a couple of hundred lines,
 * and runs on-device in microseconds. A network would need more data than a
 * single user will ever produce, and would stop exploring.
 *
 * Exploration here is FREE: it falls out of sampling the posterior rather than
 * being bolted on as an ε-greedy hack. An arm we're uncertain about has a wide
 * posterior, so it occasionally draws high and gets tried — exactly as often as
 * the uncertainty justifies, and less often as evidence accumulates.
 *
 * WHAT THE ARMS ARE: how and whether to speak, never what to say. The engines
 * decide content; this decides delivery. Which is what makes `silence` possible.
 */

import type { ArmId, ArmPosterior, ContextKey, PosteriorStore } from "./types";
import { ALL_ARMS } from "./types";

/**
 * Population prior — what works for people in general, before we know anything
 * about this person.
 *
 * Pseudo-counts are LOW (α+β ≈ 4) on purpose. That's partial pooling: the new
 * user starts at the cohort's behaviour, and their own evidence dominates
 * within roughly 20 observations. That arc — generic coach becoming *their*
 * coach — is the product promise, and because the prior is explicit you can
 * actually chart the transition (see {@link divergenceFromPrior}).
 */
export const POPULATION_PRIOR: Record<ArmId, ArmPosterior> = {
  "nudge:direct": { alpha: 2.2, beta: 1.8 },
  "nudge:gentle": { alpha: 2.0, beta: 2.0 },
  "nudge:question": { alpha: 1.8, beta: 2.2 },
  "nudge:celebrate": { alpha: 2.1, beta: 1.9 },
  // Silence starts pessimistic — most of the time a coach should say something.
  // The point is that it CAN be learned, not that it's assumed.
  "nudge:silence": { alpha: 1.2, beta: 2.8 },
};

// ── Sampling ───────────────────────────────────────────────────────

/**
 * Deterministic RNG seam. Real use gets Math.random; the replay harness gets a
 * seeded generator so regret curves are reproducible.
 */
export type Rng = () => number;

/**
 * Gamma(shape, 1) via Marsaglia–Tsang. Handles shape < 1 by the standard
 * boost, so priors with α < 1 stay valid.
 */
export function sampleGamma(shape: number, rng: Rng = Math.random): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, rng) * Math.pow(rng(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = gaussian(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Box–Muller standard normal. */
function gaussian(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Beta(a, b) as the ratio of two Gammas. */
export function sampleBeta(a: number, b: number, rng: Rng = Math.random): number {
  const x = sampleGamma(a, rng);
  const y = sampleGamma(b, rng);
  const total = x + y;
  return total === 0 ? 0.5 : x / total;
}

// ── The store ──────────────────────────────────────────────────────

/** Plain in-memory posterior store. Serializes to a flat record for storage. */
export function createPosteriorStore(
  initial: Record<string, ArmPosterior> = {},
): PosteriorStore & { toJSON(): Record<string, ArmPosterior> } {
  const map = new Map<string, ArmPosterior>(Object.entries(initial));
  const cell = (ctx: ContextKey, arm: ArmId) => `${ctx}#${arm}`;
  return {
    get: (ctx, arm) => map.get(cell(ctx, arm)),
    set: (ctx, arm, p) => void map.set(cell(ctx, arm), p),
    entries: () => [...map.entries()],
    toJSON: () => Object.fromEntries(map),
  };
}

function posteriorFor(
  store: PosteriorStore,
  ctx: ContextKey,
  arm: ArmId,
): ArmPosterior {
  return store.get(ctx, arm) ?? { ...(POPULATION_PRIOR[arm] ?? { alpha: 1, beta: 1 }) };
}

// ── Selection & update ─────────────────────────────────────────────

/**
 * Draw one sample per arm and take the argmax. That single line is the whole
 * exploration policy: an arm is chosen in proportion to the probability it is
 * genuinely the best, given everything seen so far.
 */
export function selectArm(
  ctx: ContextKey,
  arms: ArmId[] = ALL_ARMS,
  store: PosteriorStore,
  rng: Rng = Math.random,
): ArmId {
  let best = arms[0];
  let bestDraw = -1;
  for (const arm of arms) {
    const p = posteriorFor(store, ctx, arm);
    const draw = sampleBeta(p.alpha, p.beta, rng);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = arm;
    }
  }
  return best;
}

/** Fold one observed outcome into the posterior. */
export function update(
  ctx: ContextKey,
  arm: ArmId,
  success: boolean,
  store: PosteriorStore,
): void {
  const p = posteriorFor(store, ctx, arm);
  const next = success
    ? { alpha: p.alpha + 1, beta: p.beta }
    : { alpha: p.alpha, beta: p.beta + 1 };
  store.set(ctx, arm, next);
}

/** Posterior mean — the current best estimate of an arm's success rate. */
export function armMean(p: ArmPosterior): number {
  return p.alpha / (p.alpha + p.beta);
}

/**
 * How far this user's learned preferences have moved from the population.
 *
 * Mean KL divergence between each Beta posterior and its prior, over contexts
 * with real evidence. Plotted over time this is the "coach → companion" arc as
 * a measurable curve, which is exactly the kind of artifact that turns a claim
 * into a demonstration.
 */
export function divergenceFromPrior(store: PosteriorStore): number {
  let total = 0;
  let counted = 0;
  for (const [key, posterior] of store.entries()) {
    const arm = key.slice(key.indexOf("#") + 1) as ArmId;
    const prior = POPULATION_PRIOR[arm];
    if (!prior) continue;
    // No evidence in this cell yet — it IS the prior, contributing nothing.
    if (posterior.alpha === prior.alpha && posterior.beta === prior.beta) continue;
    total += betaKL(posterior, prior);
    counted++;
  }
  return counted === 0 ? 0 : total / counted;
}

/** KL(P‖Q) for two Beta distributions. */
function betaKL(p: ArmPosterior, q: ArmPosterior): number {
  return (
    lnBeta(q.alpha, q.beta) -
    lnBeta(p.alpha, p.beta) +
    (p.alpha - q.alpha) * digamma(p.alpha) +
    (p.beta - q.beta) * digamma(p.beta) +
    (q.alpha - p.alpha + q.beta - p.beta) * digamma(p.alpha + p.beta)
  );
}

const lnBeta = (a: number, b: number) => lnGamma(a) + lnGamma(b) - lnGamma(a + b);

/** Lanczos approximation. */
function lnGamma(x: number): number {
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Digamma via recurrence + asymptotic series. */
function digamma(x: number): number {
  let result = 0;
  let v = x;
  while (v < 6) {
    result -= 1 / v;
    v++;
  }
  const inv = 1 / v;
  const inv2 = inv * inv;
  return (
    result +
    Math.log(v) -
    0.5 * inv -
    inv2 * (1 / 12 - inv2 * (1 / 120 - inv2 / 252))
  );
}

// ── Silence ────────────────────────────────────────────────────────

/**
 * Why silence is an arm.
 *
 * Every coaching app over-communicates, and the reason is structural rather
 * than editorial: silence is never in the action space, so it can never be
 * selected, so it can never be shown to be better. Put it in and the bandit can
 * discover that for THIS user, on a red-recovery Sunday, the highest-reward
 * action is to say nothing at all.
 *
 * The reward has to be defined carefully or silence looks free and takes over:
 *
 *   reward 1  they self-corrected without being prompted
 *   reward 0  the behaviour degraded
 *
 * So silence is only reinforced when it was genuinely the right call, not
 * merely when it was cheap.
 */
export function silenceReward(behaviourImproved: boolean): boolean {
  return behaviourImproved;
}
