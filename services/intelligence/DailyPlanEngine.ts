/**
 * DAILY PLAN GENERATION ENGINE
 *
 * Assembles everything a user needs for one day into a single object:
 *   - daily nutrition targets (NutritionService)
 *   - meal suggestions          (DietPlanGenerator, deterministic)
 *   - today's workout           (from the active weekly plan)
 *
 * This is a read/assembly layer — it does NOT persist. AppContext owns
 * persistence; this engine is for previews, "what's my day look like" views,
 * and composing other intelligence (e.g. coach insights).
 */

import { DaySchedule } from "../../models/diet";
import { NutritionTargets } from "../../models/nutrition";
import { UserBio } from "../../models/user";
import { GeneratedWorkoutPlan, WorkoutSession } from "../../models/workout";
import { generateDietPlan } from "../DietPlanGenerator";
import { calculateNutritionTargets } from "../NutritionService";

export interface DailyPlan {
  date: string;
  targets: NutritionTargets;
  mealSchedule: DaySchedule | null;
  estimatedNutrition: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null;
  workout: WorkoutSession | null;
  isRestDay: boolean;
}

export interface DailyPlanInput {
  bio: UserBio;
  date: string; // YYYY-MM-DD (local)
  dietId?: string;
  plan?: GeneratedWorkoutPlan | null;
  /** 0 = Mon … 6 = Sun (local). Required to resolve the day's workout. */
  todayDayIndex?: number;
}

export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const { bio, date, dietId, plan, todayDayIndex } = input;

  const targets = calculateNutritionTargets(bio);
  const dp = generateDietPlan(bio, targets, date, dietId);

  const workout =
    plan && todayDayIndex != null
      ? plan.sessions.find((s) => s.dayOfWeek === todayDayIndex) ?? null
      : null;

  return {
    date,
    targets,
    mealSchedule: dp?.schedule ?? null,
    estimatedNutrition: dp ? dp.dailyNutritionEstimate : null,
    workout,
    isRestDay: !!plan && workout === null,
  };
}
