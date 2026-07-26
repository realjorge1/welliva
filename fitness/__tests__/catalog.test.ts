/**
 * Workout catalog integrity + the guided-session param contract.
 *
 * These tests are the library's safety net: every authored workout must be
 * fully playable by the EXISTING player (all ids resolvable, no duplicate
 * exercises, comma-safe reps) and honestly described (sane durations).
 */

import { describe, expect, it } from "vitest";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { COACHES } from "@/fitness/data/coaches";
import { BEATS } from "@/fitness/data/beatMeta";
import { WORKOUTS } from "@/fitness/data/workouts";
import {
  filterWorkouts,
  flattenWorkout,
  getAllWorkouts,
  getWorkout,
  workoutFitsEquipment,
  workoutFromSessionId,
  workoutMatchesQuery,
  workoutSuitability,
  workoutToPlayerParams,
} from "@/fitness/services/WorkoutCatalog";
import type { UserBio } from "@/models/user";

const DB_IDS = new Set(EXERCISE_DATABASE.map((e) => e.id));
const COACH_IDS = new Set(COACHES.map((c) => c.id));
const BEAT_IDS = new Set(BEATS.map((b) => b.id));

const BIO: UserBio = {
  age: 30,
  sex: "male",
  heightCm: 178,
  weightKg: 78,
  activityLevel: "moderate",
  exerciseLevel: "intermediate",
  primaryGoal: "build_muscle",
  dietaryRestriction: "none",
  allergies: [],
  medicalConditions: [],
  mealsPerDay: 3,
  equipment: ["none", "dumbbells"],
};

describe("workout library integrity", () => {
  it("has unique workout ids", () => {
    const ids = WORKOUTS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references only exercises that exist in EXERCISE_DATABASE", () => {
    for (const w of WORKOUTS) {
      for (const item of [...w.warmup, ...w.main, ...w.cooldown]) {
        expect(DB_IDS.has(item.exerciseId), `${w.id} → ${item.exerciseId}`).toBe(true);
      }
    }
  });

  it("never repeats an exercise within one workout (player keys results by id)", () => {
    for (const w of WORKOUTS) {
      const ids = [...w.warmup, ...w.main, ...w.cooldown].map((i) => i.exerciseId);
      expect(new Set(ids).size, w.id).toBe(ids.length);
    }
  });

  it("uses valid coach ids and beat ids", () => {
    for (const w of WORKOUTS) {
      expect(COACH_IDS.has(w.coachId), w.id).toBe(true);
      if (w.suggestedBeatId) expect(BEAT_IDS.has(w.suggestedBeatId), w.id).toBe(true);
    }
  });

  it("has a warm-up, a main block and a cool-down in every workout", () => {
    for (const w of WORKOUTS) {
      expect(w.warmup.length, w.id).toBeGreaterThan(0);
      expect(w.main.length, w.id).toBeGreaterThan(0);
      expect(w.cooldown.length, w.id).toBeGreaterThan(0);
    }
  });

  it("estimates believable durations (5–55 min)", () => {
    for (const w of getAllWorkouts()) {
      expect(w.durationMinutes, w.id).toBeGreaterThanOrEqual(5);
      expect(w.durationMinutes, w.id).toBeLessThanOrEqual(55);
    }
  });

  it("derives equipment + muscles + calories for every workout", () => {
    for (const w of getAllWorkouts()) {
      expect(w.targetMuscles.length, w.id).toBeGreaterThan(0);
      expect(w.estimatedCalories, w.id).toBeGreaterThan(0);
    }
  });

  it("offers a 70+ session catalog with every style represented", () => {
    expect(WORKOUTS.length).toBeGreaterThanOrEqual(70);
    const styles = new Set(WORKOUTS.map((w) => w.style));
    for (const s of [
      "strength",
      "hiit",
      "cardio",
      "core",
      "endurance",
      "power",
      "mobility",
      "recovery",
    ]) {
      expect(styles.has(s as never), `style ${s} missing`).toBe(true);
    }
  });

  /**
   * The thumbnail glyph must READ as the workout's activity — not just be
   * unique. (An earlier "every icon unique" rule optimized for no-collisions
   * and, once the on-theme icons ran out, forced nonsense like a gift on a
   * recovery flow.) Icons are chosen for meaning and freely reused within a
   * category; the tile stays visually distinct via 10 hues × 4 patterns.
   * Each list is an on-theme vocabulary for that training style — a new
   * workout must pick a glyph that belongs to its style here, keeping the
   * catalog honest as it grows.
   */
  const STYLE_ICONS: Record<string, readonly string[]> = {
    strength: [
      "barbell", "barbell-outline", "fitness", "body", "walk", "bicycle",
      "hammer", "construct", "home", "bed", "trending-up", "medal", "link",
      "hand-right", "shield",
    ],
    core: [
      "body", "shield", "shield-half", "fitness", "flame", "grid", "apps",
      "flask", "heart-circle",
    ],
    cardio: [
      "pulse", "heart", "flame", "bonfire", "flash", "footsteps", "shuffle",
      "walk", "hand-right", "happy", "stopwatch", "speedometer", "bicycle",
      "sunny", "partly-sunny", "bulb", "cloud", "cog", "infinite", "play-circle",
    ],
    hiit: [
      "flame", "bonfire", "flash", "timer", "stopwatch", "hourglass",
      "speedometer", "stats-chart", "grid", "cellular", "rocket", "flag",
      "barbell", "repeat", "reload", "sync", "alarm", "watch", "cafe", "bulb",
      "walk",
    ],
    endurance: [
      "pulse", "infinite", "cog", "trophy", "layers", "hourglass",
      "speedometer", "walk", "bicycle", "footsteps", "refresh", "sync",
    ],
    power: [
      "rocket", "flash", "flame", "sparkles", "star", "footsteps", "barbell",
      "diamond", "trending-up", "nuclear",
    ],
    mobility: [
      "body", "accessibility", "expand", "resize", "sync", "leaf", "water",
      "key", "sunny", "partly-sunny", "desktop", "laptop-outline", "heart",
      "refresh",
    ],
    recovery: [
      "moon", "bed", "leaf", "water", "snow", "rainy", "cloudy", "cloudy-night",
      "refresh", "refresh-circle", "bandage", "rose", "heart", "hourglass",
      "walk", "pulse",
    ],
  };

  it("uses an on-theme glyph for each workout's training style", () => {
    for (const w of WORKOUTS) {
      const allowed = STYLE_ICONS[w.style];
      expect(allowed, `no icon vocabulary for style "${w.style}"`).toBeTruthy();
      expect(
        allowed.includes(w.art.icon),
        `icon "${w.art.icon}" is off-theme for ${w.style} workout "${w.id}" — pick from STYLE_ICONS.${w.style}`,
      ).toBe(true);
    }
  });

  it("never renders two visually identical tiles (same icon+hue+pattern)", () => {
    const triples = new Set<string>();
    for (const w of WORKOUTS) {
      const triple = `${w.art.icon}#${w.art.hue}#${w.art.pattern ?? "orbit"}`;
      expect(triples.has(triple), `duplicate art tile ${triple} (${w.id})`).toBe(false);
      triples.add(triple);
    }
  });
});

describe("guided-session param contract", () => {
  it("produces comma-safe CSV params that round-trip to the same exercises", () => {
    for (const w of WORKOUTS) {
      const flat = flattenWorkout(w);
      const params = workoutToPlayerParams(w);

      // No reps value may contain a comma, or the player's CSV parse breaks.
      for (const item of flat) expect(item.reps).not.toContain(",");

      const ids = params.exerciseIds.split(",");
      const sets = params.sets.split(",").map(Number);
      const reps = params.reps.split(",");
      expect(ids).toEqual(flat.map((i) => i.exercise.id));
      expect(sets).toEqual(flat.map((i) => i.sets));
      expect(reps).toEqual(flat.map((i) => i.reps));
      expect(params.workoutSessionId).toBe(`lib_${w.id}`);
    }
  });

  it("maps session ids back to workouts", () => {
    expect(workoutFromSessionId("lib_sweat-twelve")?.id).toBe("sweat-twelve");
    expect(workoutFromSessionId("plan_session_1")).toBeNull();
  });
});

describe("search & filter", () => {
  it("finds workouts by name, tag, coach and muscle", () => {
    const all = getAllWorkouts();
    const byName = all.filter((w) => workoutMatchesQuery(w, "sweat"));
    expect(byName.map((w) => w.id)).toContain("sweat-twelve");

    const byCoach = all.filter((w) => workoutMatchesQuery(w, "ivy"));
    expect(byCoach.length).toBeGreaterThan(0);
    expect(byCoach.every((w) => w.coachId === "ivy")).toBe(true);

    const byMuscle = all.filter((w) => workoutMatchesQuery(w, "glutes"));
    expect(byMuscle.map((w) => w.id)).toContain("glute-architect");
  });

  it("filters by style, difficulty and duration together", () => {
    const result = filterWorkouts({ style: "strength", difficulty: "beginner", maxMinutes: 30 });
    expect(result.length).toBeGreaterThan(0);
    for (const w of result) {
      expect(w.style).toBe("strength");
      expect(w.difficulty).toBe("beginner");
      expect(w.durationMinutes).toBeLessThanOrEqual(30);
    }
  });

  it("equipment filtering excludes kit the user does not own", () => {
    const kettlebell = getWorkout("kettlebell-charge")!;
    expect(workoutFitsEquipment(kettlebell, ["none"])).toBe(false);
    expect(workoutFitsEquipment(kettlebell, ["kettlebell"])).toBe(true);

    const bodyweightOnly = filterWorkouts({ equipment: ["none"] });
    for (const w of bodyweightOnly) expect(w.equipment).toEqual([]);
  });

  it("favorites-only returns exactly the favorites", () => {
    const favs = filterWorkouts({ favoritesOnly: true }, ["morning-ignition"]);
    expect(favs.map((w) => w.id)).toEqual(["morning-ignition"]);
  });
});

describe("personal suitability", () => {
  it("scores a whole workout for a user and surfaces cautions on injury", () => {
    const w = getWorkout("upper-forge")!;
    const healthy = workoutSuitability(w, BIO);
    expect(healthy.percent).toBeGreaterThan(80);
    expect(healthy.cautions).toEqual([]);

    const injured = workoutSuitability(w, { ...BIO, injuries: ["shoulder"] });
    expect(injured.percent).toBeLessThan(healthy.percent);
    expect(injured.cautions.length).toBeGreaterThan(0);
  });
});
