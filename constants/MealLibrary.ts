/**
 * MEAL LIBRARY — balanced cross-cuisine expansion.
 *
 * The base DietDatabase is rich but African-weighted (Nigerian/Universal). To
 * make the cuisine preference real (a "Western"/"Mediterranean" user should get
 * a genuinely European day), this module adds a curated set of European,
 * Western and Mediterranean meals + macro-complete snacks and MERGES them into
 * the diets where they're clinically appropriate.
 *
 * Design:
 *  - Each library item lists the diet IDs it belongs to (via property groups),
 *    so placement is deliberate — a high-carb pasta never lands in keto, a
 *    salty mezze never lands in low-sodium, etc.
 *  - Merge is idempotent and name-deduped, so re-running (hot reload) is safe.
 *  - Macros are realistic estimates for a standard single serving.
 *
 * Type-only import of the DietDatabase shapes ⇒ no runtime import cycle.
 */

import type {
  DietData,
  DietMealOption,
  DietSnackOption,
} from "./DietDatabase";

type Slot = "breakfast" | "lunch" | "dinner";

export interface LibraryMeal extends DietMealOption {
  slot: Slot;
  diets: string[];
}

export interface LibrarySnack extends DietSnackOption {
  diets: string[];
}

// ── Diet-ID property groups ────────────────────────────────────────────────
// OMNI: non-restrictive, balanced diets that welcome any sensible meal.
const OMNI = [
  "mediterranean",
  "calorie-counting",
  "flexitarian",
  "high-protein",
  "intermittent-fasting",
  "anti-inflammatory",
  "gut-health",
  "thyroid-support",
  "immunity-boosting",
  "athlete-endurance",
  "postpartum-wellness",
  "iron-deficiency-recovery",
  // Lifestyle & goal-based (non-restrictive, balanced) — Category K. The three
  // "premise" plans (no-added-sugar, debloat-light, whole-food-reset) are left
  // OUT: OMNI includes sweeter/heavier meals that would contradict them, so
  // they keep only their own curated options.
  "clean-eating",
  "budget-balanced",
  "meal-prep",
  "family-balanced",
  "student-quick",
  "mindful-eating",
  "high-energy-vitality",
  "everyday-balanced",
  "glow-skin",
];
// Glycemic-sensitive — only added for low/moderate-carb meals.
const GLY = ["diabetic-friendly", "pcos-friendly", "metabolism-lean", "weight-loss"];
const HIGHCAL = ["weight-gain", "bodybuilding", "healthy-weight-gain"];
const HP = ["high-protein", "bodybuilding", "metabolism-lean", "healthy-weight-gain"];
const LOWCARB = ["low-carb"];
const KETO = ["keto"];
const VEG = ["vegetarian"];
const VEGAN = ["vegan"];
const GF = ["gluten-free", "gluten-free-lifestyle"];

/** Union helper — flattens groups + extra ids into one list. */
const D = (...groups: string[][]): string[] => Array.from(new Set(groups.flat()));

// ════════════════════════════════════════════════════════════════════════════
// MEALS
// ════════════════════════════════════════════════════════════════════════════

const LIBRARY_MEALS: LibraryMeal[] = [
  // ── Breakfasts ──────────────────────────────────────────────
  {
    slot: "breakfast",
    name: "Greek Yogurt Bowl with Honey, Walnuts & Berries",
    calories: { min: 320, max: 380 },
    protein: { min: 18, max: 22 },
    carbs: { min: 34, max: 42 },
    fat: { min: 12, max: 16 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, VEG),
  },
  {
    slot: "breakfast",
    name: "Shakshuka (Eggs Poached in Tomato & Pepper)",
    calories: { min: 300, max: 360 },
    protein: { min: 18, max: 22 },
    carbs: { min: 16, max: 22 },
    fat: { min: 16, max: 20 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, VEG, GF, LOWCARB),
  },
  {
    slot: "breakfast",
    name: "Whole-Grain Avocado Toast with Poached Egg",
    calories: { min: 350, max: 420 },
    protein: { min: 16, max: 20 },
    carbs: { min: 32, max: 40 },
    fat: { min: 18, max: 24 },
    cuisine: "Western",
    diets: D(OMNI, VEG),
  },
  {
    slot: "breakfast",
    name: "Spinach & Feta Omelette",
    calories: { min: 280, max: 340 },
    protein: { min: 22, max: 26 },
    carbs: { min: 6, max: 10 },
    fat: { min: 18, max: 24 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, VEG, GF, LOWCARB, KETO, HP),
  },
  {
    slot: "breakfast",
    name: "Cheese & Mushroom Omelette",
    calories: { min: 320, max: 380 },
    protein: { min: 24, max: 28 },
    carbs: { min: 5, max: 8 },
    fat: { min: 24, max: 30 },
    cuisine: "Western",
    diets: D(OMNI, GLY, VEG, GF, LOWCARB, KETO, HP),
  },
  {
    slot: "breakfast",
    name: "Overnight Oats with Almond Butter & Banana",
    calories: { min: 340, max: 400 },
    protein: { min: 12, max: 16 },
    carbs: { min: 50, max: 58 },
    fat: { min: 12, max: 16 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN),
  },
  {
    slot: "breakfast",
    name: "Smoked Salmon & Cream Cheese on Rye",
    calories: { min: 330, max: 390 },
    protein: { min: 22, max: 26 },
    carbs: { min: 28, max: 34 },
    fat: { min: 14, max: 18 },
    cuisine: "Western",
    diets: D(OMNI, HP),
  },
  {
    slot: "breakfast",
    name: "Scrambled Tofu with Peppers & Turmeric",
    calories: { min: 260, max: 320 },
    protein: { min: 18, max: 22 },
    carbs: { min: 12, max: 18 },
    fat: { min: 14, max: 18 },
    cuisine: "Western",
    diets: D(OMNI, GLY, VEG, VEGAN, GF, LOWCARB),
  },
  {
    slot: "breakfast",
    name: "Bircher Muesli with Greek Yogurt & Apple",
    calories: { min: 330, max: 390 },
    protein: { min: 14, max: 18 },
    carbs: { min: 48, max: 56 },
    fat: { min: 8, max: 12 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG),
  },
  {
    slot: "breakfast",
    name: "Peanut Butter & Banana Protein Oats",
    calories: { min: 520, max: 600 },
    protein: { min: 28, max: 34 },
    carbs: { min: 62, max: 72 },
    fat: { min: 18, max: 24 },
    cuisine: "Western",
    diets: D(HIGHCAL, HP, VEG),
  },

  // ── Lunches ─────────────────────────────────────────────────
  {
    slot: "lunch",
    name: "Grilled Chicken Greek Salad",
    calories: { min: 380, max: 450 },
    protein: { min: 35, max: 42 },
    carbs: { min: 14, max: 20 },
    fat: { min: 18, max: 24 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "lunch",
    name: "Mediterranean Tuna & White Bean Salad",
    calories: { min: 380, max: 440 },
    protein: { min: 30, max: 36 },
    carbs: { min: 28, max: 34 },
    fat: { min: 14, max: 18 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, HP),
  },
  {
    slot: "lunch",
    name: "Quinoa Tabbouleh with Chickpeas",
    calories: { min: 400, max: 470 },
    protein: { min: 16, max: 20 },
    carbs: { min: 58, max: 66 },
    fat: { min: 12, max: 16 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, VEGAN, GF),
  },
  {
    slot: "lunch",
    name: "Lentil & Vegetable Soup with Whole-Grain Roll",
    calories: { min: 360, max: 420 },
    protein: { min: 18, max: 22 },
    carbs: { min: 52, max: 60 },
    fat: { min: 8, max: 12 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN),
  },
  {
    slot: "lunch",
    name: "Chicken Caesar Salad (Light Dressing)",
    calories: { min: 400, max: 470 },
    protein: { min: 34, max: 40 },
    carbs: { min: 16, max: 22 },
    fat: { min: 22, max: 28 },
    cuisine: "Western",
    diets: D(OMNI, GLY, LOWCARB, HP),
  },
  {
    slot: "lunch",
    name: "Turkey & Avocado Whole-Wheat Wrap",
    calories: { min: 420, max: 490 },
    protein: { min: 30, max: 36 },
    carbs: { min: 38, max: 46 },
    fat: { min: 16, max: 22 },
    cuisine: "Western",
    diets: D(OMNI, HP),
  },
  {
    slot: "lunch",
    name: "Caprese Salad with Grilled Chicken",
    calories: { min: 380, max: 450 },
    protein: { min: 34, max: 40 },
    carbs: { min: 10, max: 16 },
    fat: { min: 22, max: 28 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "lunch",
    name: "Falafel & Hummus Mezze Bowl",
    calories: { min: 450, max: 530 },
    protein: { min: 16, max: 20 },
    carbs: { min: 55, max: 65 },
    fat: { min: 18, max: 24 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, VEGAN),
  },
  {
    slot: "lunch",
    name: "Cobb Salad (Egg, Chicken & Avocado)",
    calories: { min: 450, max: 530 },
    protein: { min: 34, max: 40 },
    carbs: { min: 10, max: 16 },
    fat: { min: 30, max: 36 },
    cuisine: "Western",
    diets: D(OMNI, GLY, GF, LOWCARB, KETO, HP),
  },
  {
    slot: "lunch",
    name: "Tofu & Vegetable Buddha Bowl",
    calories: { min: 440, max: 520 },
    protein: { min: 20, max: 26 },
    carbs: { min: 52, max: 60 },
    fat: { min: 16, max: 22 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN, GF),
  },
  {
    slot: "lunch",
    name: "Chicken, Rice & Avocado Power Bowl",
    calories: { min: 600, max: 700 },
    protein: { min: 45, max: 52 },
    carbs: { min: 60, max: 70 },
    fat: { min: 18, max: 24 },
    cuisine: "Western",
    diets: D(HIGHCAL, HP, GF),
  },

  // ── Dinners ─────────────────────────────────────────────────
  {
    slot: "dinner",
    name: "Baked Salmon with Roasted Vegetables",
    calories: { min: 420, max: 500 },
    protein: { min: 36, max: 42 },
    carbs: { min: 18, max: 24 },
    fat: { min: 22, max: 28 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "dinner",
    name: "Grilled Chicken with Quinoa & Greens",
    calories: { min: 450, max: 520 },
    protein: { min: 38, max: 44 },
    carbs: { min: 40, max: 48 },
    fat: { min: 12, max: 18 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GF, HP),
  },
  {
    slot: "dinner",
    name: "Beef & Vegetable Stir-Fry (No Rice)",
    calories: { min: 400, max: 470 },
    protein: { min: 32, max: 38 },
    carbs: { min: 18, max: 24 },
    fat: { min: 18, max: 24 },
    cuisine: "Western",
    diets: D(OMNI, GLY, LOWCARB, HP),
  },
  {
    slot: "dinner",
    name: "Whole-Wheat Spaghetti with Tomato & Basil",
    calories: { min: 430, max: 500 },
    protein: { min: 16, max: 20 },
    carbs: { min: 70, max: 80 },
    fat: { min: 10, max: 14 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, VEGAN),
  },
  {
    slot: "dinner",
    name: "Roast Chicken Breast with Sweet Potato Mash",
    calories: { min: 450, max: 520 },
    protein: { min: 38, max: 44 },
    carbs: { min: 38, max: 46 },
    fat: { min: 12, max: 18 },
    cuisine: "Western",
    diets: D(OMNI, GF, HP),
  },
  {
    slot: "dinner",
    name: "Mediterranean Baked Cod with Olives & Tomatoes",
    calories: { min: 360, max: 430 },
    protein: { min: 34, max: 40 },
    carbs: { min: 12, max: 18 },
    fat: { min: 16, max: 22 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "dinner",
    name: "Vegetable & Chickpea Curry with Brown Rice",
    calories: { min: 460, max: 540 },
    protein: { min: 16, max: 20 },
    carbs: { min: 72, max: 82 },
    fat: { min: 12, max: 16 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN, GF),
  },
  {
    slot: "dinner",
    name: "Grilled Steak with Garden Salad",
    calories: { min: 470, max: 560 },
    protein: { min: 40, max: 46 },
    carbs: { min: 10, max: 16 },
    fat: { min: 26, max: 32 },
    cuisine: "Western",
    diets: D(OMNI, GLY, HIGHCAL, GF, LOWCARB, KETO, HP),
  },
  {
    slot: "dinner",
    name: "Stuffed Bell Peppers with Turkey & Brown Rice",
    calories: { min: 400, max: 470 },
    protein: { min: 28, max: 34 },
    carbs: { min: 36, max: 44 },
    fat: { min: 14, max: 20 },
    cuisine: "Western",
    diets: D(OMNI, GF, HP),
  },
  {
    slot: "dinner",
    name: "Ratatouille with Grilled Halloumi",
    calories: { min: 360, max: 430 },
    protein: { min: 18, max: 24 },
    carbs: { min: 24, max: 30 },
    fat: { min: 18, max: 24 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, VEG, GF),
  },
  {
    slot: "dinner",
    name: "Zucchini Noodles with Pesto & Grilled Chicken",
    calories: { min: 380, max: 450 },
    protein: { min: 34, max: 40 },
    carbs: { min: 12, max: 18 },
    fat: { min: 20, max: 26 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "dinner",
    name: "Chickpea & Spinach Stew",
    calories: { min: 380, max: 450 },
    protein: { min: 18, max: 22 },
    carbs: { min: 50, max: 58 },
    fat: { min: 10, max: 14 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, VEGAN, GF),
  },

  // ── More breakfasts ─────────────────────────────────────────
  {
    slot: "breakfast",
    name: "Cottage Cheese with Berries & Almonds",
    calories: { min: 260, max: 320 },
    protein: { min: 20, max: 24 },
    carbs: { min: 16, max: 22 },
    fat: { min: 10, max: 14 },
    cuisine: "Western",
    diets: D(OMNI, GLY, VEG, GF, LOWCARB, HP),
  },
  {
    slot: "breakfast",
    name: "Steel-Cut Oats with Apple & Cinnamon",
    calories: { min: 300, max: 360 },
    protein: { min: 9, max: 12 },
    carbs: { min: 52, max: 60 },
    fat: { min: 5, max: 8 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN),
  },
  {
    slot: "breakfast",
    name: "Smoked Mackerel on Rye with Tomato",
    calories: { min: 330, max: 390 },
    protein: { min: 22, max: 26 },
    carbs: { min: 26, max: 32 },
    fat: { min: 14, max: 18 },
    cuisine: "Western",
    diets: D(OMNI, HP),
  },

  // ── More lunches ────────────────────────────────────────────
  {
    slot: "lunch",
    name: "Salmon Poke Bowl with Brown Rice",
    calories: { min: 500, max: 580 },
    protein: { min: 32, max: 38 },
    carbs: { min: 52, max: 60 },
    fat: { min: 16, max: 22 },
    cuisine: "Western",
    diets: D(OMNI, HP, GF),
  },
  {
    slot: "lunch",
    name: "Roasted Vegetable & Feta Grain Bowl",
    calories: { min: 420, max: 490 },
    protein: { min: 15, max: 19 },
    carbs: { min: 52, max: 60 },
    fat: { min: 16, max: 20 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, GF),
  },
  {
    slot: "lunch",
    name: "Lentil & Sweet Potato Curry",
    calories: { min: 400, max: 470 },
    protein: { min: 18, max: 22 },
    carbs: { min: 60, max: 68 },
    fat: { min: 8, max: 12 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN, GF),
  },

  // ── More dinners ────────────────────────────────────────────
  {
    slot: "dinner",
    name: "Herb-Baked Chicken with Green Beans & Potatoes",
    calories: { min: 430, max: 500 },
    protein: { min: 36, max: 42 },
    carbs: { min: 34, max: 42 },
    fat: { min: 12, max: 18 },
    cuisine: "Western",
    diets: D(OMNI, GF, HP),
  },
  {
    slot: "dinner",
    name: "Prawn & Vegetable Stir-Fry (No Rice)",
    calories: { min: 340, max: 400 },
    protein: { min: 28, max: 34 },
    carbs: { min: 16, max: 22 },
    fat: { min: 14, max: 18 },
    cuisine: "Western",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "dinner",
    name: "Baked Cod with Cauliflower Mash & Broccoli",
    calories: { min: 320, max: 390 },
    protein: { min: 32, max: 38 },
    carbs: { min: 14, max: 20 },
    fat: { min: 10, max: 14 },
    cuisine: "Western",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
  {
    slot: "dinner",
    name: "Turkey Meatballs in Tomato Sauce with Courgetti",
    calories: { min: 360, max: 430 },
    protein: { min: 32, max: 38 },
    carbs: { min: 16, max: 22 },
    fat: { min: 16, max: 20 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, GF, LOWCARB, HP),
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SNACKS (macro-complete)
// ════════════════════════════════════════════════════════════════════════════

const LIBRARY_SNACKS: LibrarySnack[] = [
  {
    name: "Greek Yogurt with Honey",
    calories: { min: 120, max: 160 },
    protein: { min: 12, max: 15 },
    carbs: { min: 14, max: 18 },
    fat: { min: 2, max: 4 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, HP),
  },
  {
    name: "Handful of Almonds (28g)",
    calories: { min: 160, max: 180 },
    protein: { min: 6, max: 7 },
    carbs: { min: 5, max: 7 },
    fat: { min: 13, max: 15 },
    cuisine: "Universal",
    diets: D(OMNI, GLY, VEG, VEGAN, GF, LOWCARB, KETO),
  },
  {
    name: "Apple with Peanut Butter",
    calories: { min: 200, max: 240 },
    protein: { min: 6, max: 8 },
    carbs: { min: 26, max: 30 },
    fat: { min: 9, max: 12 },
    cuisine: "Western",
    diets: D(OMNI, VEG, VEGAN),
  },
  {
    name: "Hummus with Carrot & Cucumber Sticks",
    calories: { min: 150, max: 190 },
    protein: { min: 5, max: 7 },
    carbs: { min: 18, max: 22 },
    fat: { min: 7, max: 10 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, VEG, VEGAN, GF),
  },
  {
    name: "Cottage Cheese with Pineapple",
    calories: { min: 140, max: 180 },
    protein: { min: 14, max: 18 },
    carbs: { min: 12, max: 16 },
    fat: { min: 3, max: 5 },
    cuisine: "Western",
    diets: D(OMNI, VEG, HP),
  },
  {
    name: "Mixed Berries with Greek Yogurt",
    calories: { min: 120, max: 160 },
    protein: { min: 10, max: 13 },
    carbs: { min: 16, max: 20 },
    fat: { min: 2, max: 4 },
    cuisine: "Mediterranean",
    diets: D(OMNI, GLY, VEG),
  },
  {
    name: "Boiled Eggs (2)",
    calories: { min: 140, max: 160 },
    protein: { min: 12, max: 14 },
    carbs: { min: 1, max: 2 },
    fat: { min: 10, max: 11 },
    cuisine: "Universal",
    diets: D(OMNI, GLY, VEG, GF, LOWCARB, KETO, HP),
  },
  {
    name: "Whole-Grain Crackers with Cheese",
    calories: { min: 180, max: 220 },
    protein: { min: 8, max: 10 },
    carbs: { min: 18, max: 24 },
    fat: { min: 9, max: 12 },
    cuisine: "Western",
    diets: D(OMNI, VEG),
  },
  {
    name: "Steamed Edamame (Salted)",
    calories: { min: 120, max: 150 },
    protein: { min: 11, max: 13 },
    carbs: { min: 10, max: 13 },
    fat: { min: 5, max: 6 },
    cuisine: "Universal",
    diets: D(OMNI, GLY, VEG, VEGAN, GF, HP),
  },
  {
    name: "Dark Chocolate Square & Walnuts",
    calories: { min: 170, max: 210 },
    protein: { min: 4, max: 6 },
    carbs: { min: 14, max: 18 },
    fat: { min: 12, max: 15 },
    cuisine: "Western",
    diets: D(OMNI, VEG),
  },
  {
    name: "Protein Smoothie (Banana, Whey & Milk)",
    calories: { min: 220, max: 270 },
    protein: { min: 25, max: 30 },
    carbs: { min: 24, max: 30 },
    fat: { min: 4, max: 6 },
    cuisine: "Western",
    diets: D(OMNI, HIGHCAL, HP),
  },
  {
    name: "Olives & Feta",
    calories: { min: 150, max: 190 },
    protein: { min: 6, max: 8 },
    carbs: { min: 4, max: 6 },
    fat: { min: 13, max: 16 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, GF, LOWCARB, KETO),
  },
  {
    name: "Cottage Cheese with Cucumber",
    calories: { min: 100, max: 130 },
    protein: { min: 12, max: 15 },
    carbs: { min: 5, max: 8 },
    fat: { min: 2, max: 4 },
    cuisine: "Western",
    diets: D(OMNI, GLY, VEG, GF, LOWCARB, HP),
  },
  {
    name: "Roasted Chickpeas",
    calories: { min: 120, max: 150 },
    protein: { min: 6, max: 8 },
    carbs: { min: 18, max: 22 },
    fat: { min: 3, max: 5 },
    cuisine: "Mediterranean",
    diets: D(OMNI, VEG, VEGAN, GF),
  },
  {
    name: "Handful of Cashews (28g)",
    calories: { min: 150, max: 170 },
    protein: { min: 5, max: 6 },
    carbs: { min: 8, max: 10 },
    fat: { min: 11, max: 13 },
    cuisine: "Universal",
    diets: D(OMNI, GLY, VEG, VEGAN, GF, LOWCARB, KETO),
  },
  {
    name: "Banana with Peanut Butter",
    calories: { min: 200, max: 240 },
    protein: { min: 6, max: 8 },
    carbs: { min: 26, max: 30 },
    fat: { min: 8, max: 11 },
    cuisine: "Universal",
    diets: D(OMNI, HIGHCAL, HP, VEG, VEGAN),
  },
  {
    name: "Tuna Cucumber Boats",
    calories: { min: 110, max: 140 },
    protein: { min: 16, max: 20 },
    carbs: { min: 3, max: 5 },
    fat: { min: 2, max: 4 },
    cuisine: "Western",
    diets: D(OMNI, GLY, GF, LOWCARB, KETO, HP),
  },
];

// ════════════════════════════════════════════════════════════════════════════
// THE ASIAN AND WEST-AFRICAN KITCHENS (2026-10)
// ════════════════════════════════════════════════════════════════════════════
//
// Two gaps, measured before a dish was written:
//  • There was no Asian kitchen. Not one dal, idli, dosa, pho, adobo, congee or
//    bibimbap in 2,194 dishes, so "Asian" could not be offered as a cuisine.
//  • An African VEGETARIAN had five breakfasts, four lunches and five dinners.
//    A West-African dish named without its meat ("Egusi", a plain "Efo Riro")
//    is usually cooked with it, so only plans written meat-free may serve one.
//    The dishes below are written meat-free and SAY so.
//
// Every name states what in it a restriction or an allergy would care about —
// "(fish sauce)", "(ghee)", "(soy sauce)", "(no meat/fish/crayfish)" — because
// the restriction check reads names (services/nutrition/mealRules). Display
// titles drop the brackets (dishTitle), so the detail costs the screen nothing.
//
// services/nutrition/__tests__/kitchens.test.ts holds every placement here to
// its rule: plant dishes pass the vegan check, GF dishes the gluten check, keto
// dishes keep carbs ≤12% and fat ≥60% of energy, and so on — and every macro
// line adds up to its calories.

// WHERE THEY GO: their kitchen's own plan; the plans written for a restriction
// (a vegetarian may only be served dishes from those — see mealVariety's
// WRITTEN_FOR); and the macro and condition plans each dish clinically fits.
//
// NOT into the everyday plans (calorie-counting, flexitarian, intermittent
// fasting…). Those borrow from every everyday plan at generation time
// (services/nutrition/mealVariety), so an Asian user on calorie-counting is
// served these dishes anyway; copying them in as well would score those plans
// as rich in the user's cuisine and out-rank the cuisine's own plan, which is
// the "picked African, got something else" bug of 2026-09-27 come back.
const ASIA = ["traditional-asian"];
const WEST_AFRICA = ["traditional-african"];
/** Written for vegetarians: eggs and dairy welcome, nothing that was an animal. */
const VEG_PLANS = ["vegetarian", "pescatarian"];
/** Nothing from an animal at all. */
const PLANT = ["vegan", "whole-food-plant-based"];
const PESC = ["pescatarian"];
const HALAL = ["halal"];
const KOSHER = ["kosher"];
// Condition protocols take a dish only where it serves the condition:
const POSTPARTUM = ["postpartum-wellness"]; // congee, ginger broths, tinola
const GUT = ["gut-health"]; // fermented batters, gentle khichdi
const IRON = ["iron-deficiency-recovery"]; // lentils, beans, greens + vitamin C
const ANTI_INFLAM = ["anti-inflammatory"]; // oily fish, ginger
const IMMUNE = ["immunity-boosting"]; // ginger-garlic chicken broths

const r = (min: number, max: number) => ({ min, max });
const ASIAN = { cuisine: "Asian" as const };
const NIGERIAN = { isNigerian: true, cuisine: "Nigerian" as const };
/** West-African but not Nigerian (Ghana, Senegal): the same kitchen, no "Nigerian" badge. */
const WEST_AFRICAN = { cuisine: "Nigerian" as const };

/** Exported so the placements can be tested against the rules they claim. */
export const KITCHEN_MEALS: readonly LibraryMeal[] = [
  // ── Asian breakfasts ────────────────────────────────────────
  {
    slot: "breakfast",
    name: "Idli (3) + Sambar + Coconut Chutney",
    calories: r(350, 410), protein: r(12, 15), carbs: r(52, 62), fat: r(9, 13), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GUT),
  },
  {
    slot: "breakfast",
    name: "Masala Dosa (oil, no ghee) + Sambar",
    calories: r(400, 460), protein: r(11, 14), carbs: r(58, 68), fat: r(12, 16), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GUT),
  },
  {
    slot: "breakfast",
    name: "Poha (flattened rice, peas & peanuts) + Lemon",
    calories: r(320, 370), protein: r(8, 10), carbs: r(50, 56), fat: r(10, 13), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON),
  },
  {
    slot: "breakfast",
    name: "Upma (semolina, vegetables & peanuts)",
    calories: r(280, 330), protein: r(7, 9), carbs: r(42, 50), fat: r(9, 12), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER),
  },
  {
    slot: "breakfast",
    name: "Masala Omelette (2 eggs) + Whole-Wheat Toast",
    calories: r(260, 300), protein: r(15, 18), carbs: r(16, 20), fat: r(14, 17), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GLY, LOWCARB),
  },
  {
    slot: "breakfast",
    name: "Vegetable Congee + Silken Tofu, Ginger & Scallions",
    calories: r(250, 300), protein: r(8, 11), carbs: r(34, 42), fat: r(7, 10), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GUT, POSTPARTUM),
  },
  {
    slot: "breakfast",
    name: "Chicken Congee + Ginger & Scallions",
    calories: r(300, 350), protein: r(25, 30), carbs: r(30, 36), fat: r(7, 10), ...ASIAN,
    diets: D(ASIA, HALAL, KOSHER, GF, POSTPARTUM, IMMUNE, HP),
  },
  {
    slot: "breakfast",
    name: "Steamed Egg (Gyeran-jjim) + Brown Rice + Cucumber",
    calories: r(290, 340), protein: r(14, 18), carbs: r(32, 40), fat: r(10, 13), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GF, GLY),
  },
  {
    slot: "breakfast",
    name: "Grilled Salmon + Steamed Rice + Miso Soup (fish stock)",
    calories: r(350, 400), protein: r(23, 28), carbs: r(34, 42), fat: r(11, 15), ...ASIAN,
    diets: D(ASIA, PESC, HALAL, KOSHER, ANTI_INFLAM, HP),
  },
  {
    slot: "breakfast",
    name: "Moong Dal Chilla (savoury lentil crêpes) + Mint Chutney",
    calories: r(250, 300), protein: r(14, 17), carbs: r(36, 44), fat: r(5, 8), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON),
  },
  {
    slot: "breakfast",
    name: "Vegetable Bao (2) + Unsweetened Soy Milk",
    calories: r(340, 380), protein: r(13, 17), carbs: r(50, 58), fat: r(8, 11), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER),
  },
  {
    slot: "breakfast",
    name: "Tofu Bhurji (spiced scrambled tofu) + Whole-Wheat Roti",
    calories: r(320, 370), protein: r(24, 28), carbs: r(24, 30), fat: r(13, 17), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, HP, GLY),
  },
  {
    slot: "breakfast",
    name: "Egg Bhurji (spiced scrambled eggs) + Sautéed Spinach",
    calories: r(280, 320), protein: r(20, 23), carbs: r(6, 10), fat: r(19, 22), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GF, LOWCARB, KETO, GLY, HP),
  },

  // ── Asian lunches ───────────────────────────────────────────
  {
    slot: "lunch",
    name: "Chana Masala (chickpea curry) + Basmati Rice",
    calories: r(520, 580), protein: r(18, 22), carbs: r(82, 92), fat: r(11, 15), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Dal Tadka (lentils, ghee) + Basmati Rice + Kachumber Salad",
    calories: r(430, 490), protein: r(20, 24), carbs: r(74, 84), fat: r(5, 8), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GF, IRON),
  },
  {
    // The vegan plans' dal: the same pot, tempered in oil instead of ghee.
    slot: "lunch",
    name: "Dal (oil tadka, no ghee) + Brown Rice + Kachumber Salad",
    calories: r(420, 480), protein: r(19, 23), carbs: r(72, 82), fat: r(6, 9), ...ASIAN,
    diets: D(PLANT),
  },
  {
    slot: "lunch",
    name: "Rajma (kidney bean curry) + Brown Rice",
    calories: r(380, 430), protein: r(16, 19), carbs: r(68, 76), fat: r(5, 8), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON),
  },
  {
    slot: "lunch",
    name: "Pho Ga (chicken rice-noodle soup, fish sauce)",
    calories: r(340, 400), protein: r(30, 35), carbs: r(40, 48), fat: r(4, 8), ...ASIAN,
    diets: D(ASIA, HALAL, GF, IMMUNE, HP, GLY),
  },
  {
    slot: "lunch",
    name: "Vegetable Bibimbap (egg, no meat) + Gochujang",
    calories: r(400, 460), protein: r(13, 17), carbs: r(60, 68), fat: r(10, 13), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER),
  },
  {
    slot: "lunch",
    name: "Chicken Adobo (soy sauce & vinegar) + Steamed Rice + Bok Choy",
    calories: r(400, 450), protein: r(30, 35), carbs: r(37, 44), fat: r(13, 16), ...ASIAN,
    diets: D(ASIA, HALAL, KOSHER, HP),
  },
  {
    slot: "lunch",
    name: "Gado-Gado (vegetables, tofu, egg, peanut & soy sauce)",
    calories: r(420, 470), protein: r(28, 33), carbs: r(25, 31), fat: r(22, 26), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, LOWCARB, GLY, HP),
  },
  {
    slot: "lunch",
    name: "Chicken & Vegetable Stir-Fry (light soy sauce) + Brown Rice",
    calories: r(520, 600), protein: r(36, 42), carbs: r(54, 62), fat: r(17, 22), ...ASIAN,
    diets: D(ASIA, HALAL, KOSHER, HP, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Thai Green Curry (chicken, fish sauce) + Jasmine Rice",
    calories: r(510, 570), protein: r(40, 46), carbs: r(55, 63), fat: r(11, 15), ...ASIAN,
    diets: D(ASIA, HALAL, GF, HP, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Thai Green Curry (tofu & vegetables, no fish sauce or shrimp paste) + Jasmine Rice",
    calories: r(430, 480), protein: r(19, 24), carbs: r(49, 57), fat: r(15, 18), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "lunch",
    name: "Chicken Tikka (yogurt marinade) + Kachumber Salad + Whole-Wheat Roti",
    calories: r(370, 420), protein: r(46, 52), carbs: r(25, 31), fat: r(7, 10), ...ASIAN,
    diets: D(ASIA, HALAL, HP, GLY, LOWCARB),
  },
  {
    slot: "lunch",
    name: "Japchae with Tofu (glass noodles, vegetables, soy sauce)",
    calories: r(470, 520), protein: r(19, 23), carbs: r(59, 67), fat: r(16, 20), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER),
  },
  {
    slot: "lunch",
    name: "Sushi Bowl (salmon, brown rice, avocado, cucumber, tamari)",
    calories: r(440, 490), protein: r(26, 31), carbs: r(39, 45), fat: r(18, 22), ...ASIAN,
    diets: D(ASIA, PESC, HALAL, KOSHER, GF, ANTI_INFLAM, GLY),
  },
  {
    slot: "lunch",
    name: "Tom Yum Soup (prawns, mushrooms, fish sauce) + Small Jasmine Rice",
    calories: r(260, 300), protein: r(28, 33), carbs: r(28, 34), fat: r(2, 5), ...ASIAN,
    diets: D(ASIA, PESC, HALAL, GF, HP, GLY),
  },
  {
    slot: "lunch",
    name: "Vegetable Fried Rice + Tofu (light soy sauce, no egg)",
    calories: r(460, 520), protein: r(20, 24), carbs: r(55, 63), fat: r(16, 20), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER),
  },

  // ── Asian dinners ───────────────────────────────────────────
  {
    slot: "dinner",
    name: "Steamed Fish with Ginger & Scallions + Bok Choy + Brown Rice",
    calories: r(340, 390), protein: r(33, 38), carbs: r(35, 41), fat: r(6, 9), ...ASIAN,
    diets: D(ASIA, PESC, HALAL, KOSHER, GF, GLY, HP, ANTI_INFLAM, POSTPARTUM),
  },
  {
    slot: "dinner",
    name: "Tofu & Broccoli Stir-Fry (light soy sauce) + Brown Rice",
    calories: r(490, 550), protein: r(27, 32), carbs: r(45, 53), fat: r(21, 25), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GLY),
  },
  {
    slot: "dinner",
    name: "Chicken Curry (tomato-onion gravy) + Basmati Rice",
    calories: r(490, 550), protein: r(38, 44), carbs: r(42, 50), fat: r(17, 21), ...ASIAN,
    diets: D(ASIA, HALAL, KOSHER, GF, HP, HIGHCAL, GLY),
  },
  {
    slot: "dinner",
    name: "Palak Paneer + Whole-Wheat Roti (2)",
    calories: r(490, 550), protein: r(20, 24), carbs: r(46, 54), fat: r(24, 28), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, HIGHCAL),
  },
  {
    slot: "dinner",
    name: "Miso-Glazed Salmon (miso, mirin) + Steamed Rice + Spinach",
    calories: r(440, 490), protein: r(30, 35), carbs: r(40, 46), fat: r(15, 19), ...ASIAN,
    diets: D(ASIA, PESC, KOSHER, ANTI_INFLAM, HP),
  },
  {
    slot: "dinner",
    name: "Beef & Vegetable Stir-Fry (light soy sauce) + Rice Noodles",
    calories: r(490, 540), protein: r(31, 36), carbs: r(50, 58), fat: r(15, 19), ...ASIAN,
    diets: D(ASIA, HALAL, KOSHER, HIGHCAL, HP),
  },
  {
    slot: "dinner",
    name: "Moong Dal Khichdi + Cucumber Raita",
    calories: r(370, 420), protein: r(15, 18), carbs: r(59, 67), fat: r(7, 10), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GF, GUT, POSTPARTUM),
  },
  {
    slot: "dinner",
    name: "Tandoori Chicken (yogurt marinade) + Kachumber Salad + Mint Raita",
    calories: r(370, 410), protein: r(54, 60), carbs: r(12, 16), fat: r(10, 13), ...ASIAN,
    diets: D(ASIA, HALAL, GF, HP, LOWCARB, GLY),
  },
  {
    slot: "dinner",
    name: "Thai Basil Chicken (soy sauce, oyster sauce & fish sauce) + Jasmine Rice + Fried Egg",
    calories: r(550, 610), protein: r(33, 39), carbs: r(48, 56), fat: r(22, 26), ...ASIAN,
    diets: D(ASIA, HALAL, HIGHCAL),
  },
  {
    slot: "dinner",
    name: "Chicken Satay (soy sauce marinade, peanut sauce) + Cucumber Salad",
    calories: r(440, 480), protein: r(50, 56), carbs: r(13, 17), fat: r(18, 22), ...ASIAN,
    diets: D(ASIA, HALAL, KOSHER, LOWCARB, HP, GLY),
  },
  {
    slot: "dinner",
    name: "Baingan Bharta (smoky eggplant, oil) + Whole-Wheat Roti (2)",
    calories: r(390, 430), protein: r(10, 13), carbs: r(56, 64), fat: r(12, 16), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER),
  },
  {
    slot: "dinner",
    name: "Vegetable Pad Thai (tofu, rice noodles, peanuts, tamarind, no fish sauce or egg)",
    calories: r(500, 550), protein: r(21, 25), carbs: r(56, 64), fat: r(19, 23), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "dinner",
    name: "Mapo Tofu (mushroom & doubanjiang, no meat) + Brown Rice",
    calories: r(480, 530), protein: r(26, 31), carbs: r(43, 49), fat: r(21, 25), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GLY),
  },
  {
    slot: "dinner",
    name: "Chicken Tinola (ginger-papaya chicken soup, fish sauce) + Small Rice",
    calories: r(340, 390), protein: r(30, 35), carbs: r(29, 35), fat: r(9, 13), ...ASIAN,
    diets: D(ASIA, HALAL, GF, POSTPARTUM, IMMUNE, GLY, HP),
  },
  // Asian dishes rebuilt for low-carb and keto plans. Asian-tagged, so an Asian
  // user on keto is still served their kitchen — but kept out of the traditional
  // plan, which a cauliflower "rice" does not belong to.
  {
    slot: "dinner",
    name: "Butter Chicken + Cauliflower Rice (no naan)",
    calories: r(510, 560), protein: r(47, 53), carbs: r(13, 17), fat: r(27, 32), ...ASIAN,
    diets: D(HALAL, GF, LOWCARB, HP, GLY),
  },
  {
    slot: "dinner",
    name: "Shirataki Noodle Stir-Fry with Beef & Vegetables (coconut aminos)",
    calories: r(460, 510), protein: r(28, 32), carbs: r(12, 16), fat: r(32, 37), ...ASIAN,
    diets: D(HALAL, KOSHER, GF, LOWCARB, KETO),
  },
  {
    slot: "dinner",
    name: "Cauliflower Fried Rice with Prawns & Egg (tamari)",
    calories: r(390, 430), protein: r(36, 42), carbs: r(13, 17), fat: r(20, 24), ...ASIAN,
    diets: D(PESC, HALAL, GF, LOWCARB, HP, GLY),
  },

  // ── West-African breakfasts ─────────────────────────────────
  {
    slot: "breakfast",
    name: "Okpa (Bambara nut pudding, palm oil) + Pap",
    calories: r(450, 510), protein: r(15, 18), carbs: r(68, 76), fat: r(13, 16), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "breakfast",
    name: "Ewa Agoyin (mashed beans, pepper sauce, no crayfish) + Agege Bread",
    calories: r(450, 510), protein: r(17, 21), carbs: r(61, 69), fat: r(15, 18), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, HALAL, KOSHER, IRON),
  },
  {
    // The meat-free version of a breakfast the African plan already serves,
    // for plans that may only serve it meat-free.
    slot: "breakfast",
    name: "Pap (Ogi) + Moi-Moi (no fish or egg)",
    calories: r(350, 400), protein: r(16, 19), carbs: r(58, 66), fat: r(5, 8), ...NIGERIAN,
    diets: D(VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON),
  },
  {
    slot: "breakfast",
    name: "Boiled Sweet Potato + Garden Egg & Beans Sauce (no fish)",
    calories: r(430, 490), protein: r(11, 14), carbs: r(66, 74), fat: r(13, 16), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "breakfast",
    name: "Agege Bread + Egg Sauce + Tea with Milk (no sugar)",
    calories: r(450, 510), protein: r(20, 24), carbs: r(54, 62), fat: r(16, 19), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, HALAL, KOSHER),
  },

  // ── West-African lunches ────────────────────────────────────
  {
    slot: "lunch",
    name: "Vegetable Jollof Rice (vegetable stock, no meat/fish) + Moi-Moi (no fish or egg)",
    calories: r(580, 640), protein: r(20, 24), carbs: r(95, 105), fat: r(11, 14), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Vegetable Jollof Rice (small, vegetable stock, no meat/fish) + Moi-Moi (no fish or egg)",
    calories: r(470, 520), protein: r(18, 22), carbs: r(76, 84), fat: r(9, 12), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "lunch",
    name: "Gbegiri (bean soup) + Ewedu (no meat/fish/crayfish) + Amala",
    calories: r(460, 520), protein: r(15, 18), carbs: r(88, 96), fat: r(6, 9), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON),
  },
  {
    slot: "lunch",
    name: "Red-Red (black-eyed pea stew, palm oil, no fish) + Fried Plantain",
    calories: r(490, 540), protein: r(14, 17), carbs: r(70, 78), fat: r(17, 21), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, IRON, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Waakye (rice & beans) + Tomato Pepper Sauce (no shito) + Boiled Egg",
    calories: r(520, 570), protein: r(17, 21), carbs: r(66, 74), fat: r(19, 23), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, VEG_PLANS, HALAL, KOSHER, GF, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Mafe (groundnut stew, no meat/fish) + Rice",
    calories: r(490, 540), protein: r(14, 17), carbs: r(55, 63), fat: r(22, 26), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Chicken Yassa (lemon-onion) + Brown Rice",
    calories: r(520, 570), protein: r(37, 42), carbs: r(45, 51), fat: r(21, 25), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, HALAL, KOSHER, GF, HP, GLY, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Coconut Rice (vegetable stock) + Grilled Fish + Salad",
    calories: r(490, 540), protein: r(34, 38), carbs: r(48, 54), fat: r(15, 19), ...NIGERIAN,
    diets: D(WEST_AFRICA, PESC, HALAL, KOSHER, GF, HP, HIGHCAL),
  },
  {
    slot: "lunch",
    name: "Abacha (African salad) + Ugba (no fish/crayfish)",
    calories: r(480, 530), protein: r(7, 10), carbs: r(68, 76), fat: r(19, 23), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },

  // ── West-African dinners ────────────────────────────────────
  {
    slot: "dinner",
    name: "Egusi Soup (no meat/fish/crayfish) + Wheat Swallow (small)",
    calories: r(460, 510), protein: r(17, 21), carbs: r(46, 54), fat: r(22, 26), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GLY, IRON),
  },
  {
    slot: "dinner",
    name: "Egusi Soup (no meat/fish/crayfish) + Pounded Yam (small)",
    calories: r(490, 540), protein: r(14, 17), carbs: r(58, 66), fat: r(22, 26), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "dinner",
    name: "Vegetable Okra Soup (no meat/fish/crayfish) + Eba (small) + Boiled Egg",
    calories: r(410, 460), protein: r(11, 14), carbs: r(63, 71), fat: r(12, 15), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, HALAL, KOSHER, GF),
  },
  {
    slot: "dinner",
    name: "Ukwa (breadfruit porridge, no fish)",
    calories: r(370, 420), protein: r(13, 16), carbs: r(52, 60), fat: r(11, 14), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    slot: "dinner",
    name: "Spaghetti Jollof (vegetable stock, no meat) + Boiled Egg + Salad",
    calories: r(500, 550), protein: r(18, 22), carbs: r(71, 79), fat: r(15, 18), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, HALAL, KOSHER, HIGHCAL),
  },
  {
    slot: "dinner",
    name: "Thieboudienne (fish & vegetable rice)",
    calories: r(510, 560), protein: r(33, 37), carbs: r(56, 64), fat: r(15, 18), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, PESC, HALAL, KOSHER, GF, HP, HIGHCAL),
  },
  {
    slot: "dinner",
    name: "Banku + Okro Stew (fish, no shellfish) + Grilled Tilapia",
    calories: r(570, 620), protein: r(44, 50), carbs: r(74, 82), fat: r(10, 13), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, PESC, HALAL, KOSHER, GF, HP, HIGHCAL, GUT),
  },
];

/** Exported so the placements can be tested against the rules they claim. */
export const KITCHEN_SNACKS: readonly LibrarySnack[] = [
  // ── Asian ───────────────────────────────────────────────────
  {
    name: "Dhokla (steamed gram-flour cake, 2 pieces)",
    calories: r(130, 170), protein: r(5, 7), carbs: r(20, 24), fat: r(3, 5), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GUT),
  },
  {
    name: "Moong Sprout Chaat (lemon, onion, tomato)",
    calories: r(100, 140), protein: r(7, 9), carbs: r(18, 22), fat: r(0, 2), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GLY, IRON),
  },
  {
    name: "Fresh Spring Rolls (tofu, rice paper, no fish sauce)",
    calories: r(160, 200), protein: r(7, 9), carbs: r(26, 30), fat: r(3, 5), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    name: "Seaweed Snack + Almonds (15)",
    calories: r(115, 140), protein: r(3, 5), carbs: r(2, 4), fat: r(10, 12), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GLY, LOWCARB, KETO),
  },
  {
    name: "Masala Chai (with milk, no sugar) + Roasted Peanuts (20g)",
    calories: r(160, 190), protein: r(7, 9), carbs: r(7, 9), fat: r(12, 14), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GF, GLY, LOWCARB),
  },
  {
    name: "Salmon Onigiri (rice ball)",
    calories: r(160, 200), protein: r(6, 8), carbs: r(30, 34), fat: r(2, 3), ...ASIAN,
    diets: D(ASIA, PESC, HALAL, KOSHER, GF),
  },
  {
    name: "Mango Lassi (unsweetened, small)",
    calories: r(130, 170), protein: r(4, 6), carbs: r(23, 27), fat: r(3, 4), ...ASIAN,
    diets: D(ASIA, VEG_PLANS, HALAL, KOSHER, GF),
  },

  // ── West-African ────────────────────────────────────────────
  {
    name: "Kuli-Kuli (groundnut snack, small)",
    calories: r(140, 180), protein: r(6, 8), carbs: r(5, 7), fat: r(11, 13), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GLY, LOWCARB),
  },
  {
    name: "Kelewele (spiced plantain, air-fried, small)",
    calories: r(140, 170), protein: r(1, 2), carbs: r(30, 34), fat: r(2, 4), ...WEST_AFRICAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF),
  },
  {
    name: "Akara (3 balls, light oil)",
    calories: r(130, 170), protein: r(5, 7), carbs: r(10, 14), fat: r(8, 10), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, PLANT, HALAL, KOSHER, GF, GLY),
  },
  {
    name: "Fura da Nono (millet & fermented milk, small)",
    calories: r(160, 200), protein: r(5, 7), carbs: r(26, 30), fat: r(4, 6), ...NIGERIAN,
    diets: D(WEST_AFRICA, VEG_PLANS, HALAL, KOSHER, GF, GUT),
  },
];

// ════════════════════════════════════════════════════════════════════════════
// MERGE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Merge the library into the given diets in place. Name-deduped and
 * idempotent, so it's safe to call once at module load (and again on reload).
 */
export function augmentDietsWithLibrary(diets: DietData[]): void {
  const byId = new Map(diets.map((d) => [d.id, d]));

  for (const item of [...LIBRARY_MEALS, ...KITCHEN_MEALS]) {
    const { slot, diets: dietIds, ...meal } = item;
    for (const id of dietIds) {
      const diet = byId.get(id);
      if (!diet) continue;
      const arr =
        slot === "breakfast"
          ? diet.breakfastOptions
          : slot === "lunch"
            ? diet.lunchOptions
            : diet.dinnerOptions;
      if (!arr.some((o) => o.name === meal.name)) arr.push(meal);
    }
  }

  for (const item of [...LIBRARY_SNACKS, ...KITCHEN_SNACKS]) {
    const { diets: dietIds, ...snack } = item;
    for (const id of dietIds) {
      const diet = byId.get(id);
      if (!diet) continue;
      if (!diet.snackOptions.some((o) => o.name === snack.name)) {
        diet.snackOptions.push(snack);
      }
    }
  }
}
