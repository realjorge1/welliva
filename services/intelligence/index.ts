/**
 * INTELLIGENCE LAYER — barrel export.
 *
 * Recommendation + plan-generation + coaching engines. All compose the
 * existing single-source services (NutritionService, DietMatchService,
 * DietPlanGenerator, WorkoutGenerator); none duplicate scoring or persistence.
 */

export {
  buildDietReasons,
  recommendDiets,
} from "./DietRecommendationEngine";
export type {
  DietBand,
  DietRecommendation,
} from "./DietRecommendationEngine";

export { recommendTodayWorkout } from "./ExerciseRecommendationEngine";
export type {
  ExerciseRecommendation,
  ExerciseRecommendationInput,
} from "./ExerciseRecommendationEngine";

export { buildDailyPlan } from "./DailyPlanEngine";
export type { DailyPlan, DailyPlanInput } from "./DailyPlanEngine";

export { buildWeeklyPlan } from "./WeeklyPlanEngine";
export type { WeeklyPlan, WeeklyPlanDay } from "./WeeklyPlanEngine";

export {
  generateCoachInsights,
  getDailyHeadline,
} from "./CoachInsightEngine";
export type {
  CoachContext,
  CoachInsight,
  ConsumedTotals,
  InsightTone,
  InsightType,
} from "./CoachInsightEngine";

export {
  computeConsistency,
  computeWeeklySummary,
  findMealAlternative,
  getProteinStatus,
  hasSmartSwap,
  learnMealTimes,
  rankMealSwaps,
} from "./NutritionInsightEngine";
export type {
  ConsistencyScore,
  DayAdherence,
  LearnedMealTimes,
  LiveDay,
  MealAlternative,
  MealAlternativeInput,
  ProteinState,
  ProteinStatus,
  RankSwapsInput,
  SmartSwap,
  SwapTag,
  WeeklyNutritionSummary,
} from "./NutritionInsightEngine";
