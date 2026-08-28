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
  /**
   * THE GOAL — hit this habit `weeklyGoal` times inside a Mon–Sun week, on
   * whichever days suit you. `null`/absent means the habit is scheduled by
   * weekday instead, which is the original behaviour and still the default.
   *
   * The two modes are mutually exclusive, and a quota habit always stores
   * `days: EVERY_DAY` so that every existing weekday-based caller (reminders,
   * the widget snapshot, `isScheduled`) keeps reading "any day is fair game"
   * without needing to know the quota exists. Only the places that MEASURE —
   * streaks, the week strip, the heatmap's missed tone — branch on it.
   */
  weeklyGoal?: number | null;
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
  /**
   * Consecutive completions ending now. For a weekday habit that's scheduled
   * DAYS; for a goal habit it's WEEKS that met the quota — read `streakUnit`
   * before you put a noun after the number.
   */
  currentStreak: number;
  bestStreak: number;
  /**
   * Consistency over the last 30 days, 0–100. Weekday habits: completed ÷
   * scheduled. Goal habits: completed ÷ the quota's pro-rata share of 30 days.
   */
  last30Pct: number;
  doneToday: boolean;
  /** Completions inside the current Mon–Sun week. */
  weekDone: number;
  /** What this week is measured against: the quota, or the scheduled weekdays. */
  weekTarget: number;
  /** What a streak counts. Goal habits streak in weeks, not days. */
  streakUnit: "day" | "week";
}

export const EVERY_DAY: number[] = [0, 1, 2, 3, 4, 5, 6];

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

/** How the habit's target is expressed. Drives the form's Goal section. */
export type GoalMode = "daily" | "weekly" | "days";

/** Which mode a stored habit is in — the form and the labels both start here. */
export function goalModeOf(habit: Pick<Habit, "days" | "weeklyGoal">): GoalMode {
  if (habit.weeklyGoal != null) return "weekly";
  return habit.days.length >= 7 ? "daily" : "days";
}

/** "Every day", "4× a week", or "Mon, Wed, Fri". */
export function frequencyLabel(days: number[], weeklyGoal?: number | null): string {
  if (weeklyGoal != null) {
    return weeklyGoal >= 7 ? "Every day" : `${weeklyGoal}× a week`;
  }
  if (days.length >= 7) return "Every day";
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(", ");
}

/** "12-day streak" / "3-week streak" — the unit is never assumed. */
export function streakLabel(stats: Pick<HabitStats, "currentStreak" | "streakUnit">): string {
  return `${stats.currentStreak}-${stats.streakUnit} streak`;
}

/**
 * The weekly quotas the form offers, easiest commitment first. Stops at 6 on
 * purpose: 7 isn't a quota, it's the every-day setting, and offering it twice
 * would let the same habit be stored two different ways.
 */
export const WEEKLY_GOAL_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/**
 * A starting quota for a habit, guessed from its name.
 *
 * Purely a SUGGESTION — it pre-highlights one chip in the form and is always
 * overridable. The split is between things that only work as a daily ritual
 * (sleep, water, vitamins) and things that need recovery days or simply aren't
 * daily (gym, runs, long reads), because proposing "every day" for strength
 * training is how a tracker teaches someone to fail in week two.
 *
 * Returns 2–6 for a real quota, 7 for "this one belongs on the every-day
 * setting", or `null` when the name says nothing useful.
 */
export function suggestWeeklyGoal(name: string): number | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;

  const match = (words: string[]) => words.some((w) => n.includes(w));

  // Hard training — needs rest days built into the target.
  if (match(["gym", "workout", "lift", "strength", "weights", "train", "hiit", "crossfit"])) return 4;
  if (match(["run", "jog", "cardio", "swim", "cycle", "bike", "ride", "sport", "class"])) return 3;
  // Deliberate, effortful, but not physical.
  if (match(["meal prep", "cook", "clean", "budget", "journal", "plan", "review", "call"])) return 3;
  if (match(["yoga", "pilates", "stretch", "mobility", "sauna", "cold", "walk", "steps"])) return 5;
  // Daily rituals — the quota is the whole week.
  if (match(["water", "hydrate", "sleep", "bed", "vitamin", "supplement", "meditat", "breath", "read", "floss", "skin", "sunlight", "protein", "no ", "avoid", "quit"])) return 7;

  return null;
}
