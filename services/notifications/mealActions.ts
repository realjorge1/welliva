/**
 * services/notifications/mealActions.ts
 *
 * "Ate it" — the meal-logging path that runs WITHOUT the app.
 *
 * The sibling of habitActions, and it inherits the same properties, because a
 * notification response gets replayed on cold start, can be delivered to two
 * handlers at once on Android, and can arrive hours after it fired:
 *
 *   • IDEMPOTENT — ATOMICALLY. Completing an already-ticked meal is a no-op that
 *     still reports success. This one matters more than it does for habits: a
 *     habit completion is a date in a Set, so writing it twice is harmless, but a
 *     meal tick appends an immutable line to the INTAKE LEDGER carrying that
 *     meal's macros. Applied twice, the day silently gains a second dinner. The
 *     check and the tick run inside ONE schedule lock
 *     (ScheduleService.markMealConsumedOnce), so two deliveries of the same press
 *     cannot both pass it.
 *
 *   • DATED BY THE NOTIFICATION. A reminder that fired at 7pm and is pressed at
 *     00:20 logs the day it was FOR. The ledger is the source of every calorie
 *     figure in the app; letting a late tap land on tomorrow would move a meal
 *     between two days that both then read wrong.
 *
 *   • COUNTED LIKE AN IN-APP TICK. The app's own "eaten" tap also credits the
 *     day to the activity streak; a lock-screen tick that didn't would leave a
 *     user who logs everything from notifications with a streak of zero.
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
import type { MealType } from "../../models/diet";
import { markMealConsumedOnce } from "../ScheduleService";
import { recordActivity } from "../StreakService";
import { toLocalDateString } from "../OfflineStorage";
import { emitExternalWrite, subscribeExternalWrites } from "./externalWrites";
import { fireDateOf } from "./fireTime";

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
      reason: "no-meal" | "closed" | "error";
      /** Local date the press was for, when known. */
      date?: string;
    };

// ── change notification ─────────────────────────────────────────────

/**
 * Observe out-of-band meal ticks.
 *
 * AppContext already re-reads today's diet whenever the app returns to the
 * foreground, which covers the common case (phone locked, button pressed, app
 * opened later). This covers the other one: the app is alive and on screen when
 * the notification is actioned, where nothing would otherwise tell the diet
 * screen that a meal it is currently rendering has just been eaten.
 */
export function subscribeMealLoggedFromNotification(fn: () => void): () => void {
  return subscribeExternalWrites((w) => {
    if (w.kind === "meal") fn();
  });
}

// ── the action ──────────────────────────────────────────────────────

/**
 * Log a scheduled meal from a notification action.
 *
 * @param slot       from the notification's `data.slot`
 * @param firedAt    `response.notification.date` — when the reminder fired
 *                   (seconds on iOS, milliseconds on Android; see ./fireTime)
 * @param snackIndex which snack, when the slot is "snack"
 */
export async function logMealFromNotification(
  slot: MealType,
  firedAt?: number,
  snackIndex = 0,
): Promise<LogMealResult> {
  let date: string | undefined;
  try {
    date = toLocalDateString(fireDateOf(firedAt));

    const result = await markMealConsumedOnce(
      date,
      slot,
      slot === "snack" ? snackIndex : undefined,
    );

    switch (result.status) {
      case "missing":
        return { ok: false, reason: "no-meal", date };
      // The back-log window: a reminder that fired days ago on a phone that was
      // off, pressed after the day has closed.
      case "closed":
        return { ok: false, reason: "closed", date };
      case "already":
        return { ok: true, slot, mealName: result.mealName, date, alreadyLogged: true };
      case "logged":
        break;
    }

    // Streak credit, exactly as the in-app tick gives it — and only for TODAY.
    // recordActivity models a run of consecutive days ending now; handing it a
    // late press for yesterday after today is already recorded would rewind the
    // run. A meal back-logged in the app doesn't credit a past day either.
    if (date === toLocalDateString(new Date())) {
      await recordActivity(date).catch(() => null);
      emitExternalWrite({ kind: "streak", date });
    }

    emitExternalWrite({ kind: "meal", date });
    return { ok: true, slot, mealName: result.mealName, date, alreadyLogged: false };
  } catch {
    return { ok: false, reason: "error", date };
  }
}
