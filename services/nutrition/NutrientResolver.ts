/**
 * NutrientResolver — the only place in the app allowed to state a nutrition fact.
 *
 * Takes a parsed item ({qty 2, unit "slice", food "bread"}) and returns real
 * numbers with a citation, or honestly reports that it can't.
 *
 * THE SOURCE LADDER, best to worst. Each rung is weaker than the one above it
 * and says so in the returned `confidence`, which the UI always shows:
 *
 *   1. CANONICAL_FOODS  — measured composition data with an FDC/WAFCT id, plus
 *                         a known gram weight for the portion. → "measured"
 *   2. …same, portion guessed — right food, assumed serving. → "portion-estimated"
 *   3. …composite dish  — standard recipe arithmetic.        → "recipe-estimated"
 *   4. FOOD_DICTIONARY  — the app's own catalog: four macros, no micronutrients
 *                         and no citation.                   → "macros-only"
 *   5. no match         — nothing asserted at all.            → "unmatched"
 *
 * There is deliberately no rung below "unmatched". If we cannot identify a food
 * we return zero nutrients and say so, because the alternative — quietly
 * substituting a similar-sounding food's numbers — is how a nutrition tracker
 * becomes confidently wrong, which is worse than being incomplete.
 */

import {
  CANONICAL_FOODS,
  canonicalAliasEntries,
  defaultPortion,
  getCanonicalByAlias,
  getCanonicalFood,
  portionGrams,
} from "../../constants/NutrientDatabase";
import { FOOD_DICTIONARY, type FoodItem } from "../../constants/FoodDictionary";
import {
  roundNutrient,
  scalePanel,
  sumPanels,
  weakestConfidence,
  type CanonicalFood,
  type FoodAnalysis,
  type NutrientConfidence,
  type NutrientPanel,
  type NutrientSource,
  type PortionOption,
  type ResolvedFoodItem,
} from "../../models/nutrients";
import { normalizeForMatch, type ParsedFoodItem } from "./FoodTextParser";
import { MATCH_THRESHOLD, similarity } from "./nameMatch";

// ============================================================================
// UNIT CONVERSION
// ============================================================================

/** Absolute mass units → grams. Independent of which food it is. */
const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

/**
 * Absolute volume → grams, assuming water density. Only applied to foods that
 * are essentially liquid; for anything else a volume without a food-specific
 * portion entry is treated as unknown rather than silently assumed to be water.
 */
const VOLUME_TO_ML: Record<string, number> = { ml: 1, l: 1000 };

const LIQUID_GROUPS = new Set(["Beverages", "Dairy", "Fats & Oils"]);

// ============================================================================
// MATCHING
// ============================================================================

const ALIAS_ENTRIES = canonicalAliasEntries().map((e) => ({
  alias: e.alias,
  normalized: normalizeForMatch(e.alias),
  food: e.food,
}));

// MATCH_THRESHOLD and `similarity` now live in ./nameMatch so the Foods catalog
// search can score names exactly the way resolution does.

export interface FoodMatch {
  food: CanonicalFood;
  score: number;
  /** True for an exact alias hit — lets the caller skip fuzzy bookkeeping. */
  exact: boolean;
}

/** Best canonical match for a food name, or null below the threshold. */
export function matchCanonical(name: string): FoodMatch | null {
  const direct = getCanonicalByAlias(name);
  if (direct) return { food: direct, score: 1, exact: true };

  const normalized = normalizeForMatch(name);
  if (!normalized) return null;

  const exactNormalized = ALIAS_ENTRIES.find((e) => e.normalized === normalized);
  if (exactNormalized) return { food: exactNormalized.food, score: 1, exact: true };

  let best: FoodMatch | null = null;
  for (const entry of ALIAS_ENTRIES) {
    const score = similarity(normalized, entry.normalized);
    if (score > (best?.score ?? 0)) best = { food: entry.food, score, exact: false };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}

/** Ranked near-misses, for a "did you mean…" swap in the UI. */
export function suggestCanonical(name: string, limit = 3): FoodMatch[] {
  const normalized = normalizeForMatch(name);
  if (!normalized) return [];
  const seen = new Set<string>();
  return ALIAS_ENTRIES.map((e) => ({
    food: e.food,
    score: similarity(normalized, e.normalized),
    exact: false,
  }))
    .filter((m) => {
      if (m.score < 0.3 || seen.has(m.food.id)) return false;
      seen.add(m.food.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Fallback match against the app's own catalog (macros only, no citation). */
function matchAppCatalog(name: string): { food: FoodItem; score: number } | null {
  const normalized = normalizeForMatch(name);
  if (!normalized) return null;
  let best: { food: FoodItem; score: number } | null = null;
  for (const food of FOOD_DICTIONARY) {
    const score = similarity(normalized, normalizeForMatch(food.name));
    if (score > (best?.score ?? 0)) best = { food, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}

// ============================================================================
// PORTION → GRAMS
// ============================================================================

interface PortionResolution {
  grams: number;
  /** False when we had to fall back to a default serving size. */
  exact: boolean;
}

function resolvePortion(
  food: CanonicalFood,
  quantity: number,
  unit: string,
  quantityAssumed: boolean,
): PortionResolution {
  const u = unit.trim().toLowerCase();

  // Absolute mass — exact regardless of the food.
  if (MASS_TO_GRAMS[u]) return { grams: quantity * MASS_TO_GRAMS[u], exact: true };

  // A food-specific entry for this unit is the best case.
  const specific = u ? portionGrams(food, u) : undefined;
  if (specific !== undefined) {
    return { grams: quantity * specific, exact: !quantityAssumed };
  }

  // Volume: only safe for liquids, where 1 ml ≈ 1 g is a fair approximation.
  if (VOLUME_TO_ML[u] && LIQUID_GROUPS.has(food.group)) {
    return { grams: quantity * VOLUME_TO_ML[u], exact: false };
  }

  // No unit given, or a unit this food doesn't define → default serving.
  const fallback = defaultPortion(food);
  return { grams: quantity * fallback.grams, exact: false };
}

// ============================================================================
// RESOLUTION
// ============================================================================

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

/**
 * Resolve one parsed item to real nutrition. Always returns an item — an
 * unresolvable one comes back with `confidence: "unmatched"` and an empty
 * panel so the user can see and correct it, rather than it vanishing.
 */
export function resolveItem(parsed: ParsedFoodItem): ResolvedFoodItem {
  const match = matchCanonical(parsed.food);

  if (match) {
    const { grams, exact } = resolvePortion(
      match.food,
      parsed.quantity,
      parsed.unit,
      parsed.quantityAssumed,
    );

    // A composite dish can never be better than recipe-estimated: the reference
    // is a standard recipe, not this particular pot.
    let confidence: NutrientConfidence;
    if (match.food.isComposite) confidence = "recipe-estimated";
    else if (exact && match.score >= 0.99) confidence = "measured";
    else confidence = "portion-estimated";

    return {
      id: nextId("res"),
      inputText: parsed.raw,
      name: match.food.name,
      foodId: match.food.id,
      quantity: parsed.quantity,
      unit: parsed.unit || defaultPortion(match.food).unit,
      grams: Math.round(grams * 10) / 10,
      nutrients: scalePanel(match.food.per100g, grams),
      source: match.food.source,
      confidence,
      matchScore: match.score,
      alternatives: buildAlternatives(parsed.food, match.food.id),
    };
  }

  // --- Rung 4: the app catalog. Macros only, and we say so. ----------------
  const app = matchAppCatalog(parsed.food);
  if (app) {
    // Catalog numbers are PER SERVING, not per 100 g, so they scale by servings.
    // A gram amount can't be honoured without knowing the serving's weight, so
    // we scale by count and flag the portion as estimated.
    const servings = parsed.quantity;
    const panel: NutrientPanel = {
      calories: Math.round(app.food.calories * servings),
      protein: Math.round(app.food.protein * servings * 10) / 10,
      carbs: Math.round(app.food.carbs * servings * 10) / 10,
      fat: Math.round(app.food.fat * servings * 10) / 10,
    };
    const source: NutrientSource = {
      kind: "app",
      description: `${app.food.name} — ${app.food.serving}`,
    };
    return {
      id: nextId("res"),
      inputText: parsed.raw,
      name: app.food.name,
      foodId: null,
      quantity: parsed.quantity,
      unit: parsed.unit || "serving",
      grams: 0,
      nutrients: panel,
      source,
      confidence: "macros-only",
      matchScore: app.score,
      alternatives: buildAlternatives(parsed.food, null),
    };
  }

  // --- Rung 5: nothing. Assert nothing. ------------------------------------
  return {
    id: nextId("res"),
    inputText: parsed.raw,
    name: parsed.food,
    foodId: null,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grams: 0,
    nutrients: {},
    source: null,
    confidence: "unmatched",
    matchScore: 0,
    alternatives: buildAlternatives(parsed.food, null),
  };
}

function buildAlternatives(name: string, excludeId: string | null) {
  const alts = suggestCanonical(name, 4)
    .filter((m) => m.food.id !== excludeId)
    .slice(0, 3)
    .map((m) => ({ foodId: m.food.id, name: m.food.name, matchScore: m.score }));
  return alts.length > 0 ? alts : undefined;
}

/**
 * Resolve a whole list of parsed items into one analysis.
 *
 * Totals use sumPanels, which drops any nutrient that isn't measured across
 * EVERY item (reporting it in `partialKeys` instead). That matters: if a meal
 * is rice + a catalog-only item, summing iron over just the rice would make the
 * meal look iron-poor when the truth is simply unknown for part of it.
 */
export function resolveItems(
  parsedItems: ParsedFoodItem[],
  input: string,
  parsedBy: "local" | "ai" = "local",
): FoodAnalysis {
  const items = parsedItems.map(resolveItem);
  const contributing = items.filter((i) => i.confidence !== "unmatched");
  const { totals, partialKeys } = sumPanels(contributing.map((i) => i.nutrients));

  return {
    id: nextId("analysis"),
    input,
    items,
    totals,
    partialKeys,
    confidence:
      items.length === 0
        ? "unmatched"
        : weakestConfidence(items.map((i) => i.confidence)),
    unmatched: items.filter((i) => i.confidence === "unmatched").map((i) => i.inputText),
    parsedBy,
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================================
// DIRECT LOOKUPS — for catalog taps rather than typed text
// ============================================================================

/**
 * Resolve a known canonical food at an explicit portion. Used when the user
 * picks from a list and adjusts the amount, so there's no parsing involved and
 * the result is measured unless the food itself is a composite.
 */
export function resolveKnownFood(
  foodId: string,
  quantity: number,
  unit: string,
): ResolvedFoodItem | null {
  const food = getCanonicalFood(foodId);
  if (!food) return null;

  const { grams, exact } = resolvePortion(food, quantity, unit, false);
  return {
    id: nextId("res"),
    inputText: `${quantity} ${unit} ${food.name}`.trim(),
    name: food.name,
    foodId: food.id,
    quantity,
    unit,
    grams: Math.round(grams * 10) / 10,
    nutrients: scalePanel(food.per100g, grams),
    source: food.source,
    confidence: food.isComposite
      ? "recipe-estimated"
      : exact
        ? "measured"
        : "portion-estimated",
    matchScore: 1,
  };
}

/**
 * The portion unit meaning "one of whatever the catalog calls a serving". Used
 * when a catalog food has no canonical entry, so there is no gram weight to
 * scale by — only a count of the serving the catalog described.
 */
export const CATALOG_SERVING_UNIT = "serving";

export interface CatalogLink {
  /** The measured reference entry backing this catalog food, if we have one. */
  canonical: CanonicalFood | null;
  /** Portions to offer in a picker, best first. */
  portions: PortionOption[];
  /** Which of those to select initially. */
  defaultUnit: string;
}

/**
 * Does the app hold measured data for a food the user picked out of the Foods
 * catalog?
 *
 * The two tables were built for different jobs and never linked: FOOD_DICTIONARY
 * is the browsable catalog (205 foods, four macros, no citation) and
 * CANONICAL_FOODS is the reference table (measured panels with an FDC/WAFCT id).
 * Tapping a food in the catalog should get the better data whenever it exists,
 * which means matching the two by name at the moment the user opens one.
 *
 * Matching by name is the only option — the catalog's ids come from a different
 * generator — so it uses the same scorer and threshold as text resolution. A
 * near-miss deliberately fails to null: showing a banana's macros is fine,
 * showing a DIFFERENT food's measured iron content is not.
 */
const linkCache = new Map<string, CatalogLink>();

export function linkCatalogFood(food: FoodItem): CatalogLink {
  const cached = linkCache.get(food.id);
  if (cached) return cached;

  const match = matchCanonical(food.name);
  const link: CatalogLink = match
    ? {
        canonical: match.food,
        // Grams last: it's the precise option, not the likely one.
        portions: [...match.food.portions, { unit: "g", grams: 1 }],
        defaultUnit: defaultPortion(match.food).unit,
      }
    : {
        canonical: null,
        portions: [{ unit: CATALOG_SERVING_UNIT, grams: 0, isDefault: true }],
        defaultUnit: CATALOG_SERVING_UNIT,
      };

  linkCache.set(food.id, link);
  return link;
}

/**
 * Resolve a catalog food at a chosen portion, climbing to the reference table
 * when {@link linkCatalogFood} found a match and falling back to the catalog's
 * own per-serving macros when it didn't.
 *
 * The fallback rung is the same one text resolution uses (rung 4 in this file's
 * header): scale the four macros by the number of servings, source it to the
 * app's own catalog, and label it `macros-only` so nothing downstream mistakes
 * it for measured data.
 */
export function resolveCatalogFood(
  food: FoodItem,
  quantity: number,
  unit: string,
): ResolvedFoodItem {
  /*
   * A food the user added carries its OWN panel, source and confidence — from
   * USDA, or from a model and labelled as such. Those must be used verbatim
   * rather than run through the ladder below: re-matching "Abacha" against the
   * canonical table would either find nothing (losing the data we just fetched)
   * or, worse, find something vaguely similar and quietly relabel a stored
   * estimate as measured. The user's own food is already resolved.
   */
  const custom = asCustomFood(food);
  if (custom) return resolveCustomFood(custom, quantity);

  const link = linkCatalogFood(food);

  if (link.canonical && unit !== CATALOG_SERVING_UNIT) {
    const resolved = resolveKnownFood(link.canonical.id, quantity, unit);
    if (resolved) return resolved;
  }

  const servings = quantity;
  const panel: NutrientPanel = {
    calories: Math.round(food.calories * servings),
    protein: Math.round(food.protein * servings * 10) / 10,
    carbs: Math.round(food.carbs * servings * 10) / 10,
    fat: Math.round(food.fat * servings * 10) / 10,
  };
  const source: NutrientSource = {
    kind: "app",
    description: food.serving ? `${food.name} — ${food.serving}` : food.name,
  };

  return {
    id: nextId("res"),
    inputText: `${servings} × ${food.name}`,
    name: food.name,
    foodId: null,
    quantity: servings,
    unit: CATALOG_SERVING_UNIT,
    grams: 0,
    nutrients: panel,
    source,
    confidence: "macros-only",
    matchScore: 1,
  };
}

/**
 * The subset of CustomFood this module needs. Declared structurally rather than
 * imported, so the resolver doesn't depend on the storage service — it only
 * cares that a food arrived carrying its own resolved nutrition.
 */
interface ResolvedCarrier extends FoodItem {
  nutrients: NutrientPanel;
  per100g?: NutrientPanel;
  servingGrams: number | null;
  source: NutrientSource;
  confidence: NutrientConfidence;
}

function asCustomFood(food: FoodItem): ResolvedCarrier | null {
  const f = food as Partial<ResolvedCarrier>;
  return f.nutrients && f.source && f.confidence
    ? (food as ResolvedCarrier)
    : null;
}

/**
 * Scale a user-added food to a serving count.
 *
 * Scaling by SERVINGS, not grams: the stored panel describes one serving, and
 * that's the only portion this food is known at. Its confidence and source are
 * carried through untouched — an estimate stays an estimate at every portion,
 * and doubling it doesn't make it more measured.
 */
function resolveCustomFood(food: ResolvedCarrier, servings: number): ResolvedFoodItem {
  const panel: NutrientPanel = {};
  for (const [k, v] of Object.entries(food.nutrients)) {
    if (typeof v === "number") {
      panel[k as keyof NutrientPanel] = roundNutrient(k as never, v * servings);
    }
  }

  return {
    id: nextId("res"),
    inputText: `${servings} × ${food.name}`,
    name: food.name,
    foodId: food.id,
    quantity: servings,
    unit: CATALOG_SERVING_UNIT,
    grams: food.servingGrams !== null ? Math.round(food.servingGrams * servings * 10) / 10 : 0,
    nutrients: panel,
    source: food.source,
    confidence: food.confidence,
    matchScore: 1,
  };
}

/** Every canonical food, for the browsable reference list. */
export function allCanonicalFoods(): CanonicalFood[] {
  return CANONICAL_FOODS;
}

/**
 * Search the reference table by name. Returns canonical foods only — the caller
 * decides whether to also offer the macros-only catalog.
 */
export function searchCanonical(query: string, limit = 20): CanonicalFood[] {
  const normalized = normalizeForMatch(query);
  if (!normalized) return CANONICAL_FOODS.slice(0, limit);

  const seen = new Set<string>();
  return ALIAS_ENTRIES.map((e) => ({ food: e.food, score: similarity(normalized, e.normalized) }))
    .filter((m) => {
      if (m.score < 0.35 || seen.has(m.food.id)) return false;
      seen.add(m.food.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.food);
}
