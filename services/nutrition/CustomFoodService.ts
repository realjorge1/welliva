/**
 * CustomFoodService — foods the user added, that our catalogs never had.
 *
 * The shipped catalog is 205 whole foods and the reference table is 44 measured
 * entries. Between them they cover staples well and the rest of the world badly:
 * a user searching "abacha", "chin chin" or a specific branded cereal gets
 * nothing, and "nothing" is the one answer a food app can't afford to give
 * often. This store is where the answer goes once we've found it.
 *
 * ── WHAT'S STORED ───────────────────────────────────────────────────────────
 * A CustomFood is a catalog FoodItem (so it drops straight into the Foods
 * screen, search, filters and the detail sheet) PLUS the provenance that made
 * it acceptable to store: the resolved nutrient panel, its source, and its
 * confidence. Provenance is not optional here. A food that arrived from USDA
 * carries an FDC id anyone can verify; a food that arrived from a model carries
 * `ai-estimate` and is labelled as such for the rest of its life.
 *
 * ── PER-USER, AND IT SYNCS ──────────────────────────────────────────────────
 * The key sits under `@welliva_`, and services/sync/syncKeys uses a DENYLIST —
 * so this follows the account to a new phone with no extra wiring. It's
 * registered in mergeStrategies as `mergeById` so two devices adding different
 * foods on the same day merge instead of one clobbering the other.
 *
 * ── IDS ─────────────────────────────────────────────────────────────────────
 * Custom ids are prefixed `custom_`. That prefix is load-bearing: FOOD_DICTIONARY
 * ids come from a generator and could theoretically collide, and several places
 * (favourites, recents, foodTags) key on food id. The prefix keeps the two
 * namespaces provably disjoint.
 */

import type { FoodItem } from "../../constants/FoodDictionary";
import type {
  NutrientConfidence,
  NutrientPanel,
  NutrientSource,
} from "../../models/nutrients";
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";

/** A food the user added, with the provenance that justifies its numbers. */
export interface CustomFood extends FoodItem {
  /** Always `custom_…` — see the ids note above. */
  id: string;
  /** Nutrition for ONE serving, already scaled. Sparse, like every panel. */
  nutrients: NutrientPanel;
  /** Per 100 g, when the source gave it — lets portions scale properly. */
  per100g?: NutrientPanel;
  /** What one serving weighs, when known. Null for "1 serving, unweighed". */
  servingGrams: number | null;
  source: NutrientSource;
  confidence: NutrientConfidence;
  /** ISO. Drives "recently added" ordering and the merge tie-break. */
  addedAt: string;
  /** The words the user searched, kept so the food is findable by them again. */
  query?: string;
  /**
   * The EAN/UPC this food was scanned from, when it arrived by barcode.
   *
   * Load-bearing for the local-first rule: scanning the same tin next week must
   * resolve out of this store instead of hitting Open Food Facts again. Without
   * it every scan is a network call, and any correction the user made to the
   * entry would be silently replaced by the community's version each time.
   */
  barcode?: string;
}

/**
 * A sane ceiling. Not a paywall — this is a free feature — just a guard against
 * a runaway loop filling a synced document with thousands of rows.
 */
export const CUSTOM_FOOD_LIMIT = 300;

const CUSTOM_ID_PREFIX = "custom_";

export function isCustomFoodId(id: string): boolean {
  return id.startsWith(CUSTOM_ID_PREFIX);
}

let opChain: Promise<unknown> = Promise.resolve();
function withLock<T>(op: () => Promise<T>): Promise<T> {
  const result = opChain.then(op, op);
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readStore(): Promise<CustomFood[]> {
  const raw = await readJSON<CustomFood[]>(KEYS.CUSTOM_FOODS, []);
  return Array.isArray(raw) ? raw : [];
}

/** Newest first — the order the "Your foods" section renders in. */
export async function listCustomFoods(): Promise<CustomFood[]> {
  const all = await readStore();
  return [...all].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function getCustomFood(id: string): Promise<CustomFood | null> {
  const all = await readStore();
  return all.find((f) => f.id === id) ?? null;
}

export interface AddCustomFoodInput {
  name: string;
  serving: string;
  servingGrams: number | null;
  group: string;
  nutrients: NutrientPanel;
  per100g?: NutrientPanel;
  source: NutrientSource;
  confidence: NutrientConfidence;
  isNigerian?: boolean;
  query?: string;
  /** Set by the barcode path; see CustomFood.barcode. */
  barcode?: string;
}

/**
 * Add a food to the user's list.
 *
 * Deduplicates on name within a group: adding "Abacha" twice replaces the first
 * rather than stacking two identical rows, because the second add usually means
 * the user didn't notice the first. The replacement keeps the ORIGINAL id, so
 * anything already pointing at it — a favourite, a recent, a logged entry's
 * `foodId` — keeps resolving.
 */
export async function addCustomFood(input: AddCustomFoodInput): Promise<CustomFood> {
  return withLock(async () => {
    const all = await readStore();
    const key = input.name.trim().toLowerCase();
    /*
     * A barcode is a stronger identity than a name, so it wins the dedupe when
     * present: two products can share a name ("Greek Yogurt") and the user can
     * rename either, but a GTIN identifies exactly one package. Matching on it
     * first is what stops a re-scan from stacking duplicates.
     */
    const existing =
      (input.barcode ? all.find((f) => f.barcode === input.barcode) : undefined) ??
      all.find((f) => f.name.trim().toLowerCase() === key && f.group === input.group);

    const food: CustomFood = {
      id: existing?.id ?? `${CUSTOM_ID_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name.trim(),
      serving: input.serving,
      servingGrams: input.servingGrams,
      group: input.group,
      // The four macros are mirrored onto the FoodItem fields so a CustomFood
      // renders in the catalog list exactly like a built-in one, with no
      // special-casing in the row component.
      calories: Math.round(input.nutrients.calories ?? 0),
      protein: round1(input.nutrients.protein),
      carbs: round1(input.nutrients.carbs),
      fat: round1(input.nutrients.fat),
      nutrients: input.nutrients,
      ...(input.per100g ? { per100g: input.per100g } : {}),
      source: input.source,
      confidence: input.confidence,
      addedAt: new Date().toISOString(),
      ...(input.isNigerian ? { isNigerian: true } : {}),
      ...(input.query ? { query: input.query } : {}),
      ...(input.barcode ? { barcode: input.barcode } : {}),
    };

    const rest = all.filter((f) => f.id !== food.id);
    // Newest first, then capped — so hitting the ceiling drops the oldest.
    const next = [food, ...rest]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, CUSTOM_FOOD_LIMIT);

    await writeJSON(KEYS.CUSTOM_FOODS, next);
    return food;
  });
}

/**
 * Find a previously scanned food by its barcode.
 *
 * This IS the local-first rule for the barcode ladder — see
 * services/nutrition/OpenFoodFacts.ts. A hit here stops the network lookup dead,
 * for the same reason a catalog hit stops the USDA one: the answer we already
 * hold is better than the one we would fetch, because the user may have
 * corrected it.
 */
export async function findCustomFoodByBarcode(
  barcode: string,
): Promise<CustomFood | null> {
  const code = barcode.replace(/D+/g, "");
  if (!code) return null;
  const all = await readStore();
  return all.find((f) => f.barcode === code) ?? null;
}

export async function removeCustomFood(id: string): Promise<boolean> {
  return withLock(async () => {
    const all = await readStore();
    const next = all.filter((f) => f.id !== id);
    if (next.length === all.length) return false;
    await writeJSON(KEYS.CUSTOM_FOODS, next);
    return true;
  });
}

function round1(v: number | undefined): number {
  return typeof v === "number" ? Math.round(v * 10) / 10 : 0;
}
