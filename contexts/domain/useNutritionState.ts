/**
 * useNutritionState — the diet/water hot path, extracted from AppContext (M4).
 *
 * Owns the derived consumed-nutrition total, the today-diet/history refreshers,
 * and every diet + water handler. State stays owned by the provider and flows in
 * via setters, so this is a pure move: identical bodies, identical dependency
 * arrays, no behavior change.
 */
import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { FoodItem } from "../../constants/FoodDictionary";
import type {
  DietHistoryEntry,
  ScheduledMeal,
  TodayDiet,
} from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { PlanState } from "../../models/planState";
import type { UserBio, UserGoals } from "../../models/user";
import type { ConsumedNutrition } from "../AppContext";
import {
  AchievementRecord,
  creditWaterGoalDay,
  saveAchievementRecord,
} from "../../services/AchievementService";
import { sumMacros, type MacroTotals } from "../../services/nutrition/DayTotals";
import { readDayIntake } from "../../services/nutrition/todayIntake";
import {
  KEYS,
  currentWeekStart,
  parseLocalDate,
  todayDate,
  toLocalDateString,
  writeJSON,
} from "../../services/OfflineStorage";
import { ensureDietBuffer, regenerateDietForDate } from "../../services/PlanSync";
import {
  addSnackToSchedule,
  getDietHistory,
  getTodayDiet,
  markMealConsumed,
  swapMealInSchedule,
  toggleMealConsumed,
} from "../../services/ScheduleService";
import { recordActivity, StreakData } from "../../services/StreakService";

interface Params {
  userBio: UserBio | null;
  nutritionTargets: NutritionTargets | null;
  planState: PlanState;
  userGoals: UserGoals;
  todayDiet: TodayDiet | null;
  /** The ticked-meal half of today's intake, UNROUNDED (see refreshTodayDiet). */
  intakeMacros: MacroTotals;
  /** The free-form half of today's intake, UNROUNDED (see refreshTodayDiet). */
  foodLogMacros: MacroTotals;
  waterMl: number;
  setTodayDiet: Dispatch<SetStateAction<TodayDiet | null>>;
  setIntakeMacros: Dispatch<SetStateAction<MacroTotals>>;
  setFoodLogMacros: Dispatch<SetStateAction<MacroTotals>>;
  setDietHistory: Dispatch<SetStateAction<DietHistoryEntry[]>>;
  setPlanState: Dispatch<SetStateAction<PlanState>>;
  setWaterMl: Dispatch<SetStateAction<number>>;
  setStreakData: Dispatch<SetStateAction<StreakData>>;
  setAchievementRecord: Dispatch<SetStateAction<AchievementRecord>>;
}

export function useNutritionState({
  userBio,
  nutritionTargets,
  planState,
  userGoals,
  todayDiet,
  intakeMacros,
  foodLogMacros,
  waterMl,
  setTodayDiet,
  setIntakeMacros,
  setFoodLogMacros,
  setDietHistory,
  setPlanState,
  setWaterMl,
  setStreakData,
  setAchievementRecord,
}: Params) {
  /**
   * TODAY'S INTAKE — from the two RECORDS of what was eaten.
   *
   * Deliberately NOT re-derived from `todayDiet.schedule`. That is the plan,
   * and the plan is rewritten by the generator, the rollover, the custom-menu
   * projection, a swap and the cloud sync — so a total read off it was only
   * ever as durable as the least careful of those writers, and the symptom was
   * a day of logged food reading 0% after a relaunch. Both halves now come from
   * append-only records instead: the intake ledger (meals ticked, with the
   * macros they had at the tick) and the free-form food log.
   *
   * Still derived, never stored, so the number cannot drift from the records.
   * See services/nutrition/IntakeLedger and services/nutrition/DayTotals.
   */
  const consumedNutrition: ConsumedNutrition = useMemo(
    () => ({ ...sumMacros(intakeMacros, foodLogMacros), waterMl }),
    [intakeMacros, foodLogMacros, waterMl],
  );

  /**
   * Reload today's numbers from disk — the plan, the intake ledger and the
   * free-form log.
   *
   * All three, deliberately, behind one call. They are written by different
   * screens, and a refresher that reloaded only some of them is how a total
   * goes stale in the first place: every existing call site already means
   * "today's food changed, re-read it", and that is exactly what it does.
   *
   * ORDER MATTERS. getTodayDiet() reconciles the day against the ledger first
   * (adopting any tick the ledger hadn't recorded), so reading the ledger after
   * it — not in parallel with it — is what makes the very first launch after
   * this shipped show a returning user's existing ticks instead of zero.
   *
   * NO PART CAN COST ANOTHER ONE. Each read is settled on its own, because a
   * single `await` chain over three documents lets the FIRST failure decide all
   * three — and the shape that takes on screen is a day reading zero with its
   * meals still ticked, which is this bug's exact signature. Note also that the
   * day's calories DO NOT DEPEND ON THE PLAN: the plan read stays first only
   * for its reconcile side effect. See services/nutrition/todayIntake for the
   * "could not read" / "genuinely nothing" distinction the halves carry.
   */
  const refreshTodayDiet = useCallback(async () => {
    // todayDate() rather than the provider's `currentDate`, to match what
    // getTodayDiet() resolves against. The two must never read different days:
    // at a rollover the provider's clock lags by up to a minute, and a total
    // taken from yesterday's records against today's plan is worse than either.
    const today = todayDate();

    // First, and on its own: resolving the plan is also what reconciles the
    // ledger against it (ScheduleService.reconcileWithLedger), so the reads
    // below must see the day AFTER that repair, not during it.
    try {
      setTodayDiet(await getTodayDiet());
    } catch (e) {
      console.error("useNutritionState: today's plan could not be read:", e);
    }

    // Held UNROUNDED, so the memo above can add both halves and round once.
    // A null half is one that could not be READ — keep the value already on
    // screen rather than replacing it with a zero the user would believe.
    const { intake, foodLog } = await readDayIntake(today);
    if (intake) setIntakeMacros(intake);
    if (foodLog) setFoodLogMacros(foodLog);
  }, []);

  const refreshDietHistory = useCallback(async () => {
    const history = await getDietHistory();
    setDietHistory(history);
  }, []);

  const autoGenerateDietPlan = useCallback(
    async (dietId?: string) => {
      if (!userBio || !nutritionTargets) return;
      const bio = userBio;
      const targets = nutritionTargets;
      const today = todayDate();

      // Explicit "regenerate today" → force a fresh plan (AI-first via the
      // backend, local deterministic fallback) ignoring any cached day.
      const result = await regenerateDietForDate(bio, targets, today, dietId);
      if (result) {
        const newPlanState: PlanState = {
          ...planState,
          activeDietId: result.dietId,
          dateStamp: today,
          lastGeneratedAt: new Date().toISOString(),
          needsRegen: false,
          regenReason: null,
        };
        setPlanState(newPlanState);
        await writeJSON(KEYS.PLAN_STATE, newPlanState);
        await refreshTodayDiet();
        // Refresh the offline buffer for the days ahead in this style (online only).
        void ensureDietBuffer(bio, targets, today, dietId ?? result.dietId);
      }
    },
    [userBio, nutritionTargets, planState, refreshTodayDiet],
  );

  /**
   * Schedule a diet for the whole current week. Generates a deterministic
   * day plan for each date (Mon–Sun) via the same generator as the daily
   * path, persists each day, and records the active diet in planState so the
   * choice survives day-changes.
   */
  const scheduleWeeklyDietPlan = useCallback(
    async (dietId?: string) => {
      if (!userBio || !nutritionTargets) return;
      const bio = userBio;
      const targets = nutritionTargets;
      const weekStart = currentWeekStart();
      const monday = parseLocalDate(weekStart);
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(toLocalDateString(d));
      }

      // Force-generate all 7 days (AI-first per day, local fallback) in parallel
      // and cache them so the entire week is available offline.
      const results = await Promise.all(
        dates.map((date) => regenerateDietForDate(bio, targets, date, dietId)),
      );
      const chosenDietId = results.find((r) => r)?.dietId ?? null;

      const newPlanState: PlanState = {
        ...planState,
        activeDietId: chosenDietId,
        weekStartDate: weekStart,
        dateStamp: todayDate(),
        lastGeneratedAt: new Date().toISOString(),
        needsRegen: false,
        regenReason: null,
      };
      setPlanState(newPlanState);
      await writeJSON(KEYS.PLAN_STATE, newPlanState);
      await refreshTodayDiet();
    },
    [userBio, nutritionTargets, planState, refreshTodayDiet],
  );

  /**
   * Mark a meal as consumed. No manual addNutrition — the day's total is the
   * sum of the intake ledger's records, which this write appends to.
   *
   * ONE CLOCK. The date is resolved HERE, at the moment of the write, rather
   * than taken from the provider's `currentDate`. That value is only as fresh
   * as the last tick of a one-minute interval — an interval the OS suspends
   * while the app is backgrounded — so just after midnight, or just after a
   * resume, it can still name YESTERDAY. Every read (refreshTodayDiet,
   * getTodayDiet) resolves the real local date instead, and a write that
   * lands on a day nothing reads is a tick that visibly does nothing.
   */
  const markMealAsConsumed = useCallback(
    async (
      mealType: "breakfast" | "lunch" | "dinner" | "snack",
      snackIndex?: number,
    ) => {
      const date = todayDate();
      await markMealConsumed(date, mealType, snackIndex);
      await refreshTodayDiet();
      // Record activity for streaks
      const { data: updatedStreak } = await recordActivity(date);
      setStreakData(updatedStreak);
    },
    [refreshTodayDiet],
  );

  /**
   * Toggle a meal's consumed status (mark/unmark).
   * Consumed totals are re-derived automatically via useMemo.
   */
  const handleToggleMealConsumed = useCallback(
    async (
      mealType: "breakfast" | "lunch" | "dinner" | "snack",
      snackIndex?: number,
    ) => {
      // Resolved at the write, never from the provider's clock — see
      // markMealAsConsumed above for why those two can disagree.
      await toggleMealConsumed(todayDate(), mealType, snackIndex);
      await refreshTodayDiet();
    },
    [refreshTodayDiet],
  );

  /**
   * Swap a meal in today's schedule with a different option.
   */
  const handleSwapMeal = useCallback(
    async (
      mealType: "breakfast" | "lunch" | "dinner" | "snack",
      newMeal: ScheduledMeal,
      snackIndex?: number,
    ) => {
      await swapMealInSchedule(todayDate(), mealType, newMeal, snackIndex);
      await refreshTodayDiet();
    },
    [refreshTodayDiet],
  );

  /**
   * Log a single whole food from the Foods catalog as a consumed snack on
   * today's plan. Mirrors markMealAsConsumed's streak credit. Returns false if
   * there's no scheduled diet for today to attach it to.
   */
  const addFoodAsSnack = useCallback(
    async (food: FoodItem): Promise<boolean> => {
      const meal: ScheduledMeal = {
        id: `food_${food.id}_${Date.now()}`,
        mealType: "snack",
        name: food.serving ? `${food.name} (${food.serving})` : food.name,
        calories: { min: food.calories, max: food.calories },
        proteinG: { min: food.protein, max: food.protein },
        carbsG: { min: food.carbs, max: food.carbs },
        fatG: { min: food.fat, max: food.fat },
        isNigerian: food.isNigerian,
        cuisine: food.cuisine,
        isConsumed: true,
        consumedAt: new Date().toISOString(),
      };
      const date = todayDate();
      const ok = await addSnackToSchedule(date, meal);
      if (ok) {
        await refreshTodayDiet();
        const { data: updatedStreak } = await recordActivity(date);
        setStreakData(updatedStreak);
      }
      return ok;
    },
    [refreshTodayDiet],
  );

  const addWater = useCallback(
    (ml: number) => {
      const goal =
        userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;
      setWaterMl((prev) => {
        const next = prev + ml;
        writeJSON(KEYS.WATER_TODAY, next);
        // Credit a hydration-goal day the moment today's intake first crosses
        // the goal (deduped per day inside creditWaterGoalDay). This is the one
        // achievement signal not already captured elsewhere.
        if (prev < goal && next >= goal) {
          const today = todayDate();
          setAchievementRecord((rec) => {
            const updated = creditWaterGoalDay(rec, today);
            if (updated !== rec) saveAchievementRecord(updated);
            return updated;
          });
        }
        return next;
      });
    },
    [userGoals, nutritionTargets],
  );

  return {
    consumedNutrition,
    refreshTodayDiet,
    refreshDietHistory,
    autoGenerateDietPlan,
    scheduleWeeklyDietPlan,
    markMealAsConsumed,
    handleToggleMealConsumed,
    handleSwapMeal,
    addFoodAsSnack,
    addWater,
  };
}
