/**
 * Golden fixtures: realistic, pre-Timeline storage silos for four user shapes.
 * Used to prove migration 001 is lossless + idempotent across light/heavy/edge/fresh
 * users (docs/architecture/11-testing-strategy.md §4).
 */
import type { DietHistoryEntry } from "@/models/diet";
import type { SessionSummaryData } from "@/models/session";
import type { BodyLogEntry, WorkoutLogEntry } from "@/models/workout";
import type { GozlinCheckin, GozlinEpisode } from "@/services/gozlin/gozlin.types";
import type { WaterHistoryEntry } from "@/services/OfflineStorage";

import { LEGACY } from "../../platform/storage/keys";
import type { KeyValueStore } from "../../platform/storage/KeyValueStore";

export interface LegacyFixture {
  diet?: DietHistoryEntry[];
  water?: WaterHistoryEntry[];
  workouts?: WorkoutLogEntry[];
  sessions?: SessionSummaryData[];
  body?: BodyLogEntry[];
  checkins?: GozlinCheckin[];
  episodes?: GozlinEpisode[];
}

/** The event counts migration 001 should produce from a fixture (for exact assertions). */
export interface ExpectedCounts {
  total: number;
  byType: Record<string, number>;
  partitions: number;
}

function session(
  id: string,
  date: string,
  label: string,
): SessionSummaryData {
  return {
    sessionRunId: id,
    workoutSessionId: `ws-${id}`,
    sessionLabel: label,
    date,
    exerciseResults: [],
    totalExercises: 6,
    exercisesCompleted: 5,
    totalSets: 18,
    setsCompleted: 15,
    totalReps: 120,
    durationSeconds: 1800,
    caloriesBurned: 200,
    completionPercent: 83,
    completedAt: `${date}T08:30:00+01:00`,
  };
}

function workout(id: string, date: string, label: string): WorkoutLogEntry {
  return {
    id,
    date,
    sessionId: `ws-${id}`,
    sessionLabel: label,
    exercisesCompleted: 5,
    totalExercises: 6,
    completionPercent: 83,
    durationMinutes: 30,
    completedAt: `${date}T08:00:00+01:00`,
  };
}

// ── LIGHT: a single week, one of each silo ──────────────────────────────
export const lightUser: LegacyFixture = {
  diet: [
    {
      date: "2026-06-25",
      dietId: "med",
      dietName: "Mediterranean",
      mealsConsumed: 3,
      totalMeals: 3,
      status: "completed",
      consumedCalories: 2000,
      consumedProteinG: 120,
      consumedCarbsG: 200,
      consumedFatG: 60,
      consumedMeals: ["Oatmeal", "Chicken salad", "Salmon"],
      skippedMeals: [],
    },
    {
      date: "2026-06-26",
      dietId: "med",
      dietName: "Mediterranean",
      mealsConsumed: 2,
      totalMeals: 3,
      status: "partial",
      consumedMeals: ["Eggs", "Rice bowl"],
      skippedMeals: ["Steak"],
    },
    {
      date: "2026-06-27",
      dietId: "med",
      dietName: "Mediterranean",
      mealsConsumed: 0,
      totalMeals: 3,
      status: "skipped",
      consumedMeals: [],
      skippedMeals: ["Toast", "Soup", "Pasta"],
    },
  ],
  water: [
    { date: "2026-06-25", ml: 2500, goalMl: 2500 },
    { date: "2026-06-26", ml: 1800, goalMl: 2500 },
  ],
  workouts: [workout("w1", "2026-06-25", "Push")],
  sessions: [session("r1", "2026-06-25", "Push")],
  body: [{ date: "2026-06-25", weightKg: 78, waistCm: 84 }],
  checkins: [
    { date: "2026-06-25", mood: 4, energy: 4, stress: 2, sleepHours: 7, createdAt: 1_750_000_000_000 },
  ],
  episodes: [
    { id: "e1", date: "2026-06-25", summary: "First 3-day streak", kind: "milestone" },
  ],
};

export const lightExpected: ExpectedCounts = {
  // day.closed 3 + meal.logged 5 + meal.skipped 4 + water 2 + workout 1 + session 1
  // + body 1 + checkin 1 + episode 1
  total: 19,
  byType: {
    "nutrition.day.closed": 3,
    "nutrition.meal.logged": 5,
    "nutrition.meal.skipped": 4,
    "hydration.day.closed": 2,
    "workout.session.completed": 1,
    "workout.session.summary": 1,
    "body.measurement.logged": 1,
    "checkin.logged": 1,
    "coach.episode": 1,
  },
  partitions: 1, // all in 2026-06
};

// ── HEAVY: spans two months (tests partitioning) ────────────────────────
function fullDay(date: string): DietHistoryEntry {
  return {
    date,
    dietId: "bal",
    dietName: "Balanced",
    mealsConsumed: 3,
    totalMeals: 3,
    status: "completed",
    consumedMeals: ["Breakfast", "Lunch", "Dinner"],
    skippedMeals: [],
  };
}
export const heavyUser: LegacyFixture = {
  diet: [
    fullDay("2026-05-30"),
    fullDay("2026-05-31"),
    fullDay("2026-06-01"),
    fullDay("2026-06-02"),
  ],
  water: [
    { date: "2026-05-30", ml: 2400, goalMl: 2500 },
    { date: "2026-05-31", ml: 2600, goalMl: 2500 },
    { date: "2026-06-01", ml: 2500, goalMl: 2500 },
    { date: "2026-06-02", ml: 2200, goalMl: 2500 },
  ],
  workouts: [workout("w2", "2026-05-30", "Lower"), workout("w3", "2026-06-01", "Upper")],
  sessions: [session("r2", "2026-05-30", "Lower"), session("r3", "2026-06-01", "Upper")],
  body: [
    { date: "2026-05-30", weightKg: 80 },
    { date: "2026-06-01", weightKg: 79.4 },
  ],
  episodes: [{ id: "e2", date: "2026-06-01", summary: "Best week yet", kind: "win" }],
};
export const heavyExpected: ExpectedCounts = {
  // day.closed 4 + meal.logged 12 + water 4 + workout 2 + session 2 + body 2 + episode 1
  total: 4 + 12 + 4 + 2 + 2 + 2 + 1,
  byType: {
    "nutrition.day.closed": 4,
    "nutrition.meal.logged": 12,
    "hydration.day.closed": 4,
    "workout.session.completed": 2,
    "workout.session.summary": 2,
    "body.measurement.logged": 2,
    "coach.episode": 1,
  },
  partitions: 2, // 2026-05 + 2026-06
};

// ── EDGE: missing optionals + an invalid (date-less) record that must be skipped ──
export const edgeUser: LegacyFixture = {
  diet: [
    // valid, but no macros / no meal-name arrays at all
    {
      date: "2026-06-10",
      dietId: "x",
      dietName: "Plan X",
      mealsConsumed: 0,
      totalMeals: 2,
      status: "partial",
    },
    // invalid: empty date → must be skipped by the migration
    {
      date: "",
      dietId: "y",
      dietName: "Plan Y",
      mealsConsumed: 0,
      totalMeals: 0,
      status: "skipped",
    },
  ],
  water: [{ date: "2026-06-10", ml: 500 }], // no goalMl → metGoal false
  body: [{ date: "2026-06-10", weightKg: 80 }],
  checkins: [{ date: "2026-06-10", createdAt: 0 }], // minimal: no mood/energy/etc.
};
export const edgeExpected: ExpectedCounts = {
  // only the valid diet day closes; no meals; water 1; body 1; checkin 1
  total: 1 + 1 + 1 + 1,
  byType: {
    "nutrition.day.closed": 1,
    "hydration.day.closed": 1,
    "body.measurement.logged": 1,
    "checkin.logged": 1,
  },
  partitions: 1,
};

// ── FRESH: brand-new install, nothing logged ────────────────────────────
export const freshUser: LegacyFixture = {};
export const freshExpected: ExpectedCounts = { total: 0, byType: {}, partitions: 0 };

/** Seed a store with a fixture under the legacy silo keys. */
export async function seed(store: KeyValueStore, f: LegacyFixture): Promise<void> {
  if (f.diet) await store.set(LEGACY.DIET_HISTORY, f.diet);
  if (f.water) await store.set(LEGACY.WATER_HISTORY, f.water);
  if (f.workouts) await store.set(LEGACY.WORKOUT_LOG, f.workouts);
  if (f.sessions) await store.set(LEGACY.SESSION_HISTORY, f.sessions);
  if (f.body) await store.set(LEGACY.BODY_LOGS, f.body);
  if (f.checkins) await store.set(LEGACY.GOZLIN_CHECKINS, f.checkins);
  if (f.episodes) await store.set(LEGACY.GOZLIN_EPISODIC, f.episodes);
}
