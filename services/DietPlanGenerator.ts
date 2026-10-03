/**
 * DIET PLAN GENERATOR
 *
 * Deterministic generator that builds a day's meals from the diet database
 * based on user preferences, calorie targets, and the date.
 *
 * Rules:
 * - Same inputs + same day → same meals (deterministic)
 * - Consecutive days differ: each slot ROTATES through every dish the diet may
 *   serve before repeating one (services/nutrition/mealVariety)
 * - Calorie target respected (each portion sized to what the day still needs)
 * - Dietary restrictions and allergies enforced, never relaxed
 * - Only regenerates when user changes prefs or taps "Regenerate"
 */

import {
    DIET_DATABASE,
    DietData,
    DietMealOption,
    DietSnackOption,
} from "../constants/DietDatabase";
import { DaySchedule, ScheduledMeal } from "../models/diet";
import { NutritionTargets } from "../models/nutrition";
import { UserBio } from "../models/user";
import {
    getAllAvailableDiets,
    getRecommendedDiets,
    getSafeOptionDiets,
} from "./DietMatchService";
import { planDay } from "./nutrition/mealVariety";

// ============================================================================
// DETERMINISTIC IDS
// ============================================================================

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

  // 2. The day: every slot takes its turn in the diet's rotation (mealVariety),
  // each portion sized against the calorie split below. Cuisine, restriction,
  // allergies and dislikes all shape the rotation, so changing any of them
  // reshuffles the days ahead.
  const mealSplit = getMealCalorieSplit(targets.calories, bio.mealsPerDay);
  const day = planDay({
    diet,
    bio,
    split: mealSplit,
    snackCount: bio.mealsPerDay === 4 ? 2 : 1,
    date,
  });
  if (!day) return null;

  // 3. Build schedule
  const schedule: DaySchedule = {
    date,
    dietId: diet.id,
    dietName: diet.name,
    breakfast: mealOptionToScheduled(day.breakfast, "breakfast"),
    lunch: mealOptionToScheduled(day.lunch, "lunch"),
    dinner: mealOptionToScheduled(day.dinner, "dinner"),
    snacks: day.snacks.map((s, i) => snackOptionToScheduled(s, i)),
    status: "active",
  };

  // 4. Calculate estimated nutrition
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

export function getMealCalorieSplit(
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

export function mealOptionToScheduled(
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
