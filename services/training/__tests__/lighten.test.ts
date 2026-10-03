/**
 * Pro's "lighter today": the same session, eased to a low recovery score —
 * never swapped for something else, and every change said out loud.
 */
import { describe, expect, it } from "vitest";

import { EXERCISE_DATABASE } from "../../../constants/ExerciseDatabase";
import type { UserBio } from "../../../models/user";
import type { WorkoutSession } from "../../../models/workout";
import { lightenSession } from "../lighten";
import { resolveTrainingPrefs } from "../prefs";
import { HIGH_IMPACT } from "../vocabulary";
import { buildTrainingWeek } from "../week";

const bio = {
  age: 28,
  sex: "male",
  heightCm: 180,
  weightKg: 76,
  activityLevel: "active",
  exerciseLevel: "intermediate",
  primaryGoal: "improve_fitness",
  goals: ["improve_fitness", "lose_weight"],
  trainingEnabled: true,
  dietaryRestriction: "none",
  allergies: [],
  medicalConditions: [],
  mealsPerDay: 3,
  equipment: ["none"],
  workoutDaysPerWeek: 3,
} as UserBio;

const plan = buildTrainingWeek({
  bio,
  prefs: resolveTrainingPrefs(bio, null),
  sessions: [],
  weekStart: "2026-10-05",
  today: "2026-10-05",
  pool: EXERCISE_DATABASE,
  now: new Date("2026-10-05T07:00:00.000Z"),
});

const main = (s: WorkoutSession) => s.exercises.filter((e) => (e.block ?? "main") === "main");

describe("lightenSession", () => {
  const full = plan.sessions.find((s) => s.exercises.some((e) => e.role === "finisher"))!;

  it("leaves a green day alone", () => {
    expect(lightenSession(full, { level: "green", score: 88 }, EXERCISE_DATABASE, bio)).toBeNull();
  });

  it("amber: supporting moves drop a set, rests grow, mains keep their sets", () => {
    const out = lightenSession(full, { level: "amber", score: 58 }, EXERCISE_DATABASE, bio)!;
    const before = main(full);
    const after = main(out.session);
    expect(after.length).toBe(before.length);
    after.forEach((e, i) => {
      const was = before[i];
      if (was.role === "main") expect(e.sets).toBe(was.sets);
      else expect(e.sets).toBe(Math.max(1, was.sets - 1));
      expect(e.restSeconds).toBe(Math.min(240, was.restSeconds + 15));
      expect(e.doseReason).toBe("Eased for today's recovery (58/100)");
    });
    expect(out.changes[0]).toBe("Recovery 58/100 — a lighter version of today's session");
    expect(out.session.totalDurationMinutes).toBeLessThan(full.totalDurationMinutes);
  });

  it("red: every move drops a set and finishers go", () => {
    const out = lightenSession(full, { level: "red", score: 31 }, EXERCISE_DATABASE, bio)!;
    expect(main(out.session).some((e) => e.role === "finisher")).toBe(false);
    expect(out.changes).toContain("Finisher left out today");
    expect(out.changes).toContain("One set less on every move");
  });

  it("swaps jumping moves for low-impact ones, and names the swap", () => {
    // A Power day always leads with an explosive move.
    const athlete = { ...bio, primaryGoal: "athletic_performance", goals: ["athletic_performance"] } as UserBio;
    const power = buildTrainingWeek({
      bio: athlete,
      prefs: resolveTrainingPrefs(athlete, null),
      sessions: [],
      weekStart: "2026-10-05",
      today: "2026-10-05",
      pool: EXERCISE_DATABASE,
      now: new Date("2026-10-05T07:00:00.000Z"),
    }).sessions.find((s) => s.dayLabel === "Power")!;
    expect(main(power).some((e) => HIGH_IMPACT.has(e.exerciseId))).toBe(true);
    const out = lightenSession(power, { level: "amber", score: 60 }, EXERCISE_DATABASE, athlete)!;
    expect(main(out.session).filter((e) => HIGH_IMPACT.has(e.exerciseId))).toEqual([]);
    expect(out.changes.some((c) => /jumping moves? swapped for low-impact ones/.test(c))).toBe(true);
    expect(main(out.session).some((e) => /no jumping on a low-recovery day/.test(e.reason ?? ""))).toBe(true);
  });

  it("never touches the warm-up or cool-down", () => {
    const out = lightenSession(full, { level: "red", score: 20 }, EXERCISE_DATABASE, bio)!;
    const edges = (s: WorkoutSession) => s.exercises.filter((e) => e.block !== "main" && e.block !== undefined);
    expect(edges(out.session)).toEqual(edges(full));
  });
});
