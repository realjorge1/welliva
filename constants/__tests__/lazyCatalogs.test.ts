import { describe, expect, it, vi } from "vitest";

/**
 * Phase D.4 — the diet/food catalogs are fetched via the CatalogLoader (Supabase
 * Storage, cached, seed fallback) and merged into the live arrays in place. We
 * mock the loader with a tiny fixture so this asserts the accessor behaviour
 * (fill-in-place, memoization, base-wins dedupe) rather than the network.
 */
const { DIET_FIXTURE, FOOD_FIXTURE } = vi.hoisted(() => ({
  DIET_FIXTURE: [
    {
      id: "__gen_test_diet",
      name: "Generated Test Diet",
      fullName: "",
      description: "",
      icon: "leaf",
      difficulty: "Easy",
      principles: { emphasis: [] },
      clinicalInfo: { safeFor: [], guidelines: [], clinicalNotes: [] },
      breakfastOptions: [],
      lunchOptions: [],
      dinnerOptions: [],
      snackOptions: [],
    },
    {
      // Collides with a BASE diet id — the base diet must win (skipped, not replaced).
      id: "mediterranean",
      name: "SHOULD NOT REPLACE BASE",
      fullName: "",
      description: "",
      icon: "leaf",
      difficulty: "Easy",
      principles: { emphasis: [] },
      clinicalInfo: { safeFor: [], guidelines: [], clinicalNotes: [] },
      breakfastOptions: [],
      lunchOptions: [],
      dinnerOptions: [],
      snackOptions: [],
    },
  ],
  FOOD_FIXTURE: [
    { id: "f_apple", name: "Apple", serving: "1", group: "Fruits", calories: 95, protein: 0, carbs: 25, fat: 0 },
    { id: "f_kale", name: "Kale", serving: "1 cup", group: "Vegetables", calories: 33, protein: 3, carbs: 6, fat: 0 },
  ],
}));

vi.mock("../../services/catalogs/CatalogLoader", () => ({
  loadCatalog: async (name: string, _file: string, seed: unknown[]) =>
    name === "diet_library"
      ? { items: DIET_FIXTURE, source: "network" }
      : name === "food_dictionary"
        ? { items: FOOD_FIXTURE, source: "network" }
        : { items: seed, source: "seed" },
}));

import { DIET_DATABASE, ensureDietLibraryLoaded } from "../DietDatabase";
import {
  FOOD_DICTIONARY,
  FOOD_GROUPS,
  ensureFoodDictionaryLoaded,
} from "../FoodDictionary";

describe("ensureDietLibraryLoaded", () => {
  it("starts with the hand-authored base diets before loading", () => {
    expect(DIET_DATABASE.length).toBeGreaterThan(0);
    expect(DIET_DATABASE.some((d) => d.id === "mediterranean")).toBe(true);
    expect(DIET_DATABASE.some((d) => d.id === "__gen_test_diet")).toBe(false);
  });

  it("merges the remote library in place, base wins on id collision", async () => {
    await ensureDietLibraryLoaded();
    expect(DIET_DATABASE.some((d) => d.id === "__gen_test_diet")).toBe(true);
    expect(DIET_DATABASE.filter((d) => d.id === "mediterranean")).toHaveLength(1);
    expect(DIET_DATABASE.find((d) => d.id === "mediterranean")?.name).not.toBe(
      "SHOULD NOT REPLACE BASE",
    );
  });

  it("is idempotent + memoized — repeated calls never double-append", async () => {
    const first = await ensureDietLibraryLoaded();
    const lenAfterFirst = DIET_DATABASE.length;
    const second = await ensureDietLibraryLoaded();
    expect(second).toBe(first); // same live array reference
    expect(DIET_DATABASE.length).toBe(lenAfterFirst);
    expect(DIET_DATABASE.filter((d) => d.id === "__gen_test_diet")).toHaveLength(1);
  });
});

describe("ensureFoodDictionaryLoaded", () => {
  it("starts empty, then fills the dictionary + groups in place", async () => {
    expect(FOOD_DICTIONARY.length).toBe(0);
    expect(FOOD_GROUPS.length).toBe(0);

    await ensureFoodDictionaryLoaded();

    expect(FOOD_DICTIONARY.map((f) => f.id)).toEqual(["f_apple", "f_kale"]);
    expect(FOOD_GROUPS).toEqual(["Fruits", "Vegetables"]);
  });

  it("is idempotent + memoized — repeated calls never duplicate", async () => {
    await ensureFoodDictionaryLoaded();
    await ensureFoodDictionaryLoaded();
    expect(FOOD_DICTIONARY).toHaveLength(2);
    expect(FOOD_GROUPS).toHaveLength(2);
  });
});
