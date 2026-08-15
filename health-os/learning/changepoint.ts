/**
 * health-os/learning/changepoint.ts — CUSUM change-point detection.
 *
 * The most companion-like thing a coach does is NOTICE AN ABSENCE. Not "you
 * missed a workout" — anyone can threshold that — but "something shifted around
 * the 14th, and Thursdays have gone quiet since."
 *
 * That's a change-point problem, not a threshold problem, and the distinction
 * matters: a threshold fires on every bad day and says nothing about whether
 * the person has actually changed. CUSUM accumulates small deviations, so it
 * stays silent through ordinary noise and speaks up when the underlying rate
 * has genuinely moved.
 *
 * Run it on the improve side too and you get EARNED celebration — a real shift
 * worth naming, rather than participation-trophy confetti.
 */

/** Slack, in standard deviations. Deviations smaller than this don't accumulate. */
export const DEFAULT_K = 0.5;

/**
 * Decision threshold for continuous series. An over-eager detector is worse
 * than none — a coach who cries wolf about your habits stops being worth
 * listening to — so this errs toward silence.
 */
export const DEFAULT_H = 4;

/**
 * Days of stable history needed before the detector will say anything.
 *
 * 28, not 14. Measured in replay: a 14-day reference is simply too short to
 * characterise a noisy behavioural process, and the resulting baseline error
 * produced a false alarm on ~20–35% of stable windows no matter how high the
 * threshold went. Widening the reference is what actually fixed it (to ~5%);
 * raising `h` alone could not.
 */
export const REFERENCE_WINDOW = 28;

export interface ChangePoint {
  /** Index into the series where the accumulated evidence crossed h. */
  at: number;
  direction: "decline" | "improve";
  /** How far past the threshold — bigger means more abrupt. */
  magnitude: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/**
 * Two-sided CUSUM over a behavioural series (daily logging, session completion,
 * protein hit-rate).
 *
 * Returns the FIRST crossing, which is what a coach would comment on — the
 * moment things changed, not every day since.
 */
export function cusum(
  series: number[],
  k: number = DEFAULT_K,
  h: number = DEFAULT_H,
  referenceWindow: number = REFERENCE_WINDOW,
  /**
   * Override the reference spread. Supply this for rate/proportion data — see
   * {@link cusumRate} for why the sample estimate is the wrong tool there.
   */
  referenceSd?: number,
): ChangePoint | null {
  if (series.length <= referenceWindow) return null;

  const reference = series.slice(0, referenceWindow);
  const mu = mean(reference);
  // A floor on σ stops a perfectly flat reference window from making every
  // subsequent point look like an infinite-sigma event.
  const sd = Math.max(referenceSd ?? stddev(reference), 1e-6);

  let sHi = 0;
  let sLo = 0;

  for (let t = referenceWindow; t < series.length; t++) {
    const z = (series[t] - mu) / sd;
    sHi = Math.max(0, sHi + z - k);
    sLo = Math.max(0, sLo - z - k);
    if (sLo > h) return { at: t, direction: "decline", magnitude: sLo - h };
    if (sHi > h) return { at: t, direction: "improve", magnitude: sHi - h };
  }
  return null;
}

/**
 * Threshold for BINARY / rate series. Much higher than {@link DEFAULT_H}
 * because Bernoulli data is skewed rather than normal, so the usual h≈4 rule of
 * thumb fires constantly — measured at ~50% false alarms per 60 days before
 * this was split out.
 *
 * At h=10 with a 28-day reference, replay gives ~5% false alarms per 90-day
 * stable window (≈ one per five years) and detects a 0.6→0.2 collapse in
 * completion within ~4 weeks, ~80% of the time.
 *
 * THAT LAG IS PHYSICS, NOT TUNING. Distinguishing a changed rate from a bad
 * fortnight on daily yes/no data genuinely takes weeks at this false-alarm
 * budget; a detector that flagged it in five days would be firing on noise
 * several times a month. Given the choice, a coach should be late and right.
 */
export const RATE_H = 10;

/**
 * CUSUM for a series of 0/1 outcomes or rates in [0,1] — "did they train
 * today", "did they hit protein".
 *
 * The sample standard deviation is the wrong estimator here. On 14 Bernoulli
 * draws it swings wildly, and an unluckily-low estimate makes every subsequent
 * miss look like a multi-sigma event: in replay that produced a false alarm on
 * half of all stable 60-day windows. The theoretical spread √(p(1−p)) from the
 * reference RATE is stable and correct for this data type, so use that instead
 * and clamp p away from the degenerate ends.
 */
export function cusumRate(
  series: number[],
  k: number = DEFAULT_K,
  h: number = RATE_H,
  referenceWindow: number = REFERENCE_WINDOW,
): ChangePoint | null {
  if (series.length <= referenceWindow) return null;
  const p = mean(series.slice(0, referenceWindow));
  const clamped = Math.min(0.95, Math.max(0.05, p));
  return cusum(series, k, h, referenceWindow, Math.sqrt(clamped * (1 - clamped)));
}

/**
 * Detect across several series at once and return the strongest signal.
 * Behaviour rarely shifts in one dimension alone, and the coach should lead
 * with whichever moved most decisively.
 */
export function detectAcross(
  series: Record<string, number[]>,
  k = DEFAULT_K,
  h = DEFAULT_H,
): (ChangePoint & { metric: string }) | null {
  let best: (ChangePoint & { metric: string }) | null = null;
  for (const [metric, values] of Object.entries(series)) {
    const found = cusum(values, k, h);
    if (found && (!best || found.magnitude > best.magnitude)) {
      best = { ...found, metric };
    }
  }
  return best;
}

/**
 * Turn a detection into a conversation OPENER, not an alert.
 *
 * The difference is the whole point. "You've missed 3 workouts" is a
 * scoreboard. "Something shifted around the 14th — you'd been solid for six
 * weeks and Thursdays have gone quiet since. What changed?" is a coach who has
 * been paying attention, and it invites the answer rather than closing it down.
 *
 * Feed the result to GozlinAnticipationEngine.
 */
export function describeChange(
  change: ChangePoint & { metric?: string },
  dateAt: string,
  weeksStableBefore: number,
): string {
  if (change.direction === "decline") {
    const preamble =
      weeksStableBefore >= 3
        ? `Something shifted around ${dateAt} — you'd been solid for ${weeksStableBefore} weeks before that.`
        : `Something shifted around ${dateAt}.`;
    return `${preamble} What changed?`;
  }
  return (
    `Something clicked around ${dateAt} — this isn't a good week, it's a different level ` +
    `than where you were. Worth naming.`
  );
}
