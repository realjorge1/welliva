/**
 * useWorkoutState — workout plan/log/session handlers, extracted from AppContext
 * (M4). State stays owned by the provider and is passed in via setters, so this
 * is a pure move: identical bodies, identical dependency arrays, no behavior
 * change. Returns the handlers the WorkoutSlice exposes.
 */
import { useCallback, useEffect, useRef } from "react";
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
  /** Live collections, so a write can dedupe WITHOUT a setState updater. */
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
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
  workoutLog,
  sessionHistory,
  setWorkoutPlan,
  setWorkoutLog,
  setSessionHistory,
  setPlanState,
  setStreakData,
}: Params) {
  /**
   * Ref mirrors of the two collections a completed session appends to.
   *
   * These exist because a `setState` UPDATER IS NOT A PLACE FOR SIDE EFFECTS or
   * for deciding whether one should run. React invokes an updater during the
   * next render — and, on the eager-bailout path, sometimes synchronously —
   * so a `let didAdd` assigned inside one and read straight after is a coin
   * flip. That is exactly how the post-workout streak update was being lost:
   * the flag read `false`, `recordActivity` never ran, and a finished session
   * left the streak and the "this week" numbers where they were.
   *
   * Reading the ref lets the dedupe happen BEFORE the state write, so the
   * persistence and the streak update are ordinary awaited statements. The ref
   * (not the prop) is also what makes two completions in the same tick dedupe
   * correctly — props are stale until the next render.
   */
  const workoutLogRef = useRef(workoutLog);
  const sessionHistoryRef = useRef(sessionHistory);
  useEffect(() => {
    workoutLogRef.current = workoutLog;
  }, [workoutLog]);
  useEffect(() => {
    sessionHistoryRef.current = sessionHistory;
  }, [sessionHistory]);
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
      if (workoutLogRef.current.some((l) => l.id === entry.id)) return;

      const updated = [...workoutLogRef.current, entry];
      // Update the ref FIRST so a second call in the same tick (a remount, a
      // double-tap) sees the entry and dedupes against it.
      workoutLogRef.current = updated;
      setWorkoutLog(updated);
      await writeJSON(KEYS.WORKOUT_LOG, updated);

      // The streak is what makes a finished workout visibly "count". It runs
      // unconditionally on a genuine add — never gated on a flag set inside a
      // setState updater.
      const { data: streakUpdated } = await recordActivity(entry.date || currentDate);
      setStreakData(streakUpdated);
    },
    [currentDate, setWorkoutLog, setStreakData],
  );

  /**
   * Persist a completed guided session's per-exercise summary (reps/skips). This
   * is the empirical history Adaptive Workout Intelligence reads to detect when
   * an exercise is becoming easier (progress) or being avoided (replace).
   */
  const recordSessionSummary = useCallback(
    async (summary: SessionSummaryData) => {
      if (sessionHistoryRef.current.some((s) => s.sessionRunId === summary.sessionRunId)) {
        return;
      }
      const updated = [summary, ...sessionHistoryRef.current].slice(0, 50);
      sessionHistoryRef.current = updated;
      setSessionHistory(updated);
      // saveSummary dedupes by sessionRunId on its side too — the player also
      // persists the summary the moment the session completes, so this is
      // routinely a second call for the same run.
      await SessionService.getInstance().saveSummary(summary);
    },
    [setSessionHistory],
  );

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
