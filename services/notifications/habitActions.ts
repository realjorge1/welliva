/**
 * services/notifications/habitActions.ts
 *
 * "Mark as Done" — the completion path that runs WITHOUT the app.
 *
 * When the user taps the action button on a lock-screen reminder, there is no
 * React tree, no HabitsContext, and possibly no running app at all: only a JS
 * callback the OS wakes up. So the write goes straight to the same AsyncStorage
 * blob HabitsContext persists to, and the UI catches up afterwards by reloading
 * (see `subscribeHabitLogsChanged`) rather than the other way around.
 *
 * Two properties make that safe:
 *
 *   • IDEMPOTENT — completing an already-done day is a no-op that still reports
 *     success. Notification responses can be re-delivered on a cold start
 *     (`getLastNotificationResponseAsync` returns the same one after a relaunch),
 *     so "apply twice" has to mean the same as "apply once".
 *   • DATED BY THE NOTIFICATION, not by the clock. A reminder that fired at
 *     5:17 PM and is actioned at 00:20 completes the day it was *for*, which is
 *     the only reading that keeps a streak honest.
 */
import { computeStats, loadHabits, updateLogs } from "../HabitService";
import { toLocalDateString } from "../OfflineStorage";
import { emitExternalWrite, subscribeExternalWrites } from "./externalWrites";
import { fireDateOf } from "./fireTime";
import { patchWidgetHabitDone, refreshWidgets } from "./widgets";

export type MarkDoneResult =
  | {
      ok: true;
      habitId: string;
      habitName: string;
      /** Local date completed (the notification's fire date). */
      date: string;
      /** Streak AFTER this completion — what a confirmation should show. */
      streak: number;
      /** True when the day was already logged and nothing changed. */
      alreadyDone: boolean;
    }
  | { ok: false; reason: "not-found" | "not-manual" | "error" };

// ── change notification ─────────────────────────────────────────────

/**
 * Observe out-of-band habit-log writes. HabitsContext subscribes so a completion
 * that happened behind its back (lock screen, app backgrounded) reloads into the
 * live UI — streaks, progress bars and heatmaps all recompute from the reloaded
 * logs. Returns an unsubscribe.
 */
export function subscribeHabitLogsChanged(fn: () => void): () => void {
  return subscribeExternalWrites((w) => {
    if (w.kind === "habit") fn();
  });
}

// ── the action ──────────────────────────────────────────────────────

/**
 * Complete a habit from a notification action.
 *
 * @param habitId    from the notification's `data.habitId`
 * @param firedAt  `response.notification.date` — when the reminder fired
 *                 (seconds on iOS, milliseconds on Android; see ./fireTime)
 */
export async function markHabitDoneFromNotification(
  habitId: string,
  firedAt?: number,
): Promise<MarkDoneResult> {
  try {
    const date = toLocalDateString(fireDateOf(firedAt));
    const today = toLocalDateString(new Date());

    const habit = (await loadHabits()).find((h) => h.id === habitId);
    if (!habit) return { ok: false, reason: "not-found" };
    // Linked habits (water/meals/workout) complete from real logged data — a
    // button must never be able to fake one.
    if (habit.source !== "manual") return { ok: false, reason: "not-manual" };

    // Inside the log lock: the check and the write see the same blob, so a
    // second delivery of this press — or an in-app tap landing at the same
    // moment — can neither double-apply nor erase it.
    let alreadyDone = false;
    const logs = await updateLogs((current) => {
      const set = new Set(current[habitId] ?? []);
      alreadyDone = set.has(date);
      if (alreadyDone) return null;
      set.add(date);
      return { ...current, [habitId]: [...set].sort() };
    });
    const dates = new Set(logs[habitId] ?? []);

    const { currentStreak } = computeStats(habit, dates, today);

    if (!alreadyDone) {
      await patchWidgetHabitDone(habitId, date, currentStreak);
      await refreshWidgets();
      emitExternalWrite({ kind: "habit", date });
    }

    return {
      ok: true,
      habitId,
      habitName: habit.name,
      date,
      streak: currentStreak,
      alreadyDone,
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}
