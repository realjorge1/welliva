/**
 * NUTRIENT MODELS
 *
 * The full-panel nutrition layer. Where models/nutrition.ts holds the four
 * headline macros the plan is built around, this holds the complete label —
 * every fact we can state about a food — plus the provenance that makes each
 * number defensible.
 *
 * DESIGN RULE (non-negotiable): a number in a NutrientPanel must trace back to
 * a measured source. Nothing here is ever produced by a language model. Gozlin
 * may decide WHAT you ate ("two slices of bread"); only NutrientResolver may
 * say what that CONTAINS. See services/nutrition/NutrientResolver.ts.
 */

// ============================================================================
// THE PANEL
// ============================================================================

/**
 * Every nutrient we track. Ordered as they appear on an FDA label, then the
 * micronutrients worth surfacing. Adding a key here is additive — panels are
 * sparse and every consumer must tolerate `undefined` (meaning "not measured",
 * which is NOT the same as zero).
 */
export type NutrientKey =
  // Energy & macros
  | "calories"
  | "protein"
  | "fat"
  | "satFat"
  | "transFat"
  | "monoFat"
  | "polyFat"
  | "cholesterol"
  | "carbs"
  | "fiber"
  | "sugar"
  | "addedSugar"
  // Minerals
  | "sodium"
  | "potassium"
  | "calcium"
  | "iron"
  | "magnesium"
  | "zinc"
  // Vitamins
  | "vitaminA"
  | "vitaminC"
  | "vitaminD"
  | "vitaminE"
  | "vitaminK"
  | "vitaminB6"
  | "vitaminB12"
  | "folate"
  | "thiamin"
  | "riboflavin"
  | "niacin"
  // Other
  | "water"
  | "caffeine"
  | "alcohol";

/**
 * A nutrition panel. SPARSE BY DESIGN: a missing key means "this source didn't
 * measure it", never zero. Render missing values as "—", never as 0.
 */
export type NutrientPanel = Partial<Record<NutrientKey, number>>;

export type NutrientUnit = "kcal" | "g" | "mg" | "mcg";

export type NutrientGroup =
  | "energy"
  | "macro"
  | "fat"
  | "carb"
  | "mineral"
  | "vitamin"
  | "other";

export interface NutrientMeta {
  key: NutrientKey;
  label: string;
  unit: NutrientUnit;
  group: NutrientGroup;
  /**
   * FDA Daily Value (2016 label rule, adults & children ≥ 4 years). Used for
   * the "% DV" column. Null where no DV is established.
   */
  dv: number | null;
  /**
   * True when the DV is a ceiling to stay under (sodium, saturated fat) rather
   * than a floor to reach (fiber, potassium). Drives meter colour direction.
   */
  isLimit?: boolean;
  /** Shown on the full label by default; the rest live behind "show all". */
  onLabel?: boolean;
  /** Indented under its parent on the label, e.g. saturated fat under fat. */
  parent?: NutrientKey;
}

/**
 * Nutrient reference table. Daily Values are the FDA's 2016 Nutrition Facts
 * label reference values (21 CFR 101.9) — the same basis as any packaged food
 * in a store, so our "% DV" means exactly what a label means.
 */
export const NUTRIENT_META: Record<NutrientKey, NutrientMeta> = {
  calories: { key: "calories", label: "Calories", unit: "kcal", group: "energy", dv: 2000, onLabel: true },
  fat: { key: "fat", label: "Total Fat", unit: "g", group: "macro", dv: 78, onLabel: true },
  satFat: { key: "satFat", label: "Saturated Fat", unit: "g", group: "fat", dv: 20, isLimit: true, onLabel: true, parent: "fat" },
  transFat: { key: "transFat", label: "Trans Fat", unit: "g", group: "fat", dv: null, isLimit: true, onLabel: true, parent: "fat" },
  monoFat: { key: "monoFat", label: "Monounsaturated Fat", unit: "g", group: "fat", dv: null, parent: "fat" },
  polyFat: { key: "polyFat", label: "Polyunsaturated Fat", unit: "g", group: "fat", dv: null, parent: "fat" },
  cholesterol: { key: "cholesterol", label: "Cholesterol", unit: "mg", group: "macro", dv: 300, isLimit: true, onLabel: true },
  sodium: { key: "sodium", label: "Sodium", unit: "mg", group: "mineral", dv: 2300, isLimit: true, onLabel: true },
  carbs: { key: "carbs", label: "Total Carbohydrate", unit: "g", group: "macro", dv: 275, onLabel: true },
  fiber: { key: "fiber", label: "Dietary Fiber", unit: "g", group: "carb", dv: 28, onLabel: true, parent: "carbs" },
  sugar: { key: "sugar", label: "Total Sugars", unit: "g", group: "carb", dv: null, onLabel: true, parent: "carbs" },
  addedSugar: { key: "addedSugar", label: "Added Sugars", unit: "g", group: "carb", dv: 50, isLimit: true, onLabel: true, parent: "carbs" },
  protein: { key: "protein", label: "Protein", unit: "g", group: "macro", dv: 50, onLabel: true },
  vitaminD: { key: "vitaminD", label: "Vitamin D", unit: "mcg", group: "vitamin", dv: 20, onLabel: true },
  calcium: { key: "calcium", label: "Calcium", unit: "mg", group: "mineral", dv: 1300, onLabel: true },
  iron: { key: "iron", label: "Iron", unit: "mg", group: "mineral", dv: 18, onLabel: true },
  potassium: { key: "potassium", label: "Potassium", unit: "mg", group: "mineral", dv: 4700, onLabel: true },
  magnesium: { key: "magnesium", label: "Magnesium", unit: "mg", group: "mineral", dv: 420 },
  zinc: { key: "zinc", label: "Zinc", unit: "mg", group: "mineral", dv: 11 },
  vitaminA: { key: "vitaminA", label: "Vitamin A", unit: "mcg", group: "vitamin", dv: 900 },
  vitaminC: { key: "vitaminC", label: "Vitamin C", unit: "mg", group: "vitamin", dv: 90 },
  vitaminE: { key: "vitaminE", label: "Vitamin E", unit: "mg", group: "vitamin", dv: 15 },
  vitaminK: { key: "vitaminK", label: "Vitamin K", unit: "mcg", group: "vitamin", dv: 120 },
  vitaminB6: { key: "vitaminB6", label: "Vitamin B6", unit: "mg", group: "vitamin", dv: 1.7 },
  vitaminB12: { key: "vitaminB12", label: "Vitamin B12", unit: "mcg", group: "vitamin", dv: 2.4 },
  folate: { key: "folate", label: "Folate", unit: "mcg", group: "vitamin", dv: 400 },
  thiamin: { key: "thiamin", label: "Thiamin (B1)", unit: "mg", group: "vitamin", dv: 1.2 },
  riboflavin: { key: "riboflavin", label: "Riboflavin (B2)", unit: "mg", group: "vitamin", dv: 1.3 },
  niacin: { key: "niacin", label: "Niacin (B3)", unit: "mg", group: "vitamin", dv: 16 },
  water: { key: "water", label: "Water", unit: "g", group: "other", dv: null },
  caffeine: { key: "caffeine", label: "Caffeine", unit: "mg", group: "other", dv: null },
  alcohol: { key: "alcohol", label: "Alcohol", unit: "g", group: "other", dv: null },
};

/** Label order — how a Nutrition Facts panel reads, top to bottom. */
export const LABEL_ORDER: NutrientKey[] = [
  "calories",
  "fat",
  "satFat",
  "transFat",
  "cholesterol",
  "sodium",
  "carbs",
  "fiber",
  "sugar",
  "addedSugar",
  "protein",
  "vitaminD",
  "calcium",
  "iron",
  "potassium",
];

/** Everything else, shown when the user expands the full breakdown. */
export const EXTENDED_ORDER: NutrientKey[] = [
  "monoFat",
  "polyFat",
  "magnesium",
  "zinc",
  "vitaminA",
  "vitaminC",
  "vitaminE",
  "vitaminK",
  "vitaminB6",
  "vitaminB12",
  "folate",
  "thiamin",
  "riboflavin",
  "niacin",
  "caffeine",
  "alcohol",
];

// ============================================================================
// PROVENANCE — why we believe a number
// ============================================================================

/**
 * Where a panel's numbers came from. Every resolved food carries one, and the
 * UI always has the option to show it. If we can't say where a number came
 * from, we don't show the number as fact.
 */
export type NutrientSource =
  | {
      kind: "usda";
      /** FoodData Central ID — the number is verifiable at fdc.nal.usda.gov. */
      fdcId: number;
      dataset: "SR Legacy" | "Foundation" | "FNDDS" | "Branded";
      description: string;
    }
  | {
      kind: "wafct";
      /** West African Food Composition Table (FAO, 2012) — code + page. */
      code: string;
      description: string;
    }
  | {
      kind: "branded";
      brand: string;
      /** Manufacturer's declared panel (from the package). */
      description: string;
    }
  | {
      kind: "recipe";
      /** Composite dish computed by summing resolved ingredients. */
      componentIds: string[];
      description: string;
    }
  | {
      kind: "app";
      /** From the app's own meal/food catalog — macros only, no micronutrients. */
      description: string;
    }
  | {
      kind: "user";
      /** The user typed the numbers in themselves. Truth by assertion. */
      description: string;
    };

/**
 * How much to trust a resolved item. Surfaced in the UI verbatim — the user is
 * always told which of these they're looking at, and never shown "exact" for
 * anything that isn't.
 */
export type NutrientConfidence =
  /** Matched a measured reference entry with a known portion weight. */
  | "measured"
  /** Right food, but the portion size was inferred from a default. */
  | "portion-estimated"
  /** Composite dish summed from measured ingredients using a standard recipe. */
  | "recipe-estimated"
  /** Only the four macros are known; micronutrients are genuinely unknown. */
  | "macros-only"
  /** No reference match — nothing is asserted as fact. */
  | "unmatched";

export const CONFIDENCE_LABEL: Record<NutrientConfidence, string> = {
  measured: "Measured",
  "portion-estimated": "Estimated portion",
  "recipe-estimated": "Typical recipe",
  "macros-only": "Macros only",
  unmatched: "Not identified",
};

export const CONFIDENCE_NOTE: Record<NutrientConfidence, string> = {
  measured:
    "Matched to a reference food with a known serving weight. These figures are from the source shown.",
  "portion-estimated":
    "The food matched a reference entry, but we assumed a typical serving size. Adjust the amount for exact figures.",
  "recipe-estimated":
    "A mixed dish, calculated by adding up a standard recipe's ingredients. Real portions vary with how it's cooked.",
  "macros-only":
    "We know this food's calories and macros, but its vitamin and mineral content hasn't been measured in our reference data.",
  unmatched:
    "We couldn't match this to a reference food, so no nutrition figures are claimed.",
};

// ============================================================================
// FOOD RECORDS
// ============================================================================

export type FoodState = "raw" | "cooked" | "prepared" | "dry" | "as-served";

/** A household measure and what it weighs for this specific food. */
export interface PortionOption {
  /** Lowercase unit phrase as a user would say it: "cup", "medium", "slice". */
  unit: string;
  grams: number;
  /** Preferred default portion when the user gives no amount. */
  isDefault?: boolean;
}

/**
 * A canonical reference food: one measured entry, per 100 g, plus the household
 * portions that map onto it.
 */
export interface CanonicalFood {
  id: string;
  name: string;
  /** Lowercase search terms, including regional and colloquial names. */
  aliases: string[];
  group: string;
  state: FoodState;
  /** Nutrients per 100 g of edible portion, in NUTRIENT_META units. */
  per100g: NutrientPanel;
  portions: PortionOption[];
  source: NutrientSource;
  /**
   * Set when this entry is a composite dish rather than a single ingredient —
   * resolution reports it as recipe-estimated rather than measured.
   */
  isComposite?: boolean;
}

/**
 * One food, resolved to real numbers at a real portion. This is the unit the
 * whole feature trades in — Gozlin analysis, catalog logging and meal detail
 * all produce these.
 */
export interface ResolvedFoodItem {
  /** Stable id for this log line (not the food's id). */
  id: string;
  /** What the user actually said/selected, preserved verbatim. */
  inputText: string;
  /** Display name of the matched reference food. */
  name: string;
  /** Matched canonical food id, or null when unmatched. */
  foodId: string | null;
  quantity: number;
  unit: string;
  /** Resolved mass in grams — what the panel was actually scaled by. */
  grams: number;
  /** The nutrition of THIS portion (already scaled). Sparse. */
  nutrients: NutrientPanel;
  source: NutrientSource | null;
  confidence: NutrientConfidence;
  /** 0–1 string-match strength against the reference name. Diagnostics + UI. */
  matchScore: number;
  /** Other reference foods that nearly matched, for a "did you mean" swap. */
  alternatives?: { foodId: string; name: string; matchScore: number }[];
}

/**
 * The result of analysing one free-text description ("jollof rice and a boiled
 * egg"). Totals are the sum of resolved items only — never padded with guesses
 * for the unmatched ones.
 */
export interface FoodAnalysis {
  id: string;
  /** The raw text the user typed. */
  input: string;
  items: ResolvedFoodItem[];
  /** Sum over resolved items. Sparse: a nutrient is present only if EVERY
   *  contributing item measured it, so totals can never silently under-report. */
  totals: NutrientPanel;
  /** Nutrients that at least one item measured but not all — totals for these
   *  are partial and must be labelled as "at least". */
  partialKeys: NutrientKey[];
  /** Weakest confidence across items — the honest headline for the whole meal. */
  confidence: NutrientConfidence;
  /** Items we could not identify; surfaced so the user can correct them. */
  unmatched: string[];
  /** How the text was turned into items. */
  parsedBy: "local" | "ai";
  analyzedAt: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Scale a per-100g panel to an arbitrary gram weight. Preserves sparseness. */
export function scalePanel(
  per100g: NutrientPanel,
  grams: number,
): NutrientPanel {
  const factor = grams / 100;
  const out: NutrientPanel = {};
  for (const [k, v] of Object.entries(per100g)) {
    if (typeof v === "number") out[k as NutrientKey] = roundNutrient(k as NutrientKey, v * factor);
  }
  return out;
}

/**
 * Round to the precision the nutrient is actually meaningful at. Reporting
 * "0.8331 mcg of B12" implies a precision the source doesn't have.
 */
export function roundNutrient(key: NutrientKey, value: number): number {
  const unit = NUTRIENT_META[key]?.unit;
  if (unit === "kcal") return Math.round(value);
  if (unit === "mcg") return Math.round(value * 10) / 10;
  if (unit === "mg") return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  // grams
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
}

/**
 * Add panels together. A nutrient survives into the sum only if EVERY panel
 * measured it — otherwise the total would silently under-report (e.g. summing
 * a meal where only one of three items has iron data would make the day look
 * iron-poor). Keys present in some but not all are returned in `partialKeys`
 * with their partial sum, so the UI can label them "at least X".
 */
export function sumPanels(panels: NutrientPanel[]): {
  totals: NutrientPanel;
  partialKeys: NutrientKey[];
} {
  if (panels.length === 0) return { totals: {}, partialKeys: [] };

  const sums = new Map<NutrientKey, number>();
  const counts = new Map<NutrientKey, number>();

  for (const panel of panels) {
    for (const [k, v] of Object.entries(panel)) {
      if (typeof v !== "number") continue;
      const key = k as NutrientKey;
      sums.set(key, (sums.get(key) ?? 0) + v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const totals: NutrientPanel = {};
  const partialKeys: NutrientKey[] = [];
  for (const [key, sum] of sums) {
    totals[key] = roundNutrient(key, sum);
    if ((counts.get(key) ?? 0) < panels.length) partialKeys.push(key);
  }
  return { totals, partialKeys };
}

/** Percent of the FDA Daily Value, or null when no DV exists. */
export function percentDV(key: NutrientKey, value: number): number | null {
  const dv = NUTRIENT_META[key]?.dv;
  if (!dv) return null;
  return Math.round((value / dv) * 100);
}

/** Format a value with its unit for display, e.g. "12.4 g", "310 mg". */
export function formatNutrient(key: NutrientKey, value: number): string {
  const meta = NUTRIENT_META[key];
  if (!meta) return String(value);
  const rounded = roundNutrient(key, value);
  return meta.unit === "kcal" ? `${rounded}` : `${rounded} ${meta.unit}`;
}

/** The weakest (most cautious) confidence in a set — how a meal is labelled. */
export function weakestConfidence(
  list: NutrientConfidence[],
): NutrientConfidence {
  const rank: Record<NutrientConfidence, number> = {
    measured: 0,
    "portion-estimated": 1,
    "recipe-estimated": 2,
    "macros-only": 3,
    unmatched: 4,
  };
  return list.reduce<NutrientConfidence>(
    (worst, c) => (rank[c] > rank[worst] ? c : worst),
    "measured",
  );
}

/** One-line human attribution for a source, e.g. "USDA FoodData Central #173687". */
export function describeSource(source: NutrientSource | null): string {
  if (!source) return "No reference source";
  switch (source.kind) {
    case "usda":
      return `USDA FoodData Central · ${source.dataset} #${source.fdcId}`;
    case "wafct":
      return `West African Food Composition Table (FAO) · ${source.code}`;
    case "branded":
      return `${source.brand} — declared label`;
    case "recipe":
      return `Calculated from ${source.componentIds.length} reference ingredients`;
    case "app":
      return "Welliva meal catalog (macros only)";
    case "user":
      return "Entered by you";
  }
}
