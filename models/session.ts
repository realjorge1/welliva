/**
 * GUIDED SESSION MODELS
 * State-machine types for the live coach exercise experience.
 *
 * Flow: COUNTDOWN → ACTIVE_SET → REST → ... → COMPLETE → SUMMARY
 */

import { Difficulty, ExerciseCategory } from "./exercise";

// ──────────────────────────────────────────────
// Session Phases
// ──────────────────────────────────────────────

/** State machine phases */
export type SessionPhase =
  | "INTRO" // pre-start "about this session" overview (no clock running)
  | "COUNTDOWN" // 3-2-1-GO pre-start
  | "ACTIVE_SET" // user performing a set
  | "REST" // rest interval between sets
  | "TRANSITION" // rest between exercises
  | "COMPLETE" // session finished (auto-advance to summary)
  | "SUMMARY"; // review results

// ──────────────────────────────────────────────
// Per-Exercise Tracking
// ──────────────────────────────────────────────

/** A single set's result */
export interface SetResult {
  setNumber: number;
  repsCompleted: number;
  /** Seconds the set took (for timed exercises, this IS the prescribed time) */
  durationSeconds: number;
  skipped: boolean;
}

/** Result for one exercise within the session */
export interface ExerciseSessionResult {
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  targetSets: number;
  targetReps: string; // e.g. "10-15" or "30 sec"
  setsCompleted: SetResult[];
  totalReps: number;
  totalTimeSeconds: number;
  skipped: boolean;
}

// ──────────────────────────────────────────────
// Session State (for the state machine)
// ──────────────────────────────────────────────

export interface SessionState {
  /** Unique session run id */
  sessionRunId: string;
  /** Which workout session this belongs to */
  workoutSessionId: string;
  sessionLabel: string;
  /** All exercises in the session */
  exercises: SessionExerciseInfo[];
  /** Results being accumulated */
  results: ExerciseSessionResult[];

  /** Current state machine phase */
  phase: SessionPhase;
  /** Index into exercises[] for the current exercise */
  currentExerciseIndex: number;
  /** Within the current exercise, which set (1-based) */
  currentSet: number;
  /** Reps counted so far in the active set */
  currentReps: number;

  /** Countdown timer value (seconds remaining) */
  countdownValue: number;
  /** Timer value for current activity (seconds elapsed or remaining) */
  timerValue: number;
  /** Whether the session is paused */
  isPaused: boolean;

  /** ISO timestamp when the session started */
  startedAt: string;
  /** Total elapsed seconds (excluding pauses) */
  elapsedSeconds: number;
}

/** Minimal exercise info carried in the session state */
export interface SessionExerciseInfo {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  exerciseType: "reps" | "timed";
  sets: number;
  reps: string; // "10-15" or "30 sec"
  restSeconds: number;
  transitionSeconds: number; // rest between exercises (default 60)
  setupPosition: string;
  instructions: string[];
  coachCues: string[];
  icon: string;
}

// ──────────────────────────────────────────────
// Session Summary (persisted)
// ──────────────────────────────────────────────

export interface SessionSummaryData {
  sessionRunId: string;
  workoutSessionId: string;
  sessionLabel: string;
  date: string; // YYYY-MM-DD
  exerciseResults: ExerciseSessionResult[];
  totalExercises: number;
  exercisesCompleted: number;
  totalSets: number;
  setsCompleted: number;
  totalReps: number;
  durationSeconds: number;
  caloriesBurned: number;
  completionPercent: number;
  completedAt: string; // ISO timestamp
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Parse reps string to a target number (takes the lower bound) */
export function parseTargetReps(reps: string): number {
  // "10-15" → 10, "30 sec" → 30, "12" → 12
  const match = reps.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 10;
}

/** Parse reps string to check if it's time-based */
export function isTimedReps(reps: string): boolean {
  return /sec|min/i.test(reps);
}

/**
 * Create fresh initial state for a guided session.
 */
export function createInitialSessionState(
  sessionRunId: string,
  workoutSessionId: string,
  sessionLabel: string,
  exercises: SessionExerciseInfo[],
): SessionState {
  return {
    sessionRunId,
    workoutSessionId,
    sessionLabel,
    exercises,
    results: [],
    phase: "INTRO",
    currentExerciseIndex: 0,
    currentSet: 1,
    currentReps: 0,
    countdownValue: 3, // 3-2-1-GO
    timerValue: 0,
    isPaused: false,
    startedAt: new Date().toISOString(),
    elapsedSeconds: 0,
  };
}
