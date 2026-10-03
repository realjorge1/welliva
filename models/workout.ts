/**
 * WORKOUT MODELS (extended for plan generation)
 * Used by the workout plan generator
 */

import { Difficulty, ExerciseCategory } from "./exercise";

/** Movement pattern for balanced programming */
export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "core"
  | "cardio"
  | "flexibility";

/** Equipment available to the user */
export type Equipment =
  | "none" // bodyweight only
  | "dumbbells"
  | "resistance_bands"
  | "pull_up_bar"
  | "bench"
  | "kettlebell";

/** A single exercise within a workout session */
export interface PlannedExercise {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  sets: number;
  reps: string; // e.g., "8-12" or "30 sec"
  restSeconds: number;
  durationMinutes: number;
  difficulty: Difficulty;

  /**
   * Rich "how-to" detail. Populated for AI-generated exercises so the guided
   * session and the exercise detail screen can teach the movement even when it
   * isn't in the local EXERCISE_DATABASE. Optional — local-DB exercises are
   * resolved by id and carry their own copy of this. Stored with the plan, so
   * it works fully offline.
   */
  setupPosition?: string;
  steps?: string[]; // ordered "how to perform" steps
  targetMuscles?: string[];
  coachCues?: string[];
  description?: string;

  /**
   * Which part of the session it belongs to. Absent = "main" — every plan built
   * before warm-ups and cool-downs were real exercises.
   */
  block?: "warmup" | "main" | "cooldown";
  /** The job it does inside the work block (see services/training/templates). */
  role?: "main" | "accessory" | "finisher" | "balance" | "mobility";
  /**
   * Why this movement is in the session, in one plain line — written by the
   * same code that chose it, from the input that decided the choice.
   */
  reason?: string;
  /**
   * Why the sets × reps are what they are when they MOVED (or deliberately
   * held) from last time. Absent on a starting dose: the week's reasons already
   * say how starting doses are set.
   */
  doseReason?: string;
}

/** A complete workout session for a single day */
export interface WorkoutSession {
  id: string;
  dayLabel: string; // e.g., "Day 1 – Push", "Day 2 – Pull & Legs"
  dayOfWeek?: number; // 0=Mon, 1=Tue, etc. (optional for scheduling)
  focus: string; // e.g., "Upper Body Push", "Full Body A"
  warmupMinutes: number;
  exercises: PlannedExercise[];
  cooldownMinutes: number;
  totalDurationMinutes: number;
  isRestDay: boolean;
  /** Why this day trains what it does, in one plain line. */
  reason?: string;
  /** "chosen" = a library workout the user put on this day. */
  source?: "planned" | "chosen";
  /** The library workout behind a "chosen" day. */
  libraryWorkoutId?: string;
}

/** A full weekly workout plan */
export interface GeneratedWorkoutPlan {
  id: string;
  createdAt: string; // ISO timestamp
  weekStart: string; // YYYY-MM-DD
  splitType: string; // e.g., "Full Body 3-Day", "Upper/Lower 4-Day"
  sessions: WorkoutSession[];
  /** Inputs used to generate this plan (for determinism check) */
  inputHash: string;
  /** How this week was built — one plain line per input that shaped it. */
  reasons?: string[];
  /** How the week was made (see fitness/types WorkoutPlanMode). */
  mode?: "planned" | "chosen";
  /** The engine that built it. A plan from an older engine is rebuilt. */
  engineVersion?: number;
  /**
   * Fingerprint of the dose rules this plan was built with. When it changes
   * (a new goal), last week's doses are no longer a starting point to climb
   * from, and the next build starts fresh rather than carrying them.
   */
  schemeKey?: string;
  /**
   * Monday the current dose rules took effect, when they changed under an
   * existing plan. Sessions logged before it are not climbed from.
   */
  schemeSince?: string;
}

/** Log entry for a completed workout */
export interface WorkoutLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  sessionId: string;
  sessionLabel: string;
  exercisesCompleted: number;
  totalExercises: number;
  completionPercent: number;
  durationMinutes: number;
  completedAt: string; // ISO timestamp
}

/** Body measurement log */
export interface BodyLogEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
  waistCm?: number;
  notes?: string;
}
