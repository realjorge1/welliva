/**
 * foodFilters — every way the Foods catalog can be narrowed, as data.
 *
 * ── WHY THESE AND NOT MORE ───────────────────────────────────────────────────
 * The obvious wish-list is bigger than this: high fibre, low sodium, sugar-free,
 * iron-rich, low cholesterol. None of those are here, and the reason matters.
 *
 * Only TWO things are known for all 205 catalog foods: the four macros, and the
 * diet/allergen tags in ./foodTags. Micronutrients come from CANONICAL_FOODS,
 * which covers 44 foods — about 21% of the catalog. A "high fibre" chip built on
 * that would hide beans, oats and greens from the results not because they're
 * low in fibre but because nobody has entered their fibre yet. That is the same
 * confidently-wrong failure NutrientResolver refuses to commit, and a filter is
 * no place to start committing it.
 *
 * So: when the reference table covers the catalog, micronutrient filters can be
 * added here and they'll be honest. Until then these are the filters whose
 * answers are actually true for every food.
 *
 * ── THRESHOLDS ARE THE FDA'S, NOT OURS ───────────────────────────────────────
 * Where a nutrient content claim is legally defined, this file uses that exact
 * definition and cites it. "Low fat" means what it means on a packet in a shop —
 * 21 CFR 101.62 — rather than a number someone here liked the look of. The two
 * without a regulatory definition (low carb, calorie-dense) say so in their
 * description instead of implying an authority they don't have.
 *
 * models/nutrients.ts already cites 21 CFR 101.9 for its Daily Values, so this
 * is the same standard the rest of the nutrition layer is built on.
 */

import {
  isHighProtein,
  isKetoFriendly,
  isLowCalorie,
  type FoodItem,
} from "./FoodDictionary";
import { tagsFor, type FoodTag } from "./foodTags";

export type FoodFilterGroup = "nutrition" | "diet" | "origin";

export interface FoodFilter {
  key: string;
  label: string;
  /** The actual rule, shown in the filter sheet and spoken as the a11y hint. */
  description: string;
  group: FoodFilterGroup;
  test: (f: FoodItem) => boolean;
}

export const FILTER_GROUP_LABEL: Record<FoodFilterGroup, string> = {
  nutrition: "Nutrition",
  diet: "Diet & allergens",
  origin: "Origin",
};

/** A food carries none of these tags. The shape every diet filter takes. */
function free(...tags: FoodTag[]) {
  return (f: FoodItem) => {
    const has = tagsFor(f);
    return !tags.some((t) => has.includes(t));
  };
}

// ============================================================================
// NUTRITION — complete data, all 205 foods
// ============================================================================

const NUTRITION: FoodFilter[] = [
  {
    key: "protein",
    label: "High protein",
    description: "10 g or more per serving — the FDA's “high in” threshold (20% DV)",
    group: "nutrition",
    test: isHighProtein,
  },
  {
    key: "keto",
    label: "Low carb",
    description: "10 g of carbs or less per serving (keto convention — no legal definition)",
    group: "nutrition",
    test: isKetoFriendly,
  },
  {
    key: "light",
    label: "Low calorie",
    description: "40 calories or fewer per serving — FDA 21 CFR 101.60",
    group: "nutrition",
    test: isLowCalorie,
  },
  {
    key: "lowfat",
    label: "Low fat",
    description: "3 g of fat or less per serving — FDA 21 CFR 101.62",
    group: "nutrition",
    test: (f) => f.fat <= 3,
  },
  {
    key: "fatfree",
    label: "Fat free",
    description: "Under 0.5 g of fat per serving — FDA 21 CFR 101.62",
    group: "nutrition",
    test: (f) => f.fat < 0.5,
  },
  {
    key: "energy",
    label: "Energy dense",
    description:
      "200 calories or more per serving — useful when you're eating to gain (no legal definition)",
    group: "nutrition",
    test: (f) => f.calories >= 200,
  },
  {
    key: "carbs",
    label: "High carb",
    description:
      "30 g of carbs or more per serving — for fuelling training (no legal definition)",
    group: "nutrition",
    test: (f) => f.carbs >= 30,
  },
];

// ============================================================================
// DIET & ALLERGENS — complete data via ./foodTags
// ============================================================================

const DIET: FoodFilter[] = [
  {
    key: "plant",
    label: "Plant-based",
    description: "No meat, fish, shellfish, egg or dairy",
    group: "diet",
    test: free("meat", "pork", "fish", "shellfish", "egg", "dairy"),
  },
  {
    key: "vegetarian",
    label: "Vegetarian",
    description: "No meat, fish or shellfish. Egg and dairy included",
    group: "diet",
    test: free("meat", "pork", "fish", "shellfish"),
  },
  {
    key: "pescatarian",
    label: "Pescatarian",
    description: "No meat. Fish and shellfish included",
    group: "diet",
    test: free("meat", "pork"),
  },
  {
    key: "dairyfree",
    label: "Dairy free",
    description: "No milk, cheese, yogurt or butter",
    group: "diet",
    test: free("dairy"),
  },
  {
    key: "glutenfree",
    label: "Gluten free",
    description: "No wheat, barley or rye. Oats aren't excluded — the grain is gluten free",
    group: "diet",
    test: free("gluten"),
  },
  {
    key: "nutfree",
    label: "Nut free",
    description: "No tree nuts or peanuts. Coconut is excluded too (the FDA groups it with tree nuts)",
    group: "diet",
    test: free("nuts", "peanut"),
  },
  {
    key: "eggfree",
    label: "Egg free",
    description: "No egg in any form — whole, white or yolk",
    group: "diet",
    test: free("egg"),
  },
  {
    key: "soyfree",
    label: "Soy free",
    description: "No soy, tofu, tempeh or edamame",
    group: "diet",
    test: free("soy"),
  },
  {
    key: "sesamefree",
    label: "Sesame free",
    description: "No sesame or benniseed",
    group: "diet",
    test: free("sesame"),
  },
  {
    key: "halal",
    label: "Halal friendly",
    description: "No pork. Doesn't check how meat was slaughtered — that isn't in our data",
    group: "diet",
    test: free("pork"),
  },
  {
    key: "kosher",
    label: "Kosher friendly",
    description:
      "No pork or shellfish. Doesn't check certification or meat-and-dairy separation",
    group: "diet",
    test: free("pork", "shellfish"),
  },
];

// ============================================================================
// ORIGIN
// ============================================================================

const ORIGIN: FoodFilter[] = [
  {
    key: "nigerian",
    label: "Nigerian & West African",
    description: "Staples, soups and produce from the region",
    group: "origin",
    test: (f) => f.isNigerian === true,
  },
];

/** Every filter, in the order the sheet renders them. */
export const ALL_FOOD_FILTERS: FoodFilter[] = [...NUTRITION, ...DIET, ...ORIGIN];

/**
 * The few shown as chips directly on the screen. Everything else lives behind
 * the filter sheet — nineteen chips in a scroller is a haystack, not a control.
 */
export const QUICK_FILTER_KEYS = ["protein", "keto", "light", "plant"] as const;

export const FILTERS_BY_GROUP: { group: FoodFilterGroup; filters: FoodFilter[] }[] = [
  { group: "nutrition", filters: NUTRITION },
  { group: "diet", filters: DIET },
  { group: "origin", filters: ORIGIN },
];

export function getFilter(key: string): FoodFilter | undefined {
  return ALL_FOOD_FILTERS.find((f) => f.key === key);
}

/** Apply a set of filter keys. Filters AND together — each one narrows further. */
export function applyFoodFilters(list: FoodItem[], keys: Set<string>): FoodItem[] {
  if (keys.size === 0) return list;
  const active = ALL_FOOD_FILTERS.filter((f) => keys.has(f.key));
  if (active.length === 0) return list;
  return list.filter((food) => active.every((f) => f.test(food)));
}
