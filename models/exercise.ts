/**
 * EXERCISE MODELS
 * Exercise database, workouts, and history
 */

/**
 * Difficulty levels
 */
export type Difficulty = "beginner" | "intermediate" | "advanced";

/**
 * Exercise category
 */
export type ExerciseCategory =
  | "push"
  | "pull"
  | "legs"
  | "core"
  | "cardio"
  | "flexibility";

/**
 * Exercise - Single exercise definition
 */
export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  durationMinutes: number;
  sets?: string; // e.g., "3-4"
  reps?: string; // e.g., "8-15" or "30 sec"
  targetMuscles: string[];
  description: string;
  instructions: string[];
  benefits: string[];
}

/**
 * CompletedExercise - Logged workout
 */
export interface CompletedExercise {
  id: string;
  date: string; // YYYY-MM-DD
  exerciseId: string;
  exerciseName: string;
  category: string;
  durationMinutes: number;
  setsCompleted: number;
  totalReps: number;
  caloriesBurned: number;
  completedAt: string; // ISO timestamp
}

/**
 * DailyWorkout - All exercises for a day
 */
export interface DailyWorkout {
  date: string; // YYYY-MM-DD
  exercises: CompletedExercise[];
  totalDuration: number;
  totalCalories: number;
}

/**
 * ExerciseHistory - Summary for history view
 */
export interface ExerciseHistoryEntry {
  date: string;
  workoutsCompleted: number;
  totalMinutes: number;
  caloriesBurned: number;
}

/**
 * ExerciseStats - Aggregate statistics
 */
export interface ExerciseStats {
  totalWorkouts: number;
  totalMinutes: number;
  totalCaloriesBurned: number;
  thisWeekWorkouts: number;
  weeklyWorkouts: number[]; // Last 7 days
}

/**
 * Exercise goal tracking
 */
export interface ExerciseGoal {
  workoutsPerWeek?: number;
  minutesPerDay?: number;
}

/**
 * Calculate estimated calories burned
 * Simple MET-based calculation
 */
export function estimateCaloriesBurned(
  durationMinutes: number,
  weightKg: number,
  intensity: "light" | "moderate" | "vigorous" = "moderate",
): number {
  // MET values (Metabolic Equivalent of Task)
  const metValues = {
    light: 3.0, // Light calisthenics
    moderate: 5.0, // Moderate calisthenics
    vigorous: 8.0, // Vigorous calisthenics
  };

  const met = metValues[intensity];
  // Formula: Calories = MET × weight (kg) × duration (hours)
  return Math.round(met * weightKg * (durationMinutes / 60));
}
