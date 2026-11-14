/**
 * services/body/scaleJump.ts — "that's water, not fat", for everyone.
 *
 * A jump on the scale is one of the moments people give up. welliva holds both
 * the weight and what was eaten, so after a weigh-in it can do the sum out loud,
 * with the person's own numbers:
 *
 *   "Up 1.2 kg since Tuesday. Putting on 1.2 kg of fat takes eating about 9,200
 *    calories more than your body burns. Since Tuesday you've logged about 400
 *    fewer than it burns. Even allowing for things you didn't log, that's
 *    nowhere near enough, so most of this is water. It usually settles within a
 *    few days."
 *
 * THE SUM IS TILTED AGAINST SAYING IT. Every rounding goes the way that makes
 * fat MORE likely, so the note can only be wrong by staying quiet:
 *   · the body is assumed to burn 10% less than the population estimate says;
 *   · every day is assumed to hide UNLOGGED_KCAL_PER_DAY of food nobody logged;
 *   · the note needs at most half the rise to be explainable as fat, and at
 *     least MIN_UNEXPLAINED_KG left over.
 *
 * GATES BEFORE CLAIMS. A day in the span with nothing recorded is unknown, not
 * zero (services/nutrition/recordedIntake), so one such day silences the note.
 * So does a previous weigh-in that is too old to compare with.
 *
 * It says what the scale is doing and never what to do about it. It never
 * suggests eating less, because of a rise or for any other reason.
 *
 * The cycle tracker has its own version, from her own cycles
 * (services/cycle/water). Where that one speaks, this one stays quiet; the
 * component that shows this one makes that call.
 */

import { addDays, daysBetween, weekdayOf } from "../cycle/dates";

/** Energy in a kilo of body fat: the usual working figure (3,500 kcal a pound). */
export const FAT_KCAL_PER_KG = 7700;
/** Smaller moves are the scale's everyday noise, not something to explain. */
export const JUMP_MIN_KG = 0.5;
/** The reading compared with must be this recent; across a longer gap, anything could have happened. */
export const LOOKBACK_MAX_DAYS = 7;
/** Assume the body burns this share of the population estimate, so possible fat is never understated. */
export const MAINTENANCE_SHARE = 0.9;
/** Assume this much food went unlogged every day: roughly a forgotten meal. */
export const UNLOGGED_KCAL_PER_DAY = 800;
/** Say "water" only when at most this share of the rise could be fat… */
export const MAX_FAT_SHARE = 0.5;
/** …and at least this much of it can't be. */
export const MIN_UNEXPLAINED_KG = 0.4;
/** A day of carbs this far over their usual counts as "more carbs than usual". */
export const CARB_HEAVY_RATIO = 1.4;
/** Days with recorded intake needed before "usual" carbs means anything. */
export const CARB_USUAL_MIN_DAYS = 7;
/** How far back "usual" carbs is read from. */
export const CARB_USUAL_DAYS = 28;

export interface ScaleDayIntake {
  /** Calories recorded for the day. Only days with something recorded belong here. */
  kcal: number;
  carbsG: number;
}

export interface ScaleJumpInput {
  /** Every weigh-in; more than one on a day keeps the last given. */
  weighIns: readonly { date: string; kg: number }[];
  /** Closed days with recorded intake, by date. A missing date is unknown. */
  intake: Readonly<Record<string, ScaleDayIntake>>;
  /** Population maintenance estimate (services/NutritionService.maintenanceTdee). */
  maintenanceKcal: number;
  /** Days a workout was logged. */
  workoutDates: readonly string[];
  today: string;
}

export interface ScaleJump {
  /** The reading it is about: always today's. */
  date: string;
  /** The reading it was compared with. */
  fromDate: string;
  upKg: number;
  /** The most of the rise that could be fat, on the tilted sum above. */
  maxFatKg: number;
  text: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "1,200": hand-made, because Hermes' Intl depends on the build. */
export function groupThousands(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Calories said the way a person would: to the nearest 100, never "0". */
function aboutKcal(n: number): string {
  return groupThousands(Math.max(100, Math.round(Math.abs(n) / 100) * 100));
}

/** "yesterday", or the weekday inside the last week. */
export function sinceWords(from: string, today: string): string {
  const gap = daysBetween(from, today);
  if (gap === 1) return "yesterday";
  return WEEKDAYS_LONG[weekdayOf(from)];
}

/** One reading a day, the last one given winning, oldest first. */
function byDay(weighIns: ScaleJumpInput["weighIns"], today: string) {
  const days = new Map<string, number>();
  for (const w of weighIns) {
    if (Number.isFinite(w.kg) && w.kg > 0 && w.date <= today) days.set(w.date, w.kg);
  }
  return [...days.entries()].map(([date, kg]) => ({ date, kg })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** A day in the span that's grounds for the water, if the logs show one. */
function causeLine(input: ScaleJumpInput, from: string): string | null {
  const { today } = input;
  const trained = input.workoutDates.filter((d) => d >= from && d <= today).sort();
  if (trained.length) {
    const d = trained[trained.length - 1];
    const when = d === today ? "today" : daysBetween(d, today) === 1 ? "yesterday" : `on ${WEEKDAYS_LONG[weekdayOf(d)]}`;
    return `You trained ${when}, and muscles hold extra water while they recover.`;
  }
  const usualFrom = addDays(today, -CARB_USUAL_DAYS);
  const usual = Object.entries(input.intake).filter(([d]) => d >= usualFrom && d < today);
  if (usual.length < CARB_USUAL_MIN_DAYS) return null;
  const mean = usual.reduce((s, [, v]) => s + v.carbsG, 0) / usual.length;
  if (!(mean > 0)) return null;
  for (let d = addDays(today, -1); d >= from; d = addDays(d, -1)) {
    const day = input.intake[d];
    if (day && day.carbsG >= mean * CARB_HEAVY_RATIO) {
      const when = daysBetween(d, today) === 1 ? "Yesterday" : WEEKDAYS_LONG[weekdayOf(d)];
      return `${when} had more carbs than you usually eat, and the body stores carbs with water.`;
    }
  }
  return null;
}

/**
 * What to say about today's weigh-in, or null. Null is the common answer: no
 * reading today, nothing recent to compare with, a small move, a day in between
 * with nothing logged, or a rise that food could explain.
 */
export function scaleJump(input: ScaleJumpInput): ScaleJump | null {
  const { today } = input;
  if (!(input.maintenanceKcal > 0)) return null;
  const readings = byDay(input.weighIns, today);
  const latest = readings[readings.length - 1];
  if (!latest || latest.date !== today) return null;
  const previous = readings[readings.length - 2];
  if (!previous) return null;
  const gap = daysBetween(previous.date, today);
  if (gap < 1 || gap > LOOKBACK_MAX_DAYS) return null;

  const upKg = round1(latest.kg - previous.kg);
  if (upKg < JUMP_MIN_KG) return null;

  // The days whose eating sits between the two readings: from the earlier
  // weigh-in's day up to yesterday. Every one must have something recorded.
  let logged = 0;
  let tilted = 0;
  for (let d = previous.date; d < today; d = addDays(d, 1)) {
    const day = input.intake[d];
    if (!day || !(day.kcal > 0)) return null;
    logged += day.kcal - input.maintenanceKcal;
    tilted += day.kcal + UNLOGGED_KCAL_PER_DAY - input.maintenanceKcal * MAINTENANCE_SHARE;
  }
  const maxFatKg = round1(Math.max(0, tilted) / FAT_KCAL_PER_KG);
  if (maxFatKg > upKg * MAX_FAT_SHARE || upKg - maxFatKg < MIN_UNEXPLAINED_KG) return null;

  const since = sinceWords(previous.date, today);
  const sinceCap = since === "yesterday" ? "Since yesterday" : `Since ${since}`;
  const need = groupThousands(Math.round((upKg * FAT_KCAL_PER_KG) / 100) * 100);
  const intakeLine =
    logged <= 0
      ? `${sinceCap} you've logged about ${aboutKcal(logged)} fewer than it burns. Even allowing for things you didn't log, that's nowhere near enough, so most of this is water.`
      : maxFatKg === 0
        ? `${sinceCap} you've logged about ${aboutKcal(logged)} more than it burns, which is nowhere near enough, so most of this is water.`
        : `${sinceCap} you've logged about ${aboutKcal(logged)} more than it burns. Even allowing for things you didn't log, that's ${maxFatKg} kg of fat at most, so the rest is water.`;
  const cause = causeLine(input, previous.date);
  const text = [
    `Up ${upKg} kg since ${since}.`,
    `Putting on ${upKg} kg of fat takes eating about ${need} calories more than your body burns.`,
    intakeLine,
    cause,
    "It usually settles within a few days.",
  ]
    .filter(Boolean)
    .join(" ");

  return { date: today, fromDate: previous.date, upKg, maxFatKg, text };
}
