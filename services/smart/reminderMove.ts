/**
 * services/smart/reminderMove.ts
 *
 * REMINDERS THAT MOVE THEMSELVES — when a reminder keeps going off at a time
 * the person doesn't do the thing, offer once to move it to when they do.
 *
 *   "You usually tick this around 9:40 PM. Your reminder goes off at 7:00 PM.
 *    Move it to 9:30 PM?"   [Move it]  [Keep 7:00 PM]
 *
 * Nothing moves unless the user taps it, and every move has an Undo. The app
 * never invents a reminder: a thing with no reminder gets no suggestion.
 *
 * Pure: the readings come from the routine clock, the answers from the ledger.
 */
import type { MealSlotKey } from "../notifications/copy";
import {
  clockLabel,
  isConsistent,
  minutesApart,
  roundToStep,
  wallClockOf,
  REMINDER_ECHO_MINUTES,
  type RoutineReading,
  type RoutineSample,
} from "../routine/clock";
import type { SmartAnswer, SmartCandidate } from "./types";

/** Closer than this, a reminder is near enough — a question would be noise. */
export const MOVE_MIN_GAP_MINUTES = 45;

/** Land just BEFORE the habit, never after it: a reminder is a nudge, not a receipt. */
export const MOVE_LEAD_MINUTES = 10;

/** Suggested times are round numbers people would have picked themselves. */
export const MOVE_STEP_MINUTES = 5;

/** "Keep" holds the question back this long. */
export const MOVE_KEEP_DAYS = 30;

/** After the hold, ask again only if the routine itself has moved this far. */
export const MOVE_REASK_SHIFT_MINUTES = 60;

/** Priority on its surfaces: a useful offer, never urgent. */
export const MOVE_PRIORITY = 40;

export type MoveTarget =
  | { kind: "habit"; habitId: string; name: string }
  | { kind: "meal"; slot: MealSlotKey }
  | { kind: "water" };

export interface MoveSuggestion extends SmartCandidate {
  feature: "reminder-move";
  target: MoveTarget;
  /** When the reminder goes off now (minutes after midnight). */
  reminderMinute: number;
  /** When the person usually does it. */
  usualMinute: number;
  /** Where the offer would put the reminder. */
  suggestedMinute: number;
  /** Days that set the usual time, and over how many. */
  count: number;
  windowDays: number;
}

/** The moment's identity — what a "Keep" is remembered by. */
export function moveId(target: MoveTarget): string {
  switch (target.kind) {
    case "habit":
      return `reminder-move:habit:${target.habitId}`;
    case "meal":
      return `reminder-move:meal:${target.slot}`;
    case "water":
      return "reminder-move:water";
  }
}

/**
 * Mark the samples that answered the reminder rather than set their own time.
 *
 * Meals and water don't record which button a log came from, so a log in the
 * {@link REMINDER_ECHO_MINUTES} straight after the reminder's time is read as
 * the reminder working — the same window the habit button is judged by.
 */
export function markEchoesAfter(
  samples: readonly RoutineSample[],
  reminderMinute: number,
): RoutineSample[] {
  return samples.map((s) => {
    const wall = wallClockOf(s.at);
    if (!wall) return s;
    const after = (wall.minute - reminderMinute + 1440) % 1440;
    return after <= REMINDER_ECHO_MINUTES ? { ...s, echo: true } : s;
  });
}

/**
 * The offer, or null when there is nothing worth asking.
 *
 * Asks only when the routine is steady (enough days, a tight spread), the
 * reminder is at least {@link MOVE_MIN_GAP_MINUTES} away from it, and fewer
 * than half of the days were answered straight from the reminder — when most
 * are, the reminder IS working and is left alone.
 */
export function suggestMove(input: {
  target: MoveTarget;
  reading: RoutineReading | null;
  reminderMinute: number;
  /** The last answer to this moment, if any (see the ledger). */
  previous?: SmartAnswer | null;
  today: string;
}): MoveSuggestion | null {
  const { target, reading, reminderMinute, previous, today } = input;
  if (!isConsistent(reading)) return null;

  const total = reading.count + reading.echoCount;
  if (reading.echoCount * 2 >= total) return null;

  if (minutesApart(reading.medianMinute, reminderMinute) < MOVE_MIN_GAP_MINUTES) return null;

  const suggestedMinute = roundToStep(reading.medianMinute - MOVE_LEAD_MINUTES, MOVE_STEP_MINUTES);
  if (minutesApart(suggestedMinute, reminderMinute) < MOVE_STEP_MINUTES) return null;

  // Kept last time: quiet for the hold, then only if the routine itself moved.
  if (previous && previous.answer !== "accepted") {
    if (previous.until && previous.until >= today) return null;
    if (
      typeof previous.value === "number" &&
      minutesApart(reading.medianMinute, previous.value) < MOVE_REASK_SHIFT_MINUTES
    ) {
      return null;
    }
  }

  return {
    id: moveId(target),
    feature: "reminder-move",
    priority: MOVE_PRIORITY,
    target,
    reminderMinute,
    usualMinute: reading.medianMinute,
    suggestedMinute,
    count: reading.count,
    windowDays: reading.windowDays,
  };
}

/** "the last 3 weeks" — the scope every offer states. */
export function windowPhrase(days: number): string {
  if (days === 7) return "the last week";
  return days % 7 === 0 ? `the last ${days / 7} weeks` : `the last ${days} days`;
}

const SLOT_WORD: Record<MealSlotKey, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "a snack",
};

export interface MoveCopy {
  message: string;
  source: string;
  moveLabel: string;
  keepLabel: string;
  /** The receipt after a move. */
  moved: string;
}

/**
 * The words. `where` is "own" on the thing's own page ("You usually tick this")
 * and "list" in the Notifications screen, where "this" would point at nothing.
 */
export function moveCopy(s: MoveSuggestion, where: "own" | "list" = "list"): MoveCopy {
  const usual = clockLabel(s.usualMinute);
  const now = clockLabel(s.reminderMinute);
  const to = clockLabel(s.suggestedMinute);
  const days = `${s.count} ${s.count === 1 ? "day" : "days"}`;
  const scope = windowPhrase(s.windowDays);
  const common = { moveLabel: "Move it", keepLabel: `Keep ${now}`, moved: `Moved to ${to}` };
  switch (s.target.kind) {
    case "habit":
      return {
        ...common,
        message: `You usually tick ${where === "own" ? "this" : s.target.name} around ${usual}. Your reminder goes off at ${now}. Move it to ${to}?`,
        source: `From ${days} of ticks in ${scope}.`,
      };
    case "meal":
      return {
        ...common,
        message: `You usually log ${SLOT_WORD[s.target.slot]} around ${usual}. Its reminder goes off at ${now}. Move it to ${to}?`,
        source: `From ${days} of logs in ${scope}.`,
      };
    case "water":
      return {
        ...common,
        message: `Your first glass is usually around ${usual}. Your first water check-in is at ${now}. Move it to ${to}?`,
        source: `From ${days} of first glasses in ${scope}.`,
      };
  }
}
