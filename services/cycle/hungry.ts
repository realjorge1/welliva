/**
 * services/cycle/hungry.ts — plan for the hungrier week, don't punish it.
 *
 * Many people eat more in the days before a period, and an app that only draws
 * a calorie target over those days turns something ordinary into a monthly
 * failure. welliva can see whether it's true for HER, from her own food logs,
 * and offer to plan for it:
 *
 *   "You usually eat about 250 kcal more in the 5 days before your period (in 3
 *    of your last 4 cycles with enough logs). Want me to plan for it?"
 *
 * THE TOTAL STAYS THE SAME (owner's decision). The 5 days get the extra, spread
 * as a small reduction over the 10 days before them, so her goal stays on track.
 * Never more than {@link HUNGRY_MAX_CUT} off a day, and never below the calorie
 * floor: if a floor bites, she gets less extra rather than a deeper cut. The cuts
 * come BEFORE the extra, on purpose: nothing here ever asks anyone to eat less
 * after eating more.
 *
 * ALWAYS AN OFFER. The app has no eating-disorder condition on its profile list,
 * so it can't know who this could hurt. So this is never on by default, "No
 * thanks" is final, the switch is always one tap away, and nobody under 18 or
 * underweight is offered a plan that takes calories off any day. The words never
 * say "make up for", "compensate", "earn", "burn off", "cheat" or "damage" (a
 * test holds that).
 *
 * Off in every mode but "normal": pregnancy and postpartum need their calories
 * where they are, menopause and hormonal contraception have no predicted period
 * to plan around. Nothing here reads a phase stereotype: only her logs.
 *
 * A missing value is not zero: `intake` holds days that RECORDED food only.
 */

import { confidenceWord } from "./copy";
import { addDays, formatRange } from "./dates";
import { patternCycles } from "./patterns";
import {
  median,
  type CycleMode,
  type CycleProfile,
  type CycleRecord,
  type CycleToday,
  type Prediction,
} from "./predict";
import type { CycleSettings } from "./types";

/** The hungrier stretch: the 5 days before a period starts. */
export const HUNGRY_PRE_DAYS = 5;
/** What it's compared with: cycle day 6, clear of the period... */
const HUNGRY_REST_FROM_DAY = 6;
/** ...to this many days before the cycle's end, clear of the stretch itself. */
const HUNGRY_REST_STOP_BEFORE = 6;
/** Recorded days needed in each, or the cycle isn't evidence either way. */
export const HUNGRY_MIN_PRE_DAYS = 3;
export const HUNGRY_MIN_REST_DAYS = 6;
/** A difference this size is more than day-to-day variation in what anyone eats. */
export const HUNGRY_MIN_DIFF = 150;
/** Two cycles at least, as with every pattern: one month is an anecdote. */
const HUNGRY_MIN_CYCLES = 2;
/** And at least half the cycles with enough logs, or "you usually" isn't true. */
export const HUNGRY_MIN_SHARE = 0.5;
/** The extra is quoted to the nearest 50: this is a plan, not a measurement. */
const HUNGRY_ROUND_TO = 50;
/** At most this much extra a day, whatever the logs say. */
export const HUNGRY_MAX_EXTRA = 300;
/** The extra is spread over this many days before the stretch. */
export const HUNGRY_SPREAD_DAYS = 10;
/** At most this much off any day, so an ordinary day still feels ordinary. */
export const HUNGRY_MAX_CUT = 150;
/** Less extra than this isn't worth a change to anyone's day. */
const HUNGRY_MIN_EXTRA = 50;
/** No offer to anyone younger: this plan takes calories off some days. */
const HUNGRY_MIN_AGE = 18;
/** Nor to anyone underweight (the WHO line), whatever the floor would allow. */
export const HUNGRY_MIN_BMI = 18.5;
/**
 * The offer opens when the spread days begin. The extra has to come from
 * somewhere, and once those days have passed there is nothing left to spread it
 * over, so an offer 3 days before the window would have to break "the total stays
 * the same" or do nothing until next month.
 */
const HUNGRY_OFFER_OPENS_DAYS = HUNGRY_PRE_DAYS + HUNGRY_SPREAD_DAYS;
/** How long the past of the plan is kept: the longest trend shows 90 days. */
const LEDGER_KEEP_DAYS = 120;

export interface IntakePoint {
  date: string;
  kcal: number;
}

export interface HungryPattern {
  /** The extra a day to plan for: her median difference, rounded and capped. */
  extraKcal: number;
  hits: number;
  observed: number;
  /** "3 of your last 4 cycles with enough logs" */
  scope: string;
}

/** Does she eat more in the 5 days before a period? Completed cycles, recorded days only. */
export function hungryPattern(
  cycles: readonly CycleRecord[],
  intake: readonly IntakePoint[],
): HungryPattern | null {
  const kcalOn = new Map<string, number>();
  for (const i of intake) if (Number.isFinite(i.kcal) && i.kcal > 0) kcalOn.set(i.date, i.kcal);
  const recorded = (from: string, count: number) => {
    const out: number[] = [];
    for (let k = 0; k < count; k += 1) {
      const kcal = kcalOn.get(addDays(from, k));
      if (kcal !== undefined) out.push(kcal);
    }
    return out;
  };
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  let observed = 0;
  const diffs: number[] = [];
  for (const c of patternCycles(cycles)) {
    const pre = recorded(addDays(c.nextStart, -HUNGRY_PRE_DAYS), HUNGRY_PRE_DAYS);
    const lastRestDay = c.length - HUNGRY_REST_STOP_BEFORE;
    const rest = recorded(addDays(c.start, HUNGRY_REST_FROM_DAY - 1), lastRestDay - HUNGRY_REST_FROM_DAY + 1);
    if (pre.length < HUNGRY_MIN_PRE_DAYS || rest.length < HUNGRY_MIN_REST_DAYS) continue;
    observed += 1;
    const diff = mean(pre) - mean(rest);
    if (diff >= HUNGRY_MIN_DIFF) diffs.push(diff);
  }
  const hits = diffs.length;
  if (hits < HUNGRY_MIN_CYCLES || hits < HUNGRY_MIN_SHARE * observed) return null;
  return {
    extraKcal: Math.min(HUNGRY_MAX_EXTRA, Math.round(median(diffs) / HUNGRY_ROUND_TO) * HUNGRY_ROUND_TO),
    hits,
    observed,
    scope: `${hits} of your last ${observed} cycles with enough logs`,
  };
}

/** May this person be offered, or kept on, a plan at all? */
export function hungryAllowed(mode: CycleMode, profile: Pick<CycleProfile, "age" | "bmi">): boolean {
  if (mode !== "normal") return false;
  if (profile.age !== null && profile.age !== undefined && profile.age < HUNGRY_MIN_AGE) return false;
  return profile.bmi === null || profile.bmi === undefined || profile.bmi >= HUNGRY_MIN_BMI;
}

export interface HungrySplit {
  /** Added to each of the 5 days. May be less than she usually eats extra, if a floor bit. */
  extraKcal: number;
  /** Taken off each of `cutDays`. */
  cutKcal: number;
  hungryDays: string[];
  cutDays: string[];
}

/**
 * How a predicted period's extra is laid out. The extra is always what the
 * spread can pay for: too few days left, or a target too near its floor, means a
 * smaller extra, never a deeper cut. Null when that leaves too little to matter.
 */
export function hungrySplit(input: {
  /** The most likely start of the period. */
  likely: string;
  /** The period this cycle counts from: no day of it, or of the days just after, is cut. */
  cycleStart: string;
  /** The day she said yes (or today, for an offer): nothing before it can be cut. */
  from: string;
  wantedKcal: number;
  targetKcal: number;
  floorKcal: number;
}): HungrySplit | null {
  const firstHungry = addDays(input.likely, -HUNGRY_PRE_DAYS);
  const earliestCut = addDays(input.cycleStart, HUNGRY_REST_FROM_DAY - 1);
  const hungryDays = Array.from({ length: HUNGRY_PRE_DAYS }, (_, i) => addDays(firstHungry, i));
  const cutDays = Array.from({ length: HUNGRY_SPREAD_DAYS }, (_, i) =>
    addDays(firstHungry, i - HUNGRY_SPREAD_DAYS),
  ).filter((d) => d >= input.from && d >= earliestCut);
  if (!cutDays.length) return null;

  const room = Math.min(HUNGRY_MAX_CUT, Math.max(0, input.targetKcal - input.floorKcal));
  const wantedTotal = input.wantedKcal * HUNGRY_PRE_DAYS;
  const perDay = Math.min(room, Math.ceil(wantedTotal / cutDays.length));
  const extraKcal = Math.min(
    input.wantedKcal,
    Math.floor((perDay * cutDays.length) / HUNGRY_PRE_DAYS / 10) * 10,
  );
  if (extraKcal < HUNGRY_MIN_EXTRA) return null;
  return {
    extraKcal,
    cutKcal: Math.round((extraKcal * HUNGRY_PRE_DAYS) / cutDays.length),
    hungryDays,
    cutDays,
  };
}

/* ───────────────────────────── the offer ───────────────────────────── */

export interface HungryOffer {
  /** "You usually eat about 250 kcal more in the 5 days before your period (...). Want me to plan for it?" */
  text: string;
  /** What saying yes does, in numbers. */
  detail: string;
  /** "Predicted 19–23 Oct · Fairly sure" */
  window: string;
}

export function hungryOffer(input: {
  pattern: HungryPattern | null;
  mode: CycleMode;
  profile: Pick<CycleProfile, "age" | "bmi">;
  status: CycleToday;
  prediction: Prediction | null;
  settings: Pick<CycleSettings, "planHungryWeek" | "hungryDeclined">;
  targetKcal: number | null;
  floorKcal: number | null;
  today: string;
}): HungryOffer | null {
  const { pattern, status, prediction: p, settings, today } = input;
  if (!pattern || !p || !status.predicting || status.inPeriod || status.lateBy > 0) return null;
  if (!hungryAllowed(input.mode, input.profile)) return null;
  if (settings.planHungryWeek || settings.hungryDeclined) return null;
  if (input.targetKcal === null || input.floorKcal === null) return null;
  if (today < addDays(p.likely, -HUNGRY_OFFER_OPENS_DAYS)) return null;

  const split = hungrySplit({
    likely: p.likely,
    cycleStart: p.lastStart,
    from: today,
    wantedKcal: pattern.extraKcal,
    targetKcal: input.targetKcal,
    floorKcal: input.floorKcal,
  });
  if (!split) return null;

  const days = split.cutDays.length;
  const later =
    split.extraKcal < pattern.extraKcal && input.targetKcal - input.floorKcal >= HUNGRY_MAX_CUT
      ? ` From your next cycle, about ${pattern.extraKcal}.`
      : "";
  return {
    text: `You usually eat about ${pattern.extraKcal} kcal more in the ${HUNGRY_PRE_DAYS} days before your period (in ${pattern.scope}). Want me to plan for it?`,
    detail: `Your total stays the same: about ${split.cutKcal} kcal less a day for ${days} ${
      days === 1 ? "day" : "days"
    }, then ${split.extraKcal} more on those ${HUNGRY_PRE_DAYS} days.${later}`,
    window: `Predicted ${formatRange(p.earliest, p.latest)} · ${confidenceWord(p)}`,
  };
}

/* ───────────────────────────── the plan ───────────────────────────── */

/**
 * Date → kcal for the period ahead, when she has said yes and may have it. When
 * her period actually starts the prediction moves on, and this no longer names
 * that day: the extra stops by itself.
 */
export function hungryPlanDays(input: {
  pattern: HungryPattern | null;
  mode: CycleMode;
  profile: Pick<CycleProfile, "age" | "bmi">;
  status: CycleToday;
  prediction: Prediction | null;
  settings: Pick<CycleSettings, "planHungryWeek" | "hungryPlanFrom">;
  targetKcal: number | null;
  floorKcal: number | null;
}): Record<string, number> {
  const { pattern, prediction: p, settings } = input;
  if (!settings.planHungryWeek || !settings.hungryPlanFrom) return {};
  if (!pattern || !p || !input.status.predicting || !hungryAllowed(input.mode, input.profile)) return {};
  if (input.targetKcal === null || input.floorKcal === null) return {};
  const split = hungrySplit({
    likely: p.likely,
    cycleStart: p.lastStart,
    from: settings.hungryPlanFrom,
    wantedKcal: pattern.extraKcal,
    targetKcal: input.targetKcal,
    floorKcal: input.floorKcal,
  });
  if (!split) return {};
  const out: Record<string, number> = {};
  for (const d of split.cutDays) out[d] = -split.cutKcal;
  for (const d of split.hungryDays) out[d] = split.extraKcal;
  return out;
}

/**
 * The ledger after today's plan: the past stays exactly as it was (a day's target
 * was what it was), today and the future follow the plan, old days drop off.
 * Returns `prev` itself when nothing changed, so an unchanged plan writes nothing.
 */
export function mergeHungryLedger(
  prev: Readonly<Record<string, number>>,
  plan: Readonly<Record<string, number>>,
  today: string,
): Record<string, number> {
  const floor = addDays(today, -LEDGER_KEEP_DAYS);
  const next: Record<string, number> = {};
  for (const [d, v] of Object.entries(prev)) if (d < today && d >= floor) next[d] = v;
  for (const [d, v] of Object.entries(plan)) if (d >= today) next[d] = v;
  const a = Object.keys(next).sort();
  const b = Object.keys(prev).sort();
  const same = a.length === b.length && a.every((d, i) => d === b[i] && next[d] === prev[d]);
  return same ? (prev as Record<string, number>) : next;
}

/** What the plan is doing today, on the cycle screen. Null on a day it isn't. */
export function hungryTodayLine(kcal: number): string | null {
  if (kcal > 0) return `+${kcal} kcal today. These are the days you usually eat a bit more, and your total stays the same.`;
  if (kcal < 0) return `${Math.abs(kcal)} kcal less today, evened out for your hungrier week. Your total stays the same.`;
  return null;
}

/** The line for the coach, about her. Null when she has no plan. */
export function hungryForCoach(planOn: boolean, todayKcal: number): string | null {
  if (!planOn) return null;
  const today =
    todayKcal > 0
      ? `; today's calorie target is ${todayKcal} kcal higher for it`
      : todayKcal < 0
        ? `; today's calorie target is ${Math.abs(todayKcal)} kcal lower to even it out`
        : "";
  return `she chose to plan for the hungrier days before her period, keeping her total the same${today}. Never frame eating on those days as something to make up for`;
}
