import { describe, expect, it } from "vitest";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import {
  LEVEL_LABEL,
  LEVEL_RANK,
  PATTERN_HUE,
  PATTERN_LABEL,
  equipmentLabel,
} from "../components/cardCopy";

describe("equipmentLabel", () => {
  it("calls an empty list, or an explicit none, bodyweight", () => {
    expect(equipmentLabel([])).toBe("Bodyweight");
    expect(equipmentLabel(["none"])).toBe("Bodyweight");
  });

  it("names one item, and two as a pair", () => {
    expect(equipmentLabel(["pull_up_bar"])).toBe("Pull-up bar");
    expect(equipmentLabel(["dumbbells", "bench"])).toBe("Dumbbells + bench");
  });

  it("keeps three or more to one short line", () => {
    expect(equipmentLabel(["dumbbells", "bench", "kettlebell"])).toBe("Dumbbells +2");
  });

  it("humanises an id it has no wording for instead of printing the raw id", () => {
    expect(equipmentLabel(["jump_rope"])).toBe("Jump rope");
  });
});

describe("card vocabularies cover the catalogue", () => {
  // A movement family missing from these maps would print its raw id on the
  // card and fall back to the default hue — silently, on one card in 140.
  it("labels and colours every movement family the exercise database uses", () => {
    for (const e of EXERCISE_DATABASE) {
      expect(PATTERN_LABEL[e.movementPattern], e.id).toBeTruthy();
      expect(PATTERN_HUE[e.movementPattern], e.id).toBeTruthy();
      expect(LEVEL_LABEL[e.difficulty], e.id).toBeTruthy();
      expect(LEVEL_RANK[e.difficulty], e.id).toBeGreaterThan(0);
    }
  });
});
