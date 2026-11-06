/**
 * services/routine/sources.ts
 *
 * Every record that already knows a time of day, read as routine samples.
 *
 * Nothing here stores a second copy of anything. Each adapter takes a store in
 * its own shape and hands the clock (./clock) a list of `{ date, at }`:
 *
 *   · habits     — the tick-time record beside the habit log (./tickTimes)
 *   · meals      — the intake ledger's ticks (`IntakeRecord.at`) and the free
 *                  food log (`FoodLogEntry.loggedAt`), by the slot logged under
 *   · water      — the first glass of each closed day (`WaterHistoryEntry.firstAt`)
 *                  plus today's pours, which are only kept for the day
 *   · check-ins  — a Mind entry's `createdAt`
 *   · workouts   — a finished session's `completedAt`
 *
 * Pure: types only, no storage. The clock applies the same-day and window
 * rules, so these hand over everything and let it choose.
 */
import type { MealType } from "../../models/diet";
import type { WorkoutLogEntry } from "../../models/workout";
import type { WaterHistoryEntry } from "../OfflineStorage";
import type { GozlinCheckin } from "../gozlin/gozlin.types";
import type { IntakeLedger } from "../nutrition/IntakeLedger";
import type { LogStore } from "../nutrition/foodLogStore";
import type { PourLog } from "../nutrition/waterPours";
import { REMINDER_ECHO_MINUTES, type RoutineSample } from "./clock";
import { liveTicksFor, type HabitTickTime } from "./tickTimes";

const ECHO_MS = REMINDER_ECHO_MINUTES * 60_000;

/** Was this tick the button answering its own reminder, a moment after it fired? */
export function isEcho(tick: Pick<HabitTickTime, "via" | "at" | "firedAt">): boolean {
  if (tick.via !== "notification" || !tick.firedAt) return false;
  const gap = Date.parse(tick.at) - Date.parse(tick.firedAt);
  return Number.isFinite(gap) && gap >= 0 && gap <= ECHO_MS;
}

/** One habit's ticks as samples, button echoes marked. */
export function habitSamples(ticks: readonly HabitTickTime[], habitId: string): RoutineSample[] {
  return liveTicksFor(ticks, habitId).map((t) => ({ date: t.date, at: t.at, echo: isEcho(t) }));
}

/**
 * When a meal slot was logged: a planned meal ticked in that slot, or anything
 * from the food log filed under it. Either one is "logging breakfast".
 */
export function mealSlotSamples(
  intake: IntakeLedger,
  foodLog: LogStore,
  slot: MealType,
): RoutineSample[] {
  const out: RoutineSample[] = [];
  for (const [date, records] of Object.entries(intake ?? {})) {
    if (!Array.isArray(records)) continue;
    for (const r of records) {
      if (r?.slot === slot && typeof r.at === "string") out.push({ date, at: r.at });
    }
  }
  for (const [date, entries] of Object.entries(foodLog ?? {})) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      if (e?.slot === slot && typeof e.loggedAt === "string") out.push({ date, at: e.loggedAt });
    }
  }
  return out;
}

/**
 * The first glass of each day. Closed days carry it on their history row; the
 * day in progress only has its pours (they are kept for one day at a time).
 */
export function firstWaterSamples(
  history: readonly WaterHistoryEntry[],
  pours: PourLog | null,
): RoutineSample[] {
  const out: RoutineSample[] = [];
  for (const e of history ?? []) {
    if (e?.firstAt) out.push({ date: e.date, at: e.firstAt });
  }
  for (const p of pours?.pours ?? []) {
    out.push({ date: pours!.date, at: p.at });
  }
  return out;
}

/** When the Mind check-ins were made. */
export function checkinSamples(checkins: readonly GozlinCheckin[]): RoutineSample[] {
  const out: RoutineSample[] = [];
  for (const c of checkins ?? []) {
    if (!c?.date || !Number.isFinite(c.createdAt)) continue;
    out.push({ date: c.date, at: new Date(c.createdAt).toISOString() });
  }
  return out;
}

/** When workouts were finished. */
export function workoutSamples(log: readonly WorkoutLogEntry[]): RoutineSample[] {
  const out: RoutineSample[] = [];
  for (const w of log ?? []) {
    if (w?.date && typeof w.completedAt === "string") out.push({ date: w.date, at: w.completedAt });
  }
  return out;
}
