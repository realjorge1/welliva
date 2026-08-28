/**
 * FITNESS NOTIFICATIONS — reminder scheduling for the fitness module.
 *
 * Owns ONLY its own notifications: every id it schedules is remembered under
 * one AsyncStorage key and only those ids are ever cancelled — it never calls
 * cancelAll, so the app's proactive-delivery scheduler (health-os) and the
 * habit reminders are untouched.
 *
 * Reminder types (all opt-in, configured in Fitness Settings):
 *   • workouts       — on the user's training days at their chosen hour
 *   • hydration      — daily midday nudge
 *   • stretch        — daily evening mobility nudge
 *   • weeklySummary  — Sunday evening week wrap-up
 *
 * ── WHAT A RELEASE BUILD ACTUALLY NEEDS ─────────────────────────────────────
 * Three things a bare `scheduleNotificationAsync` does NOT do on its own, all
 * of which silently produce a reminder that never arrives:
 *
 *  1. THE ANDROID CHANNEL. Android 8+ drops any notification posted to a
 *     channel that doesn't exist. Every trigger here carries the app's shared
 *     `reminders` channel id, and the channel is (re)created before scheduling.
 *  2. A TAP DESTINATION. Without `data.route` a tapped reminder just opens the
 *     app on whatever screen was last shown. Each reminder routes to the screen
 *     its copy promises.
 *  3. AN HONEST RESULT. Permission can be denied, or the profile can have zero
 *     training days — both schedule nothing. {@link syncFitnessReminders}
 *     returns WHY so the caller can tell the user instead of leaving a toggle
 *     switched on that does nothing. Never silently succeed.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "@/services/notifications/init";
import type { FitnessProfile } from "../types";
import { loadFitnessProfile } from "./FitnessProfileStore";

const SCHEDULED_IDS_KEY = "@welliva_fitness_notification_ids";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Where a tapped reminder lands. The fitness dashboard is the `/exercise` tab. */
const DASHBOARD_ROUTE = "/exercise";
const PROGRESS_ROUTE = "/fitness/progress";

/**
 * Why a sync scheduled nothing. `ok` is the only outcome where a reminder will
 * actually arrive — callers must treat everything else as a failed opt-in.
 */
export type FitnessReminderStatus =
  | "ok" // at least one reminder is scheduled
  | "off" // nothing is switched on (a clean cancel)
  | "no-permission" // the OS refused, or the user hasn't granted yet
  | "no-days" // workouts are on but the profile has no training days
  | "failed"; // something was on and permitted, but every schedule call failed

export interface FitnessReminderSync {
  status: FitnessReminderStatus;
  /** How many notifications are now pending from this module. */
  scheduled: number;
}

/** 0 = Mon … 6 = Sun (ours) → 1 = Sun … 7 = Sat (expo weekly trigger). */
export function toExpoWeekday(dayIndex: number): number {
  return ((dayIndex + 1) % 7) + 1;
}

/**
 * Keep only real weekday indices, de-duplicated and ordered. A stray value from
 * older stored data would otherwise schedule a weekly trigger on a nonsense
 * weekday, which expo rejects at schedule time and the user never learns about.
 */
export function normalizeDays(days: readonly number[] | undefined): number[] {
  if (!Array.isArray(days)) return [];
  const seen = new Set<number>();
  for (const d of days) {
    if (Number.isInteger(d) && d >= 0 && d <= 6) seen.add(d);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Clamp a stored hour into a schedulable 0–23, falling back to 17:00. */
export function normalizeHour(hour: number | undefined): number {
  if (!Number.isFinite(hour)) return 17;
  return Math.min(23, Math.max(0, Math.trunc(hour as number)));
}

async function loadOwnedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

async function saveOwnedIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error("FitnessNotifications.saveOwnedIds:", e);
  }
}

/** Cancel exactly the notifications this module scheduled — nothing else. */
export async function cancelFitnessReminders(): Promise<void> {
  const ids = await loadOwnedIds();
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // already fired/cancelled — fine
    }
  }
  await saveOwnedIds([]);
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/**
 * Ask for local-notification permission. Returns the resulting grant — a `false`
 * here means no reminder will ever arrive, so the caller must not leave a
 * toggle switched on. Fail-soft: an unavailable native module reads as denied.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    return (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

/**
 * Re-derive the full reminder schedule from the profile. Idempotent: always
 * cancels this module's previous schedule first, then lays down the new one —
 * so this is equally the way reminders are turned OFF.
 *
 * Returns why nothing was scheduled when nothing was; see {@link FitnessReminderSync}.
 */
export async function syncFitnessReminders(profile: FitnessProfile): Promise<FitnessReminderSync> {
  await cancelFitnessReminders();

  const reminders = profile.reminders;
  const days = normalizeDays(profile.daysAvailable);
  const hour = normalizeHour(reminders?.hour);
  const anyOn =
    !!reminders &&
    (reminders.workouts || reminders.hydration || reminders.stretch || reminders.weeklySummary);
  if (!anyOn) return { status: "off", scheduled: 0 };
  if (!(await hasNotificationPermission())) return { status: "no-permission", scheduled: 0 };

  // Android drops notifications posted to a channel that doesn't exist yet.
  await ensureRemindersChannel();

  const ids: string[] = [];
  const schedule = async (
    content: Notifications.NotificationContentInput,
    trigger: Notifications.NotificationTriggerInput,
  ) => {
    try {
      ids.push(await Notifications.scheduleNotificationAsync({ content, trigger }));
    } catch (e) {
      console.warn("FitnessNotifications.schedule:", e);
    }
  };

  if (reminders.workouts) {
    for (const day of days) {
      await schedule(
        {
          title: "Training day",
          body: `It's ${DAY_LABELS[day]} — your session is ready when you are.`,
          data: { type: "fitness-reminder", kind: "workout", route: DASHBOARD_ROUTE },
        },
        {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: REMINDERS_CHANNEL_ID,
          weekday: toExpoWeekday(day),
          hour,
          minute: 0,
        },
      );
    }
  }

  if (reminders.hydration) {
    await schedule(
      {
        title: "Hydration check",
        body: "Midday top-up — a glass of water keeps the engine cool.",
        data: { type: "fitness-reminder", kind: "hydration", route: DASHBOARD_ROUTE },
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: REMINDERS_CHANNEL_ID,
        hour: 12,
        minute: 30,
      },
    );
  }

  if (reminders.stretch) {
    await schedule(
      {
        title: "Evening unwind",
        body: "Five minutes of stretching tonight buys an easier tomorrow.",
        data: { type: "fitness-reminder", kind: "stretch", route: DASHBOARD_ROUTE },
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: REMINDERS_CHANNEL_ID,
        hour: 20,
        minute: 30,
      },
    );
  }

  if (reminders.weeklySummary) {
    await schedule(
      {
        title: "Your week in review",
        body: "See what you built this week — open your fitness progress.",
        data: { type: "fitness-reminder", kind: "weekly-summary", route: PROGRESS_ROUTE },
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: REMINDERS_CHANNEL_ID,
        weekday: 1, // Sunday
        hour: 18,
        minute: 0,
      },
    );
  }

  await saveOwnedIds(ids);

  if (ids.length === 0) {
    // Switched on, permitted, and still nothing pending. Either workouts were
    // the only reminder and there are no training days to hang them on, or
    // every native schedule call failed. Both are failures to report, not an
    // "off" — the caller must not leave a switch claiming a live reminder.
    const onlyWorkouts =
      reminders.workouts && !reminders.hydration && !reminders.stretch && !reminders.weeklySummary;
    return { status: onlyWorkouts && days.length === 0 ? "no-days" : "failed", scheduled: 0 };
  }
  return { status: "ok", scheduled: ids.length };
}

/**
 * Re-derive the schedule from whatever is stored, without needing the profile
 * in hand. Called at boot: a schedule can go missing between launches (the user
 * granted permission in OS Settings after opting in, the OS cleared pending
 * notifications, an app reinstall restored AsyncStorage but not the schedule),
 * and this repairs it. A no-op — after the cancel pass — when nothing is on.
 */
export async function refreshFitnessReminders(): Promise<FitnessReminderSync> {
  try {
    return await syncFitnessReminders(await loadFitnessProfile());
  } catch {
    return { status: "off", scheduled: 0 };
  }
}
