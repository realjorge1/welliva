/**
 * useDayChange — the midnight rollover sweep, extracted verbatim from AppContext
 * (M4). A one-minute interval detects a local date change and closes out every
 * day that ended while the app was open or backgrounded.
 *
 * On a rollover it: sweeps + closes every intervening day (idempotent, also
 * purging back-log-expired schedules), compacts the closed day into the L2
 * memory summaries, expires due Life Context events, refreshes connected senses,
 * archives the ending day's hydration then resets today's counter, regenerates
 * the new day's diet (keeping the user's chosen diet, cache-first/offline-safe),
 * tops up the offline meal buffer, refreshes today's diet + history, and
 * regenerates the workout plan when a new week has started.
 *
 * Pure move: identical body, identical dependency array — the effect closes over
 * exactly the same values at exactly the same times as the inlined version.
 */
import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import { lifeContext, memory, signalsCoordinator } from "../../health-os";
import type { NutritionTargets } from "../../models/nutrition";
import type { PlanState } from "../../models/planState";
import type { UserBio, UserGoals } from "../../models/user";
import type { GeneratedWorkoutPlan } from "../../models/workout";
import {
  archiveWaterDay,
  currentWeekStart,
  KEYS,
  readJSON,
  todayDate,
  writeJSON,
  writeString,
} from "../../services/OfflineStorage";
import { ensureDietBuffer, ensureDietForDate } from "../../services/PlanSync";
import { sweepClosedDays } from "../../services/ScheduleService";
import { shouldRegenerateWorkoutPlan } from "../../services/WorkoutGenerator";

interface Params {
  currentDate: string;
  userBio: UserBio | null;
  nutritionTargets: NutritionTargets | null;
  workoutPlan: GeneratedWorkoutPlan | null;
  planState: PlanState;
  userGoals: UserGoals;
  setCurrentDate: Dispatch<SetStateAction<string>>;
  setWaterMl: Dispatch<SetStateAction<number>>;
  setPlanState: Dispatch<SetStateAction<PlanState>>;
  refreshTodayDiet: () => Promise<void>;
  refreshDietHistory: () => Promise<void>;
  regenerateWorkoutPlan: () => Promise<void>;
}

export function useDayChange({
  currentDate,
  userBio,
  nutritionTargets,
  workoutPlan,
  planState,
  userGoals,
  setCurrentDate,
  setWaterMl,
  setPlanState,
  refreshTodayDiet,
  refreshDietHistory,
  regenerateWorkoutPlan,
}: Params): void {
  // Check for day change every minute
  useEffect(() => {
    const checkDayChange = async () => {
      const today = todayDate();
      if (today !== currentDate) {
        // Close EVERY day that ended, not just the one we were last open on.
        // Closing the app on Monday and reopening on Friday used to leave
        // Tue–Thu permanently unclosed: no history rows, and those days silently
        // missing from adherence. The sweep is idempotent and also purges
        // schedules that have aged past the back-log window.
        await sweepClosedDays(today);
        // Compact the just-closed day into the L2 summaries. No-op until forward
        // Timeline writes land (roadmap M6); recompaction on edits is unconditional.
        await memory.compactDayIfPresent(currentDate);
        // Sweep Life Context: terminate forward events whose grace day has now passed.
        await lifeContext.expireDue();
        // Refresh any connected senses (consent + permission gated; safe no-op otherwise).
        await signalsCoordinator.syncDue();
        // Archive the ending day's hydration before wiping today's counter.
        // Read from storage rather than the captured `waterMl` — this effect's
        // closure can hold a stale value (waterMl isn't in its deps).
        const endingMl = await readJSON<number>(KEYS.WATER_TODAY, 0);
        const waterGoal =
          userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;
        await archiveWaterDay(currentDate, endingMl, waterGoal);
        setCurrentDate(today);
        setWaterMl(0);
        await writeString(KEYS.LAST_ACTIVE_DATE, today);
        await writeJSON(KEYS.WATER_TODAY, 0);
        // Regenerate diet for new day — KEEP the user's chosen diet
        // (planState.activeDietId) rather than silently auto-selecting.
        if (userBio && nutritionTargets) {
          // Serve the cached (often AI-generated) day if we have one — that's
          // what makes the schedule work offline. Otherwise generate it
          // (AI-first, local fallback). ensureDietForDate never clobbers a day
          // that's already scheduled.
          const result = await ensureDietForDate(
            userBio,
            nutritionTargets,
            today,
            planState.activeDietId ?? undefined,
          );
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
          }
          // Top up the offline buffer for the days ahead (online only).
          void ensureDietBuffer(
            userBio,
            nutritionTargets,
            today,
            result?.dietId ?? planState.activeDietId ?? undefined,
          );
        }
        await refreshTodayDiet();
        await refreshDietHistory();
        // Check if workout plan needs regen (new week)
        if (workoutPlan && userBio) {
          const weekStart = currentWeekStart();
          if (
            shouldRegenerateWorkoutPlan(workoutPlan, userBio, weekStart, {
              equipment: userBio.equipment,
              daysPerWeek: userBio.workoutDaysPerWeek,
            })
          ) {
            await regenerateWorkoutPlan();
          }
        }
      }
    };
    const interval = setInterval(checkDayChange, 60_000);
    return () => clearInterval(interval);
    // Same dependency array as the inlined effect; refreshers/userGoals are read
    // fresh through props (stable useCallbacks) and intentionally not listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, userBio, nutritionTargets, workoutPlan, planState]);
}
