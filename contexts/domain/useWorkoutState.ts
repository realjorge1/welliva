/**
 * useWorkoutState — workout plan/log/session handlers, extracted from AppContext
 * (M4). State stays owned by the provider and is passed in via setters, so this
 * is a pure move: identical bodies, identical dependency arrays, no behavior
 * change. Returns the handlers the WorkoutSlice exposes.
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { PlanState } from "../../models/planState";
import type { SessionSummaryData } from "../../models/session";
import type { UserBio } from "../../models/user";
import type { GeneratedWorkoutPlan, WorkoutLogEntry } from "../../models/workout";
import { KEYS, currentWeekStart, writeJSON } from "../../services/OfflineStorage";
import { generateWorkoutWeek } from "../../services/PlanSync";
import { recordActivity, StreakData } from "../../services/StreakService";
import { SessionService } from "../../services/SessionService";
import {
  applyWorkoutAdaptation as applyWorkoutAdaptationToPlan,
  type WorkoutAdaptation,
} from "../../services/gozlin";

interface Params {
  userBio: UserBio | null;
  workoutPlan: GeneratedWorkoutPlan | null;
  planState: PlanState;
  currentDate: string;
  setWorkoutPlan: Dispatch<SetStateAction<GeneratedWorkoutPlan | null>>;
  setWorkoutLog: Dispatch<SetStateAction<WorkoutLogEntry[]>>;
  setSessionHistory: Dispatch<SetStateAction<SessionSummaryData[]>>;
  setPlanState: Dispatch<SetStateAction<PlanState>>;
  setStreakData: Dispatch<SetStateAction<StreakData>>;
}

export function useWorkoutState({
  userBio,
  workoutPlan,
  planState,
  currentDate,
  setWorkoutPlan,
  setWorkoutLog,
  setSessionHistory,
  setPlanState,
  setStreakData,
}: Params) {
  const regenerateWorkoutPlan = useCallback(async () => {
    try {
      if (!userBio) {
        console.warn("regenerateWorkoutPlan: no userBio, skipping");
        return;
      }
      const bio = userBio;
      const weekStart = currentWeekStart();

      // AI-first weekly plan (richer, not limited to the local exercise DB),
      // with local deterministic fallback when the backend is unreachable.
      const wp = await generateWorkoutWeek(bio, weekStart);

      setWorkoutPlan(wp);
      await writeJSON(KEYS.WORKOUT_PLAN, wp);

      const newPlanState: PlanState = {
        ...planState,
        activeWorkoutPlanId: wp.id,
        weekStartDate: weekStart,
        lastGeneratedAt: new Date().toISOString(),
        needsRegen: false,
        regenReason: null,
      };
      setPlanState(newPlanState);
      await writeJSON(KEYS.PLAN_STATE, newPlanState);
      console.log("regenerateWorkoutPlan: success, new plan id:", wp.id);
    } catch (error) {
      console.error("regenerateWorkoutPlan failed:", error);
    }
  }, [userBio, planState]);

  const logWorkout = useCallback(
    async (entry: WorkoutLogEntry) => {
      // Dedupe by id: the session-summary screen logs on mount and can re-fire
      // (e.g. remount/navigation), which previously appended duplicate entries.
      let didAdd = false;
      setWorkoutLog((prev) => {
        if (prev.some((l) => l.id === entry.id)) return prev;
        didAdd = true;
        const updated = [...prev, entry];
        writeJSON(KEYS.WORKOUT_LOG, updated);
        return updated;
      });
      if (didAdd) {
        const { data: streakUpdated } = await recordActivity(currentDate);
        setStreakData(streakUpdated);
      }
    },
    [currentDate],
  );

  /**
   * Persist a completed guided session's per-exercise summary (reps/skips). This
   * is the empirical history Adaptive Workout Intelligence reads to detect when
   * an exercise is becoming easier (progress) or being avoided (replace).
   */
  const recordSessionSummary = useCallback(async (summary: SessionSummaryData) => {
    let didAdd = false;
    setSessionHistory((prev) => {
      if (prev.some((s) => s.sessionRunId === summary.sessionRunId)) return prev;
      didAdd = true;
      return [summary, ...prev].slice(0, 50);
    });
    if (didAdd) await SessionService.getInstance().saveSummary(summary);
  }, []);

  /**
   * Apply a Gozlin workout adaptation to the live plan. Preserves the plan's
   * inputHash so shouldRegenerateWorkoutPlan stays false this week (the change
   * sticks); next week regenerates fresh from updated training data.
   */
  const applyWorkoutAdaptation = useCallback(
    async (adaptation: WorkoutAdaptation) => {
      if (!workoutPlan) return;
      const next = applyWorkoutAdaptationToPlan(workoutPlan, adaptation);
      setWorkoutPlan(next);
      await writeJSON(KEYS.WORKOUT_PLAN, next);
    },
    [workoutPlan],
  );

  return {
    regenerateWorkoutPlan,
    logWorkout,
    recordSessionSummary,
    applyWorkoutAdaptation,
  };
}
