/**
 * services/notifications/streakReminderPlan.ts
 *
 * The evening "still open" reminder's RULES, with no notification code, so
 * they run under the Node test runner. ./streakReminder lays what this plans.
 * See that file's header for what the reminder is and why.
 */
import { keptOn, readCommitment, shiftDay, type StreakLike } from "../commitment";
import { toLocalDateString } from "../OfflineStorage";
import { streakEveningCopy } from "./copy";

/** When it arrives. One named place to move it. */
export const STREAK_REMINDER_HOUR = 20;
export const STREAK_REMINDER_MINUTE = 0;
/**
 * The shortest run worth a reminder. A one- or two-day run isn't a habit yet,
 * and a nudge that early reads as pressure; by three days there's something
 * the person has built and might want to keep.
 */
export const STREAK_REMINDER_MIN_DAYS = 3;
/** This many reminded evenings in a row ending unkept → back off. */
export const BACKOFF_AFTER_IGNORED = 3;
/** …for this many days from the last one. */
export const BACKOFF_DAYS = 7;
/** The identifier prefix of every one laid. */
export const STREAK_REMINDER_ID_PREFIX = "welliva.streak-evening.";

export interface PlannedStreakReminder {
  identifier: string;
  /** The day it asks about. */
  date: string;
  when: Date;
  title: string;
  body: string;
}

/**
 * Has it been ignored enough to stay quiet today? The most recent laid dates
 * before today that ended unkept — a rough day in between counts as neither
 * (nothing was sent on it).
 */
export function backedOff(laid: readonly string[], streak: StreakLike, today: string): boolean {
  const past = [...new Set(laid)].filter((d) => d < today).sort().reverse();
  const paused = new Set(streak.paused ?? []);
  const considered = past.filter((d) => !paused.has(d)).slice(0, BACKOFF_AFTER_IGNORED);
  if (considered.length < BACKOFF_AFTER_IGNORED) return false;
  if (keptOn(streak, considered).some(Boolean)) return false;
  return considered[0] > shiftDay(today, -BACKOFF_DAYS);
}

function eveningOf(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, STREAK_REMINDER_HOUR, STREAK_REMINDER_MINUTE, 0, 0);
}

/** Which reminders should be pending right now: 0, 1 or 2. */
export function planStreakReminders(input: {
  now: Date;
  streak: StreakLike;
  enabled: boolean;
  /** Today's date when it is a quiet (rough) day, else null — ./pause quietDate. */
  quietToday: string | null;
  laid: readonly string[];
}): PlannedStreakReminder[] {
  const { now, streak, enabled, quietToday, laid } = input;
  if (!enabled) return [];
  const today = toLocalDateString(now);
  if (backedOff(laid, streak, today)) return [];
  const state = readCommitment(streak, today);
  const out: PlannedStreakReminder[] = [];
  const add = (date: string, days: number) => {
    const when = eveningOf(date);
    if (when.getTime() <= now.getTime()) return;
    out.push({ identifier: `${STREAK_REMINDER_ID_PREFIX}${date}`, date, when, ...streakEveningCopy(days, date) });
  };

  // Today, while it is open: not kept, not a rough day, a run worth keeping.
  if (
    !state.keptToday &&
    !state.pausedToday &&
    quietToday !== today &&
    state.streak >= STREAK_REMINDER_MIN_DAYS
  ) {
    add(today, state.streak);
  }
  // Tomorrow, once today is kept: the run tomorrow evening, if it's still open then.
  if (state.keptToday && state.streak >= STREAK_REMINDER_MIN_DAYS) {
    add(shiftDay(today, 1), state.streak);
  }
  return out;
}
