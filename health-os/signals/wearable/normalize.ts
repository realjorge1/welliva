/**
 * health-os/signals/wearable/normalize.ts
 *
 * The PURE half of the platform-health adapter: turning what a health store
 * actually hands back into the numbers `recoveryAdjustment` expects. No native
 * imports, no clock of its own, no storage — so every rule below is unit
 * testable, which matters more here than almost anywhere else in the app
 * because none of it can be exercised in a simulator without a paired watch.
 *
 * ── THE MISTAKE THIS FILE EXISTS TO AVOID ───────────────────────────────────
 * Sleep does not arrive as "you slept 7.4 hours". It arrives as a pile of
 * time-ranged samples that OVERLAP each other, from more than one writer:
 *
 *   InBed      23:10 → 07:05     (the phone, or the watch's bedtime schedule)
 *   Asleep     23:31 → 06:58     (the watch)
 *   Core       23:31 → 01:04     (the same sleep, broken into stages)
 *   Deep       01:04 → 01:52
 *   REM        01:52 → 02:40     …and so on
 *
 * Summing those durations — which is what a naive adapter does, and what makes
 * so many third-party integrations report impossible nights — gives about 22
 * hours of sleep. The stages are a subdivision of `Asleep`, not additional
 * sleep, and `InBed` is not sleep at all.
 *
 * So: keep only asleep-type samples, MERGE the overlaps into disjoint
 * intervals, and total those. {@link mergeIntervals} is the whole trick, and it
 * is the same on both platforms, which is why it lives here rather than twice
 * in two adapters.
 *
 * ── BASELINES ───────────────────────────────────────────────────────────────
 * HRV is meaningless as an absolute number. 40 ms is alarming for one person
 * and normal for another, so `recoveryAdjustment` compares against a personal
 * baseline and does nothing at all without one. Nothing was computing that
 * baseline, which is why the HRV fold could never fire even with a manual
 * snapshot. {@link rollingBaseline} computes it, using a MEDIAN over the
 * trailing window: one 3 a.m. reading after a glass of wine should not move a
 * baseline, and a median is what stops it.
 */

/** A half-open time range, in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/**
 * Merge overlapping and touching intervals into disjoint ones.
 *
 * The core of the sleep fix — see the header. Sorting first is what makes a
 * single pass sufficient: once ordered by start, any interval either extends
 * the one being built or begins a new one.
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const valid = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const out: Interval[] = [];
  for (const cur of valid) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      // Overlapping or contiguous — extend, never append.
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

/** Total covered time, in hours, counting overlapped stretches exactly once. */
export function totalHours(intervals: Interval[]): number {
  const merged = mergeIntervals(intervals);
  const ms = merged.reduce((sum, i) => sum + (i.end - i.start), 0);
  return ms / 3_600_000;
}

/**
 * The window "last night" occupies, as epoch milliseconds.
 *
 * Runs from 18:00 the previous day to 14:00 today. Wide on both ends
 * deliberately: the early bound catches an evening-shift worker's main sleep,
 * the late one catches a lie-in, and merging means an over-wide window costs
 * nothing — it can only pick up sleep that genuinely happened.
 *
 * A NAP AT 3 P.M. IS OUTSIDE IT, and that is the point. "How much did you sleep
 * last night" is the question the recovery fold asks, and folding an afternoon
 * nap into it would make a tired day read as a rested one.
 */
export function lastNightWindow(now: Date): Interval {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);

  const end = new Date(now);
  end.setHours(14, 0, 0, 0);

  // Before 2 p.m. the window's end is still ahead of us; "now" is the real edge.
  return { start: start.getTime(), end: Math.min(end.getTime(), now.getTime()) };
}

/** Clip an interval to a window, or null when they don't overlap. */
export function clip(interval: Interval, window: Interval): Interval | null {
  const start = Math.max(interval.start, window.start);
  const end = Math.min(interval.end, window.end);
  return end > start ? { start, end } : null;
}

/**
 * Hours of sleep in the given window, from raw (overlapping) asleep samples.
 *
 * Callers pass only samples they have already classified as ASLEEP — `InBed`
 * and `Awake` must be filtered out by the platform adapter, since only it knows
 * that store's vocabulary. Everything after that classification is identical on
 * both platforms and happens here.
 */
export function sleepHoursFromSamples(samples: Interval[], window: Interval): number | undefined {
  const clipped = samples
    .map((s) => clip(s, window))
    .filter((s): s is Interval => s !== null);
  if (clipped.length === 0) return undefined;

  const hours = totalHours(clipped);
  // A merged total above 18 hours is a corrupt or duplicated feed, not a night.
  // Reporting it would drive the recovery fold with a fiction.
  if (hours <= 0 || hours > 18) return undefined;
  return Math.round(hours * 100) / 100;
}

// ── Summary statistics ──────────────────────────────────────────────────────

export function median(values: number[]): number | undefined {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return undefined;
  const mid = clean.length >> 1;
  return clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

export function mean(values: number[]): number | undefined {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return undefined;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

/** One dated reading, for baseline history. */
export interface DatedValue {
  /** Epoch ms. */
  at: number;
  value: number;
}

/**
 * A personal rolling baseline.
 *
 * MEDIAN, not mean, over the trailing window — one outlier night (a late meal,
 * a drink, a fever) should not move the number a whole week's recovery scores
 * are then compared against.
 *
 * `minSamples` is the honesty gate. With three readings there is no baseline,
 * there is noise, and returning one anyway would make `recoveryAdjustment` fire
 * the "HRV well below your baseline" driver off nothing. Undefined is the
 * correct answer, and the recovery fold already handles it by skipping the term.
 */
export function rollingBaseline(
  history: DatedValue[],
  opts: { now: Date; days?: number; minSamples?: number } = { now: new Date() },
): number | undefined {
  const days = opts.days ?? 30;
  const minSamples = opts.minSamples ?? 7;
  const cutoff = opts.now.getTime() - days * 86_400_000;

  const window = history
    .filter((d) => Number.isFinite(d.value) && d.value > 0 && d.at >= cutoff)
    .map((d) => d.value);

  if (window.length < minSamples) return undefined;
  const m = median(window);
  return m === undefined ? undefined : Math.round(m * 100) / 100;
}

/** The most recent value in a set of dated readings. */
export function latest(history: DatedValue[]): DatedValue | undefined {
  let best: DatedValue | undefined;
  for (const d of history) {
    if (!Number.isFinite(d.value)) continue;
    if (!best || d.at > best.at) best = d;
  }
  return best;
}

/**
 * Accept a number only if it lands inside physiological range.
 *
 * Health stores accumulate junk: a chest strap dropping out writes a resting
 * heart rate of 0, a badly-worn ring writes an HRV of 400 ms. These are not
 * "unusual" readings to be flagged, they are non-readings, and letting one
 * through would tell someone their body is in trouble when their strap slipped.
 */
export function plausible(
  metric: "sleepHours" | "hrvMs" | "restingHr" | "steps" | "activeEnergyKcal",
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const range = RANGES[metric];
  return value >= range[0] && value <= range[1] ? value : undefined;
}

const RANGES: Record<string, [number, number]> = {
  // A merged night; the 18h ceiling is also enforced upstream.
  sleepHours: [0.5, 18],
  // RMSSD. Below 5 ms is a dropout; above 300 ms is an artefact, not an athlete.
  hrvMs: [5, 300],
  // Elite endurance athletes reach the high 20s; above 120 is a reading taken
  // while moving, not at rest.
  restingHr: [25, 120],
  steps: [0, 200_000],
  activeEnergyKcal: [0, 10_000],
};
