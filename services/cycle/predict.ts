/**
 * services/cycle/predict.ts — when the next period is likely, and how sure we are.
 *
 * ── THE MODEL ───────────────────────────────────────────────────────────────
 * Most period apps average your last few cycles and print one date. Two things
 * are wrong with that: an average is dragged around by a single odd month, and a
 * single date claims a precision the data doesn't have. So:
 *
 *   1. Her cycles are measured start-to-start. The MEDIAN of the last six that
 *      count is the evidence — one 40-day month barely moves it.
 *   2. What she told us at setup ("usually 28 days") is a PRIOR, and the logs
 *      take over as they arrive: a normal-normal update whose weight on the
 *      logs grows with every cycle. Day one is never blank, and after a few
 *      months it is her body, not her memory, that sets the date.
 *   3. The answer is a RANGE: an 80% window built from her own cycle-to-cycle
 *      spread (a robust MAD, so one outlier can't inflate it) plus what we
 *      still don't know about her average. It narrows as she logs, and widens —
 *      honestly — for someone whose cycles vary.
 *   4. The starting spread is evidence-based, not one-size: cycles vary more in
 *      the first years after periods start and in the run-up to menopause, and
 *      with PCOS. Those widen the window before her logs have spoken.
 *
 * ── WHAT DOESN'T COUNT ──────────────────────────────────────────────────────
 *   · a "cycle" under 15 days — spotting logged as a period, or a double log
 *   · a gap that looks like a MISSED LOG (≥ 1.75× her typical length, and at
 *     least 45 days) — excluded and asked about, never silently averaged in;
 *     she can answer "it really was that long" (counts) or "I was pregnant / on
 *     a break" (never counts)
 *
 * Ovulation is estimated as 14 days before the next period — the luteal phase
 * is the steady half of the cycle — unless she has logged positive ovulation
 * tests in two or more cycles, in which case HER luteal length is used.
 *
 * Population figures: Bull et al., npj Digital Medicine 2019 (612,613 cycles) —
 * mean cycle 29.3 days, mean luteal phase 12.4–14 days, variability highest in
 * the youngest and oldest age groups.
 */

import { addDays, daysBetween, maxDate } from "./dates";
import { liveEpisodes, resolveEnd } from "./episodes";
import type { ContraceptionAnswer, CycleDays, CycleSettings, PeriodEpisode } from "./types";

export const POPULATION_CYCLE_DAYS = 29;
export const POPULATION_PERIOD_DAYS = 5;
export const DEFAULT_LUTEAL_DAYS = 14;
/** Shorter than this start-to-start is spotting or a double log, not a cycle. */
export const MIN_COUNTED_CYCLE = 15;
/** "The median of her last 3–6 cycles." */
export const STATS_WINDOW = 6;
/**
 * A positive ovulation test counts as a cycle's surge from this many days
 * after the period started (cycle day 7): earlier is too soon to be it. The
 * luteal learning and the live update share it, so both measure from the
 * same test.
 */
export const LIVE_TEST_MIN_DAY = 6;
/**
 * Days either side of the likely start once a positive test has dated this
 * cycle's ovulation: about 2 when the luteal length is her own; 3 on the
 * textbook 14, which stands for the 11 to 16 days the library quotes.
 */
export const TEST_HALF_WIDTH = { personal: 2, default: 3 } as const;
/** z for a two-sided 80% interval. */
const Z80 = 1.2816;

/**
 * What the tracker is doing for her:
 *   normal     — predicting
 *   pregnancy  — paused
 *   postpartum — predicting again, from the first period after the birth
 *   menopause  — logging only
 *   hormonal   — logging only: she uses hormonal contraception, so bleeding
 *                follows the method and nothing is predicted (./contraception)
 */
export type CycleMode = "normal" | "pregnancy" | "postpartum" | "menopause" | "hormonal";

export interface CycleProfile {
  age?: number | null;
  conditions?: readonly string[];
  /** Only the hungrier-week plan reads this (./hungry). */
  bmi?: number | null;
}

/**
 * The mode, from the profile's life stage and her contraception answer.
 * Pregnancy and menopause outrank hormonal contraception; hormonal outranks
 * postpartum, because predictions from bleeds on a method are wrong whatever
 * else is true. Among the life stages: pregnancy, postpartum, menopause.
 */
export function cycleModeOf(
  conditions: readonly string[] = [],
  contraception: ContraceptionAnswer | null = null,
): CycleMode {
  if (conditions.includes("pregnancy")) return "pregnancy";
  if (contraception === "hormonal" && !conditions.includes("menopause")) return "hormonal";
  if (conditions.includes("postpartum")) return "postpartum";
  if (conditions.includes("menopause")) return "menopause";
  return "normal";
}

/**
 * The first day her history counts from, or null for all of it: after a birth
 * (postpartum), and after she stopped a hormonal method. The later one wins.
 */
export function countFrom(
  settings: Pick<CycleSettings, "postpartumSince" | "contraception">,
  mode: CycleMode,
): string | null {
  const birth = mode === "postpartum" ? settings.postpartumSince : null;
  const method = settings.contraception?.restartFrom ?? null;
  return birth && method ? maxDate(birth, method) : (birth ?? method);
}

/**
 * Whether the fertile-window estimate may appear anywhere: she asked to see
 * it, AND the mode predicts at all. In logging-only modes it is never computed
 * (predict returns null) and never labelled — this is the one switch every
 * surface reads, so there is no way to show it by reading the setting alone.
 */
export function fertileWindowAllowed(showFertileWindow: boolean, mode: CycleMode): boolean {
  return showFertileWindow && (mode === "normal" || mode === "postpartum");
}

/* ───────────────────────────── small stats ───────────────────────────── */

export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation. */
export function mad(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ───────────────────────────── cycles ───────────────────────────── */

export type CycleStatus = "counted" | "short" | "gap" | "pause";

export interface CycleRecord {
  /** First day of this cycle's period. */
  start: string;
  /** First day of the next period. */
  nextStart: string;
  /** Start to start, in days. */
  length: number;
  /** The bleed she LOGGED for this cycle; null when its end was assumed. */
  periodLength: number | null;
  status: CycleStatus;
  /** She told us this long one was real. */
  confirmedLong: boolean;
}

/** Her typical length for spotting a missed log: her own, else what she said. */
function gapReference(lengths: number[], usual: number | null): number {
  const plausible = lengths.filter((l) => l >= MIN_COUNTED_CYCLE && l <= 45);
  if (plausible.length >= 2) return median(plausible);
  return usual ?? POPULATION_CYCLE_DAYS;
}

/** The length at which a gap stops looking like a cycle and starts looking like a missed log. */
export function gapThreshold(reference: number): number {
  return Math.max(45, Math.round(reference * 1.75));
}

/**
 * Every completed cycle, oldest first. Only periods on or after `since` are
 * used (postpartum: the history before the birth doesn't predict what comes next).
 */
export function buildCycles(
  episodes: readonly PeriodEpisode[],
  settings: Pick<CycleSettings, "gapNotes" | "usualCycleDays">,
  today: string,
  since: string | null = null,
): CycleRecord[] {
  const live = liveEpisodes(episodes).filter((e) => !since || e.start >= since);
  const lengths: number[] = [];
  for (let i = 1; i < live.length; i += 1) {
    lengths.push(daysBetween(live[i - 1].start, live[i].start));
  }
  const limit = gapThreshold(gapReference(lengths, settings.usualCycleDays));

  return lengths.map((length, i) => {
    const ep = live[i];
    const note = settings.gapNotes[ep.start];
    const resolved = resolveEnd(ep, today, POPULATION_PERIOD_DAYS);
    const periodLength =
      ep.end && !resolved.assumed ? daysBetween(ep.start, ep.end) + 1 : null;
    let status: CycleStatus = "counted";
    if (length < MIN_COUNTED_CYCLE) status = "short";
    else if (note === "pause") status = "pause";
    else if (length >= limit && note !== "long") status = "gap";
    return {
      start: ep.start,
      nextStart: live[i + 1].start,
      length,
      periodLength,
      status,
      confirmedLong: note === "long",
    };
  });
}

/* ───────────────────────────── prediction ───────────────────────────── */

export type Confidence = "told" | "learning" | "confident" | "variable";

export interface Prediction {
  /** Cycles that informed the estimate, most recent first. */
  recentLengths: number[];
  /** How many logged cycles count. 0 = only what she told us. */
  basedOn: number;
  /** Her estimated average cycle, in days (unrounded). */
  meanLength: number;
  /** The same, rounded — the ring's length. */
  cycleLength: number;
  /** Spread of the next start, in days (predictive SD). */
  sd: number;
  /** Days either side of `likely` in the 80% window. */
  halfWidth: number;
  /** First day of the period this prediction counts from. */
  lastStart: string;
  earliest: string;
  likely: string;
  latest: string;
  /** Her typical bleed, in days. */
  periodLength: number;
  /** Logged periods behind `periodLength` (0 = what she told us). */
  periodBasis: number;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
  lutealDays: number;
  /** True when the luteal length came from her own ovulation tests. */
  lutealPersonal: boolean;
  /**
   * The positive ovulation test this cycle's dates were moved by, or null when
   * they come from the calendar alone. Every surface that shows the window
   * says so (./copy).
   */
  fromTest: string | null;
  /** How sure the CALENDAR estimate is. A test-dated window says "From your test" instead (./copy). */
  confidence: Confidence;
}

export interface PredictInput {
  episodes: readonly PeriodEpisode[];
  days: CycleDays;
  settings: CycleSettings;
  today: string;
  profile?: CycleProfile;
}

/**
 * Her starting cycle-to-cycle spread before her logs have spoken, in days.
 * Wider in the years just after periods begin and in the run-up to menopause,
 * and with PCOS, where long and irregular cycles are common.
 */
export function baselineSpread(profile?: CycleProfile): number {
  let sd = 2.5;
  const age = profile?.age ?? null;
  if (age !== null && (age < 20 || age > 45)) sd = 4;
  if (profile?.conditions?.includes("pcos")) sd = 5;
  return sd;
}

/** Her typical bleed length — her logged periods, starting from what she told us. */
export function typicalPeriodLength(
  episodes: readonly PeriodEpisode[],
  settings: Pick<CycleSettings, "usualPeriodDays">,
): { days: number; basis: number } {
  const closed = liveEpisodes(episodes)
    .filter((e) => e.end && !e.endEstimated)
    .map((e) => daysBetween(e.start, e.end as string) + 1)
    .filter((d) => d >= 1 && d <= 15)
    .slice(-STATS_WINDOW);
  const prior = settings.usualPeriodDays ?? POPULATION_PERIOD_DAYS;
  if (!closed.length) return { days: clamp(prior, 2, 10), basis: 0 };
  const k = closed.length;
  return {
    days: clamp(Math.round((k * median(closed) + prior) / (k + 1)), 2, 10),
    basis: k,
  };
}

/**
 * The positive ovulation test that dates a cycle's surge: the LAST positive
 * logged from `from` to `to`. One rule for both readers — the luteal learning
 * below and this cycle's live update in `predict` — so what she has learned
 * and what she sees today measure from the same test.
 */
export function lastPositiveTest(days: CycleDays, from: string, to: string): string | null {
  let lh: string | null = null;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (days[d]?.ovulationTest === "positive") lh = d;
  }
  return lh;
}

/**
 * Her luteal phase from positive ovulation tests: LH surges, ovulation follows
 * about a day later, and the next period comes a luteal phase after that.
 */
export function personalLuteal(cycles: readonly CycleRecord[], days: CycleDays): number[] {
  const out: number[] = [];
  for (const c of cycles) {
    if (c.status !== "counted") continue;
    const lh = lastPositiveTest(days, addDays(c.start, LIVE_TEST_MIN_DAY), addDays(c.start, c.length - 7));
    if (!lh) continue;
    const luteal = daysBetween(addDays(lh, 1), c.nextStart);
    if (luteal >= 9 && luteal <= 17) out.push(luteal);
  }
  return out;
}

/**
 * The luteal length the prediction uses: hers (the median from her positive
 * tests) once two or more completed cycles have one, else the textbook 14.
 * Anything that estimates when she ovulated in a PAST cycle (./doctorChecks)
 * reads this too, so the two can never disagree.
 */
export function lutealFor(cycles: readonly CycleRecord[], days: CycleDays): { days: number; personal: boolean } {
  const samples = personalLuteal(cycles, days);
  const personal = samples.length >= 2;
  return { days: personal ? Math.round(median(samples)) : DEFAULT_LUTEAL_DAYS, personal };
}

export function predict(input: PredictInput): Prediction | null {
  const { settings, today } = input;
  const mode = cycleModeOf(input.profile?.conditions, settings.contraception?.answer);
  // Nothing to predict: paused, or bleeding that follows a method. Returning
  // here is what makes the fertile window impossible to compute in either.
  if (mode === "pregnancy" || mode === "hormonal") return null;
  const since = countFrom(settings, mode);
  const live = liveEpisodes(input.episodes).filter((e) => !since || e.start >= since);
  if (!live.length) return null;

  const cycles = buildCycles(input.episodes, settings, today, since);
  const counted = cycles.filter((c) => c.status === "counted");
  const recentLengths = counted
    .slice(-STATS_WINDOW)
    .map((c) => c.length)
    .reverse();
  const n = recentLengths.length;

  // Her spread: the robust MAD of her own cycles, shrunk toward the starting
  // spread so three identical months can't claim to-the-day certainty.
  const sigma0 = baselineSpread(input.profile);
  let sigma = sigma0;
  if (n >= 3) {
    const robust = Math.max(1, 1.4826 * mad(recentLengths));
    sigma = Math.sqrt((n * robust * robust + 2 * sigma0 * sigma0) / (n + 2));
  }

  // Normal-normal update: what she told us, then her logs.
  const prior = settings.usualCycleDays ?? POPULATION_CYCLE_DAYS;
  const tau = settings.usualCycleDays ? 2 : 4;
  const evidence = n ? median(recentLengths) : prior;
  const precision = 1 / (tau * tau) + n / (sigma * sigma);
  const meanLength = (prior / (tau * tau) + (n * evidence) / (sigma * sigma)) / precision;
  const sd = Math.sqrt(sigma * sigma + 1 / precision);
  const halfWidth = clamp(Math.round(Z80 * sd), 1, 10);
  const cycleLength = Math.round(meanLength);

  const last = live[live.length - 1];
  const period = typicalPeriodLength(live, settings);
  const { days: lutealDays, personal: lutealPersonal } = lutealFor(cycles, input.days);

  // A positive test THIS cycle is evidence about this cycle: ovulation the day
  // after it, the period a luteal phase later. It replaces the calendar's
  // estimate even where the calendar's window was narrower. Not with PCOS on
  // the profile, where LH tests can read positive without ovulation, and only
  // in the modes that predict a cycle (menopause logs only).
  const pcos = !!input.profile?.conditions?.includes("pcos");
  const fromTest =
    (mode === "normal" || mode === "postpartum") && !pcos
      ? lastPositiveTest(input.days, addDays(last.start, LIVE_TEST_MIN_DAY), today)
      : null;
  const ovulation = fromTest
    ? addDays(fromTest, 1)
    : addDays(addDays(last.start, cycleLength), -lutealDays);
  const likely = fromTest ? addDays(ovulation, lutealDays) : addDays(last.start, cycleLength);
  const windowHalf = fromTest
    ? lutealPersonal
      ? TEST_HALF_WIDTH.personal
      : TEST_HALF_WIDTH.default
    : halfWidth;
  // The fertile window never reaches back into the period it follows.
  const floor = addDays(last.start, period.days);
  let fertileStart = addDays(ovulation, -5);
  if (fertileStart < floor) fertileStart = floor <= ovulation ? floor : ovulation;
  const fertileEnd = addDays(ovulation, 1);

  let confidence: Confidence;
  if (n === 0) confidence = settings.usualCycleDays ? "told" : "learning";
  else if (n <= 2) confidence = "learning";
  else confidence = halfWidth <= 3 ? "confident" : "variable";

  return {
    recentLengths,
    basedOn: n,
    meanLength,
    cycleLength,
    sd,
    halfWidth: windowHalf,
    lastStart: last.start,
    earliest: addDays(likely, -windowHalf),
    likely,
    latest: addDays(likely, windowHalf),
    periodLength: period.days,
    periodBasis: period.basis,
    ovulation,
    fertileStart,
    fertileEnd,
    lutealDays,
    lutealPersonal,
    fromTest,
    confidence,
  };
}

/**
 * Her estimated ovulation for the cycle `date` falls in: this cycle's from the
 * prediction, a completed (counted) cycle's as its next start less the luteal
 * length the prediction uses. Null with no prediction (the logging-only modes)
 * or for a day in a gap, a pause or before her first logged period.
 */
export function ovulationFor(
  date: string,
  prediction: Prediction | null,
  cycles: readonly CycleRecord[],
): string | null {
  if (!prediction) return null;
  if (date >= prediction.lastStart) return prediction.ovulation;
  const c = cycles.find((x) => x.status === "counted" && x.start <= date && date < x.nextStart);
  return c ? addDays(c.nextStart, -prediction.lutealDays) : null;
}

/* ───────────────────────────── today ───────────────────────────── */

export type Phase = "period" | "follicular" | "fertile" | "luteal" | "late";

export interface CycleToday {
  mode: CycleMode;
  /** Predictions and phases apply (normal life stage, enough to count from). */
  predicting: boolean;
  /** 1 on the first day of the current period. Null with nothing logged. */
  cycleDay: number | null;
  inPeriod: boolean;
  periodDay: number | null;
  /** The latest period has no end yet. */
  periodOpen: boolean;
  /** Open, but too old to still be running — she probably forgot to end it. */
  periodStale: boolean;
  phase: Phase | null;
  /** Days from today to the likely start and to the window edges (negative once past). */
  toLikely: number | null;
  toEarliest: number | null;
  toLatest: number | null;
  /** Days past the end of the predicted window with no new period. */
  lateBy: number;
  /** While in a period: the day it will likely end. */
  expectedEnd: string | null;
  /** How many days the cycle dial should show — the cycle, stretched if she's late. */
  ringDays: number;
}

export function todayStatus(input: PredictInput, prediction: Prediction | null): CycleToday {
  const { today, settings } = input;
  const mode = cycleModeOf(input.profile?.conditions, settings.contraception?.answer);
  const since = countFrom(settings, mode);
  const live = liveEpisodes(input.episodes).filter((e) => !since || e.start >= since);
  const last = live.length ? live[live.length - 1] : null;
  const typicalBleed = prediction?.periodLength ?? typicalPeriodLength(live, settings).days;

  const empty: CycleToday = {
    mode,
    predicting: false,
    cycleDay: null,
    inPeriod: false,
    periodDay: null,
    periodOpen: false,
    periodStale: false,
    phase: null,
    toLikely: null,
    toEarliest: null,
    toLatest: null,
    lateBy: 0,
    expectedEnd: null,
    ringDays: prediction?.cycleLength ?? settings.usualCycleDays ?? POPULATION_CYCLE_DAYS,
  };
  if (!last || last.start > today || mode === "pregnancy") return empty;

  const resolved = resolveEnd(last, today, typicalBleed);
  const inPeriod = today <= resolved.end;
  const cycleDay = daysBetween(last.start, today) + 1;
  const periodOpen = last.end === null;
  const periodStale = periodOpen && !resolved.ongoing;
  const predicting = mode !== "menopause" && prediction !== null;

  const base: CycleToday = {
    ...empty,
    cycleDay,
    inPeriod,
    periodDay: inPeriod ? cycleDay : null,
    periodOpen,
    periodStale,
    predicting,
    expectedEnd: inPeriod
      ? (() => {
          const typicalEnd = addDays(last.start, typicalBleed - 1);
          return periodOpen && typicalEnd < today ? today : (last.end ?? typicalEnd);
        })()
      : null,
  };
  if (!predicting || !prediction) {
    return { ...base, phase: inPeriod ? "period" : null, ringDays: Math.max(empty.ringDays, cycleDay) };
  }

  const toLikely = daysBetween(today, prediction.likely);
  const toEarliest = daysBetween(today, prediction.earliest);
  const toLatest = daysBetween(today, prediction.latest);
  const lateBy = !inPeriod && toLatest < 0 ? -toLatest : 0;

  let phase: Phase;
  if (inPeriod) phase = "period";
  else if (lateBy > 0) phase = "late";
  else if (today >= prediction.fertileStart && today <= prediction.fertileEnd) phase = "fertile";
  else if (today < prediction.fertileStart) phase = "follicular";
  else phase = "luteal";

  return {
    ...base,
    phase,
    toLikely,
    toEarliest,
    toLatest,
    lateBy,
    // This cycle's expected length, so the top of the dial is the likely start
    // even when a positive test has moved it off her usual length.
    ringDays: Math.max(daysBetween(prediction.lastStart, prediction.likely), cycleDay),
  };
}
