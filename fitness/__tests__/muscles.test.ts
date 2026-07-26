/**
 * Muscle-region mapping — guarantees the MuscleMap body diagram can represent
 * every exercise in the catalog. Adding an exercise with a novel muscle name
 * fails here until it's mapped in constants/muscleRegions.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import {
  BACK_REGIONS,
  FRONT_REGIONS,
  MUSCLE_TO_REGIONS,
  musclesToRegions,
} from "@/constants/muscleRegions";
import { describe, expect, it } from "vitest";

describe("muscle → region mapping", () => {
  it("covers every targetMuscles name in EXERCISE_DATABASE", () => {
    const unmapped = new Set<string>();
    for (const ex of EXERCISE_DATABASE) {
      for (const muscle of ex.targetMuscles) {
        if (!(muscle in MUSCLE_TO_REGIONS)) unmapped.add(muscle);
      }
    }
    expect([...unmapped], "add these to MUSCLE_TO_REGIONS").toEqual([]);
  });

  it("maps every region to a drawable figure (front or back)", () => {
    const drawable = new Set([...FRONT_REGIONS, ...BACK_REGIONS]);
    for (const regions of Object.values(MUSCLE_TO_REGIONS)) {
      for (const region of regions) {
        expect(drawable.has(region), `region ${region} has no figure shapes`).toBe(true);
      }
    }
  });

  it("resolves, dedupes and skips unknown names gracefully", () => {
    const regions = musclesToRegions(["Chest", "Upper Chest", "Totally Novel Muscle", "Triceps"]);
    expect(regions).toContain("chest");
    expect(regions).toContain("triceps");
    expect(regions.filter((r) => r === "chest")).toHaveLength(1);
  });

  it("keeps skill tags (Balance, Agility) off the body map", () => {
    expect(musclesToRegions(["Balance", "Agility"])).toEqual([]);
  });
});
