/**
 * SESSION SERVICE
 * State-machine controller for the guided workout experience.
 *
 * Responsibilities:
 * – Manage session state transitions (COUNTDOWN → ACTIVE_SET → REST → ...)
 * – Persist in-progress session to AsyncStorage (crash recovery)
 * – Produce SessionSummaryData on completion
 *
 * This service is pure logic — no UI, no timers.
 * The GuidedSession screen runs its own interval and calls advance().
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { estimateCaloriesBurned } from "../models/exercise";
import { todayDate } from "./OfflineStorage";
import {
    ExerciseSessionResult,
    SessionExerciseInfo,
    SessionState,
    SessionSummaryData,
    SetResult,
    createInitialSessionState,
    parseTargetReps
} from "../models/session";

// ──────────────────────────────────────────────
// Storage key for in-progress session
// ──────────────────────────────────────────────
const SESSION_KEY = "@welliva_active_session";
const SESSION_HISTORY_KEY = "@welliva_session_history";

// ──────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────
export class SessionService {
  private static instance: SessionService;
  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // ────────────── Persistence ──────────────

  /** Save current session state so we can recover on app restart */
  async saveSession(state: SessionState): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("SessionService.saveSession:", e);
    }
  }

  /** Load a previously-saved in-progress session (or null) */
  async loadSession(): Promise<SessionState | null> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionState) : null;
    } catch (e) {
      console.error("SessionService.loadSession:", e);
      return null;
    }
  }

  /** Clear the saved session (called on completion or discard) */
  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error("SessionService.clearSession:", e);
    }
  }

  // ────────────── Initialisation ──────────────

  /** Create a fresh session state from exercise info */
  createSession(
    workoutSessionId: string,
    sessionLabel: string,
    exercises: SessionExerciseInfo[],
  ): SessionState {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return createInitialSessionState(
      runId,
      workoutSessionId,
      sessionLabel,
      exercises,
    );
  }

  // ────────────── State Machine ──────────────

  /**
   * Called every tick (1 s). Returns a new state.
   * The caller is responsible for calling this at 1 Hz while !isPaused.
   */
  tick(state: SessionState): SessionState {
    if (state.isPaused) return state;
    // INTRO is the pre-start overview — the clock doesn't run until the
    // athlete taps "Begin" (see startSession).
    if (state.phase === "INTRO") return state;

    const next = { ...state, elapsedSeconds: state.elapsedSeconds + 1 };

    switch (next.phase) {
      case "COUNTDOWN":
        return this.tickCountdown(next);
      case "ACTIVE_SET":
        return this.tickActiveSet(next);
      case "REST":
      case "TRANSITION":
        return this.tickRest(next);
      default:
        return next; // COMPLETE / SUMMARY — no tick needed
    }
  }

  private tickCountdown(s: SessionState): SessionState {
    if (s.countdownValue > 1) {
      return { ...s, countdownValue: s.countdownValue - 1 };
    }
    // countdown finished → start first set
    return { ...s, phase: "ACTIVE_SET", timerValue: 0, countdownValue: 0 };
  }

  private tickActiveSet(s: SessionState): SessionState {
    const newTimer = s.timerValue + 1;
    const ex = s.exercises[s.currentExerciseIndex];
    if (!ex) return { ...s, phase: "COMPLETE" };

    // For timed exercises, auto-complete the set when time elapses
    if (ex.exerciseType === "timed") {
      const targetSec = parseTargetReps(ex.reps);
      if (newTimer >= targetSec) {
        return this.completeCurrentSet(s, targetSec, targetSec);
      }
    }

    return { ...s, timerValue: newTimer };
  }

  private tickRest(s: SessionState): SessionState {
    if (s.timerValue > 1) {
      return { ...s, timerValue: s.timerValue - 1 };
    }

    // Rest done → advance
    if (s.phase === "REST") {
      // Next set
      return {
        ...s,
        phase: "ACTIVE_SET",
        timerValue: 0,
        currentSet: s.currentSet + 1,
        currentReps: 0,
      };
    }

    // TRANSITION → next exercise
    return this.advanceToNextExercise(s);
  }

  // ────────────── Actions (triggered by UI) ──────────────

  /** Leave the "About this session" intro → begin the 3-2-1 countdown. */
  startSession(state: SessionState): SessionState {
    if (state.phase !== "INTRO") return state;
    return { ...state, phase: "COUNTDOWN", countdownValue: 3, timerValue: 0 };
  }

  /**
   * The player's own smooth 3-2-1-GO finished → open the first set.
   *
   * The countdown is owned by the UI (it animates sub-second, and the workout
   * clock shouldn't start until GO), so it doesn't ride `tick`. `tickCountdown`
   * below is kept as the pure fallback path.
   */
  beginFirstSet(state: SessionState): SessionState {
    if (state.phase !== "COUNTDOWN") return state;
    return {
      ...state,
      phase: "ACTIVE_SET",
      timerValue: 0,
      countdownValue: 0,
      currentReps: 0,
    };
  }

  /** User tapped "+ Rep" */
  addRep(state: SessionState): SessionState {
    if (state.phase !== "ACTIVE_SET") return state;
    return { ...state, currentReps: state.currentReps + 1 };
  }

  /** Undo a mis-tapped rep. Never goes below zero. */
  removeRep(state: SessionState): SessionState {
    if (state.phase !== "ACTIVE_SET" || state.currentReps <= 0) return state;
    return { ...state, currentReps: state.currentReps - 1 };
  }

  /** User tapped "Done" (complete current set manually) */
  completeSet(state: SessionState): SessionState {
    if (state.phase !== "ACTIVE_SET") return state;
    const reps =
      state.exercises[state.currentExerciseIndex]?.exerciseType === "timed"
        ? state.timerValue
        : state.currentReps;
    return this.completeCurrentSet(state, reps, state.timerValue);
  }

  /**
   * Skip the rest period — advances NOW rather than parking the clock on 1 and
   * waiting for the next tick. "Start now" that takes up to a second to happen
   * reads as a dropped tap.
   */
  skipRest(state: SessionState): SessionState {
    if (state.phase === "REST") {
      return {
        ...state,
        phase: "ACTIVE_SET",
        timerValue: 0,
        currentSet: state.currentSet + 1,
        currentReps: 0,
      };
    }
    if (state.phase === "TRANSITION") return this.advanceToNextExercise(state);
    return state;
  }

  /** Give the athlete more recovery time (rest/transition only) */
  addRestTime(state: SessionState, seconds: number = 20): SessionState {
    if (state.phase !== "REST" && state.phase !== "TRANSITION") return state;
    return { ...state, timerValue: state.timerValue + seconds };
  }

  /** Skip the current exercise entirely */
  skipExercise(state: SessionState): SessionState {
    const ex = state.exercises[state.currentExerciseIndex];
    if (!ex) return state;

    // Record as skipped
    const result: ExerciseSessionResult = {
      exerciseId: ex.exerciseId,
      exerciseName: ex.name,
      category: ex.category,
      difficulty: ex.difficulty,
      targetSets: ex.sets,
      targetReps: ex.reps,
      setsCompleted: [],
      totalReps: 0,
      totalTimeSeconds: 0,
      skipped: true,
    };

    const newResults = [...state.results, result];

    if (state.currentExerciseIndex >= state.exercises.length - 1) {
      return { ...state, results: newResults, phase: "COMPLETE" };
    }

    return {
      ...state,
      results: newResults,
      phase: "TRANSITION",
      timerValue:
        state.exercises[state.currentExerciseIndex + 1]?.transitionSeconds ??
        30,
    };
  }

  /**
   * Step back (player "previous" button).
   * Mid-exercise (any completed set, counted reps, or an in-flight rest) →
   * restart the CURRENT exercise from set 1. At a fresh set 1 → return to the
   * PREVIOUS exercise and redo it. Either way the redone exercise's recorded
   * result is discarded so the summary never double-counts.
   */
  goBack(state: SessionState): SessionState {
    if (
      state.phase === "INTRO" ||
      state.phase === "COMPLETE" ||
      state.phase === "SUMMARY" ||
      state.phase === "COUNTDOWN"
    ) {
      return state;
    }

    const midExercise =
      state.phase === "REST" ||
      state.phase === "TRANSITION" ||
      state.currentSet > 1 ||
      state.currentReps > 0 ||
      state.timerValue > 3;

    if (midExercise) return this.restartExerciseAt(state, state.currentExerciseIndex);
    if (state.currentExerciseIndex > 0)
      return this.restartExerciseAt(state, state.currentExerciseIndex - 1);
    // Nothing before the very first fresh set — just zero the clock.
    return { ...state, timerValue: 0, currentReps: 0 };
  }

  /** Rewind to exercise `index`, wiping its previously recorded result. */
  private restartExerciseAt(s: SessionState, index: number): SessionState {
    const ex = s.exercises[index];
    if (!ex) return s;
    return {
      ...s,
      results: s.results.filter((r) => r.exerciseId !== ex.exerciseId),
      phase: "ACTIVE_SET",
      currentExerciseIndex: index,
      currentSet: 1,
      currentReps: 0,
      timerValue: 0,
    };
  }

  /** Pause / resume */
  togglePause(state: SessionState): SessionState {
    return { ...state, isPaused: !state.isPaused };
  }

  /** Stop session early → jump to COMPLETE */
  stopSession(state: SessionState): SessionState {
    // Flush any in-progress exercise (mark skipped from current set onward)
    return this.finishRemaining(state);
  }

  // ────────────── Internal Helpers ──────────────

  private completeCurrentSet(
    s: SessionState,
    reps: number,
    durationSeconds: number,
  ): SessionState {
    const ex = s.exercises[s.currentExerciseIndex];
    if (!ex) return { ...s, phase: "COMPLETE" };

    const setResult: SetResult = {
      setNumber: s.currentSet,
      repsCompleted: reps,
      durationSeconds,
      skipped: false,
    };

    // Find or create the exercise result
    let existingIdx = s.results.findIndex(
      (r) => r.exerciseId === ex.exerciseId && !r.skipped,
    );
    const newResults = [...s.results];

    if (existingIdx === -1) {
      // First set — create new result entry
      newResults.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.name,
        category: ex.category,
        difficulty: ex.difficulty,
        targetSets: ex.sets,
        targetReps: ex.reps,
        setsCompleted: [setResult],
        totalReps: reps,
        totalTimeSeconds: durationSeconds,
        skipped: false,
      });
    } else {
      // Subsequent set — append
      const prev = { ...newResults[existingIdx] };
      prev.setsCompleted = [...prev.setsCompleted, setResult];
      prev.totalReps += reps;
      prev.totalTimeSeconds += durationSeconds;
      newResults[existingIdx] = prev;
    }

    // Last set of this exercise?
    if (s.currentSet >= ex.sets) {
      // Last exercise?
      if (s.currentExerciseIndex >= s.exercises.length - 1) {
        return { ...s, results: newResults, phase: "COMPLETE" };
      }
      // Transition to next exercise
      const nextTransition =
        s.exercises[s.currentExerciseIndex + 1]?.transitionSeconds ?? 30;
      return {
        ...s,
        results: newResults,
        phase: "TRANSITION",
        timerValue: nextTransition,
      };
    }

    // More sets → rest
    return {
      ...s,
      results: newResults,
      phase: "REST",
      timerValue: ex.restSeconds,
      currentReps: 0,
    };
  }

  private advanceToNextExercise(s: SessionState): SessionState {
    const nextIndex = s.currentExerciseIndex + 1;
    if (nextIndex >= s.exercises.length) {
      return { ...s, phase: "COMPLETE" };
    }
    return {
      ...s,
      phase: "ACTIVE_SET",
      currentExerciseIndex: nextIndex,
      currentSet: 1,
      currentReps: 0,
      timerValue: 0,
    };
  }

  private finishRemaining(s: SessionState): SessionState {
    const newResults = [...s.results];
    // Mark current + subsequent exercises as skipped (unless they're already in results)
    for (let i = s.currentExerciseIndex; i < s.exercises.length; i++) {
      const ex = s.exercises[i];
      const exists = newResults.some((r) => r.exerciseId === ex.exerciseId);
      if (!exists) {
        newResults.push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          category: ex.category,
          difficulty: ex.difficulty,
          targetSets: ex.sets,
          targetReps: ex.reps,
          setsCompleted: [],
          totalReps: 0,
          totalTimeSeconds: 0,
          skipped: true,
        });
      }
    }
    return { ...s, results: newResults, phase: "COMPLETE" };
  }

  // ────────────── Summary ──────────────

  /** Produce SessionSummaryData from a COMPLETE session state */
  buildSummary(state: SessionState, weightKg: number = 70): SessionSummaryData {
    const completed = state.results.filter((r) => !r.skipped);
    const totalSetsTarget = state.exercises.reduce((sum, e) => sum + e.sets, 0);
    const setsCompleted = state.results.reduce(
      (sum, r) => sum + r.setsCompleted.length,
      0,
    );
    const totalReps = state.results.reduce((sum, r) => sum + r.totalReps, 0);

    // Estimate calories from elapsed time. Guard the divisor: a session whose
    // exercise list resolved to nothing would otherwise divide by zero, and
    // NaN is silent — `NaN > 0.7` is false, `NaN >= 50` is false, and
    // JSON.stringify turns it into `null`. That is how a finished workout
    // reaches the summary screen as a red "Keep going" ring at 0%.
    const intensity =
      totalSetsTarget > 0 && setsCompleted / totalSetsTarget > 0.7 ? "vigorous" : "moderate";
    const durationMin = Math.round(state.elapsedSeconds / 60);
    const calories = estimateCaloriesBurned(durationMin, weightKg, intensity);

    return {
      sessionRunId: state.sessionRunId,
      workoutSessionId: state.workoutSessionId,
      sessionLabel: state.sessionLabel,
      date: todayDate(),
      exerciseResults: state.results,
      totalExercises: state.exercises.length,
      exercisesCompleted: completed.length,
      totalSets: totalSetsTarget,
      setsCompleted,
      totalReps,
      durationSeconds: state.elapsedSeconds,
      caloriesBurned: calories,
      completionPercent:
        state.exercises.length > 0
          ? Math.round((completed.length / state.exercises.length) * 100)
          : 0,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Persist the summary to history.
   *
   * Idempotent by `sessionRunId`: the player saves the moment a session
   * completes AND the summary screen saves again through
   * `recordSessionSummary`, so the same run legitimately arrives twice. Without
   * this guard the second call duplicated the session in history, inflating
   * every "sessions completed" and total-volume figure derived from it.
   */
  async saveSummary(summary: SessionSummaryData): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_HISTORY_KEY);
      const history: SessionSummaryData[] = raw ? JSON.parse(raw) : [];
      if (history.some((h) => h.sessionRunId === summary.sessionRunId)) return;
      history.unshift(summary);
      // Keep last 50 sessions. Already bounded — noted here because this is the
      // pattern services/sync/retention.ts generalises: an unbounded document
      // is re-uploaded IN FULL on every write.
      if (history.length > 50) history.length = 50;
      await AsyncStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("SessionService.saveSummary:", e);
    }
  }

  /** Load past session summaries */
  async loadHistory(): Promise<SessionSummaryData[]> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("SessionService.loadHistory:", e);
      return [];
    }
  }
}
