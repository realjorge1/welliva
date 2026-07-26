/**
 * Habit model — the manual habit tracker plus "linked" habits that derive
 * completion automatically from data the app already logs (water, meals,
 * workouts). Weeks are Monday-based app-wide: day indices are 0=Mon…6=Sun.
 */

/** Where a habit's completions come from. */
export type HabitSource =
  | "manual" // user taps to complete
  | "water" // auto: daily water goal reached
  | "meals" // auto: at least one meal logged that day
  | "workout"; // auto: a workout session logged that day

export interface HabitReminder {
  hour: number; // 0–23, local
  minute: number; // 0–59
}

export interface Habit {
  id: string;
  name: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Hex hue from the habit palette — tints icon, checks & heatmap. */
  color: string;
  /**
   * Scheduled weekdays, 0=Mon…6=Sun. Length 7 means "every day".
   * Unscheduled days never count for or against streaks.
   */
  days: number[];
  source: HabitSource;
  reminder: HabitReminder | null;
  /** Scheduled expo-notifications ids, so edits can cancel stale reminders. */
  reminderIds?: string[];
  /** Manual sort position in the list. */
  order: number;
  createdAt: string; // YYYY-MM-DD (local)
}

/** Manual completion log: habitId → sorted list of YYYY-MM-DD done dates. */
export type HabitLogs = Record<string, string[]>;

/** One cell of a habit heatmap. */
export interface HeatCell {
  date: string; // YYYY-MM-DD
  done: boolean;
  scheduled: boolean;
  /** After today, or before the habit existed — rendered near-invisible. */
  outside: boolean;
}

/** A Monday-based week column of 7 cells (Mon first). */
export type HeatWeek = HeatCell[];

export interface HabitStats {
  /** Consecutive scheduled days completed, ending today or yesterday. */
  currentStreak: number;
  bestStreak: number;
  /** Completed ÷ scheduled over the last 30 days, 0–100. */
  last30Pct: number;
  doneToday: boolean;
}

export const EVERY_DAY: number[] = [0, 1, 2, 3, 4, 5, 6];

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

/** "Every day" or "Mon, Wed, Fri". */
export function frequencyLabel(days: number[]): string {
  if (days.length >= 7) return "Every day";
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(", ");
}
