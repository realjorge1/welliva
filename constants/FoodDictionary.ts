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
 * scripts/build-diet-dictionary.mjs into catalogs-dist/food_dictionary.json,
 * which is uploaded to Supabase Storage and fetched on device at runtime.
 * This module owns the FoodItem type and the query helpers over that data.
 */

import { loadCatalog } from "../services/catalogs/CatalogLoader";
import { normalizeForMatch } from "../services/nutrition/FoodTextParser";
import {
  MATCH_THRESHOLD,
  similarity,
  SUGGEST_THRESHOLD,
} from "../services/nutrition/nameMatch";
import { canonicalAliasEntries } from "./NutrientDatabase";
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
 * REMOTE + LAZY: the catalog is fetched from Supabase Storage and cached on
 * device (Phase D.4 — bundle trim), so none of it ships in the JS bundle. This
 * array starts EMPTY and is filled in place by {@link ensureFoodDictionaryLoaded},
 * with {@link FOOD_SEED} as the offline fallback. Call the loader (and
 * re-render / await it) before relying on the catalog's contents. The query
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
 * The reference table's alias vocabulary, normalised once on first use.
 *
 * This is the app's curated list of what people actually call foods — "yoghurt"
 * for yogurt, "titus" for mackerel, "okporoko" for stockfish. The catalog's own
 * names carry none of that, which is why searching it used to fail on spellings
 * the food log understood perfectly.
 */
let aliasIndex: { normalized: string; name: string }[] | null = null;
function aliasVocabulary(): { normalized: string; name: string }[] {
  return (aliasIndex ??= canonicalAliasEntries().map((e) => ({
    normalized: normalizeForMatch(e.alias),
    name: e.food.name,
  })));
}

/**
 * Name/group search across the catalog, ranked best-first.
 *
 * Four tiers, in order, so the obvious answer always wins before the clever one:
 *
 *   1. substring on the food's name        — "ban" → Banana
 *   2. substring on the group label        — "vegetable" → the whole group
 *   3. fuzzy on the name, using the SAME scorer food resolution uses
 *      (services/nutrition/nameMatch)      — word order, plurals, prefixes
 *   4. LAST RESORT: the reference table's aliases. Only runs when the first
 *      three found nothing at all.
 *
 * Tier 4 is what makes this agree with the rest of the app. The shared scorer is
 * token-based: it forgives word order and partial words but not a spelling
 * change inside a word, so "yoghurt" scores zero against "Greek Yogurt" no
 * matter how it's weighted. The food log never had that problem because it
 * matches against curated ALIASES, and "yoghurt" is one of them. Borrowing that
 * vocabulary here is the actual fix — the alternative, loosening the scorer,
 * would make every nutrition claim in the app slightly more willing to match the
 * wrong food, to fix a search box.
 *
 * Scoring at SUGGEST_THRESHOLD rather than MATCH_THRESHOLD throughout is
 * deliberate: a search result the user can see and ignore is much cheaper than a
 * wrong auto-match.
 */
export function searchFoods(query: string): FoodItem[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return FOOD_DICTIONARY;

  const substring: FoodItem[] = [];
  const byGroup: FoodItem[] = [];
  const rest: FoodItem[] = [];

  for (const f of FOOD_DICTIONARY) {
    if (f.name.toLowerCase().includes(raw)) substring.push(f);
    else if (f.group.toLowerCase().includes(raw)) byGroup.push(f);
    else rest.push(f);
  }

  // Shorter names first among substring hits: searching "egg" should surface
  // "Egg" above "Egusi melon seeds".
  substring.sort((a, b) => a.name.length - b.name.length);

  const normalized = normalizeForMatch(raw);
  if (!normalized) return [...substring, ...byGroup];

  const fuzzy = rankAgainst(normalized, rest, SUGGEST_THRESHOLD);
  if (substring.length > 0 || byGroup.length > 0 || fuzzy.length > 0) {
    return [...substring, ...byGroup, ...fuzzy];
  }

  // Nothing matched the catalog's own words. Ask the alias vocabulary what the
  // user meant, then search the catalog for THAT.
  const alias = bestAlias(normalized);
  return alias ? rankAgainst(normalizeForMatch(alias), rest, SUGGEST_THRESHOLD) : [];
}

/** Foods scoring at or above `threshold` against a normalised query, best first. */
function rankAgainst(
  normalized: string,
  pool: FoodItem[],
  threshold: number,
): FoodItem[] {
  return pool
    .map((f) => ({ f, score: similarity(normalized, normalizeForMatch(f.name)) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((m) => m.f);
}

/**
 * The reference food a query names, via the alias table. Held to
 * MATCH_THRESHOLD rather than the looser suggest threshold: this is a claim
 * about what the user meant, and a wrong guess here sends the whole search off
 * to the wrong food.
 */
function bestAlias(normalized: string): string | null {
  let best: { name: string; score: number } | null = null;
  for (const entry of aliasVocabulary()) {
    if (entry.normalized === normalized) return entry.name;
    const score = similarity(normalized, entry.normalized);
    if (score > (best?.score ?? 0)) best = { name: entry.name, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best.name : null;
}

// ── Computed dietary filters ────────────────────────────────────────────────
// Derived from macros so the catalog can be filtered without hand-tagging every
// item. Thresholds are per common serving and intentionally simple.
//
// These predicates existed for a long time with no callers at all. They now
// back the filter chips on the Foods screen via FOOD_FILTERS below — which is
// the only reason to keep them: a predicate nothing calls is a claim nothing
// tests.

/** Low enough in carbs to suit keto / very-low-carb eating. */
export function isKetoFriendly(f: FoodItem): boolean {
  return f.carbs <= 10;
}

/** A meaningful protein source at its serving. */
export function isHighProtein(f: FoodItem): boolean {
  return f.protein >= 10;
}

/**
 * Low-calorie, by the FDA's definition of the claim: 40 kcal or less per
 * serving (21 CFR 101.60(b)(2)).
 *
 * This was 60, which was nobody's standard. Using the regulatory number means
 * the chip means the same thing here as it does on a packet in a shop, and it's
 * consistent with models/nutrients.ts already citing 21 CFR 101.9 for its Daily
 * Values. It does narrow the result set (76 foods → 54).
 */
export function isLowCalorie(f: FoodItem): boolean {
  return f.calories <= 40;
}

// The filter REGISTRY lives in ./foodFilters — it needs the diet/allergen tags
// too, and keeping predicates here while the catalogue of filters lives there
// means neither file has to import the other's whole world.

export default FOOD_DICTIONARY;
