/**
 * services/notifications/streakReminder.ts
 *
 * THE EVENING "STILL OPEN" REMINDER — at most one a day, at 20:00 local, and
 * only when all of these hold (the rules: ./streakReminderPlan):
 *   · the streak is long enough to matter (STREAK_REMINDER_MIN_DAYS),
 *   · today isn't kept yet,
 *   · today isn't a rough day (a paused day can't end the run, and a rough day
 *     silences reminders for the rest of it — ./pause quietDate),
 *   · reminders aren't paused ("Pause all"), and the person hasn't switched
 *     this one off on the Notifications screen.
 *
 * It is withdrawn the moment the day is kept: StreakService announces the keep
 * (onCommitmentKept) and this module re-plans. That listener is installed in
 * ./boot, so it also runs in the headless task that applies a lock-screen
 * press — a day kept from the lock screen never gets "still open" at 20:00.
 *
 * TOMORROW'S is laid as soon as today is kept, so it is waiting even if the
 * app isn't opened tomorrow — the day it matters most. Its number is the run
 * as it will stand tomorrow evening if tomorrow isn't kept by then (and if it
 * is, it's withdrawn).
 *
 * IT BACKS OFF. If the last BACKOFF_AFTER_IGNORED evenings it was laid for all
 * ended unkept, it stays quiet for BACKOFF_DAYS from the last one: a reminder
 * that keeps arriving to no effect is nagging.
 *
 * THE WORDS (./copy streakEveningCopy) are calm and true: they name only
 * things that really keep a day — never a glass of water. No guilt, no countdown.
 */
import * as Notifications from "expo-notifications";
import { readJSON, writeJSON } from "../OfflineStorage";
import { loadStreakData } from "../StreakService";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";
import { ownerStamp } from "./owner";
import { notificationsPaused, quietDate } from "./pause";
import { STREAK_REMINDER_ID_PREFIX, planStreakReminders } from "./streakReminderPlan";

export {
  BACKOFF_AFTER_IGNORED,
  BACKOFF_DAYS,
  STREAK_REMINDER_HOUR,
  STREAK_REMINDER_MIN_DAYS,
  STREAK_REMINDER_MINUTE,
  backedOff,
  planStreakReminders,
  type PlannedStreakReminder,
} from "./streakReminderPlan";

/** On/off (synced, like every other reminder preference). Default on. */
export const STREAK_REMINDER_ON_KEY = "@welliva_streak_reminder_on";
/** The dates it was laid for (device-local: it's this phone's queue). */
export const STREAK_REMINDER_LOG_KEY = "@welliva_streak_reminder_log";
/** `data.type` on every one laid. */
export const STREAK_REMINDER_TYPE = "streak-evening";
const LOG_CAP = 30;

export async function loadStreakReminderOn(): Promise<boolean> {
  return (await readJSON<boolean>(STREAK_REMINDER_ON_KEY, true)) !== false;
}

export async function saveStreakReminderOn(on: boolean): Promise<void> {
  await writeJSON(STREAK_REMINDER_ON_KEY, on);
  await syncStreakReminder();
}

async function cancelOurs(): Promise<void> {
  try {
    for (const p of await Notifications.getAllScheduledNotificationsAsync()) {
      if (p.identifier?.startsWith(STREAK_REMINDER_ID_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(p.identifier).catch(() => {});
      }
    }
  } catch {
    // listing failed — the next sync tries again
  }
}

let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/**
 * Cancel this module's pending reminder(s) and lay what the plan says now.
 * Safe to call any time; never throws. Returns how many were laid.
 */
export function syncStreakReminder(now: Date = new Date()): Promise<number> {
  return serialized(async () => {
    try {
      await cancelOurs();
      if (!(await loadStreakReminderOn())) return 0;
      if (await notificationsPaused()) return 0;
      const perms = await Notifications.getPermissionsAsync();
      if (!perms.granted) return 0;

      const [streak, laid, quiet] = await Promise.all([
        loadStreakData(),
        readJSON<string[]>(STREAK_REMINDER_LOG_KEY, []),
        quietDate(now),
      ]);
      const log = Array.isArray(laid) ? laid : [];
      const plan = planStreakReminders({ now, streak, enabled: true, quietToday: quiet, laid: log });
      if (plan.length === 0) return 0;

      await ensureRemindersChannel();
      const stamp = await ownerStamp();
      for (const p of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: p.identifier,
          content: {
            title: p.title,
            body: p.body,
            data: { type: STREAK_REMINDER_TYPE, date: p.date, route: "/(tabs)", ...stamp },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: REMINDERS_CHANNEL_ID,
            date: p.when,
          },
        });
      }
      await writeJSON(
        STREAK_REMINDER_LOG_KEY,
        [...new Set([...log, ...plan.map((p) => p.date)])].sort().slice(-LOG_CAP),
      );
      return plan.length;
    } catch (e) {
      console.log("[notifications] could not lay the streak reminder", e);
      return 0;
    }
  });
}
