/**
 * services/cycle/doctorChecks.ts — three "worth mentioning to a doctor" checks
 * read from what she logs around her periods (owner-approved 2026-11-12/13).
 *
 *   cramps that stop her day — the "Kept me from school, work or plans" chip
 *                              under Cramps. Pain that stops a normal day is
 *                              the sign clinicians look for.
 *   heavy periods            — a heavy flow on several days, period after
 *                              period; with low energy logged inside them, a
 *                              blood test for iron is worth asking about.
 *   bleeding between periods — any flow, spotting included, logged well clear
 *                              of a period. Spotting right around her
 *                              estimated ovulation is common: it is EXPLAINED
 *                              where she logs it, never counted here.
 *
 * Each returns the evidence in her own numbers, or null below its gate.
 * ./flags turns the evidence into a note that names no condition, and the
 * library pages quote these same thresholds (a test holds them together).
 *
 * THE STANDARD (./patterns): only periods and cycles that are OVER count, and
 * a missing value is not zero — a period with no flow logged says nothing
 * about how heavy it was, so it is left out rather than counted as light.
 */

import { addDays, daysBetween } from "./dates";
import { resolveEnd, splitEpisodes } from "./episodes";
import { ovulationFor, type CycleMode, type CycleRecord, type Prediction } from "./predict";
import type { CycleDayLog, CycleDays, PeriodEpisode } from "./types";

/* ───────────────────────────── thresholds ───────────────────────────── */

/** Cramps often start a day or two before the bleeding: those days belong to that period's cramps. */
export const CRAMP_LEAD_DAYS = 2;
/** Read her last three periods that had cramps... */
export const DISRUPTIVE_WINDOW = 3;
/** ...and speak when cramps stopped her day in two of them: once is a bad month, twice is a pattern. */
export const DISRUPTIVE_MIN_PERIODS = 2;

/** A period says something about its flow only when flow was logged on at least this many of its days. */
export const HEAVY_MIN_FLOW_DAYS = 2;
/** Heavy flow on this many days of one period is more than one heavy day. */
export const HEAVY_DAYS = 3;
/** In this many... */
export const HEAVY_MIN_PERIODS = 2;
/** ...of her last this-many periods that say something about flow. */
export const HEAVY_WINDOW = 3;
/** Low energy on this many days inside those heavy periods: worth asking for iron to be checked. */
export const HEAVY_TIRED_DAYS = 2;

/** A little spotting this close either side of a period is ordinary. */
export const BETWEEN_MARGIN_DAYS = 2;
/** Spotting this close to her estimated ovulation is common: explained where she logs it, never counted. */
export const OVULATION_SPOTTING_DAYS = 1;
/** Bleeding between periods in this many... */
export const BETWEEN_MIN_CYCLES = 2;
/** ...of her last this-many completed cycles. */
export const BETWEEN_WINDOW = 3;

/* ───────────────────────────── periods ───────────────────────────── */

export interface PeriodSpan {
  start: string;
  /** Last day, inclusive: the one she logged, or the assumed end of one she never closed. */
  end: string;
}

/**
 * Periods that are over, oldest first: a period still running hasn't said
 * what it will be. `since` drops the ones before a fresh start (after a birth,
 * after stopping a hormonal method), like every other reader of her history.
 */
export function completedPeriods(
  episodes: readonly PeriodEpisode[],
  today: string,
  typicalBleed: number,
  since: string | null = null,
): PeriodSpan[] {
  const out: PeriodSpan[] = [];
  // Periods only: a stray is bleeding between periods (./episodes splitEpisodes).
  for (const e of splitEpisodes(episodes).periods) {
    if (since && e.start < since) continue;
    const r = resolveEnd(e, today, typicalBleed);
    if (r.ongoing || r.end > today) continue;
    out.push({ start: e.start, end: r.end });
  }
  return out;
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const n = daysBetween(from, to);
  for (let i = 0; i <= n; i += 1) out.push(addDays(from, i));
  return out;
}

/* ───────────────────────── cramps that stop her day ───────────────────────── */

export interface DisruptiveCramps {
  /** Periods in which cramps kept her from her day. */
  hits: number;
  /** Her last periods with cramps that were read (at most DISRUPTIVE_WINDOW). */
  observed: number;
  /** Every day the chip was ticked, across those periods — the note's "N days in all". */
  days: string[];
}

export function disruptiveCramps(spans: readonly PeriodSpan[], days: CycleDays): DisruptiveCramps | null {
  const read: { stopped: string[] }[] = [];
  let prevEnd: string | null = null;
  for (const p of spans) {
    // The lead-in days, but never reaching back into the period before.
    let from = addDays(p.start, -CRAMP_LEAD_DAYS);
    if (prevEnd && from <= prevEnd) from = addDays(prevEnd, 1);
    prevEnd = p.end;
    const window = datesBetween(from, p.end);
    const cramps = window.filter((d) => !!days[d]?.symptoms?.includes("cramps"));
    if (!cramps.length) continue;
    read.push({ stopped: cramps.filter((d) => days[d]?.stoppedDay === true) });
  }
  const recent = read.slice(-DISRUPTIVE_WINDOW);
  const hit = recent.filter((p) => p.stopped.length > 0);
  if (recent.length < DISRUPTIVE_MIN_PERIODS || hit.length < DISRUPTIVE_MIN_PERIODS) return null;
  return { hits: hit.length, observed: recent.length, days: hit.flatMap((p) => p.stopped) };
}

/* ───────────────────────────── heavy periods ───────────────────────────── */

export interface HeavyPeriods {
  hits: number;
  /** Her last periods that said something about flow (at most HEAVY_WINDOW). */
  observed: number;
  /** Heavy days in each period that had enough of them, oldest first. */
  heavyDays: number[];
  /** First days of those periods. */
  starts: string[];
  /** Days she logged low energy inside those heavy periods. */
  tiredDays: number;
  /** Enough of them to suggest asking for iron to be checked. */
  tired: boolean;
  /**
   * The periods read are simply her last ones: none in that stretch was left
   * out for want of flow logs. When false the note names the denominator as
   * "the recent periods you logged flow in", never "your last".
   */
  consecutive: boolean;
}

export function heavyPeriods(spans: readonly PeriodSpan[], days: CycleDays): HeavyPeriods | null {
  const read = spans
    .map((p, index) => {
      const window = datesBetween(p.start, p.end);
      return {
        index,
        start: p.start,
        flowDays: window.filter((d) => !!days[d]?.flow).length,
        heavy: window.filter((d) => days[d]?.flow === "heavy").length,
        tired: window.filter((d) => days[d]?.energy === "low").length,
      };
    })
    .filter((p) => p.flowDays >= HEAVY_MIN_FLOW_DAYS);
  const recent = read.slice(-HEAVY_WINDOW);
  const hit = recent.filter((p) => p.heavy >= HEAVY_DAYS);
  if (hit.length < HEAVY_MIN_PERIODS) return null;
  const tiredDays = hit.reduce((s, p) => s + p.tired, 0);
  return {
    hits: hit.length,
    observed: recent.length,
    heavyDays: hit.map((p) => p.heavy),
    starts: hit.map((p) => p.start),
    tiredDays,
    tired: tiredDays >= HEAVY_TIRED_DAYS,
    consecutive: recent.every((p, i) => p.index === spans.length - recent.length + i),
  };
}

/* ───────────────────────── bleeding between periods ───────────────────────── */

/** Is `date` within OVULATION_SPOTTING_DAYS of `ovulation`? */
export function nearOvulation(date: string, ovulation: string): boolean {
  return Math.abs(daysBetween(ovulation, date)) <= OVULATION_SPOTTING_DAYS;
}

export interface BetweenPeriods {
  hits: number;
  /** Her last completed cycles that were read (at most BETWEEN_WINDOW). */
  observed: number;
  /** The first such day in each cycle that had one, oldest first — for the note. */
  firsts: string[];
  /** Every such day — the note's signature. */
  days: string[];
}

/**
 * The days a stray episode (./episodes splitEpisodes) says she bled: its first
 * day always, and the rest of its span only when she ended it herself. A
 * guessed end is not evidence of bleeding — the old code closed a one-day
 * mid-cycle flow at her typical period length.
 */
export function strayBleedDays(
  episodes: readonly PeriodEpisode[],
  since: string | null = null,
): Set<string> {
  const out = new Set<string>();
  for (const s of splitEpisodes(episodes).strays) {
    if (since && s.start < since) continue;
    out.add(s.start);
    if (s.end && !s.endEstimated) {
      for (let d = addDays(s.start, 1); d <= s.end; d = addDays(d, 1)) out.add(d);
    }
  }
  return out;
}

/**
 * Bleeding logged between periods in her last completed cycles. A day counts
 * when it has any flow (or a stray episode covers it: `strayDays`), sits more
 * than BETWEEN_MARGIN_DAYS after the period that opened its cycle and more
 * than that before the next one, and is NOT SPOTTING within
 * OVULATION_SPOTTING_DAYS of the cycle's estimated ovulation (the next start
 * less the luteal length the prediction uses). Only spotting is left out
 * there: that is the common thing, and it is what the note says it ignores.
 */
export function betweenPeriods(
  cycles: readonly CycleRecord[],
  spans: readonly PeriodSpan[],
  days: CycleDays,
  lutealDays: number,
  strayDays: ReadonlySet<string> = new Set(),
): BetweenPeriods | null {
  const endOf = new Map(spans.map((p) => [p.start, p.end]));
  const recent = cycles.filter((c) => c.status === "counted").slice(-BETWEEN_WINDOW);
  if (recent.length < BETWEEN_MIN_CYCLES) return null;
  const firsts: string[] = [];
  const all: string[] = [];
  for (const c of recent) {
    const periodEnd = endOf.get(c.start);
    if (!periodEnd) continue;
    const ovulation = addDays(c.nextStart, -lutealDays);
    const found: string[] = [];
    for (let d = addDays(periodEnd, BETWEEN_MARGIN_DAYS + 1); daysBetween(d, c.nextStart) > BETWEEN_MARGIN_DAYS; d = addDays(d, 1)) {
      const flow = days[d]?.flow;
      if (!flow && !strayDays.has(d)) continue;
      if (flow === "spotting" && nearOvulation(d, ovulation)) continue;
      found.push(d);
    }
    if (found.length) {
      firsts.push(found[0]);
      all.push(...found);
    }
  }
  if (firsts.length < BETWEEN_MIN_CYCLES) return null;
  return { hits: firsts.length, observed: recent.length, firsts, days: all };
}

/** What the day sheet says, in place of a warning, under spotting logged right around ovulation. */
export const OVULATION_SPOTTING_LINE = "Light spotting around the middle of the cycle is common, often around ovulation.";

/**
 * The explanation for spotting logged on `date`, or null. Only for spotting
 * on a day outside any period, within OVULATION_SPOTTING_DAYS of that cycle's
 * estimated ovulation. It names no date, so it is fine with the fertile window
 * off. Only where cycles are estimated (normal, postpartum): in menopause any
 * bleeding is worth checking, and hormonal contraception has no estimate.
 */
export function spottingNote(input: {
  date: string;
  log: CycleDayLog | undefined;
  inPeriod: boolean;
  mode: CycleMode;
  prediction: Prediction | null;
  cycles: readonly CycleRecord[];
}): string | null {
  if (input.log?.flow !== "spotting" || input.inPeriod) return null;
  if (input.mode !== "normal" && input.mode !== "postpartum") return null;
  const ovulation = ovulationFor(input.date, input.prediction, input.cycles);
  return ovulation && nearOvulation(input.date, ovulation) ? OVULATION_SPOTTING_LINE : null;
}

/* ───────────────────────────── the words ───────────────────────────── */

/** "in 2 of your last 3 periods with cramps", "in both of your last 2 …", "in all of your last 3 …". */
export function ofYourLast(hits: number, observed: number, noun: string): string {
  if (hits === observed) return observed === 2 ? `in both of your last 2 ${noun}` : `in all of your last ${observed} ${noun}`;
  return `in ${hits} of your last ${observed} ${noun}`;
}

/**
 * The same, when some recent ones were left out for want of logs: "in 2 of
 * the 3 recent periods you logged flow in". The unlogged ones were never
 * evidence either way, so they are never in the count.
 */
export function ofTheRecent(hits: number, observed: number, noun: string): string {
  if (hits === observed) return observed === 2 ? `in both of the 2 recent ${noun}` : `in all ${observed} of the recent ${noun}`;
  return `in ${hits} of the ${observed} recent ${noun}`;
}
