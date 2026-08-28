/**
 * HabitService — storage + the pure habit engine.
 *
 * Storage follows the app's OfflineStorage pattern (AsyncStorage JSON blobs).
 * The engine is pure and deterministic: streaks, best streaks, 30-day rates
 * and heatmap grids are all computed from a Set of done dates + the habit's
 * scheduled weekdays, with `today` injected. Frequency-aware throughout:
 * unscheduled days neither extend nor break a streak.
 *
 * Linked habits (water / meals / workout) never write logs here — their done
 * dates are derived in HabitsContext from the app's existing histories.
 */

import * as Notifications from "expo-notifications";
import {
  EVERY_DAY,
  frequencyLabel,
  type Habit,
  type HabitLogs,
  type HabitStats,
  type HeatWeek,
} from "../models/habit";
import {
  parseLocalDate,
  readJSON,
  toLocalDateString,
  writeJSON,
} from "./OfflineStorage";
import {
  HABIT_REMINDER_CATEGORY,
  ensureNotificationCategories,
} from "./notifications/categories";
import { reminderBody } from "./notifications/copy";
import { REMINDERS_CHANNEL_ID, ensureRemindersChannel } from "./notifications/init";

const HABITS_KEY = "@welliva_habits";
const LOGS_KEY = "@welliva_habit_logs";
const SEEDED_KEY = "@welliva_habits_seeded";

/** How far back streak/heatmap scans ever look. */
const MAX_LOOKBACK_DAYS = 400;

// ── Storage ─────────────────────────────────────────────────────────

export async function loadHabits(): Promise<Habit[]> {
  const habits = await readJSON<Habit[]>(HABITS_KEY, []);
  return [...habits].sort((a, b) => a.order - b.order);
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await writeJSON(HABITS_KEY, habits);
}

export async function loadLogs(): Promise<HabitLogs> {
  return readJSON<HabitLogs>(LOGS_KEY, {});
}

export async function saveLogs(logs: HabitLogs): Promise<void> {
  await writeJSON(LOGS_KEY, logs);
}

/**
 * First-run seed: the three auto-tracked habits that adapt the tracker to
 * Welliva (hydration, nutrition logging, training). Runs once ever — deleting
 * one is a user choice we respect on the next launch.
 */
export async function seedDefaultHabits(
  today: string,
  trainingDays?: number[],
): Promise<Habit[] | null> {
  const seeded = await readJSON<boolean>(SEEDED_KEY, false);
  if (seeded) return null;
  const seedHabits: Habit[] = [
    {
      id: "linked-water",
      name: "Drink water",
      icon: "water",
      color: "#3E9BFF",
      days: EVERY_DAY,
      source: "water",
      reminder: null,
      order: 0,
      createdAt: today,
    },
    {
      id: "linked-meals",
      name: "Log meals",
      icon: "restaurant",
      color: "#3FDD78",
      days: EVERY_DAY,
      source: "meals",
      reminder: null,
      order: 1,
      createdAt: today,
    },
    {
      id: "linked-workout",
      name: "Workout",
      icon: "barbell",
      color: "#FFA13B",
      days: trainingDays && trainingDays.length ? trainingDays : EVERY_DAY,
      source: "workout",
      reminder: null,
      order: 2,
      createdAt: today,
    },
  ];
  await writeJSON(SEEDED_KEY, true);
  await saveHabits(seedHabits);
  return seedHabits;
}

// ── Pure engine ─────────────────────────────────────────────────────

/** JS getDay() (0=Sun…6=Sat) → Welliva weekday index (0=Mon…6=Sun). */
function wellivaDay(dateStr: string): number {
  return (parseLocalDate(dateStr).getDay() + 6) % 7;
}

export function isScheduled(habit: Habit, dateStr: string): boolean {
  return habit.days.includes(wellivaDay(dateStr));
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return toLocalDateString(d);
}

/** Monday of the week containing `dateStr`. Weeks are Mon–Sun app-wide. */
export function weekStartOf(dateStr: string): string {
  return shiftDate(dateStr, -wellivaDay(dateStr));
}

/** Completions inside the Mon–Sun week that `dateStr` falls in. */
export function weekCount(done: Set<string>, dateStr: string): number {
  const start = weekStartOf(dateStr);
  let n = 0;
  for (let i = 0; i < 7; i++) if (done.has(shiftDate(start, i))) n++;
  return n;
}

/**
 * The earliest date this habit's history can meaningfully start from — its
 * creation date, unless completions were somehow logged before it (a restored
 * backup, an edited seed), in which case the data wins.
 */
function firstRelevantDate(habit: Habit, done: Set<string>): string {
  const earliestDone = [...done].sort()[0];
  return earliestDone && earliestDone < habit.createdAt ? earliestDone : habit.createdAt;
}

/**
 * Does this habit still want a tick today?
 *
 * Weekday habits: is today one of their days. GOAL habits: only while the
 * week's quota is unmet — a 4×/week habit finished on Thursday leaves Friday
 * genuinely free, and the day's summary would be lying if it still asked for
 * it. Already ticked today always counts, so the summary's "done" and "total"
 * move together.
 */
export function isDueToday(habit: Habit, done: Set<string>, today: string): boolean {
  if (habit.weeklyGoal == null) return isScheduled(habit, today);
  if (done.has(today)) return true;
  return weekCount(done, today) < habit.weeklyGoal;
}

/**
 * Streaks + 30-day rate, in whichever unit the habit is actually measured in.
 *
 * Two engines behind one shape: weekday habits streak in DAYS against their
 * schedule, goal habits streak in WEEKS against their quota. Both extend the
 * same courtesy to the period in progress — today not being ticked yet, or this
 * week's quota not being filled yet, never breaks a streak, because the period
 * isn't over.
 */
export function computeStats(
  habit: Habit,
  done: Set<string>,
  today: string,
): HabitStats {
  return habit.weeklyGoal != null
    ? goalStats(habit, done, today, habit.weeklyGoal)
    : scheduleStats(habit, done, today);
}

/** The weekday engine: streaks counted in scheduled days. */
function scheduleStats(habit: Habit, done: Set<string>, today: string): HabitStats {
  const doneToday = done.has(today);

  // Current streak
  let currentStreak = 0;
  let cursor = today;
  let first = true;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    if (isScheduled(habit, cursor)) {
      if (done.has(cursor)) {
        currentStreak++;
      } else if (first && cursor === today) {
        // today pending — skip without breaking
      } else {
        break;
      }
      first = false;
    }
    if (cursor < habit.createdAt && !done.has(cursor)) break;
    cursor = shiftDate(cursor, -1);
  }

  // Best streak — single pass from the earliest relevant date to today.
  const start = firstRelevantDate(habit, done);
  const from =
    start > shiftDate(today, -MAX_LOOKBACK_DAYS)
      ? start
      : shiftDate(today, -MAX_LOOKBACK_DAYS);
  let best = 0;
  let run = 0;
  for (let d = from; d <= today; d = shiftDate(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    if (done.has(d)) {
      run++;
      if (run > best) best = run;
    } else if (d !== today) {
      run = 0;
    }
  }
  if (currentStreak > best) best = currentStreak;

  // Last 30 days
  let scheduled = 0;
  let completed = 0;
  for (let i = 0; i < 30; i++) {
    const d = shiftDate(today, -i);
    if (d < habit.createdAt && !done.has(d)) continue;
    if (!isScheduled(habit, d)) continue;
    scheduled++;
    if (done.has(d)) completed++;
  }
  const last30Pct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

  // This week, for the week strip: only scheduled days can be asked for, so
  // only they are counted — otherwise a Mon/Wed/Fri habit ticked on a Sunday
  // would read "4 of 3".
  const monday = weekStartOf(today);
  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftDate(monday, i);
    if (isScheduled(habit, d) && done.has(d)) weekDone++;
  }

  return {
    currentStreak,
    bestStreak: best,
    last30Pct,
    doneToday,
    weekDone,
    weekTarget: Math.min(habit.days.length, 7),
    streakUnit: "day",
  };
}

/**
 * The quota engine: streaks counted in WEEKS that met the goal.
 *
 * The week a habit was created in is exempt from breaking a streak — someone
 * who sets "5× a week" on a Saturday cannot possibly hit it, and punishing them
 * for the calendar is not feedback, it's a bug with a UI.
 */
function goalStats(
  habit: Habit,
  done: Set<string>,
  today: string,
  rawGoal: number,
): HabitStats {
  const goal = Math.max(1, Math.min(7, Math.round(rawGoal)));
  const thisWeek = weekStartOf(today);
  const maxWeeks = Math.floor(MAX_LOOKBACK_DAYS / 7);
  // Same horizon the weekday engine uses — a habit older than the lookback
  // window is scanned from the edge of it, not from its creation date.
  const scanFloor = weekStartOf(shiftDate(today, -MAX_LOOKBACK_DAYS));
  const created = weekStartOf(firstRelevantDate(habit, done));
  const firstWeek = created > scanFloor ? created : scanFloor;

  // Current streak — walk back week by week. The week in progress counts once
  // the quota is filled and is skipped (not broken) while it isn't.
  let currentStreak = 0;
  for (let i = 0, cursor = thisWeek; i < maxWeeks && cursor >= firstWeek; i++) {
    const met = weekCount(done, cursor) >= goal;
    if (met) currentStreak++;
    else if (cursor !== thisWeek && cursor !== firstWeek) break;
    else if (cursor === firstWeek) break; // partial first week — stop, don't punish
    cursor = shiftDate(cursor, -7);
  }

  // Best streak — forward pass over the same weeks.
  let best = 0;
  let run = 0;
  for (let cursor = firstWeek; cursor <= thisWeek; cursor = shiftDate(cursor, 7)) {
    if (weekCount(done, cursor) >= goal) {
      run++;
      if (run > best) best = run;
    } else if (cursor !== thisWeek && cursor !== firstWeek) {
      run = 0;
    }
  }
  if (currentStreak > best) best = currentStreak;

  // Last 30 days, against the quota's pro-rata share of that window. Capped at
  // 100 — beating your own goal is a good week, not a broken percentage.
  const start = firstRelevantDate(habit, done);
  let days = 0;
  let completed = 0;
  for (let i = 0; i < 30; i++) {
    const d = shiftDate(today, -i);
    if (d < start) continue;
    days++;
    if (done.has(d)) completed++;
  }
  const expected = (goal * days) / 7;
  const last30Pct =
    expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0;

  return {
    currentStreak,
    bestStreak: best,
    last30Pct,
    doneToday: done.has(today),
    weekDone: weekCount(done, today),
    weekTarget: goal,
    streakUnit: "week",
  };
}

/**
 * Heatmap grid: `weeks` Monday-based columns ending with the current week,
 * each 7 cells Mon→Sun. Cells after today or before the habit's first
 * relevant date are `outside`.
 */
export function buildHeatWeeks(
  habit: Habit,
  done: Set<string>,
  today: string,
  weeks: number,
): HeatWeek[] {
  const firstRelevant = firstRelevantDate(habit, done);

  // A GOAL habit has no missed days — it only has a week that landed or didn't,
  // and which particular days you used is your business. So no cell is ever
  // marked "scheduled and skipped"; the grid shows the hits and stays quiet
  // about the rest, instead of painting five accusatory squares a week.
  const quota = habit.weeklyGoal != null;

  // Monday of the current week
  const monday = shiftDate(today, -wellivaDay(today));
  const out: HeatWeek[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = shiftDate(monday, -7 * w);
    const col: HeatWeek = [];
    for (let d = 0; d < 7; d++) {
      const date = shiftDate(weekStart, d);
      col.push({
        date,
        done: done.has(date),
        scheduled: quota ? false : isScheduled(habit, date),
        outside: date > today || date < firstRelevant,
      });
    }
    out.push(col);
  }
  return out;
}

/**
 * Month labels for a full-history heatmap: for each week column, the short
 * month name if that column contains the 1st of a month (else "").
 */
export function monthLabels(weeks: HeatWeek[]): string[] {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return weeks.map((week) => {
    const firstOfMonth = week.find((c) => c.date.endsWith("-01"));
    if (!firstOfMonth) return "";
    return MONTHS[parseLocalDate(firstOfMonth.date).getMonth()];
  });
}

// ── Reminders (expo-notifications, local) ───────────────────────────

/**
 * Re-sync a habit's daily/weekly reminders. Cancels any previously scheduled
 * ones and schedules fresh per scheduled weekday. Returns the new ids (store
 * them on the habit). Fails soft — habits work fine without notifications.
 *
 * Every reminder carries the habit-reminder CATEGORY, so it arrives with a
 * "Mark as Done" button that completes the habit without opening the app, and a
 * `data.habitId` the action handler resolves it by. A habit scheduled on only
 * some weekdays gets a different nudge line per day (the `variant` index), since
 * a repeating trigger's body is fixed at schedule time.
 */
export async function syncReminders(habit: Habit): Promise<string[]> {
  try {
    for (const id of habit.reminderIds ?? []) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    if (!habit.reminder || habit.source !== "manual") return [];

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return [];

    // Android drops notifications posted to a channel that doesn't exist yet.
    await ensureRemindersChannel();
    // iOS/Android both need the category registered before delivery, or the
    // banner shows up without its action buttons.
    await ensureNotificationCategories();

    const { hour, minute } = habit.reminder;
    const contentFor = (variant: number) => ({
      title: habit.name,
      body: reminderBody(habit.id, variant),
      categoryIdentifier: HABIT_REMINDER_CATEGORY,
      data: { type: "habit-reminder", habitId: habit.id },
    });

    if (habit.days.length >= 7) {
      const id = await Notifications.scheduleNotificationAsync({
        content: contentFor(0),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: REMINDERS_CHANNEL_ID,
          hour,
          minute,
        },
      });
      return [id];
    }

    const ids: string[] = [];
    for (let i = 0; i < habit.days.length; i++) {
      // expo weekly trigger weekday: 1=Sunday…7=Saturday
      const day = habit.days[i];
      const weekday = day === 6 ? 1 : day + 2;
      const id = await Notifications.scheduleNotificationAsync({
        content: contentFor(i),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: REMINDERS_CHANNEL_ID,
          weekday,
          hour,
          minute,
        },
      });
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Ask for (or read) local-notification permission for reminders. Prompts only
 * when the OS still allows it; returns the resulting grant. Fail-soft: any error
 * or unavailable module reads as not-granted, so the UI can show a hint instead
 * of assuming a reminder was scheduled. Safe to call before {@link syncReminders}
 * (which re-checks and no-ops when not granted).
 */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export { frequencyLabel };
