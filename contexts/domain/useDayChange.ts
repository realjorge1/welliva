/**
 * useDayChange — the midnight rollover sweep, extracted from AppContext (M4).
 * A local date change closes out every day that ended while the app was open or
 * backgrounded.
 *
 * On a rollover it: sweeps + closes every intervening day (idempotent, also
 * purging back-log-expired schedules), compacts the closed day into the L2
 * memory summaries, expires due Life Context events, refreshes connected senses,
 * archives the ending day's hydration then resets today's counter, regenerates
 * the new day's diet (keeping the user's chosen diet, cache-first/offline-safe),
 * tops up the offline meal buffer, refreshes today's diet + history, and
 * regenerates the workout plan when a new week has started.
 *
 * TWO TRIGGERS, ONE SWEEP. The one-minute interval this started as only runs
 * while the app is FOREGROUNDED — both platforms suspend JS timers otherwise —
 * so for the normal user, who closes the app at night and opens it in the
 * morning, the interval had never once fired at the moment the day actually
 * turned over. A return to the foreground now runs the same check, and on a
 * same-day return it still re-reads today's numbers, since storage can have
 * moved while we were away (a notification action, the sync engine adopting a
 * remote copy). The two are serialized through one in-flight guard.
 */
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AppState } from "react-native";

import { lifeContext, memory, runDailyLearning, signalsCoordinator } from "../../health-os";
import { maintenanceTdee } from "../../services/NutritionService";
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
  /**
   * Guards the sweep against running twice at once — the interval and a
   * foreground can land together, and the sweep closes days, regenerates a
   * plan and refits the learning models. Doing that concurrently with itself
   * is how a day gets closed against half-written state.
   */
  const running = useRef(false);

  // Check for day change every minute, and on every return to the foreground.
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
        // Close the learning loop for the day that just ended: score every
        // recommendation whose horizon has passed, then refit the TDEE filter,
        // the training-response curves, the adherence model and the delivery
        // posteriors from the full history. Idempotent, so a device that wakes
        // up after a week of sleep resolves the whole backlog in one pass.
        //
        // Deliberately AFTER the day-close compaction above — the resolver
        // reads the timeline, and a day that hasn't been closed yet has no
        // `nutrition.day.closed` event for it to judge against.
        if (userBio) {
          try {
            await runDailyLearning({
              mifflinTdee: maintenanceTdee(userBio),
              weightKg: userBio.weightKg,
            });
          } catch {
            // Learning is an enhancement, never a gate: a failure here must not
            // strand the rest of the rollover (diet regeneration, hydration
            // archiving) that the user's day actually depends on.
          }
        }
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
    /**
     * One entry point for both triggers, so they can never overlap.
     *
     * `refreshOnly` is what a same-day return to the foreground needs: today's
     * numbers are read from storage, and storage can have moved while we were
     * backgrounded — the "Mark as done" notification action completes a habit
     * with the app killed, the sync engine adopts a remote copy on its own
     * foreground sweep, and a share-sheet log lands from outside the process.
     * Re-reading three small documents is far cheaper than being wrong about
     * what someone ate.
     */
    const run = async (refreshOnly: boolean) => {
      if (running.current) return;
      running.current = true;
      try {
        if (todayDate() !== currentDate) await checkDayChange();
        else if (refreshOnly) await refreshTodayDiet();
      } catch (e) {
        console.error("useDayChange: day check failed:", e);
      } finally {
        running.current = false;
      }
    };

    const interval = setInterval(() => void run(false), 60_000);

    // THE INTERVAL IS NOT ENOUGH. Both platforms suspend JS timers for a
    // backgrounded app, so the one-minute tick simply does not happen while the
    // user is away — and "away" is where they are for every hour that isn't
    // spent in the app. Coming back the next morning, the app would keep
    // serving YESTERDAY as today until a minute after the resume: the wrong
    // plan, the wrong totals, and — before the writes were pinned to the real
    // date — a tick that landed on a day nobody was looking at.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run(true);
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
    // Same dependency array as the inlined effect; refreshers/userGoals are read
    // fresh through props (stable useCallbacks) and intentionally not listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, userBio, nutritionTargets, workoutPlan, planState]);
}
