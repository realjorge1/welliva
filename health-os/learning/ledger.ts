/**
 * health-os/learning/ledger.ts — the outcome ledger.
 *
 * BUILD THIS FIRST. Everything else in this folder depends on it, and it is the
 * one piece whose value is entirely a function of how long it has been running:
 * on day one it holds nothing, by day ninety it holds the only evidence that
 * this product learns. Every week it isn't shipped is a week of training data
 * that cannot be recovered retroactively.
 *
 * It is deliberately SHIPPED DARK: it records and resolves, and nothing reads
 * it until the bandit lands. ~300 lines of instrumentation earning interest.
 *
 * Pure over an injected store + metric reader, so the replay harness can drive
 * 180 simulated days through it in milliseconds.
 */

import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import { K } from "../platform/storage/keys";
import { parseLocalDate, toLocalDateString } from "../platform/clock";
import type {
  ContextDimensions,
  ContextKey,
  MetricReader,
  Recommendation,
  RecommendationOutcome,
} from "./types";

/**
 * How many records to keep. Roughly two years at a few recommendations a day —
 * far more than any model here needs, but cheap, and the tenure curves in the
 * evaluation harness want the long tail.
 */
const MAX_RECORDS = 2000;

/**
 * Below this the metric hasn't meaningfully moved. Prevents scale noise and
 * rounding from being scored as a real effect in either direction.
 */
const NOISE_FLOOR: Record<string, number> = {
  protein_g: 5,
  calories_kcal: 75,
  water_ml: 150,
  session_completed: 0.5,
  weight_trend_kg: 0.15,
  adherence_pct: 3,
};

// ── Context ────────────────────────────────────────────────────────

/**
 * Encode the discretized state.
 *
 * Buckets are COARSE on purpose. Four dimensions at 3/3/3/2 is 54 cells; a
 * user producing a couple of recommendations a day reaches useful counts per
 * cell within a few months. Add a fifth dimension or split a bucket and the
 * evidence per cell collapses — you get a model that never learns anything
 * because it never sees the same situation twice.
 */
export function encodeContext(d: ContextDimensions): ContextKey {
  return `goal:${d.goal}|adh:${d.adherence}|rec:${d.recovery}|dow:${d.daytype}`;
}

export function decodeContext(key: ContextKey): ContextDimensions | null {
  const parts = Object.fromEntries(
    key.split("|").map((p) => {
      const i = p.indexOf(":");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  if (!parts.goal || !parts.adh || !parts.rec || !parts.dow) return null;
  return {
    goal: parts.goal as ContextDimensions["goal"],
    adherence: parts.adh as ContextDimensions["adherence"],
    recovery: parts.rec as ContextDimensions["recovery"],
    daytype: parts.dow as ContextDimensions["daytype"],
  };
}

/** Bucket a 0–100 adherence score. */
export function adherenceBucket(score: number): ContextDimensions["adherence"] {
  if (score >= 75) return "high";
  if (score >= 45) return "mid";
  return "low";
}

/** Weekend behaviour differs enough to be its own context, not noise. */
export function dayType(date: string): ContextDimensions["daytype"] {
  const day = parseLocalDate(date).getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

// ── Persistence ────────────────────────────────────────────────────

export async function loadLedger(store: KeyValueStore): Promise<Recommendation[]> {
  return store.get<Recommendation[]>(K.LEARNING_LEDGER, []);
}

export async function saveLedger(
  store: KeyValueStore,
  records: Recommendation[],
): Promise<void> {
  const trimmed =
    records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records;
  await store.set(K.LEARNING_LEDGER, trimmed);
}

/** Record a piece of advice at the moment it's given. */
export async function recordRecommendation(
  store: KeyValueStore,
  rec: Recommendation,
): Promise<void> {
  const ledger = await loadLedger(store);
  ledger.push(rec);
  await saveLedger(store, ledger);
}

let SEQ = 0;
/** Build a record. `issuedOn` is local-date so horizons are calendar days. */
export function makeRecommendation(input: {
  arm: Recommendation["arm"];
  context: ContextKey;
  action: Recommendation["action"];
  prediction: Recommendation["prediction"];
  now?: Date;
}): Recommendation {
  const now = input.now ?? new Date();
  return {
    id: `rec_${now.getTime()}_${SEQ++}`,
    issuedAt: now.getTime(),
    issuedOn: toLocalDateString(now),
    arm: input.arm,
    context: input.context,
    action: input.action,
    prediction: input.prediction,
  };
}

// ── The resolver ───────────────────────────────────────────────────

function addDays(date: string, n: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
}

/**
 * Score one closed recommendation.
 *
 * Exported so the replay harness can assert the scoring rule directly rather
 * than inferring it from ledger state.
 */
export function scoreOutcome(
  rec: Recommendation,
  before: number,
  after: number,
  observedAt: number,
): RecommendationOutcome {
  const delta = after - before;
  const floor = NOISE_FLOOR[rec.prediction.metric] ?? 0;

  // "Adhered" is about behaviour, "success" is about behaviour AND effect. For
  // a behavioural metric the two coincide; for an outcome metric like weight
  // they must not — you can follow the plan perfectly and the scale not move,
  // and that means something completely different from ignoring the plan.
  const moved = Math.abs(delta) >= floor;
  const directionMatched =
    rec.prediction.direction === "hold" ? !moved : moved && directionOf(delta) === rec.prediction.direction;

  const behavioural =
    rec.prediction.metric === "session_completed" ||
    rec.prediction.metric === "protein_g" ||
    rec.prediction.metric === "water_ml" ||
    rec.prediction.metric === "adherence_pct";

  // For a behavioural ask, movement in the asked-for direction IS adherence.
  //
  // For an OUTCOME metric we can't read adherence off the metric at all — you
  // can follow a deficit perfectly and have the scale sit still for a week. So
  // the honest read is "they didn't move away from it": no meaningful movement
  // counts as adhered-but-ineffective, which is precisely the case that tells
  // us our model of this user is wrong rather than our delivery.
  const adhered = behavioural
    ? directionMatched
    : !moved ||
      rec.prediction.direction === "hold" ||
      directionOf(delta) !== opposite(rec.prediction.direction);

  return {
    observedAt,
    adhered,
    metricDelta: Number(delta.toFixed(3)),
    success: adhered && directionMatched,
  };
}

function directionOf(delta: number): "up" | "down" | "hold" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "hold";
}

function opposite(d: "up" | "down" | "hold"): "up" | "down" | "hold" {
  return d === "up" ? "down" : d === "down" ? "up" : "hold";
}

export interface ResolveReport {
  resolved: number;
  pending: number;
  /** Open records whose window has no data — judged later, or never. */
  unresolvable: number;
}

/**
 * Walk open recommendations whose horizon has closed and write their outcomes.
 *
 * Pure over the event store: a daily job, and it slots into the existing
 * day-close compaction. Idempotent — already-resolved records are skipped, so
 * running it twice in a day changes nothing.
 */
export async function resolveDue(
  store: KeyValueStore,
  read: MetricReader,
  now: Date = new Date(),
): Promise<ResolveReport> {
  const ledger = await loadLedger(store);
  const today = toLocalDateString(now);
  let resolved = 0;
  let pending = 0;
  let unresolvable = 0;
  let dirty = false;

  for (const rec of ledger) {
    if (rec.outcome) continue;

    const closesOn = addDays(rec.issuedOn, rec.prediction.horizonDays);
    if (closesOn > today) {
      pending++;
      continue;
    }

    // Baseline is the window BEFORE the advice; comparison is the window after.
    // Same length both sides, so a longer horizon can't manufacture a bigger
    // delta out of nothing.
    const span = Math.max(1, rec.prediction.horizonDays);
    const before = read(rec.prediction.metric, addDays(rec.issuedOn, -span), rec.issuedOn);
    const after = read(rec.prediction.metric, rec.issuedOn, closesOn);

    if (before === null || after === null) {
      unresolvable++;
      continue;
    }

    rec.outcome = scoreOutcome(rec, before, after, now.getTime());
    resolved++;
    dirty = true;
  }

  if (dirty) await saveLedger(store, ledger);
  return { resolved, pending, unresolvable };
}

// ── Read models ────────────────────────────────────────────────────

/**
 * Adherence rate over the last `windowDays`.
 *
 * Plotted against weeks of user tenure, this curve is the diligence exhibit:
 * if it slopes up, "learns and improves continuously" stops being marketing
 * copy and becomes a chart.
 */
export function adherenceRate(
  ledger: Recommendation[],
  windowDays: number,
  now: Date = new Date(),
): number | null {
  const cutoff = now.getTime() - windowDays * 86400_000;
  const scored = ledger.filter((r) => r.outcome && r.issuedAt >= cutoff);
  if (scored.length === 0) return null;
  return scored.filter((r) => r.outcome!.adhered).length / scored.length;
}

/** Success rate — adhered AND the predicted direction held. */
export function successRate(
  ledger: Recommendation[],
  windowDays: number,
  now: Date = new Date(),
): number | null {
  const cutoff = now.getTime() - windowDays * 86400_000;
  const scored = ledger.filter((r) => r.outcome && r.issuedAt >= cutoff);
  if (scored.length === 0) return null;
  return scored.filter((r) => r.outcome!.success).length / scored.length;
}

/**
 * The diagnostic split: of the recommendations that FAILED, how many failed
 * because they weren't followed vs. because following them didn't help?
 *
 * A rising `ignored` share says the delivery is wrong. A rising `ineffective`
 * share says the model of this user is wrong. They call for opposite fixes.
 */
export function failureBreakdown(ledger: Recommendation[]): {
  ignored: number;
  ineffective: number;
} {
  let ignored = 0;
  let ineffective = 0;
  for (const r of ledger) {
    if (!r.outcome || r.outcome.success) continue;
    if (r.outcome.adhered) ineffective++;
    else ignored++;
  }
  return { ignored, ineffective };
}
