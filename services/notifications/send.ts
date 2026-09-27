/**
 * services/notifications/send.ts
 *
 * One-off local notifications and whole-queue housekeeping:
 *
 *   · the Settings "Send test notification" button, and the confirmation that
 *     answers its "Mark as Done" — so the test demonstrates the WHOLE loop, not
 *     just a banner
 *   · the "Later" snooze
 *   · FOLLOW-UPS — when a lock-screen press could not be counted (the meal isn't
 *     on that day's plan, the day has closed), the user is told, with a tap
 *     that takes them to finish it in the app. A button that fails silently
 *     teaches people the buttons don't work.
 *   · the sign-out sweep
 *
 * Every one goes through the same content shape as a real reminder — same
 * channel, same categories, same owner stamp — so what the test shows on the
 * lock screen is exactly what a real nudge will look like, buttons included.
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
  WATER_REMINDER_CATEGORY,
  WATER_SNOOZE_MINUTES,
  ensureNotificationCategories,
} from "./categories";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";
import { ownerStamp } from "./owner";

/** Delay on the test notification, so there's time to lock the phone and watch it land. */
export const TEST_NOTIFICATION_DELAY_SECONDS = 5;

export type SendResult =
  | { ok: true; delaySeconds: number }
  | { ok: false; reason: "denied" | "unavailable" };

/** Which kind of reminder a test imitates — each has its own button. */
export type TestKind = "habit" | "meal" | "water";

const TEST_CONTENT: Record<
  TestKind,
  { title: string; body: string; categoryIdentifier: string; data: Record<string, unknown> }
> = {
  habit: {
    title: "Evening wind-down",
    body: "Try it — tap “Mark as Done” without opening the app.",
    categoryIdentifier: HABIT_REMINDER_CATEGORY,
    data: { type: "habit-reminder" },
  },
  meal: {
    title: "Lunch",
    body: "Grilled chicken salad — had it? Try “Ate it”. (A test logs nothing.)",
    categoryIdentifier: MEAL_REMINDER_CATEGORY,
    data: { type: "meal-reminder", slot: "lunch" },
  },
  water: {
    title: "Water break",
    body: "Try the glass button — a test adds nothing to your day.",
    categoryIdentifier: WATER_REMINDER_CATEGORY,
    data: { type: "water-reminder" },
  },
};

/**
 * Fire a demo reminder shortly from now, wearing the real category of `kind` —
 * the same banner and the same button a real one carries. `data.test` makes
 * every handler acknowledge the press without touching real data, and answer it
 * with a confirmation, which is the part a user actually wants to see: that the
 * button did something.
 */
export async function sendTestNotification(kind: TestKind = "habit"): Promise<SendResult> {
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return { ok: false, reason: "denied" };
    }

    await ensureRemindersChannel();
    await ensureNotificationCategories();

    const demo = TEST_CONTENT[kind];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: demo.title,
        body: demo.body,
        categoryIdentifier: demo.categoryIdentifier,
        data: { ...demo.data, test: true, ...(await ownerStamp()) },
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

/** How long "Later" waits, by the category the reminder wore. */
export function snoozeMinutesFor(categoryIdentifier: string | null | undefined): number {
  if (categoryIdentifier === MEAL_REMINDER_CATEGORY) return MEAL_SNOOZE_MINUTES;
  if (categoryIdentifier === WATER_REMINDER_CATEGORY) return WATER_SNOOZE_MINUTES;
  return SNOOZE_MINUTES;
}

/**
 * Re-post a reminder a while from now. Used by the "Later" action; the original
 * trigger is untouched, so tomorrow's reminder is unaffected.
 *
 * The snoozed copy KEEPS ITS CATEGORY. A meal reminder that came back wearing
 * the habit category would arrive with a "Mark as Done" button wired to a habit
 * id it does not have — the button would be inert, on a notification that looked
 * identical to the one that worked half an hour earlier. Meals also come back
 * sooner: an hour is a sensible delay for "read ten pages" and far too long for
 * "have you eaten".
 */
export async function snoozeReminder(input: {
  title: string;
  body: string;
  data: Record<string, unknown>;
  categoryIdentifier?: string | null;
}): Promise<void> {
  try {
    await ensureRemindersChannel();
    await ensureNotificationCategories();
    const category = input.categoryIdentifier || HABIT_REMINDER_CATEGORY;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        categoryIdentifier: category,
        data: { ...input.data, snoozed: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDERS_CHANNEL_ID,
        seconds: snoozeMinutesFor(category) * 60,
        repeats: false,
      },
    });
  } catch {
    // fail-soft — a missed snooze is not worth an error surface
  }
}

/**
 * Show a notification NOW — no buttons, a tap that routes somewhere useful.
 * The follow-up to a press that could not be counted, and the test's
 * confirmation. Quiet by construction: it only exists because the user just
 * pressed something.
 */
export async function presentFollowUp(input: {
  title: string;
  body: string;
  route?: string | null;
}): Promise<void> {
  try {
    await ensureRemindersChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: {
          type: "follow-up",
          ...(input.route ? { route: input.route } : {}),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDERS_CHANNEL_ID,
        seconds: 1,
        repeats: false,
      },
    });
  } catch {
    // fail-soft
  }
}

/**
 * Sign-out sweep: cancel everything pending and clear the tray.
 *
 * At sign-out — and only there — `cancelAll` is exactly right: every pending
 * notification on this install was scheduled for the account that is leaving.
 * Leaving them would keep nagging a signed-out phone about someone's habits, and
 * a leftover meal reminder names a SLOT, which a different person's plan could
 * answer. The boot reconcile re-lays each owner's reminders from their stored
 * settings the next time an account signs in.
 */
export async function clearAllAppNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // no native module — nothing was scheduled
  }
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // nothing presented
  }
}
