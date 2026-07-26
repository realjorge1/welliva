/**
 * WORKOUT CATALOG — the query layer over the authored workout library.
 *
 * Pure + synchronous: resolves authored WorkoutDefinitions against
 * EXERCISE_DATABASE into ResolvedWorkouts (duration, calories, equipment,
 * muscle coverage), and provides search/filter/suitability plus the exact
 * param bundle the existing guided-session player expects.
 *
 * No storage, no React, no native modules — fully unit-testable.
 */

import { EXERCISE_DATABASE, type ExerciseDBEntry } from "@/constants/ExerciseDatabase";
import { isTimedReps, parseTargetReps } from "@/models/session";
import type { UserBio } from "@/models/user";
import { exerciseSuitability } from "@/services/WorkoutGenerator";
import { getCoach } from "../data/coaches";
import { WORKOUTS, WORKOUT_BY_ID } from "../data/workouts";
import type {
  ResolvedWorkout,
  WorkoutBlockItem,
  WorkoutDefinition,
  WorkoutFilter,
} from "../types";

const DB_BY_ID: ReadonlyMap<string, ExerciseDBEntry> = new Map(
  EXERCISE_DATABASE.map((e) => [e.id, e]),
);

/** Average seconds per rep used for duration estimates (tempo + setup slack). */
const SECONDS_PER_REP = 3.5;
/** Rest between exercises inside the player (SessionService TRANSITION). */
const TRANSITION_SECONDS = 30;

/** MET values per energy level — mirrors models/exercise.estimateCaloriesBurned. */
const MET_BY_ENERGY = { low: 3.0, medium: 5.0, high: 8.0 } as const;

export interface FlatWorkoutItem {
  exercise: ExerciseDBEntry;
  sets: number;
  reps: string;
  block: "warmup" | "main" | "cooldown";
}

/** Resolve one block item against the database (throws on unknown id). */
function resolveItem(
  item: WorkoutBlockItem,
  block: FlatWorkoutItem["block"],
): FlatWorkoutItem {
  const exercise = DB_BY_ID.get(item.exerciseId);
  if (!exercise) {
    throw new Error(`Workout references unknown exercise "${item.exerciseId}"`);
  }
  return {
    exercise,
    sets: item.sets ?? exercise.defaultSets,
    reps: item.reps ?? exercise.defaultReps,
    block,
  };
}

/** Flatten warm-up → main → cool-down into the ordered session list. */
export function flattenWorkout(def: WorkoutDefinition): FlatWorkoutItem[] {
  return [
    ...def.warmup.map((i) => resolveItem(i, "warmup")),
    ...def.main.map((i) => resolveItem(i, "main")),
    ...def.cooldown.map((i) => resolveItem(i, "cooldown")),
  ];
}

/** Estimated wall-clock seconds for one flattened item inside the player. */
function itemSeconds(item: FlatWorkoutItem): number {
  const target = parseTargetReps(item.reps);
  const work = isTimedReps(item.reps) ? target : target * SECONDS_PER_REP;
  const rests = Math.max(0, item.sets - 1) * item.exercise.restSeconds;
  return item.sets * work + rests + TRANSITION_SECONDS;
}

/** Estimate the full session length in minutes. */
export function estimateWorkoutMinutes(def: WorkoutDefinition): number {
  const total = flattenWorkout(def).reduce((sum, i) => sum + itemSeconds(i), 0);
  return Math.max(1, Math.round(total / 60));
}

/** Enrich a definition with everything derived from its exercises. */
export function resolveWorkout(
  def: WorkoutDefinition,
  weightKg: number = 70,
): ResolvedWorkout {
  const items = flattenWorkout(def);
  const equipment = [...new Set(items.flatMap((i) => i.exercise.equipment))];
  const targetMuscles = [
    ...new Set(items.filter((i) => i.block === "main").flatMap((i) => i.exercise.targetMuscles)),
  ];
  const durationMinutes = estimateWorkoutMinutes(def);
  const met = MET_BY_ENERGY[def.energy];
  return {
    ...def,
    durationMinutes,
    exerciseCount: items.length,
    equipment,
    targetMuscles,
    estimatedCalories: Math.round(met * weightKg * (durationMinutes / 60)),
  };
}

// Resolved once at module load (72 workouts × 85 exercises — trivial work),
// then re-priced per body weight on demand.
const RESOLVED: ResolvedWorkout[] = WORKOUTS.map((w) => resolveWorkout(w));

export function getAllWorkouts(): ResolvedWorkout[] {
  return RESOLVED;
}

export function getWorkout(id: string): ResolvedWorkout | null {
  const def = WORKOUT_BY_ID.get(id);
  return def ? RESOLVED.find((w) => w.id === id) ?? resolveWorkout(def) : null;
}

/* ─────────────────────────── search & filter ─────────────────────────── */

/** Case-insensitive token search over every meaningful text field. */
export function workoutMatchesQuery(w: ResolvedWorkout, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const coach = getCoach(w.coachId);
  const haystack = [
    w.name,
    w.tagline,
    w.style,
    w.focus.replace(/_/g, " "),
    w.difficulty,
    coach.name,
    coach.specialty,
    ...w.tags,
    ...w.targetMuscles,
    ...w.equipment,
    `${w.durationMinutes} min`,
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

/** True when the workout needs nothing beyond the listed equipment. */
export function workoutFitsEquipment(
  w: ResolvedWorkout,
  owned: string[],
): boolean {
  const set = new Set(owned.filter((e) => e !== "none"));
  return w.equipment.every((eq) => set.has(eq));
}

export function filterWorkouts(
  filter: WorkoutFilter,
  favorites: string[] = [],
): ResolvedWorkout[] {
  const favSet = new Set(favorites);
  return RESOLVED.filter((w) => {
    if (filter.favoritesOnly && !favSet.has(w.id)) return false;
    if (filter.style && filter.style !== "all" && w.style !== filter.style) return false;
    if (filter.difficulty && filter.difficulty !== "all" && w.difficulty !== filter.difficulty)
      return false;
    if (filter.focus && filter.focus !== "all" && w.focus !== filter.focus) return false;
    if (filter.energy && filter.energy !== "all" && w.energy !== filter.energy) return false;
    if (filter.maxMinutes && w.durationMinutes > filter.maxMinutes) return false;
    if (filter.equipment && !workoutFitsEquipment(w, filter.equipment)) return false;
    if (filter.goal && !w.goalFit.includes(filter.goal)) return false;
    if (filter.coachId && w.coachId !== filter.coachId) return false;
    if (filter.query && !workoutMatchesQuery(w, filter.query)) return false;
    return true;
  });
}

/* ───────────────────── personalization & the player ───────────────────── */

/**
 * Per-user fit for a whole workout: the average exercise suitability of the
 * MAIN block, plus any cautions (contraindicated moves) to surface.
 */
export function workoutSuitability(
  def: WorkoutDefinition,
  bio: UserBio,
): { percent: number; cautions: string[] } {
  const mains = def.main
    .map((i) => DB_BY_ID.get(i.exerciseId))
    .filter((e): e is ExerciseDBEntry => !!e);
  if (mains.length === 0) return { percent: 90, cautions: [] };
  let sum = 0;
  const cautions: string[] = [];
  for (const ex of mains) {
    const fit = exerciseSuitability(ex, bio);
    sum += fit.percent;
    if (fit.caution) cautions.push(`${ex.name}: ${fit.caution}`);
  }
  return { percent: Math.round(sum / mains.length), cautions };
}

/**
 * The exact route params the EXISTING guided-session screen expects
 * (`exerciseIds`, `sets`, `reps` as comma-joined arrays). Keeping this
 * contract means library workouts run through the proven player untouched.
 */
export function workoutToPlayerParams(def: WorkoutDefinition): {
  exerciseIds: string;
  sets: string;
  reps: string;
  sessionLabel: string;
  workoutSessionId: string;
} {
  const items = flattenWorkout(def);
  return {
    exerciseIds: items.map((i) => i.exercise.id).join(","),
    sets: items.map((i) => i.sets).join(","),
    reps: items.map((i) => i.reps).join(","),
    sessionLabel: def.name,
    workoutSessionId: `lib_${def.id}`,
  };
}

/** Whether a session id produced by this catalog ("lib_*"). */
export function isLibrarySessionId(sessionId: string): boolean {
  return sessionId.startsWith("lib_");
}

/** Reverse of workoutToPlayerParams' id ("lib_x" → catalog workout). */
export function workoutFromSessionId(sessionId: string): ResolvedWorkout | null {
  return isLibrarySessionId(sessionId) ? getWorkout(sessionId.slice(4)) : null;
}
