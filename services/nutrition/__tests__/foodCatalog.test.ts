/**
 * THE FOODS CATALOG — search, diet suitability, and the catalog→reference climb.
 *
 * These three pieces replaced the Foods screen's guts, and each of them can be
 * wrong in a way the user would never see as a crash:
 *
 *  1. SEARCH quietly returning nothing for a spelling the rest of the app
 *     understands. That was the actual bug: `.includes()` here, fuzzy matching
 *     in the resolver, so "yoghurt" worked in Gozlin and failed in the catalog.
 *
 *  2. The DIET FILTER quietly showing a food it should have hidden. This is the
 *     one that matters — the failure mode is a vegan being offered beef, or a
 *     shellfish allergy being handed crayfish. The interesting cases are the
 *     ones the table can't see: a food it has never heard of, and the offline
 *     seed, which uses different ids AND different group labels than the remote
 *     catalog for the very same foods.
 *
 *  3. The CLIMB from a catalog food to its measured reference entry. When it
 *     works the user gets micronutrients and a citation; when it doesn't they
 *     must get four macros labelled `macros-only` — never a near-miss food's
 *     measured panel presented as this food's.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  FOOD_DICTIONARY,
  isHighProtein,
  isKetoFriendly,
  isLowCalorie,
  searchFoods,
  type FoodItem,
} from "../../../constants/FoodDictionary";
import {
  ALL_FOOD_FILTERS,
  QUICK_FILTER_KEYS,
  applyFoodFilters,
  getFilter,
} from "../../../constants/foodFilters";
import { FOOD_SEED } from "../../../constants/foodSeed";
import {
  excludedTagsFor,
  excludedTermsFor,
  fitsDiet,
  hasDietConstraints,
  tagsFor,
  type FoodTag,
} from "../../../constants/foodTags";
import {
  CATALOG_SERVING_UNIT,
  linkCatalogFood,
  resolveCatalogFood,
} from "../NutrientResolver";

/**
 * FOOD_DICTIONARY is remote + lazy and starts empty, so these tests fill it in
 * place from the bundled seed exactly the way the loader does. That also makes
 * the seed the data under test, which is the point: the seed is what a user on
 * a fresh offline launch actually browses.
 */
beforeAll(() => {
  if (FOOD_DICTIONARY.length === 0) FOOD_DICTIONARY.push(...FOOD_SEED);
});

const food = (overrides: Partial<FoodItem> = {}): FoodItem => ({
  id: "test-food",
  name: "Test Food",
  serving: "1 serving",
  group: "Vegetables",
  calories: 50,
  protein: 2,
  carbs: 8,
  fat: 1,
  ...overrides,
});

// ============================================================================
// SEARCH
// ============================================================================

describe("searchFoods", () => {
  it("returns the whole catalog for an empty query", () => {
    expect(searchFoods("")).toHaveLength(FOOD_DICTIONARY.length);
    expect(searchFoods("   ")).toHaveLength(FOOD_DICTIONARY.length);
  });

  it("finds an exact name", () => {
    expect(searchFoods("banana")[0]?.name).toBe("Banana");
  });

  it("is case insensitive", () => {
    expect(searchFoods("BaNaNa")[0]?.name).toBe("Banana");
  });

  it("ranks the shortest substring match first", () => {
    // "Egg" must beat any longer name that also contains the letters.
    const hits = searchFoods("egg");
    expect(hits[0]?.name).toBe("Egg");
  });

  it("matches the group label, not just the name", () => {
    const hits = searchFoods("vegetable");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((f) => f.group === "Vegetables")).toBe(true);
  });

  /**
   * The regression this rewrite existed for. A plain substring search returns
   * nothing here; the shared scorer resolves it, the same way typing the same
   * word into the food log always did.
   */
  it("survives a spelling the catalog doesn't use", () => {
    const hits = searchFoods("yoghurt");
    expect(hits.map((f) => f.name)).toContain("Greek Yogurt");
  });

  it("survives a plural", () => {
    expect(searchFoods("tomatoes").map((f) => f.name)).toContain("Tomato");
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(searchFoods("qwertyuiop")).toHaveLength(0);
  });

  it("never returns a food twice", () => {
    for (const q of ["egg", "rice", "bean", "milk", "a"]) {
      const ids = searchFoods(q).map((f) => f.id);
      expect(new Set(ids).size, `duplicate result for "${q}"`).toBe(ids.length);
    }
  });
});

// ============================================================================
// MACRO FILTERS
// ============================================================================

describe("macro filters", () => {
  it("applies the thresholds its labels promise", () => {
    expect(isKetoFriendly(food({ carbs: 10 }))).toBe(true);
    expect(isKetoFriendly(food({ carbs: 11 }))).toBe(false);
    expect(isHighProtein(food({ protein: 10 }))).toBe(true);
    expect(isHighProtein(food({ protein: 9 }))).toBe(false);
    // FDA 21 CFR 101.60(b)(2) — not the 60 kcal this used to invent.
    expect(isLowCalorie(food({ calories: 40 }))).toBe(true);
    expect(isLowCalorie(food({ calories: 41 }))).toBe(false);
  });

  it("wires the predicates into the registry", () => {
    expect(getFilter("keto")?.test).toBe(isKetoFriendly);
    expect(getFilter("protein")?.test).toBe(isHighProtein);
    expect(getFilter("light")?.test).toBe(isLowCalorie);
  });
});

// ============================================================================
// THE FILTER REGISTRY
// ============================================================================

describe("food filters", () => {
  it("has a unique key, a label and a stated rule for every filter", () => {
    const keys = ALL_FOOD_FILTERS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of ALL_FOOD_FILTERS) {
      expect(f.label.length, `${f.key} has no label`).toBeGreaterThan(0);
      // The description IS the accessibility hint and the sheet's rule line. A
      // filter that can't say what it does shouldn't be offered.
      expect(f.description.length, `${f.key} has no stated rule`).toBeGreaterThan(10);
    }
  });

  it("only offers quick chips that exist in the registry", () => {
    for (const key of QUICK_FILTER_KEYS) {
      expect(getFilter(key), `quick filter "${key}" is not registered`).toBeDefined();
    }
  });

  it("returns the list untouched when nothing is selected", () => {
    const all = [...FOOD_DICTIONARY];
    expect(applyFoodFilters(all, new Set())).toHaveLength(all.length);
  });

  it("ANDs filters together — each one only ever narrows", () => {
    const all = [...FOOD_DICTIONARY];
    const one = applyFoodFilters(all, new Set(["lowfat"]));
    const two = applyFoodFilters(all, new Set(["lowfat", "protein"]));
    expect(two.length).toBeLessThanOrEqual(one.length);
    for (const f of two) {
      expect(f.fat).toBeLessThanOrEqual(3);
      expect(f.protein).toBeGreaterThanOrEqual(10);
    }
  });

  it("every diet filter actually excludes what its name claims", () => {
    const all = [...FOOD_DICTIONARY];
    const cases: [string, string[]][] = [
      // filter key, ids that must NOT survive it
      ["plant", ["chicken-breast", "salmon", "egg", "milk", "cheddar"]],
      ["vegetarian", ["chicken-breast", "salmon", "beef-lean"]],
      ["pescatarian", ["chicken-breast", "beef-lean"]],
      ["dairyfree", ["milk", "cheddar", "greek-yogurt"]],
      ["glutenfree", ["whole-wheat-bread"]],
      ["nutfree", ["almonds", "peanut-butter"]],
      ["eggfree", ["egg"]],
      ["soyfree", ["tofu"]],
    ];
    for (const [key, banned] of cases) {
      const survivors = applyFoodFilters(all, new Set([key])).map((f) => f.id);
      for (const id of banned) {
        expect(survivors, `"${key}" must exclude ${id}`).not.toContain(id);
      }
      expect(survivors.length, `"${key}" excluded everything`).toBeGreaterThan(0);
    }
  });

  it("keeps eggs and dairy for vegetarians but not for plant-based", () => {
    const all = [...FOOD_DICTIONARY];
    const veg = applyFoodFilters(all, new Set(["vegetarian"])).map((f) => f.id);
    const plant = applyFoodFilters(all, new Set(["plant"])).map((f) => f.id);
    expect(veg).toContain("egg");
    expect(veg).toContain("milk");
    expect(plant).not.toContain("egg");
    expect(plant).not.toContain("milk");
  });

  it("oats survive the gluten-free filter — the grain is gluten free", () => {
    const survivors = applyFoodFilters([...FOOD_DICTIONARY], new Set(["glutenfree"]));
    expect(survivors.map((f) => f.id)).toContain("oats");
  });
});

// ============================================================================
// DIET SUITABILITY
// ============================================================================

/** Convenience: does this food survive the given profile? */
function survives(f: FoodItem, profile: Parameters<typeof excludedTagsFor>[0]) {
  return fitsDiet(f, excludedTagsFor(profile), excludedTermsFor(profile));
}

describe("diet suitability", () => {
  it("excludes flesh from vegetarians but keeps eggs and dairy", () => {
    const p = { dietaryRestriction: "vegetarian" };
    expect(survives(food({ id: "beef-lean", group: "Proteins" }), p)).toBe(false);
    expect(survives(food({ id: "salmon", group: "Proteins" }), p)).toBe(false);
    expect(survives(food({ id: "prawns-shrimp", group: "Proteins" }), p)).toBe(false);
    expect(survives(food({ id: "egg", group: "Proteins" }), p)).toBe(true);
    expect(survives(food({ id: "milk", group: "Dairy" }), p)).toBe(true);
  });

  it("excludes eggs and dairy from vegans too", () => {
    const p = { dietaryRestriction: "vegan" };
    expect(survives(food({ id: "egg", group: "Proteins" }), p)).toBe(false);
    expect(survives(food({ id: "milk", group: "Dairy" }), p)).toBe(false);
    expect(survives(food({ id: "tofu", group: "Proteins" }), p)).toBe(true);
  });

  it("lets pescatarians keep fish and shellfish", () => {
    const p = { dietaryRestriction: "pescatarian" };
    expect(survives(food({ id: "salmon", group: "Proteins" }), p)).toBe(true);
    expect(survives(food({ id: "prawns-shrimp", group: "Proteins" }), p)).toBe(true);
    expect(survives(food({ id: "beef-lean", group: "Proteins" }), p)).toBe(false);
  });

  it("excludes only pork for halal, and pork plus shellfish for kosher", () => {
    expect(survives(food({ id: "pork", group: "Proteins" }), { dietaryRestriction: "halal" })).toBe(false);
    expect(survives(food({ id: "beef-lean", group: "Proteins" }), { dietaryRestriction: "halal" })).toBe(true);
    expect(survives(food({ id: "prawns-shrimp", group: "Proteins" }), { dietaryRestriction: "halal" })).toBe(true);
    expect(survives(food({ id: "prawns-shrimp", group: "Proteins" }), { dietaryRestriction: "kosher" })).toBe(false);
  });

  it("maps allergy tokens onto the right tags", () => {
    const cases: [string, string, string][] = [
      // allergy token, food id that must be hidden, food id that must survive
      ["peanuts", "peanut-butter", "almonds"],
      ["tree_nuts", "almonds", "peanut-butter"],
      ["dairy", "cheddar", "egg"],
      ["eggs", "egg", "cheddar"],
      ["shellfish", "prawns-shrimp", "salmon"],
      ["fish", "salmon", "prawns-shrimp"],
      ["gluten", "whole-wheat-bread", "brown-rice"],
      ["wheat", "whole-wheat-bread", "brown-rice"],
      ["soy", "tofu", "black-beans"],
    ];
    for (const [allergy, hidden, kept] of cases) {
      const p = { allergies: [allergy] };
      expect(survives(food({ id: hidden, group: "Proteins" }), p), `${allergy} should hide ${hidden}`).toBe(false);
      expect(survives(food({ id: kept, group: "Vegetables" }), p), `${allergy} should keep ${kept}`).toBe(true);
    }
  });

  it("matches free-text allergies and dislikes against the name, as substrings", () => {
    const p = { allergies: ["mango"], foodDislikes: ["okra"] };
    expect(survives(food({ name: "Mango" }), p)).toBe(false);
    expect(survives(food({ name: "Okra soup" }), p)).toBe(false);
    expect(survives(food({ name: "Banana" }), p)).toBe(true);
  });

  it("ignores free-text terms too short to be meaningful", () => {
    // "eg" must not wipe out every food with those two letters in it.
    const p = { foodDislikes: ["eg"] };
    expect(survives(food({ name: "Vegetable soup" }), p)).toBe(true);
  });

  /**
   * The fail-safe. The catalog is fetched at runtime and can gain foods this
   * table has never seen; an unknown one must inherit its group's assumption
   * rather than defaulting to "safe for everyone".
   */
  it("treats an unknown food in an animal group as animal-derived", () => {
    const unknown = food({ id: "some-new-cut-of-beef", group: "Proteins" });
    expect(tagsFor(unknown)).toContain<FoodTag>("meat");
    expect(survives(unknown, { dietaryRestriction: "vegan" })).toBe(false);

    const unknownDairy = food({ id: "some-new-cheese", group: "Dairy & Alternatives" });
    expect(survives(unknownDairy, { dietaryRestriction: "vegan" })).toBe(false);
  });

  it("does not sweep up the plant entries that live in the dairy group", () => {
    expect(survives(food({ id: "soy-milk", group: "Dairy & Alternatives" }), { dietaryRestriction: "vegan" })).toBe(true);
    expect(survives(food({ id: "almond-milk-unsweetened", group: "Dairy & Alternatives" }), { dietaryRestriction: "vegan" })).toBe(true);
  });

  /**
   * The offline seed uses its own ids ("milk", not "whole-milk") and its own
   * group labels ("Dairy", not "Dairy & Alternatives"). Both have to be covered
   * or the filter silently does nothing on a first offline launch.
   */
  it("covers the bundled seed, ids and group labels alike", () => {
    for (const restriction of ["vegan", "vegetarian"] as const) {
      const excluded = excludedTagsFor({ dietaryRestriction: restriction });
      const terms = excludedTermsFor({ dietaryRestriction: restriction });
      const shown = FOOD_SEED.filter((f) => fitsDiet(f, excluded, terms)).map((f) => f.id);

      for (const id of ["chicken-breast", "beef-lean", "salmon", "egusi-soup", "jollof-rice"]) {
        expect(shown, `${restriction} must not be shown ${id}`).not.toContain(id);
      }
      // And the plant staples must survive, or the filter is just hiding things.
      for (const id of ["tofu", "black-beans", "plantain", "brown-rice"]) {
        expect(shown, `${restriction} should still see ${id}`).toContain(id);
      }
    }

    const vegan = FOOD_SEED.filter((f) =>
      fitsDiet(
        f,
        excludedTagsFor({ dietaryRestriction: "vegan" }),
        excludedTermsFor({ dietaryRestriction: "vegan" }),
      ),
    ).map((f) => f.id);
    for (const id of ["milk", "cheddar", "greek-yogurt", "egg"]) {
      expect(vegan, `vegan must not be shown ${id}`).not.toContain(id);
    }
  });

  it("only claims constraints when the profile actually has some", () => {
    expect(hasDietConstraints({})).toBe(false);
    expect(hasDietConstraints({ dietaryRestriction: "none" })).toBe(false);
    expect(hasDietConstraints({ dietaryRestriction: "vegan" })).toBe(true);
    expect(hasDietConstraints({ allergies: ["peanuts"] })).toBe(true);
    expect(hasDietConstraints({ foodDislikes: ["okra"] })).toBe(true);
    // Too short to use, so it isn't a constraint.
    expect(hasDietConstraints({ foodDislikes: ["ok"] })).toBe(false);
  });
});

// ============================================================================
// CATALOG → REFERENCE
// ============================================================================

describe("catalog to reference climb", () => {
  const banana = FOOD_SEED.find((f) => f.id === "banana")!;
  const jollof = FOOD_SEED.find((f) => f.id === "jollof-rice")!;

  it("offers the reference entry's real portions when one is matched", () => {
    const link = linkCatalogFood(banana);
    if (link.canonical) {
      expect(link.portions.length).toBeGreaterThan(1);
      expect(link.portions.map((p) => p.unit)).toContain("g");
      expect(link.defaultUnit).not.toBe(CATALOG_SERVING_UNIT);
    }
  });

  it("falls back to a single serving portion with no reference match", () => {
    const link = linkCatalogFood(food({ id: "not-a-real-food", name: "Zzzz Qqqq" }));
    expect(link.canonical).toBeNull();
    expect(link.portions).toHaveLength(1);
    expect(link.defaultUnit).toBe(CATALOG_SERVING_UNIT);
  });

  it("scales the catalog's own macros by servings on the fallback rung", () => {
    const one = resolveCatalogFood(jollof, 1, CATALOG_SERVING_UNIT);
    const two = resolveCatalogFood(jollof, 2, CATALOG_SERVING_UNIT);

    expect(one.confidence).toBe("macros-only");
    expect(one.nutrients.calories).toBe(jollof.calories);
    expect(two.nutrients.calories).toBe(jollof.calories * 2);
    expect(two.nutrients.protein).toBeCloseTo(jollof.protein * 2, 5);
    expect(one.source).toEqual({
      kind: "app",
      description: `${jollof.name} — ${jollof.serving}`,
    });
  });

  it("handles half portions", () => {
    const half = resolveCatalogFood(jollof, 0.5, CATALOG_SERVING_UNIT);
    expect(half.nutrients.calories).toBe(Math.round(jollof.calories * 0.5));
  });

  it("never claims micronutrients it doesn't have", () => {
    const resolved = resolveCatalogFood(jollof, 1, CATALOG_SERVING_UNIT);
    // Sparse by design: a missing key means "not measured", never zero.
    expect(Object.keys(resolved.nutrients).sort()).toEqual([
      "calories",
      "carbs",
      "fat",
      "protein",
    ]);
    expect(resolved.nutrients.iron).toBeUndefined();
  });

  it("always states a source and a confidence", () => {
    for (const f of FOOD_SEED) {
      const link = linkCatalogFood(f);
      const resolved = resolveCatalogFood(f, 1, link.defaultUnit);
      expect(resolved.source, `${f.id} has no source`).not.toBeNull();
      expect(resolved.confidence).not.toBe("unmatched");
      // A catalog tap can never produce a "measured" claim it didn't earn.
      if (!link.canonical) expect(resolved.confidence).toBe("macros-only");
    }
  });

  it("reports positive calories for every seed food at one serving", () => {
    for (const f of FOOD_SEED) {
      const link = linkCatalogFood(f);
      const resolved = resolveCatalogFood(f, 1, link.defaultUnit);
      expect(resolved.nutrients.calories, `${f.id} has no calories`).toBeGreaterThan(0);
    }
  });
});
