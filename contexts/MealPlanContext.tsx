/**
 * MealPlanContext — the flexible-planning layer.
 *
 * Deliberately a SEPARATE context rather than more surface on AppContext, which
 * is already 2,000+ lines and sits on the app's hottest render path. Everything
 * here (plan periods, hand-picked menus, free-form food logs, the back-log
 * prompt, tracking mode) changes on user action rather than per-tick, so
 * bundling it into the nutrition slice would re-render the whole diet screen
 * every time an unrelated total moved.
 *
 * It composes over AppContext rather than replacing it: `currentDate` still
 * comes from there, so there is exactly one clock in the app.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MealType, ScheduledMeal } from "../models/diet";
import {
  addDays,
  periodDays,
  scheduleDays,
  toLocalDate,
  type CustomMenuEntry,
  type MealPlanPeriod,
  type PeriodReport,
  type PlanDuration,
  type PlanMode,
  type SavedMeal,
  type ScheduleChoice,
} from "../models/mealPlan";
import type { FoodAnalysis, NutrientKey, NutrientPanel } from "../models/nutrients";
import {
  DEFAULT_TRACKING_MODE,
  isAdHocResultFresh,
  tracksDiet,
  tracksWorkout,
  type AdHocResult,
  type TrackingMode,
} from "../models/trackingMode";
import { analyzeFoodText } from "../services/gozlin/GozlinFoodAnalyst";
import {
  syncCustomDay,
  syncCustomDays,
  syncWholeCustomPeriod,
} from "../services/CustomMenuSchedule";
import * as MealPlan from "../services/MealPlanService";
import type { FoodItem } from "../constants/FoodDictionary";
import {
  dayNutrients,
  getFoodLogForDate,
  logAnalysis,
  logCatalogFood as logCatalogFoodEntry,
  logKnownFood,
  removeFoodLog,
  replaceLoggedItem,
  type FoodLogEntry,
} from "../services/nutrition/FoodLogService";
import { KEYS, readJSON, todayDate, writeJSON } from "../services/OfflineStorage";
import { getOrBuildReport } from "../services/PeriodReportService";
import {
  getBacklogPrompt,
  logPermissionFor,
  toggleMealConsumed,
  type LogPermission,
} from "../services/ScheduleService";
import { loadBodyLogs } from "../services/BodyLogService";
import { getDietHistory } from "../services/ScheduleService";
import { useNutrition, useProfile, useSystem } from "./AppContext";

// ============================================================================
// SHAPE
// ============================================================================

export interface BacklogPrompt {
  date: string;
  unloggedMeals: { mealType: MealType; name: string; snackIndex?: number }[];
}

interface MealPlanContextValue {
  // --- Engagement ---
  trackingMode: TrackingMode;
  setTrackingMode: (mode: TrackingMode) => Promise<void>;
  tracksDiet: boolean;
  tracksWorkout: boolean;

  // --- Periods ---
  activePeriod: MealPlanPeriod | null;
  /** Days elapsed / total, for the progress strip. Null with no active period. */
  periodProgress: { day: number; total: number; remaining: number } | null;
  /** A finished period whose report the user hasn't seen — drives the takeover. */
  finishedPeriod: MealPlanPeriod | null;
  startPeriod: (input: MealPlan.StartPeriodInput) => Promise<MealPlanPeriod>;
  /**
   * Change the running plan's schedule — a day, a week, or hand-picked dates —
   * keeping the period and every meal already planned inside it. Days that fall
   * outside the new schedule are dropped (and un-scheduled); the count comes
   * back so the caller can say so afterwards.
   */
  reschedulePlan: (choice: ScheduleChoice) => Promise<{ droppedDays: number }>;
  /** Planned days from today onward that `choice` would no longer cover. */
  daysDroppedBy: (choice: ScheduleChoice) => string[];
  endPeriodEarly: () => Promise<void>;
  extendActivePeriod: (newEndDate: string) => Promise<void>;
  /** Re-run a finished plan with the same settings, starting today. */
  restartPeriod: (periodId: string) => Promise<MealPlanPeriod | null>;
  buildReport: (periodId: string) => Promise<PeriodReport | null>;
  dismissReport: (periodId: string) => Promise<void>;
  periodArchive: MealPlanPeriod[];

  // --- Custom menu ---
  customEntriesToday: CustomMenuEntry[];
  getCustomEntries: (date: string) => Promise<CustomMenuEntry[]>;
  setCustomMeal: (input: Omit<MealPlan.SetCustomMealInput, "periodId">) => Promise<void>;
  removeCustomMeal: (entryId: string) => Promise<void>;
  copyDayTo: (sourceDate: string, targetDates: string[]) => Promise<number>;
  repeatWeekPattern: (weekStart: string, through: string) => Promise<number>;
  plannedDates: string[];
  savedMeals: SavedMeal[];
  saveMealForReuse: (
    input: Omit<SavedMeal, "id" | "useCount" | "createdAt">,
  ) => Promise<void>;
  deleteSavedMeal: (id: string) => Promise<void>;

  // --- Food log ---
  todayFoodLog: FoodLogEntry[];
  todayNutrients: { totals: NutrientPanel; partialKeys: NutrientKey[] };
  /** Analyse free text WITHOUT logging it — for the preview sheet. */
  analyzeFood: (
    text: string,
    slot?: MealType | null,
  ) => Promise<{ analysis: FoodAnalysis; usedAI: boolean; aiError?: string }>;
  logFoodAnalysis: (
    analysis: FoodAnalysis,
    slot: MealType | null,
    date?: string,
  ) => Promise<boolean>;
  logFood: (args: {
    foodId: string;
    quantity: number;
    unit: string;
    slot: MealType | null;
    date?: string;
  }) => Promise<boolean>;
  /**
   * Log a food picked from the browsable Foods catalog. Returns the created
   * entry (not a boolean) because the caller needs its id to offer an undo —
   * a catalog tap is a one-gesture write, so it must be a one-gesture unwrite.
   */
  logCatalogFood: (args: {
    food: FoodItem;
    quantity: number;
    unit: string;
    slot: MealType | null;
    date?: string;
  }) => Promise<FoodLogEntry | null>;
  removeLoggedFood: (entryId: string, date?: string) => Promise<void>;
  correctLoggedItem: (args: {
    entryId: string;
    itemId: string;
    foodId: string;
    date?: string;
  }) => Promise<void>;

  // --- Back-logging ---
  backlogPrompt: BacklogPrompt | null;
  /** Tick a meal on a past-but-open day. False when the window has closed. */
  backlogMeal: (
    date: string,
    mealType: MealType,
    snackIndex?: number,
  ) => Promise<boolean>;
  dismissBacklogPrompt: () => void;
  permissionFor: (date: string) => LogPermission;

  // --- Ad-hoc (untracked) results ---
  adHocResult: AdHocResult | null;
  publishAdHocResult: (result: AdHocResult) => void;
  clearAdHocResult: () => void;

  refresh: () => Promise<void>;
}

const Ctx = createContext<MealPlanContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function MealPlanProvider({ children }: { children: React.ReactNode }) {
  const { currentDate, isLoading } = useSystem();
  const { nutritionTargets } = useProfile();
  const { refreshTodayDiet } = useNutrition();

  const [trackingMode, setModeState] = useState<TrackingMode>(DEFAULT_TRACKING_MODE);
  const [activePeriod, setActivePeriod] = useState<MealPlanPeriod | null>(null);
  const [finishedPeriod, setFinishedPeriod] = useState<MealPlanPeriod | null>(null);
  const [periodArchive, setPeriodArchive] = useState<MealPlanPeriod[]>([]);
  const [customEntriesToday, setCustomEntriesToday] = useState<CustomMenuEntry[]>([]);
  const [plannedDates, setPlannedDates] = useState<string[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [todayFoodLog, setTodayFoodLog] = useState<FoodLogEntry[]>([]);
  const [todayNutrients, setTodayNutrients] = useState<{
    totals: NutrientPanel;
    partialKeys: NutrientKey[];
  }>({ totals: {}, partialKeys: [] });
  const [backlogPrompt, setBacklogPrompt] = useState<BacklogPrompt | null>(null);
  const [backlogDismissed, setBacklogDismissed] = useState<string | null>(null);
  const [adHocResult, setAdHocResult] = useState<AdHocResult | null>(null);

  // Guards a re-entrant refresh while one is already in flight.
  const refreshing = useRef(false);

  // --------------------------------------------------------------- refresh --
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      // Promote/close periods first so everything below sees the settled state.
      await MealPlan.advancePeriods(currentDate);

      const [period, unseen, all, meals, log, nutrients, prompt] = await Promise.all([
        MealPlan.getActivePeriod(),
        MealPlan.getUnseenFinishedPeriods(),
        MealPlan.getAllPeriods(),
        MealPlan.listSavedMeals(),
        getFoodLogForDate(currentDate),
        dayNutrients(currentDate),
        getBacklogPrompt(currentDate),
      ]);

      setActivePeriod(period);
      setFinishedPeriod(unseen[0] ?? null);
      setPeriodArchive(all);
      setSavedMeals(meals);
      setTodayFoodLog(log);
      setTodayNutrients({ totals: nutrients.totals, partialKeys: nutrients.partialKeys });
      setBacklogPrompt(
        prompt ? { date: prompt.date, unloggedMeals: prompt.unloggedMeals } : null,
      );

      if (period?.mode === "custom") {
        const [entries, dates] = await Promise.all([
          MealPlan.getCustomEntriesForDate(period.id, currentDate),
          MealPlan.getPlannedDates(period.id),
        ]);
        setCustomEntriesToday(entries);
        setPlannedDates(dates);
      } else {
        setCustomEntriesToday([]);
        setPlannedDates([]);
      }
    } catch (e) {
      console.warn("MealPlanContext.refresh:", e);
    } finally {
      refreshing.current = false;
    }
  }, [currentDate]);

  // Load the persisted tracking mode once, then refresh on every date change —
  // that's what makes the new day's plan appear at midnight without a relaunch.
  useEffect(() => {
    if (isLoading) return;
    void (async () => {
      const mode = await readJSON<TrackingMode>(KEYS.TRACKING_MODE, DEFAULT_TRACKING_MODE);
      setModeState(mode);
      await refresh();
    })();
  }, [isLoading, refresh]);

  /*
   * REPAIR PASS — project the whole active custom menu onto the calendar once
   * per period, per day.
   *
   * Two things need healing that no single edit can reach. Menus planned before
   * this bridge existed were never projected at all; and the rollover generator
   * fills any unscheduled day, so it can have written a diet over a day the user
   * had hand-picked. Both are fixed by re-projecting, which is idempotent — it
   * carries consumption across and clears days the user has emptied.
   */
  const repaired = useRef<string | null>(null);
  useEffect(() => {
    if (!activePeriod || activePeriod.mode !== "custom") return;
    const stamp = `${activePeriod.id}:${currentDate}`;
    if (repaired.current === stamp) return;
    repaired.current = stamp;
    void (async () => {
      try {
        await syncWholeCustomPeriod(activePeriod, currentDate);
        await refreshTodayDiet();
      } catch (e) {
        console.warn("MealPlanContext: custom menu projection failed:", e);
      }
    })();
  }, [activePeriod, currentDate, refreshTodayDiet]);

  // A dismissal only applies to the day it was made on.
  useEffect(() => {
    setBacklogDismissed(null);
    setAdHocResult((r) => (r && isAdHocResultFresh(r, currentDate) ? r : null));
  }, [currentDate]);

  // ---------------------------------------------------------- engagement ----
  const setTrackingMode = useCallback(async (mode: TrackingMode) => {
    setModeState(mode);
    await writeJSON(KEYS.TRACKING_MODE, mode);
  }, []);

  // ------------------------------------------------------------- periods ----
  const startPeriod = useCallback(
    async (input: MealPlan.StartPeriodInput) => {
      // Capture the body baseline now so the closing report can measure change
      // against where the user actually started, not where they were when they
      // happened to next weigh in.
      const logs = await loadBodyLogs();
      const latest = logs.length > 0 ? logs[logs.length - 1] : null;

      const period = await MealPlan.startPeriod({
        ...input,
        baseline: {
          ...(latest ? { weightKg: latest.weightKg } : {}),
          ...(nutritionTargets
            ? {
                targetCalories: nutritionTargets.calories,
                targetProteinG: nutritionTargets.proteinG,
                targetCarbsG: nutritionTargets.carbsG,
                targetFatG: nutritionTargets.fatG,
              }
            : {}),
          ...input.baseline,
        },
      });
      await refresh();
      return period;
    },
    [nutritionTargets, refresh],
  );

  /**
   * Which planned days a new schedule would let go of. Only days from today
   * forward: a reschedule never reaches back into days the user already lived.
   */
  const daysDroppedBy = useCallback(
    (choice: ScheduleChoice) => {
      const keep = new Set(scheduleDays(choice));
      return plannedDates.filter((d) => d >= currentDate && !keep.has(d));
    },
    [plannedDates, currentDate],
  );

  const reschedulePlan = useCallback(
    async (choice: ScheduleChoice) => {
      if (!activePeriod) return { droppedDays: 0 };
      const dropped = daysDroppedBy(choice);
      if (dropped.length > 0) await MealPlan.dropCustomDates(activePeriod.id, dropped);

      const period = await MealPlan.reschedulePeriod(activePeriod.id, choice);
      if (period) {
        // The dropped days are visited explicitly: they may now sit outside the
        // window, and a whole-period sweep would leave their old projection
        // standing on the calendar still serving meals that no longer exist.
        await syncCustomDays(period, dropped, currentDate);
        await syncWholeCustomPeriod(period, currentDate);
      }
      await refresh();
      await refreshTodayDiet();
      return { droppedDays: dropped.length };
    },
    [activePeriod, daysDroppedBy, currentDate, refresh, refreshTodayDiet],
  );

  const endPeriodEarly = useCallback(async () => {
    if (!activePeriod) return;
    await MealPlan.endPeriodEarly(activePeriod.id);
    await refresh();
  }, [activePeriod, refresh]);

  const extendActivePeriod = useCallback(
    async (newEndDate: string) => {
      if (!activePeriod) return;
      await MealPlan.extendPeriod(activePeriod.id, newEndDate);
      await refresh();
    },
    [activePeriod, refresh],
  );

  const restartPeriod = useCallback(
    async (periodId: string) => {
      const source = await MealPlan.getPeriodById(periodId);
      if (!source) return null;
      // Same shape, same length, starting today.
      const lengthDays = Math.max(
        1,
        Math.round(
          (new Date(source.endDate).getTime() - new Date(source.startDate).getTime()) /
            86_400_000,
        ) + 1,
      );
      const start = toLocalDate(new Date());
      const period = await startPeriod({
        mode: source.mode,
        dietId: source.dietId,
        dietName: source.dietName,
        label: source.label,
        durationKind: source.durationKind === "day" ? "day" : "custom",
        startDate: start,
        customEndDate: addDays(start, lengthDays - 1),
        restartedFromId: source.id,
      });
      await MealPlan.markReportSeen(periodId);
      await refresh();
      return period;
    },
    [startPeriod, refresh],
  );

  const buildReport = useCallback(
    async (periodId: string) => {
      const period = await MealPlan.getPeriodById(periodId);
      if (!period) return null;
      const [history, bodyLogs] = await Promise.all([getDietHistory(), loadBodyLogs()]);
      return getOrBuildReport({
        period,
        history,
        bodyLogs,
        ...(nutritionTargets
          ? {
              targets: {
                calories: nutritionTargets.calories,
                proteinG: nutritionTargets.proteinG,
                carbsG: nutritionTargets.carbsG,
                fatG: nutritionTargets.fatG,
              },
            }
          : {}),
      });
    },
    [nutritionTargets],
  );

  const dismissReport = useCallback(
    async (periodId: string) => {
      await MealPlan.markReportSeen(periodId);
      setFinishedPeriod(null);
      await refresh();
    },
    [refresh],
  );

  // --------------------------------------------------------- custom menu ----
  const getCustomEntries = useCallback(
    async (date: string) =>
      activePeriod ? MealPlan.getCustomEntriesForDate(activePeriod.id, date) : [],
    [activePeriod],
  );

  /*
   * Every custom write goes through one of these, and every one of them
   * PROJECTS the result into the schedule store (services/CustomMenuSchedule).
   * That projection is what makes a planned day actually arrive: today's plan,
   * ticking a meal off, the backlog prompt, day-end history and the closing
   * report all read schedules, and none of them has ever read a custom menu.
   *
   * Bulk edits re-project the whole period rather than the dates they touched.
   * "Repeat this week onward" can rewrite thirty days, and a projection that
   * tracks which ones is a second copy of the same logic waiting to disagree
   * with the first.
   */
  const setCustomMeal = useCallback(
    async (input: Omit<MealPlan.SetCustomMealInput, "periodId">) => {
      if (!activePeriod) return;
      await MealPlan.setCustomMeal({ ...input, periodId: activePeriod.id });
      await syncCustomDay(activePeriod, input.date, currentDate);
      await refresh();
      if (input.date === currentDate) await refreshTodayDiet();
    },
    [activePeriod, refresh, refreshTodayDiet, currentDate],
  );

  const removeCustomMeal = useCallback(
    async (entryId: string) => {
      if (!activePeriod) return;
      await MealPlan.removeCustomMeal(activePeriod.id, entryId);
      // The service doesn't report which date held the entry, and a removal can
      // empty a day (which must un-schedule it), so re-project the period.
      await syncWholeCustomPeriod(activePeriod, currentDate);
      await refresh();
      await refreshTodayDiet();
    },
    [activePeriod, refresh, refreshTodayDiet, currentDate],
  );

  const copyDayTo = useCallback(
    async (sourceDate: string, targetDates: string[]) => {
      if (!activePeriod) return 0;
      const n = await MealPlan.copyDayTo(activePeriod.id, sourceDate, targetDates);
      await syncWholeCustomPeriod(activePeriod, currentDate);
      await refresh();
      if (targetDates.includes(currentDate)) await refreshTodayDiet();
      return n;
    },
    [activePeriod, refresh, refreshTodayDiet, currentDate],
  );

  const repeatWeekPattern = useCallback(
    async (weekStart: string, through: string) => {
      if (!activePeriod) return 0;
      const n = await MealPlan.repeatWeekPattern(activePeriod.id, weekStart, through);
      await syncWholeCustomPeriod(activePeriod, currentDate);
      await refresh();
      await refreshTodayDiet();
      return n;
    },
    [activePeriod, refresh, refreshTodayDiet, currentDate],
  );

  const saveMealForReuse = useCallback(
    async (input: Omit<SavedMeal, "id" | "useCount" | "createdAt">) => {
      await MealPlan.saveMeal(input);
      setSavedMeals(await MealPlan.listSavedMeals());
    },
    [],
  );

  const deleteSavedMeal = useCallback(async (id: string) => {
    await MealPlan.deleteSavedMeal(id);
    setSavedMeals(await MealPlan.listSavedMeals());
  }, []);

  // ------------------------------------------------------------ food log ----
  const analyzeFood = useCallback(
    async (text: string, slot: MealType | null = null) => analyzeFoodText(text, { slot }),
    [],
  );

  /**
   * Re-read a day's free-form log, and the totals that include it.
   *
   * ONE CLOCK, resolved here rather than taken from `currentDate`. That
   * value is refreshed by a day-change check, and a check cannot run while
   * the app is backgrounded — so on the first moments after a resume it can
   * still name yesterday. Every write below resolves the real local date for
   * the same reason, and a guard comparing the two against different clocks
   * is a guard that silently drops the refresh for food just logged.
   */
  const refreshLog = useCallback(
    async (date: string) => {
      if (date !== todayDate()) return;
      const [log, nutrients] = await Promise.all([
        getFoodLogForDate(date),
        dayNutrients(date),
      ]);
      setTodayFoodLog(log);
      setTodayNutrients({ totals: nutrients.totals, partialKeys: nutrients.partialKeys });
      // The day's calorie/macro totals live one layer up, where AppContext adds
      // this log to the intake ledger, and Home reads them from there. Without
      // this call, logging a food updated the Foods screen and left the ring on
      // the home screen reading as though the user had eaten nothing.
      await refreshTodayDiet();
    },
    [refreshTodayDiet],
  );

  const logFoodAnalysis = useCallback(
    async (analysis: FoodAnalysis, slot: MealType | null, date?: string) => {
      const target = date ?? todayDate();
      const entry = await logAnalysis({ date: target, slot, analysis });
      if (entry) await refreshLog(target);
      return entry !== null;
    },
    [refreshLog],
  );

  const logFood = useCallback(
    async (args: {
      foodId: string;
      quantity: number;
      unit: string;
      slot: MealType | null;
      date?: string;
    }) => {
      const target = args.date ?? todayDate();
      const entry = await logKnownFood({ ...args, date: target });
      if (entry) await refreshLog(target);
      return entry !== null;
    },
    [refreshLog],
  );

  const logCatalogFood = useCallback(
    async (args: {
      food: FoodItem;
      quantity: number;
      unit: string;
      slot: MealType | null;
      date?: string;
    }) => {
      const target = args.date ?? todayDate();
      const entry = await logCatalogFoodEntry({
        date: target,
        slot: args.slot,
        food: args.food,
        quantity: args.quantity,
        unit: args.unit,
      });
      if (entry) await refreshLog(target);
      return entry;
    },
    [refreshLog],
  );

  const removeLoggedFood = useCallback(
    async (entryId: string, date?: string) => {
      const target = date ?? todayDate();
      await removeFoodLog(target, entryId);
      await refreshLog(target);
    },
    [refreshLog],
  );

  const correctLoggedItem = useCallback(
    async (args: { entryId: string; itemId: string; foodId: string; date?: string }) => {
      const target = args.date ?? todayDate();
      await replaceLoggedItem({ ...args, date: target });
      await refreshLog(target);
    },
    [refreshLog],
  );

  // --------------------------------------------------------- back-logging ---
  const backlogMeal = useCallback(
    async (date: string, mealType: MealType, snackIndex?: number) => {
      const ok = await toggleMealConsumed(date, mealType, snackIndex);
      if (ok) {
        await refresh();
        await refreshTodayDiet();
      }
      return ok;
    },
    [refresh, refreshTodayDiet],
  );

  const dismissBacklogPrompt = useCallback(() => {
    setBacklogDismissed(currentDate);
  }, [currentDate]);

  const permissionFor = useCallback(
    (date: string) => logPermissionFor(date, currentDate),
    [currentDate],
  );

  // ------------------------------------------------------------- ad-hoc ----
  const publishAdHocResult = useCallback((result: AdHocResult) => {
    setAdHocResult(result);
  }, []);
  const clearAdHocResult = useCallback(() => setAdHocResult(null), []);

  // ------------------------------------------------------------ derived ----
  // Counted over the days the plan actually covers, so a menu built from four
  // picked dates reads "day 2 of 4" rather than day 2 of the fortnight they
  // happen to be spread across.
  const periodProgress = useMemo(() => {
    if (!activePeriod) return null;
    const days = periodDays(activePeriod);
    const total = days.length;
    if (total === 0) return null;
    const day = Math.max(1, Math.min(total, days.filter((d) => d <= currentDate).length));
    return { day, total, remaining: Math.max(0, total - day) };
  }, [activePeriod, currentDate]);

  const value = useMemo<MealPlanContextValue>(
    () => ({
      trackingMode,
      setTrackingMode,
      tracksDiet: tracksDiet(trackingMode),
      tracksWorkout: tracksWorkout(trackingMode),

      activePeriod,
      periodProgress,
      finishedPeriod,
      startPeriod,
      reschedulePlan,
      daysDroppedBy,
      endPeriodEarly,
      extendActivePeriod,
      restartPeriod,
      buildReport,
      dismissReport,
      periodArchive,

      customEntriesToday,
      getCustomEntries,
      setCustomMeal,
      removeCustomMeal,
      copyDayTo,
      repeatWeekPattern,
      plannedDates,
      savedMeals,
      saveMealForReuse,
      deleteSavedMeal,

      todayFoodLog,
      todayNutrients,
      analyzeFood,
      logFoodAnalysis,
      logFood,
      logCatalogFood,
      removeLoggedFood,
      correctLoggedItem,

      backlogPrompt: backlogDismissed === currentDate ? null : backlogPrompt,
      backlogMeal,
      dismissBacklogPrompt,
      permissionFor,

      adHocResult,
      publishAdHocResult,
      clearAdHocResult,

      refresh,
    }),
    [
      trackingMode, setTrackingMode, activePeriod, periodProgress, finishedPeriod,
      startPeriod, reschedulePlan, daysDroppedBy, endPeriodEarly,
      extendActivePeriod, restartPeriod, buildReport,
      dismissReport, periodArchive, customEntriesToday, getCustomEntries,
      setCustomMeal, removeCustomMeal, copyDayTo, repeatWeekPattern, plannedDates,
      savedMeals, saveMealForReuse, deleteSavedMeal, todayFoodLog, todayNutrients,
      analyzeFood, logFoodAnalysis, logFood, logCatalogFood, removeLoggedFood,
      correctLoggedItem,
      backlogPrompt, backlogDismissed, currentDate, backlogMeal,
      dismissBacklogPrompt, permissionFor, adHocResult, publishAdHocResult,
      clearAdHocResult, refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Plan periods, custom menus, food logging, back-log and tracking mode. */
export function useMealPlan(): MealPlanContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useMealPlan must be used within a MealPlanProvider");
  return value;
}
