/**
 * services/cycle/bleeding.ts — what a flow logged outside a period means. PURE.
 *
 * Before 2026-11-20 any light, medium or heavy flow on a day outside a period
 * OPENED A NEW PERIOD. A light bleed on cycle day 14 reset her to "period, day
 * 1", moved her next period 13 days later, and left a 13-day and a 15-day
 * "cycle" where her real 28 had been (the 2026-11-16 audit). It also meant the
 * "bleeding between periods" doctor check could only ever see spotting.
 *
 * Now a flow is classified first:
 *
 *   continues — within a couple of days of a period (./episodes' continuation
 *               rule): that period runs on, exactly as before.
 *   starts    — a period begins: a flow on or after the predicted window's
 *               earliest day less START_SLACK_DAYS, any flow once she is late,
 *               and (with no forecast to compare against) any flow at least
 *               MIN_COUNTED_CYCLE days after her last period began.
 *   between   — bleeding between periods: spotting, always; any flow fewer
 *               than MIN_COUNTED_CYCLE days after her last period began (it
 *               cannot be the next one); or her own "No" to the question below.
 *   ask       — clearly early but not impossible: ONE question in the day
 *               sheet, "Is this the start of your period?". Unanswered means
 *               no period and no change to any forecast.
 *
 * The explicit doors always mean what they say: the calendar's "this day was a
 * period day" switch, the "Period started" button and the lock-screen
 * "Started today" never come through here.
 *
 * Pregnancy and menopause keep the old rule (a period flow is a period day):
 * in menopause ANY bleeding is the event its doctor note is about, and in
 * pregnancy nothing is forecast for it to be compared with.
 */

import { addDays, daysBetween } from "./dates";
import { CONTINUATION_GAP_DAYS, liveEpisodes, MIN_COUNTED_CYCLE, resolveEnd, splitEpisodes } from "./episodes";
import { givenWindow, type CycleMode, type Prediction } from "./predict";
import type { CycleDays, Flow, PeriodEpisode } from "./types";

/** A flow this many days before the window's earliest day is close enough to be its start. */
export const START_SLACK_DAYS = 4;
/**
 * The question asks about the first two days of a run of bleeding; a run she
 * left unanswered past that stays "between" without asking again — the Period
 * switch is always there.
 */
export const ASK_RUN_DAYS = 2;

export type FlowClass = "continues" | "starts" | "between" | "ask";

export interface ClassifyInput {
  date: string;
  flow: Flow;
  episodes: readonly PeriodEpisode[];
  days: CycleDays;
  /** The forecast as of today (./predict). Null in the modes that don't predict, or before any period. */
  prediction: Prediction | null;
  mode: CycleMode;
  today: string;
  /** Her typical bleed, which resolves the end of a period she never closed. */
  typicalBleed: number;
}

/** First day of the run of consecutive days with any flow logged that `date` belongs to. */
export function flowRunStart(days: CycleDays, date: string): string {
  let start = date;
  for (let d = addDays(date, -1); days[d]?.flow; d = addDays(d, -1)) start = d;
  return start;
}

/** The first day of the run with a flow that can mean a period (light or more), or null. */
export function firstPeriodFlowDay(days: CycleDays, date: string): string | null {
  for (let d = flowRunStart(days, date); d <= date; d = addDays(d, 1)) {
    const f = days[d]?.flow;
    if (f && f !== "spotting") return d;
  }
  return days[date]?.flow && days[date]?.flow !== "spotting" ? date : null;
}

/** Her "No, bleeding between periods" for the run `date` belongs to. */
export function answeredBetween(days: CycleDays, date: string): boolean {
  return days[flowRunStart(days, date)]?.bleedAnswer === "between";
}

/** Is `date` within the continuation rule of a logged episode (before or after it)? */
function continuesAnEpisode(episodes: readonly PeriodEpisode[], date: string, today: string, typicalBleed: number): boolean {
  const live = liveEpisodes(episodes);
  const before = live.filter((e) => e.start < date).pop();
  if (before && daysBetween(resolveEnd(before, today, typicalBleed).end, date) <= CONTINUATION_GAP_DAYS + 1) return true;
  const after = live.find((e) => e.start > date);
  return !!after && daysBetween(date, after.start) <= CONTINUATION_GAP_DAYS + 1;
}

export function classifyFlowDay(input: ClassifyInput): FlowClass {
  const { date, flow, episodes, days, prediction, mode, today, typicalBleed } = input;
  if (continuesAnEpisode(episodes, date, today, typicalBleed)) return "continues";
  if (flow === "spotting") return "between";
  if (mode === "pregnancy" || mode === "menopause") return "starts";
  if (answeredBetween(days, date)) return "between";

  const periods = splitEpisodes(episodes).periods;
  const before = periods.filter((e) => e.start <= date).pop() ?? null;
  const after = periods.find((e) => e.start > date) ?? null;
  // Too soon after a period began to be the next one.
  if (before && daysBetween(before.start, date) < MIN_COUNTED_CYCLE) return "between";

  // Filling in history: a bleed logged before a period she has already logged.
  // It can be a period only if it leaves room for that next one to still be one.
  if (after) return daysBetween(date, after.start) < MIN_COUNTED_CYCLE ? "between" : "starts";

  // Nothing to compare against: the hormonal method, the first period after a
  // birth, a first-ever log. Far enough from the last one is a period.
  const forecast = prediction && (mode === "normal" || mode === "postpartum") && before?.start === prediction.lastStart;
  if (!forecast) return "starts";

  // Against the window she was GIVEN: late, any flow can be her period.
  if (date >= addDays(givenWindow(prediction).earliest, -START_SLACK_DAYS)) return "starts";
  return "ask";
}

/* ───────────────────────────── the question ───────────────────────────── */

export type BleedPrompt =
  /** "Is this the start of your period?" — `startDay` is where a "Yes" starts it. */
  | { kind: "ask"; runStart: string; startDay: string }
  /** Too soon after her last period to be a new one: said in one line. */
  | { kind: "too-soon" }
  /** She said it wasn't a period: said back, with a way to change her mind. */
  | { kind: "answered"; runStart: string; startDay: string };

/**
 * What the day sheet says under the flow chips for `date`, or null. Only for a
 * light-or-more flow on a day no episode covers, in the modes that forecast.
 */
export function bleedPrompt(input: Omit<ClassifyInput, "flow"> & { covered: boolean }): BleedPrompt | null {
  const { date, days, covered, mode } = input;
  const flow = days[date]?.flow;
  if (!flow || flow === "spotting" || covered) return null;
  if (mode !== "normal" && mode !== "postpartum") return null;
  const runStart = flowRunStart(days, date);
  const startDay = firstPeriodFlowDay(days, date) ?? date;
  if (answeredBetween(days, date)) return { kind: "answered", runStart, startDay };
  const kind = classifyFlowDay({ ...input, flow });
  if (kind === "ask") {
    // The first two days of a run; a run left unanswered past that stays quiet.
    return daysBetween(startDay, date) < ASK_RUN_DAYS ? { kind: "ask", runStart, startDay } : null;
  }
  if (kind === "between") return { kind: "too-soon" };
  return null;
}

/** The lines the day sheet shows. */
export const BLEED_COPY = {
  question: "Is this the start of your period?",
  yes: "Yes, my period started",
  no: "No, bleeding between periods",
  hint: "Until you say, it's kept as bleeding and your dates don't move.",
  tooSoon: "Logged as bleeding between periods: it's too soon after your last period to be a new one.",
  answered: "Logged as bleeding between periods.",
  changeMind: "It was my period",
} as const;
