/**
 * Muscle emphasis — guarantees every catalogued exercise resolves to a drawable
 * set of activation zones, that explicit muscle names win over the DB lookup,
 * and that the resolver never throws on AI exercises with novel muscle strings.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import {
  regionsToZones,
  resolveEmphasisZones,
  type FigureZone,
} from "@/fitness/animation/muscleEmphasis";
import { describe, expect, it } from "vitest";

const ZONES: readonly FigureZone[] = [
  "shoulder",
  "torsoUpper",
  "torsoLower",
  "upperArm",
  "foreArm",
  "pelvis",
  "thigh",
  "shin",
];

describe("muscle emphasis", () => {
  it("resolves every catalogued exercise to valid zones", () => {
    for (const ex of EXERCISE_DATABASE) {
      const zones = resolveEmphasisZones({ exerciseId: ex.id });
      for (const z of zones) expect(ZONES, `${ex.id} → ${z}`).toContain(z);
      // A resistance/strength move always trains something drawable.
      if (ex.targetMuscles.some((m) => m !== "Balance" && m !== "Agility")) {
        expect(zones.length, ex.id).toBeGreaterThan(0);
      }
    }
  });

  it("dedupes zones (biceps + chest → two zones, not more)", () => {
    const zones = regionsToZones(["biceps", "chest", "biceps"]);
    expect(zones.sort()).toEqual(["torsoUpper", "upperArm"]);
  });

  it("prefers explicit muscles over the DB lookup", () => {
    const zones = resolveEmphasisZones({ muscles: ["Calves"], exerciseId: EXERCISE_DATABASE[0]?.id });
    expect(zones).toEqual(["shin"]);
  });

  it("degrades to an empty set for unknown muscles / unknown ids", () => {
    expect(resolveEmphasisZones({ muscles: ["Unobtainium"] })).toEqual([]);
    expect(resolveEmphasisZones({ exerciseId: "does_not_exist" })).toEqual([]);
    expect(resolveEmphasisZones({})).toEqual([]);
  });
});
