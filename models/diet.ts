/**
 * DIET MODELS
 * Diet selection, meal scheduling, and planning types
 */

/**
 * DietMatchScore - Result of diet compatibility check
 */
export interface DietMatchScore {
  dietId: string;
  score: number; // 0-96
  isRecommended: boolean; // 87-96%
  isSafeOption: boolean; // 75-86%
  isBlocked: boolean; // Medical/allergy conflict
  blockReasons?: string[];
  warnings?: string[];
  reasons?: string[]; // "Why this diet?" explanations
}

/**
 * ScheduleType - How diet is applied
 */
export type ScheduleType = "daily" | "weekly";

/**
 * MealType - Standard meal categories
 */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * ScheduledMeal - A meal assigned to a specific slot
 */
export interface ScheduledMeal {
  id: string;
  mealType: MealType;
  name: string;
  calories: { min: number; max: number };
  proteinG: { min: number; max: number };
  carbsG: { min: number; max: number };
  fatG: { min: number; max: number };
  isNigerian?: boolean;
  cuisine?: "Nigerian" | "Western" | "Mediterranean" | "Universal";
  isConsumed: boolean;
  consumedAt?: string; // ISO timestamp
}

/**
 * DaySchedule - Meals scheduled for a single day
 */
export interface DaySchedule {
  date: string; // YYYY-MM-DD
  dietId: string;
  dietName: string;
  breakfast: ScheduledMeal | null;
  lunch: ScheduledMeal | null;
  dinner: ScheduledMeal | null;
  snacks: ScheduledMeal[];
  status: "upcoming" | "active" | "completed" | "expired";
}

/**
 * WeekSchedule - 7-day meal plan
 */
export interface WeekSchedule {
  id: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  dietId: string;
  dietName: string;
  days: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
  createdAt: string;
}

/**
 * ScheduledDiet - A diet scheduled for a specific day
 */
export interface ScheduledDiet {
  id: string;
  date: string; // YYYY-MM-DD
  dietId: string;
  dietName: string;
  scheduleType: "single_day";
  schedule: DaySchedule;
  createdAt: string;
}

/**
 * TodayDiet - Resolved diet for today
 */
export interface TodayDiet {
  hasScheduledDiet: boolean;
  source: "daily" | "weekly" | "none";
  schedule: DaySchedule | null;
  reminder?: {
    type: "expired" | "completed" | "none";
    message?: string;
  };
}

/**
 * DietHistory - Record of past diets
 */
export interface DietHistoryEntry {
  date: string;
  dietId: string;
  dietName: string;
  mealsConsumed: number;
  totalMeals: number;
  status: "completed" | "partial" | "skipped";
  // Consumed macro totals at day-end (optional — recorded since 2026-06; older
  // entries won't have them, so weekly macro averages simply skip those days).
  consumedCalories?: number;
  consumedProteinG?: number;
  consumedCarbsG?: number;
  consumedFatG?: number;
  // Meal names by outcome at day-end (optional). Powers Adaptive Nutrition's
  // food-preference learning — which kinds of meals the user actually eats vs
  // routinely skips. Older entries won't have them; the engine handles absence.
  consumedMeals?: string[];
  skippedMeals?: string[];
  // Local clock time (minutes from midnight) each slot was actually eaten,
  // captured at day-end from each meal's consumedAt. Powers cross-day meal-time
  // learning (the "best time for your next meal" windows). Snack is the average
  // of consumed snack times that day. Absent for meals not eaten or for days
  // logged before this was added; consumers must tolerate absence.
  mealTimes?: Partial<Record<MealType, number>>;
}

/**
 * Day name type for weekly schedules
 */
export type DayName =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/**
 * Get day name from date
 */
export function getDayName(date: Date): DayName {
  const days: DayName[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  // Adjust: getDay() returns 0 for Sunday, but we want Monday=0
  const dayIndex = date.getDay();
  return days[dayIndex] as DayName;
}

/**
 * Format date as YYYY-MM-DD in LOCAL time.
 * (Must match services/OfflineStorage.toLocalDateString so "today" is
 * computed consistently everywhere — never use toISOString() here.)
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
