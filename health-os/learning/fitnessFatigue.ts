/**
 * health-os/learning/fitnessFatigue.ts — the Banister impulse-response model.
 *
 * The training-side analogue of the Kalman TDEE filter, and well-established
 * sports science rather than something invented here:
 *
 *   Performance(t) = p₀ + k₁·Fitness(t) − k₂·Fatigue(t)
 *   Fitness(t) = Σᵢ wᵢ·e^(−(t−i)/τ₁),   τ₁ ≈ 42 days
 *   Fatigue(t) = Σᵢ wᵢ·e^(−(t−i)/τ₂),   τ₂ ≈  7 days
 *
 * wᵢ is session training load — duration × intensity, which sessionHistory
 * already carries. The shape of the model is the insight: the SAME session adds
 * to both fitness and fatigue, but fatigue is larger (k₂ > k₁) and decays much
 * faster (τ₂ ≪ τ₁). That's why a hard block feels awful and then, a week later,
 * feels like a personal best.
 *
 * THE PAYOFF: `computeRecovery` stops being a heuristic and becomes a fitted
 * personal model. Fast recoverers get pushed, slow recoverers get protected —
 * same input, individualised output. That is learning you can put on a chart.
 */

import type { FitnessFatigueParams, TrainingLoad } from "./types";
import { parseLocalDate } from "../platform/clock";

/** Population defaults. Every user starts here and is fitted away from it. */
export const POPULATION_PARAMS: FitnessFatigueParams = {
  tau1: 42,
  tau2: 7,
  k1: 1,
  k2: 2,
  p0: 0,
};

/** Below this many sessions, a personal fit overfits — stay on population. */
export const MIN_SESSIONS_TO_FIT = 24;

/** Bounds keep the optimiser in physiologically sane territory. */
const BOUNDS: Record<keyof FitnessFatigueParams, [number, number]> = {
  tau1: [20, 70],
  tau2: [3, 16],
  k1: [0.1, 4],
  k2: [0.1, 6],
  p0: [-50, 150],
};

const dayIndex = (from: string, to: string) =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400_000);

/**
 * Fitness and fatigue on a given day, from all prior loads.
 *
 * Same-day load is excluded: today's session cannot have contributed to the
 * state you were in when you started it.
 */
export function componentsOn(
  loads: TrainingLoad[],
  onDate: string,
  params: FitnessFatigueParams,
): { fitness: number; fatigue: number } {
  let fitness = 0;
  let fatigue = 0;
  for (const l of loads) {
    if (l.load <= 0) continue;
    const age = dayIndex(l.date, onDate);
    if (age <= 0) continue;
    fitness += l.load * Math.exp(-age / params.tau1);
    fatigue += l.load * Math.exp(-age / params.tau2);
  }
  return { fitness, fatigue };
}

/** Modelled performance on a date. */
export function performanceOn(
  loads: TrainingLoad[],
  onDate: string,
  params: FitnessFatigueParams,
): number {
  const { fitness, fatigue } = componentsOn(loads, onDate, params);
  return params.p0 + params.k1 * fitness - params.k2 * fatigue;
}

/**
 * Readiness on a 0–100 scale, from the fitted model.
 *
 * Normalised against the user's own recent performance range rather than an
 * absolute scale, because the raw units are arbitrary — what matters is where
 * today sits relative to what this person can normally do.
 */
export function readinessOn(
  loads: TrainingLoad[],
  onDate: string,
  params: FitnessFatigueParams,
): number {
  const today = performanceOn(loads, onDate, params);
  const window: number[] = [];
  for (let back = 1; back <= 28; back++) {
    const d = parseLocalDate(onDate);
    d.setDate(d.getDate() - back);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    window.push(performanceOn(loads, iso, params));
  }
  const lo = Math.min(...window, today);
  const hi = Math.max(...window, today);
  if (hi - lo < 1e-6) return 70; // flat history — no signal, stay neutral
  return Math.round(((today - lo) / (hi - lo)) * 100);
}

// ── Fitting ────────────────────────────────────────────────────────

export interface PerformanceObservation {
  date: string;
  /** An observed marker: session RPE inverted, completion rate, load lifted. */
  value: number;
}

const ORDER: (keyof FitnessFatigueParams)[] = ["tau1", "tau2", "k1", "k2", "p0"];

function toVector(p: FitnessFatigueParams): number[] {
  return ORDER.map((k) => p[k]);
}

function fromVector(v: number[]): FitnessFatigueParams {
  const out = { ...POPULATION_PARAMS };
  ORDER.forEach((k, i) => {
    const [lo, hi] = BOUNDS[k];
    out[k] = Math.min(hi, Math.max(lo, v[i]));
  });
  // τ₂ < τ₁ is physiology, not a preference: fatigue must decay faster than
  // fitness or the model describes something that isn't training.
  if (out.tau2 >= out.tau1) out.tau2 = Math.max(BOUNDS.tau2[0], out.tau1 * 0.3);
  return out;
}

/** Mean squared error of the model against observed markers. */
export function residual(
  loads: TrainingLoad[],
  observations: PerformanceObservation[],
  params: FitnessFatigueParams,
): number {
  if (observations.length === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (const o of observations) {
    const predicted = performanceOn(loads, o.date, params);
    const diff = predicted - o.value;
    sum += diff * diff;
  }
  return sum / observations.length;
}

/**
 * Flattened (observation × load) age/weight pairs.
 *
 * The optimiser evaluates the objective a few thousand times, and a naive
 * implementation re-parses every date on every evaluation — which turned a
 * millisecond fit into a five-second one. Ages don't depend on the parameters,
 * so they're computed ONCE and the inner loop becomes pure arithmetic.
 */
interface AgeMatrix {
  /** For each observation: parallel arrays of load age (days) and load size. */
  rows: { ages: Float64Array; weights: Float64Array; target: number }[];
}

function buildAgeMatrix(
  loads: TrainingLoad[],
  observations: PerformanceObservation[],
): AgeMatrix {
  const active = loads.filter((l) => l.load > 0);
  const loadTimes = active.map((l) => parseLocalDate(l.date).getTime());
  const loadSizes = active.map((l) => l.load);

  const rows = observations.map((o) => {
    const at = parseLocalDate(o.date).getTime();
    const ages: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i < active.length; i++) {
      const age = Math.round((at - loadTimes[i]) / 86400_000);
      if (age <= 0) continue; // same-day load didn't cause today's state
      ages.push(age);
      weights.push(loadSizes[i]);
    }
    return {
      ages: Float64Array.from(ages),
      weights: Float64Array.from(weights),
      target: o.value,
    };
  });

  return { rows };
}

function residualFast(matrix: AgeMatrix, p: FitnessFatigueParams): number {
  if (matrix.rows.length === 0) return Number.POSITIVE_INFINITY;
  const invTau1 = -1 / p.tau1;
  const invTau2 = -1 / p.tau2;
  let sum = 0;
  for (const row of matrix.rows) {
    let fitness = 0;
    let fatigue = 0;
    for (let i = 0; i < row.ages.length; i++) {
      const age = row.ages[i];
      const w = row.weights[i];
      fitness += w * Math.exp(age * invTau1);
      fatigue += w * Math.exp(age * invTau2);
    }
    const diff = p.p0 + p.k1 * fitness - p.k2 * fatigue - row.target;
    sum += diff * diff;
  }
  return sum / matrix.rows.length;
}

/**
 * Bounded Nelder–Mead over the five parameters.
 *
 * Derivative-free, no dependencies, and on ~60 observations it converges in
 * milliseconds on-device — which is the whole reason this is feasible per-user
 * rather than as a server-side batch job.
 */
export function fitParams(
  loads: TrainingLoad[],
  observations: PerformanceObservation[],
  start: FitnessFatigueParams = POPULATION_PARAMS,
  maxIterations = 300,
): FitnessFatigueParams {
  if (observations.length < MIN_SESSIONS_TO_FIT) return start;

  // Ages are parameter-independent — compute them once, then the objective is
  // pure arithmetic. This is the difference between a millisecond fit and a
  // five-second one, and it's what makes a nightly on-device refit realistic.
  const matrix = buildAgeMatrix(loads, observations);
  const objective = (v: number[]) => residualFast(matrix, fromVector(v));
  const n = ORDER.length;

  // Initial simplex: the start point plus one perturbation per dimension.
  const simplex: number[][] = [toVector(start)];
  for (let i = 0; i < n; i++) {
    const point = [...simplex[0]];
    const [lo, hi] = BOUNDS[ORDER[i]];
    const nudge = (hi - lo) * 0.15;
    point[i] = Math.min(hi, point[i] + nudge);
    simplex.push(point);
  }

  let values = simplex.map(objective);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Order by fitness.
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    const best = simplex[order[0]];
    const worstIdx = order[n];
    const worst = simplex[worstIdx];
    const secondWorst = values[order[n - 1]];

    // Converged.
    if (Math.abs(values[order[n]] - values[order[0]]) < 1e-9) break;

    // Centroid of everything but the worst.
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < n; d++) centroid[d] += simplex[order[i]][d] / n;
    }

    /** centroid + t·(centroid − worst): t=1 reflect, 2 expand, −0.5 contract. */
    const combine = (t: number) => centroid.map((c, i) => c + t * (c - worst[i]));

    const reflected = combine(1);
    const fReflected = objective(reflected);

    if (fReflected < values[order[0]]) {
      const expanded = combine(2);
      const fExpanded = objective(expanded);
      simplex[worstIdx] = fExpanded < fReflected ? expanded : reflected;
      values[worstIdx] = Math.min(fExpanded, fReflected);
    } else if (fReflected < secondWorst) {
      simplex[worstIdx] = reflected;
      values[worstIdx] = fReflected;
    } else {
      const contracted = combine(-0.5);
      const fContracted = objective(contracted);
      if (fContracted < values[worstIdx]) {
        simplex[worstIdx] = contracted;
        values[worstIdx] = fContracted;
      } else {
        // Shrink toward the best point.
        for (let i = 1; i <= n; i++) {
          const idx = order[i];
          simplex[idx] = simplex[idx].map((x, d) => best[d] + 0.5 * (x - best[d]));
        }
        values = simplex.map(objective);
      }
    }
  }

  const bestIdx = values.indexOf(Math.min(...values));
  return fromVector(simplex[bestIdx]);
}
