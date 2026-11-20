/**
 * PACE — how far below (or above) what she burns her calorie target sits.
 *
 * ── WHY A SHARE, NOT A FIXED −500 ───────────────────────────────────────────
 * The old modifier took 500 kcal off everybody. For a 60 kg woman burning
 * 1,815 that is a 28% cut, harsh enough that small women hit the 1,200 floor;
 * for a 140 kg man burning 3,238 it is a gentle 15%. A share of maintenance
 * scales the cut with the person, which is how MacroFactor and Lose It! frame
 * a pace (and why both let her choose one). At 20% the cut lands near the
 * ~0.5–1% of body weight a week that the weight-management literature treats
 * as sustainable while keeping lean mass (Hall & Kahan 2018; Helms 2014).
 *
 * ── WHO GETS NO CUT AT ALL ──────────────────────────────────────────────────
 * Under 18, a BMI under 18.5, pregnancy and postpartum: the goal's modifier is
 * floored at 0 whatever the goal says, as pregnancy always was. A calorie
 * number is a prescription in a user's mind; for these four it must never be a
 * deficit.
 *
 * ── EXISTING USERS ──────────────────────────────────────────────────────────
 * `bio.pace` absent = an account from before pace existed. It keeps the fixed
 * modifier it was always given (−500 to lose, +300 to build), the owner's
 * 2026-11-20 decision: nobody's number moves until they pick a pace. Onboarding
 * writes "steady" for every new account, so the new default is an explicit
 * stored value, never a hidden flag.
 *
 * Pure: no storage, no clock. Every threshold is a named constant with its why.
 */
import { GOAL_CALORIE_MODIFIERS } from "../../models/nutrition";
import type { TargetPace, UserBio } from "../../models/user";
import { bmi } from "./bodyWeight";

/** kcal stored in one kg of body mass — the standard energy-balance constant. */
export const KCAL_PER_KG = 7700;

/** Share of maintenance cut per pace when losing. 25% is the hard maximum. */
export const LOSE_SHARE: Record<TargetPace, number> = {
  gentle: 0.1,
  steady: 0.2, // the default for every new account
  faster: 0.25,
};

/**
 * Never more than 1 kg a week, however large the person: past it, lean-mass
 * loss and gallstone risk climb (the usual clinical ceiling for a self-directed
 * diet). 7,700 × 1 / 7 = 1,100 kcal a day.
 */
export const MAX_LOSS_KG_PER_WEEK = 1;
export const MAX_DAILY_DEFICIT_KCAL = Math.round((KCAL_PER_KG * MAX_LOSS_KG_PER_WEEK) / 7);

/** Share of maintenance added per pace when building muscle. */
export const GAIN_SHARE: Record<TargetPace, number> = {
  gentle: 0.05,
  steady: 0.1,
  faster: 0.15,
};
/** A lean-gain surplus below ~150 kcal is lost in logging noise; above ~500 it is mostly fat (Iraki 2019). */
export const GAIN_MIN_KCAL = 150;
export const GAIN_MAX_KCAL = 500;

/** Inside this distance of her goal weight the cut halves for the last stretch. */
export const TAPER_KG = 2;
export const TAPER_FACTOR = 0.5;

/** Below this BMI no deficit is ever set (WHO's underweight cut-off). */
export const NO_CUT_BMI = 18.5;
/** Below this age no deficit is ever set: growth needs the energy. */
export const ADULT_AGE = 18;

export type NoCutReason = "under_18" | "underweight" | "pregnancy" | "postpartum";

/**
 * Why this person must never be given a calorie cut, or null. Pregnancy and
 * postpartum are checked first so their own rules stay the ones that speak.
 */
export function noCutReason(
  bio: Pick<UserBio, "age" | "weightKg" | "heightCm" | "medicalConditions">,
): NoCutReason | null {
  const conditions = bio.medicalConditions ?? [];
  if (conditions.includes("pregnancy")) return "pregnancy";
  if (conditions.includes("postpartum")) return "postpartum";
  if (bio.age > 0 && bio.age < ADULT_AGE) return "under_18";
  const index = bmi(bio.weightKg, bio.heightCm);
  if (index > 0 && index < NO_CUT_BMI) return "underweight";
  return null;
}

/** The daily cut for a pace, before any floor. Positive kcal. */
export function deficitFor(maintenanceKcal: number, pace: TargetPace): number {
  return Math.min(maintenanceKcal * LOSE_SHARE[pace], MAX_DAILY_DEFICIT_KCAL);
}

/** The daily surplus for a muscle-gain pace. Positive kcal. */
export function surplusFor(maintenanceKcal: number, pace: TargetPace): number {
  return Math.min(GAIN_MAX_KCAL, Math.max(GAIN_MIN_KCAL, maintenanceKcal * GAIN_SHARE[pace]));
}

/**
 * The goal's calorie modifier for this person (kcal/day; negative = a cut).
 *
 * The one place a pace becomes a number. `calculateNutritionTargets` adds it to
 * maintenance and then applies the floor, the plausibility bound and the
 * clinical pass — all of which still have the last word.
 */
export function goalModifierFor(
  bio: Pick<
    UserBio,
    "primaryGoal" | "pace" | "nearGoalTaper" | "age" | "weightKg" | "heightCm" | "medicalConditions"
  >,
  maintenanceKcal: number,
): number {
  const fixed = GOAL_CALORIE_MODIFIERS[bio.primaryGoal] ?? 0;
  let modifier = fixed;

  if (bio.primaryGoal === "lose_weight" && bio.pace) {
    modifier = -deficitFor(maintenanceKcal, bio.pace);
  } else if (bio.primaryGoal === "build_muscle" && bio.pace) {
    modifier = surplusFor(maintenanceKcal, bio.pace);
  }

  // The last stretch to her goal weight runs at half the cut. Only a cut
  // tapers; a surplus is never "eased" by this flag.
  if (modifier < 0 && bio.nearGoalTaper) modifier *= TAPER_FACTOR;

  // No cut for anyone in the four groups above, whatever the goal says.
  if (noCutReason(bio) !== null) modifier = Math.max(0, modifier);
  return modifier;
}

/** "about 0.4 kg a week" — a daily kcal change as a weekly weight change. */
export function kgPerWeek(dailyKcal: number): number {
  return Math.round(((Math.abs(dailyKcal) * 7) / KCAL_PER_KG) * 10) / 10;
}

/**
 * The calm line the target screen shows when a cut was asked for and not set.
 * Never a diagnosis: it says what the app did and who can help, nothing about
 * her body beyond that.
 */
export function noCutLine(reason: NoCutReason): string | null {
  switch (reason) {
    case "under_18":
      return (
        "While you're still growing, I set your calories to what your body uses " +
        "rather than a calorie cut. If your weight is something you'd like to work on, " +
        "a doctor can help you plan it safely."
      );
    case "underweight":
      return (
        "I've set your calories to what your body uses, with no calorie cut, because a " +
        "cut isn't advised at your current weight for your height. A doctor or " +
        "dietitian can help if you'd like to talk it through."
      );
    default:
      // Pregnancy and postpartum explain themselves through their own rules.
      return null;
  }
}
