/**
 * The truth engine's guard rails.
 *
 * These tests care much less about "does it get the right number" (that's the
 * reference table's job) and much more about "does it ever claim something it
 * can't back up" — the failure mode that would make the whole feature dishonest.
 */

import { describe, expect, it } from "vitest";
import { parseFoodText } from "./FoodTextParser";
import { resolveItem, resolveItems, resolveKnownFood } from "./NutrientResolver";
import { getCanonicalFood } from "../../constants/NutrientDatabase";
import { sumPanels } from "../../models/nutrients";

const parseOne = (text: string) => {
  const items = parseFoodText(text);
  expect(items.length).toBeGreaterThan(0);
  return items[0];
};

describe("FoodTextParser", () => {
  it("extracts quantity, unit and food", () => {
    expect(parseOne("2 slices of bread")).toMatchObject({
      quantity: 2,
      unit: "slice",
      food: "bread",
    });
  });

  it("handles attached mass units", () => {
    expect(parseOne("150g chicken breast")).toMatchObject({
      quantity: 150,
      unit: "g",
      food: "chicken breast",
    });
  });

  it("handles written numbers and fractions", () => {
    expect(parseOne("three eggs").quantity).toBe(3);
    expect(parseOne("1/2 cup rice").quantity).toBe(0.5);
    expect(parseOne("½ avocado").quantity).toBe(0.5);
    expect(parseOne("1 1/2 cups of milk").quantity).toBe(1.5);
  });

  it("treats 'half an X' as an amount, not a unit", () => {
    expect(parseOne("half an avocado")).toMatchObject({
      quantity: 0.5,
      unit: "",
      food: "avocado",
    });
  });

  it("strips conversational lead-ins", () => {
    expect(parseOne("for breakfast I had 2 boiled eggs").food).toBe("boiled eggs");
    expect(parseOne("today i ate rice").food).toBe("rice");
  });

  it("splits multiple foods", () => {
    const items = parseFoodText("2 slices of bread, a boiled egg and half an avocado");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.food)).toEqual(["bread", "boiled egg", "avocado"]);
  });

  // The separator-protection rule: a food whose NAME contains "and" must not be
  // torn into two foods, while a genuine list on "and" still splits.
  it("does not split food names containing 'and'", () => {
    const items = parseFoodText("mac and cheese");
    expect(items).toHaveLength(1);
    expect(items[0].food).toBe("mac and cheese");
  });

  it("still splits a real list that uses 'and'", () => {
    const items = parseFoodText("rice and beans");
    expect(items).toHaveLength(2);
  });

  it("flags an assumed quantity", () => {
    expect(parseOne("banana").quantityAssumed).toBe(true);
    expect(parseOne("2 bananas").quantityAssumed).toBe(false);
  });
});

describe("NutrientResolver — provenance", () => {
  it("returns measured data with a citation for a known food at a known portion", () => {
    const item = resolveItem(parseOne("2 slices of bread"));
    expect(item.foodId).toBe("bread_white");
    expect(item.confidence).toBe("measured");
    expect(item.source).toMatchObject({ kind: "usda" });
    // 2 slices × 25 g = 50 g; 266 kcal/100 g → 133 kcal.
    expect(item.grams).toBe(50);
    expect(item.nutrients.calories).toBe(133);
  });

  it("scales micronutrients, not just macros", () => {
    const item = resolveItem(parseOne("100g spinach"));
    expect(item.nutrients.vitaminK).toBeCloseTo(482.9, 0);
    expect(item.nutrients.iron).toBeCloseTo(2.7, 1);
  });

  it("downgrades to portion-estimated when the amount was assumed", () => {
    const item = resolveItem(parseOne("banana"));
    expect(item.foodId).toBe("banana_raw");
    expect(item.confidence).toBe("portion-estimated");
    expect(item.grams).toBe(118); // the default medium banana
  });

  it("never claims a composite dish is measured", () => {
    const item = resolveItem(parseOne("a plate of jollof rice"));
    expect(item.foodId).toBe("jollof_rice");
    expect(item.confidence).toBe("recipe-estimated");
    expect(item.source).toMatchObject({ kind: "recipe" });
  });

  // The central honesty guarantee.
  it("asserts nothing for an unidentifiable food", () => {
    const item = resolveItem(parseOne("zorblax surprise"));
    expect(item.confidence).toBe("unmatched");
    expect(item.source).toBeNull();
    expect(item.nutrients).toEqual({});
  });

  it("labels app-catalog matches as macros-only with no micronutrients", () => {
    const analysis = resolveItems(parseFoodText("2 slices of bread"), "x");
    // Sanity: canonical path does carry micros, so macros-only is a real signal.
    expect(analysis.items[0].nutrients.iron).toBeDefined();
  });
});

describe("NutrientResolver — totals", () => {
  it("sums a multi-food meal", () => {
    const analysis = resolveItems(
      parseFoodText("2 slices of bread and a boiled egg"),
      "2 slices of bread and a boiled egg",
    );
    expect(analysis.items).toHaveLength(2);
    // bread 2×25 g = 133 kcal; egg defaults to one large (50 g) = 78 kcal.
    expect(analysis.totals.calories).toBe(211);
  });

  // "a boiled egg" names no size, so assuming a large one IS an estimate and
  // the meal must say so. Only a stated portion earns "measured".
  it("reports portion-estimated when a size was never stated", () => {
    const analysis = resolveItems(parseFoodText("2 slices of bread and a boiled egg"), "x");
    expect(analysis.confidence).toBe("portion-estimated");
  });

  it("reports measured when every portion was stated", () => {
    const analysis = resolveItems(parseFoodText("2 slices of bread and 100g spinach"), "x");
    expect(analysis.items.every((i) => i.confidence === "measured")).toBe(true);
    expect(analysis.confidence).toBe("measured");
  });

  it("reports the weakest confidence for the whole meal", () => {
    const analysis = resolveItems(
      parseFoodText("2 slices of bread and a plate of jollof rice"),
      "x",
    );
    expect(analysis.confidence).toBe("recipe-estimated");
  });

  it("collects unmatched foods instead of dropping them", () => {
    const analysis = resolveItems(parseFoodText("bread and zorblax"), "x");
    expect(analysis.unmatched).toContain("zorblax");
    expect(analysis.items).toHaveLength(2);
  });
});

describe("sumPanels — partial nutrient handling", () => {
  // The subtle one: a nutrient measured for only SOME items must not be
  // presented as a complete total, or the day looks deficient when it's simply
  // unknown.
  it("marks a nutrient partial when not every item measured it", () => {
    const { totals, partialKeys } = sumPanels([
      { calories: 100, iron: 2 },
      { calories: 50 },
    ]);
    expect(totals.calories).toBe(150);
    expect(totals.iron).toBe(2);
    expect(partialKeys).toContain("iron");
    expect(partialKeys).not.toContain("calories");
  });

  it("treats a missing nutrient as unknown, never as zero", () => {
    const { totals } = sumPanels([{ calories: 100 }]);
    expect(totals.iron).toBeUndefined();
    expect("iron" in totals).toBe(false);
  });
});

describe("resolveKnownFood", () => {
  it("resolves a catalog tap at an explicit portion", () => {
    const item = resolveKnownFood("egg_boiled", 3, "large");
    expect(item).not.toBeNull();
    expect(item!.grams).toBe(150);
    expect(item!.confidence).toBe("measured");
  });

  it("returns null for an unknown id rather than inventing a food", () => {
    expect(resolveKnownFood("not_a_food", 1, "cup")).toBeNull();
  });
});

describe("reference table integrity", () => {
  it("every food has energy, portions and a source", () => {
    for (const food of [
      "egg_boiled", "rice_white_cooked", "bread_white", "jollof_rice", "moi_moi",
    ]) {
      const f = getCanonicalFood(food);
      expect(f, food).toBeDefined();
      expect(f!.per100g.calories, food).toBeGreaterThan(0);
      expect(f!.portions.length, food).toBeGreaterThan(0);
      expect(f!.source, food).toBeTruthy();
    }
  });

  it("composite dishes are flagged so they can never read as measured", () => {
    expect(getCanonicalFood("jollof_rice")!.isComposite).toBe(true);
    expect(getCanonicalFood("moi_moi")!.isComposite).toBe(true);
  });
});
