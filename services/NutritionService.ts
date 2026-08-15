/**
 * NUTRITION SERVICE
 * Calculate daily nutrition targets based on user bio
 *
 * Uses WHO, AHA, ADA guidelines with simple adjustments
 */

import {
    BASELINE_NUTRITION,
    GOAL_CALORIE_MODIFIERS,
    NutritionTargets,
} from "../models/nutrition";
import { ACTIVITY_MULTIPLIERS, Sex, UserBio } from "../models/user";
import {
    applyConstraints,
    resolveConstraintsForBio,
} from "./nutrition/ConditionConstraints";
import { proteinBasisKg } from "./nutrition/bodyWeight";

/**
 * Calculate personalized nutrition targets
 *
 * Algorithm:
 * 1. Calculate BMR using Mifflin-St Jeor equation
 * 2. Apply activity level multiplier (TDEE)
 * 3. Apply goal modifier + any pregnancy/postpartum surplus, then clamp
 * 4. Compute the baseline macro split from the final calories
 * 5. Apply the MEDICAL CONSTRAINTS layer — one declarative pass over every
 *    condition and medication category the user carries
 *
 * Step 5 is why there are no per-condition `if`s left in this file. There used
 * to be four (pregnancy, postpartum, hypertension, renal) against a union of 30
 * conditions, which meant 26 conditions the app advertised as supported changed
 * nothing about the numbers. See services/nutrition/ConditionConstraints.ts.
 */
export function calculateNutritionTargets(bio: UserBio): NutritionTargets {
  // Step 1: Calculate BMR using Mifflin-St Jeor
  const bmr = calculateBMR(bio.sex, bio.weightKg, bio.heightCm, bio.age);

  // Step 2: Apply activity multiplier to get TDEE.
  // The `??` is load-bearing, not defensive noise: `activity_level` arrives from
  // the profile row / API and the DB permits values this union doesn't cover.
  // An unknown level used to make the multiplier `undefined` and every number
  // downstream NaN — a target that renders as "NaN kcal" with no error anywhere.
  const activityMultiplier =
    ACTIVITY_MULTIPLIERS[bio.activityLevel] ?? ACTIVITY_MULTIPLIERS.moderate;
  const tdee = bmr * activityMultiplier;

  // Step 3: NO separate age adjustment.
  //
  // There used to be one here (`tdee *= AGE_CALORIE_ADJUSTMENTS[range]`) and it
  // double-counted age: Mifflin–St Jeor ALREADY contains a `− 5 × age` term, so
  // multiplying its output by a further 0.85–0.95 penalised older users twice.
  // For a 65-year-old that was roughly 300 kcal/day of phantom deficit on top
  // of the ~325 kcal the equation had already removed — enough to make the app
  // quietly prescribe under-eating to exactly the group least able to afford it.
  //
  // AGE_CALORIE_ADJUSTMENTS survives in models/nutrition.ts marked @deprecated.
  // Its only reader is the frozen `legacyTargetsV1` reproduction that lets the
  // correction notice quote the user's OLD number (services/nutrition/
  // TargetsVersion.ts). Nothing live reads it.
  //
  // The LEGITIMATE effect this removed: older adults really do run a lower TDEE
  // than the linear term alone predicts, via lost lean mass and lower
  // non-exercise activity. That belongs on the activity multiplier, or better,
  // learned per-user from logged intake vs. weight change — not as a second age
  // coefficient on the whole equation.

  // Medical conditions that override goal-based energy logic for safety.
  const conditions = bio.medicalConditions ?? [];
  const isPregnant = conditions.includes("pregnancy");
  const isPostpartum = conditions.includes("postpartum");

  // Step 3: Apply goal modifier, then clamp to medically-sensible bounds.
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

  // Step 4: The BASELINE macro split — goal-driven only. Every medical
  // adjustment (renal protein cap, diabetic carb cap, pregnancy protein floor,
  // sodium ceilings) is applied by the constraints pass at the end, so this
  // stays readable and there is exactly one place to look for clinical rules.
  //
  // Protein: 1.6g/kg for muscle gain, 1.2g/kg for others (above the WHO minimum).
  //
  // Scaled on the PROTEIN BASIS weight, not raw bodyweight: above BMI 30 that's
  // adjusted body weight (IBW + 40% of the excess), because adipose tissue isn't
  // metabolically demanding and dosing on total mass over-prescribes badly at
  // high BMI. Below BMI 30 the basis IS actual weight, so nothing changes for
  // most users. See services/nutrition/bodyWeight.ts.
  const basisKg = proteinBasisKg(bio);
  const proteinMultiplier =
    bio.primaryGoal === "build_muscle" ||
    bio.primaryGoal === "athletic_performance"
      ? 1.6
      : 1.2;
  const proteinG = Math.round(basisKg * proteinMultiplier);

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

  const base: NutritionTargets = {
    calories: targetCalories,
    proteinG,
    fatG,
    carbsG,
    sugarG: baseline.sugarG,
    fiberG: baseline.fiberG,
    sodiumMg: baseline.sodiumMg,
    waterMl,
  };

  // Step 5: One declarative pass for all 30 conditions + every medication
  // category. Clamps the ceilings/floors, then re-solves the macro split so the
  // numbers still sum to `targetCalories`, and attaches the guidance (clinician
  // referrals, and what we honestly don't model) for the UI to render.
  // The SAME basis is handed to the constraints pass, so a `0.8 g/kg` renal cap
  // is measured against the same denominator the target was built from.
  return applyConstraints(base, resolveConstraintsForBio(bio), basisKg);
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
