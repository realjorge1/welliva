/**
 * services/notifications/coachReminders.ts
 *
 * One reminder Gozlin sets when someone asks ("remind me to prep lunch at 7").
 * A single, non-repeating notification, set only after they confirm the sheet.
 *
 * It goes through the same machinery as every other welliva reminder: the
 * reminders channel, the owner stamp (a leftover from a signed-out account is
 * never acted on — ./owner), and the pause rules (./pause). "Pause all"
 * cancels every pending welliva notification, this one included, and a rough
 * day keeps the rest of today quiet, so a reminder for later today is refused
 * on one rather than set to be silenced.
 *
 * The trigger is a TIME INTERVAL in SECONDS from now — the unit both platforms
 * agree on. Fail-soft: every failure is a plain reason, never an exception.
 */
import * as Notifications from "expo-notifications";
import { toLocalDateString } from "../OfflineStorage";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./init";
import { ownerStamp } from "./owner";
import { notificationsPaused, quietDate } from "./pause";

/** `data.kind` on the notification, so a tap is recognisable. */
export const COACH_REMINDER_KIND = "coach-reminder";
/** Shown above their words on the lock screen. */
export const COACH_REMINDER_TITLE = "A reminder you asked for";
/** Sooner than this is not a reminder, it's now. */
export const COACH_REMINDER_MIN_SECONDS = 60;

/**
 * Why a reminder at `at` can't be set right now, in words for the person — or
 * null when it can.
 */
export async function coachReminderBlock(at: Date, now: Date = new Date()): Promise<string | null> {
  if (await notificationsPaused()) return "Your reminders are paused (Pause all, in Settings).";
  const quiet = await quietDate(now);
  if (quiet && toLocalDateString(at) === quiet) {
    return "Today is marked a rough day, so reminders stay quiet for the rest of it.";
  }
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return "Notifications are switched off for welliva on this phone.";
  } catch {
    return "Notifications aren't available on this phone.";
  }
  return null;
}

export type CoachReminderResult = { ok: true; id: string } | { ok: false; reason: string };

export async function scheduleCoachReminder(
  text: string,
  at: Date,
  now: Date = new Date(),
): Promise<CoachReminderResult> {
  const block = await coachReminderBlock(at, now);
  if (block) return { ok: false, reason: block };
  const seconds = Math.round((at.getTime() - now.getTime()) / 1000);
  if (seconds < COACH_REMINDER_MIN_SECONDS) return { ok: false, reason: "That time has already passed." };
  try {
    await ensureRemindersChannel();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: COACH_REMINDER_TITLE,
        body: text,
        data: { kind: COACH_REMINDER_KIND, ...(await ownerStamp()) },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REMINDERS_CHANNEL_ID,
        seconds,
        repeats: false,
      },
    });
    return { ok: true, id };
  } catch (e) {
    console.log("[notifications] could not set a coach reminder", e);
    return { ok: false, reason: "The reminder couldn't be set on this phone." };
  }
}

/** The Undo: take a reminder back before it fires. */
export async function cancelCoachReminder(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.log("[notifications] could not cancel a coach reminder", e);
  }
}
