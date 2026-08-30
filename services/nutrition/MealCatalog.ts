/**
 * MealCatalog — the meal dictionary behind "choose a meal".
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The app already holds thousands of meal options, but they are stored the way
 * a DIET needs them: DIET_DATABASE[i].breakfastOptions, one list per diet, with
 * the same "Akara & pap" appearing under six different plans. That shape is
 * right for "generate me a Mediterranean day" and useless for the question the
 * planner actually asks — "show me every breakfast there is."
 *
 * Answering that question by hand is what the planner never did, which is why
 * its picker rendered an empty screen: it searched the *reference* table and
 * showed nothing at all until you typed. A picker that is blank until you guess
 * a name is a picker that cannot be browsed, and browsing is the entire point of
 * "plan my own menu".
 *
 * So this module pivots the data once: diet-major → slot-major, de-duplicated by
 * name, with the diets each meal belongs to carried along as provenance.
 *
 * ── THE TWO SOURCES ─────────────────────────────────────────────────────────
 *   DIET_DATABASE   → finished MEALS ("Jollof rice with grilled chicken")
 *   FOOD_DICTIONARY → single WHOLE FOODS ("Banana", "Greek yogurt")
 *
 * Both belong in the picker and they are NOT interleaved. A planned slot is
 * normally a meal; a whole food is a legitimate but different answer ("dinner:
 * just a bowl of yogurt"), so it is offered in its own labelled section rather
 * than ranked against dishes it isn't comparable to.
 *
 * ── DEDUPE KEEPS THE FIRST WINNER ───────────────────────────────────────────
 * Base DIET_DATABASE entries are hand-authored and enumerated before the
 * generated library, so first-seen wins means the curated numbers are the ones
 * shown. Later duplicates contribute only their diet NAME, which is how one row
 * can honestly say "in Mediterranean, DASH and Flexitarian".
 *
 * ── LAZINESS ────────────────────────────────────────────────────────────────
 * Both catalogs fill their arrays IN PLACE after a remote fetch (Phase D.4), so
 * an index built at import time would be permanently short. The index is keyed
 * on the source array lengths and silently rebuilds when either grows — callers
 * just call, and {@link ensureMealCatalogLoaded} is the "and now it's complete"
 * signal for the UI to re-render on.
 */

import {
  DIET_DATABASE,
  ensureDietLibraryLoaded,
  type DietData,
  type DietMealOption,
  type DietSnackOption,
  type MealCuisine,
} from "../../constants/DietDatabase";
import {
  ensureFoodDictionaryLoaded,
  FOOD_DICTIONARY,
  type FoodItem,
} from "../../constants/FoodDictionary";
import type { MealType } from "../../models/diet";
import { normalizeForMatch } from "./FoodTextParser";
import { similarity, SUGGEST_THRESHOLD } from "./nameMatch";

/** A macro range, as the diet catalog stores them. */
export interface Range {
  min: number;
  max: number;
}

/**
 * One browsable option in the picker.
 *
 * `origin` is an honest label, not a styling hint: a "diet" idea is a composed
 * meal somebody authored, a "food" idea is one ingredient the user is choosing
 * to eat on its own. They carry different amounts of nutrition detail and the
 * confirm step says so.
 */
export interface MealIdea {
  /** Stable for the life of the index — safe as a list key. */
  key: string;
  name: string;
  slot: MealType;
  calories: Range;
  protein: Range;
  carbs: Range;
  fat: Range;
  isNigerian?: boolean;
  cuisine?: MealCuisine;
  /** Names of the diets this meal appears in. Empty for whole foods. */
  diets: string[];
  origin: "diet" | "food";
  /** Whole foods only: the serving the macros describe ("1 medium"). */
  serving?: string;
  /** Whole foods only: catalog id, so the confirm step can climb to full nutrients. */
  foodId?: string;
}

/** What a search turned up on device, before any network is considered. */
export interface MealSearchResults {
  /** Matches for the slot being planned — the answer the user asked for. */
  inSlot: MealIdea[];
  /** Matches that belong to a different slot. Nobody minds eating lunch food at 8am. */
  otherSlots: MealIdea[];
  /** Single ingredients from the whole-foods catalog. */
  foods: MealIdea[];
  /** Everything above, counted. Zero is what licenses a network lookup. */
  total: number;
}

export const MEAL_SLOTS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/** Rows returned per section before the list stops being a list. */
const SEARCH_LIMIT = 40;

// ============================================================================
// INDEX
// ============================================================================

interface Index {
  /** Length signature of the source arrays this index was built from. */
  stamp: string;
  bySlot: Record<MealType, MealIdea[]>;
  foods: MealIdea[];
}

let index: Index | null = null;

function stampOf(): string {
  return `${DIET_DATABASE.length}:${FOOD_DICTIONARY.length}`;
}

const emptyRange = (): Range => ({ min: 0, max: 0 });

function toRange(r: Range | undefined): Range {
  return r && Number.isFinite(r.min) && Number.isFinite(r.max) ? r : emptyRange();
}

function slotOptions(
  diet: DietData,
  slot: MealType,
): (DietMealOption | DietSnackOption)[] {
  switch (slot) {
    case "breakfast":
      return diet.breakfastOptions ?? [];
    case "lunch":
      return diet.lunchOptions ?? [];
    case "dinner":
      return diet.dinnerOptions ?? [];
    case "snack":
      return diet.snackOptions ?? [];
  }
}

function buildIndex(): Index {
  const bySlot: Record<MealType, MealIdea[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const slot of MEAL_SLOTS) {
    // normalized name → the idea that claimed it, so later diets only add their
    // name to the provenance list instead of duplicating the row.
    const seen = new Map<string, MealIdea>();

    for (const diet of DIET_DATABASE) {
      for (const option of slotOptions(diet, slot)) {
        const name = typeof option?.name === "string" ? option.name.trim() : "";
        if (!name) continue;

        const id = normalizeForMatch(name) || name.toLowerCase();
        const existing = seen.get(id);
        if (existing) {
          if (diet.name && !existing.diets.includes(diet.name)) {
            existing.diets.push(diet.name);
          }
          continue;
        }

        const idea: MealIdea = {
          key: `diet:${slot}:${id}`,
          name,
          slot,
          calories: toRange(option.calories),
          protein: toRange(option.protein),
          carbs: toRange(option.carbs),
          fat: toRange(option.fat),
          ...(option.isNigerian ? { isNigerian: true } : {}),
          ...(option.cuisine ? { cuisine: option.cuisine } : {}),
          diets: diet.name ? [diet.name] : [],
          origin: "diet",
        };
        seen.set(id, idea);
        bySlot[slot].push(idea);
      }
    }

    bySlot[slot].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { stamp: stampOf(), bySlot, foods: buildFoodIdeas() };
}

/**
 * Whole foods, held slot-agnostic. `slot` is stamped when they're handed out —
 * a banana is a banana whether it lands in breakfast or snack, and indexing one
 * copy per slot would quadruple the catalog for nothing.
 */
function buildFoodIdeas(): MealIdea[] {
  return FOOD_DICTIONARY.map((f: FoodItem) => ({
    key: `food:${f.id}`,
    name: f.name,
    slot: "snack" as MealType,
    calories: { min: Math.round(f.calories), max: Math.round(f.calories) },
    protein: { min: Math.round(f.protein), max: Math.round(f.protein) },
    carbs: { min: Math.round(f.carbs), max: Math.round(f.carbs) },
    fat: { min: Math.round(f.fat), max: Math.round(f.fat) },
    ...(f.isNigerian ? { isNigerian: true } : {}),
    ...(f.cuisine ? { cuisine: f.cuisine } : {}),
    diets: [] as string[],
    origin: "food" as const,
    serving: f.serving,
    foodId: f.id,
  }));
}

function getIndex(): Index {
  if (!index || index.stamp !== stampOf()) index = buildIndex();
  return index;
}

/**
 * Pull both catalogs in, then report. The bundled base diets mean
 * {@link mealsForSlot} already answers before this resolves — awaiting it is
 * how a screen learns the *complete* library has arrived and should re-render.
 */
export async function ensureMealCatalogLoaded(): Promise<void> {
  await Promise.all([
    ensureDietLibraryLoaded().catch(() => undefined),
    ensureFoodDictionaryLoaded().catch(() => undefined),
  ]);
  index = null;
}

/** True once there is anything at all to browse — the picker's "not blank" test. */
export function hasMealCatalog(): boolean {
  return MEAL_SLOTS.some((s) => getIndex().bySlot[s].length > 0);
}

/** Every known meal for a slot, alphabetical. */
export function mealsForSlot(slot: MealType): MealIdea[] {
  return getIndex().bySlot[slot];
}

/** Every whole food, stamped for the slot being planned. */
export function foodIdeas(slot: MealType): MealIdea[] {
  return getIndex().foods.map((f) => (f.slot === slot ? f : { ...f, slot }));
}

/**
 * The meals the widest range of diets agree on, best first.
 *
 * A real measurement, not an editorial "popular" badge: appearing in more of the
 * catalog's plans means more clinical contexts accept the meal. Ties break on
 * the shorter name, which keeps staples ahead of elaborate variants.
 */
export function popularForSlot(slot: MealType, limit = 8): MealIdea[] {
  return [...mealsForSlot(slot)]
    .sort((a, b) => b.diets.length - a.diets.length || a.name.length - b.name.length)
    .slice(0, limit);
}

/** Cuisines actually present for a slot, so a filter chip never leads to an empty list. */
export function cuisinesForSlot(slot: MealType): MealCuisine[] {
  const order: MealCuisine[] = ["Nigerian", "Western", "Mediterranean", "Universal"];
  const present = new Set(
    mealsForSlot(slot)
      .map((m) => m.cuisine)
      .filter((c): c is MealCuisine => !!c),
  );
  return order.filter((c) => present.has(c));
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Rank a pool against a query: substring hits first (shortest name wins, so
 * "egg" surfaces "Eggs" above "Egusi soup"), then fuzzy hits from the SAME
 * scorer the food log matches with, so a spelling that works in Gozlin works
 * here too.
 */
function rank(
  pool: MealIdea[],
  raw: string,
  normalized: string,
  limit: number,
): MealIdea[] {
  const substring: MealIdea[] = [];
  const rest: MealIdea[] = [];

  for (const idea of pool) {
    if (idea.name.toLowerCase().includes(raw)) substring.push(idea);
    else rest.push(idea);
  }
  substring.sort((a, b) => a.name.length - b.name.length);
  if (substring.length >= limit) return substring.slice(0, limit);

  const fuzzy = normalized
    ? rest
        .map((idea) => ({
          idea,
          score: similarity(normalized, normalizeForMatch(idea.name)),
        }))
        .filter((m) => m.score >= SUGGEST_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .map((m) => m.idea)
    : [];

  return [...substring, ...fuzzy].slice(0, limit);
}

/**
 * Search everything on device for a slot.
 *
 * `total === 0` is the precise condition the remote ladder waits for — see
 * FoodLookupService's local-first rule. It is deliberately computed BEFORE any
 * cuisine filter the UI applies: a meal hidden by a "Nigerian" chip is a meal we
 * have, and paying to go find it again would be both wasteful and wrong.
 */
export function searchMeals(slot: MealType, query: string): MealSearchResults {
  const raw = query.trim().toLowerCase();
  if (!raw) return { inSlot: [], otherSlots: [], foods: [], total: 0 };

  const normalized = normalizeForMatch(raw);
  const inSlot = rank(mealsForSlot(slot), raw, normalized, SEARCH_LIMIT);

  const seen = new Set(inSlot.map((m) => m.key));
  const otherPool = MEAL_SLOTS.filter((s) => s !== slot).flatMap((s) => mealsForSlot(s));
  const otherSlots = rank(otherPool, raw, normalized, SEARCH_LIMIT).filter((m) => {
    // The same dish can be authored into two slots. Show it once, in the slot
    // the user is actually planning.
    const id = m.key.split(":").slice(2).join(":");
    return !seen.has(`diet:${slot}:${id}`);
  });

  const foods = rank(foodIdeas(slot), raw, normalized, SEARCH_LIMIT);

  return {
    inSlot,
    otherSlots,
    foods,
    total: inSlot.length + otherSlots.length + foods.length,
  };
}

// ============================================================================
// PRESENTATION HELPERS
// ============================================================================

/** Scale a range by a serving multiplier, rounded to whole units. */
export function scaleRange(r: Range, servings: number): Range {
  return { min: Math.round(r.min * servings), max: Math.round(r.max * servings) };
}

/** Midpoint of a range — what a single "kcal" readout should say. */
export function midpoint(r: Range): number {
  return Math.round((r.min + r.max) / 2);
}

/** "420 kcal" or "380–520 kcal", never "420–420 kcal". */
export function formatRange(r: Range, unit = ""): string {
  const suffix = unit ? ` ${unit}` : "";
  return r.min === r.max ? `${r.min}${suffix}` : `${r.min}–${r.max}${suffix}`;
}
