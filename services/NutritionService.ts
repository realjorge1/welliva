/**
 * NUTRITION SERVICE
 * Calculate daily nutrition targets based on user bio
 *
 * Uses WHO, AHA, ADA guidelines with simple adjustments
 */

import {
    AGE_CALORIE_ADJUSTMENTS,
    BASELINE_NUTRITION,
    GOAL_CALORIE_MODIFIERS,
    NutritionTargets,
} from "../models/nutrition";
import { ACTIVITY_MULTIPLIERS, Sex, UserBio } from "../models/user";

/**
 * Calculate personalized nutrition targets
 *
 * Algorithm:
 * 1. Start with sex-based baseline (WHO recommendations)
 * 2. Calculate BMR using Mifflin-St Jeor equation
 * 3. Apply activity level multiplier (TDEE)
 * 4. Adjust for age
 * 5. Apply goal modifier
 * 6. Calculate macros from final calories
 */
export function calculateNutritionTargets(bio: UserBio): NutritionTargets {
  // Step 1: Calculate BMR using Mifflin-St Jeor
  const bmr = calculateBMR(bio.sex, bio.weightKg, bio.heightCm, bio.age);

  // Step 2: Apply activity multiplier to get TDEE
  const activityMultiplier = ACTIVITY_MULTIPLIERS[bio.activityLevel];
  let tdee = bmr * activityMultiplier;

  // Step 3: Apply age adjustment
  const ageRange = getAgeRange(bio.age);
  const ageAdjustment = AGE_CALORIE_ADJUSTMENTS[ageRange] || 1.0;
  tdee = tdee * ageAdjustment;

  // Medical conditions that override goal-based energy logic for safety.
  const conditions = bio.medicalConditions ?? [];
  const isPregnant = conditions.includes("pregnancy");
  const isPostpartum = conditions.includes("postpartum");

  // Step 4: Apply goal modifier, then clamp to medically-sensible bounds.
  // Without this, an extreme bio (very low weight/height/activity) could yield
  // an unsafe daily calorie target. Bounds follow common WHO/AHA minimums.
  //
  // Pregnancy & postpartum need an ENERGY SURPLUS and must never run a deficit:
  // any weight-loss goal modifier is floored at 0, then an evidence-based
  // surplus is added (IOM/WHO: ~+340 kcal in pregnancy averaged over the 2nd–3rd
  // trimester; ~+400 kcal while recovering/breastfeeding). The minimum floor is
  // also raised so a small frame can't be guided to undereat while expecting.
  const goalModifier = GOAL_CALORIE_MODIFIERS[bio.primaryGoal];
  let effectiveGoalModifier = goalModifier;
  let conditionSurplus = 0;
  if (isPregnant) {
    effectiveGoalModifier = Math.max(0, goalModifier);
    // Surplus scales with trimester (IOM): ~+70 (T1), +340 (T2), +450 (T3).
    conditionSurplus =
      bio.pregnancyTrimester === 1
        ? 70
        : bio.pregnancyTrimester === 3
          ? 450
          : 340;
  } else if (isPostpartum) {
    effectiveGoalModifier = Math.max(0, goalModifier);
    conditionSurplus = 400;
  }

  const minCalories =
    isPregnant || isPostpartum ? 1800 : bio.sex === "male" ? 1500 : 1200;
  // Allow the pregnancy/postpartum surplus to land without being clamped away.
  const maxCalories = (bio.sex === "male" ? 3200 : 2800) + conditionSurplus;
  const targetCalories = Math.round(
    Math.max(
      minCalories,
      Math.min(maxCalories, tdee + effectiveGoalModifier + conditionSurplus),
    ),
  );

  // Step 5: Calculate macros
  // Protein: 1.6g/kg for muscle gain, 1.2g/kg for others (higher than WHO
  // minimum). Pregnancy/postpartum raise the floor to ~1.4g/kg (extra ~25g/day).
  let proteinMultiplier =
    bio.primaryGoal === "build_muscle" ||
    bio.primaryGoal === "athletic_performance"
      ? 1.6
      : 1.2;
  if (isPregnant || isPostpartum) {
    proteinMultiplier = Math.max(proteinMultiplier, 1.4);
  }
  const proteinG = Math.round(bio.weightKg * proteinMultiplier);

  // Fat: 25-30% of calories (using 27.5% average)
  const fatCalories = targetCalories * 0.275;
  const fatG = Math.round(fatCalories / 9);

  // Carbs: Remaining calories after protein and fat (never negative — a low
  // clamped calorie target with weight-based protein could otherwise underflow)
  const proteinCalories = proteinG * 4;
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbsG = Math.max(0, Math.round(carbCalories / 4));

  // Get baseline values for non-macro nutrients
  const baseline = BASELINE_NUTRITION[bio.sex];

  // Water: Use user preference or calculate based on weight. Pregnancy and (more
  // so) breastfeeding raise fluid needs (IOM): +300ml pregnant, +700ml nursing.
  let waterMl = bio.waterTargetMl || Math.round(bio.weightKg * 35);
  if (isPregnant) waterMl += bio.pregnancyTrimester === 1 ? 150 : 300;
  else if (isPostpartum) waterMl += 700;

  // Sodium: tighten to the AHA "ideal" 1500mg ceiling for blood-pressure and
  // kidney conditions, and for meds that retain fluid / affect electrolytes
  // (corticosteroids, diuretics, blood-pressure meds).
  const meds = bio.medicationCategories ?? [];
  const needsLowSodium =
    conditions.includes("hypertension") ||
    conditions.includes("renal_issues") ||
    meds.includes("corticosteroids") ||
    meds.includes("diuretics") ||
    meds.includes("blood_pressure");
  const sodiumMg = needsLowSodium
    ? Math.min(baseline.sodiumMg, 1500)
    : baseline.sodiumMg;

  return {
    calories: targetCalories,
    proteinG,
    fatG,
    carbsG,
    sugarG: baseline.sugarG,
    fiberG: baseline.fiberG,
    sodiumMg,
    waterMl,
  };
}

/**
 * Calculate BMR using Mifflin-St Jeor equation
 * Most accurate for modern populations
 */
function calculateBMR(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  if (sex === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

/**
 * Get age range for calorie adjustments
 */
function getAgeRange(age: number): string {
  if (age >= 18 && age <= 30) return "18-30";
  if (age >= 31 && age <= 50) return "31-50";
  if (age >= 51 && age <= 60) return "51-60";
  return "61+";
}

/**
 * Get display-friendly nutrition summary
 */
export function formatNutritionTargets(targets: NutritionTargets): {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  sugar: string;
  water: string;
} {
  return {
    calories: `${targets.calories} kcal`,
    protein: `${targets.proteinG}g`,
    fat: `${targets.fatG}g`,
    carbs: `${targets.carbsG}g`,
    sugar: `<${targets.sugarG}g`,
    water: `${(targets.waterMl / 1000).toFixed(1)}L`,
  };
}

/**
 * Get simple baseline targets by sex (for display when no bio available)
 */
export function getBaselineTargets(sex: Sex): NutritionTargets {
  return { ...BASELINE_NUTRITION[sex] };
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}
