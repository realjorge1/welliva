/**
 * health-os/learning/engine.ts — where the closed loop actually closes.
 *
 * Everything else in this folder is a pure model with no idea where its data
 * comes from. That was the right way to build them (they're testable in
 * milliseconds and the replay harness drives 180 simulated days through them),
 * but it also meant the whole folder was imported by nothing but its own tests:
 * six well-evaluated models, wired to nothing, learning from no one. This file
 * is the composition root that connects them to the app's real history.
 *
 * THE LOOP, in the order it runs:
 *
 *   issueRecommendation()   a prediction is written BEFORE the outcome is known
 *   runDailyLearning()      the horizon closes → outcomes are scored →
 *                           every parameter is refitted from the full record
 *   readIntelligence()      what the models currently believe, for the UI
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE DAILY JOB REFITS FROM SCRATCH INSTEAD OF UPDATING INCREMENTALLY
 *
 * The bandit's `update()` is an incremental fold, and the obvious wiring is to
 * call it once per newly-resolved outcome. That requires remembering which
 * outcomes have already been folded, and any bug in that bookkeeping —
 * a retried job, a crash between write and cursor-bump, a restored backup —
 * silently double-counts evidence and biases the posteriors permanently, with
 * no way to detect it after the fact.
 *
 * Rebuilding every posterior from the whole ledger on each run is O(ledger)
 * once a day over at most 2,000 records, and it is *idempotent*: running it
 * twice, or ten times, lands on exactly the same numbers. Beta posteriors are
 * conjugate, so prior + counts is mathematically identical to folding one at a
 * time. Same for the Kalman filter, the Banister fit and the logistic model —
 * all of them are pure functions of the history, so the honest implementation
 * is to recompute them.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EVERY NUMBER HERE IS GATED. `readIntelligence` reports a model as confident
 * only when that model's own gate says so (14 paired weigh-ins for the Kalman,
 * `MIN_SESSIONS_TO_FIT` for Banister, 20 samples for the logistic). Below the
 * gate the UI is expected to show the population value and say so. Surfacing a
 * learned number early is worse than not having one — it spends the exact
 * credibility the feature exists to build.
 */

import { parseLocalDate, toLocalDateString } from "../platform/clock";
import { store as defaultStore } from "../platform/storage/AsyncStorageAdapter";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import { K } from "../platform/storage/keys";
import { timeline } from "../timeline";
import type {
  BodyMeasurementPayload,
  CheckinPayload,
  HealthEvent,
  NutritionDayClosedPayload,
  WaterDayClosedPayload,
  WorkoutCompletedPayload,
} from "../timeline";

import {
  AT_RISK_THRESHOLD,
  decide,
  fit as fitAdherence,
  populationModel,
  predict as predictAdherence,
  type AdherenceAction,
  type AdherenceFeatures,
  type LogisticModel,
  type TrainingSample,
} from "./adherence";
import {
  POPULATION_PRIOR,
  armMean,
  createPosteriorStore,
  divergenceFromPrior,
  selectArm,
} from "./bandit";
import { cusumRate, cusum, type ChangePoint } from "./changepoint";
import {
  MIN_SESSIONS_TO_FIT,
  POPULATION_PARAMS,
  fitParams,
  readinessOn,
} from "./fitnessFatigue";
import {
  adherenceBucket,
  dayType,
  encodeContext,
  failureBreakdown,
  loadLedger,
  makeRecommendation,
  recordRecommendation,
  resolveDue,
  successRate,
} from "./ledger";
import { initKalman, read as readKalman, runFilter, tdeeDisclosure } from "./tdee";
import {
  ALL_ARMS,
  type ArmId,
  type ArmPosterior,
  type ContextDimensions,
  type FitnessFatigueParams,
  type KalmanState,
  type MetricId,
  type MetricReader,
  type Recommendation,
  type TrainingLoad,
} from "./types";

/* ════════════════════════════════════════════════════════════════════════
   The daily series — one row per calendar day, assembled from the timeline
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Everything the models need about one day, in one row.
 *
 * `null` means "not observed", never zero. That distinction is the whole reason
 * the Kalman filter beats a week-over-week delta: a day with no weigh-in must
 * skip the update step, not be told the user weighs nothing.
 */
export interface DayRow {
  date: string;
  intakeKcal: number | null;
  weightKg: number | null;
  waterMl: number | null;
  /** 1 when a session was completed, 0 when the day passed without one. */
  sessionCompleted: number;
  /** duration × intensity. Zero on rest days. */
  trainingLoad: number;
  /** Observed performance marker (session completion %), when there was one. */
  performance: number | null;
  /** Meals eaten ÷ meals planned, as a percentage. */
  adherencePct: number | null;
  sleepHours: number | null;
}

function emptyRow(date: string): DayRow {
  return {
    date,
    intakeKcal: null,
    weightKg: null,
    waterMl: null,
    sessionCompleted: 0,
    trainingLoad: 0,
    performance: null,
    adherencePct: null,
    sleepHours: null,
  };
}

/** Every date from `first` to `last` inclusive — including the days with no events. */
function dateRange(first: string, last: string): string[] {
  const out: string[] = [];
  const d = parseLocalDate(first);
  const end = parseLocalDate(last);
  while (d <= end) {
    out.push(toLocalDateString(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Fold the event log into a dense, gap-free daily series.
 *
 * Dense matters: the Kalman filter's predict step has to run on days the user
 * didn't log, or a week of silence collapses into a single day of drift and the
 * filter concludes their metabolism changed overnight.
 */
export function buildSeries(events: HealthEvent[], today: string): DayRow[] {
  if (events.length === 0) return [];

  const byDate = new Map<string, DayRow>();
  const touch = (date: string): DayRow => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const fresh = emptyRow(date);
    byDate.set(date, fresh);
    return fresh;
  };

  for (const e of events) {
    const row = touch(e.localDate);
    switch (e.type) {
      case "nutrition.day.closed": {
        const p = e.payload as NutritionDayClosedPayload;
        if (p.consumedCalories != null) row.intakeKcal = p.consumedCalories;
        if (p.totalMeals > 0) {
          row.adherencePct = (p.mealsConsumed / p.totalMeals) * 100;
        }
        break;
      }
      case "hydration.day.closed": {
        const p = e.payload as WaterDayClosedPayload;
        row.waterMl = p.ml;
        break;
      }
      case "body.measurement.logged": {
        const p = e.payload as BodyMeasurementPayload;
        if (p.weightKg != null) row.weightKg = p.weightKg;
        break;
      }
      case "workout.session.completed": {
        const p = e.payload as WorkoutCompletedPayload;
        row.sessionCompleted = 1;
        // Load is duration × intensity; completion percentage is the only
        // intensity proxy the event carries, and it is a reasonable one — a
        // session abandoned at 40% did roughly 40% of the work.
        row.trainingLoad += p.durationMinutes * (p.completionPercent / 100);
        row.performance = p.completionPercent;
        break;
      }
      case "checkin.logged": {
        const p = e.payload as CheckinPayload;
        if (p.sleepHours != null) row.sleepHours = p.sleepHours;
        break;
      }
      default:
        break;
    }
  }

  const dates = [...byDate.keys()].sort();
  const first = dates[0];
  // Run the series up to today even if the last event is older — the silence
  // since the last log is itself signal, and CUSUM needs to see it.
  const last = today > dates[dates.length - 1] ? today : dates[dates.length - 1];

  return dateRange(first, last).map((date) => byDate.get(date) ?? emptyRow(date));
}

/* ════════════════════════════════════════════════════════════════════════
   The metric reader — how the ledger observes outcomes
   ════════════════════════════════════════════════════════════════════════ */

/**
 * A synchronous reader over an already-loaded series.
 *
 * `MetricReader` is deliberately sync so the ledger stays a pure function; the
 * async work (loading the timeline) happens once, here, and the reader closes
 * over the result.
 *
 * Returns the MEAN over the window, and `null` when the window holds no
 * observation at all — which the resolver treats as "can't judge yet" rather
 * than as zero. A recommendation that can't be judged is left open, not scored
 * as a failure.
 */
export function makeMetricReader(series: DayRow[]): MetricReader {
  const byDate = new Map(series.map((r) => [r.date, r]));
  const dates = series.map((r) => r.date);

  return (metric: MetricId, fromDate: string, toDate: string): number | null => {
    const values: number[] = [];
    for (const date of dates) {
      if (date < fromDate || date > toDate) continue;
      const row = byDate.get(date);
      if (!row) continue;
      const v = readMetric(row, metric);
      if (v !== null) values.push(v);
    }
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };
}

function readMetric(row: DayRow, metric: MetricId): number | null {
  switch (metric) {
    case "calories_kcal":
      return row.intakeKcal;
    case "water_ml":
      return row.waterMl;
    case "weight_trend_kg":
      return row.weightKg;
    case "adherence_pct":
      return row.adherencePct;
    case "session_completed":
      // Always observed: a day that passed without a session is a real zero,
      // not a missing reading. This is the one metric where that's true.
      return row.sessionCompleted;
    case "protein_g":
      // Not carried on any timeline payload yet. Honest null beats a fabricated
      // number — the resolver will leave protein predictions unresolvable
      // rather than score them against a guess.
      return null;
    default:
      return null;
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Persisted learned state
   ════════════════════════════════════════════════════════════════════════ */

export interface LearnedState {
  kalman: KalmanState | null;
  posteriors: Record<string, ArmPosterior>;
  fitness: FitnessFatigueParams;
  adherence: LogisticModel;
}

export async function loadLearnedState(
  store: KeyValueStore = defaultStore,
): Promise<LearnedState> {
  const [kalman, posteriors, fitness, adherence] = await Promise.all([
    store.get<KalmanState | null>(K.LEARNING_TDEE, null),
    store.get<Record<string, ArmPosterior>>(K.LEARNING_POSTERIORS, {}),
    store.get<FitnessFatigueParams>(K.LEARNING_FITNESS, POPULATION_PARAMS),
    store.get<LogisticModel>(K.LEARNING_ADHERENCE, populationModel()),
  ]);
  return { kalman, posteriors, fitness, adherence };
}

/* ════════════════════════════════════════════════════════════════════════
   The write side — recording a prediction before the outcome is known
   ════════════════════════════════════════════════════════════════════════ */

export interface IssueInput {
  /** Discretized state at issue time. */
  context: ContextDimensions;
  action: Recommendation["action"];
  prediction: Recommendation["prediction"];
  /** Restrict the arms the bandit may choose. Omit for all of them. */
  arms?: ArmId[];
  store?: KeyValueStore;
  now?: Date;
}

/**
 * Choose a delivery arm and write the falsifiable record.
 *
 * The ORDER is the point. The prediction is committed before anyone knows how
 * it turns out; a prediction written afterwards is just a description, and a
 * ledger of descriptions can't teach anything. Everything downstream — the
 * bandit's posteriors, the success curve, the ignored-vs-ineffective split —
 * depends on this call happening at issue time.
 *
 * Returns the chosen arm so the caller can act on it, including `nudge:silence`,
 * which means *send nothing*. Silence is only learnable because it's in the
 * action space (see bandit.ts).
 */
export async function issueRecommendation(
  input: IssueInput,
): Promise<{ arm: ArmId; record: Recommendation }> {
  const store = input.store ?? defaultStore;
  const ctx = encodeContext(input.context);
  const { posteriors } = await loadLearnedState(store);
  const posteriorStore = createPosteriorStore(posteriors);

  const arm = selectArm(ctx, input.arms ?? ALL_ARMS, posteriorStore);
  const record = makeRecommendation({
    arm,
    context: ctx,
    action: input.action,
    prediction: input.prediction,
    now: input.now,
  });

  await recordRecommendation(store, record);
  return { arm, record };
}

/**
 * Build the bandit context from the numbers the caller already has.
 *
 * Kept here rather than at each call site so every issued recommendation is
 * bucketed the same way — two call sites disagreeing about what counts as
 * "high adherence" would split the evidence across cells that should have been
 * one, and the bandit would learn half as fast for no visible reason.
 */
export function buildContext(input: {
  goal: ContextDimensions["goal"];
  adherenceScore: number;
  recoveryScore: number;
  date: string;
}): ContextDimensions {
  return {
    goal: input.goal,
    adherence: adherenceBucket(input.adherenceScore),
    recovery:
      input.recoveryScore >= 67 ? "green" : input.recoveryScore >= 34 ? "amber" : "red",
    daytype: dayType(input.date),
  };
}

/* ════════════════════════════════════════════════════════════════════════
   The daily job — score what closed, then refit everything
   ════════════════════════════════════════════════════════════════════════ */

export interface DailyLearningInput {
  /** Population maintenance estimate — the Kalman's starting point and fallback. */
  mifflinTdee: number;
  /** Current scale weight, for initialising the filter on first run. */
  weightKg: number;
  store?: KeyValueStore;
  now?: Date;
}

export interface DailyLearningReport {
  resolved: number;
  pending: number;
  unresolvable: number;
  days: number;
  tdeeObservations: number;
  sessionsFitted: number;
  adherenceSamples: number;
}

/**
 * The nightly pass. Idempotent — safe to run twice in a day, safe to re-run
 * after a crash, safe on a restored backup. See the header for why that matters
 * more than the small cost of recomputing.
 */
export async function runDailyLearning(
  input: DailyLearningInput,
): Promise<DailyLearningReport> {
  const store = input.store ?? defaultStore;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);

  const events = await timeline.query({});
  const series = buildSeries(events, today);

  // ── 1. Score every recommendation whose horizon has closed ──
  const reader = makeMetricReader(series);
  const report = await resolveDue(store, reader, now);

  // ── 2. Rebuild the bandit's posteriors from the entire ledger ──
  const ledger = await loadLedger(store);
  const posteriors = rebuildPosteriors(ledger);
  await store.set(K.LEARNING_POSTERIORS, posteriors);

  // ── 3. Refit the Kalman TDEE filter over the whole series ──
  const kalman = series.length
    ? runFilter(
        initKalman(firstWeight(series) ?? input.weightKg, input.mifflinTdee),
        series.map((r) => ({ intakeKcal: r.intakeKcal, scaleKg: r.weightKg })),
      )
    : null;
  if (kalman) await store.set(K.LEARNING_TDEE, kalman);

  // ── 4. Refit the training-response model ──
  const loads = toLoads(series);
  const observations = series
    .filter((r) => r.performance !== null)
    .map((r) => ({ date: r.date, value: r.performance as number }));
  const fitness = fitParams(loads, observations, POPULATION_PARAMS);
  await store.set(K.LEARNING_FITNESS, fitness);

  // ── 5. Refit the adherence model ──
  const samples = buildAdherenceSamples(series, loads, fitness);
  const adherence = fitAdherence(samples);
  await store.set(K.LEARNING_ADHERENCE, adherence);

  return {
    ...report,
    days: series.length,
    tdeeObservations: kalman?.observations ?? 0,
    sessionsFitted: observations.length,
    adherenceSamples: samples.length,
  };
}

/** First observed scale reading — the only honest place to start the filter. */
function firstWeight(series: DayRow[]): number | null {
  for (const r of series) if (r.weightKg !== null) return r.weightKg;
  return null;
}

function toLoads(series: DayRow[]): TrainingLoad[] {
  return series.map((r) => ({ date: r.date, load: r.trainingLoad }));
}

/**
 * Prior + counts, from scratch.
 *
 * Beta is conjugate to Bernoulli, so α = prior.α + successes and
 * β = prior.β + failures is *exactly* the result of folding each outcome in
 * one at a time — with none of the "have I already counted this one?" risk.
 */
function rebuildPosteriors(ledger: Recommendation[]): Record<string, ArmPosterior> {
  const out: Record<string, ArmPosterior> = {};
  for (const rec of ledger) {
    if (!rec.outcome) continue;
    const cell = `${rec.context}#${rec.arm}`;
    const prior = POPULATION_PRIOR[rec.arm] ?? { alpha: 1, beta: 1 };
    const current = out[cell] ?? { ...prior };
    out[cell] = rec.outcome.success
      ? { alpha: current.alpha + 1, beta: current.beta }
      : { alpha: current.alpha, beta: current.beta + 1 };
  }
  return out;
}

/**
 * Turn the series into "given yesterday's state, did they train today?" samples.
 *
 * Features are read from the days BEFORE the label, never the day of — a model
 * trained on same-day information looks excellent in evaluation and is useless
 * in production, where it has to predict tomorrow from what's known tonight.
 */
function buildAdherenceSamples(
  series: DayRow[],
  loads: TrainingLoad[],
  params: FitnessFatigueParams,
): TrainingSample[] {
  const samples: TrainingSample[] = [];
  // Needs a week of lead-in for the 7-day completion rate to mean anything.
  for (let i = 7; i < series.length; i++) {
    const day = series[i];
    const prior = series.slice(i - 7, i);
    const completed7 = prior.reduce((n, r) => n + r.sessionCompleted, 0) / 7;

    let daysSince = 0;
    for (let j = i - 1; j >= 0; j--) {
      daysSince++;
      if (series[j].sessionCompleted === 1) break;
    }

    let streak = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (series[j].sessionCompleted !== 1) break;
      streak++;
    }

    samples.push({
      features: {
        recentCompletion7d: completed7,
        dayOfWeek: parseLocalDate(day.date).getDay(),
        sleepHours: series[i - 1].sleepHours,
        // Not modelled yet: the calendar and weather senses are consent-gated
        // and frequently absent, and a feature that is zero for most users is
        // worse than one the model knows nothing about.
        calendarLoad: 0,
        weatherAdversity: 0,
        daysSinceLastSession: daysSince,
        recoveryScore: readinessOn(loads, day.date, params),
        streak,
      },
      completed: day.sessionCompleted === 1,
    });
  }
  return samples;
}

/* ════════════════════════════════════════════════════════════════════════
   The read side — what the models currently believe
   ════════════════════════════════════════════════════════════════════════ */

/** One model's standing, for the UI. */
export interface ModelCard {
  id: "tdee" | "training" | "adherence" | "delivery" | "outcomes";
  label: string;
  /** What this model does, in the coach's voice. */
  blurb: string;
  /** 0–1 toward this model's OWN confidence gate. */
  progress: number;
  confident: boolean;
  /** The learned value, or what's still needed to have one. */
  detail: string;
}

export interface IntelligenceSnapshot {
  /** False until there's any history at all. */
  ready: boolean;
  /**
   * "How well I know you", 0–1. The mean of every model's progress toward its
   * own gate — so it can only reach 1 when every model has genuinely earned it.
   */
  confidence: number;
  models: ModelCard[];
  tdee: {
    learned: number;
    uncertainty: number;
    mifflin: number;
    confident: boolean;
    observations: number;
    /** Gozlin's line, or null while the estimate is still too loose to say. */
    disclosure: string | null;
  } | null;
  training: {
    fitted: boolean;
    sessions: number;
    readiness: number;
    /** Fitted fatigue decay, days — the number that individualises recovery. */
    tau2: number;
  };
  adherence: {
    probability: number | null;
    atRisk: boolean;
    samples: number;
    action: AdherenceAction;
  };
  outcomes: {
    total: number;
    resolved: number;
    pending: number;
    successRate: number | null;
    ignored: number;
    ineffective: number;
  };
  delivery: {
    /** Mean KL from the population prior — the "generic coach → your coach" arc. */
    personalization: number;
    best: { arm: ArmId; mean: number } | null;
    evidence: number;
  };
  /** A genuine shift in behaviour, if one crossed the threshold. */
  drift: (ChangePoint & { metric: string; label: string }) | null;
}

const ARM_LABEL: Record<ArmId, string> = {
  "nudge:direct": "Direct",
  "nudge:gentle": "Gentle",
  "nudge:question": "A question",
  "nudge:celebrate": "Celebration",
  "nudge:silence": "Saying nothing",
};

/** Human name for an arm — exported so the UI doesn't re-derive the mapping. */
export function armLabel(arm: ArmId): string {
  return ARM_LABEL[arm] ?? arm;
}

export async function readIntelligence(input: {
  mifflinTdee: number;
  store?: KeyValueStore;
  now?: Date;
}): Promise<IntelligenceSnapshot> {
  const store = input.store ?? defaultStore;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);

  const [events, state, ledger] = await Promise.all([
    timeline.query({}),
    loadLearnedState(store),
    loadLedger(store),
  ]);
  const series = buildSeries(events, today);
  const loads = toLoads(series);

  // ── TDEE ──
  // Bound to a local so the narrowing survives into the object literal below.
  const kalmanState = state.kalman;
  const reading = kalmanState ? readKalman(kalmanState) : null;
  const tdee =
    reading && kalmanState
      ? {
          learned: reading.learnedTdee,
          uncertainty: reading.uncertainty,
          mifflin: input.mifflinTdee,
          confident: reading.confident,
          observations: reading.observations,
          // Built by tdee.ts's own gated helper rather than formatted here, so
          // there is exactly one place that decides a learned number is sayable.
          disclosure: tdeeDisclosure(kalmanState, input.mifflinTdee),
        }
      : null;

  // ── Training response ──
  const sessions = series.filter((r) => r.performance !== null).length;
  const training = {
    fitted: sessions >= MIN_SESSIONS_TO_FIT,
    sessions,
    readiness: series.length ? readinessOn(loads, today, state.fitness) : 70,
    tau2: Number(state.fitness.tau2.toFixed(1)),
  };

  // ── Adherence ──
  const latest = series[series.length - 1];
  const probability =
    series.length > 8 && latest ? predictAdherence(state.adherence, latestFeatures(series, loads, state.fitness)) : null;
  const adherence = {
    probability,
    atRisk: probability !== null && probability < AT_RISK_THRESHOLD,
    samples: state.adherence.samples,
    action: probability !== null ? decide(probability, state.adherence) : { kind: "proceed" as const },
  };

  // ── Outcome ledger ──
  const resolved = ledger.filter((r) => r.outcome).length;
  const breakdown = failureBreakdown(ledger);
  const outcomes = {
    total: ledger.length,
    resolved,
    pending: ledger.length - resolved,
    successRate: successRate(ledger, 90, now),
    ignored: breakdown.ignored,
    ineffective: breakdown.ineffective,
  };

  // ── Delivery (bandit) ──
  const posteriorStore = createPosteriorStore(state.posteriors);
  const entries = posteriorStore.entries();
  let best: { arm: ArmId; mean: number } | null = null;
  for (const [key, posterior] of entries) {
    const arm = key.slice(key.indexOf("#") + 1) as ArmId;
    const mean = armMean(posterior);
    if (!best || mean > best.mean) best = { arm, mean };
  }
  const delivery = {
    personalization: divergenceFromPrior(posteriorStore),
    best,
    evidence: entries.length,
  };

  // ── Drift ──
  const drift = detectDrift(series);

  const models = buildModelCards({ tdee, training, adherence, outcomes, delivery });
  const confidence =
    models.reduce((sum, m) => sum + m.progress, 0) / (models.length || 1);

  return {
    ready: series.length > 0,
    confidence,
    models,
    tdee,
    training,
    adherence,
    outcomes,
    delivery,
    drift,
  };
}

function latestFeatures(
  series: DayRow[],
  loads: TrainingLoad[],
  params: FitnessFatigueParams,
): AdherenceFeatures {
  const i = series.length - 1;
  const prior = series.slice(Math.max(0, i - 7), i);
  const completed7 = prior.reduce((n, r) => n + r.sessionCompleted, 0) / (prior.length || 1);

  let daysSince = 0;
  for (let j = i - 1; j >= 0; j--) {
    daysSince++;
    if (series[j].sessionCompleted === 1) break;
  }
  let streak = 0;
  for (let j = i; j >= 0; j--) {
    if (series[j].sessionCompleted !== 1) break;
    streak++;
  }

  return {
    recentCompletion7d: completed7,
    dayOfWeek: parseLocalDate(series[i].date).getDay(),
    sleepHours: series[i].sleepHours,
    calendarLoad: 0,
    weatherAdversity: 0,
    daysSinceLastSession: daysSince,
    recoveryScore: readinessOn(loads, series[i].date, params),
    streak,
  };
}

/**
 * Look for a genuine shift across the behavioural series.
 *
 * Rate data (did they train, did they hit their meals) uses `cusumRate`, which
 * takes its spread from the reference RATE rather than the sample standard
 * deviation — on Bernoulli draws the sample estimate produces false alarms on
 * half of all stable windows (see changepoint.ts).
 */
function detectDrift(series: DayRow[]): (ChangePoint & { metric: string; label: string }) | null {
  const candidates: { metric: string; label: string; found: ChangePoint | null }[] = [
    {
      metric: "session_completed",
      label: "your training",
      found: cusumRate(series.map((r) => r.sessionCompleted)),
    },
    {
      metric: "adherence_pct",
      label: "how closely you follow your meals",
      found: cusumRate(
        series.map((r) => (r.adherencePct ?? 0) / 100),
      ),
    },
    {
      metric: "water_ml",
      label: "your hydration",
      found: cusum(series.map((r) => r.waterMl ?? 0)),
    },
  ];

  let best: (ChangePoint & { metric: string; label: string }) | null = null;
  for (const c of candidates) {
    if (!c.found) continue;
    if (!best || c.found.magnitude > best.magnitude) {
      best = { ...c.found, metric: c.metric, label: c.label };
    }
  }
  return best;
}

/**
 * One card per model, each measured against its OWN gate.
 *
 * The gates are not cosmetic: they're the same constants the models use to
 * decide whether to act. `progress` is how far the user is toward that gate, so
 * the aggregate "how well I know you" figure can never outrun the evidence.
 */
function buildModelCards(input: {
  tdee: IntelligenceSnapshot["tdee"];
  training: IntelligenceSnapshot["training"];
  adherence: IntelligenceSnapshot["adherence"];
  outcomes: IntelligenceSnapshot["outcomes"];
  delivery: IntelligenceSnapshot["delivery"];
}): ModelCard[] {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const TDEE_GATE = 14; // paired weigh-ins — MIN_OBSERVATIONS in tdee.ts
  const ADHERENCE_GATE = 20; // samples — the floor `decide()` refuses to act below
  const DELIVERY_GATE = 20; // resolved outcomes before the prior stops dominating

  return [
    {
      id: "tdee",
      label: "Your metabolism",
      blurb: "What you actually burn, learned from your intake and how your weight really moved.",
      progress: clamp((input.tdee?.observations ?? 0) / TDEE_GATE),
      confident: !!input.tdee?.confident,
      detail: input.tdee?.confident
        ? `Maintenance looks like ${input.tdee.learned} kcal, ±${input.tdee.uncertainty}`
        : `${input.tdee?.observations ?? 0} of ${TDEE_GATE} weigh-ins — using the ${input.tdee?.mifflin ?? 0} kcal estimate until then`,
    },
    {
      id: "training",
      label: "How you recover",
      blurb: "Your own fitness and fatigue curves, so hard weeks are timed for you rather than the average person.",
      progress: clamp(input.training.sessions / MIN_SESSIONS_TO_FIT),
      confident: input.training.fitted,
      detail: input.training.fitted
        ? `Fatigue clears in about ${input.training.tau2} days`
        : `${input.training.sessions} of ${MIN_SESSIONS_TO_FIT} sessions — on the population curve until then`,
    },
    {
      id: "adherence",
      label: "When you slip",
      blurb: "Which days you tend to miss, so tomorrow's ask can shrink before it's missed instead of after.",
      progress: clamp(input.adherence.samples / ADHERENCE_GATE),
      confident: input.adherence.samples >= ADHERENCE_GATE,
      detail:
        input.adherence.probability !== null && input.adherence.samples >= ADHERENCE_GATE
          ? `${Math.round(input.adherence.probability * 100)}% likely to train tomorrow`
          : `${input.adherence.samples} of ${ADHERENCE_GATE} days learned`,
    },
    {
      id: "delivery",
      label: "How to talk to you",
      blurb: "Whether you respond to a direct push, a gentle nudge, a question — or to being left alone.",
      progress: clamp(input.outcomes.resolved / DELIVERY_GATE),
      confident: input.outcomes.resolved >= DELIVERY_GATE,
      detail:
        input.delivery.best && input.outcomes.resolved >= DELIVERY_GATE
          ? `${armLabel(input.delivery.best.arm)} works best for you`
          : `${input.outcomes.resolved} of ${DELIVERY_GATE} results in`,
    },
    {
      id: "outcomes",
      label: "Whether the advice worked",
      blurb: "Every suggestion is written down as a prediction before you act on it, then scored against what happened.",
      progress: clamp(input.outcomes.resolved / DELIVERY_GATE),
      confident: input.outcomes.resolved > 0 && input.outcomes.successRate !== null,
      detail:
        input.outcomes.successRate !== null
          ? `${Math.round(input.outcomes.successRate * 100)}% of predictions held`
          : input.outcomes.pending > 0
            ? `${input.outcomes.pending} still being checked`
            : "Nothing predicted yet",
    },
  ];
}
