/**
 * services/notifications/mealActions.ts
 *
 * "Ate it" — the meal-logging path that runs WITHOUT the app.
 *
 * The sibling of habitActions, and it inherits the same three properties,
 * because a notification response gets replayed on cold start and can arrive
 * hours after it fired:
 *
 *   • IDEMPOTENT. Completing an already-ticked meal is a no-op that still
 *     reports success. This one matters more than it does for habits: a habit
 *     completion is a date in a Set, so writing it twice is harmless, but a
 *     meal tick appends an immutable line to the INTAKE LEDGER carrying that
 *     meal's macros. Applied twice, the day silently gains a second dinner.
 *     `markMealConsumed` has no guard of its own — it will happily record a
 *     meal that is already recorded — so the check has to live here, before it.
 *
 *   • DATED BY THE NOTIFICATION. A reminder that fired at 7pm and is pressed at
 *     00:20 logs the day it was FOR. The ledger is the source of every calorie
 *     figure in the app; letting a late tap land on tomorrow would move a meal
 *     between two days that both then read wrong.
 *
 *   • FAIL-SOFT. Every failure is a returned reason, never a throw. There is no
 *     UI on this path to catch an exception, and a crash in a background
 *     notification handler is invisible until someone's food stops being
 *     counted.
 *
 * WORKOUTS ARE NOT HERE, AND WILL NOT BE. A meal is a yes/no fact. A session is
 * sets, load, duration and a completion percentage — a lock-screen button that
 * "logged" one would be inventing all four.
 */
import type { MealType, ScheduledMeal } from "../../models/diet";
import { getScheduledDietForDate, markMealConsumed } from "../ScheduleService";
import { toLocalDateString } from "../OfflineStorage";

export type LogMealResult =
  | {
      ok: true;
      /** Slot logged. */
      slot: MealType;
      /** The meal's name, for a confirmation. */
      mealName: string;
      /** Local date logged — the notification's fire date. */
      date: string;
      /** True when it was already ticked and nothing changed. */
      alreadyLogged: boolean;
    }
  | {
      ok: false;
      reason: "no-plan" | "no-meal" | "closed" | "error";
    };

// ── change notification ─────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Observe out-of-band meal ticks.
 *
 * AppContext already re-reads today's diet whenever the app returns to the
 * foreground, which covers the common case (phone locked, button pressed, app
 * opened later). This covers the other one: the app is alive and on screen when
 * the notification is actioned, where nothing would otherwise tell the diet
 * screen that a meal it is currently rendering has just been eaten.
 */
export function subscribeMealLoggedFromNotification(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emitMealLogged(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // one bad listener must not stop the others
    }
  }
}

// ── the action ──────────────────────────────────────────────────────

/** The meal occupying a slot on a day's schedule, or null. */
function mealInSlot(
  schedule: {
    breakfast: ScheduledMeal | null;
    lunch: ScheduledMeal | null;
    dinner: ScheduledMeal | null;
    snacks: ScheduledMeal[];
  },
  slot: MealType,
  snackIndex: number,
): ScheduledMeal | null {
  if (slot === "snack") return schedule.snacks[snackIndex] ?? null;
  return schedule[slot] ?? null;
}

/**
 * Log a scheduled meal from a notification action.
 *
 * @param slot       from the notification's `data.slot`
 * @param firedAtMs  `response.notification.date` — when the reminder fired
 * @param snackIndex which snack, when the slot is "snack"
 */
export async function logMealFromNotification(
  slot: MealType,
  firedAtMs?: number,
  snackIndex = 0,
): Promise<LogMealResult> {
  try {
    const fired =
      typeof firedAtMs === "number" && Number.isFinite(firedAtMs)
        ? new Date(firedAtMs)
        : new Date();
    const date = toLocalDateString(fired);

    const diet = await getScheduledDietForDate(date);
    if (!diet?.schedule) return { ok: false, reason: "no-plan" };

    const meal = mealInSlot(diet.schedule, slot, snackIndex);
    if (!meal) return { ok: false, reason: "no-meal" };

    // THE DUPLICATE GUARD. Without it a replayed cold-start response appends a
    // second intake record and the day gains a meal nobody ate.
    if (meal.isConsumed) {
      return { ok: true, slot, mealName: meal.name, date, alreadyLogged: true };
    }

    const applied = await markMealConsumed(
      date,
      slot,
      slot === "snack" ? snackIndex : undefined,
    );
    // The only way this fails now is the back-log window: a reminder that fired
    // days ago on a phone that was off, pressed after the day has closed.
    if (!applied) return { ok: false, reason: "closed" };

    emitMealLogged();
    return { ok: true, slot, mealName: meal.name, date, alreadyLogged: false };
  } catch {
    return { ok: false, reason: "error" };
  }
}
