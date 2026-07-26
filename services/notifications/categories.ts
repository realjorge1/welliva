/**
 * services/notifications/categories.ts
 *
 * Interactive notification CATEGORIES — the action buttons that turn a reminder
 * from "a thing you read" into "a thing you finish". A notification only shows
 * buttons if its content carries a `categoryIdentifier` whose category has been
 * registered with the OS *before* the notification is delivered, so registration
 * happens at boot (services/notifications/init) and again defensively before any
 * schedule.
 *
 * Both actions use `opensAppToForeground: false`: tapping "Mark as Done" from the
 * lock screen completes the habit and dismisses the banner without ever showing
 * the app. The write itself goes straight to storage (see habitActions.ts), so it
 * survives the app not being running.
 *
 * Only `expo-notifications` is imported (no `react-native`), keeping this module
 * loadable under the Node test runner.
 */
import * as Notifications from "expo-notifications";

/** Category carried by every habit reminder. */
export const HABIT_REMINDER_CATEGORY = "welliva.habit-reminder";

/** Action ids — matched against `response.actionIdentifier`. */
export const ACTION_MARK_DONE = "MARK_DONE";
export const ACTION_SNOOZE = "SNOOZE";

/** How long "Later" pushes a reminder out. */
export const SNOOZE_MINUTES = 60;

let registration: Promise<void> | null = null;

async function register(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(HABIT_REMINDER_CATEGORY, [
    {
      identifier: ACTION_MARK_DONE,
      buttonTitle: "Mark as Done",
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: `Later (${SNOOZE_MINUTES}m)`,
      options: { opensAppToForeground: false },
    },
  ]);
}

/**
 * Register the app's notification categories once. Idempotent and fail-soft: a
 * failure clears the memo so the next caller retries, and a missing native
 * module just means reminders arrive without buttons — never a crash.
 */
export function ensureNotificationCategories(): Promise<void> {
  if (!registration) {
    registration = register().catch(() => {
      registration = null;
    });
  }
  return registration;
}
