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
 * Re-post a reminder {@link SNOOZE_MINUTES} from now. Used by the "Later" action;
 * the original repeating trigger is untouched, so tomorrow's reminder is unaffected.
 */
export async function snoozeReminder(
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureRemindersChannel();
    await ensureNotificationCategories();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        categoryIdentifier: HABIT_REMINDER_CATEGORY,
        data: { ...data, snoozed: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDERS_CHANNEL_ID,
        seconds: SNOOZE_MINUTES * 60,
        repeats: false,
      },
    });
  } catch {
    // fail-soft — a missed snooze is not worth an error surface
  }
}
