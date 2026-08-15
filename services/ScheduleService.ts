/**
 * SCHEDULE SERVICE
 * Manages diet scheduling for daily and weekly plans
 * Handles today's diet resolution and history
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DietData } from "../constants/DietDatabase";
import { calculateConsumedNutrition } from "./DietPlanGenerator";
import {
    DayName,
    DaySchedule,
    DietHistoryEntry,
    formatDate,
    getDayName,
    MealType,
    ScheduledDiet,
    ScheduledMeal,
    TodayDiet,
    WeekSchedule,
} from "../models/diet";
import { KEYS } from "./OfflineStorage";
import { pruneDatedArray, RETENTION_DAYS } from "./sync/retention";

// Storage keys — sourced from the central KEYS registry (single source of truth).
const STORAGE_KEYS = {
  SCHEDULED_DIETS: KEYS.SCHEDULED_DIETS,
  WEEK_SCHEDULES: KEYS.WEEK_SCHEDULES,
  DIET_HISTORY: KEYS.DIET_HISTORY,
  LAST_CHECKED_DATE: KEYS.LAST_CHECKED_DATE,
};

// ============================================================================
// BACK-LOGGING WINDOW
// ============================================================================

/**
 * How many days back a user may still tick meals they forgot to log.
 *
 * One. Yesterday is recoverable ("did you eat these and forget to log?");
 * anything older is frozen. The limit is the point: a tracker you can edit
 * indefinitely stops measuring what you ate and starts measuring what you can
 * remember, and a week-old guess is worse than an honest gap. It also keeps the
 * end-of-period report meaningful, since history can't be rewritten after the
 * fact to flatter the result.
 */
export const BACKLOG_GRACE_DAYS = 1;

const dayMs = 86_400_000;

/** Local YYYY-MM-DD for today. Mirrors models/diet.formatDate. */
function todayStr(): string {
  return formatDate(new Date());
}

/** Shift a local YYYY-MM-DD by N days without UTC drift. */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);
  base.setDate(base.getDate() + days);
  return formatDate(base);
}

/** Whole days from `from` to `to`. */
function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / dayMs,
  );
}

export type LogPermission =
  /** Today — normal logging. */
  | "open"
  /** Within the grace window — allowed, and the UI should say it's a back-log. */
  | "backlog"
  /** Older than the grace window — permanently closed. */
  | "locked"
  /** In the future — nothing to log yet. */
  | "future";

/**
 * May the user change consumption for `date`? The single authority on the rule;
 * both the UI (to decide what to enable) and the mutations (to enforce it) ask
 * this, so the button state and the write guard can never disagree.
 */
export function logPermissionFor(
  date: string,
  today: string = todayStr(),
): LogPermission {
  const delta = diffDays(date, today);
  if (delta < 0) return "future";
  if (delta === 0) return "open";
  if (delta <= BACKLOG_GRACE_DAYS) return "backlog";
  return "locked";
}

/** Convenience predicate for call sites that only need yes/no. */
export function canLogForDate(date: string, today: string = todayStr()): boolean {
  const p = logPermissionFor(date, today);
  return p === "open" || p === "backlog";
}

/**
 * Serialized write lock.
 *
 * Every mutation here is a read-modify-write of a whole AsyncStorage array.
 * Without serialization, two near-simultaneous calls (e.g. tapping two meals
 * quickly, or a meal toggle racing the day-change regen) both read the OLD
 * array and the last writer clobbers the other's change — a meal silently
 * "un-taps". Chaining every mutation guarantees each one sees the previous
 * write's result.
 */
let opChain: Promise<unknown> = Promise.resolve();
function withLock<T>(op: () => Promise<T>): Promise<T> {
  const result = opChain.then(op, op);
  // Swallow errors on the chain so one failed op can't poison the next.
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Schedule a diet for a single day
 */
export async function scheduleDietForDay(
  diet: DietData,
  date: string,
  schedule: Omit<DaySchedule, "date" | "dietId" | "dietName" | "status">,
): Promise<ScheduledDiet> {
  const scheduledDiet: ScheduledDiet = {
    id: `diet_${Date.now()}`,
    date,
    dietId: diet.id,
    dietName: diet.name,
    scheduleType: "single_day",
    schedule: {
      ...schedule,
      date,
      dietId: diet.id,
      dietName: diet.name,
      status: new Date(date) > new Date() ? "upcoming" : "active",
    },
    createdAt: new Date().toISOString(),
  };

  // Save to storage
  const existing = await getScheduledDiets();
  // Remove any existing schedule for this date
  const filtered = existing.filter((d) => d.date !== date);
  filtered.push(scheduledDiet);
  await AsyncStorage.setItem(
    STORAGE_KEYS.SCHEDULED_DIETS,
    JSON.stringify(filtered),
  );

  return scheduledDiet;
}

/**
 * Save a fully-formed DaySchedule (e.g. from DietPlanGenerator).
 * Unlike scheduleDietForDay, the schedule already has date/dietId/etc filled in.
 */
export async function saveDaySchedule(daySchedule: DaySchedule): Promise<void> {
  return withLock(async () => {
    const scheduledDiet: ScheduledDiet = {
      id: `diet_${Date.now()}`,
      date: daySchedule.date,
      dietId: daySchedule.dietId,
      dietName: daySchedule.dietName,
      scheduleType: "single_day",
      schedule: daySchedule,
      createdAt: new Date().toISOString(),
    };

    const existing = await getScheduledDiets();
    const filtered = existing.filter((d) => d.date !== daySchedule.date);
    filtered.push(scheduledDiet);
    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEDULED_DIETS,
      JSON.stringify(filtered),
    );
  });
}

/**
 * Read the saved single-day schedule for a date, if one exists. Lets the
 * offline-first rollover serve a cached (AI-generated) day instead of
 * clobbering it with a freshly generated plan.
 */
export async function getScheduleForDate(
  date: string,
): Promise<DaySchedule | null> {
  const existing = await getScheduledDiets();
  const match = existing.find((d) => d.date === date);
  return match ? match.schedule : null;
}

/**
 * Drop every scheduled single-day diet AFTER `date` (keeps today + past). Used
 * when a preference change makes the cached upcoming days stale, so they get
 * regenerated fresh in the new style. Dates are YYYY-MM-DD, so string
 * comparison is chronological.
 */
export async function clearScheduledDietsAfter(date: string): Promise<void> {
  return withLock(async () => {
    const existing = await getScheduledDiets();
    const kept = existing.filter((d) => d.date <= date);
    if (kept.length !== existing.length) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SCHEDULED_DIETS,
        JSON.stringify(kept),
      );
    }
  });
}

/**
 * Schedule a diet for a week
 */
export async function scheduleDietForWeek(
  diet: DietData,
  weekStart: string,
  daySchedules: Record<
    DayName,
    Omit<DaySchedule, "date" | "dietId" | "dietName" | "status">
  >,
): Promise<WeekSchedule> {
  const startDate = new Date(weekStart);

  const weekSchedule: WeekSchedule = {
    id: `week_${Date.now()}`,
    weekStart,
    dietId: diet.id,
    dietName: diet.name,
    days: {} as WeekSchedule["days"],
    createdAt: new Date().toISOString(),
  };

  // Create day schedules for each day of the week
  const dayNames: DayName[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  dayNames.forEach((dayName, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateStr = formatDate(date);

    weekSchedule.days[dayName] = {
      ...daySchedules[dayName],
      date: dateStr,
      dietId: diet.id,
      dietName: diet.name,
      status: "upcoming",
    };
  });

  // Save to storage
  const existing = await getWeekSchedules();
  // Remove any overlapping week schedules
  const filtered = existing.filter((w) => w.weekStart !== weekStart);
  filtered.push(weekSchedule);
  await AsyncStorage.setItem(
    STORAGE_KEYS.WEEK_SCHEDULES,
    JSON.stringify(filtered),
  );

  return weekSchedule;
}

/**
 * Get diet for today
 * Resolves from daily schedules first, then weekly schedules
 */
export async function getTodayDiet(): Promise<TodayDiet> {
  const today = formatDate(new Date());
  const dayName = getDayName(new Date());

  // Check for daily scheduled diet first
  const scheduledDiets = await getScheduledDiets();
  const todayScheduled = scheduledDiets.find((d) => d.date === today);

  if (todayScheduled) {
    return {
      hasScheduledDiet: true,
      source: "daily",
      schedule: todayScheduled.schedule,
    };
  }

  // Check weekly schedules
  const weekSchedules = await getWeekSchedules();
  for (const week of weekSchedules) {
    const weekStart = new Date(week.weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const todayDate = new Date(today);
    if (todayDate >= weekStart && todayDate <= weekEnd) {
      const daySchedule = week.days[dayName];
      if (daySchedule) {
        return {
          hasScheduledDiet: true,
          source: "weekly",
          schedule: daySchedule,
        };
      }
    }
  }

  // Check for expired unfinished diet from yesterday
  const reminder = await checkForExpiredDiet();

  return {
    hasScheduledDiet: false,
    source: "none",
    schedule: null,
    reminder,
  };
}

/**
 * Check for expired unfinished diet
 */
async function checkForExpiredDiet(): Promise<TodayDiet["reminder"]> {
  const lastChecked = await AsyncStorage.getItem(
    STORAGE_KEYS.LAST_CHECKED_DATE,
  );
  const today = formatDate(new Date());

  if (lastChecked === today) {
    return { type: "none" };
  }

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  // Check if there was a scheduled diet yesterday
  const history = await getDietHistory();
  const yesterdayEntry = history.find((h) => h.date === yesterdayStr);

  // Update last checked date
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECKED_DATE, today);

  if (yesterdayEntry) {
    if (yesterdayEntry.status === "completed") {
      return {
        type: "completed",
        message: "Great job completing your diet yesterday!",
      };
    } else if (
      yesterdayEntry.status === "partial" ||
      yesterdayEntry.status === "skipped"
    ) {
      return {
        type: "expired",
        message: "You had meals scheduled yesterday that were not completed.",
      };
    }
  }

  return { type: "none" };
}

/**
 * Mark a meal as consumed.
 *
 * Returns false when the date is outside the back-log window, so the caller can
 * explain the refusal rather than appearing to succeed. The guard lives here —
 * at the write — because a check that only exists in the UI is a check that
 * eventually gets bypassed by a new call site.
 */
export async function markMealConsumed(
  date: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  snackIndex?: number,
): Promise<boolean> {
  if (!canLogForDate(date)) return false;
  return withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);

    if (index >= 0) {
      const diet = scheduledDiets[index];
      if (mealType === "snack" && typeof snackIndex === "number") {
        if (diet.schedule.snacks[snackIndex]) {
          diet.schedule.snacks[snackIndex].isConsumed = true;
          diet.schedule.snacks[snackIndex].consumedAt =
            new Date().toISOString();
        }
      } else if (mealType !== "snack" && diet.schedule[mealType]) {
        (diet.schedule[mealType] as ScheduledMeal).isConsumed = true;
        (diet.schedule[mealType] as ScheduledMeal).consumedAt =
          new Date().toISOString();
      }

      scheduledDiets[index] = diet;
      await AsyncStorage.setItem(
        STORAGE_KEYS.SCHEDULED_DIETS,
        JSON.stringify(scheduledDiets),
      );
      return true;
    }
    return false;
  });
}

/**
 * Toggle a meal's consumed status (mark consumed or unmark).
 *
 * Returns false when the date is closed to logging. Editing a past-but-open day
 * also rewrites that day's history row, since its adherence and macro totals
 * have just changed — without that, a back-logged meal would show as ticked but
 * never reach the streaks or the period report.
 */
export async function toggleMealConsumed(
  date: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  snackIndex?: number,
): Promise<boolean> {
  const permission = logPermissionFor(date);
  if (permission !== "open" && permission !== "backlog") return false;

  const applied = await withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);

    if (index >= 0) {
      const diet = scheduledDiets[index];
      if (mealType === "snack" && typeof snackIndex === "number") {
        if (diet.schedule.snacks[snackIndex]) {
          const wasConsumed = diet.schedule.snacks[snackIndex].isConsumed;
          diet.schedule.snacks[snackIndex].isConsumed = !wasConsumed;
          diet.schedule.snacks[snackIndex].consumedAt = wasConsumed
            ? undefined
            : new Date().toISOString();
        }
      } else if (mealType !== "snack" && diet.schedule[mealType]) {
        const meal = diet.schedule[mealType] as ScheduledMeal;
        const wasConsumed = meal.isConsumed;
        meal.isConsumed = !wasConsumed;
        meal.consumedAt = wasConsumed ? undefined : new Date().toISOString();
      }

      scheduledDiets[index] = diet;
      await AsyncStorage.setItem(
        STORAGE_KEYS.SCHEDULED_DIETS,
        JSON.stringify(scheduledDiets),
      );
      return true;
    }
    return false;
  });

  // A back-logged day is already closed, so its history row is stale the moment
  // a meal is ticked. Recompute it (processDayEnd is idempotent) so adherence
  // and macro totals stay consistent with what the user just told us.
  if (applied && permission === "backlog") {
    await processDayEnd(date);
  }
  return applied;
}

/**
 * Swap a meal in today's schedule with a new meal
 */
export async function swapMealInSchedule(
  date: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  newMeal: ScheduledMeal,
  snackIndex?: number,
): Promise<void> {
  return withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);

    if (index >= 0) {
      const diet = scheduledDiets[index];
      if (mealType === "snack" && typeof snackIndex === "number") {
        if (diet.schedule.snacks[snackIndex]) {
          diet.schedule.snacks[snackIndex] = newMeal;
        }
      } else if (mealType !== "snack") {
        (diet.schedule as unknown as Record<string, unknown>)[mealType] =
          newMeal;
      }

      scheduledDiets[index] = diet;
      await AsyncStorage.setItem(
        STORAGE_KEYS.SCHEDULED_DIETS,
        JSON.stringify(scheduledDiets),
      );
    }
  });
}

/**
 * Append an extra snack to a day's schedule — e.g. a single whole food logged
 * from the Foods catalog. Returns false if no diet is scheduled for `date`
 * (nothing to attach the snack to). Consumed totals still derive from the
 * snack's isConsumed flag, exactly like a planned snack.
 */
export async function addSnackToSchedule(
  date: string,
  meal: ScheduledMeal,
): Promise<boolean> {
  return withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);
    if (index < 0) return false;
    const diet = scheduledDiets[index];
    diet.schedule.snacks.push(meal);
    scheduledDiets[index] = diet;
    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEDULED_DIETS,
      JSON.stringify(scheduledDiets),
    );
    return true;
  });
}

/**
 * Close a day: roll its outcome into history.
 *
 * The day's SCHEDULE IS DELIBERATELY KEPT. It used to be deleted here, which
 * made back-logging impossible — once the schedule was gone there was nothing
 * left to tick. Purging is now a separate, later step (purgeExpiredSchedules)
 * that runs only once the day has fallen out of the back-log window.
 *
 * Idempotent: re-running it for the same date recomputes and replaces that
 * date's history entry, which is exactly what a back-log tick needs.
 */
export async function processDayEnd(date: string): Promise<void> {
  return withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const dayDiet = scheduledDiets.find((d) => d.date === date);
    if (!dayDiet) return;

    const schedule = dayDiet.schedule;
    let mealsConsumed = 0;
    let totalMeals = 0;
    // Track meal names by outcome so Adaptive Nutrition can learn food
    // preferences (which kinds of meals get eaten vs routinely skipped).
    const consumedMeals: string[] = [];
    const skippedMeals: string[] = [];
    const tally = (meal: { name: string; isConsumed: boolean } | null) => {
      if (!meal) return;
      totalMeals++;
      if (meal.isConsumed) {
        mealsConsumed++;
        consumedMeals.push(meal.name);
      } else {
        skippedMeals.push(meal.name);
      }
    };

    // Count meals
    tally(schedule.breakfast);
    tally(schedule.lunch);
    tally(schedule.dinner);
    for (const snack of schedule.snacks) tally(snack);

    // Capture the local clock time (minutes from midnight) each slot was
    // actually eaten, so meal-time learning can pace future "next meal" windows
    // off the user's real habits. Snack is the average of consumed snack times.
    const mealTimes: Partial<Record<MealType, number>> = {};
    const minsOf = (iso?: string): number | null => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.getHours() * 60 + d.getMinutes();
    };
    const recordTime = (type: MealType, meal: ScheduledMeal | null) => {
      if (!meal?.isConsumed) return;
      const m = minsOf(meal.consumedAt);
      if (m != null) mealTimes[type] = m;
    };
    recordTime("breakfast", schedule.breakfast);
    recordTime("lunch", schedule.lunch);
    recordTime("dinner", schedule.dinner);
    const snackMins = schedule.snacks
      .filter((s) => s.isConsumed)
      .map((s) => minsOf(s.consumedAt))
      .filter((m): m is number => m != null);
    if (snackMins.length > 0) {
      mealTimes.snack = Math.round(
        snackMins.reduce((a, b) => a + b, 0) / snackMins.length,
      );
    }

    // Determine status
    let status: "completed" | "partial" | "skipped";
    if (mealsConsumed === totalMeals) {
      status = "completed";
    } else if (mealsConsumed > 0) {
      status = "partial";
    } else {
      status = "skipped";
    }

    // Roll up the macros the user actually consumed (single source of truth:
    // derived from the schedule's isConsumed flags), so weekly summaries can
    // report real averages — not just adherence.
    const consumed = calculateConsumedNutrition(schedule);

    // Save to history
    const historyEntry: DietHistoryEntry = {
      date,
      dietId: dayDiet.dietId,
      dietName: dayDiet.dietName,
      mealsConsumed,
      totalMeals,
      status,
      consumedCalories: consumed.calories,
      consumedProteinG: consumed.proteinG,
      consumedCarbsG: consumed.carbsG,
      consumedFatG: consumed.fatG,
      consumedMeals,
      skippedMeals,
      ...(Object.keys(mealTimes).length > 0 ? { mealTimes } : {}),
    };

    const history = await getDietHistory();
    // Remove existing entry for this date — recomputing on back-log replaces it.
    const filtered = history.filter((h) => h.date !== date);
    filtered.unshift(historyEntry);
    // Bound it. This document is re-uploaded in full on every day-close, and
    // grew forever — 400 days keeps every trend chart whole while anything
    // older survives as a compacted health-os day summary.
    const bounded = await pruneDatedArray(
      filtered as unknown as Record<string, unknown>[],
      "date",
      RETENTION_DAYS.DAILY_HISTORY,
    );
    await AsyncStorage.setItem(STORAGE_KEYS.DIET_HISTORY, JSON.stringify(bounded));
    // NOTE: the schedule for `date` is intentionally left in place so the user
    // can still back-log it. purgeExpiredSchedules removes it once it ages out.
  });
}

/**
 * Catch up every day that ended while the app wasn't running.
 *
 * The old rollover only ever closed the single date the app was last open on,
 * so closing the app on Monday and reopening it on Friday left Tuesday through
 * Thursday permanently unclosed: no history rows, no adherence, and days that
 * silently vanished from the period report. This sweeps ALL past scheduled days
 * instead, oldest first, then drops the ones past the back-log window.
 *
 * Safe to call on every app open and every rollover tick — processDayEnd is
 * idempotent, and closing a day twice just recomputes the same history row.
 */
export async function sweepClosedDays(
  today: string = todayStr(),
): Promise<{ closed: string[]; purged: string[] }> {
  const scheduled = await getScheduledDiets();
  const past = scheduled
    .map((d) => d.date)
    .filter((date) => date < today)
    .sort();

  const closed: string[] = [];
  for (const date of past) {
    await processDayEnd(date);
    closed.push(date);
  }

  const purged = await purgeExpiredSchedules(today);
  return { closed, purged };
}

/**
 * Delete schedules that have aged past the back-log window. Their history rows
 * are already written, so nothing is lost — this just makes the closure final
 * and stops SCHEDULED_DIETS growing without bound.
 */
export async function purgeExpiredSchedules(
  today: string = todayStr(),
): Promise<string[]> {
  return withLock(async () => {
    const scheduled = await getScheduledDiets();
    const cutoff = shiftDate(today, -BACKLOG_GRACE_DAYS);
    const expired = scheduled.filter((d) => d.date < cutoff);
    if (expired.length === 0) return [];

    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEDULED_DIETS,
      JSON.stringify(scheduled.filter((d) => d.date >= cutoff)),
    );
    return expired.map((d) => d.date);
  });
}

/**
 * Yesterday's plan, when it's still open for back-logging and wasn't fully
 * ticked. This is what powers the "did you have these and forget to log?"
 * prompt. Returns null when there's nothing to ask about — no plan, already
 * complete, or the window has closed.
 */
export async function getBacklogPrompt(
  today: string = todayStr(),
): Promise<{
  date: string;
  schedule: DaySchedule;
  unloggedMeals: { mealType: MealType; name: string; snackIndex?: number }[];
} | null> {
  const date = shiftDate(today, -1);
  if (logPermissionFor(date, today) !== "backlog") return null;

  const scheduled = await getScheduledDietForDate(date);
  if (!scheduled) return null;

  const schedule = scheduled.schedule;
  const unlogged: { mealType: MealType; name: string; snackIndex?: number }[] = [];
  const consider = (mealType: MealType, meal: ScheduledMeal | null) => {
    if (meal && !meal.isConsumed) unlogged.push({ mealType, name: meal.name });
  };
  consider("breakfast", schedule.breakfast);
  consider("lunch", schedule.lunch);
  consider("dinner", schedule.dinner);
  schedule.snacks.forEach((snack, i) => {
    if (!snack.isConsumed) {
      unlogged.push({ mealType: "snack", name: snack.name, snackIndex: i });
    }
  });

  return unlogged.length > 0 ? { date, schedule, unloggedMeals: unlogged } : null;
}

/**
 * Get all scheduled diets
 */
async function getScheduledDiets(): Promise<ScheduledDiet[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_DIETS);
  return data ? JSON.parse(data) : [];
}

/**
 * Get all week schedules
 */
async function getWeekSchedules(): Promise<WeekSchedule[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.WEEK_SCHEDULES);
  return data ? JSON.parse(data) : [];
}

/**
 * Get diet history
 */
export async function getDietHistory(): Promise<DietHistoryEntry[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.DIET_HISTORY);
  return data ? JSON.parse(data) : [];
}

/**
 * Clear a scheduled diet
 */
export async function clearScheduledDiet(date: string): Promise<void> {
  const scheduledDiets = await getScheduledDiets();
  const filtered = scheduledDiets.filter((d) => d.date !== date);
  await AsyncStorage.setItem(
    STORAGE_KEYS.SCHEDULED_DIETS,
    JSON.stringify(filtered),
  );
}

/**
 * Get scheduled diet for a specific date
 */
export async function getScheduledDietForDate(
  date: string,
): Promise<ScheduledDiet | null> {
  const diets = await getScheduledDiets();
  return diets.find((d) => d.date === date) || null;
}

/**
 * Convert diet meal option to scheduled meal
 */
export function createScheduledMeal(
  mealOption: any,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
): ScheduledMeal {
  return {
    id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    mealType,
    name: mealOption.name,
    calories: mealOption.calories,
    proteinG: mealOption.protein || { min: 0, max: 0 },
    carbsG: mealOption.carbs || { min: 0, max: 0 },
    fatG: mealOption.fat || { min: 0, max: 0 },
    isNigerian: mealOption.isNigerian,
    cuisine: mealOption.cuisine,
    isConsumed: false,
  };
}
