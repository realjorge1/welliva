/**
 * services/cycle/water.ts — "that's water, not fat".
 *
 * Before a period the scale often jumps by water. Someone trying to lose weight
 * reads that as failure, and a calorie model reads it as fat. welliva holds both
 * the weight and the cycle, so it can say what is going on, from HER OWN history:
 *
 *   "Up 1.1 kg from earlier in your cycle. The same happened before 3 of your
 *    last 4 periods with enough weigh-ins and was gone by day 4. It's most likely
 *    water, not fat."
 *
 * ./patterns' `weightPattern` decides whether she has that history. This module
 * decides whether TODAY's reading is one of those moments, and which days the
 * calorie model should trust less because of it.
 *
 * BEFORE THE PATTERN EXISTS it says so once, honestly, as what it is: a general
 * fact about many people, and a promise to find out whether it's true of her.
 * Never a claim about this reading.
 *
 * It tells her what the scale is doing and nothing about what to do. It never
 * suggests eating less, because of a rise or for any other reason.
 *
 * Only in the modes that predict, because it needs to know a period is coming:
 * it stays silent on hormonal contraception, in pregnancy and with menopause.
 */

import { addDays, daysBetween } from "./dates";
import {
  WEIGHT_JUMP_KG,
  WEIGHT_PRE_DAYS,
  weightBaseSpan,
  weightPreSpan,
  type CyclePattern,
  type WeighInPoint,
} from "./patterns";
import type { CycleMode, CycleRecord, CycleToday, Prediction } from "./predict";

/** The rise can still be water on these days of the period ("gone by day 4" is typical). */
export const WATER_PERIOD_DAYS = 4;
/** How long the cycle screen keeps talking about a reading. After that it's old news. */
export const WATER_RECENT_DAYS = 3;
/** With no reading in the baseline days, the last one before the rise may stand in — if it's this recent. */
const WATER_LOOKBACK_DAYS = 21;

export const WATER_FIRST_NOTE =
  "Many people hold extra water before a period. After a couple of cycles of weigh-ins, I'll know if that's true for you.";

export interface WaterMoment {
  /** "pattern": her own history says so. "first": the one-time general note. */
  kind: "pattern" | "first";
  /** The reading it is about. */
  date: string;
  upKg: number;
  text: string;
}

const predicts = (mode: CycleMode) => mode === "normal" || mode === "postpartum";
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Readings on or before `today`, one a day, oldest first. */
function dated(weighIns: readonly WeighInPoint[], today: string): WeighInPoint[] {
  const byDate = new Map<string, number>();
  for (const w of weighIns) {
    if (Number.isFinite(w.kg) && w.kg > 0 && w.date <= today) byDate.set(w.date, w.kg);
  }
  return [...byDate.entries()]
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * What to say about her latest reading, or null. It must be recent, fall in the
 * days before a period or its first days, and be at least half a kilo above her
 * weight earlier in that cycle.
 */
export function waterMoment(input: {
  mode: CycleMode;
  status: CycleToday;
  prediction: Prediction | null;
  cycles: readonly CycleRecord[];
  weighIns: readonly WeighInPoint[];
  pattern: CyclePattern | null;
  today: string;
  /** `CycleSettings.waterNoteOn`. */
  noteOn: string | null;
}): WaterMoment | null {
  const { status, prediction: p, today, pattern } = input;
  if (!predicts(input.mode) || !status.predicting || !p || status.cycleDay === null) return null;

  const readings = dated(input.weighIns, today);
  const latest = readings[readings.length - 1];
  if (!latest || daysBetween(latest.date, today) > WATER_RECENT_DAYS) return null;

  // Which cycle's rise could this reading belong to, and what was her weight before it?
  const start = addDays(today, -(status.cycleDay - 1));
  const ended = input.cycles.find((c) => c.nextStart === start) ?? null;
  let base: { from: string; to: string } | null;
  let riseFrom: string;
  if (latest.date >= start) {
    if (daysBetween(start, latest.date) + 1 <= WATER_PERIOD_DAYS) {
      base = ended ? weightBaseSpan(ended.start, start) : null;
      riseFrom = weightPreSpan(start).from;
    } else {
      riseFrom = addDays(p.earliest, -WEIGHT_PRE_DAYS);
      if (latest.date < riseFrom) return null;
      base = weightBaseSpan(start, p.likely);
    }
  } else {
    riseFrom = weightPreSpan(start).from;
    if (latest.date < riseFrom) return null;
    base = ended ? weightBaseSpan(ended.start, start) : null;
  }

  const before = readings.filter((r) => r.date < latest.date);
  const inBase = base ? before.filter((r) => r.date >= base.from && r.date <= base.to) : [];
  const standIn = [...before]
    .reverse()
    .find((r) => r.date < riseFrom && daysBetween(r.date, latest.date) <= WATER_LOOKBACK_DAYS);
  const reference = inBase.length
    ? inBase.reduce((s, r) => s + r.kg, 0) / inBase.length
    : (standIn?.kg ?? null);
  if (reference === null) return null;

  const upKg = round1(latest.kg - reference);
  if (upKg < WEIGHT_JUMP_KG) return null;

  if (pattern) {
    const gone = pattern.settledByDay ? ` and was gone by day ${pattern.settledByDay}` : "";
    return {
      kind: "pattern",
      date: latest.date,
      upKg,
      text: `Up ${upKg} kg from earlier in your cycle. The same happened before ${pattern.hits} of your last ${pattern.observed} periods with enough weigh-ins${gone}. It's most likely water, not fat.`,
    };
  }
  // Said once: it stays for the day it first appeared, and never comes back.
  if (input.noteOn && input.noteOn !== today) return null;
  return { kind: "first", date: latest.date, upKg, text: WATER_FIRST_NOTE };
}

/**
 * The days a reading can't be read as fat: the 5 before each period and its
 * first two, in every completed cycle she has, plus the run-up to the next one.
 * Only for someone whose own weigh-ins confirm the rise; for anyone else the
 * scale is what it is. The calorie model (health-os/learning) and the coach's
 * weight trend both read these, and neither is told why.
 */
export function noisyWeightDates(input: {
  pattern: CyclePattern | null;
  cycles: readonly CycleRecord[];
  status: CycleToday;
  prediction: Prediction | null;
  today: string;
}): string[] {
  if (!input.pattern) return [];
  const { today, status, prediction: p } = input;
  const days = new Set<string>();
  const add = (from: string, to: string) => {
    for (let d = from; d <= to && d <= today; d = addDays(d, 1)) days.add(d);
  };
  // Every completed cycle, which includes the first days of a period under way.
  for (const c of input.cycles) {
    const { from, to } = weightPreSpan(c.nextStart);
    add(from, to);
  }
  // And the run-up to the next one, from when the rise could begin.
  if (status.predicting && p && !status.inPeriod) add(addDays(p.earliest, -WEIGHT_PRE_DAYS), today);
  return [...days].sort();
}

/** The sentence for the coach, about her. Null without the pattern. */
export function waterForCoach(pattern: CyclePattern | null, moment: WaterMoment | null): string | null {
  if (!pattern || pattern.riseKg === undefined) return null;
  const settles = pattern.settledByDay ? ` and settles by day ${pattern.settledByDay}` : "";
  const now =
    moment?.kind === "pattern"
      ? `; her latest reading is up ${moment.upKg} kg from earlier in her cycle, most likely water, not fat`
      : "";
  return `her weight rises about ${pattern.riseKg} kg before her period${settles} (${pattern.hits} of her last ${pattern.observed} cycles with enough weigh-ins)${now}`;
}
