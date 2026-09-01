/**
 * services/notifications/send.ts
 *
 * One-off local notifications: the Settings "Send Test Notification" button and
 * the "Later" snooze. Both go through the same content shape as a real reminder —
 * same channel, same category, same action buttons — so what the test shows on
 * the lock screen is exactly what a real nudge will look like, buttons included.
 *
 * Fail-soft everywhere: a missing native module or a denied permission returns a
 * result the UI can explain, never an exception.
 */
import * as Notifications from "expo-notifications";
import {
  HABIT_REMINDER_CATEGORY,
  MEAL_REMINDER_CATEGORY,
  MEAL_SNOOZE_MINUTES,
  SNOOZE_MINUTES,
  ensureNotificationCategories,
} from "./categories";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";

/** Delay on the test notification, so there's time to lock the phone and watch it land. */
export const TEST_NOTIFICATION_DELAY_SECONDS = 5;

export type SendResult =
  | { ok: true; delaySeconds: number }
  | { ok: false; reason: "denied" | "unavailable" };

/**
 * Fire a demo reminder shortly from now. Carries `data.test` so the action
 * handler acknowledges "Mark as Done" without touching any real habit.
 */
export async function sendTestNotification(): Promise<SendResult> {
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return { ok: false, reason: "denied" };
    }

    await ensureRemindersChannel();
    await ensureNotificationCategories();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Evening wind-down",
        body: "A small step keeps the ember burning.",
        categoryIdentifier: HABIT_REMINDER_CATEGORY,
        data: { type: "habit-reminder", test: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDERS_CHANNEL_ID,
        seconds: TEST_NOTIFICATION_DELAY_SECONDS,
        repeats: false,
      },
    });

    return { ok: true, delaySeconds: TEST_NOTIFICATION_DELAY_SECONDS };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Re-post a reminder a while from now. Used by the "Later" action; the original
 * trigger is untouched, so tomorrow's reminder is unaffected.
 *
 * The snoozed copy KEEPS ITS CATEGORY, and that is the whole reason this takes
 * a type. A meal reminder that came back wearing the habit category would
 * arrive with a "Mark as Done" button wired to a habit id it does not have —
 * the button would be inert, on a notification that looked identical to the one
 * that worked half an hour earlier. Meals also come back sooner: an hour is a
 * sensible delay for "read ten pages" and far too long for "have you eaten".
 */
export async function snoozeReminder(
  title: string,
  body: string,
  data: Record<string, unknown>,
  kind: "habit" | "meal" = "habit",
): Promise<void> {
  try {
    await ensureRemindersChannel();
    await ensureNotificationCategories();
    const meal = kind === "meal";
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        categoryIdentifier: meal ? MEAL_REMINDER_CATEGORY : HABIT_REMINDER_CATEGORY,
        data: { ...data, snoozed: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDERS_CHANNEL_ID,
        seconds: (meal ? MEAL_SNOOZE_MINUTES : SNOOZE_MINUTES) * 60,
        repeats: false,
      },
    });
  } catch {
    // fail-soft — a missed snooze is not worth an error surface
  }
}
