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
