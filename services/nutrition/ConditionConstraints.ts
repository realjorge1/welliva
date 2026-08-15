/**
 * CONDITION CONSTRAINTS — what a medical condition does to the NUMBERS.
 *
 * THE PROBLEM THIS REPLACES. `MedicalCondition` has 30 values. The target
 * calculator used to read exactly four of them (pregnancy, postpartum,
 * hypertension, renal_issues) with inline `if`s. The other 26 — gout, PCOS,
 * celiac, IBD, fatty liver, hypothyroidism — were cosmetic at the target layer:
 * the app said it supported them and then handed the user a healthy person's
 * numbers. Adding three more `if` branches would have fixed three conditions and
 * left the shape of the bug intact.
 *
 * So this is a TABLE, not branching logic. One declarative entry per condition,
 * one merge pass, one application pass. Adding a condition is a data edit.
 *
 * THREE RULES THAT MAKE IT SAFE
 *
 *  1. A CAP ALWAYS BEATS A FLOOR. Stack pregnancy (protein floor 1.4 g/kg) with
 *     renal impairment (cap 0.8) and the cap wins. Getting this backwards is the
 *     failure mode with actual harm potential, so it is not left to entry order.
 *
 *  2. CARB RESTRICTION CAN BE VETOED. In type 1 diabetes insulin is dosed TO
 *     carbohydrate. Quietly lowering a T1 user's carb target while their insulin
 *     ratios stay put is a hypoglycemia risk — the intervention for T1 is carb
 *     VISIBILITY and consistency, not restriction. Same for anyone on
 *     insulin/secretagogue medication. So those sources set
 *     `carbRestrictionUnsafe`, which vetoes every other condition's carb cap
 *     (e.g. a T1 user who also has PCOS). Restrict for T2/prediabetes; count for T1.
 *
 *  3. WHAT WE DON'T MODEL IS STATED, NOT HIDDEN. `unmodeled` lists the levers
 *     that genuinely matter for a condition and that this app does not compute
 *     (phosphorus, FODMAP load, saturated fat…). `clinicianReferral` carries the
 *     cases where our number is a conservative starting point rather than a
 *     prescription — and it is rendered where the target is shown, not buried in
 *     settings.
 *
 * SCOPE. This layer sets macro/mineral CEILINGS and FLOORS. Food selection
 * (purines, FODMAPs, gluten, trigger foods) belongs to the diet/allergen layer;
 * flags here mark those hand-offs.
 */
import type {
  MedicalCondition,
  MedicationCategory,
  UserBio,
} from "../../models/user";
import type { NutritionGuidance, NutritionTargets } from "../../models/nutrition";

/* ─────────────────────────── the declarative shape ─────────────────────────*/

export interface NutrientConstraint {
  /** Grams of protein per kg of the protein BASIS weight (see bodyWeight.ts). */
  proteinGPerKg?: { min?: number; max?: number };
  sodiumMgMax?: number;
  sugarGMax?: number;
  /** Share of total energy allowed from added sugar (0–1). */
  addedSugarPctEnergyMax?: number;
  /** Share of total energy allowed from carbohydrate (0–1). */
  carbsPctEnergyMax?: number;
  /** Share of total energy allowed from fat (0–1) — gallbladder, pancreatitis. */
  fatPctEnergyMax?: number;
  fiberGPer1000Kcal?: { min: number };
  potassiumMgMax?: number;
  /** Food-selection flag for the diet layer; no effect on macro numbers. */
  purineRestricted?: boolean;
  /**
   * Rule 2 above: this source makes carbohydrate restriction UNSAFE, and vetoes
   * every `carbsPctEnergyMax` in the merge.
   */
  carbRestrictionUnsafe?: boolean;
  /** Shown in-app AND required before the plan renders. */
  clinicianReferral?: string;
  /** Constraints we deliberately DON'T model — surfaced honestly to the user. */
  unmodeled?: string[];
}

/** The merged, conflict-resolved result of every condition a user carries. */
export interface ResolvedConstraints {
  proteinGPerKgMin?: number;
  proteinGPerKgMax?: number;
  sodiumMgMax?: number;
  sugarGMax?: number;
  addedSugarPctEnergyMax?: number;
  carbsPctEnergyMax?: number;
  fatPctEnergyMax?: number;
  fiberGPer1000KcalMin?: number;
  potassiumMgMax?: number;
  purineRestricted: boolean;
  carbRestrictionUnsafe: boolean;
  /** Deduped, in a stable order. Rendered at the point the target is shown. */
  referrals: string[];
  unmodeled: string[];
}

/* ──────────────────────────────── the table ────────────────────────────────*/

const DIABETES_CARB_CAP = 0.45; // ADA: no single ratio, but ≤45% is the common target
const DIABETES_FIBER = { min: 14 }; // 14 g per 1000 kcal — IOM/ADA
const ADDED_SUGAR_CAP = 0.05; // WHO conditional recommendation

/**
 * Every value of MedicalCondition, explicitly. `{}` means "we looked, and no
 * TARGET changes — the condition is handled elsewhere or has no macro lever".
 * `Record` (not `Partial<Record>`) on purpose: adding a condition to the union
 * without deciding what it does here is now a compile error.
 */
export const CONDITION_CONSTRAINTS: Record<MedicalCondition, NutrientConstraint> = {
  /* ── Heart & metabolic ────────────────────────────────────────────────── */
  hypertension: {
    sodiumMgMax: 1500, // AHA "ideal", not the 2300 general ceiling
    unmodeled: ["DASH potassium/calcium/magnesium pattern", "alcohol intake"],
  },
  high_cholesterol: {
    fiberGPer1000Kcal: { min: 14 }, // soluble fiber is the dietary LDL lever
    unmodeled: ["saturated fat", "trans fat", "dietary cholesterol"],
  },
  diabetes_type2: {
    carbsPctEnergyMax: DIABETES_CARB_CAP,
    addedSugarPctEnergyMax: ADDED_SUGAR_CAP,
    fiberGPer1000Kcal: DIABETES_FIBER,
    unmodeled: ["glycemic index", "carbohydrate distribution across meals"],
  },
  diabetes_type1: {
    // Deliberately NOT carb-restricted — see rule 2 in the header.
    carbRestrictionUnsafe: true,
    addedSugarPctEnergyMax: ADDED_SUGAR_CAP,
    fiberGPer1000Kcal: DIABETES_FIBER,
    clinicianReferral:
      "Your insulin is dosed to your carbs, so we won't lower your carb " +
      "target — we'll show carbs per meal clearly instead. Keep your ratios " +
      "with your care team.",
    unmodeled: ["insulin-to-carb ratio", "correction factors", "hypo treatment"],
  },
  prediabetes: {
    carbsPctEnergyMax: DIABETES_CARB_CAP,
    addedSugarPctEnergyMax: ADDED_SUGAR_CAP,
    fiberGPer1000Kcal: DIABETES_FIBER,
  },
  metabolic_syndrome: {
    carbsPctEnergyMax: DIABETES_CARB_CAP,
    addedSugarPctEnergyMax: ADDED_SUGAR_CAP,
    fiberGPer1000Kcal: DIABETES_FIBER,
    sodiumMgMax: 2000, // the blood-pressure component of the cluster
  },

  /* ── Digestive ─────────────────────────────────────────────────────────── */
  gerd: {
    unmodeled: [
      "trigger foods (caffeine, mint, tomato, citrus, alcohol)",
      "meal size and how late you eat",
    ],
  },
  ibs: { unmodeled: ["FODMAP load", "individual trigger foods"] },
  ibd: {
    clinicianReferral:
      "Crohn's and colitis flip the usual fiber advice: high fiber helps in " +
      "remission and can hurt during a flare. We keep a general target — your " +
      "gastro team should set it for where you are right now.",
    unmodeled: [
      "fiber tolerance during a flare",
      "iron, B12 and vitamin D malabsorption",
    ],
  },
  celiac: {
    // The gluten exclusion itself is the allergen/restriction layer's job.
    unmodeled: ["cross-contamination", "iron, folate & calcium after damage"],
  },
  diverticulitis: {
    clinicianReferral:
      "Fiber advice inverts between an acute flare (low residue) and recovery " +
      "(high fiber). Ours assumes you're well — follow your doctor during a flare.",
    unmodeled: ["acute-flare low-residue phase"],
  },
  constipation: {
    fiberGPer1000Kcal: { min: 14 },
    unmodeled: ["fluid timing", "physical activity"],
  },
  lactose_intolerance: {
    unmodeled: ["lactose load per serving", "calcium without dairy"],
  },

  /* ── Liver, kidney & endocrine ─────────────────────────────────────────── */
  renal_issues: {
    // The single most consequential entry in this table. Non-dialysis CKD is
    // managed near 0.6–0.8 g/kg; the goal-driven 1.2–1.6 is roughly double it,
    // and protein load is the dietary lever that most directly affects renal
    // progression.
    proteinGPerKg: { max: 0.8 },
    sodiumMgMax: 1500,
    potassiumMgMax: 2000,
    clinicianReferral:
      "Kidney conditions need protein, potassium and phosphorus set by your " +
      "renal dietitian or nephrologist — the staging matters and we can't see " +
      "it. Treat these as a conservative starting point, not a prescription.",
    unmodeled: ["phosphorus", "fluid restriction", "dialysis status", "CKD stage"],
  },
  fatty_liver: {
    addedSugarPctEnergyMax: ADDED_SUGAR_CAP, // fructose is the main dietary driver
    fiberGPer1000Kcal: { min: 14 },
    unmodeled: ["fructose from sweetened drinks", "alcohol"],
  },
  gallbladder: {
    fatPctEnergyMax: 0.25, // large fat loads trigger biliary colic
    unmodeled: ["fat load per meal (the trigger is per-meal, not per-day)"],
  },
  pancreatitis: {
    fatPctEnergyMax: 0.2,
    clinicianReferral:
      "Pancreatitis needs a fat target — and often enzyme replacement — set by " +
      "your specialist. Complete alcohol avoidance is part of the treatment.",
    unmodeled: ["alcohol", "enzyme replacement", "acute vs chronic phase"],
  },
  hypothyroidism: {
    unmodeled: [
      "levothyroxine timing around fiber, calcium, iron and soy",
      "iodine and selenium",
    ],
  },
  hyperthyroidism: {
    unmodeled: [
      "raised resting metabolism while thyrotoxic (your real needs may be higher)",
      "iodine",
    ],
  },
  gout: {
    purineRestricted: true,
    addedSugarPctEnergyMax: ADDED_SUGAR_CAP, // fructose raises serum urate
    unmodeled: ["purine load per food", "alcohol (beer especially)"],
  },

  /* ── Hormonal & life-stage ─────────────────────────────────────────────── */
  pcos: {
    carbsPctEnergyMax: DIABETES_CARB_CAP,
    fiberGPer1000Kcal: DIABETES_FIBER,
    unmodeled: ["insulin sensitivity varies widely in PCOS"],
  },
  endometriosis: { unmodeled: ["anti-inflammatory pattern (evidence is limited)"] },
  pregnancy: {
    // The ENERGY side (trimester surplus, raised floor, fluid) is upstream in
    // NutritionService — it's goal logic, not a constraint. This is the protein
    // floor, which a renal cap is allowed to override (rule 1).
    proteinGPerKg: { min: 1.4 },
    unmodeled: [
      "caffeine limit",
      "food-safety exclusions (listeria, high-mercury fish)",
      "folate, iron and iodine supplementation",
    ],
  },
  postpartum: {
    proteinGPerKg: { min: 1.4 },
    unmodeled: ["lactation micronutrient needs beyond energy and fluid"],
  },
  menopause: { unmodeled: ["calcium and vitamin D for bone density"] },

  /* ── Immune, blood & musculoskeletal ───────────────────────────────────── */
  anemia: {
    unmodeled: [
      "iron, B12 and folate",
      "vitamin C pairing; tea/coffee away from iron-rich meals",
    ],
  },
  arthritis: { unmodeled: ["omega-3 to omega-6 balance"] },
  osteoporosis: {
    sodiumMgMax: 2000, // high sodium raises urinary calcium loss
    unmodeled: ["calcium and vitamin D", "protein adequacy for bone"],
  },

  /* ── Neurological ──────────────────────────────────────────────────────── */
  migraine: {
    unmodeled: [
      "trigger foods (tyramine, nitrates, aspartame)",
      "meal regularity and hydration",
    ],
  },

  none: {},
};

/**
 * Medication CATEGORIES that move the numbers. Same shape, merged identically —
 * a diuretic should tighten sodium whether or not a condition was ticked.
 */
export const MEDICATION_CONSTRAINTS: Record<MedicationCategory, NutrientConstraint> = {
  corticosteroids: {
    sodiumMgMax: 1500, // fluid retention
    unmodeled: ["steroid-induced blood-glucose rise", "bone protection"],
  },
  diuretics: {
    sodiumMgMax: 1500,
    unmodeled: ["potassium — varies by diuretic class, ask your prescriber"],
  },
  blood_pressure: {
    sodiumMgMax: 1500,
    unmodeled: ["potassium with ACE inhibitors / ARBs"],
  },
  blood_thinners: {
    unmodeled: ["keep vitamin K (leafy greens) STEADY rather than low"],
  },
  diabetes: {
    // Insulin and sulfonylureas are dosed against carbohydrate — the same
    // hypoglycemia argument as type 1. Vetoes any carb cap.
    carbRestrictionUnsafe: true,
    clinicianReferral:
      "Because your medication is dosed against your carbs, we won't cut your " +
      "carb target on our own — changing intake without changing the dose can " +
      "cause a hypo. Ask your prescriber before you change either.",
  },
  thyroid: {
    unmodeled: ["levothyroxine absorption: separate from fiber, calcium and iron"],
  },
  nsaids: {
    unmodeled: ["fluid retention and blood-pressure effects on long-term NSAIDs"],
  },
  antibiotics: {},
  antidepressants: {},
  other: {},
};

/* ──────────────────────────────── resolution ───────────────────────────────*/

const minDefined = (a: number | undefined, b: number | undefined) =>
  a == null ? b : b == null ? a : Math.min(a, b);
const maxDefined = (a: number | undefined, b: number | undefined) =>
  a == null ? b : b == null ? a : Math.max(a, b);

/**
 * Merge every constraint a user carries into one, taking the MOST RESTRICTIVE
 * value per field: lowest ceiling, highest floor. Then resolve the two conflicts
 * that a naive merge gets wrong (see rules 1 and 2 in the header).
 */
export function resolveConstraints(
  conditions: readonly MedicalCondition[] | undefined,
  medications: readonly MedicationCategory[] | undefined,
): ResolvedConstraints {
  const sources: NutrientConstraint[] = [];
  for (const condition of conditions ?? []) {
    const entry = CONDITION_CONSTRAINTS[condition];
    if (entry) sources.push(entry);
  }
  for (const medication of medications ?? []) {
    const entry = MEDICATION_CONSTRAINTS[medication];
    if (entry) sources.push(entry);
  }

  const out: ResolvedConstraints = {
    purineRestricted: false,
    carbRestrictionUnsafe: false,
    referrals: [],
    unmodeled: [],
  };

  for (const s of sources) {
    out.proteinGPerKgMin = maxDefined(out.proteinGPerKgMin, s.proteinGPerKg?.min);
    out.proteinGPerKgMax = minDefined(out.proteinGPerKgMax, s.proteinGPerKg?.max);
    out.sodiumMgMax = minDefined(out.sodiumMgMax, s.sodiumMgMax);
    out.sugarGMax = minDefined(out.sugarGMax, s.sugarGMax);
    out.addedSugarPctEnergyMax = minDefined(
      out.addedSugarPctEnergyMax,
      s.addedSugarPctEnergyMax,
    );
    out.carbsPctEnergyMax = minDefined(out.carbsPctEnergyMax, s.carbsPctEnergyMax);
    out.fatPctEnergyMax = minDefined(out.fatPctEnergyMax, s.fatPctEnergyMax);
    out.fiberGPer1000KcalMin = maxDefined(
      out.fiberGPer1000KcalMin,
      s.fiberGPer1000Kcal?.min,
    );
    out.potassiumMgMax = minDefined(out.potassiumMgMax, s.potassiumMgMax);
    out.purineRestricted ||= s.purineRestricted === true;
    out.carbRestrictionUnsafe ||= s.carbRestrictionUnsafe === true;
    if (s.clinicianReferral) out.referrals.push(s.clinicianReferral);
    if (s.unmodeled) out.unmodeled.push(...s.unmodeled);
  }

  // RULE 1 — a cap always beats a floor. Pregnancy asks for 1.4 g/kg, CKD caps
  // at 0.8: the cap wins and the floor is dropped, never averaged or ordered.
  if (
    out.proteinGPerKgMax != null &&
    out.proteinGPerKgMin != null &&
    out.proteinGPerKgMin > out.proteinGPerKgMax
  ) {
    out.proteinGPerKgMin = undefined;
    out.referrals.push(
      "Two of your conditions pull protein in opposite directions, so we've " +
        "used the lower, safer number. This is exactly the case to take to your " +
        "doctor or dietitian.",
    );
  }

  // RULE 2 — carb restriction veto. A T1 (or insulin-treated) user who also has
  // PCOS must not silently receive PCOS's carb cap.
  if (out.carbRestrictionUnsafe) out.carbsPctEnergyMax = undefined;

  out.referrals = [...new Set(out.referrals)];
  out.unmodeled = [...new Set(out.unmodeled)];
  return out;
}

/** Convenience: resolve straight from a bio. */
export function resolveConstraintsForBio(bio: UserBio): ResolvedConstraints {
  return resolveConstraints(bio.medicalConditions, bio.medicationCategories);
}

/* ──────────────────────────────── application ──────────────────────────────*/

/**
 * Macro re-solve bounds. Clamping one macro without redistributing leaves you
 * with a plan whose macros don't add up to its own calorie target — so every
 * clamp below moves energy somewhere else rather than deleting it.
 */
const DEFAULT_FAT_PCT = 0.275; // unchanged from the pre-constraints behavior
const FAT_FLOOR_PCT = 0.2; // AMDR lower bound
const FAT_CEILING_PCT = 0.4; // AMDR is 20–35%; we allow 40% when carbs are capped
const CARB_FLOOR_PCT = 0.1; // keeps a plan buildable and non-degenerate
const PROTEIN_CEILING_G_PER_KG = 2.0; // where displaced carb energy may go

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Apply the resolved constraints to computed targets, re-solving the macro split
 * so protein + carbs + fat still sum to `calories`.
 *
 * `proteinBasisKg` is the mass protein scales on — actual bodyweight normally,
 * adjusted body weight above BMI 30 (see bodyWeight.ts). Passed in rather than
 * derived so this stays a pure function of its inputs.
 */
export function applyConstraints(
  base: NutritionTargets,
  c: ResolvedConstraints,
  proteinBasisKg: number,
): NutritionTargets {
  const calories = base.calories;
  const basis = proteinBasisKg > 0 ? proteinBasisKg : 0;

  /* 1 ── Protein: into the g/kg band, cap last so it always wins. */
  let proteinG = base.proteinG;
  if (c.proteinGPerKgMin != null) {
    proteinG = Math.max(proteinG, c.proteinGPerKgMin * basis);
  }
  if (c.proteinGPerKgMax != null) {
    proteinG = Math.min(proteinG, c.proteinGPerKgMax * basis);
  }
  // Protein can never eat the whole budget: leave room for the fat floor and a
  // non-zero carbohydrate allowance, or the "macros sum to calories" invariant
  // has to be satisfied with a negative number.
  const proteinCeilingKcal = calories * (1 - FAT_FLOOR_PCT - CARB_FLOOR_PCT);
  proteinG = Math.max(0, Math.min(proteinG, proteinCeilingKcal / 4));

  /* 2 ── Fat & carbs: re-solved against the caps. */
  const fatMaxKcal = calories * (c.fatPctEnergyMax ?? FAT_CEILING_PCT);
  // A hard fat CAP (pancreatitis at 20%) can meet or undercut the AMDR floor.
  // The cap wins — a floor that overrides a clinical ceiling is the rule-1 bug
  // in a different costume.
  const fatMinKcal = Math.min(calories * FAT_FLOOR_PCT, fatMaxKcal);
  const carbMaxKcal =
    c.carbsPctEnergyMax != null ? calories * c.carbsPctEnergyMax : Infinity;

  let proteinKcal = proteinG * 4;
  let fatKcal = clamp(calories * DEFAULT_FAT_PCT, fatMinKcal, fatMaxKcal);
  let carbKcal = calories - proteinKcal - fatKcal;

  if (carbKcal > carbMaxKcal) {
    // Displace the excess carbohydrate into fat first, up to the fat ceiling…
    const headroomKcal = Math.max(0, fatMaxKcal - fatKcal);
    fatKcal += Math.min(headroomKcal, carbKcal - carbMaxKcal);
    carbKcal = calories - proteinKcal - fatKcal;

    // …then into protein, if its own cap leaves room. (It won't for CKD — which
    // is the correct outcome: that user's cap is the one that must not move.)
    if (carbKcal > carbMaxKcal) {
      const proteinRoomG = Math.max(
        0,
        Math.min(
          PROTEIN_CEILING_G_PER_KG * basis,
          c.proteinGPerKgMax != null ? c.proteinGPerKgMax * basis : Infinity,
        ) - proteinG,
      );
      const moveKcal = Math.min(carbKcal - carbMaxKcal, proteinRoomG * 4);
      if (moveKcal > 0) {
        proteinG += moveKcal / 4;
        proteinKcal = proteinG * 4;
        carbKcal = calories - proteinKcal - fatKcal;
      }
    }
    // Anything still above the cap stays as carbohydrate. A plan slightly over a
    // soft ceiling beats a plan whose macros don't add up to its own calories.
  } else if (carbKcal < calories * CARB_FLOOR_PCT) {
    // The opposite squeeze: a hard protein floor on a clamped calorie target.
    // Give carbohydrate its floor back out of fat, down to the fat floor.
    const need = calories * CARB_FLOOR_PCT - carbKcal;
    fatKcal = Math.max(fatMinKcal, fatKcal - need);
    carbKcal = calories - proteinKcal - fatKcal;
  }

  const proteinOut = Math.max(0, Math.round(proteinG));
  const fatOut = Math.max(0, Math.round(fatKcal / 9));
  const carbsOut = Math.max(0, Math.round(carbKcal / 4));

  /* 3 ── Fiber floor, expressed per 1000 kcal so it scales with the target. */
  const fiberG =
    c.fiberGPer1000KcalMin != null
      ? Math.max(base.fiberG, Math.round((c.fiberGPer1000KcalMin * calories) / 1000))
      : base.fiberG;

  /* 4 ── Sugar ceiling. The app tracks ONE sugar number, so an added-sugar cap
   *      is applied to it: stricter than the guideline intends, in the safe
   *      direction, and it never raises the baseline. */
  let sugarG = base.sugarG;
  if (c.addedSugarPctEnergyMax != null) {
    sugarG = Math.min(sugarG, Math.round((calories * c.addedSugarPctEnergyMax) / 4));
  }
  if (c.sugarGMax != null) sugarG = Math.min(sugarG, c.sugarGMax);

  /* 5 ── Sodium ceiling. */
  const sodiumMg =
    c.sodiumMgMax != null ? Math.min(base.sodiumMg, c.sodiumMgMax) : base.sodiumMg;

  /* 6 ── Guidance: what we couldn't put in a number. */
  const guidance: NutritionGuidance | undefined =
    c.referrals.length || c.unmodeled.length || c.purineRestricted || c.potassiumMgMax
      ? {
          referrals: c.referrals,
          unmodeled: c.unmodeled,
          ...(c.purineRestricted ? { purineRestricted: true } : {}),
          ...(c.potassiumMgMax != null ? { potassiumMgMax: c.potassiumMgMax } : {}),
        }
      : undefined;

  return {
    calories,
    proteinG: proteinOut,
    fatG: fatOut,
    carbsG: carbsOut,
    sugarG: Math.max(0, sugarG),
    fiberG,
    sodiumMg,
    waterMl: base.waterMl,
    ...(guidance ? { guidance } : {}),
  };
}
