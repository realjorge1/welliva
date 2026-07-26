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
  toLocalDate,
  type CustomMenuEntry,
  type MealPlanPeriod,
  type PeriodReport,
  type PlanDuration,
  type PlanMode,
  type SavedMeal,
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
import * as MealPlan from "../services/MealPlanService";
import {
  dayNutrients,
  getFoodLogForDate,
  logAnalysis,
  logKnownFood,
  removeFoodLog,
  replaceLoggedItem,
  type FoodLogEntry,
} from "../services/nutrition/FoodLogService";
import { KEYS, readJSON, writeJSON } from "../services/OfflineStorage";
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

  const setCustomMeal = useCallback(
    async (input: Omit<MealPlan.SetCustomMealInput, "periodId">) => {
      if (!activePeriod) return;
      await MealPlan.setCustomMeal({ ...input, periodId: activePeriod.id });
      await refresh();
      if (input.date === currentDate) await refreshTodayDiet();
    },
    [activePeriod, refresh, refreshTodayDiet, currentDate],
  );

  const removeCustomMeal = useCallback(
    async (entryId: string) => {
      if (!activePeriod) return;
      await MealPlan.removeCustomMeal(activePeriod.id, entryId);
      await refresh();
    },
    [activePeriod, refresh],
  );

  const copyDayTo = useCallback(
    async (sourceDate: string, targetDates: string[]) => {
      if (!activePeriod) return 0;
      const n = await MealPlan.copyDayTo(activePeriod.id, sourceDate, targetDates);
      await refresh();
      return n;
    },
    [activePeriod, refresh],
  );

  const repeatWeekPattern = useCallback(
    async (weekStart: string, through: string) => {
      if (!activePeriod) return 0;
      const n = await MealPlan.repeatWeekPattern(activePeriod.id, weekStart, through);
      await refresh();
      return n;
    },
    [activePeriod, refresh],
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

  const refreshLog = useCallback(
    async (date: string) => {
      if (date !== currentDate) return;
      const [log, nutrients] = await Promise.all([
        getFoodLogForDate(date),
        dayNutrients(date),
      ]);
      setTodayFoodLog(log);
      setTodayNutrients({ totals: nutrients.totals, partialKeys: nutrients.partialKeys });
    },
    [currentDate],
  );

  const logFoodAnalysis = useCallback(
    async (analysis: FoodAnalysis, slot: MealType | null, date?: string) => {
      const target = date ?? currentDate;
      const entry = await logAnalysis({ date: target, slot, analysis });
      if (entry) await refreshLog(target);
      return entry !== null;
    },
    [currentDate, refreshLog],
  );

  const logFood = useCallback(
    async (args: {
      foodId: string;
      quantity: number;
      unit: string;
      slot: MealType | null;
      date?: string;
    }) => {
      const target = args.date ?? currentDate;
      const entry = await logKnownFood({ ...args, date: target });
      if (entry) await refreshLog(target);
      return entry !== null;
    },
    [currentDate, refreshLog],
  );

  const removeLoggedFood = useCallback(
    async (entryId: string, date?: string) => {
      const target = date ?? currentDate;
      await removeFoodLog(target, entryId);
      await refreshLog(target);
    },
    [currentDate, refreshLog],
  );

  const correctLoggedItem = useCallback(
    async (args: { entryId: string; itemId: string; foodId: string; date?: string }) => {
      const target = args.date ?? currentDate;
      await replaceLoggedItem({ ...args, date: target });
      await refreshLog(target);
    },
    [currentDate, refreshLog],
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
  const periodProgress = useMemo(() => {
    if (!activePeriod) return null;
    const total =
      Math.round(
        (new Date(activePeriod.endDate).getTime() -
          new Date(activePeriod.startDate).getTime()) /
          86_400_000,
      ) + 1;
    const elapsed =
      Math.round(
        (new Date(currentDate).getTime() - new Date(activePeriod.startDate).getTime()) /
          86_400_000,
      ) + 1;
    const day = Math.max(1, Math.min(total, elapsed));
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
      startPeriod, endPeriodEarly, extendActivePeriod, restartPeriod, buildReport,
      dismissReport, periodArchive, customEntriesToday, getCustomEntries,
      setCustomMeal, removeCustomMeal, copyDayTo, repeatWeekPattern, plannedDates,
      savedMeals, saveMealForReuse, deleteSavedMeal, todayFoodLog, todayNutrients,
      analyzeFood, logFoodAnalysis, logFood, removeLoggedFood, correctLoggedItem,
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
