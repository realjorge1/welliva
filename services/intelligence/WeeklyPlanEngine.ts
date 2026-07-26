/**
 * WEEKLY PLAN GENERATION ENGINE
 *
 * Builds a full Mon–Sun plan: a deterministic meal schedule for each day plus
 * the weekly workout plan, and rolls up weekly nutrition averages.
 *
 * Composes DietPlanGenerator + WorkoutGenerator + NutritionService. Read-only
 * assembly (no persistence). Determinism: same bio + same week + same diet →
 * same plan, because each day is generated with its own date seed.
 */

import { DaySchedule } from "../../models/diet";
import { NutritionTargets } from "../../models/nutrition";
import { UserBio } from "../../models/user";
import { GeneratedWorkoutPlan } from "../../models/workout";
import { generateDietPlan } from "../DietPlanGenerator";
import { calculateNutritionTargets } from "../NutritionService";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import { generateWorkoutPlan } from "../WorkoutGenerator";

export interface WeeklyPlanDay {
  date: string; // YYYY-MM-DD
  schedule: DaySchedule | null;
  estimatedCalories: number;
}

export interface WeeklyPlan {
  weekStart: string; // Monday, YYYY-MM-DD
  targets: NutritionTargets;
  days: WeeklyPlanDay[]; // length 7, Mon → Sun
  workoutPlan: GeneratedWorkoutPlan;
  weeklyAverages: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  /** Days in the week that have a workout session scheduled. */
  trainingDays: number;
}

export function buildWeeklyPlan(
  bio: UserBio,
  weekStart: string,
  dietId?: string,
): WeeklyPlan {
  const targets = calculateNutritionTargets(bio);
  const monday = parseLocalDate(weekStart);

  const days: WeeklyPlanDay[] = [];
  let sumCal = 0;
  let sumProt = 0;
  let sumCarb = 0;
  let sumFat = 0;
  let counted = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalDateString(d);

    const dp = generateDietPlan(bio, targets, dateStr, dietId);
    const est = dp?.dailyNutritionEstimate;

    days.push({
      date: dateStr,
      schedule: dp?.schedule ?? null,
      estimatedCalories: est?.calories ?? 0,
    });

    if (est) {
      sumCal += est.calories;
      sumProt += est.proteinG;
      sumCarb += est.carbsG;
      sumFat += est.fatG;
      counted++;
    }
  }

  const workoutPlan = generateWorkoutPlan(bio, weekStart);

  const weeklyAverages =
    counted > 0
      ? {
          calories: Math.round(sumCal / counted),
          proteinG: Math.round(sumProt / counted),
          carbsG: Math.round(sumCarb / counted),
          fatG: Math.round(sumFat / counted),
        }
      : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  return {
    weekStart,
    targets,
    days,
    workoutPlan,
    weeklyAverages,
    trainingDays: workoutPlan.sessions.length,
  };
}
