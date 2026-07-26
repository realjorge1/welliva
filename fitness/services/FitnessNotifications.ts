/**
 * FITNESS NOTIFICATIONS — reminder scheduling for the fitness module.
 *
 * Owns ONLY its own notifications: every id it schedules is remembered under
 * one AsyncStorage key and only those ids are ever cancelled — it never calls
 * cancelAll, so the app's proactive-delivery scheduler (health-os) is
 * untouched.
 *
 * Reminder types (all opt-in, configured in Fitness Settings):
 *   • workouts       — on the user's training days at their chosen hour
 *   • hydration      — daily midday nudge
 *   • stretch        — daily evening mobility nudge
 *   • weeklySummary  — Sunday evening week wrap-up
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { FitnessProfile } from "../types";

const SCHEDULED_IDS_KEY = "@welliva_fitness_notification_ids";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** 0 = Mon … 6 = Sun (ours) → 1 = Sun … 7 = Sat (expo weekly trigger). */
export function toExpoWeekday(dayIndex: number): number {
  return ((dayIndex + 1) % 7) + 1;
}

async function loadOwnedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
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

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    return settings.granted;
  } catch {
    return false;
  }
}

/**
 * Re-derive the full reminder schedule from the profile. Idempotent: always
 * cancels this module's previous schedule first, then lays down the new one.
 * No-ops (after cleanup) when permission is missing or everything is off.
 */
export async function syncFitnessReminders(profile: FitnessProfile): Promise<void> {
  await cancelFitnessReminders();

  const { reminders, daysAvailable } = profile;
  const anyOn =
    reminders.workouts || reminders.hydration || reminders.stretch || reminders.weeklySummary;
  if (!anyOn) return;
  if (!(await hasNotificationPermission())) return;

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
    for (const day of daysAvailable) {
      await schedule(
        {
          title: "Training day",
          body: `It's ${DAY_LABELS[day] ?? "a training day"} — your session is ready when you are.`,
        },
        {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: toExpoWeekday(day),
          hour: reminders.hour,
          minute: 0,
        },
      );
    }
  }

  if (reminders.hydration) {
    await schedule(
      { title: "Hydration check", body: "Midday top-up — a glass of water keeps the engine cool." },
      { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 12, minute: 30 },
    );
  }

  if (reminders.stretch) {
    await schedule(
      { title: "Evening unwind", body: "Five minutes of stretching tonight buys an easier tomorrow." },
      { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 30 },
    );
  }

  if (reminders.weeklySummary) {
    await schedule(
      { title: "Your week in review", body: "See what you built this week — open your fitness progress." },
      {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 18,
        minute: 0,
      },
    );
  }

  await saveOwnedIds(ids);
}
