/**
 * NUTRITION MODELS
 * Daily nutrition targets, history, and tracking
 */

/**
 * NutritionTargets - Daily recommended values
 * Based on WHO, AHA, ADA guidelines
 */
export interface NutritionTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  sugarG: number; // Max recommended
  fiberG: number;
  sodiumMg: number; // Max recommended
  waterMl: number;
}

/**
 * NutritionEntry - Single meal/food item logged
 */
export interface NutritionEntry {
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG?: number;
  loggedAt: string; // ISO timestamp
}

/**
 * DailyNutrition - Aggregated nutrition for a single day
 */
export interface DailyNutrition {
  date: string; // YYYY-MM-DD
  entries: NutritionEntry[];
  totals: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    fiberG: number;
  };
  waterMl: number;
}

/**
 * NutritionHistory - Daily records for history view
 */
export interface NutritionHistoryEntry {
  date: string; // YYYY-MM-DD
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterMl: number;
  mealsLogged: number;
}

/**
 * WeekSummary - Weekly aggregate for charts
 */
export interface WeeklySummary {
  weekStart: string; // YYYY-MM-DD (Monday)
  avgCalories: number;
  avgProtein: number;
  avgWater: number;
  daysTracked: number;
}

/**
 * WHO/AHA Baseline Nutrition Recommendations
 * Simple reference table by sex
 */
export const BASELINE_NUTRITION: Record<"male" | "female", NutritionTargets> = {
  male: {
    calories: 2500,
    proteinG: 56, // 0.8g/kg for 70kg avg
    fatG: 78, // ~28% of calories
    carbsG: 325, // ~52% of calories
    sugarG: 36, // Max 9 tsp (AHA)
    fiberG: 38, // Institute of Medicine
    sodiumMg: 2300, // Max (AHA)
    waterMl: 3700, // Adequate intake
  },
  female: {
    calories: 2000,
    proteinG: 46, // 0.8g/kg for 58kg avg
    fatG: 62, // ~28% of calories
    carbsG: 260, // ~52% of calories
    sugarG: 25, // Max 6 tsp (AHA)
    fiberG: 25, // Institute of Medicine
    sodiumMg: 2300, // Max (AHA)
    waterMl: 2700, // Adequate intake
  },
};

/**
 * Age adjustment factors for calorie needs
 */
export const AGE_CALORIE_ADJUSTMENTS: Record<string, number> = {
  "18-30": 1.0,
  "31-50": 0.95,
  "51-60": 0.9,
  "61+": 0.85,
};

/**
 * Goal-based calorie modifiers
 */
export const GOAL_CALORIE_MODIFIERS = {
  lose_weight: -500, // ~0.5kg/week deficit
  build_muscle: +300, // Lean bulk surplus
  improve_fitness: 0, // Maintain with quality nutrition
  increase_energy: +100, // Slight surplus for energy
  better_health: 0, // Maintain with balanced approach
  athletic_performance: +200, // Performance-focused surplus
};
