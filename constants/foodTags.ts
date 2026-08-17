/**
 * foodTags — what a catalog food IS, for the "Fits my diet" filter.
 *
 * FOOD_DICTIONARY carries a display `group` and four macros, and neither can
 * answer "may a vegan eat this?". `group` in particular looks like it should:
 * it can't. "Proteins" holds chicken next to tilapia next to egg white, and
 * "Dairy & Alternatives" holds cheddar next to almond milk. Deriving diet
 * suitability from the group would be wrong in both directions.
 *
 * So this is an explicit table keyed on the catalog's stable slug ids. It is
 * hand-written and reviewable on purpose — the alternative is keyword-sniffing
 * food names, which is exactly how a tracker ends up telling a shellfish
 * allergic user that crayfish is fine.
 *
 * ── FAILING SAFE ──────────────────────────────────────────────────────────────
 * The catalog is fetched at runtime and can gain foods this table has never
 * seen. An unknown id must therefore NOT default to "plant, allergen-free" —
 * that default hands a steak to a vegan the day someone adds one. Instead
 * {@link tagsFor} falls back on the food's group: anything unrecognised in
 * Proteins is treated as meat, and anything unrecognised in Dairy is treated as
 * dairy. Over-excluding an unknown food is a visible, harmless annoyance;
 * under-excluding it is the failure that matters.
 *
 * NOT A MEDICAL SAFEGUARD. This filter tidies a browse list. It is not an
 * ingredient audit, it cannot know how a dish was prepared, and the UI says so
 * where the user turns it on.
 */

import type { FoodItem } from "./FoodDictionary";

/**
 * What a food contains, as far as diet suitability is concerned. A food carries
 * every tag that applies — dried crayfish is `shellfish`, chocolate malt powder
 * is both `dairy` and `gluten`.
 */
export type FoodTag =
  /** Land animal flesh or organ, poultry and game included. */
  | "meat"
  /** Pig-derived. Also carries `meat`; split out for halal/kosher. */
  | "pork"
  /** Fin fish. Permitted for pescatarians, not vegetarians. */
  | "fish"
  /** Crustacean or mollusc — the allergen grouping, not the taxonomy. */
  | "shellfish"
  | "egg"
  | "dairy"
  | "gluten"
  /** Tree nut, per the FDA's grouping (which includes coconut). */
  | "nuts"
  | "peanut"
  | "soy"
  | "sesame";

/**
 * Explicit tags per catalog id. Foods absent from this map and from a fallback
 * group (see {@link tagsFor}) are plain plant foods carrying no common allergen.
 *
 * ADDING FOODS: tag what the food IS, not what a recipe might put with it. A
 * plain boiled yam is untagged even though it's often eaten with fish stew.
 */
const TAGS: Record<string, FoodTag[]> = {
  // ── Proteins ──────────────────────────────────────────────────────────────
  "chicken-breast-skinless": ["meat"],
  "chicken-thigh": ["meat"],
  "turkey-breast": ["meat"],
  "beef-lean": ["meat"],
  "goat-meat": ["meat"],
  lamb: ["meat"],
  pork: ["meat", "pork"],
  "beef-liver": ["meat"],
  "chicken-gizzard": ["meat"],
  "ponmo-cow-skin": ["meat"],
  egg: ["egg"],
  "egg-white": ["egg"],
  tilapia: ["fish"],
  "mackerel-titus": ["fish"],
  catfish: ["fish"],
  sardines: ["fish"],
  salmon: ["fish"],
  "tuna-canned-in-water": ["fish"],
  cod: ["fish"],
  "stockfish-okporoko": ["fish"],
  "dried-fish": ["fish"],
  "prawns-shrimp": ["shellfish"],
  "crayfish-dried": ["shellfish"],
  snail: ["shellfish"],
  periwinkle: ["shellfish"],

  // ── Dairy & Alternatives ──────────────────────────────────────────────────
  "whole-milk": ["dairy"],
  "skim-milk": ["dairy"],
  "evaporated-milk": ["dairy"],
  "powdered-milk": ["dairy"],
  "greek-yogurt-plain": ["dairy"],
  "yogurt-plain": ["dairy"],
  "cheddar-cheese": ["dairy"],
  "wara-local-cheese": ["dairy"],
  "nono-fermented-milk": ["dairy"],
  "cottage-cheese": ["dairy"],
  "ice-cream": ["dairy"],
  // The two plant entries in that group — listed so the group fallback below
  // doesn't sweep them up as dairy.
  "soy-milk": ["soy"],
  "almond-milk-unsweetened": ["nuts"],

  // ── Legumes & Plant Protein ───────────────────────────────────────────────
  soybeans: ["soy"],
  tofu: ["soy"],
  tempeh: ["soy"],
  edamame: ["soy"],

  // ── Grains & Starches ─────────────────────────────────────────────────────
  // Wheat, barley and rye derivatives. Oats are deliberately NOT tagged: the
  // grain is gluten-free and only risks cross-contamination, which is a
  // packaging question this table can't answer.
  "whole-wheat-bread": ["gluten"],
  "white-bread": ["gluten"],
  "agege-bread": ["gluten"],
  "pasta-spaghetti": ["gluten"],
  "semovita-semolina-swallow": ["gluten"],
  "wheat-swallow": ["gluten"],
  couscous: ["gluten"],
  bulgur: ["gluten"],
  barley: ["gluten"],
  // Standard cornflakes are malted with barley.
  cornflakes: ["gluten"],

  // ── Nuts, Seeds, Fats & Oils ──────────────────────────────────────────────
  almonds: ["nuts"],
  cashews: ["nuts"],
  walnuts: ["nuts"],
  pistachios: ["nuts"],
  "peanuts-groundnuts": ["peanut"],
  "groundnut-oil": ["peanut"],
  "peanut-butter": ["peanut"],
  "sesame-benniseed": ["sesame"],
  butter: ["dairy"],
  // Tiger nuts are a tuber, not a nut, and are safe for tree-nut allergy — the
  // name is the only nutty thing about them. Left untagged on purpose.

  // ── Fruits & Beverages ────────────────────────────────────────────────────
  // The FDA groups coconut with tree nuts, so anyone filtering on tree nuts has
  // it excluded. Refined coconut oil is tagged too: for a browse filter the
  // cautious call costs one hidden row.
  "coconut-fresh": ["nuts"],
  "coconut-oil": ["nuts"],
  "coconut-water": ["nuts"],
  "tiger-nut-milk-kunu-aya": [],
  "chocolate-malt-drink-powder": ["dairy", "gluten"],

  // ── FOOD_SEED only ────────────────────────────────────────────────────────
  // The bundled offline seed (constants/foodSeed) uses its OWN ids and its own
  // group labels — "chicken-breast" not "chicken-breast-skinless", "Dairy" not
  // "Dairy & Alternatives". It is what the Foods screen shows on a first launch
  // with no network, so it needs covering too or the diet filter quietly does
  // nothing offline for exactly the foods that matter most.
  "chicken-breast": ["meat"],
  milk: ["dairy"],
  cheddar: ["dairy"],
  "greek-yogurt": ["dairy"],
  // Composite dishes. Their contents vary by cook, but these two reliably carry
  // animal protein — egusi is built on meat and fish, and jollof is normally
  // cooked in a meat or chicken stock. A browse filter that showed them to a
  // vegan would be wrong far more often than it was right.
  "egusi-soup": ["meat", "fish"],
  "jollof-rice": ["meat"],
  // Beans porridge is a plant dish by default (palm oil, no stock), so it is
  // deliberately left untagged rather than excluded on a maybe.
};

/**
 * Groups whose unknown members are assumed animal-derived. See the failing-safe
 * note at the top: a food this table has never seen, sitting in the Proteins
 * group, is far likelier to be meat than to be a new vegetable.
 */
const GROUP_FALLBACK: Record<string, FoodTag[]> = {
  Proteins: ["meat"],
  "Dairy & Alternatives": ["dairy"],
  // FOOD_SEED's own label for the same group. Both spellings are live: which
  // one the user sees depends on whether the remote catalog has downloaded yet.
  Dairy: ["dairy"],
};

const EMPTY: readonly FoodTag[] = [];

/** Everything a food contains, explicit tags first, group fallback otherwise. */
export function tagsFor(food: FoodItem): readonly FoodTag[] {
  const explicit = TAGS[food.id];
  if (explicit) return explicit;
  return GROUP_FALLBACK[food.group] ?? EMPTY;
}

export function hasTag(food: FoodItem, tag: FoodTag): boolean {
  return tagsFor(food).includes(tag);
}

// ============================================================================
// DIET SUITABILITY
// ============================================================================

/** Tags each DietaryRestriction rules out. Keys match models/user's union. */
const RESTRICTION_EXCLUDES: Record<string, FoodTag[]> = {
  none: [],
  vegetarian: ["meat", "pork", "fish", "shellfish"],
  vegan: ["meat", "pork", "fish", "shellfish", "egg", "dairy"],
  pescatarian: ["meat", "pork"],
  halal: ["pork"],
  // Shellfish is non-kosher alongside pork; the dairy/meat separation rule is
  // about combinations rather than single foods, so it isn't modelled here.
  kosher: ["pork", "shellfish"],
  gluten_free: ["gluten"],
  dairy_free: ["dairy"],
};

/**
 * Allergy tokens (models/user's CommonAllergy) → the tags they exclude. Free
 * text allergies the user typed themselves aren't in here; those are matched
 * against the food's NAME instead, in {@link excludedTagsFor}'s caller.
 */
const ALLERGY_EXCLUDES: Record<string, FoodTag[]> = {
  peanuts: ["peanut"],
  tree_nuts: ["nuts"],
  dairy: ["dairy"],
  eggs: ["egg"],
  shellfish: ["shellfish"],
  fish: ["fish"],
  wheat: ["gluten"],
  gluten: ["gluten"],
  soy: ["soy"],
};

export interface DietProfile {
  dietaryRestriction?: string;
  allergies?: string[];
  foodDislikes?: string[];
}

/** Every tag this user's restriction + known allergies rule out. */
export function excludedTagsFor(profile: DietProfile): Set<FoodTag> {
  const out = new Set<FoodTag>();
  for (const t of RESTRICTION_EXCLUDES[profile.dietaryRestriction ?? "none"] ?? []) {
    out.add(t);
  }
  for (const a of profile.allergies ?? []) {
    for (const t of ALLERGY_EXCLUDES[a] ?? []) out.add(t);
  }
  return out;
}

/**
 * Free-text terms to match against food NAMES — the user's custom allergies and
 * their dislikes. Kept separate from tags because "I don't like okra" is a fact
 * about one food, not a category.
 */
export function excludedTermsFor(profile: DietProfile): string[] {
  const custom = (profile.allergies ?? []).filter((a) => !(a in ALLERGY_EXCLUDES));
  return [...custom, ...(profile.foodDislikes ?? [])]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3);
}

/**
 * Whether a food survives the user's diet. Name matching for the free-text
 * terms is a substring test — deliberately blunt, because "I said no okra" must
 * also catch "okra soup".
 */
export function fitsDiet(
  food: FoodItem,
  excludedTags: Set<FoodTag>,
  excludedTerms: string[],
): boolean {
  if (excludedTags.size > 0) {
    for (const tag of tagsFor(food)) {
      if (excludedTags.has(tag)) return false;
    }
  }
  if (excludedTerms.length > 0) {
    const name = food.name.toLowerCase();
    if (excludedTerms.some((t) => name.includes(t))) return false;
  }
  return true;
}

/** True when the profile actually constrains anything — drives showing the chip. */
export function hasDietConstraints(profile: DietProfile): boolean {
  return excludedTagsFor(profile).size > 0 || excludedTermsFor(profile).length > 0;
}
