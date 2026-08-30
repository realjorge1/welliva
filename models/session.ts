/**
 * GUIDED SESSION MODELS
 * State-machine types for the live coach exercise experience.
 *
 * Flow: COUNTDOWN → ACTIVE_SET → REST → ... → COMPLETE → SUMMARY
 */

import { Difficulty, ExerciseCategory } from "./exercise";

/** The one question the completion screen asks, so the plan can adapt. */
export type SessionEffort = "easy" | "right" | "hard";

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
  /**
   * How long ONE set of this movement is boxed to, in seconds.
   *
   * Every set is time-driven — reps are a PRESCRIPTION the athlete reads, never
   * a live counter they tap — so a rep exercise carries a work duration too.
   * Absent means "use the estimate" (`estimateWorkSeconds`); present means the
   * athlete set it themselves on the prescription screen.
   */
  workSeconds?: number;
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
  /** How the session felt — the single post-workout question. */
  effort?: SessionEffort;
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

/**
 * Seconds one controlled rep takes, by category. A push-up and a squat run at
 * roughly a three-second tempo; a burpee or mountain climber is far quicker;
 * a mobility rep is slower because the hold is the point.
 */
const SECONDS_PER_REP: Record<ExerciseCategory, number> = {
  push: 3,
  pull: 3,
  legs: 3,
  core: 2.8,
  cardio: 1.6,
  flexibility: 4,
};

/**
 * How long to box a set of this exercise, when nobody has said otherwise.
 *
 * A timed movement already carries its answer in `reps` ("30 sec"). A rep
 * movement gets tempo × prescribed reps plus a few seconds to settle into
 * position, clamped to a sane band and rounded to five so the prescription
 * reads like something a coach wrote rather than something a spreadsheet did.
 */
export function estimateWorkSeconds(ex: SessionExerciseInfo): number {
  if (ex.exerciseType === "timed") return parseTargetReps(ex.reps);
  const perRep = SECONDS_PER_REP[ex.category] ?? 3;
  const raw = parseTargetReps(ex.reps) * perRep + 4;
  return Math.max(20, Math.min(120, Math.round(raw / 5) * 5));
}

/** The set's work duration: what the athlete chose, else the estimate. */
export function resolveWorkSeconds(ex: SessionExerciseInfo): number {
  return typeof ex.workSeconds === "number" && ex.workSeconds > 0
    ? ex.workSeconds
    : estimateWorkSeconds(ex);
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
