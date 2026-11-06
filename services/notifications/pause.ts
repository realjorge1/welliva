/**
 * services/notifications/pause.ts
 *
 * ONE SWITCH FOR ALL OF IT — "Pause notifications".
 *
 * Every kind of notification already has its own off switch (a habit's
 * reminder, the meal slots, the water times, the cycle check-in, workouts,
 * Gozlin's coaching). That is the right place to tune them and the wrong place
 * to say "not now, any of it": a week away, an exam fortnight, a hospital stay.
 * Turning six things off one by one — and remembering to turn the same six back
 * on — is a chore that ends with the app uninstalled instead.
 *
 * So pausing is a layer ABOVE the settings, never an edit to them:
 *
 *   · PAUSE cancels everything welliva has pending in the OS queue, and every
 *     module's sync then lays nothing while the flag is up (each checks
 *     {@link notificationsPaused} right after cancelling its own ids). The
 *     stored settings are untouched.
 *   · RESUME drops the flag and announces it; the reminder runner re-lays every
 *     module from those untouched settings, exactly as if they had never gone.
 *
 * Not paused: what the user does in the moment — the "Try it" demo, a "Later"
 * on a notification already on screen, and the follow-up that answers a press.
 * Those exist only because the user just asked for them.
 *
 * Device-local (services/sync/syncKeys): quiet on this phone is a decision about
 * this phone.
 */
import * as Notifications from "expo-notifications";
import { readJSON, writeJSON } from "../OfflineStorage";
import { roughToday } from "../smart/roughDay";

export const NOTIFICATIONS_PAUSED_KEY = "@welliva_notifications_paused";

type PauseListener = (paused: boolean) => void;
const listeners = new Set<PauseListener>();

/**
 * Is everything paused? Read from storage every time — no in-memory copy — so
 * the headless lock-screen task (a fresh JS runtime) and a data reset can never
 * disagree with what is stored.
 */
export async function notificationsPaused(): Promise<boolean> {
  try {
    return (await readJSON<boolean>(NOTIFICATIONS_PAUSED_KEY, false)) === true;
  } catch {
    return false;
  }
}

/**
 * TODAY, IF IT IS QUIET — a rough day (services/smart/roughDay) silences every
 * reminder for the rest of it, and only it.
 *
 * Not a second switch: every module that honours the pause asks this in the
 * same breath. Reminders laid as DATED notifications — meals, water, the
 * cycle — skip only today's, so tomorrow's are already in place. Repeating ones
 * (habits, workouts) can't skip a single day, so they stand down for today and
 * are laid again by the first sync on a normal day (the next time the app is
 * opened). Returns today's date when quiet, else null. Never throws.
 */
export async function quietDate(now: Date = new Date()): Promise<string | null> {
  try {
    const rough = await roughToday(now);
    return rough ? rough.date : null;
  } catch {
    return null;
  }
}

/**
 * Today turned quiet, or back to normal. The pause listeners re-lay every
 * module from its untouched settings — exactly what either change needs — so
 * they are reused rather than doubled.
 */
export async function announceQuietChange(): Promise<void> {
  const paused = await notificationsPaused();
  for (const fn of [...listeners]) {
    try {
      fn(paused);
    } catch {
      // one bad listener must not stop the others
    }
  }
}

/** Hear about pause/resume — the reminder runner re-lays (or clears) on it. */
export function subscribeNotificationPause(fn: PauseListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Pause or resume. Pausing empties the OS queue NOW — not at the next sync —
 * so the switch means what it says the moment it is flipped. What is already
 * on screen stays: a reminder the user has not answered yet is theirs to answer
 * or swipe away.
 */
export async function setNotificationsPaused(paused: boolean): Promise<void> {
  await writeJSON(NOTIFICATIONS_PAUSED_KEY, paused);
  if (paused) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // no native module — nothing was scheduled
    }
  }
  for (const fn of [...listeners]) {
    try {
      fn(paused);
    } catch {
      // one bad listener must not stop the others
    }
  }
}
