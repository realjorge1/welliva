import { describe, expect, it } from "vitest";
import {
  breaksRestriction,
  cuisineTiers,
  dietNameContradicts,
  dishKey,
  dishTitle,
  hasAllergen,
  hasDislike,
  servesPreference,
  signatureDietFor,
} from "../mealRules";

describe("breaksRestriction", () => {
  it("catches what the name says", () => {
    expect(breaksRestriction("Grilled Fish + Brown Rice (small)", "vegetarian")).toBe(true);
    expect(breaksRestriction("Jollof Rice + Grilled Chicken", "vegetarian")).toBe(true);
    expect(breaksRestriction("Jollof Rice + Grilled Chicken", "pescatarian")).toBe(true);
    expect(breaksRestriction("Grilled Tilapia + Salad", "pescatarian")).toBe(false);
    expect(breaksRestriction("Pap + Milk", "vegan")).toBe(true);
    expect(breaksRestriction("Boiled Yam + Egg Sauce", "vegan")).toBe(true);
    expect(breaksRestriction("Bacon & Eggs", "halal")).toBe(true);
    expect(breaksRestriction("Whole Wheat Bread + Sardines", "gluten_free")).toBe(true);
    expect(breaksRestriction("Semovita + Light Vegetable Soup", "gluten_free")).toBe(true);
    expect(breaksRestriction("Beef Burger + Cheese", "kosher")).toBe(true);
    expect(breaksRestriction("Shrimp Pasta", "kosher")).toBe(true);
  });

  it("does not mistake a lookalike for the thing", () => {
    expect(breaksRestriction("Eggplant & Tomato Stew + Fish", "vegan")).toBe(true); // the fish, not the eggplant
    expect(breaksRestriction("Eggplant Stew", "vegan")).toBe(false);
    expect(breaksRestriction("Garden Egg Stew + Rice", "vegan")).toBe(false);
    expect(breaksRestriction("Toast + Peanut Butter", "dairy_free")).toBe(false);
    expect(breaksRestriction("Pap (Ogi) + Unsweetened Soy Milk", "vegan")).toBe(false);
    expect(breaksRestriction("Butternut Squash Soup", "dairy_free")).toBe(false);
    expect(breaksRestriction("Buckwheat Porridge", "gluten_free")).toBe(false);
  });

  it("reads the catalog's own negations", () => {
    expect(breaksRestriction("Efo Riro (no meat/fish) + Small Swallow", "vegetarian")).toBe(false);
    expect(breaksRestriction("Efo Riro (extra fish/meat, less oil)", "vegetarian")).toBe(true);
    expect(breaksRestriction("Efo Riro (vegan) + Small Swallow", "vegan")).toBe(false);
  });

  it("ends a negation at the comma", () => {
    // "(no swallow, extra fish)" leaves out the swallow, not the fish. Reading on
    // to the bracket stripped the fish too and served this soup to vegetarians.
    expect(breaksRestriction("Okra Soup (no swallow, extra fish)", "vegetarian")).toBe(true);
    expect(breaksRestriction("Protein Smoothie (no banana, no sugar)", "vegan")).toBe(false);
    expect(breaksRestriction("Soft beans porridge (no pepper, little oil)", "vegan")).toBe(false);
  });

  it("never restricts anyone with no restriction", () => {
    expect(breaksRestriction("Pepper Soup (Goat/Fish/Chicken)", "none")).toBe(false);
    expect(breaksRestriction("Pepper Soup (Goat/Fish/Chicken)", undefined)).toBe(false);
  });
});

describe("hasAllergen", () => {
  it("expands a picked allergy to the names a dish uses", () => {
    expect(hasAllergen("Pap + Groundnuts + Banana", ["peanuts"])).toBe(true);
    expect(hasAllergen("Grilled Mackerel + Vegetable Salad", ["fish"])).toBe(true);
    expect(hasAllergen("Moi-Moi + Pap", ["peanuts"])).toBe(false);
  });
  it("matches anything the user typed themselves as written", () => {
    expect(hasAllergen("Okra Soup + Fish + Swallow", ["okra"])).toBe(true);
  });
});

describe("hasDislike", () => {
  it("expands a family to the names a dish uses", () => {
    expect(hasDislike("Cheese Omelet", ["dairy"])).toBe(true);
    expect(hasDislike("Moi-Moi + Pap", ["legume"])).toBe(true);
    expect(hasDislike("Grilled Chicken + Rice", ["red-meat"])).toBe(false);
  });
  it("matches anything else as written", () => {
    expect(hasDislike("Okra Soup + Eba", ["okra"])).toBe(true);
    expect(hasDislike("Okra Soup + Eba", [])).toBe(false);
  });
});

describe("cuisine", () => {
  it("narrows to a kitchen first, then to its neighbours and the staples", () => {
    expect(cuisineTiers("african")).toEqual([["Nigerian"], ["Nigerian", "Universal"]]);
    expect(cuisineTiers("western")).toEqual([["Western"], ["Western", "Mediterranean", "Universal"]]);
    expect(cuisineTiers("mediterranean")).toEqual([["Mediterranean"], ["Mediterranean", "Western", "Universal"]]);
    expect(cuisineTiers("mixed")).toBeNull();
  });

  it("treats untagged Nigerian dishes as Nigerian", () => {
    expect(servesPreference({ isNigerian: true }, "african")).toBe(true);
    expect(servesPreference({ cuisine: "Western" }, "african")).toBe(false);
    expect(servesPreference({ cuisine: "Western" }, "mixed")).toBe(true);
  });
  it("knows which diet names contradict which choice", () => {
    expect(dietNameContradicts("mediterranean", "african")).toBe(true);
    expect(dietNameContradicts("mediterranean", "mediterranean")).toBe(false);
    expect(dietNameContradicts("mediterranean", "mixed")).toBe(false);
    // Neighbouring kitchens don't contradict — the generator already treats them as one family.
    expect(dietNameContradicts("mediterranean", "western")).toBe(false);
    expect(dietNameContradicts("traditional-african", "western")).toBe(true);
    expect(dietNameContradicts("low-carb", "african")).toBe(false);
    expect(signatureDietFor("african")).toBe("traditional-african");
    expect(signatureDietFor("western")).toBeNull();
  });
});

describe("dishes", () => {
  it("groups portions of one dish under one key", () => {
    const k = dishKey("Akara + Pap");
    expect(dishKey("Akara (moderate portion) + Pap")).toBe(k);
    expect(dishKey("Akara (small) + Pap (unsweetened)")).toBe(k);
    expect(dishKey("Beans & Plantain (boiled)")).toBe(dishKey("Beans + Plantain"));
    expect(dishKey("Akara + Egg Sauce")).not.toBe(k);
  });
  it("titles a dish without its portion notes", () => {
    expect(dishTitle("Akara (moderate portion) + Pap")).toBe("Akara + Pap");
    expect(dishTitle("Boiled Yam + Egg Sauce (2 eggs)")).toBe("Boiled Yam + Egg Sauce");
  });
});
