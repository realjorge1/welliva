/**
 * services/cycle/backtest.ts — does the "80% window" land 80% of the time? PURE.
 *
 * Before 2026-11-20 nobody knew (Fix 8): the window was built from her spread
 * and never checked against what then happened. Now the forecast is re-run as
 * it would have been made on the day after each of her recent periods began,
 * using only what she had logged by then (the technique ./nextDates' receipt
 * uses), and each answer is held against the start that really came.
 *
 *   · Only COMPLETED, COUNTED cycles are checked — her last BACKTEST_CYCLES of
 *     them, never her first two (with nothing before them, a forecast is only
 *     what she told us).
 *   · Below MIN_BACKTEST checked forecasts, nothing is said and nothing is
 *     adjusted.
 *   · The re-runs are made with calibration OFF (no forecast checks itself
 *     checking itself).
 *
 * ./predict scales the window by `calibrationScale`: a window that keeps
 * missing widens, one that always lands tightens a little — never below a day.
 * The cycle screen says the count back, exactly: "5 of your last 6 forecasts
 * landed inside the window."
 *
 * Imports only types from ./predict: the forecast itself is passed in, so
 * there is no import cycle.
 */

import { addDays, daysBetween } from "./dates";
import { normalQuantile } from "./normal";
import type { CycleRecord, Prediction, PredictInput } from "./predict";
import type { CycleDays, PeriodEpisode } from "./types";

/** Her most recent completed counted cycles that are checked. */
export const BACKTEST_CYCLES = 6;
/** The first this-many counted cycles are never checked: there was nothing to forecast from. */
export const BACKTEST_SKIP_FIRST = 2;
/** Below this many checked forecasts, the window isn't adjusted and the count isn't shown. */
export const MIN_BACKTEST = 4;
/** What the window promises: 8 in 10. */
export const TARGET_HIT_RATE = 0.8;
/** How far the self-check may widen or tighten the window. */
export const CALIBRATION_RANGE = { min: 0.85, max: 1.6 } as const;
/**
 * The count is trusted n / (n + this): 0.6 at six forecasts. (2 was tried on
 * 2026-11-20: it moved no archetype by more than a point, so the brief's 4 stays.)
 */
export const CALIBRATION_TRUST = 4;

export interface Calibration {
  /** Forecasts checked. */
  n: number;
  /** Of those, how many had the real start inside [earliest, latest]. */
  hits: number;
  /** Mean of (real start − likely), in days: positive = periods came later than said. */
  meanError: number;
}

/** Everything she had logged by the end of `asOf`: later periods gone, a period still running then left open. */
function asOfDay(input: PredictInput, asOf: string): PredictInput {
  const episodes: PeriodEpisode[] = [];
  for (const e of input.episodes) {
    if (e.start > asOf) continue;
    episodes.push(e.end && e.end > asOf ? { ...e, end: null } : e);
  }
  const days: CycleDays = {};
  for (const [d, log] of Object.entries(input.days)) if (d <= asOf) days[d] = log;
  return { ...input, episodes, days, today: asOf };
}

/**
 * Re-run the forecast on the day after each checked cycle began and hold it
 * against the start that came. `run` is ./predict's forecast with calibration
 * off. Null below MIN_BACKTEST.
 */
export function backtest(
  input: PredictInput,
  cycles: readonly CycleRecord[],
  run: (input: PredictInput) => Prediction | null,
): Calibration | null {
  const counted = cycles.filter((c) => c.status === "counted").slice(BACKTEST_SKIP_FIRST).slice(-BACKTEST_CYCLES);
  if (counted.length < MIN_BACKTEST) return null;
  let n = 0;
  let hits = 0;
  let error = 0;
  for (const c of counted) {
    const said = run(asOfDay(input, addDays(c.start, 1)));
    if (!said || said.lastStart !== c.start) continue;
    n += 1;
    if (c.nextStart >= said.earliest && c.nextStart <= said.latest) hits += 1;
    error += daysBetween(said.likely, c.nextStart);
  }
  return n >= MIN_BACKTEST ? { n, hits, meanError: error / n } : null;
}

/** A lean this size or more, in days, on average... */
export const BIAS_MIN_DAYS = 1.5;
/** ...over at least this many checked forecasts, moves the likely day... */
export const BIAS_MIN_FORECASTS = 5;
/** ...by at most this many days. */
export const BIAS_MAX_DAYS = 2;
/**
 * Whether to correct a systematic lean at all: OFF. The brief allowed it only
 * if the simulator showed it helps, and it didn't (2026-11-20): it cut the
 * perimenopause miss from 4.08 to 3.91 days but made the irregular (4.68 →
 * 4.84), PCOS-like (2.37 → 2.53) and teen (6.89 → 7.09) misses worse — six
 * forecasts are too few to tell a lean from noise. See docs/cycle/engine-accuracy.md.
 */
export const BIAS_CORRECTION = false;

/**
 * Days to move the likely day when her recent forecasts kept landing on one
 * side — periods coming steadily later than said, as cycles lengthen in the
 * years before menopause. 0 below the gates.
 */
export function biasShift(c: Calibration | null): number {
  if (!BIAS_CORRECTION || !c || c.n < BIAS_MIN_FORECASTS || Math.abs(c.meanError) < BIAS_MIN_DAYS) return 0;
  return Math.max(-BIAS_MAX_DAYS, Math.min(BIAS_MAX_DAYS, Math.round(c.meanError)));
}

/**
 * How much to widen or tighten the window, from how often it landed, within
 * CALIBRATION_RANGE; 1 with nothing to go on.
 *
 * A window that covers a share p of what happens is z(p) of her spread wide
 * each side, z(p) = Φ⁻¹((1 + p) / 2). To cover TARGET_HIT_RATE instead, it is
 * scaled by z(target) / z(p) — then trusted only as far as the count allows,
 * n / (n + MIN_BACKTEST), and the observed share is read as (hits + ½)/(n + 1)
 * so six out of six doesn't mean "certain".
 *
 * (The first version was linear: 1 + n/(n+4) × (0.8 − p) × 1.5. In the
 * simulator it moved an irregular cycler's window from 68% to 70%: a window
 * that lands two times in three needs about 30% more width, not 11%.)
 */
export function calibrationScale(c: Calibration | null): number {
  if (!c) return 1;
  const rate = (c.hits + 0.5) / (c.n + 1);
  const raw = normalQuantile((1 + TARGET_HIT_RATE) / 2) / normalQuantile((1 + rate) / 2);
  const m = 1 + (c.n / (c.n + CALIBRATION_TRUST)) * (raw - 1);
  return Math.min(CALIBRATION_RANGE.max, Math.max(CALIBRATION_RANGE.min, m));
}
