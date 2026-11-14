/**
 * services/body/forecastMemory.ts — "we said / you did".
 *
 * Gozlin's forecast gives a date for reaching a goal weight
 * (services/gozlin/GozlinForecastEngine). Until now nothing remembered it, so
 * the app could never be held to it. This keeps three of the dates it said for
 * the current goal weight:
 *
 *   first   the first date said: what gets said back when the goal is reached
 *           ("On 12 Aug Gozlin said you'd reach 75 kg around 1 Dec. You got
 *           there on 24 Nov, a week early.")
 *   last    the latest date said
 *   prior   the latest date said on an EARLIER day than `last`, so a forecast
 *           shown twice in one day still compares with what was said before
 *           today, not with itself
 *
 * When a new forecast lands more than MOVED_DAYS away from the last one, one
 * line says so and why, from the two rates it was worked out from. A date that
 * moves without a word is what makes the next date hard to believe.
 *
 * "Said" means shown: the forecast card in chat, or the coach's forecast tool,
 * whose answer the coach turns into words. A new goal weight starts afresh.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { daysBetween, formatDay } from "../cycle/dates";

export const FORECAST_MEMORY_KEY = "@welliva_goal_forecast";

/** A date moving by less than this is the forecast breathing, not news. */
export const MOVED_DAYS = 14;
/** A rate this much faster or slower than before counts as the reason. */
export const RATE_CHANGE_SHARE = 0.15;
/** Reaching the goal within this many days of the first date counts as "right on time". */
export const ON_TIME_DAYS = 3;

export interface SaidDate {
  /** The day it was said. */
  on: string;
  /** The goal date it gave. */
  eta: string;
  /** kg a week it was worked out from (signed), when known. */
  ratePerWeek: number | null;
}

export interface ForecastMemory {
  targetKg: number;
  first: SaidDate;
  prior: SaidDate | null;
  last: SaidDate;
  /** The day the goal was reached, once it was. */
  reachedOn?: string;
}

export interface ForecastSaid {
  targetKg: number;
  eta: string;
  ratePerWeek: number | null;
}

const sameTarget = (a: number, b: number) => Math.abs(a - b) < 0.05;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** "1 Dec", with the year when it isn't this year's. */
function dayWords(iso: string, today: string): string {
  return formatDay(iso, { year: iso.slice(0, 4) !== today.slice(0, 4) });
}

/** "4 days", "a week", "3 weeks". */
export function spanWords(days: number): string {
  const d = Math.abs(days);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"}`;
  const w = Math.round(d / 7);
  return w === 1 ? "a week" : `${w} weeks`;
}

/** The memory after a forecast is said today. */
export function rememberSaid(prev: ForecastMemory | null, said: ForecastSaid, today: string): ForecastMemory {
  const entry: SaidDate = { on: today, eta: said.eta, ratePerWeek: said.ratePerWeek };
  // A goal already reached keeps its record as it was: a forecast opened before
  // the new-chapter screen must not wipe the date that screen says back.
  if (prev?.reachedOn && sameTarget(prev.targetKg, said.targetKg)) return prev;
  if (!prev || !sameTarget(prev.targetKg, said.targetKg)) {
    return { targetKg: said.targetKg, first: entry, prior: null, last: entry };
  }
  if (prev.last.on === today) return { ...prev, last: entry };
  return { ...prev, prior: prev.last, last: entry };
}

/** What a forecast said today is compared with: the latest date said before today. */
function before(prev: ForecastMemory | null, targetKg: number, today: string): SaidDate | null {
  if (!prev || prev.reachedOn || !sameTarget(prev.targetKg, targetKg)) return null;
  if (prev.last.on < today) return prev.last;
  return prev.prior;
}

/**
 * One line when today's date has moved MOVED_DAYS or more from the last one
 * said, or null. The reason comes from the rates the two dates were worked out
 * from, which is where a goal date comes from.
 */
export function movedLine(prev: ForecastMemory | null, now: ForecastSaid, today: string): string | null {
  const ref = before(prev, now.targetKg, today);
  if (!ref) return null;
  const shift = daysBetween(ref.eta, now.eta);
  if (Math.abs(shift) < MOVED_DAYS) return null;
  const direction = shift > 0 ? `${spanWords(shift)} later` : `${spanWords(shift)} sooner`;
  let reason = "because of how your weight has moved since then";
  const r0 = ref.ratePerWeek;
  const r1 = now.ratePerWeek;
  if (r0 != null && r1 != null && Math.sign(r0) === Math.sign(r1) && r0 !== 0) {
    const verb = r1 < 0 ? "losing" : "gaining";
    const a0 = Math.abs(r0);
    const a1 = Math.abs(r1);
    if (a1 < a0 * (1 - RATE_CHANGE_SHARE)) {
      reason = `because you've been ${verb} about ${round1(a1)} kg a week lately, down from ${round1(a0)} kg then`;
    } else if (a1 > a0 * (1 + RATE_CHANGE_SHARE)) {
      reason = `because you've been ${verb} about ${round1(a1)} kg a week lately, up from ${round1(a0)} kg then`;
    }
  }
  return (
    `On ${dayWords(ref.on, today)} I said around ${dayWords(ref.eta, today)}. ` +
    `It's now around ${dayWords(now.eta, today)}, ${direction}, ${reason}.`
  );
}

/** The memory once the goal is reached; unchanged when it isn't about this goal. */
export function rememberReached(prev: ForecastMemory | null, targetKg: number, on: string): ForecastMemory | null {
  if (!prev || prev.reachedOn || !sameTarget(prev.targetKg, targetKg)) return prev;
  return { ...prev, reachedOn: on };
}

/** "On 12 Aug, Gozlin said you'd reach 75 kg around 1 Dec. You got there on 24 Nov, a week early." */
export function saidBackLine(mem: ForecastMemory | null, targetKg: number, today: string): string | null {
  if (!mem?.reachedOn || !sameTarget(mem.targetKg, targetKg)) return null;
  const { first, reachedOn } = mem;
  const late = daysBetween(first.eta, reachedOn);
  const verdict =
    Math.abs(late) <= ON_TIME_DAYS
      ? ", right on time"
      : late < 0
        ? `, ${spanWords(late)} early`
        : `, ${spanWords(late)} after that first date`;
  return (
    `On ${dayWords(first.on, today)}, Gozlin said you'd reach ${round1(mem.targetKg)} kg around ${dayWords(first.eta, today)}. ` +
    `You got there on ${dayWords(reachedOn, today)}${verdict}.`
  );
}

/* ─────────────────────────────── storage ─────────────────────────────── */

export async function loadForecastMemory(): Promise<ForecastMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(FORECAST_MEMORY_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as ForecastMemory;
    return m && typeof m.targetKg === "number" && m.first && m.last ? m : null;
  } catch {
    return null;
  }
}

async function save(m: ForecastMemory): Promise<void> {
  try {
    await AsyncStorage.setItem(FORECAST_MEMORY_KEY, JSON.stringify(m));
  } catch (e) {
    console.log("[forecast-memory] could not save", e);
  }
}

/**
 * A forecast was shown: say whether its date moved (the line, or null) and
 * remember it. Never throws.
 */
export async function noteForecastSaid(said: ForecastSaid, today: string): Promise<string | null> {
  const prev = await loadForecastMemory();
  const line = movedLine(prev, said, today);
  await save(rememberSaid(prev, said, today));
  return line;
}

/** The goal was reached on `on`. Never throws. */
export async function noteGoalReached(targetKg: number, on: string): Promise<void> {
  const prev = await loadForecastMemory();
  const next = rememberReached(prev, targetKg, on);
  if (next && next !== prev) await save(next);
}
