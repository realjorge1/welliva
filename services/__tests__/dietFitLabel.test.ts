/**
 * NO MADE-UP MATCH PERCENTAGES (Fix 11).
 *
 * The diet score starts at 75, adds and subtracts hand-picked points and
 * clamps at 96. It stays as the sort key; what people see is a plain label and
 * the reasons. The swap suggestion's "N% nutrition match" was a weighted
 * closeness with chosen weights; it now states the real difference.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { DietMealOption } from "../../constants/DietDatabase";
import type { ScheduledMeal } from "../../models/diet";
import { dietFitLabel } from "../intelligence/dietFitLabel";
import { alternativeDifference, findMealAlternative } from "../intelligence/NutritionInsightEngine";

describe("the label", () => {
  it("follows DietMatchService's own bands", () => {
    expect(dietFitLabel(96)).toBe("Strong fit");
    expect(dietFitLabel(87)).toBe("Strong fit");
    expect(dietFitLabel(86)).toBe("Good fit");
    expect(dietFitLabel(75)).toBe("Good fit");
    expect(dietFitLabel(74)).toBe("Possible");
  });

  it("trusts a match's own flags over its number", () => {
    expect(dietFitLabel({ score: 80, isRecommended: true })).toBe("Strong fit");
    expect(dietFitLabel({ score: 90, isRecommended: false, isSafeOption: true })).toBe("Good fit");
  });
});

describe("no percent left on a diet-match surface", () => {
  const root = join(__dirname, "..", "..");
  const files = ["app/(tabs)/diet.tsx", "components/onboarding/flow/PlanReveal.tsx"];
  it.each(files)("%s", (file) => {
    const src = readFileSync(join(root, file), "utf8");
    expect(src).not.toMatch(/%\s*match/);
    expect(src).not.toMatch(/\.score\)\}%/);
    expect(src).not.toMatch(/nutrition match`|\}% nutrition/);
    expect(src).not.toMatch(/format=\{\(n\) => `\$\{Math\.round\(n\)\}%`\}/);
  });
});

describe("the swap suggestion says the real difference", () => {
  it("in grams and kcal", () => {
    expect(alternativeDifference({ kcal: -40, proteinG: 12 })).toBe("+12 g protein · 40 kcal less");
    expect(alternativeDifference({ kcal: 65, proteinG: -6 })).toBe("−6 g protein · 65 kcal more");
    expect(alternativeDifference({ kcal: 8, proteinG: 1 })).toBe("About the same calories and protein");
  });

  it("measured against the meal it replaces, at the size it's offered", () => {
    const current: ScheduledMeal = {
      id: "c",
      mealType: "lunch",
      name: "Grilled Chicken Salad",
      calories: { min: 600, max: 600 },
      proteinG: { min: 40, max: 40 },
      carbsG: { min: 40, max: 40 },
      fatG: { min: 25, max: 25 },
      isConsumed: false,
      servings: 1.5,
    };
    const option = (name: string, kcal: number, p: number): DietMealOption =>
      ({ name, calories: { min: kcal, max: kcal }, protein: { min: p, max: p }, carbs: { min: 28, max: 28 }, fat: { min: 17, max: 17 } }) as DietMealOption;
    const alt = findMealAlternative({ options: [option("Turkey Wrap", 400, 30)], current, minMatch: 0.5 })!;
    expect(alt.servings).toBe(1.5);
    expect(alt.delta.kcal).toBeCloseTo(0, 5); // 400 × 1.5 vs 600
    expect(alt.delta.proteinG).toBeCloseTo(5, 5); // 45 vs 40
    expect(alternativeDifference(alt.delta)).toBe("+5 g protein");
  });
});
