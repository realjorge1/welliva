/**
 * DIET PLAN GENERATOR
 *
 * Deterministic generator that selects daily meals from the diet database
 * based on user preferences, calorie targets, and the current day.
 *
 * Rules:
 * - Same inputs + same day → same meal selection (deterministic)
 * - Calorie target respected (picks meals closest to target split)
 * - Dietary restrictions and allergies enforced
 * - Only regenerates when user changes prefs or taps "Regenerate"
 */

import {
    DIET_DATABASE,
    DietData,
    DietMealOption,
    DietSnackOption,
    MealCuisine,
} from "../constants/DietDatabase";
import { DaySchedule, ScheduledMeal } from "../models/diet";
import { NutritionTargets } from "../models/nutrition";
import { CuisinePreference, UserBio } from "../models/user";
import {
    getAllAvailableDiets,
    getRecommendedDiets,
    getSafeOptionDiets,
} from "./DietMatchService";

// ============================================================================
// DETERMINISTIC SEED
// ============================================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ============================================================================
// GENERATOR
// ============================================================================

export interface DietPlanGeneratorResult {
  diet: DietData;
  schedule: DaySchedule;
  dailyNutritionEstimate: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

/**
 * Auto-select the best diet for the user and generate a day's meal plan.
 *
 * @param bio - User bio/profile
 * @param targets - Calorie/macro targets
 * @param date - YYYY-MM-DD date string for determinism
 * @param forceDietId - Optional: force a specific diet instead of auto-selecting
 */
export function generateDietPlan(
  bio: UserBio,
  targets: NutritionTargets,
  date: string,
  forceDietId?: string,
): DietPlanGeneratorResult | null {
  // 1. Pick the diet
  let diet: DietData | undefined;

  if (forceDietId) {
    diet = DIET_DATABASE.find((d) => d.id === forceDietId);
  }

  if (!diet) {
    diet = autoSelectDiet(bio);
  }

  if (!diet) return null;

  // 2. Build deterministic seed from date + diet. Cuisine preference is part of
  // the seed so changing it reshuffles meal variety (not just the pool).
  const seedStr = `${date}_${diet.id}_${bio.primaryGoal}_${bio.dietaryRestriction}_${bio.cuisinePreference ?? "mixed"}_${(bio.foodDislikes ?? []).slice().sort().join(",")}`;
  const seed = hashString(seedStr);
  const rand = seededRandom(seed);

  // 3. Target calorie split across meals
  const mealSplit = getMealCalorieSplit(targets.calories, bio.mealsPerDay);

  // 4. Select meals deterministically
  const breakfast = selectBestMeal(
    diet.breakfastOptions,
    mealSplit.breakfast,
    bio,
    rand,
  );
  const lunch = selectBestMeal(diet.lunchOptions, mealSplit.lunch, bio, rand);
  const dinner = selectBestMeal(
    diet.dinnerOptions,
    mealSplit.dinner,
    bio,
    rand,
  );

  // Select 1-2 snacks
  const snackCount = bio.mealsPerDay === 4 ? 2 : 1;
  const snacks = selectSnacks(diet.snackOptions, snackCount, bio, rand);

  // 5. Build schedule
  const schedule: DaySchedule = {
    date,
    dietId: diet.id,
    dietName: diet.name,
    breakfast: mealOptionToScheduled(breakfast, "breakfast"),
    lunch: mealOptionToScheduled(lunch, "lunch"),
    dinner: mealOptionToScheduled(dinner, "dinner"),
    snacks: snacks.map((s, i) => snackOptionToScheduled(s, i)),
    status: "active",
  };

  // 6. Calculate estimated nutrition
  const dailyNutritionEstimate = calculateDayNutrition(schedule);

  return { diet, schedule, dailyNutritionEstimate };
}

/**
 * Check if a diet plan needs regeneration.
 */
export function shouldRegenerateDietPlan(
  existingSchedule: DaySchedule | null,
  date: string,
): boolean {
  if (!existingSchedule) return true;
  if (existingSchedule.date !== date) return true;
  return false;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function autoSelectDiet(bio: UserBio): DietData | undefined {
  // Try recommended first
  const recommended = getRecommendedDiets(bio);
  if (recommended.length > 0) {
    return DIET_DATABASE.find((d) => d.id === recommended[0].dietId);
  }

  // Try safe options
  const safe = getSafeOptionDiets(bio);
  if (safe.length > 0) {
    return DIET_DATABASE.find((d) => d.id === safe[0].dietId);
  }

  // Fallback to any available
  const all = getAllAvailableDiets(bio);
  if (all.length > 0) {
    return DIET_DATABASE.find((d) => d.id === all[0].dietId);
  }

  // Ultimate fallback: Mediterranean (safest general diet)
  return (
    DIET_DATABASE.find((d) => d.id === "mediterranean") || DIET_DATABASE[0]
  );
}

function getMealCalorieSplit(
  totalCalories: number,
  mealsPerDay: 3 | 4,
): { breakfast: number; lunch: number; dinner: number; snack: number } {
  if (mealsPerDay === 4) {
    return {
      breakfast: totalCalories * 0.25,
      lunch: totalCalories * 0.3,
      dinner: totalCalories * 0.3,
      snack: totalCalories * 0.075, // per snack
    };
  }
  return {
    breakfast: totalCalories * 0.25,
    lunch: totalCalories * 0.35,
    dinner: totalCalories * 0.35,
    snack: totalCalories * 0.05,
  };
}

/**
 * Ordered cuisine tiers for a preference. The generator tries each tier in
 * turn and uses the first that has enough options, so a preference NARROWS the
 * pool when possible but never starves a diet of meals. `null` = no preference.
 */
function cuisineTiers(pref?: CuisinePreference): MealCuisine[][] | null {
  switch (pref) {
    case "african":
      return [["Nigerian"], ["Nigerian", "Universal"]];
    case "western":
      return [["Western"], ["Western", "Mediterranean", "Universal"]];
    case "mediterranean":
      return [["Mediterranean"], ["Mediterranean", "Western", "Universal"]];
    case "mixed":
    default:
      return null;
  }
}

/**
 * Narrow a pool toward the user's preferred cuisine with graceful fallback.
 * Works for both meals and snacks (snacks may lack a `cuisine` tag, so we
 * infer Nigerian from `isNigerian`, else Universal).
 */
function applyCuisinePreference<
  T extends { cuisine?: MealCuisine; isNigerian?: boolean },
>(pool: T[], pref: CuisinePreference | undefined, minKeep = 2): T[] {
  const tiers = cuisineTiers(pref);
  if (!tiers || pool.length === 0) return pool;

  const cuisineOf = (o: T): MealCuisine =>
    o.cuisine ?? (o.isNigerian ? "Nigerian" : "Universal");

  const need = Math.min(minKeep, pool.length);
  for (const tier of tiers) {
    const allowed = new Set(tier);
    const narrowed = pool.filter((o) => allowed.has(cuisineOf(o)));
    if (narrowed.length >= need) return narrowed;
  }
  return pool;
}

function selectBestMeal(
  options: DietMealOption[],
  targetCalories: number,
  bio: UserBio,
  rand: () => number,
): DietMealOption {
  // Filter out options that conflict with allergies
  const filtered = options.filter(
    (opt) => !hasAllergyConflict(opt, bio.allergies),
  );

  const allergySafe = filtered.length > 0 ? filtered : options;

  // Honor learned/declared food preferences (e.g. dairy-free), then prefer the
  // user's cuisine (each with safe fallback), then score by calorie fit.
  const dislikeSafe = applyDislikes(allergySafe, bio.foodDislikes, 2);
  const pool = applyCuisinePreference(dislikeSafe, bio.cuisinePreference);

  // Score each option by closeness to calorie target
  const scored = pool.map((opt) => {
    const avgCal = (opt.calories.min + opt.calories.max) / 2;
    const diff = Math.abs(avgCal - targetCalories);
    return { opt, diff };
  });

  // Sort by closeness
  scored.sort((a, b) => a.diff - b.diff);

  // Pick from top 3 candidates using seeded random for variety
  const topN = Math.min(3, scored.length);
  const idx = Math.floor(rand() * topN);
  return scored[idx].opt;
}

function selectSnacks(
  options: DietSnackOption[],
  count: number,
  bio: UserBio,
  rand: () => number,
): DietSnackOption[] {
  // Keep snacks allergy-safe and aligned to the cuisine preference too.
  const allergySafe = options.filter(
    (opt) => !hasAllergyConflict(opt, bio.allergies),
  );
  const base = allergySafe.length > 0 ? allergySafe : options;
  const dislikeSafe = applyDislikes(base, bio.foodDislikes, 1);
  const pool = [...applyCuisinePreference(dislikeSafe, bio.cuisinePreference, 1)];
  const selected: DietSnackOption[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected;
}

function hasAllergyConflict(
  meal: { name: string },
  allergies: string[],
): boolean {
  if (allergies.length === 0) return false;
  const name = meal.name.toLowerCase();
  return allergies.some((a) => name.includes(a.toLowerCase()));
}

/**
 * Known dietary-preference families → meal-name keywords. Lets a single stored
 * dislike like "dairy" exclude "Cheese Omelet", "Greek Yogurt Bowl", etc. — not
 * just meals literally named "dairy". Tags mirror Adaptive Nutrition's detector
 * (Gozlin Phase 6) so a learned avoidance reshapes future plans for real.
 */
const DISLIKE_KEYWORDS: Record<string, string[]> = {
  dairy: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "dairy"],
  egg: ["egg", "omelet", "omelette", "frittata"],
  eggs: ["egg", "omelet", "omelette", "frittata"],
  fish: ["fish", "salmon", "tuna", "mackerel", "sardine", "shrimp", "prawn", "seafood", "tilapia", "catfish"],
  "red-meat": ["beef", "steak", "lamb", "mutton", "goat", "pork", "bacon"],
  poultry: ["chicken", "turkey"],
  legume: ["bean", "lentil", "chickpea", "moimoi", "moi-moi", "akara", "hummus"],
};

/** Expand a dislike token to its keyword family (or itself if unknown). */
function dislikeKeywords(token: string): string[] {
  const key = token.trim().toLowerCase();
  return DISLIKE_KEYWORDS[key] ?? (key ? [key] : []);
}

function hasDislikeConflict(
  meal: { name: string },
  dislikes?: string[],
): boolean {
  if (!dislikes || dislikes.length === 0) return false;
  const name = meal.name.toLowerCase();
  return dislikes.some((d) => dislikeKeywords(d).some((k) => name.includes(k)));
}

/**
 * Drop disliked meals from a pool, but never below `minKeep` — a preference
 * narrows the pool when possible yet never starves a diet (mirrors the cuisine
 * fallback discipline).
 */
function applyDislikes<T extends { name: string }>(
  pool: T[],
  dislikes: string[] | undefined,
  minKeep = 2,
): T[] {
  if (!dislikes || dislikes.length === 0 || pool.length === 0) return pool;
  const kept = pool.filter((o) => !hasDislikeConflict(o, dislikes));
  return kept.length >= Math.min(minKeep, pool.length) ? kept : pool;
}

function mealOptionToScheduled(
  option: DietMealOption,
  mealType: "breakfast" | "lunch" | "dinner",
): ScheduledMeal {
  return {
    id: `meal_${mealType}_${hashString(option.name)}`,
    mealType,
    name: option.name,
    calories: option.calories,
    proteinG: option.protein,
    carbsG: option.carbs,
    fatG: option.fat,
    isNigerian: option.isNigerian,
    cuisine: option.cuisine,
    isConsumed: false,
  };
}

function snackOptionToScheduled(
  option: DietSnackOption,
  index: number,
): ScheduledMeal {
  // Estimate macros from calories only when the snack doesn't carry real ones
  // (older entries). Rough split: ~10% protein, ~55% carbs, ~35% fat by energy.
  const avgCal = (option.calories.min + option.calories.max) / 2;
  const estProtein = Math.round((avgCal * 0.1) / 4);
  const estCarbs = Math.round((avgCal * 0.55) / 4);
  const estFat = Math.round((avgCal * 0.35) / 9);

  return {
    id: `meal_snack_${index}_${hashString(option.name)}`,
    mealType: "snack",
    name: option.name,
    calories: option.calories,
    proteinG: option.protein ?? { min: estProtein, max: estProtein },
    carbsG: option.carbs ?? { min: estCarbs, max: estCarbs },
    fatG: option.fat ?? { min: estFat, max: estFat },
    isNigerian: option.isNigerian,
    cuisine: option.cuisine,
    isConsumed: false,
  };
}

/**
 * Calculate total estimated nutrition from a DaySchedule.
 * Uses average of min/max for each meal. Single source of truth.
 */
export function calculateDayNutrition(schedule: DaySchedule): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  const addMeal = (meal: ScheduledMeal | null) => {
    if (!meal) return;
    calories += (meal.calories.min + meal.calories.max) / 2;
    proteinG += (meal.proteinG.min + meal.proteinG.max) / 2;
    carbsG += (meal.carbsG.min + meal.carbsG.max) / 2;
    fatG += (meal.fatG.min + meal.fatG.max) / 2;
  };

  addMeal(schedule.breakfast);
  addMeal(schedule.lunch);
  addMeal(schedule.dinner);
  schedule.snacks.forEach(addMeal);

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  };
}

/**
 * Calculate consumed nutrition from a DaySchedule.
 * Only counts meals marked as consumed.
 */
export function calculateConsumedNutrition(schedule: DaySchedule): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  const addIfConsumed = (meal: ScheduledMeal | null) => {
    if (!meal || !meal.isConsumed) return;
    calories += (meal.calories.min + meal.calories.max) / 2;
    proteinG += (meal.proteinG.min + meal.proteinG.max) / 2;
    carbsG += (meal.carbsG.min + meal.carbsG.max) / 2;
    fatG += (meal.fatG.min + meal.fatG.max) / 2;
  };

  addIfConsumed(schedule.breakfast);
  addIfConsumed(schedule.lunch);
  addIfConsumed(schedule.dinner);
  schedule.snacks.forEach(addIfConsumed);

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  };
}
