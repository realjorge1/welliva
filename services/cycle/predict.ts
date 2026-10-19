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

import { addDays, daysBetween } from "./dates";
import { liveEpisodes, resolveEnd } from "./episodes";
import type { CycleDays, CycleSettings, PeriodEpisode } from "./types";

export const POPULATION_CYCLE_DAYS = 29;
export const POPULATION_PERIOD_DAYS = 5;
export const DEFAULT_LUTEAL_DAYS = 14;
/** Shorter than this start-to-start is spotting or a double log, not a cycle. */
export const MIN_COUNTED_CYCLE = 15;
/** "The median of her last 3–6 cycles." */
export const STATS_WINDOW = 6;
/** z for a two-sided 80% interval. */
const Z80 = 1.2816;

export type CycleMode = "normal" | "pregnancy" | "postpartum" | "menopause";

export interface CycleProfile {
  age?: number | null;
  conditions?: readonly string[];
}

/** Life stage from the profile. Pregnancy outranks postpartum outranks menopause. */
export function cycleModeOf(conditions: readonly string[] = []): CycleMode {
  if (conditions.includes("pregnancy")) return "pregnancy";
  if (conditions.includes("postpartum")) return "postpartum";
  if (conditions.includes("menopause")) return "menopause";
  return "normal";
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
 * Her luteal phase from positive ovulation tests: LH surges, ovulation follows
 * about a day later, and the next period comes a luteal phase after that.
 */
export function personalLuteal(cycles: readonly CycleRecord[], days: CycleDays): number[] {
  const out: number[] = [];
  for (const c of cycles) {
    if (c.status !== "counted") continue;
    let lh: string | null = null;
    for (let i = 6; i <= c.length - 7; i += 1) {
      const d = addDays(c.start, i);
      if (days[d]?.ovulationTest === "positive") lh = d;
    }
    if (!lh) continue;
    const luteal = daysBetween(addDays(lh, 1), c.nextStart);
    if (luteal >= 9 && luteal <= 17) out.push(luteal);
  }
  return out;
}

export function predict(input: PredictInput): Prediction | null {
  const { settings, today } = input;
  const mode = cycleModeOf(input.profile?.conditions);
  const since = mode === "postpartum" ? settings.postpartumSince : null;
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
  const likely = addDays(last.start, cycleLength);
  const period = typicalPeriodLength(live, settings);

  const lutealSamples = personalLuteal(cycles, input.days);
  const lutealPersonal = lutealSamples.length >= 2;
  const lutealDays = lutealPersonal ? Math.round(median(lutealSamples)) : DEFAULT_LUTEAL_DAYS;
  const ovulation = addDays(likely, -lutealDays);
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
    halfWidth,
    lastStart: last.start,
    earliest: addDays(likely, -halfWidth),
    likely,
    latest: addDays(likely, halfWidth),
    periodLength: period.days,
    periodBasis: period.basis,
    ovulation,
    fertileStart,
    fertileEnd,
    lutealDays,
    lutealPersonal,
    confidence,
  };
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
  const mode = cycleModeOf(input.profile?.conditions);
  const since = mode === "postpartum" ? settings.postpartumSince : null;
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
    ringDays: Math.max(prediction.cycleLength, cycleDay),
  };
}
