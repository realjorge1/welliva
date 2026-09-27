/**
 * Session fixtures for the novelty tests: real-shaped SessionSummaryData, built
 * from a compact spec so a test reads as a training diary, not as JSON.
 */

import type { Difficulty, ExerciseCategory } from "../../../../models/exercise";
import type { ExerciseSessionResult, SessionSummaryData } from "../../../../models/session";

export interface Ex {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty?: Difficulty;
  /** Completed sets. 0 = skipped. Default 3. */
  sets?: number;
  seconds?: number;
}

export const PUSHUP: Ex = { id: "push_01", name: "Push-ups", category: "push", difficulty: "beginner" };
export const SQUAT: Ex = { id: "legs_01", name: "Bodyweight Squats", category: "legs", difficulty: "beginner" };
export const PLANK: Ex = { id: "core_01", name: "Plank", category: "core", difficulty: "beginner" };
export const ROW: Ex = { id: "pull_04", name: "Dumbbell Rows", category: "pull", difficulty: "intermediate" };
export const NORDIC: Ex = { id: "hinge_09", name: "Nordic Hamstring Curl", category: "legs", difficulty: "advanced" };
export const BRIDGE: Ex = { id: "hinge_01", name: "Glute Bridges", category: "legs", difficulty: "beginner" };
export const ARCHER: Ex = { id: "push_08", name: "Archer Push-ups", category: "push", difficulty: "advanced" };
export const INCLINE: Ex = { id: "push_02", name: "Incline Push-ups", category: "push", difficulty: "beginner" };
export const PIGEON: Ex = { id: "flex_16", name: "Pigeon Pose", category: "flexibility", difficulty: "intermediate" };
export const MARCH: Ex = { id: "cardio_08", name: "March in Place", category: "cardio", difficulty: "beginner" };
export const LUNGE: Ex = { id: "legs_02", name: "Lunges", category: "legs", difficulty: "beginner" };

/** A local date `n` days after 2026-07-06 (a Monday). */
export function day(n: number): string {
  const d = new Date(2026, 6, 6 + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local wall-clock instant on day `n`. */
export function at(n: number, hour = 18, minute = 0): Date {
  return new Date(2026, 6, 6 + n, hour, minute);
}

function result(e: Ex): ExerciseSessionResult {
  const sets = e.sets ?? 3;
  return {
    exerciseId: e.id,
    exerciseName: e.name,
    category: e.category,
    difficulty: e.difficulty ?? "beginner",
    targetSets: 3,
    targetReps: "10",
    setsCompleted: Array.from({ length: sets }, (_, i) => ({
      setNumber: i + 1,
      repsCompleted: 10,
      durationSeconds: 20,
      skipped: false,
    })),
    totalReps: sets * 10,
    totalTimeSeconds: e.seconds ?? sets * 20,
    skipped: sets === 0,
  };
}

export function session(n: number, exercises: Ex[], runId = `run_${n}`, hour = 18): SessionSummaryData {
  return {
    sessionRunId: runId,
    workoutSessionId: "ws",
    sessionLabel: "Session",
    date: day(n),
    exerciseResults: exercises.map(result),
    totalExercises: exercises.length,
    exercisesCompleted: exercises.length,
    totalSets: exercises.length * 3,
    setsCompleted: exercises.length * 3,
    totalReps: 0,
    durationSeconds: 1800,
    caloriesBurned: 200,
    completionPercent: 100,
    completedAt: at(n, hour).toISOString(),
  };
}

/** Mon/Wed/Fri for `weeks` weeks from day 0, the same familiar routine. */
export function routine(weeks: number, exercises: Ex[] = [PUSHUP, SQUAT, PLANK, ROW]): SessionSummaryData[] {
  const out: SessionSummaryData[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const d of [0, 2, 4]) out.push(session(w * 7 + d, exercises));
  }
  return out;
}
