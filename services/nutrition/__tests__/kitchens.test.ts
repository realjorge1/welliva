/**
 * THE ASIAN AND WEST-AFRICAN KITCHENS — every placement held to its rule.
 *
 * A dish placed into a plan is served to whoever follows that plan, and nothing
 * at serve time re-checks the PLAN's premise: the restriction filter reads the
 * USER's restriction, not the diet's. So the premise is checked here, once, for
 * every dish (constants/MealLibrary.ts, KITCHEN_MEALS / KITCHEN_SNACKS):
 * a vegan plan's dishes pass the vegan name check, a keto plan's keep carbs at
 * ≤12% of energy, a diabetic plan's stay moderate — and every macro line adds
 * up to the calories it claims.
 */
import { describe, expect, it } from "vitest";
import { DIET_DATABASE, type MealCuisine } from "../../../constants/DietDatabase";
import { KITCHEN_MEALS, KITCHEN_SNACKS } from "../../../constants/MealLibrary";
import type { DietaryRestriction } from "../../../models/user";
import { breaksRestriction, dishKey, dishTitle, mealCuisine } from "../mealRules";

type Range = { min: number; max: number };
interface Dish {
  name: string;
  calories: Range;
  protein?: Range;
  carbs?: Range;
  fat?: Range;
  cuisine?: MealCuisine;
  isNigerian?: boolean;
  diets: string[];
  snack: boolean;
}

const mid = (r: Range) => (r.min + r.max) / 2;
const DISHES: Dish[] = [
  ...KITCHEN_MEALS.map((m) => ({ ...m, snack: false })),
  ...KITCHEN_SNACKS.map((s) => ({ ...s, snack: true })),
];

/** Energy shares of what the macros account for. */
function shares(d: Dish) {
  const p = 4 * mid(d.protein!);
  const c = 4 * mid(d.carbs!);
  const f = 9 * mid(d.fat!);
  const total = p + c + f;
  return { p: p / total, c: c / total, f: f / total, total };
}

describe("every new dish", () => {
  it("carries full macros that add up to its calories (within 12%)", () => {
    for (const d of DISHES) {
      expect(d.protein && d.carbs && d.fat, d.name).toBeTruthy();
      const { total } = shares(d);
      expect(Math.abs(total - mid(d.calories)) / mid(d.calories), d.name).toBeLessThanOrEqual(0.12);
      for (const r of [d.calories, d.protein!, d.carbs!, d.fat!]) {
        expect(r.min, d.name).toBeLessThanOrEqual(r.max);
      }
    }
  });

  it("is new — no name already in the bundled catalog, and none twice", () => {
    const names = DISHES.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("titles cleanly: the bracketed detail is for the checks, not the screen", () => {
    for (const d of DISHES) expect(dishTitle(d.name), d.name).not.toMatch(/[()]/);
  });

  it("names the kitchen it is placed in", () => {
    for (const d of DISHES) {
      if (d.diets.includes("traditional-asian")) expect(mealCuisine(d), d.name).toBe("Asian");
      if (d.diets.includes("traditional-african")) expect(mealCuisine(d), d.name).toBe("Nigerian");
    }
  });
});

describe("every placement keeps its plan's promise", () => {
  const restricted: [string, DietaryRestriction][] = [
    ["vegan", "vegan"],
    ["whole-food-plant-based", "vegan"],
    ["vegetarian", "vegetarian"],
    ["pescatarian", "pescatarian"],
    ["halal", "halal"],
    ["kosher", "kosher"],
    ["gluten-free", "gluten_free"],
    ["gluten-free-lifestyle", "gluten_free"],
  ];

  it("passes the name check of every restriction plan it is placed in", () => {
    for (const d of DISHES) {
      for (const [dietId, restriction] of restricted) {
        if (!d.diets.includes(dietId)) continue;
        expect(breaksRestriction(d.name, restriction), `${d.name} → ${dietId}`).toBe(false);
      }
    }
  });

  it("keeps keto plans keto: carbs ≤ 12% and fat ≥ 60% of energy", () => {
    for (const d of DISHES.filter((x) => x.diets.includes("keto"))) {
      const s = shares(d);
      expect(s.c, d.name).toBeLessThanOrEqual(0.12);
      expect(s.f, d.name).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("keeps low-carb plans low-carb: carbs ≤ 30% of energy", () => {
    for (const d of DISHES.filter((x) => x.diets.includes("low-carb"))) {
      expect(shares(d).c, d.name).toBeLessThanOrEqual(0.3);
    }
  });

  it("keeps glycaemic plans moderate: ≤ 50 g carbs at ≤ 50% of energy (snacks ≤ 20 g)", () => {
    for (const d of DISHES.filter((x) => x.diets.includes("diabetic-friendly"))) {
      if (d.snack) {
        expect(mid(d.carbs!), d.name).toBeLessThanOrEqual(20);
      } else {
        expect(mid(d.carbs!), d.name).toBeLessThanOrEqual(50);
        expect(shares(d).c, d.name).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("feeds high-protein plans protein: ≥ 25% of energy or ≥ 30 g", () => {
    for (const d of DISHES.filter((x) => x.diets.includes("high-protein"))) {
      expect(shares(d).p >= 0.25 || mid(d.protein!) >= 30, d.name).toBe(true);
    }
  });

  it("gives weight-gain plans a real plate: ≥ 500 kcal", () => {
    for (const d of DISHES.filter((x) => x.diets.includes("weight-gain") && !x.snack)) {
      expect(mid(d.calories), d.name).toBeGreaterThanOrEqual(500);
    }
  });
});

describe("what the kitchens add", () => {
  const diet = (id: string) => DIET_DATABASE.find((d) => d.id === id)!;
  const dishes = (options: { name: string; cuisine?: MealCuisine; isNigerian?: boolean }[], cuisine: MealCuisine) =>
    new Set(options.filter((o) => mealCuisine(o) === cuisine).map((o) => dishKey(o.name))).size;

  it("gives the Asian plan a week of every meal", () => {
    const asian = diet("traditional-asian");
    for (const slot of ["breakfastOptions", "lunchOptions", "dinnerOptions"] as const) {
      expect(dishes(asian[slot], "Asian"), slot).toBeGreaterThanOrEqual(7);
    }
    expect(asian.snackOptions.length).toBeGreaterThanOrEqual(5);
  });

  it("gives an African vegetarian far more than three of each meal", () => {
    // The vegetarian plan's own African dishes were 3 breakfasts, 3 lunches and
    // 3 dinners — the rotation could only ever repeat them.
    const veg = diet("vegetarian");
    expect(dishes(veg.breakfastOptions, "Nigerian")).toBeGreaterThanOrEqual(8);
    expect(dishes(veg.lunchOptions, "Nigerian")).toBeGreaterThanOrEqual(8);
    expect(dishes(veg.dinnerOptions, "Nigerian")).toBeGreaterThanOrEqual(8);
  });

  it("gives an Asian vegan real meals, not just the vegetarian ones", () => {
    const vegan = diet("vegan");
    for (const slot of ["breakfastOptions", "lunchOptions", "dinnerOptions"] as const) {
      expect(dishes(vegan[slot], "Asian"), slot).toBeGreaterThanOrEqual(4);
    }
  });
});
