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

interface LibraryMeal extends DietMealOption {
  slot: Slot;
  diets: string[];
}

interface LibrarySnack extends DietSnackOption {
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
// MERGE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Merge the library into the given diets in place. Name-deduped and
 * idempotent, so it's safe to call once at module load (and again on reload).
 */
export function augmentDietsWithLibrary(diets: DietData[]): void {
  const byId = new Map(diets.map((d) => [d.id, d]));

  for (const item of LIBRARY_MEALS) {
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

  for (const item of LIBRARY_SNACKS) {
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
