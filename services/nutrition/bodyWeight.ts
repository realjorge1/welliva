/**
 * BODY WEIGHT BASES — which mass a protein target should scale on.
 *
 * Protein was scaled on total bodyweight: `weightKg × 1.2`. That over-prescribes
 * substantially at high BMI, because adipose tissue is not metabolically
 * demanding — it needs very little protein to maintain. A 140 kg user was being
 * asked for 168 g/day when clinical practice would put them nearer 100 g, which
 * is both hard to eat and, for anyone with reduced renal function, the wrong
 * direction entirely.
 *
 * Standard clinical practice above roughly BMI 30 is to dose on ADJUSTED body
 * weight: ideal weight plus 40% of the excess. Below that threshold, actual
 * weight is already the right basis and nothing changes — which is why this
 * moves the numbers for a minority of users, not everybody.
 *
 * Pure functions, no app dependencies, so the maths is directly testable.
 */
import type { Sex, UserBio } from "../../models/user";

/** BMI at or above which protein scales on adjusted, not actual, weight. */
export const ADJUSTED_WEIGHT_BMI_THRESHOLD = 30;

/** Body-mass index from the two fields every bio has. */
export function bmi(weightKg: number, heightCm: number): number {
  if (!(heightCm > 0)) return 0;
  return weightKg / (heightCm / 100) ** 2;
}

/**
 * Devine ideal body weight (kg) — the reference the adjustment is built on.
 * 50 kg (male) / 45.5 kg (female) at 5 ft, plus 2.3 kg per inch above it.
 */
export function idealBodyWeightKg(sex: Sex, heightCm: number): number {
  const inchesOver5ft = Math.max(0, (heightCm - 152.4) / 2.54);
  return (sex === "male" ? 50 : 45.5) + 2.3 * inchesOver5ft;
}

/** Standard clinical adjustment: IBW + 0.4 × (actual − IBW). */
export function adjustedBodyWeightKg(
  sex: Sex,
  heightCm: number,
  actualKg: number,
): number {
  const ibw = idealBodyWeightKg(sex, heightCm);
  return actualKg <= ibw ? actualKg : ibw + 0.4 * (actualKg - ibw);
}

/**
 * The mass protein targets scale on — and the denominator every `g/kg` clinical
 * cap in ConditionConstraints is checked against, so the two always agree.
 */
export function proteinBasisKg(bio: UserBio): number {
  const index = bmi(bio.weightKg, bio.heightCm);
  return index >= ADJUSTED_WEIGHT_BMI_THRESHOLD
    ? adjustedBodyWeightKg(bio.sex, bio.heightCm, bio.weightKg)
    : bio.weightKg;
}
