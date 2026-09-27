import { describe, expect, it } from "vitest";
import { EXERCISE_DATABASE } from "../../../../constants/ExerciseDatabase";
import { EXERCISE_FAMILY } from "../exerciseFamilies";
import { familyByRules, mentionsSubject, normalizeName, subjectFor } from "../subjects";

describe("the family table", () => {
  it("covers every catalog exercise — a new one without a family fails here", () => {
    const missing = EXERCISE_DATABASE.filter((e) => !EXERCISE_FAMILY[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("agrees with the name rules wherever a rule fires on a catalog name", () => {
    // The rules are what an AI plan's unknown exercise is judged by. If they
    // disagreed with the table on the catalog's own names, the same movement
    // would be one family from the library and another from an AI plan.
    const disagreements = EXERCISE_DATABASE.filter((e) => e.category !== "flexibility")
      .map((e) => ({ id: e.id, name: e.name, table: EXERCISE_FAMILY[e.id], rules: familyByRules(e.name) }))
      .filter((x) => x.rules !== null && x.rules !== x.table);
    expect(disagreements).toEqual([]);
  });
});

describe("subjectFor — the same exercise, whatever id it arrived with", () => {
  const ai = (id: string, name: string) =>
    subjectFor({ exerciseId: id, name, category: "legs", difficulty: "intermediate" });

  it("gives one key to an AI exercise that moved position between plans", () => {
    const week1 = ai("ai_0_2_goblet-squat", "Goblet Squat");
    const week2 = ai("ai_3_0_goblet-squats", "Goblet Squats");
    expect(week1.variantKey).toBe(week2.variantKey);
    expect(week1.familyKey).toBe(week2.familyKey);
  });

  it("maps an AI name onto the catalog entry it is, equipment words aside", () => {
    expect(ai("ai_1_1_x", "Dumbbell Goblet Squat").variantKey).toBe("legs_06");
    expect(ai("ai_1_1_x", "Nordic hamstring curls").variantKey).toBe("hinge_09");
  });

  it("refuses an ambiguous equipment-stripped match rather than guessing", () => {
    // "Dumbbell Rows" and "Resistance Band Rows" both strip to "row".
    const s = subjectFor({ exerciseId: "ai_0_0_band-row", name: "Band Row", category: "pull", difficulty: "beginner" });
    expect(s.variantKey).toBe("ai:band-row");
    expect(s.familyKey).toBe("row");
  });

  it("makes an unknown move its own family — never its movement pattern", () => {
    const s = subjectFor({
      exerciseId: "ai_0_4_turkish-get-up",
      name: "Turkish Get-Up",
      category: "core",
      difficulty: "advanced",
    });
    expect(s.variantKey).toBe("ai:turkish-get-up");
    expect(s.familyKey).toBe("ai:turkish-get-up");
  });

  it("keeps catalog ids as they are, whatever the name says", () => {
    const s = subjectFor({ exerciseId: "push_03", name: "Diamond Push-ups", category: "push", difficulty: "intermediate" });
    expect(s.variantKey).toBe("push_03");
    expect(s.familyKey).toBe("push-up");
  });

  it("normalises the spellings people and models actually use", () => {
    expect(normalizeName("Push-ups")).toBe(normalizeName("pushups"));
    expect(normalizeName("Tricep Dips (chair)")).toBe("tricep dip");
  });
});

describe("mentionsSubject — narrow on purpose", () => {
  const nordic = { label: "Nordic Hamstring Curl", familyKey: "nordic-curl" };
  const pistol = { label: "Pistol Squats", familyKey: "single-leg-squat" };
  const pushup = { label: "Wide Push-ups", familyKey: "push-up" };

  it("hears the exercise by its family's words", () => {
    expect(mentionsSubject("should I do nordic curls again?", nordic)).toBe(true);
    expect(mentionsSubject("more pushups today?", pushup)).toBe(true);
  });

  it("does not hear it in a body part, or in a broader family", () => {
    expect(mentionsSubject("my hamstrings are sore", nordic)).toBe(false);
    expect(mentionsSubject("my squats felt heavy", pistol)).toBe(false);
  });
});
