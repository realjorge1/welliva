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
 * Every action uses `opensAppToForeground: false`: tapping "Mark as Done" from
 * the lock screen completes the habit and dismisses the banner without ever
 * showing the app. The write itself goes straight to storage (see
 * ./pipeline and the *Actions modules), so it survives the app not running.
 *
 * There are THREE categories, not one, and the split is deliberate. A habit
 * reminder's button says "Mark as Done"; a meal reminder's says "Ate it"; a
 * water reminder's says how much it will add. Same mechanism, different
 * sentence — and the sentence matters, because it is the only text on the button
 * and the user is deciding whether to press it from a locked screen. One shared
 * category would have forced one shared verb.
 *
 * WORKOUTS DELIBERATELY HAVE NO CATEGORY HERE. A meal, a glass or a habit is a
 * yes/no fact the user can answer from a lock screen; a session is a thing with
 * sets, weights, a duration and a completion percentage, and a button that
 * claimed to record one would be recording a fiction. The app will ask you to
 * open it for that, and it should.
 *
 * Only `expo-notifications` is imported (no `react-native`), keeping this module
 * loadable under the Node test runner.
 */
import * as Notifications from "expo-notifications";

/** Category carried by every habit reminder. */
export const HABIT_REMINDER_CATEGORY = "welliva.habit-reminder";

/** Category carried by every meal reminder that names a planned meal. */
export const MEAL_REMINDER_CATEGORY = "welliva.meal-reminder";

/** Category carried by every water reminder. */
export const WATER_REMINDER_CATEGORY = "welliva.water-reminder";

/** Action ids — matched against `response.actionIdentifier`. */
export const ACTION_MARK_DONE = "MARK_DONE";
export const ACTION_SNOOZE = "SNOOZE";
export const ACTION_LOG_MEAL = "LOG_MEAL";
export const ACTION_LOG_WATER = "LOG_WATER";

/** How long "Later" pushes a reminder out. */
export const SNOOZE_MINUTES = 60;

/** How long "Later" pushes a MEAL reminder out. Shorter — a meal is imminent. */
export const MEAL_SNOOZE_MINUTES = 30;

/** How long "Later" pushes a WATER reminder out. */
export const WATER_SNOOZE_MINUTES = 45;

/** The glass the water button adds when the user hasn't chosen one. */
export const DEFAULT_GLASS_ML = 250;

/**
 * The glass size the water button currently names. Set before registration by
 * whoever knows the user's choice (the water-reminder settings); a change
 * re-registers the category so the button never promises a different amount
 * than the one it records.
 */
let glassMl = DEFAULT_GLASS_ML;

/** "Drank a glass · 250 ml" — the water button, word for word. */
export function waterButtonTitle(ml: number): string {
  return `Drank a glass · ${ml} ml`;
}

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

  await Notifications.setNotificationCategoryAsync(MEAL_REMINDER_CATEGORY, [
    {
      // Past tense, on purpose. "Log meal" sounds like it opens a form; "Ate
      // it" is a statement of fact the user can make from a locked screen, and
      // it is the honest description of what the button records.
      identifier: ACTION_LOG_MEAL,
      buttonTitle: "Ate it",
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: `Not yet (${MEAL_SNOOZE_MINUTES}m)`,
      options: { opensAppToForeground: false },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(WATER_REMINDER_CATEGORY, [
    {
      // The amount is IN the button. "Log water" would leave the user guessing
      // what a tap adds; this says it before they press.
      identifier: ACTION_LOG_WATER,
      buttonTitle: waterButtonTitle(glassMl),
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: `Later (${WATER_SNOOZE_MINUTES}m)`,
      options: { opensAppToForeground: false },
    },
  ]);
}

let registration: Promise<void> | null = null;

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

/**
 * Point the water button at a new glass size and re-register. A no-op when the
 * size is unchanged, so the water sync can call it on every run.
 */
export async function setWaterGlassMl(ml: number): Promise<void> {
  if (!Number.isFinite(ml) || ml <= 0 || ml === glassMl) {
    await ensureNotificationCategories();
    return;
  }
  glassMl = Math.round(ml);
  registration = null;
  await ensureNotificationCategories();
}
