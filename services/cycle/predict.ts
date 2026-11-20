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
 *   2. What she told us at setup ("usually 28 days") is a PRIOR worth a couple
 *      of cycles, and it FADES with every cycle she logs (PRIOR_FADE) — however
 *      much her cycles vary. Day one is never blank, and after a few months it
 *      is her body, not her memory, that sets the date. (Before 2026-11-20 the
 *      prior had a fixed strength and her spread weakened her evidence, so the
 *      answer of someone whose cycles vary most never stopped counting: told
 *      28, real cycles of 36–44 → predicted 37; with PCOS, 35.)
 *   3. The answer is a RANGE: an 80% window built from her own cycle-to-cycle
 *      spread (a robust MAD, so one outlier can't inflate it) plus what we
 *      still don't know about her average. It narrows as she logs, and widens —
 *      honestly — for someone whose cycles vary.
 *   4. The starting spread is evidence-based, not one-size: cycles vary more in
 *      the first years after periods start and in the run-up to menopause, and
 *      with PCOS. Those widen the window before her logs have spoken.
 *
 * ── WHAT DOESN'T COUNT ──────────────────────────────────────────────────────
 *   · a bleed starting under 15 days after a period began — bleeding between
 *     periods, never the next one (./episodes splitEpisodes)
 *   · a gap that looks like a MISSED LOG (≥ 1.75× her typical length, and at
 *     least GAP_MIN_DAYS) — kept out of the average and asked about; she can
 *     answer "it really was that long" (counts) or "I was pregnant / on a
 *     break" (never counts). Unanswered, it still counts toward the long-cycle
 *     note as if it were one real cycle (./flags), and two such gaps in her
 *     last four cycles are a pattern, not missed logs: they are counted.
 *
 * Ovulation is estimated as 13 days before the next period — the luteal phase
 * is the steady half of the cycle — unless she has logged positive ovulation
 * tests in two or more cycles, in which case HER luteal length is used.
 *
 * Population figures: Bull et al., npj Digital Medicine 2019 (612,613 cycles) —
 * mean cycle 29.3 days, mean luteal phase 12.4–14 days, variability highest in
 * the youngest and oldest age groups.
 */

import { backtest, biasShift, calibrationScale, type Calibration } from "./backtest";
import { temperatureRise } from "./bbt";
import { addDays, daysBetween, maxDate, minDate } from "./dates";
import { MIN_COUNTED_CYCLE, resolveEnd, splitEpisodes } from "./episodes";
import { normalCdf } from "./normal";
import type { ContraceptionAnswer, CycleDays, CycleSettings, PeriodEpisode } from "./types";

export const POPULATION_CYCLE_DAYS = 29;
export const POPULATION_PERIOD_DAYS = 5;
/**
 * The textbook second half, when she has no luteal length of her own. 13, not
 * 14: Bull et al. 2019 measured a mean of 12.4 days, and 14 put the estimated
 * ovulation about a day early for most people (changed 2026-11-20).
 */
export const DEFAULT_LUTEAL_DAYS = 13;
/** "The median of her last 3–6 cycles." */
export const STATS_WINDOW = 6;
/**
 * What her setup answer is worth, in cycles of her own: two when she gave a
 * number, half a cycle when she said "not sure" (the population's 29 stands in).
 */
export const PRIOR_CYCLES = { told: 2, unsure: 0.5 } as const;
/**
 * ...and it fades by this much with every cycle she logs, whatever her spread:
 * at six cycles her answer carries under 2% of the estimate.
 */
export const PRIOR_FADE = 0.6;
/**
 * A gap is a likely MISSED LOG only past max(GAP_MIN_DAYS, 1.75 × her usual).
 * 60, not 45 (changed 2026-11-20): a 45–59 day cycle is common with PCOS and in
 * the first years after periods start, and should count, not be asked about.
 */
export const GAP_MIN_DAYS = 60;
export const GAP_FACTOR = 1.75;
/** Unanswered gaps in this many of her latest cycles... */
export const GAP_PATTERN_WINDOW = 4;
/** ...this many of them are a pattern, not a run of missed logs: they count. */
export const GAP_PATTERN_MIN = 2;
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
 * textbook 13, which stands for the 11 to 16 days the library quotes.
 */
export const TEST_HALF_WIDTH = { personal: 2, default: 3 } as const;
/** Positives more than this many days apart belong to different surges. */
export const LH_RUN_GAP_DAYS = 3;
/** Negatives can move this cycle's ovulation later by at most this many days. */
export const NEGATIVE_SHIFT_MAX_DAYS = 14;

/** What dated this cycle's ovulation besides the calendar (Prediction.testBasis). */
export type TestBasis = "positive" | "negatives" | "temperature";

/* ── the fertile window (2026-11-20, Fix 2) ──────────────────────────────────
 * Ovulation is a DISTRIBUTION around the estimate, not a day. Its spread is the
 * part of her cycle-to-cycle spread that lives in the first half (the second
 * half is the steady one), plus what we still don't know about her average:
 *
 *   sdOvulation² = max(MIN_OVULATION_SD², sigma² − lutealSd² + meanVariance)
 *
 * A day is fertile when ovulation falls on it, on the day before it, or within
 * the FERTILE_BEFORE days after it (sperm survive about five days; the egg
 * about one). The window is every day that ANY plausible ovulation day would
 * make fertile — the plausible days being the middle 60% of the distribution
 * (FERTILE_Z each side) — so it widens, and never narrows, as uncertainty
 * grows. (A "chance ≥ 20%" rule, first proposed, did the opposite at the wide
 * end: the chance of any single day falls as the spread grows, until no day
 * qualifies. Its core is kept: `fertileCore`, the days more likely fertile than
 * not.) Evidence this cycle — a positive test, a temperature rise, a run of
 * negatives — narrows the spread to TEST_OVULATION_SD.
 */
/** Days before ovulation a day can still be fertile (sperm survival). */
export const FERTILE_BEFORE = 5;
/** Days after ovulation (the egg's life). */
export const FERTILE_AFTER = 1;
/** Each side of the plausible ovulation days: the middle 60% (20% left out on each side). */
export const FERTILE_Z = 0.8416;
/** The second half's own spread in the population (Bull et al. 2019), until she has 3 samples of her own. */
export const LUTEAL_SD = 1.5;
/** Ovulation is never known to better than about a day from a calendar. */
export const MIN_OVULATION_SD = 1;
/** ...or from a test, a temperature rise or a run of negatives this cycle. */
export const TEST_OVULATION_SD = 1;
/** A day is in the CORE when it is more likely fertile than not. */
export const FERTILE_CORE_PROBABILITY = 0.5;
/** A window longer than this says why it is wide (./copy fertileWindowNote). */
export const WIDE_WINDOW_DAYS = 12;
/** Projected periods further ahead widen, up to this many days either side. */
export const MAX_AHEAD_HALF_WIDTH = 14;
/**
 * Once she is past the window she was given (Fix 3): "any day now", from today
 * to this many days ahead. Never a forecast with a number of days on it.
 */
export const LATE_WINDOW_AHEAD = 5;

/** She is past the window she was given, and no new period has started. */
export interface Overdue {
  /** Days past the end of that window. The same count as todayStatus.lateBy. */
  days: number;
  /** The window she was given, now passed. "Late" is measured against it. */
  original: { earliest: string; likely: string; latest: string };
}

/**
 * The window she was GIVEN: the original one once she is late. Everything that
 * judges or times against the forecast reads this — "late by", the check-in
 * reminder, the receipt, whether a bleed can be her period — so a rolling "any
 * day now" never resets them.
 */
export function givenWindow(p: Prediction): { earliest: string; likely: string; latest: string } {
  return p.overdue ? p.overdue.original : { earliest: p.earliest, likely: p.likely, latest: p.latest };
}

export interface DayRange {
  start: string;
  end: string;
}

export interface FertileSpan extends DayRange {
  /** The days more likely fertile than not, or null when no day is (a very uncertain cycle). */
  core: DayRange | null;
}

/**
 * The fertile window around an estimated ovulation with spread `sd` (days),
 * never reaching back before `floor` (the end of the period it follows).
 */
export function fertileSpan(ovulation: string, sd: number, floor: string | null): FertileSpan {
  const spread = Math.floor(FERTILE_Z * sd + 1e-9);
  const from = -FERTILE_BEFORE - spread;
  const to = FERTILE_AFTER + spread;
  let coreFrom: number | null = null;
  let coreTo: number | null = null;
  for (let x = from; x <= to; x += 1) {
    // Day x (relative to the estimate) is fertile when ovulation lands in [x − 1, x + 5].
    const p = normalCdf((x + FERTILE_BEFORE + 0.5) / sd) - normalCdf((x - FERTILE_AFTER - 0.5) / sd);
    if (p >= FERTILE_CORE_PROBABILITY) {
      if (coreFrom === null) coreFrom = x;
      coreTo = x;
    }
  }
  const clip = (d: string) => (floor && d < floor ? (floor <= ovulation ? floor : ovulation) : d);
  const start = clip(addDays(ovulation, from));
  const end = addDays(ovulation, to);
  let core: DayRange | null = null;
  if (coreFrom !== null && coreTo !== null) {
    const cs = clip(addDays(ovulation, coreFrom));
    const ce = addDays(ovulation, coreTo);
    core = cs <= ce ? { start: cs, end: ce } : null;
  }
  return { start, end, core };
}

/** Sample standard deviation (n − 1). */
function sampleSd(xs: readonly number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}
/** z for a two-sided 80% interval. */
const Z80 = 1.2816;
/**
 * The widest the next period's window gets, either side of the likely day. 14,
 * not 10 (2026-11-20): for cycles ranging 21 to 45 days a ±10 window landed only
 * two times in three in the simulator — the cap claimed a precision the data
 * didn't have.
 */
export const MAX_HALF_WIDTH = 14;
/** A median's sampling variance is about π/2 times a mean's of as many values. */
const MEDIAN_VARIANCE_FACTOR = Math.PI / 2;

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

/**
 * Her PERIODS from `since` on (all of them when null), oldest first: never the
 * strays, which are bleeding between periods (./episodes splitEpisodes). Every
 * reader here that means "a period" reads this.
 */
export function periodsFrom(episodes: readonly PeriodEpisode[], since: string | null = null): PeriodEpisode[] {
  return splitEpisodes(since ? episodes.filter((e) => e.start >= since) : episodes).periods;
}

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
  /**
   * A gap past the missed-log threshold she hasn't answered about, COUNTED
   * because two or more of her last GAP_PATTERN_WINDOW cycles were like it: a
   * pattern is unlikely to be all missed logs. Its question stays, so she can
   * still say she missed a log or was on a break.
   */
  assumedLong: boolean;
}

/** Her typical length for spotting a missed log: her own, else what she said. */
function gapReference(lengths: number[], usual: number | null): number {
  const plausible = lengths.filter((l) => l >= MIN_COUNTED_CYCLE && l < GAP_MIN_DAYS);
  if (plausible.length >= 2) return median(plausible);
  return usual ?? POPULATION_CYCLE_DAYS;
}

/** The length at which a gap stops looking like a cycle and starts looking like a missed log. */
export function gapThreshold(reference: number): number {
  return Math.max(GAP_MIN_DAYS, Math.round(reference * GAP_FACTOR));
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
  const live = periodsFrom(episodes, since);
  const lengths: number[] = [];
  for (let i = 1; i < live.length; i += 1) {
    lengths.push(daysBetween(live[i - 1].start, live[i].start));
  }
  const limit = gapThreshold(gapReference(lengths, settings.usualCycleDays));

  const records: CycleRecord[] = lengths.map((length, i) => {
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
      assumedLong: false,
    };
  });

  // Two or more unanswered gaps among her latest cycles are a pattern, not a
  // run of missed logs: count them (and keep asking, so she can say otherwise).
  const latest = records.slice(-GAP_PATTERN_WINDOW).filter((r) => r.status === "gap");
  if (latest.length >= GAP_PATTERN_MIN) {
    for (const r of latest) {
      r.status = "counted";
      r.assumedLong = true;
    }
  }
  return records;
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
  /** How sure `ovulation` is, in days (one SD). About a day once a test or a temperature rise dated it. */
  ovulationSd: number;
  /** The fertile window: every day a plausible ovulation would make fertile (see fertileSpan). */
  fertileStart: string;
  fertileEnd: string;
  /** Its likeliest days — more likely fertile than not — drawn strongest; null when no day is. */
  fertileCore: DayRange | null;
  lutealDays: number;
  /** True when the luteal length came from her own ovulation tests. */
  lutealPersonal: boolean;
  /**
   * The positive ovulation test this cycle's dates were moved by — the FIRST
   * positive of the surge — or null. Every surface that shows the window says
   * so (./copy).
   */
  fromTest: string | null;
  /**
   * What, besides the calendar, dated this cycle's ovulation: a positive test
   * (`fromTest`), a confirmed temperature rise (./bbt), or a run of negative
   * tests that moved it later. Null when the calendar alone did. Each reads
   * its own sentence (./copy, ./hormones, the fertile box).
   */
  testBasis: TestBasis | null;
  /** How sure the CALENDAR estimate is. A test-dated window says "From your test" instead (./copy). */
  confidence: Confidence;
  /** Her cycle-to-cycle spread, in days: what each cycle further ahead adds. */
  cycleSd: number;
  /**
   * The period after the next one, a cycle of spread wider (./predict
   * projectAhead): the phone calendar's "rough" mark and the trip check read
   * this one window. Null while she is late: nothing is projected a cycle on
   * from a date she has already passed.
   */
  afterNext: { earliest: string; likely: string; latest: string } | null;
  /**
   * She is past the window she was given (Fix 3). Then earliest/likely/latest
   * are a rolling "any day now" (today to LATE_WINDOW_AHEAD days ahead), and
   * `overdue.original` is what she was given — use givenWindow() for anything
   * that judges or times against the forecast.
   */
  overdue: Overdue | null;
  /**
   * This cycle's ovulation and fertile window can be shown: false once she is
   * late, unless a positive test or a temperature rise dated them. Every
   * surface that draws the window or names the ovulation day checks it.
   */
  fertileKnown: boolean;
  /**
   * How her recent forecasts did (./backtest): `hits` of the last `n` landed
   * inside the window. Null below MIN_BACKTEST. The cycle screen says it back
   * from 4 up, and the window's width is scaled by it.
   */
  calibration: Calibration | null;
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
  const closed = splitEpisodes(episodes)
    .periods.filter((e) => e.end && !e.endEstimated)
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
 * The day a cycle's LH SURGE began: the FIRST positive of the latest run of
 * positives logged from `from` to `to`. Positives more than LH_RUN_GAP_DAYS
 * apart are different runs. A surge usually reads positive for 1 to 3 days,
 * and ovulation follows about a day after it BEGINS — so the first positive
 * dates it (before 2026-11-20 the last one did, a day or two late).
 *
 * One rule for every reader — the luteal learning below, this cycle's live
 * update in `predict`, "when to start testing" (./nextDates) and the past
 * ovulations the doctor checks read through `lutealFor` — so what she has
 * learned and what she sees today measure from the same test.
 */
export function surgeStart(days: CycleDays, from: string, to: string): string | null {
  let runStart: string | null = null;
  let lastPositive: string | null = null;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (days[d]?.ovulationTest !== "positive") continue;
    if (!lastPositive || daysBetween(lastPositive, d) > LH_RUN_GAP_DAYS) runStart = d;
    lastPositive = d;
  }
  return runStart;
}

/**
 * "Not before": the day after the last of a run of NEGATIVE tests at or past
 * the estimate, when no positive has been logged this cycle. Negatives on at
 * least 2 of the 3 days ending on a negative day D, with D on or after the
 * estimated ovulation less a day, say the surge hasn't come yet: ovulation is
 * not before D + 1. Null when the negatives say nothing new.
 */
export function negativesNotBefore(
  days: CycleDays,
  estimatedOvulation: string,
  today: string,
): string | null {
  let found: string | null = null;
  for (let d = addDays(estimatedOvulation, -1); d <= today; d = addDays(d, 1)) {
    if (days[d]?.ovulationTest !== "negative") continue;
    const before = [addDays(d, -1), addDays(d, -2)].filter((x) => days[x]?.ovulationTest === "negative").length;
    if (before >= 1) found = d;
  }
  if (!found) return null;
  const notBefore = addDays(found, 1);
  return notBefore > estimatedOvulation ? notBefore : null;
}

/** Is any of the sorted `dates` within [from, to]? */
function anyWithin(dates: readonly string[], from: string, to: string): boolean {
  return dates.some((d) => d >= from && d <= to);
}

/**
 * One luteal sample from a completed cycle: from her LH surge, else from a
 * temperature rise. `positives` and `readings` are the dates that hold either
 * at all, so a cycle with neither is never walked day by day.
 */
function lutealSample(
  c: CycleRecord,
  days: CycleDays,
  pcos: boolean,
  positives: readonly string[],
  readings: readonly string[],
): number | null {
  const testFrom = addDays(c.start, LIVE_TEST_MIN_DAY);
  const testTo = addDays(c.start, c.length - 7);
  const lh = !pcos && anyWithin(positives, testFrom, testTo) ? surgeStart(days, testFrom, testTo) : null;
  const riseFrom = addDays(c.start, LIVE_TEST_MIN_DAY + 1);
  const riseTo = addDays(c.start, c.length - 1);
  const ovulation = lh
    ? addDays(lh, 1)
    : anyWithin(readings, riseFrom, riseTo)
      ? (temperatureRise(days, riseFrom, riseTo)?.ovulation ?? null)
      : null;
  if (!ovulation) return null;
  const luteal = daysBetween(ovulation, c.nextStart);
  return luteal >= 9 && luteal <= 17 ? luteal : null;
}

/**
 * Her luteal phase from her own signs, one sample per completed cycle: LH
 * surges (ovulation about a day after the surge begins), else a confirmed
 * temperature rise (./bbt) — the second half for someone who doesn't buy
 * tests. With PCOS on the profile only temperature counts: an LH test can read
 * positive there without ovulation.
 */
export function personalLuteal(cycles: readonly CycleRecord[], days: CycleDays, pcos = false): number[] {
  const positives: string[] = [];
  const readings: string[] = [];
  for (const [d, log] of Object.entries(days)) {
    if (log.ovulationTest === "positive") positives.push(d);
    if (log.temperatureC !== undefined) readings.push(d);
  }
  if (!positives.length && !readings.length) return [];
  const out: number[] = [];
  for (const c of cycles) {
    if (c.status !== "counted") continue;
    const luteal = lutealSample(c, days, pcos, positives, readings);
    if (luteal !== null) out.push(luteal);
  }
  return out;
}

/**
 * The luteal length the prediction uses: hers (the median of her own samples)
 * once two or more completed cycles have one, else the textbook 13. Anything
 * that estimates when she ovulated in a PAST cycle (./doctorChecks) reads this
 * too, so the two can never disagree.
 */
export function lutealFor(
  cycles: readonly CycleRecord[],
  days: CycleDays,
  pcos = false,
): { days: number; personal: boolean; samples: number[] } {
  const samples = personalLuteal(cycles, days, pcos);
  const personal = samples.length >= 2;
  return { days: personal ? Math.round(median(samples)) : DEFAULT_LUTEAL_DAYS, personal, samples };
}

/**
 * When the next period is likely, and how sure that is — with the window
 * checked against her own recent periods and scaled by how often it landed
 * (./backtest, Fix 8).
 */
export function predict(input: PredictInput): Prediction | null {
  return forecast(input, true);
}

/** The forecast; `calibrate` false for the backtest's own re-runs (no forecast checks itself checking itself). */
function forecast(input: PredictInput, calibrate: boolean): Prediction | null {
  const { settings, today } = input;
  const mode = cycleModeOf(input.profile?.conditions, settings.contraception?.answer);
  // Nothing to predict: paused, or bleeding that follows a method. Returning
  // here is what makes the fertile window impossible to compute in either.
  if (mode === "pregnancy" || mode === "hormonal") return null;
  const since = countFrom(settings, mode);
  const live = periodsFrom(input.episodes, since);
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

  // What she told us, worth a couple of cycles at first and fading with every
  // cycle she logs; then her own median. The weights never depend on her
  // spread, so a variable cycle can't keep a wrong setup answer alive.
  const told = settings.usualCycleDays;
  const prior = told ?? POPULATION_CYCLE_DAYS;
  const w0 = (told ? PRIOR_CYCLES.told : PRIOR_CYCLES.unsure) * PRIOR_FADE ** n;
  const evidence = n ? median(recentLengths) : prior;
  const meanLength = (w0 * prior + n * evidence) / (w0 + n);
  // What we still don't know about her average: her spread over the cycles'
  // worth of information we have. Her own cycles enter as a MEDIAN, which
  // wobbles about π/2 times as much as a mean of as many cycles; her setup
  // answer enters as itself.
  const meanVariance = (sigma * sigma * (w0 + n * MEDIAN_VARIANCE_FACTOR)) / ((w0 + n) * (w0 + n));
  const sd = Math.sqrt(sigma * sigma + meanVariance);
  // Checked against her own recent periods: widened if it kept missing,
  // tightened a little if it always landed — never below a day. Only where a
  // cycle is forecast at all (menopause computes this, but never shows it).
  const calibration =
    calibrate && (mode === "normal" || mode === "postpartum")
      ? backtest(input, cycles, (i) => forecast(i, false))
      : null;
  const halfWidth = clamp(Math.round(Z80 * sd * calibrationScale(calibration)), 1, MAX_HALF_WIDTH);
  const cycleLength = Math.round(meanLength);

  const last = live[live.length - 1];
  const period = typicalPeriodLength(live, settings);
  const pcos = !!input.profile?.conditions?.includes("pcos");
  const { days: lutealDays, personal: lutealPersonal, samples: lutealSamples } = lutealFor(cycles, input.days, pcos);

  // Evidence about THIS cycle replaces the calendar's estimate, even where the
  // calendar's window was narrower — only in the modes that predict a cycle
  // (menopause logs only):
  //   · a positive test: ovulation the day after the surge began
  //   · a confirmed temperature rise (./bbt): ovulation the day before it
  //   · a run of negatives past the estimate: ovulation not before the day
  //     after the last of them, capped at NEGATIVE_SHIFT_MAX_DAYS
  // With PCOS on the profile, LH tests (positive or negative) move nothing —
  // they can read positive without ovulation — but a temperature rise does.
  const cyclic = mode === "normal" || mode === "postpartum";
  // Her recent forecasts kept landing on one side (./backtest meanError): move
  // the calendar's likely day toward where her periods have been coming.
  const shift = biasShift(calibration);
  const calendarLikely = addDays(last.start, cycleLength + shift);
  const calendarOvulation = addDays(calendarLikely, -lutealDays);
  const fromTest = cyclic && !pcos ? surgeStart(input.days, addDays(last.start, LIVE_TEST_MIN_DAY), today) : null;
  const rise =
    cyclic && !fromTest ? temperatureRise(input.days, addDays(last.start, LIVE_TEST_MIN_DAY + 1), today) : null;
  const notBefore =
    cyclic && !pcos && !fromTest && !rise ? negativesNotBefore(input.days, calendarOvulation, today) : null;
  let ovulation = calendarOvulation;
  let testBasis: TestBasis | null = null;
  if (fromTest) {
    ovulation = addDays(fromTest, 1);
    testBasis = "positive";
  } else if (rise) {
    ovulation = rise.ovulation;
    testBasis = "temperature";
  } else if (notBefore) {
    ovulation = minDate(notBefore, addDays(calendarOvulation, NEGATIVE_SHIFT_MAX_DAYS));
    testBasis = "negatives";
  }
  const likely = testBasis ? addDays(ovulation, lutealDays) : calendarLikely;
  const windowHalf = testBasis
    ? lutealPersonal
      ? TEST_HALF_WIDTH.personal
      : TEST_HALF_WIDTH.default
    : halfWidth;
  // How sure the ovulation estimate is (see FERTILE_BEFORE's note): her first
  // half's share of her spread, or a day once this cycle's own signs dated it.
  const lutealSpread = lutealSamples.length >= 3 ? sampleSd(lutealSamples) : LUTEAL_SD;
  const ovulationSd = testBasis
    ? TEST_OVULATION_SD
    : Math.sqrt(Math.max(MIN_OVULATION_SD ** 2, sigma * sigma - lutealSpread ** 2 + meanVariance));
  // The fertile window never reaches back into the period it follows.
  const fertile = fertileSpan(ovulation, ovulationSd, addDays(last.start, period.days));
  // The period after the next: one more cycle of her spread on top.
  const nextLikely = addDays(likely, cycleLength);
  const nextHalf = aheadHalfWidth(windowHalf, sigma, 1);

  // LATE IS INFORMATION (Fix 3). Past the window she was given, with no new
  // period, the old dates are stale: the forward window rolls ("any day now",
  // from today), nothing is projected a cycle on from a missed date, and this
  // cycle's ovulation is unconfirmed unless a positive test or a temperature
  // rise dated it. "Late by" keeps counting against the window she was given.
  const earliest = addDays(likely, -windowHalf);
  const latest = addDays(likely, windowHalf);
  const overdue: Overdue | null =
    cyclic && today > latest
      ? { days: daysBetween(latest, today), original: { earliest, likely, latest } }
      : null;
  const fertileKnown = !overdue || testBasis === "positive" || testBasis === "temperature";

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
    earliest: overdue ? today : earliest,
    likely: overdue ? addDays(today, 1) : likely,
    latest: overdue ? addDays(today, LATE_WINDOW_AHEAD) : latest,
    periodLength: period.days,
    periodBasis: period.basis,
    ovulation,
    ovulationSd,
    fertileStart: fertile.start,
    fertileEnd: fertile.end,
    fertileCore: fertile.core,
    fertileKnown,
    lutealDays,
    lutealPersonal,
    fromTest,
    testBasis,
    confidence,
    cycleSd: sigma,
    afterNext: overdue
      ? null
      : {
          earliest: addDays(nextLikely, -nextHalf),
          likely: nextLikely,
          latest: addDays(nextLikely, nextHalf),
        },
    overdue,
    calibration,
  };
}

/** Days either side of a period `k` cycles past the next one: each cycle ahead adds her spread. */
export function aheadHalfWidth(halfWidth: number, cycleSd: number, k: number): number {
  return clamp(Math.round(Math.sqrt(halfWidth * halfWidth + k * (Z80 * cycleSd) ** 2)), 1, MAX_AHEAD_HALF_WIDTH);
}

export interface CycleAhead {
  /** The period `k` cycles after the next one. */
  period: { earliest: string; likely: string; latest: string };
  /** The fertile window of the cycle that ends with it, wider with every cycle ahead. */
  fertile: FertileSpan;
  ovulation: string;
}

/**
 * The calendar's projection `k` (≥ 1) cycles past the next period: the period
 * that ends that cycle, and the fertile window inside it. Each cycle ahead adds
 * one more cycle of her spread to both (sd_k² = sd² + k × sigma²), so the
 * further out, the wider — and the calendar draws it lighter.
 */
export function projectAhead(p: Prediction, k: number): CycleAhead {
  const start = addDays(p.likely, (k - 1) * p.cycleLength);
  const likely = addDays(p.likely, k * p.cycleLength);
  const half = aheadHalfWidth(p.halfWidth, p.cycleSd, k);
  const ovulation = addDays(likely, -p.lutealDays);
  const ovulationSd = Math.sqrt(p.ovulationSd * p.ovulationSd + k * p.cycleSd * p.cycleSd);
  return {
    period: { earliest: addDays(likely, -half), likely, latest: addDays(likely, half) },
    fertile: fertileSpan(ovulation, ovulationSd, addDays(start, p.periodLength)),
    ovulation,
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
  /**
   * Today is inside the fertile window — the whole window, which widens when
   * her cycles vary (see `phase` for the best estimate). Only where predicted.
   */
  inFertileWindow: boolean;
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
  const live = periodsFrom(input.episodes, since);
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
    inFertileWindow: false,
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

  // Against the window she was GIVEN: once she is late the forecast rolls
  // forward ("any day now"), but "late by" keeps counting from that window.
  const given = givenWindow(prediction);
  const toLikely = daysBetween(today, given.likely);
  const toEarliest = daysBetween(today, given.earliest);
  const toLatest = daysBetween(today, given.latest);
  const lateBy = !inPeriod && toLatest < 0 ? -toLatest : 0;

  // The PHASE follows the best estimate of ovulation: the days its own fertile
  // span covers ([ovulation − 5, ovulation + 1]). The wider window — every day
  // a plausible ovulation would make fertile — is `inFertileWindow`, so a wide,
  // uncertain window never tells her "oestrogen at its peak" on a day the
  // estimate puts after ovulation (./hormones), while the label still says
  // "fertile window" on every day the window covers (./copy phaseLabel).
  const phaseStart = maxDate(addDays(prediction.ovulation, -FERTILE_BEFORE), prediction.fertileStart);
  const phaseEnd = addDays(prediction.ovulation, FERTILE_AFTER);
  let phase: Phase;
  if (inPeriod) phase = "period";
  else if (lateBy > 0) phase = "late";
  else if (today >= phaseStart && today <= phaseEnd) phase = "fertile";
  else if (today < phaseStart) phase = "follicular";
  else phase = "luteal";
  const inFertileWindow =
    !inPeriod && lateBy === 0 && today >= prediction.fertileStart && today <= prediction.fertileEnd;

  return {
    ...base,
    phase,
    inFertileWindow,
    toLikely,
    toEarliest,
    toLatest,
    lateBy,
    // This cycle's expected length, so the top of the dial is the likely start
    // even when a positive test has moved it off her usual length — and once
    // she is late, the circle stretches to today.
    ringDays: Math.max(daysBetween(prediction.lastStart, given.likely), cycleDay),
  };
}
