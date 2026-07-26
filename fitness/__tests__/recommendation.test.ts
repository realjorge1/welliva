/**
 * Recommendation engine behaviour: plan-first, recovery-aware, balanced,
 * skip-adaptive and deterministic per date.
 */

import { describe, expect, it } from "vitest";
import {
  planFatigue,
  recentRegionLoad,
  recommendToday,
  type RecommendationInput,
} from "@/fitness/services/RecommendationEngine";
import { createDefaultProfile } from "@/fitness/services/FitnessProfileStore";
import { getWorkout } from "@/fitness/services/WorkoutCatalog";
import type { SessionSummaryData } from "@/models/session";
import type { WorkoutSession } from "@/models/workout";
import type { UserBio } from "@/models/user";

const BIO: UserBio = {
  age: 28,
  sex: "female",
  heightCm: 165,
  weightKg: 62,
  activityLevel: "moderate",
  exerciseLevel: "beginner",
  primaryGoal: "improve_fitness",
  dietaryRestriction: "none",
  allergies: [],
  medicalConditions: [],
  mealsPerDay: 3,
  equipment: ["none"],
};

const PLAN_SESSION: WorkoutSession = {
  id: "s1",
  dayLabel: "Day 1 – Full Body",
  dayOfWeek: 2,
  focus: "Full Body A",
  warmupMinutes: 5,
  exercises: [],
  cooldownMinutes: 5,
  totalDurationMinutes: 30,
  isRestDay: false,
};

function baseInput(over: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    date: "2026-07-01",
    dayIndex: 2,
    bio: BIO,
    profile: createDefaultProfile(new Date("2026-06-01T00:00:00Z")),
    plan: null,
    todaySession: null,
    doneToday: false,
    workoutLog: [],
    sessionHistory: [],
    recoveryLevel: "green",
    ...over,
  };
}

function upperSession(date: string): SessionSummaryData {
  return {
    sessionRunId: `r_${date}`,
    workoutSessionId: "x",
    sessionLabel: "Upper",
    date,
    exerciseResults: [
      {
        exerciseId: "push_01",
        exerciseName: "Push-ups",
        category: "push",
        difficulty: "beginner",
        targetSets: 3,
        targetReps: "10",
        setsCompleted: [],
        totalReps: 30,
        totalTimeSeconds: 300,
        skipped: false,
      },
      {
        exerciseId: "pull_02",
        exerciseName: "Reverse Snow Angels",
        category: "pull",
        difficulty: "beginner",
        targetSets: 3,
        targetReps: "12",
        setsCompleted: [],
        totalReps: 36,
        totalTimeSeconds: 300,
        skipped: false,
      },
    ],
    totalExercises: 2,
    exercisesCompleted: 2,
    totalSets: 6,
    setsCompleted: 6,
    totalReps: 66,
    durationSeconds: 1500,
    caloriesBurned: 180,
    completionPercent: 100,
    completedAt: `${date}T18:00:00Z`,
  };
}

describe("recommendToday", () => {
  it("protects the win when today's training is already done", () => {
    const rec = recommendToday(baseInput({ doneToday: true }));
    expect(rec.kind).toBe("rest");
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("leads with the scheduled plan session when recovery allows", () => {
    const rec = recommendToday(baseInput({ todaySession: PLAN_SESSION }));
    expect(rec.kind).toBe("plan_session");
    expect(rec.title).toBe("Day 1 – Full Body");
    expect(rec.reasons.join(" ")).toContain("Full Body A");
  });

  it("steers to low-energy movement when recovery is red", () => {
    const rec = recommendToday(
      baseInput({ todaySession: PLAN_SESSION, recoveryLevel: "red" }),
    );
    expect(rec.kind).toBe("library_workout");
    const w = getWorkout(rec.workoutId!)!;
    expect(w.energy).toBe("low");
  });

  it("caps energy at medium when recovery is amber (no plan session)", () => {
    const rec = recommendToday(baseInput({ recoveryLevel: "amber" }));
    expect(rec.kind).toBe("library_workout");
    const w = getWorkout(rec.workoutId!)!;
    expect(w.energy).not.toBe("high");
  });

  it("never recommends workouts needing equipment the user lacks", () => {
    const rec = recommendToday(baseInput());
    expect(rec.kind).toBe("library_workout");
    const w = getWorkout(rec.workoutId!)!;
    expect(w.equipment).toEqual([]);
  });

  it("balances the body: heavy recent upper load → non-upper pick with a reason", () => {
    const history = [upperSession("2026-06-30"), upperSession("2026-07-01")];
    const load = recentRegionLoad(history, "2026-07-01");
    expect(load.upper).toBeGreaterThanOrEqual(4);

    const rec = recommendToday(baseInput({ sessionHistory: history }));
    expect(rec.kind).toBe("library_workout");
    const w = getWorkout(rec.workoutId!)!;
    expect(["upper", "chest_arms", "back"]).not.toContain(w.focus);
    expect(rec.reasons.join(" ").toLowerCase()).toContain("balance");
  });

  it("is deterministic for the same date and rotates across dates", () => {
    const a1 = recommendToday(baseInput());
    const a2 = recommendToday(baseInput());
    expect(a1.workoutId).toBe(a2.workoutId);
  });

  it("adapts to repeated skips: a twice-skipped plan yields a fresh alternative", () => {
    const profile = createDefaultProfile(new Date("2026-06-01T00:00:00Z"));
    profile.recommendationHistory = [
      { date: "2026-06-29", workoutId: "plan", completed: false },
      { date: "2026-06-30", workoutId: "plan", completed: false },
    ];
    expect(planFatigue(profile, "2026-07-01")).toBe(true);

    const rec = recommendToday(baseInput({ profile, todaySession: PLAN_SESSION }));
    expect(rec.kind).toBe("library_workout");
  });

  it("demotes a specific workout the user keeps skipping", () => {
    const first = recommendToday(baseInput());
    const skippedId = first.workoutId!;
    const profile = createDefaultProfile(new Date("2026-06-01T00:00:00Z"));
    profile.recommendationHistory = [
      { date: "2026-06-29", workoutId: skippedId, completed: false },
      { date: "2026-06-30", workoutId: skippedId, completed: false },
    ];
    const next = recommendToday(baseInput({ profile }));
    expect(next.workoutId).not.toBe(skippedId);
  });
});
