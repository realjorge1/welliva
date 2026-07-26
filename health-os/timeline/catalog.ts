/**
 * health-os/timeline/catalog.ts
 *
 * The event catalog: the typed payload for each EventType, its current version, and a
 * lightweight runtime validator. Dependency-free (no zod in the app bundle — the
 * server owns schema-validated AI output; on-device we hand-roll structural guards).
 *
 * See docs/architecture/02-data-and-schema.md §3.
 */
import type { MealType } from "@/models/diet";

import type { EventType } from "./events";

export type MealSlot = MealType; // "breakfast" | "lunch" | "dinner" | "snack"

export interface MealLoggedPayload {
  slot?: MealSlot;
  name: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  dietId?: string;
}
export interface MealSkippedPayload {
  slot?: MealSlot;
  name: string;
}
export interface NutritionDayClosedPayload {
  dietId: string;
  dietName: string;
  mealsConsumed: number;
  totalMeals: number;
  status: "completed" | "partial" | "skipped";
  consumedCalories?: number;
  consumedProteinG?: number;
  consumedCarbsG?: number;
  consumedFatG?: number;
}
export interface WaterAddedPayload {
  ml: number;
  totalMl?: number;
  goalMl?: number;
}
export interface WaterDayClosedPayload {
  ml: number;
  goalMl?: number;
  metGoal: boolean;
}
export interface WorkoutCompletedPayload {
  sessionId: string;
  sessionLabel: string;
  durationMinutes: number;
  completionPercent: number;
  exercisesCompleted: number;
  totalExercises: number;
  completedAt: string;
}
export interface WorkoutSummaryPayload {
  sessionRunId: string;
  sessionLabel: string;
  totalReps: number;
  setsCompleted: number;
  totalSets: number;
  completionPercent: number;
  durationSeconds: number;
}
export interface BodyMeasurementPayload {
  weightKg?: number;
  waistCm?: number;
  notes?: string;
}
export interface CheckinPayload {
  mood?: number;
  energy?: number;
  stress?: number;
  sleepHours?: number;
  note?: string;
}
export interface GoalSetPayload {
  kind: string;
  value: number | string | null;
  prev?: number | string | null;
}
export interface GoalReachedPayload {
  kind: string;
  value: number | string;
  chapter?: number;
}
export interface ProfileUpdatedPayload {
  changedFields: string[];
  summary?: string;
}
export interface PreferenceChangedPayload {
  kind: string;
  value: string | string[] | null;
}
export interface AchievementUnlockedPayload {
  achievementId: string;
  tier?: string;
  points?: number;
}
export interface ChallengeCompletedPayload {
  challengeId: string;
  periodKey: string;
}
export interface TrophyAwardedPayload {
  trophyId: string;
  periodKey: string;
  rival?: string;
}
export interface CoachEpisodePayload {
  summary: string;
  kind: "win" | "setback" | "milestone" | "note";
}
export interface LifeAddedPayload {
  /** The LifeEvent id this audit record points at (lives in the lifecontext store). */
  refId: string;
  kind: string;
  title: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD (omitted = point event)
  source: string; // "user" | "calendar" | "inferred"
}
export interface LifeResolvedPayload {
  refId: string;
  kind: string;
  title: string;
  resolution: "completed" | "expired" | "dismissed";
}

/** Maps each EventType to its current payload type (for typed reads). */
export interface PayloadByType {
  "nutrition.meal.logged": MealLoggedPayload;
  "nutrition.meal.skipped": MealSkippedPayload;
  "nutrition.day.closed": NutritionDayClosedPayload;
  "hydration.water.added": WaterAddedPayload;
  "hydration.day.closed": WaterDayClosedPayload;
  "workout.session.completed": WorkoutCompletedPayload;
  "workout.session.summary": WorkoutSummaryPayload;
  "body.measurement.logged": BodyMeasurementPayload;
  "checkin.logged": CheckinPayload;
  "goal.set": GoalSetPayload;
  "goal.reached": GoalReachedPayload;
  "profile.updated": ProfileUpdatedPayload;
  "preference.changed": PreferenceChangedPayload;
  "achievement.unlocked": AchievementUnlockedPayload;
  "challenge.completed": ChallengeCompletedPayload;
  "trophy.awarded": TrophyAwardedPayload;
  "coach.episode": CoachEpisodePayload;
  "life.added": LifeAddedPayload;
  "life.resolved": LifeResolvedPayload;
}

/** Current payload version per type. Bump + add an upcaster when a shape changes. */
export const EVENT_VERSIONS: Record<EventType, number> = {
  "nutrition.meal.logged": 1,
  "nutrition.meal.skipped": 1,
  "nutrition.day.closed": 1,
  "hydration.water.added": 1,
  "hydration.day.closed": 1,
  "workout.session.completed": 1,
  "workout.session.summary": 1,
  "body.measurement.logged": 1,
  "checkin.logged": 1,
  "goal.set": 1,
  "goal.reached": 1,
  "profile.updated": 1,
  "preference.changed": 1,
  "achievement.unlocked": 1,
  "challenge.completed": 1,
  "trophy.awarded": 1,
  "coach.episode": 1,
  "life.added": 1,
  "life.resolved": 1,
};

// ── lightweight structural validators ──
type Validator = (p: unknown) => boolean;
const isObj = (p: unknown): p is Record<string, unknown> =>
  typeof p === "object" && p !== null;
const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

const VALIDATORS: Record<EventType, Validator> = {
  "nutrition.meal.logged": (p) => isObj(p) && str(p.name),
  "nutrition.meal.skipped": (p) => isObj(p) && str(p.name),
  "nutrition.day.closed": (p) =>
    isObj(p) && str(p.dietId) && num(p.mealsConsumed) && num(p.totalMeals),
  "hydration.water.added": (p) => isObj(p) && num(p.ml),
  "hydration.day.closed": (p) => isObj(p) && num(p.ml),
  "workout.session.completed": (p) => isObj(p) && str(p.sessionId),
  "workout.session.summary": (p) => isObj(p) && str(p.sessionRunId),
  "body.measurement.logged": (p) =>
    isObj(p) && (num(p.weightKg) || num(p.waistCm)),
  "checkin.logged": (p) => isObj(p),
  "goal.set": (p) => isObj(p) && str(p.kind),
  "goal.reached": (p) => isObj(p) && str(p.kind),
  "profile.updated": (p) => isObj(p) && Array.isArray(p.changedFields),
  "preference.changed": (p) => isObj(p) && str(p.kind),
  "achievement.unlocked": (p) => isObj(p) && str(p.achievementId),
  "challenge.completed": (p) => isObj(p) && str(p.challengeId),
  "trophy.awarded": (p) => isObj(p) && str(p.trophyId),
  "coach.episode": (p) => isObj(p) && str(p.summary),
  "life.added": (p) => isObj(p) && str(p.refId) && str(p.title) && str(p.start),
  "life.resolved": (p) => isObj(p) && str(p.refId) && str(p.resolution),
};

/** True if `payload` is structurally valid for `type`. Unknown types pass (forward-compat). */
export function validatePayload(type: EventType, payload: unknown): boolean {
  const fn = VALIDATORS[type];
  return fn ? fn(payload) : true;
}
