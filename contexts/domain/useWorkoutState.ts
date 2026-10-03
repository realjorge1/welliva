/**
 * useWorkoutState — workout plan/log/session handlers, extracted from AppContext
 * (M4). State stays owned by the provider and is passed in via setters.
 *
 * THE PLAN REBUILDS ITSELF WHEN ITS INPUTS CHANGE
 *
 * The weekly plan is a function of the user's profile, training preferences and
 * log (services/training). This hook is where "inputs changed" is noticed:
 *
 *   • on boot, once the bio is loaded (a plan from an older engine, or a new
 *     week since the app last ran, is rebuilt);
 *   • whenever the fitness profile changes — training days, session length,
 *     styles, goals, plan mode, a workout put on a day in Explore, a Gozlin
 *     adjustment — through the profile store's change feed;
 *   • when the day rolls over into a new week (useDayChange calls
 *     `ensureWorkoutPlanCurrent`).
 *
 * Each check compares the stored plan's input fingerprint with the current one
 * and rebuilds only on a difference, so the many profile writes that do NOT
 * shape the plan (favourites, recommendation memory, how a session felt) cost
 * one hash and nothing else. Rebuilds never overlap: one runs at a time, and a
 * request that arrives mid-build runs once more after it.
 */
import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { PlanState } from "../../models/planState";
import type { SessionSummaryData } from "../../models/session";
import type { UserBio } from "../../models/user";
import type { GeneratedWorkoutPlan, WorkoutLogEntry } from "../../models/workout";
import type { TrainingAdjustment } from "../../fitness/types";
import {
  loadFitnessProfile,
  subscribeFitnessProfile,
  updateFitnessProfile,
} from "../../fitness/services/FitnessProfileStore";
import { KEYS, currentWeekStart, readJSON, writeJSON } from "../../services/OfflineStorage";
import { generateWorkoutWeek } from "../../services/PlanSync";
import { recordActivity, StreakData } from "../../services/StreakService";
import { SessionService } from "../../services/SessionService";
import { resolveTrainingPrefs } from "../../services/training";
import { shouldRegenerateWorkoutPlan } from "../../services/WorkoutGenerator";
import type { WorkoutAdaptation } from "../../services/gozlin";

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

/** How long a burst of profile writes is allowed to settle before one rebuild. */
const PROFILE_SETTLE_MS = 250;

/** How long an applied Gozlin adjustment is kept in the profile at all. */
const ADJUSTMENT_KEEP_DAYS = 35;

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

  // The rebuild reads these through refs: it runs from effects, listeners and
  // the day-change sweep, and must always see the latest — never a closure's.
  // (Declared before the boot effect below, so they are current when it runs.)
  const bioRef = useRef(userBio);
  const planRef = useRef(workoutPlan);
  const planStateRef = useRef(planState);
  useEffect(() => {
    bioRef.current = userBio;
  }, [userBio]);
  useEffect(() => {
    planRef.current = workoutPlan;
  }, [workoutPlan]);
  useEffect(() => {
    planStateRef.current = planState;
  }, [planState]);

  /** Build, store and stamp a fresh plan from the current inputs. */
  const rebuild = useCallback(async (bio: UserBio): Promise<GeneratedWorkoutPlan> => {
    const weekStart = currentWeekStart();
    const wp = await generateWorkoutWeek(bio, weekStart, planRef.current);
    planRef.current = wp;
    setWorkoutPlan(wp);
    await writeJSON(KEYS.WORKOUT_PLAN, wp);

    const nextState: PlanState = {
      ...planStateRef.current,
      activeWorkoutPlanId: wp.id,
      weekStartDate: weekStart,
      lastGeneratedAt: new Date().toISOString(),
      needsRegen: false,
      regenReason: null,
    };
    planStateRef.current = nextState;
    setPlanState(nextState);
    await writeJSON(KEYS.PLAN_STATE, nextState);
    return wp;
  }, [setWorkoutPlan, setPlanState]);

  /** One rebuild at a time; a request that lands mid-build runs once after it. */
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  /**
   * Rebuild the plan if — and only if — it no longer matches its inputs: an
   * older engine built it, it is for another week, or the profile/preferences
   * it was built from have changed.
   */
  const ensureWorkoutPlanCurrent = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const run = (async () => {
      do {
        again.current = false;
        const bio = bioRef.current;
        if (!bio) return;
        let plan = planRef.current;
        if (!plan) plan = await readJSON<GeneratedWorkoutPlan | null>(KEYS.WORKOUT_PLAN, null);
        const prefs = resolveTrainingPrefs(bio, await loadFitnessProfile());
        if (shouldRegenerateWorkoutPlan(plan, bio, currentWeekStart(), prefs)) {
          planRef.current = plan;
          await rebuild(bio);
        }
      } while (again.current);
    })().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, [rebuild]);

  // Boot, and any later bio change that reaches state: bring the plan in line.
  useEffect(() => {
    if (!userBio) return;
    void ensureWorkoutPlanCurrent().catch((e) => console.error("ensureWorkoutPlanCurrent failed:", e));
  }, [userBio, ensureWorkoutPlanCurrent]);

  // Training preferences live in the fitness profile; any write there may
  // change the plan's inputs. Settle a burst of writes, then check once.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeFitnessProfile(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void ensureWorkoutPlanCurrent().catch((e) => console.error("plan refresh failed:", e));
      }, PROFILE_SETTLE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [ensureWorkoutPlanCurrent]);

  /** Rebuild now, from the current inputs (the old "Regenerate" path). */
  const regenerateWorkoutPlan = useCallback(async () => {
    try {
      const bio = bioRef.current;
      if (!bio) {
        console.warn("regenerateWorkoutPlan: no userBio, skipping");
        return;
      }
      await rebuild(bio);
    } catch (error) {
      console.error("regenerateWorkoutPlan failed:", error);
    }
  }, [rebuild]);

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
   * is the empirical history the training engine progresses doses from, and
   * that Gozlin's adaptive coaching reads.
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
   * Apply a Gozlin workout adaptation. It is RECORDED in the fitness profile
   * and the plan rebuilt with it, rather than patched into the stored plan: a
   * patch was undone by the next weekly rebuild, which started from the
   * profile alone. Recorded, a swap holds for four weeks and a dose change for
   * the week it was made in — after that the sessions logged at the new dose
   * carry it forward on their own.
   */
  const applyWorkoutAdaptation = useCallback(
    async (adaptation: WorkoutAdaptation) => {
      const weekStart = currentWeekStart();
      const id = `${weekStart}:${adaptation.kind}:${adaptation.exerciseId ?? "all"}`;
      const record: TrainingAdjustment = {
        id,
        appliedAt: new Date().toISOString(),
        weekStart,
        title: adaptation.title,
        exerciseId: adaptation.exerciseId,
        exerciseName: adaptation.exerciseName,
        change: {
          replacementId: adaptation.change.replacementId,
          replacementName: adaptation.change.replacementName,
          repFactor: adaptation.change.repFactor,
          setsDelta: adaptation.change.setsDelta,
          restDeltaSeconds: adaptation.change.restDeltaSeconds,
        },
      };
      const profile = await loadFitnessProfile();
      const cutoff = Date.now() - ADJUSTMENT_KEEP_DAYS * 86_400_000;
      const kept = (profile.trainingAdjustments ?? []).filter(
        (a) => a.id !== id && Date.parse(a.appliedAt) >= cutoff,
      );
      await updateFitnessProfile({ trainingAdjustments: [...kept, record] });
      await ensureWorkoutPlanCurrent();
    },
    [ensureWorkoutPlanCurrent],
  );

  return {
    regenerateWorkoutPlan,
    ensureWorkoutPlanCurrent,
    logWorkout,
    recordSessionSummary,
    applyWorkoutAdaptation,
  };
}
