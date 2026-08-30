/**
 * THE MEAL DICTIONARY — the thing the planner's picker had none of.
 *
 * The bug these guard was not a crash. "Choose a meal" opened onto a title and a
 * search box over an empty page, because the picker only ever queried the
 * reference table and only after a keystroke. Nothing threw, nothing logged, and
 * the feature was simply unusable.
 *
 * So the assertions here are mostly assertions that a LIST IS NOT EMPTY, which
 * looks trivial and is exactly the class of failure that shipped. The rest cover
 * the two rules the picker's behaviour hangs off:
 *
 *  · a duplicate row is a wrong row — the same meal is authored into dozens of
 *    diets, and a picker showing "Akara & pap" eleven times is worse than one
 *    showing it none.
 *
 *  · `total === 0` is a CONTRACT, not a detail. It is the single condition that
 *    licenses a paid network lookup (FoodLookupService's local-first rule), so a
 *    search that under-reports its own hits starts spending money on foods we
 *    already have.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  cuisinesForSlot,
  ensureMealCatalogLoaded,
  foodIdeas,
  formatRange,
  hasMealCatalog,
  mealsForSlot,
  MEAL_SLOTS,
  midpoint,
  popularForSlot,
  scaleRange,
  searchMeals,
} from "../MealCatalog";

beforeAll(async () => {
  // Fetches the remote catalogs; both fall back to their bundled seed offline,
  // so this resolves either way and the assertions below hold in both worlds.
  await ensureMealCatalogLoaded();
});

describe("the catalog is browsable before anyone types", () => {
  it("has meals for every slot", () => {
    expect(hasMealCatalog()).toBe(true);
    for (const slot of MEAL_SLOTS) {
      expect(mealsForSlot(slot).length).toBeGreaterThan(0);
    }
  });

  it("offers a real breakfast list, not a handful", () => {
    // The screen this replaced showed zero. Twenty is a floor, not a target.
    expect(mealsForSlot("breakfast").length).toBeGreaterThan(20);
  });

  it("names every meal it lists", () => {
    for (const idea of mealsForSlot("breakfast")) {
      expect(idea.name.trim()).not.toBe("");
      expect(idea.slot).toBe("breakfast");
    }
  });

  it("lists whole foods separately from composed meals", () => {
    const foods = foodIdeas("breakfast");
    expect(foods.length).toBeGreaterThan(0);
    // Stamped for the slot being planned, so a snack food can be a breakfast.
    expect(foods.every((f) => f.slot === "breakfast")).toBe(true);
    expect(foods.every((f) => f.origin === "food")).toBe(true);
  });
});

describe("de-duplication", () => {
  it("shows each meal once per slot, however many diets contain it", () => {
    for (const slot of MEAL_SLOTS) {
      const names = mealsForSlot(slot).map((m) => m.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("keeps every key unique, so list rows can't collide", () => {
    const keys = MEAL_SLOTS.flatMap((s) => mealsForSlot(s)).map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the diets a meal belongs to, rather than dropping them", () => {
    // Merging duplicates is only honest if the merged-away information survives.
    const shared = mealsForSlot("breakfast").find((m) => m.diets.length > 1);
    expect(shared).toBeDefined();
    expect(new Set(shared!.diets).size).toBe(shared!.diets.length);
  });
});

describe("search", () => {
  it("finds a meal by a word inside its name", () => {
    const named = mealsForSlot("breakfast")[0]!;
    const word = named.name.split(/\s+/)[0]!;
    const hits = searchMeals("breakfast", word);
    expect(hits.total).toBeGreaterThan(0);
    expect(hits.inSlot.some((m) => m.name === named.name)).toBe(true);
  });

  it("reaches across slots — nobody minds lunch food at 8am", () => {
    const dinner = mealsForSlot("dinner").find(
      (d) => !mealsForSlot("breakfast").some((b) => b.name === d.name),
    );
    expect(dinner).toBeDefined();
    const hits = searchMeals("breakfast", dinner!.name);
    expect(hits.otherSlots.some((m) => m.name === dinner!.name)).toBe(true);
    // ...and never twice, once via each slot.
    const all = [...hits.inSlot, ...hits.otherSlots].filter(
      (m) => m.name === dinner!.name,
    );
    expect(all.length).toBe(1);
  });

  it("searches the whole-foods catalog too", () => {
    const food = foodIdeas("snack")[0]!;
    const hits = searchMeals("snack", food.name);
    expect(hits.foods.some((f) => f.name === food.name)).toBe(true);
  });

  it("returns nothing for an empty query — browsing is a different mode", () => {
    expect(searchMeals("breakfast", "   ").total).toBe(0);
  });

  it("reports a genuine miss as zero, which is what licenses a paid lookup", () => {
    const hits = searchMeals("breakfast", "zxqwvfjkrb");
    expect(hits.total).toBe(0);
    expect(hits.inSlot).toEqual([]);
    expect(hits.otherSlots).toEqual([]);
    expect(hits.foods).toEqual([]);
  });
});

describe("presentation", () => {
  it("ranks the meals the most plans agree on first", () => {
    const popular = popularForSlot("breakfast", 5);
    expect(popular.length).toBeGreaterThan(0);
    for (let i = 1; i < popular.length; i++) {
      expect(popular[i - 1]!.diets.length).toBeGreaterThanOrEqual(
        popular[i]!.diets.length,
      );
    }
  });

  it("only offers cuisine filters that have something behind them", () => {
    for (const cuisine of cuisinesForSlot("dinner")) {
      expect(mealsForSlot("dinner").some((m) => m.cuisine === cuisine)).toBe(true);
    }
  });

  it("never renders a range as '420–420'", () => {
    expect(formatRange({ min: 420, max: 420 }, "kcal")).toBe("420 kcal");
    expect(formatRange({ min: 380, max: 520 }, "kcal")).toBe("380–520 kcal");
  });

  it("scales a range by servings and keeps the midpoint honest", () => {
    expect(scaleRange({ min: 100, max: 200 }, 2)).toEqual({ min: 200, max: 400 });
    expect(scaleRange({ min: 100, max: 100 }, 0.5)).toEqual({ min: 50, max: 50 });
    expect(midpoint({ min: 380, max: 520 })).toBe(450);
  });
});
