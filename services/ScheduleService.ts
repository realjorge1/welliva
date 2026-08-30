/**
 * SCHEDULE SERVICE
 * Manages diet scheduling for daily and weekly plans
 * Handles today's diet resolution and history
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DietData } from "../constants/DietDatabase";

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
import { KEYS, writeJSON } from "./OfflineStorage";
import { dayMacros } from "./nutrition/DayTotals";
import { getFoodLogForDate } from "./nutrition/foodLogStore";
import {
  adoptMissing,
  getIntakeForDate,
  healSchedule,
  recordFor,
  recordIntake,
  unrecordIntake,
} from "./nutrition/IntakeLedger";
import {
  BACKLOG_GRACE_DAYS,
  canLogForDate,
  logPermissionFor,
  shiftDate,
  todayStr,
} from "./nutrition/logWindow";
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
//
// The rule itself now lives in services/nutrition/logWindow — a leaf that both
// this store and the free-form food log can import. It used to live here, which
// forced FoodLogService to depend on ScheduleService for a date calculation and
// so made it impossible for this file to read that log back when it closes a
// day. Re-exported, so every existing `from "./ScheduleService"` import of the
// rule keeps working.

export {
  BACKLOG_GRACE_DAYS,
  canLogForDate,
  logPermissionFor,
  type LogPermission,
} from "./nutrition/logWindow";

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
  await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, filtered);

  return scheduledDiet;
}

/**
 * Save a fully-formed DaySchedule (e.g. from DietPlanGenerator).
 * Unlike scheduleDietForDay, the schedule already has date/dietId/etc filled in.
 *
 * `scheduleType` only labels where the day came from (a weekly plan's days are
 * materialised through here too). It changes nothing about how the day is read.
 */
export async function saveDaySchedule(
  daySchedule: DaySchedule,
  scheduleType: ScheduledDiet["scheduleType"] = "single_day",
): Promise<void> {
  return withLock(async () => {
    const scheduledDiet: ScheduledDiet = {
      id: `diet_${Date.now()}`,
      date: daySchedule.date,
      dietId: daySchedule.dietId,
      dietName: daySchedule.dietName,
      scheduleType,
      schedule: daySchedule,
      createdAt: new Date().toISOString(),
    };

    const existing = await getScheduledDiets();
    const filtered = existing.filter((d) => d.date !== daySchedule.date);
    filtered.push(scheduledDiet);
    await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, filtered);
  });
}

/**
 * Reconcile a day against the intake ledger before anyone sees it.
 *
 * THIS IS THE REPAIR that makes a tick permanent. The plan document is rewritten
 * by the generator, the rollover, the custom-menu projection, a swap and the
 * cloud sync, and any of them can hand back a day whose meals have forgotten
 * being eaten. Every read passes through here, so a forgotten tick is put back
 * from the ledger before it can reach a screen or a total.
 *
 * It also runs the other way: a tick the ledger has never heard of is adopted
 * into it. That is how every user who already had ticks before the ledger
 * existed gets migrated — by opening the app, with no migration step to write,
 * remember, or get wrong.
 *
 * Fail-soft. A day that cannot be reconciled is returned exactly as stored,
 * because showing the plan as saved is always better than showing nothing.
 */
async function reconcileWithLedger(
  schedule: DaySchedule,
  date: string,
): Promise<DaySchedule> {
  try {
    const records = await getIntakeForDate(date);
    const { schedule: healed, missing, restored } = healSchedule(schedule, records);
    if (missing.length > 0) await adoptMissing(date, missing);
    if (restored) await persistSchedule(date, healed);
    return healed;
  } catch (e) {
    console.warn(`ScheduleService: ledger reconcile for ${date} failed:`, e);
    return schedule;
  }
}

/**
 * MATERIALISE a weekly plan's day into the single-day store, on first read.
 *
 * A WEEK_SCHEDULES day used to be handed straight to the screen. It rendered
 * perfectly and was, underneath, inert: every writer in this file — the tick,
 * the toggle, the swap, the snack, day-end — looks the day up in
 * SCHEDULED_DIETS by date, finds nothing, and returns without doing anything.
 * So a meal on a weekly day could not be ticked, and (this is the part that
 * showed up as lost data) it never reached the intake ledger, never reached a
 * history row, and counted as nothing toward the day.
 *
 * The fix is the pattern CustomMenuSchedule already established: there is ONE
 * store the rest of the app speaks, so anything that wants to behave like a day
 * gets projected into it. Writing it here means the very next line can
 * reconcile it against the ledger like any other day, and every read after this
 * one takes the daily branch above — so this runs once per day, not per read.
 *
 * The weekly document is left untouched: it stays the plan, and re-materialising
 * is harmless if a future edit changes it (the ledger carries the ticks).
 *
 * Fail-soft. If the write can't happen the user still sees their day; they just
 * don't get to tick it yet, which is exactly where they were before.
 */
async function adoptWeeklyDay(
  week: WeekSchedule,
  daySchedule: DaySchedule,
  date: string,
): Promise<DaySchedule> {
  const stamped: DaySchedule = {
    ...daySchedule,
    date,
    dietId: daySchedule.dietId || week.dietId,
    dietName: daySchedule.dietName || week.dietName,
    // The weekly document stamps every day "upcoming" at creation; the day we
    // are serving is today's, and a day that is never "active" is one day-end
    // never closes.
    status: "active",
  };
  try {
    await saveDaySchedule(stamped, "weekly");
    return await reconcileWithLedger(stamped, date);
  } catch (e) {
    console.warn(`ScheduleService: adopting weekly day ${date} failed:`, e);
    return stamped;
  }
}

/** Write a healed day back, so the repair is done once rather than every read. */
async function persistSchedule(date: string, schedule: DaySchedule): Promise<void> {
  return withLock(async () => {
    const existing = await getScheduledDiets();
    const index = existing.findIndex((d) => d.date === date);
    if (index < 0) return;
    existing[index] = { ...existing[index], schedule };
    await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, existing);
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
  return match ? reconcileWithLedger(match.schedule, date) : null;
}

/**
 * Every date that currently holds a single-day schedule, ascending.
 *
 * Exists so a projection can find the days it has to UN-schedule. A repair pass
 * that only visits the dates still present in its own source can never notice
 * the ones it removed from that source, which is how an emptied day used to
 * keep serving the plan the user had just deleted.
 */
export async function getScheduledDates(): Promise<string[]> {
  const existing = await getScheduledDiets();
  return existing.map((d) => d.date).sort();
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
      await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, kept);
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
  await writeJSON(STORAGE_KEYS.WEEK_SCHEDULES, filtered);

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
      source: todayScheduled.scheduleType === "weekly" ? "weekly" : "daily",
      schedule: await reconcileWithLedger(todayScheduled.schedule, today),
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
          schedule: await adoptWeeklyDay(week, daySchedule, today),
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

  // Update last checked date. Raw AsyncStorage on purpose: LAST_CHECKED_DATE is
  // a device-local clock (services/sync/syncKeys denies it), so routing it
  // through writeJSON would only wake the sync observer for a value that can
  // never leave this phone.
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
  const eaten = await withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);
    if (index < 0) return null;

    const at = new Date().toISOString();
    const diet = scheduledDiets[index];
    const target =
      mealType === "snack" && typeof snackIndex === "number"
        ? diet.schedule.snacks[snackIndex]
        : mealType !== "snack"
          ? (diet.schedule[mealType] as ScheduledMeal | null)
          : null;
    if (!target) return null;

    target.isConsumed = true;
    target.consumedAt = at;
    scheduledDiets[index] = diet;
    await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, scheduledDiets);
    return recordFor(target, mealType, at);
  });

  // The tick's own record, with the macros as they are right now. This — not
  // the flag above — is what the day's calories are counted from, so a later
  // rewrite of the plan cannot un-eat this meal. See nutrition/IntakeLedger.
  if (eaten) await recordIntake(date, eaten);
  return eaten !== null;
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

  const change = await withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);
    if (index < 0) return null;

    const diet = scheduledDiets[index];
    const target =
      mealType === "snack" && typeof snackIndex === "number"
        ? diet.schedule.snacks[snackIndex]
        : mealType !== "snack"
          ? (diet.schedule[mealType] as ScheduledMeal | null)
          : null;
    if (!target) return null;

    const wasConsumed = target.isConsumed;
    const at = new Date().toISOString();
    target.isConsumed = !wasConsumed;
    target.consumedAt = wasConsumed ? undefined : at;

    scheduledDiets[index] = diet;
    await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, scheduledDiets);
    return { eaten: !wasConsumed, record: recordFor(target, mealType, at) };
  });

  // Keep the ledger in step with the tick, in whichever direction it went. An
  // un-tick must actually remove the record — a ledger that only ever grows
  // would make un-eating a meal impossible, which is the same class of bug in
  // the opposite direction.
  if (change) {
    if (change.eaten) await recordIntake(date, change.record);
    else await unrecordIntake(date, mealType, change.record.name);
  }

  const applied = change !== null;
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
      await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, scheduledDiets);
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
  // A snack added ALREADY EATEN (the "log this food as a snack" path) is an
  // intake the moment it lands, not on some later tick that never comes.
  const record = meal.isConsumed
    ? recordFor(meal, "snack", meal.consumedAt ?? new Date().toISOString())
    : null;

  const added = await withLock(async () => {
    const scheduledDiets = await getScheduledDiets();
    const index = scheduledDiets.findIndex((d) => d.date === date);
    if (index < 0) return false;
    const diet = scheduledDiets[index];
    diet.schedule.snacks.push(meal);
    scheduledDiets[index] = diet;
    await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, scheduledDiets);
    return true;
  });

  if (!added) return false;
  if (record) await recordIntake(date, record);
  return true;
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

    // Reconcile before counting: a day being closed has had the whole day to be
    // rewritten underneath its ticks, and a history row is written once.
    const records = await getIntakeForDate(date);
    const { schedule, missing } = healSchedule(dayDiet.schedule, records);
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

    // Roll up what the user ACTUALLY ATE: the plan meals they ticked PLUS every
    // free-form food they logged that day.
    //
    // This row is not a record of adherence — `mealsConsumed`/`totalMeals`
    // above are, and they stay schedule-only. `consumedCalories` is read as
    // INTAKE: by the trend charts, the period report, the memory compaction and
    // the TDEE learning filter. Closing a day from the schedule alone told all
    // of them that someone who logs their food outside the plan ate nothing —
    // which is both wrong and the very number Home used to show. See
    // services/nutrition/DayTotals for why the two stores are summed but never
    // merged.
    const foodLog = await getFoodLogForDate(date);
    // `missing` is the ticks the plan has and the ledger does not — always
    // empty once the ledger is the writer, non-empty for a day carried over
    // from before it existed. Counting both makes the close complete either way.
    const consumed = dayMacros([...records, ...missing], foodLog);

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
    await writeJSON(STORAGE_KEYS.DIET_HISTORY, bounded);
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

    await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, scheduled.filter((d) => d.date >= cutoff));
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
  await writeJSON(STORAGE_KEYS.SCHEDULED_DIETS, filtered);
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
