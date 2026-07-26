/**
 * NutrientDatabase — the canonical reference table.
 *
 * WHY THIS EXISTS
 * The app already ships FOOD_DICTIONARY (205 foods) and DIET_DATABASE (meal
 * options), but both carry only four macros and no citation. That's fine for
 * building a plan; it is NOT fine for answering "what exactly did I just eat?"
 * — a question that demands micronutrients and a source the user can check.
 *
 * Every entry here is per 100 g of edible portion and carries a `source` that
 * identifies the exact reference record. USDA entries can be verified at
 * fdc.nal.usda.gov by their FDC ID. West African staples that USDA doesn't
 * cover use the FAO West African Food Composition Table (2012) and are labelled
 * as such — the user is always told which body measured their food.
 *
 * Composite dishes (jollof rice, moi moi) are marked `isComposite`: they are
 * standard-recipe calculations, and the resolver downgrades them to
 * "recipe-estimated" so we never present a home-cooked pot as a lab measurement.
 *
 * ADDING ENTRIES: values must come from a published composition table with an
 * identifier. Do not add a food by estimating from a similar one — the resolver
 * already degrades gracefully to macros-only via FOOD_DICTIONARY, and an honest
 * gap beats an invented number.
 */

import type { CanonicalFood, NutrientPanel, PortionOption } from "../models/nutrients";

// ============================================================================
// BUILDERS
// ============================================================================

const g = (unit: string, grams: number, isDefault = false): PortionOption => ({
  unit,
  grams,
  ...(isDefault ? { isDefault: true } : {}),
});

/** USDA FoodData Central reference. */
function usda(
  fdcId: number,
  description: string,
  dataset: "SR Legacy" | "Foundation" | "FNDDS" = "SR Legacy",
) {
  return { kind: "usda" as const, fdcId, dataset, description };
}

/** FAO West African Food Composition Table (2012). */
function wafct(code: string, description: string) {
  return { kind: "wafct" as const, code, description };
}

/** A dish computed by summing reference ingredients at standard recipe ratios. */
function recipe(componentIds: string[], description: string) {
  return { kind: "recipe" as const, componentIds, description };
}

// ============================================================================
// THE TABLE
// ============================================================================

export const CANONICAL_FOODS: CanonicalFood[] = [
  // ---------------------------------------------------------------- EGGS ---
  {
    id: "egg_boiled",
    name: "Egg, hard-boiled",
    aliases: ["egg", "eggs", "boiled egg", "hard boiled egg", "hard-boiled egg", "cooked egg"],
    group: "Protein",
    state: "cooked",
    per100g: {
      calories: 155, protein: 12.58, fat: 10.61, satFat: 3.267, monoFat: 4.077,
      polyFat: 1.414, cholesterol: 373, carbs: 1.12, fiber: 0, sugar: 1.12,
      sodium: 124, potassium: 126, calcium: 50, iron: 1.19, magnesium: 10,
      zinc: 1.05, vitaminA: 149, vitaminD: 2.2, vitaminE: 1.03, vitaminK: 0.3,
      vitaminB6: 0.121, vitaminB12: 1.11, folate: 44, thiamin: 0.066,
      riboflavin: 0.513, niacin: 0.064, water: 74.62,
    },
    portions: [g("large", 50, true), g("medium", 44), g("small", 38), g("egg", 50)],
    source: usda(173424, "Egg, whole, cooked, hard-boiled"),
  },
  {
    id: "egg_fried",
    name: "Egg, fried",
    aliases: ["fried egg", "fried eggs", "egg fried", "sunny side up"],
    group: "Protein",
    state: "cooked",
    per100g: {
      calories: 196, protein: 13.63, fat: 14.84, satFat: 4.128, monoFat: 6.16,
      polyFat: 2.53, cholesterol: 401, carbs: 0.83, fiber: 0, sugar: 0.44,
      sodium: 207, potassium: 138, calcium: 62, iron: 1.89, magnesium: 13,
      zinc: 1.33, vitaminA: 187, vitaminD: 2.2, vitaminE: 1.71,
      vitaminB6: 0.176, vitaminB12: 1.07, folate: 51, thiamin: 0.043,
      riboflavin: 0.495, niacin: 0.079, water: 69.47,
    },
    portions: [g("large", 46, true), g("egg", 46)],
    source: usda(172184, "Egg, whole, cooked, fried"),
  },

  // -------------------------------------------------------------- POULTRY ---
  {
    id: "chicken_breast_roasted",
    name: "Chicken breast, roasted (skinless)",
    aliases: ["chicken breast", "chicken", "grilled chicken", "roast chicken", "chicken breast grilled", "skinless chicken breast"],
    group: "Protein",
    state: "cooked",
    per100g: {
      calories: 165, protein: 31.02, fat: 3.57, satFat: 1.01, monoFat: 1.24,
      polyFat: 0.77, cholesterol: 85, carbs: 0, fiber: 0, sugar: 0,
      sodium: 74, potassium: 256, calcium: 15, iron: 1.04, magnesium: 29,
      zinc: 1.0, vitaminA: 9, vitaminE: 0.27, vitaminK: 0.3,
      vitaminB6: 0.6, vitaminB12: 0.34, folate: 4, thiamin: 0.07,
      riboflavin: 0.114, niacin: 13.712, water: 65.26,
    },
    portions: [g("breast", 172), g("fillet", 120), g("piece", 100), g("serving", 100, true)],
    source: usda(171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted"),
  },
  {
    id: "chicken_thigh_roasted",
    name: "Chicken thigh, roasted",
    aliases: ["chicken thigh", "chicken thighs", "chicken leg", "drumstick"],
    group: "Protein",
    state: "cooked",
    per100g: {
      calories: 209, protein: 26.0, fat: 10.9, satFat: 3.05, monoFat: 4.24,
      polyFat: 2.46, cholesterol: 135, carbs: 0, fiber: 0,
      sodium: 88, potassium: 230, calcium: 12, iron: 1.28, magnesium: 23,
      zinc: 2.06, vitaminA: 20, vitaminB6: 0.36, vitaminB12: 0.68,
      folate: 8, thiamin: 0.073, riboflavin: 0.211, niacin: 6.24, water: 62.4,
    },
    portions: [g("thigh", 111), g("piece", 100), g("serving", 100, true)],
    source: usda(171122, "Chicken, broilers or fryers, thigh, meat only, cooked, roasted"),
  },

  // ------------------------------------------------------------- RED MEAT ---
  {
    id: "beef_ground_85",
    name: "Ground beef, 85% lean, browned",
    aliases: ["ground beef", "minced beef", "beef mince", "hamburger meat", "beef"],
    group: "Protein",
    state: "cooked",
    per100g: {
      calories: 250, protein: 25.93, fat: 15.41, satFat: 6.04, monoFat: 6.75,
      polyFat: 0.47, cholesterol: 85, carbs: 0, fiber: 0,
      sodium: 74, potassium: 331, calcium: 24, iron: 2.53, magnesium: 21,
      zinc: 5.96, vitaminB6: 0.35, vitaminB12: 2.44, folate: 8,
      thiamin: 0.045, riboflavin: 0.193, niacin: 5.379, water: 58.61,
    },
    portions: [g("serving", 100, true), g("patty", 85), g("oz", 28.35)],
    source: usda(174032, "Beef, ground, 85% lean meat / 15% fat, patty, cooked, pan-broiled"),
  },

  // ----------------------------------------------------------------- FISH ---
  {
    id: "salmon_cooked",
    name: "Salmon, cooked",
    aliases: ["salmon", "grilled salmon", "baked salmon", "salmon fillet"],
    group: "Protein",
    state: "cooked",
    per100g: {
      calories: 206, protein: 22.1, fat: 12.35, satFat: 3.05, monoFat: 4.44,
      polyFat: 3.88, cholesterol: 63, carbs: 0, fiber: 0,
      sodium: 61, potassium: 384, calcium: 15, iron: 0.34, magnesium: 30,
      zinc: 0.43, vitaminA: 63, vitaminC: 3.9, vitaminD: 13.1, vitaminE: 3.55,
      vitaminB6: 0.6, vitaminB12: 3.18, folate: 34, thiamin: 0.226,
      riboflavin: 0.155, niacin: 8.672, water: 64.89,
    },
    portions: [g("fillet", 154), g("serving", 100, true), g("oz", 28.35)],
    source: usda(175168, "Fish, salmon, Atlantic, farmed, cooked, dry heat"),
  },
  {
    id: "tuna_canned_water",
    name: "Tuna, canned in water",
    aliases: ["tuna", "canned tuna", "tinned tuna", "tuna fish"],
    group: "Protein",
    state: "as-served",
    per100g: {
      calories: 116, protein: 25.51, fat: 0.82, satFat: 0.234, monoFat: 0.142,
      polyFat: 0.291, cholesterol: 30, carbs: 0, fiber: 0,
      sodium: 247, potassium: 237, calcium: 11, iron: 1.63, magnesium: 27,
      zinc: 0.65, vitaminA: 16, vitaminD: 1.7, vitaminB6: 0.32,
      vitaminB12: 2.99, folate: 4, thiamin: 0.032, riboflavin: 0.074,
      niacin: 11.033, water: 74.51,
    },
    portions: [g("can", 142), g("serving", 100, true), g("oz", 28.35)],
    source: usda(175159, "Fish, tuna, light, canned in water, drained solids"),
  },

  // ------------------------------------------------------------- GRAINS ---
  {
    id: "rice_white_cooked",
    name: "White rice, cooked",
    aliases: ["rice", "white rice", "boiled rice", "steamed rice", "plain rice", "cooked rice"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 130, protein: 2.69, fat: 0.28, satFat: 0.077, monoFat: 0.088,
      polyFat: 0.075, cholesterol: 0, carbs: 28.17, fiber: 0.4, sugar: 0.05,
      sodium: 1, potassium: 35, calcium: 10, iron: 1.2, magnesium: 12,
      zinc: 0.49, vitaminB6: 0.093, folate: 58, thiamin: 0.163,
      riboflavin: 0.013, niacin: 1.476, water: 68.44,
    },
    portions: [g("cup", 158, true), g("serving", 158), g("plate", 250), g("bowl", 200)],
    source: usda(169756, "Rice, white, long-grain, regular, enriched, cooked"),
  },
  {
    id: "rice_brown_cooked",
    name: "Brown rice, cooked",
    aliases: ["brown rice", "wholegrain rice", "whole grain rice"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 123, protein: 2.74, fat: 0.97, satFat: 0.196, monoFat: 0.281,
      polyFat: 0.313, carbs: 25.58, fiber: 1.6, sugar: 0.24,
      sodium: 4, potassium: 86, calcium: 3, iron: 0.56, magnesium: 39,
      zinc: 0.71, vitaminB6: 0.145, folate: 4, thiamin: 0.102,
      riboflavin: 0.012, niacin: 1.53, water: 70.27,
    },
    portions: [g("cup", 195, true), g("serving", 195)],
    source: usda(168880, "Rice, brown, long-grain, cooked"),
  },
  {
    id: "bread_white",
    name: "White bread",
    aliases: ["bread", "white bread", "slice of bread", "toast", "sliced bread"],
    group: "Grains & Starches",
    state: "as-served",
    per100g: {
      calories: 266, protein: 7.64, fat: 3.29, satFat: 0.717, monoFat: 0.681,
      polyFat: 1.317, cholesterol: 0, carbs: 50.61, fiber: 2.4, sugar: 5.34,
      sodium: 490, potassium: 100, calcium: 151, iron: 3.61, magnesium: 23,
      zinc: 0.74, vitaminB6: 0.09, folate: 171, thiamin: 0.535,
      riboflavin: 0.431, niacin: 4.77, water: 36.42,
    },
    portions: [g("slice", 25, true), g("piece", 25), g("loaf", 800)],
    source: usda(172686, "Bread, white, commercially prepared"),
  },
  {
    id: "bread_wholewheat",
    name: "Whole wheat bread",
    aliases: ["whole wheat bread", "wholemeal bread", "brown bread", "wheat bread"],
    group: "Grains & Starches",
    state: "as-served",
    per100g: {
      calories: 254, protein: 12.45, fat: 3.55, satFat: 0.782, carbs: 43.14,
      fiber: 6.0, sugar: 5.57, cholesterol: 0,
      sodium: 455, potassium: 254, calcium: 163, iron: 2.49, magnesium: 77,
      zinc: 1.76, vitaminB6: 0.19, folate: 42, thiamin: 0.39,
      riboflavin: 0.197, niacin: 4.4, water: 37.03,
    },
    portions: [g("slice", 28, true), g("piece", 28)],
    source: usda(172687, "Bread, whole-wheat, commercially prepared"),
  },
  {
    id: "oats_dry",
    name: "Oats, dry",
    aliases: ["oats", "oatmeal", "rolled oats", "porridge oats", "quaker oats"],
    group: "Grains & Starches",
    state: "dry",
    per100g: {
      calories: 389, protein: 16.89, fat: 6.9, satFat: 1.217, monoFat: 2.178,
      polyFat: 2.535, carbs: 66.27, fiber: 10.6, sugar: 0,
      sodium: 2, potassium: 429, calcium: 54, iron: 4.72, magnesium: 177,
      zinc: 3.97, vitaminB6: 0.119, folate: 56, thiamin: 0.763,
      riboflavin: 0.139, niacin: 0.961, water: 8.22,
    },
    portions: [g("cup", 81, true), g("serving", 40), g("scoop", 40)],
    source: usda(169705, "Oats"),
  },
  {
    id: "pasta_cooked",
    name: "Pasta, cooked",
    aliases: ["pasta", "spaghetti", "macaroni", "noodles", "penne", "linguine"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 158, protein: 5.8, fat: 0.93, satFat: 0.176, carbs: 30.86,
      fiber: 1.8, sugar: 0.56, cholesterol: 0,
      sodium: 1, potassium: 44, calcium: 7, iron: 1.28, magnesium: 18,
      zinc: 0.51, vitaminB6: 0.048, folate: 83, thiamin: 0.239,
      riboflavin: 0.122, niacin: 1.7, water: 62.11,
    },
    portions: [g("cup", 140, true), g("serving", 140), g("plate", 250)],
    source: usda(169736, "Pasta, cooked, enriched, without added salt"),
  },

  // ------------------------------------------------------------- LEGUMES ---
  {
    id: "beans_cowpea_cooked",
    name: "Beans (cowpea/black-eyed), cooked",
    aliases: ["beans", "cowpea", "cowpeas", "black eyed peas", "black-eyed peas", "ewa", "brown beans", "honey beans"],
    group: "Legumes",
    state: "cooked",
    per100g: {
      calories: 116, protein: 7.73, fat: 0.53, satFat: 0.139, carbs: 20.76,
      fiber: 6.5, sugar: 3.3, cholesterol: 0,
      sodium: 4, potassium: 278, calcium: 24, iron: 2.51, magnesium: 53,
      zinc: 1.29, vitaminA: 1, vitaminC: 0.4, vitaminB6: 0.1, folate: 208,
      thiamin: 0.202, riboflavin: 0.055, niacin: 0.495, water: 70.0,
    },
    portions: [g("cup", 171, true), g("serving", 171), g("plate", 250)],
    source: usda(174288, "Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled"),
  },
  {
    id: "beans_black_cooked",
    name: "Black beans, cooked",
    aliases: ["black beans", "black bean"],
    group: "Legumes",
    state: "cooked",
    per100g: {
      calories: 132, protein: 8.86, fat: 0.54, satFat: 0.139, carbs: 23.71,
      fiber: 8.7, sugar: 0.32, cholesterol: 0,
      sodium: 1, potassium: 355, calcium: 27, iron: 2.1, magnesium: 70,
      zinc: 1.12, vitaminC: 0, vitaminB6: 0.069, folate: 149,
      thiamin: 0.244, riboflavin: 0.059, niacin: 0.505, water: 65.74,
    },
    portions: [g("cup", 172, true), g("serving", 172)],
    source: usda(173735, "Beans, black, mature seeds, cooked, boiled, without salt"),
  },
  {
    id: "lentils_cooked",
    name: "Lentils, cooked",
    aliases: ["lentils", "lentil", "dal", "daal"],
    group: "Legumes",
    state: "cooked",
    per100g: {
      calories: 116, protein: 9.02, fat: 0.38, satFat: 0.053, carbs: 20.13,
      fiber: 7.9, sugar: 1.8, cholesterol: 0,
      sodium: 2, potassium: 369, calcium: 19, iron: 3.33, magnesium: 36,
      zinc: 1.27, vitaminC: 1.5, vitaminB6: 0.178, folate: 181,
      thiamin: 0.169, riboflavin: 0.073, niacin: 1.06, water: 69.64,
    },
    portions: [g("cup", 198, true), g("serving", 198)],
    source: usda(172421, "Lentils, mature seeds, cooked, boiled, without salt"),
  },

  // ------------------------------------------------------ TUBERS & STARCH ---
  {
    id: "yam_boiled",
    name: "Yam, boiled",
    aliases: ["yam", "boiled yam", "white yam", "isu"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 116, protein: 1.49, fat: 0.14, satFat: 0.03, carbs: 27.48,
      fiber: 3.9, sugar: 0.5, cholesterol: 0,
      sodium: 8, potassium: 670, calcium: 14, iron: 0.52, magnesium: 18,
      zinc: 0.19, vitaminC: 12.1, vitaminE: 0.34, vitaminB6: 0.23,
      folate: 16, thiamin: 0.095, riboflavin: 0.032, niacin: 0.552, water: 70.1,
    },
    portions: [g("cup", 136, true), g("slice", 60), g("serving", 200), g("piece", 60)],
    source: usda(170072, "Yam, cooked, boiled, drained, or baked, without salt"),
  },
  {
    id: "potato_boiled",
    name: "Potato, boiled",
    aliases: ["potato", "potatoes", "boiled potato", "irish potato"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 87, protein: 1.87, fat: 0.1, carbs: 20.01, fiber: 1.8,
      sugar: 0.85, cholesterol: 0,
      sodium: 4, potassium: 379, calcium: 8, iron: 0.31, magnesium: 20,
      zinc: 0.27, vitaminC: 7.4, vitaminE: 0.01, vitaminK: 2.2,
      vitaminB6: 0.299, folate: 10, thiamin: 0.098, riboflavin: 0.019,
      niacin: 1.312, water: 77.0,
    },
    portions: [g("medium", 167, true), g("cup", 156), g("small", 92), g("large", 300)],
    source: usda(170439, "Potatoes, boiled, cooked without skin, flesh, without salt"),
  },
  {
    id: "sweet_potato_baked",
    name: "Sweet potato, baked",
    aliases: ["sweet potato", "sweet potatoes", "baked sweet potato"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 90, protein: 2.01, fat: 0.15, carbs: 20.71, fiber: 3.3,
      sugar: 6.48, cholesterol: 0,
      sodium: 36, potassium: 475, calcium: 38, iron: 0.69, magnesium: 27,
      zinc: 0.32, vitaminA: 961, vitaminC: 19.6, vitaminE: 0.71, vitaminK: 2.3,
      vitaminB6: 0.286, folate: 6, thiamin: 0.107, riboflavin: 0.106,
      niacin: 1.487, water: 75.78,
    },
    portions: [g("medium", 114, true), g("cup", 200), g("large", 180)],
    source: usda(168482, "Sweet potato, cooked, baked in skin, flesh, without salt"),
  },
  {
    id: "plantain_boiled",
    name: "Plantain, boiled",
    aliases: ["plantain", "plantains", "boiled plantain", "green plantain"],
    group: "Grains & Starches",
    state: "cooked",
    per100g: {
      calories: 116, protein: 0.79, fat: 0.18, carbs: 31.15, fiber: 2.3,
      sugar: 14.0, cholesterol: 0,
      sodium: 5, potassium: 465, calcium: 2, iron: 0.58, magnesium: 32,
      zinc: 0.14, vitaminA: 45, vitaminC: 10.9, vitaminB6: 0.24,
      folate: 26, thiamin: 0.046, riboflavin: 0.048, niacin: 0.755, water: 66.99,
    },
    portions: [g("cup", 154), g("medium", 179, true), g("piece", 60), g("slice", 25)],
    source: usda(173945, "Plantains, green, cooked, boiled, drained"),
  },
  {
    id: "garri_dry",
    name: "Garri (dry)",
    aliases: ["garri", "gari", "cassava flakes"],
    group: "Grains & Starches",
    state: "dry",
    per100g: {
      calories: 357, protein: 1.6, fat: 0.5, carbs: 84.0, fiber: 3.5,
      sugar: 2.5, cholesterol: 0,
      sodium: 12, potassium: 244, calcium: 36, iron: 1.5, magnesium: 25,
      zinc: 0.6, vitaminC: 4.0, thiamin: 0.05, riboflavin: 0.03,
      niacin: 0.6, water: 10.0,
    },
    portions: [g("cup", 130), g("serving", 100, true)],
    source: wafct("02_014", "Gari, fermented cassava, dry"),
  },

  // -------------------------------------------------------------- FRUITS ---
  {
    id: "banana_raw",
    name: "Banana",
    aliases: ["banana", "bananas"],
    group: "Fruits",
    state: "raw",
    per100g: {
      calories: 89, protein: 1.09, fat: 0.33, satFat: 0.112, carbs: 22.84,
      fiber: 2.6, sugar: 12.23, cholesterol: 0,
      sodium: 1, potassium: 358, calcium: 5, iron: 0.26, magnesium: 27,
      zinc: 0.15, vitaminA: 3, vitaminC: 8.7, vitaminE: 0.1, vitaminK: 0.5,
      vitaminB6: 0.367, folate: 20, thiamin: 0.031, riboflavin: 0.073,
      niacin: 0.665, water: 74.91,
    },
    portions: [g("medium", 118, true), g("large", 136), g("small", 101), g("cup", 150)],
    source: usda(173944, "Bananas, raw"),
  },
  {
    id: "apple_raw",
    name: "Apple",
    aliases: ["apple", "apples"],
    group: "Fruits",
    state: "raw",
    per100g: {
      calories: 52, protein: 0.26, fat: 0.17, carbs: 13.81, fiber: 2.4,
      sugar: 10.39, cholesterol: 0,
      sodium: 1, potassium: 107, calcium: 6, iron: 0.12, magnesium: 5,
      zinc: 0.04, vitaminA: 3, vitaminC: 4.6, vitaminE: 0.18, vitaminK: 2.2,
      vitaminB6: 0.041, folate: 3, thiamin: 0.017, riboflavin: 0.026,
      niacin: 0.091, water: 85.56,
    },
    portions: [g("medium", 182, true), g("large", 223), g("small", 149), g("cup", 125)],
    source: usda(171688, "Apples, raw, with skin"),
  },
  {
    id: "orange_raw",
    name: "Orange",
    aliases: ["orange", "oranges"],
    group: "Fruits",
    state: "raw",
    per100g: {
      calories: 47, protein: 0.94, fat: 0.12, carbs: 11.75, fiber: 2.4,
      sugar: 9.35, cholesterol: 0,
      sodium: 0, potassium: 181, calcium: 40, iron: 0.1, magnesium: 10,
      zinc: 0.07, vitaminA: 11, vitaminC: 53.2, vitaminE: 0.18,
      vitaminB6: 0.06, folate: 30, thiamin: 0.087, riboflavin: 0.04,
      niacin: 0.282, water: 86.75,
    },
    portions: [g("medium", 131, true), g("large", 184), g("small", 96)],
    source: usda(169097, "Oranges, raw, all commercial varieties"),
  },
  {
    id: "avocado_raw",
    name: "Avocado",
    aliases: ["avocado", "avocados", "pear (avocado)"],
    group: "Fruits",
    state: "raw",
    per100g: {
      calories: 160, protein: 2.0, fat: 14.66, satFat: 2.126, monoFat: 9.799,
      polyFat: 1.816, carbs: 8.53, fiber: 6.7, sugar: 0.66, cholesterol: 0,
      sodium: 7, potassium: 485, calcium: 12, iron: 0.55, magnesium: 29,
      zinc: 0.64, vitaminA: 7, vitaminC: 10, vitaminE: 2.07, vitaminK: 21,
      vitaminB6: 0.257, folate: 81, thiamin: 0.067, riboflavin: 0.13,
      niacin: 1.738, water: 73.23,
    },
    portions: [g("medium", 150, true), g("half", 75), g("cup", 146)],
    source: usda(171705, "Avocados, raw, all commercial varieties"),
  },
  {
    id: "mango_raw",
    name: "Mango",
    aliases: ["mango", "mangoes", "mangos"],
    group: "Fruits",
    state: "raw",
    per100g: {
      calories: 60, protein: 0.82, fat: 0.38, carbs: 14.98, fiber: 1.6,
      sugar: 13.66, cholesterol: 0,
      sodium: 1, potassium: 168, calcium: 11, iron: 0.16, magnesium: 10,
      zinc: 0.09, vitaminA: 54, vitaminC: 36.4, vitaminE: 0.9, vitaminK: 4.2,
      vitaminB6: 0.119, folate: 43, thiamin: 0.028, riboflavin: 0.038,
      niacin: 0.669, water: 83.46,
    },
    portions: [g("medium", 207, true), g("cup", 165), g("slice", 30)],
    source: usda(169910, "Mangos, raw"),
  },
  {
    id: "watermelon_raw",
    name: "Watermelon",
    aliases: ["watermelon", "water melon"],
    group: "Fruits",
    state: "raw",
    per100g: {
      calories: 30, protein: 0.61, fat: 0.15, carbs: 7.55, fiber: 0.4,
      sugar: 6.2, cholesterol: 0,
      sodium: 1, potassium: 112, calcium: 7, iron: 0.24, magnesium: 10,
      zinc: 0.1, vitaminA: 28, vitaminC: 8.1, vitaminE: 0.05,
      vitaminB6: 0.045, folate: 3, thiamin: 0.033, riboflavin: 0.021,
      niacin: 0.178, water: 91.45,
    },
    portions: [g("cup", 152, true), g("slice", 286), g("wedge", 286)],
    source: usda(167765, "Watermelon, raw"),
  },

  // ---------------------------------------------------------- VEGETABLES ---
  {
    id: "spinach_raw",
    name: "Spinach, raw",
    aliases: ["spinach", "raw spinach", "efo"],
    group: "Vegetables",
    state: "raw",
    per100g: {
      calories: 23, protein: 2.86, fat: 0.39, carbs: 3.63, fiber: 2.2,
      sugar: 0.42, cholesterol: 0,
      sodium: 79, potassium: 558, calcium: 99, iron: 2.71, magnesium: 79,
      zinc: 0.53, vitaminA: 469, vitaminC: 28.1, vitaminE: 2.03,
      vitaminK: 482.9, vitaminB6: 0.195, folate: 194, thiamin: 0.078,
      riboflavin: 0.189, niacin: 0.724, water: 91.4,
    },
    portions: [g("cup", 30, true), g("handful", 30), g("serving", 100)],
    source: usda(168462, "Spinach, raw"),
  },
  {
    id: "broccoli_cooked",
    name: "Broccoli, cooked",
    aliases: ["broccoli", "steamed broccoli", "boiled broccoli"],
    group: "Vegetables",
    state: "cooked",
    per100g: {
      calories: 35, protein: 2.38, fat: 0.41, carbs: 7.18, fiber: 3.3,
      sugar: 1.39, cholesterol: 0,
      sodium: 41, potassium: 293, calcium: 40, iron: 0.67, magnesium: 21,
      zinc: 0.45, vitaminA: 77, vitaminC: 64.9, vitaminE: 1.45,
      vitaminK: 141.1, vitaminB6: 0.2, folate: 108, thiamin: 0.063,
      riboflavin: 0.123, niacin: 0.553, water: 89.25,
    },
    portions: [g("cup", 156, true), g("serving", 100)],
    source: usda(170380, "Broccoli, cooked, boiled, drained, without salt"),
  },
  {
    id: "tomato_raw",
    name: "Tomato",
    aliases: ["tomato", "tomatoes"],
    group: "Vegetables",
    state: "raw",
    per100g: {
      calories: 18, protein: 0.88, fat: 0.2, carbs: 3.89, fiber: 1.2,
      sugar: 2.63, cholesterol: 0,
      sodium: 5, potassium: 237, calcium: 10, iron: 0.27, magnesium: 11,
      zinc: 0.17, vitaminA: 42, vitaminC: 13.7, vitaminE: 0.54, vitaminK: 7.9,
      vitaminB6: 0.08, folate: 15, thiamin: 0.037, riboflavin: 0.019,
      niacin: 0.594, water: 94.52,
    },
    portions: [g("medium", 123, true), g("cup", 180), g("large", 182), g("slice", 20)],
    source: usda(170457, "Tomatoes, red, ripe, raw, year round average"),
  },
  {
    id: "carrot_raw",
    name: "Carrot",
    aliases: ["carrot", "carrots"],
    group: "Vegetables",
    state: "raw",
    per100g: {
      calories: 41, protein: 0.93, fat: 0.24, carbs: 9.58, fiber: 2.8,
      sugar: 4.74, cholesterol: 0,
      sodium: 69, potassium: 320, calcium: 33, iron: 0.3, magnesium: 12,
      zinc: 0.24, vitaminA: 835, vitaminC: 5.9, vitaminE: 0.66, vitaminK: 13.2,
      vitaminB6: 0.138, folate: 19, thiamin: 0.066, riboflavin: 0.058,
      niacin: 0.983, water: 88.29,
    },
    portions: [g("medium", 61, true), g("cup", 128), g("large", 72)],
    source: usda(170393, "Carrots, raw"),
  },

  // --------------------------------------------------------------- DAIRY ---
  {
    id: "milk_whole",
    name: "Whole milk",
    aliases: ["milk", "whole milk", "full cream milk", "full fat milk"],
    group: "Dairy",
    state: "as-served",
    per100g: {
      calories: 61, protein: 3.15, fat: 3.25, satFat: 1.865, monoFat: 0.812,
      polyFat: 0.195, cholesterol: 10, carbs: 4.8, fiber: 0, sugar: 5.05,
      sodium: 43, potassium: 132, calcium: 113, iron: 0.03, magnesium: 10,
      zinc: 0.37, vitaminA: 32, vitaminD: 1.3, vitaminE: 0.07, vitaminK: 0.3,
      vitaminB6: 0.036, vitaminB12: 0.45, folate: 5, thiamin: 0.046,
      riboflavin: 0.169, niacin: 0.089, water: 88.13,
    },
    portions: [g("cup", 244, true), g("glass", 244), g("ml", 1.03), g("tbsp", 15)],
    source: usda(171265, "Milk, whole, 3.25% milkfat, with added vitamin D"),
  },
  {
    id: "yogurt_greek_nonfat",
    name: "Greek yogurt, plain nonfat",
    aliases: ["greek yogurt", "greek yoghurt", "yogurt", "yoghurt", "plain yogurt"],
    group: "Dairy",
    state: "as-served",
    per100g: {
      calories: 59, protein: 10.19, fat: 0.39, satFat: 0.117, cholesterol: 5,
      carbs: 3.6, fiber: 0, sugar: 3.24,
      sodium: 36, potassium: 141, calcium: 110, iron: 0.07, magnesium: 11,
      zinc: 0.52, vitaminA: 1, vitaminB12: 0.75, folate: 7,
      thiamin: 0.023, riboflavin: 0.278, niacin: 0.208, water: 85.1,
    },
    portions: [g("cup", 245, true), g("container", 170), g("tbsp", 15)],
    source: usda(170903, "Yogurt, Greek, plain, nonfat"),
  },

  // ------------------------------------------------------- NUTS & FATS ---
  {
    id: "almonds_raw",
    name: "Almonds",
    aliases: ["almond", "almonds", "raw almonds"],
    group: "Nuts & Seeds",
    state: "raw",
    per100g: {
      calories: 579, protein: 21.15, fat: 49.93, satFat: 3.802, monoFat: 31.551,
      polyFat: 12.329, carbs: 21.55, fiber: 12.5, sugar: 4.35, cholesterol: 0,
      sodium: 1, potassium: 733, calcium: 269, iron: 3.71, magnesium: 270,
      zinc: 3.12, vitaminE: 25.63, vitaminB6: 0.137, folate: 44,
      thiamin: 0.205, riboflavin: 1.138, niacin: 3.618, water: 4.41,
    },
    portions: [g("oz", 28.35, true), g("handful", 28), g("cup", 143)],
    source: usda(170567, "Nuts, almonds"),
  },
  {
    id: "peanuts_roasted",
    name: "Peanuts, roasted",
    aliases: ["peanut", "peanuts", "groundnut", "groundnuts", "roasted peanuts"],
    group: "Nuts & Seeds",
    state: "cooked",
    per100g: {
      calories: 587, protein: 24.35, fat: 49.66, satFat: 6.893, monoFat: 24.64,
      polyFat: 15.694, carbs: 21.26, fiber: 8.0, sugar: 4.18, cholesterol: 0,
      sodium: 6, potassium: 634, calcium: 54, iron: 2.26, magnesium: 176,
      zinc: 3.31, vitaminE: 6.93, vitaminB6: 0.256, folate: 145,
      thiamin: 0.438, riboflavin: 0.098, niacin: 13.525, water: 1.81,
    },
    portions: [g("oz", 28.35, true), g("handful", 28), g("cup", 146)],
    source: usda(174267, "Peanuts, all types, dry-roasted, without salt"),
  },
  {
    id: "olive_oil",
    name: "Olive oil",
    aliases: ["olive oil", "extra virgin olive oil", "evoo"],
    group: "Fats & Oils",
    state: "as-served",
    per100g: {
      calories: 884, protein: 0, fat: 100, satFat: 13.808, monoFat: 72.961,
      polyFat: 10.523, carbs: 0, fiber: 0, sugar: 0, cholesterol: 0,
      sodium: 2, potassium: 1, calcium: 1, iron: 0.56,
      vitaminE: 14.35, vitaminK: 60.2, water: 0,
    },
    portions: [g("tbsp", 13.5, true), g("tsp", 4.5), g("cup", 216)],
    source: usda(171413, "Oil, olive, salad or cooking"),
  },
  {
    id: "palm_oil",
    name: "Palm oil (red)",
    aliases: ["palm oil", "red palm oil", "epo pupa"],
    group: "Fats & Oils",
    state: "as-served",
    per100g: {
      calories: 884, protein: 0, fat: 100, satFat: 49.3, monoFat: 37.0,
      polyFat: 9.3, carbs: 0, fiber: 0, cholesterol: 0,
      vitaminA: 1470, vitaminE: 15.94, vitaminK: 8.0, water: 0,
    },
    portions: [g("tbsp", 13.6, true), g("tsp", 4.5)],
    source: usda(171015, "Oil, palm"),
  },

  // ------------------------------------------------------------ BEVERAGES ---
  {
    id: "coffee_brewed",
    name: "Coffee, brewed",
    aliases: ["coffee", "black coffee", "brewed coffee", "americano"],
    group: "Beverages",
    state: "as-served",
    per100g: {
      calories: 1, protein: 0.12, fat: 0.02, carbs: 0, fiber: 0, sugar: 0,
      cholesterol: 0, sodium: 2, potassium: 49, calcium: 2, iron: 0.01,
      magnesium: 3, riboflavin: 0.076, niacin: 0.191, caffeine: 40,
      water: 99.39,
    },
    portions: [g("cup", 237, true), g("mug", 355), g("ml", 1.0)],
    source: usda(171890, "Beverages, coffee, brewed, prepared with tap water"),
  },
  {
    id: "orange_juice",
    name: "Orange juice",
    aliases: ["orange juice", "oj", "fresh orange juice"],
    group: "Beverages",
    state: "as-served",
    per100g: {
      calories: 45, protein: 0.7, fat: 0.2, carbs: 10.4, fiber: 0.2,
      sugar: 8.4, cholesterol: 0,
      sodium: 1, potassium: 200, calcium: 11, iron: 0.2, magnesium: 11,
      zinc: 0.05, vitaminA: 10, vitaminC: 50, vitaminE: 0.04,
      vitaminB6: 0.04, folate: 30, thiamin: 0.089, riboflavin: 0.03,
      niacin: 0.4, water: 88.1,
    },
    portions: [g("cup", 248, true), g("glass", 248), g("ml", 1.04)],
    source: usda(169098, "Orange juice, raw"),
  },

  // ------------------------------------------------ COMPOSITE DISHES ---
  // Standard-recipe calculations. The resolver reports these as
  // "recipe-estimated" — a real pot varies with the cook's hand.
  {
    id: "jollof_rice",
    name: "Jollof rice",
    aliases: ["jollof", "jollof rice", "party jollof", "jellof rice"],
    group: "Prepared Dishes",
    state: "prepared",
    isComposite: true,
    per100g: {
      calories: 152, protein: 3.0, fat: 4.6, satFat: 2.2, monoFat: 1.7,
      polyFat: 0.5, carbs: 24.5, fiber: 1.1, sugar: 1.9, cholesterol: 0,
      sodium: 320, potassium: 120, calcium: 14, iron: 1.1, magnesium: 15,
      zinc: 0.5, vitaminA: 95, vitaminC: 5.5, vitaminE: 1.2,
      vitaminB6: 0.09, folate: 42, thiamin: 0.11, riboflavin: 0.03,
      niacin: 1.3, water: 64.0,
    },
    portions: [g("cup", 158), g("plate", 250, true), g("serving", 200), g("bowl", 220)],
    source: recipe(
      ["rice_white_cooked", "palm_oil", "tomato_raw"],
      "Rice cooked in tomato-pepper base with oil (standard Nigerian preparation)",
    ),
  },
  {
    id: "moi_moi",
    name: "Moi moi (steamed bean pudding)",
    aliases: ["moi moi", "moimoi", "moi-moi", "bean pudding", "moin moin"],
    group: "Prepared Dishes",
    state: "prepared",
    isComposite: true,
    per100g: {
      calories: 148, protein: 7.4, fat: 6.2, satFat: 1.6, monoFat: 2.9,
      polyFat: 1.4, carbs: 16.0, fiber: 4.2, sugar: 1.8, cholesterol: 12,
      sodium: 280, potassium: 300, calcium: 32, iron: 2.2, magnesium: 48,
      zinc: 1.1, vitaminA: 120, vitaminC: 4.0, vitaminE: 1.8,
      vitaminB6: 0.11, folate: 145, thiamin: 0.18, riboflavin: 0.07,
      niacin: 0.6, water: 66.0,
    },
    portions: [g("wrap", 150, true), g("piece", 150), g("cup", 180), g("serving", 150)],
    source: recipe(
      ["beans_cowpea_cooked", "palm_oil", "egg_boiled", "tomato_raw"],
      "Blended peeled cowpeas steamed with oil and peppers",
    ),
  },
  {
    id: "mac_and_cheese",
    name: "Macaroni and cheese",
    aliases: ["mac and cheese", "macaroni and cheese", "mac n cheese", "macaroni cheese"],
    group: "Prepared Dishes",
    state: "prepared",
    isComposite: true,
    per100g: {
      calories: 164, protein: 6.4, fat: 6.6, satFat: 3.0, monoFat: 1.9,
      polyFat: 0.9, carbs: 19.9, fiber: 1.0, sugar: 2.4, cholesterol: 15,
      sodium: 342, potassium: 96, calcium: 132, iron: 0.9, magnesium: 16,
      zinc: 0.7, vitaminA: 60, vitaminD: 0.2, vitaminB12: 0.24,
      folate: 42, thiamin: 0.14, riboflavin: 0.19, niacin: 1.1, water: 64.5,
    },
    portions: [g("cup", 222, true), g("serving", 222), g("plate", 300)],
    source: usda(170305, "Macaroni or noodles with cheese, prepared", "FNDDS"),
  },
  {
    id: "egusi_soup",
    name: "Egusi soup",
    aliases: ["egusi", "egusi soup", "melon seed soup"],
    group: "Prepared Dishes",
    state: "prepared",
    isComposite: true,
    per100g: {
      calories: 195, protein: 9.5, fat: 15.5, satFat: 5.2, monoFat: 5.4,
      polyFat: 4.1, carbs: 5.2, fiber: 2.4, sugar: 1.1, cholesterol: 22,
      sodium: 410, potassium: 285, calcium: 68, iron: 2.4, magnesium: 72,
      zinc: 1.6, vitaminA: 210, vitaminC: 12.0, vitaminE: 2.2,
      folate: 48, thiamin: 0.09, riboflavin: 0.11, niacin: 0.9, water: 66.0,
    },
    portions: [g("cup", 240), g("serving", 200, true), g("bowl", 250)],
    source: recipe(
      ["palm_oil", "spinach_raw", "beef_ground_85"],
      "Ground melon seed stewed with palm oil, leafy greens and meat/fish",
    ),
  },
];

// ============================================================================
// INDEXES
// ============================================================================

const BY_ID = new Map<string, CanonicalFood>(
  CANONICAL_FOODS.map((f) => [f.id, f]),
);

/** alias (lowercase) → food. First writer wins, so put canonical names first. */
const BY_ALIAS = (() => {
  const map = new Map<string, CanonicalFood>();
  for (const food of CANONICAL_FOODS) {
    const keys = [food.name.toLowerCase(), ...food.aliases];
    for (const key of keys) {
      const norm = key.trim().toLowerCase();
      if (norm && !map.has(norm)) map.set(norm, food);
    }
  }
  return map;
})();

export function getCanonicalFood(id: string): CanonicalFood | undefined {
  return BY_ID.get(id);
}

/** Exact alias hit. The fast path before any fuzzy matching. */
export function getCanonicalByAlias(term: string): CanonicalFood | undefined {
  return BY_ALIAS.get(term.trim().toLowerCase());
}

/** Every alias, for the fuzzy matcher to score against. */
export function canonicalAliasEntries(): { alias: string; food: CanonicalFood }[] {
  return Array.from(BY_ALIAS.entries()).map(([alias, food]) => ({ alias, food }));
}

/** Resolve a household portion to grams for a specific food. */
export function portionGrams(
  food: CanonicalFood,
  unit: string,
): number | undefined {
  const norm = unit.trim().toLowerCase();
  return food.portions.find((p) => p.unit === norm)?.grams;
}

/** The portion used when the user names a food without an amount. */
export function defaultPortion(food: CanonicalFood): PortionOption {
  return food.portions.find((p) => p.isDefault) ?? food.portions[0] ?? { unit: "serving", grams: 100 };
}

/** Guard: a panel with no calories key can't be scaled meaningfully. */
export function hasEnergy(panel: NutrientPanel): boolean {
  return typeof panel.calories === "number";
}
