/**
 * FITNESS NOTIFICATIONS — reminder scheduling for the fitness module.
 *
 * Owns ONLY its own notifications: each has a fixed `welliva.fitness.*` id, the
 * ids are remembered under one AsyncStorage key, and a cancel touches only
 * those plus any stray `fitness-reminder` the list lost — it never calls
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
import {
  DEFAULT_GLASS_ML,
  WATER_REMINDER_CATEGORY,
  ensureNotificationCategories,
} from "@/services/notifications/categories";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "@/services/notifications/init";
import { ownerStamp } from "@/services/notifications/owner";
import { notificationsPaused, quietDate } from "@/services/notifications/pause";
import {
  DEFAULT_WATER_SETTINGS,
  loadWaterReminders,
  waterRemindersOn,
} from "@/services/notifications/waterReminders";
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
  | "paused" // the user paused all notifications; laid again on resume
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

/**
 * Every reminder this module lays has a FIXED identifier under this prefix, so
 * laying it again replaces it instead of adding a copy. With random ids (before
 * 2026-11-15) two overlapping syncs — the boot repair, a settings save, the
 * plan adopting its training days — each laid a full set while only the last
 * set was remembered; the rest could never be cancelled and returned as
 * duplicate "Training day" notifications (a test phone held 3 of each).
 */
const ID_PREFIX = "welliva.fitness.";

/** The fixed identifier of one reminder: its kind, plus the day for a per-day one. */
export function fitnessReminderId(kind: string, day?: number): string {
  return day === undefined ? `${ID_PREFIX}${kind}` : `${ID_PREFIX}${kind}.${day}`;
}

/**
 * Cancel this module's notifications — nothing else. The remembered ids go,
 * and a sweep of the OS queue catches any of ours the list lost: an orphan of
 * an overlapping sync, a crash between schedule and save, or the random ids of
 * earlier builds. "Ours" = our id prefix or our `fitness-reminder` data type,
 * which no other module uses.
 */
export async function cancelFitnessReminders(): Promise<void> {
  const doomed = new Set(await loadOwnedIds());
  try {
    for (const p of await Notifications.getAllScheduledNotificationsAsync()) {
      const type = (p.content?.data as { type?: unknown } | null | undefined)?.type;
      if (p.identifier?.startsWith(ID_PREFIX) || type === "fitness-reminder") {
        doomed.add(p.identifier);
      }
    }
  } catch {
    // listing failed — the remembered ids still go
  }
  for (const id of doomed) {
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
 *
 * Calls run ONE AT A TIME, in the order they were made: each cancel-and-re-lay
 * finishes before the next begins, so the newest call's settings stand.
 */
export function syncFitnessReminders(profile: FitnessProfile): Promise<FitnessReminderSync> {
  return oneAtATime(() => syncNow(profile));
}

let tail: Promise<unknown> = Promise.resolve();

/** Queue a job behind every earlier sync; a failed job never blocks the next. */
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.catch(() => undefined);
  return run;
}

async function syncNow(profile: FitnessProfile): Promise<FitnessReminderSync> {
  await cancelFitnessReminders();

  const reminders = profile.reminders;
  const days = normalizeDays(profile.daysAvailable);
  const hour = normalizeHour(reminders?.hour);
  const anyOn =
    !!reminders &&
    (reminders.workouts || reminders.hydration || reminders.stretch || reminders.weeklySummary);
  if (!anyOn) return { status: "off", scheduled: 0 };
  // Paused — or a quiet rough day, which can only stand repeating reminders
  // down until the first sync on a normal day (services/notifications/pause).
  if ((await notificationsPaused()) || (await quietDate())) return { status: "paused", scheduled: 0 };
  if (!(await hasNotificationPermission())) return { status: "no-permission", scheduled: 0 };

  // The water check-ins (services/notifications/waterReminders) already ask
  // about a glass at times the user picked — and they know when the last one
  // was. A second, fixed 12:30 ask on top would be the same question twice, so
  // while they're on, they carry the hydration check.
  const waterCovers =
    reminders.hydration &&
    waterRemindersOn(await loadWaterReminders().catch(() => DEFAULT_WATER_SETTINGS));
  const hydrationLaid = reminders.hydration && !waterCovers;

  // Android drops notifications posted to a channel that doesn't exist yet.
  await ensureRemindersChannel();
  // The hydration nudge carries the water button, which must be registered
  // before delivery or the banner arrives without it.
  await ensureNotificationCategories();

  const stamp = await ownerStamp();
  const ids: string[] = [];
  const schedule = async (
    identifier: string,
    content: Notifications.NotificationContentInput,
    trigger: Notifications.NotificationTriggerInput,
  ) => {
    try {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: { ...content, data: { ...(content.data ?? {}), ...stamp } },
          trigger,
        }),
      );
    } catch (e) {
      console.warn("FitnessNotifications.schedule:", e);
    }
  };

  if (reminders.workouts) {
    for (const day of days) {
      await schedule(
        fitnessReminderId("workout", day),
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

  if (hydrationLaid) {
    await schedule(
      fitnessReminderId("hydration"),
      {
        title: "Hydration check",
        body: "Midday top-up — a glass keeps the engine cool. One tap logs it.",
        // The water button: a glass is a fact the user can state from a locked
        // screen, so this nudge can finish itself (services/notifications/
        // waterActions). The amount rides in data so the write matches the label.
        categoryIdentifier: WATER_REMINDER_CATEGORY,
        data: {
          type: "fitness-reminder",
          kind: "hydration",
          ml: DEFAULT_GLASS_ML,
          route: DASHBOARD_ROUTE,
        },
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
      fitnessReminderId("stretch"),
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
      fitnessReminderId("weekly-summary"),
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
    // The hydration check was the only thing on, and the water check-ins are
    // delivering it — a reminder WILL arrive, so this is not a failure.
    if (waterCovers && !reminders.workouts && !reminders.stretch && !reminders.weeklySummary) {
      return { status: "ok", scheduled: 0 };
    }
    // Switched on, permitted, and still nothing pending. Either workouts were
    // the only reminder and there are no training days to hang them on, or
    // every native schedule call failed. Both are failures to report, not an
    // "off" — the caller must not leave a switch claiming a live reminder.
    const onlyWorkouts =
      reminders.workouts && !hydrationLaid && !reminders.stretch && !reminders.weeklySummary;
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
    // Read inside the queue, so the profile is the newest one saved.
    return await oneAtATime(async () => syncNow(await loadFitnessProfile()));
  } catch {
    return { status: "off", scheduled: 0 };
  }
}
