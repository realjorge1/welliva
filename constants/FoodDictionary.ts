/**
 * FoodDictionary — ingredient-level whole-foods catalog.
 *
 * Companion to DIET_DATABASE. Where a diet holds finished MEAL options, this
 * holds individual WHOLE FOODS — every common fruit, vegetable, protein,
 * grain, legume, nut/seed, dairy and Nigerian/West-African staple — each with
 * typical per-serving nutrition. It powers the browsable/searchable Foods
 * catalog and lets users log a single food (as a snack) into today's plan.
 *
 * Source of truth: /diet_dictionary (repo root) → parsed by
 * scripts/build-diet-dictionary.mjs into DietLibraryGenerated.FOOD_DICTIONARY.
 * This module owns the FoodItem type and the query helpers over that data.
 */

import { loadCatalog } from "../services/catalogs/CatalogLoader";
import type { MealCuisine } from "./DietDatabase";
import { FOOD_SEED } from "./foodSeed";

/** A single whole food with typical per-serving macros. */
export interface FoodItem {
  id: string;
  name: string;
  /** Human serving the macros describe, e.g. "1 medium", "100g cooked". */
  serving: string;
  /** Display group, e.g. "Fruits", "Vegetables", "Grains & Starches". */
  group: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isNigerian?: boolean;
  cuisine?: MealCuisine;
}

/**
 * The full catalog (generated from /diet_dictionary).
 *
 * LAZY: the ~1 MB generated source is dynamic-imported off the cold-start path
 * (Phase D — bundle trim). This array starts EMPTY and is filled in place by
 * {@link ensureFoodDictionaryLoaded}; on web that keeps the generated module out
 * of the initial chunk, and on native it defers its evaluation. Call the loader
 * (and re-render / await it) before relying on the catalog's contents. The query
 * helpers below read the live array, so they return complete data once loaded.
 */
export const FOOD_DICTIONARY: FoodItem[] = [];

/** Food groups in the order they appear in the dictionary. Filled on load. */
export const FOOD_GROUPS: string[] = [];

/**
 * Idempotent, memoized loader for the whole-foods catalog. Fetches the catalog
 * from Supabase Storage (cached on device, {@link FOOD_SEED} as the offline
 * fallback — Phase D.4), fills {@link FOOD_DICTIONARY} + {@link FOOD_GROUPS} in
 * place, and returns the catalog. Cheap to await repeatedly (same promise).
 */
let _foodsLoading: Promise<FoodItem[]> | null = null;
export function ensureFoodDictionaryLoaded(): Promise<FoodItem[]> {
  return (_foodsLoading ??= (async () => {
    const { items } = await loadCatalog<FoodItem>(
      "food_dictionary",
      "food_dictionary.json",
      FOOD_SEED,
    );
    if (FOOD_DICTIONARY.length === 0) {
      FOOD_DICTIONARY.push(...items);
      FOOD_GROUPS.push(...new Set(FOOD_DICTIONARY.map((f) => f.group)));
    }
    return FOOD_DICTIONARY;
  })());
}

/** All foods in a given group (exact group label). */
export function foodsByGroup(group: string): FoodItem[] {
  return FOOD_DICTIONARY.filter((f) => f.group === group);
}

/** Look up a single food by its stable slug id. */
export function getFoodById(id: string): FoodItem | undefined {
  return FOOD_DICTIONARY.find((f) => f.id === id);
}

/**
 * Case-insensitive name search across the catalog. Matches on the food name
 * and its group so "green" finds greens and "grain" finds the grains group.
 */
export function searchFoods(query: string): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_DICTIONARY;
  return FOOD_DICTIONARY.filter(
    (f) =>
      f.name.toLowerCase().includes(q) || f.group.toLowerCase().includes(q),
  );
}

// ── Computed dietary flags ──────────────────────────────────────────────────
// Derived from macros so the catalog can be filtered without hand-tagging every
// item. Thresholds are per common serving and intentionally simple.

/** Low enough in carbs to suit keto / very-low-carb eating. */
export function isKetoFriendly(f: FoodItem): boolean {
  return f.carbs <= 10;
}

/** A meaningful protein source at its serving. */
export function isHighProtein(f: FoodItem): boolean {
  return f.protein >= 10;
}

/** Light, low-calorie food useful for volume/weight-loss plates. */
export function isLowCalorie(f: FoodItem): boolean {
  return f.calories <= 60;
}

export default FOOD_DICTIONARY;
