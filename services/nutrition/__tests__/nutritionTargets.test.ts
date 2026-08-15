/**
 * NUTRITION TARGETS — the safety-critical math.
 *
 * This file exists because coverage was inverted: health-os/ had 16 test files
 * and fitness/ 13, while the module that decides how much a pregnant or
 * dialysis-bound user should eat had none. The newest code was the best tested;
 * the riskiest code was untested.
 *
 * Three layers here, deliberately:
 *
 *  1. GOLDEN VALUES — hand-computed from Mifflin–St Jeor, written out long-hand
 *     in the comments. If someone "optimises" the equation, these say what the
 *     number was supposed to be, in arithmetic anyone can check.
 *
 *  2. INVARIANTS over a generated bio space (~4,000 bios). These catch what
 *     nobody thought to write a case for: the NaN from an activity level the DB
 *     allows and the union doesn't, a clamp that underflows, macros that stop
 *     summing to their own calorie target after a cap.
 *
 *  3. COMBINATIONS. Real users stack conditions. Pregnancy + hypertension is a
 *     surplus against a sodium cap; renal + type 2 is two caps that still have
 *     to add up; type 1 + PCOS is one condition's cap being vetoed by another's
 *     safety rule.
 */
import { describe, expect, it } from "vitest";

import { calculateNutritionTargets } from "../../NutritionService";
import { resolveConstraints } from "../ConditionConstraints";
import { adjustedBodyWeightKg, idealBodyWeightKg, proteinBasisKg } from "../bodyWeight";
import type {
  ActivityLevel,
  MedicalCondition,
  PrimaryGoal,
  Sex,
  UserBio,
} from "../../../models/user";

const bio = (overrides: Partial<UserBio> = {}): UserBio =>
  ({
    age: 30,
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate",
    exerciseLevel: "intermediate",
    primaryGoal: "better_health",
    dietaryRestriction: "none",
    allergies: [],
    medicalConditions: [],
    mealsPerDay: 3,
    ...overrides,
  }) as UserBio;

/** kcal implied by a target's macros — the number they must add back up to. */
const macroKcal = (t: { proteinG: number; carbsG: number; fatG: number }) =>
  t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;

/* ══════════════════════════ 1. GOLDEN VALUES ══════════════════════════════ */

describe("golden values (hand-computed)", () => {
  it("30yo male, 80kg, 180cm, moderate, maintain", () => {
    // BMR = 10(80) + 6.25(180) − 5(30) + 5 = 800 + 1125 − 150 + 5 = 1780
    // TDEE = 1780 × 1.55 = 2759          ← no age multiplier (see below)
    // goal `better_health` modifier = 0, inside the 1500–3200 clamp.
    const t = calculateNutritionTargets(bio());
    expect(t.calories).toBe(2759);

    // protein = 1.2 × 80 = 96 g
    // fat     = 2759 × 0.275 / 9 = 84.30 → 84 g
    // carbs   = (2759 − 384 − 758.725) / 4 = 404.07 → 404 g
    expect(t.proteinG).toBe(96);
    expect(t.fatG).toBe(84);
    expect(t.carbsG).toBe(404);
  });

  it("45yo female, 65kg, 165cm, light, lose weight", () => {
    // BMR = 10(65) + 6.25(165) − 5(45) − 161 = 650 + 1031.25 − 225 − 161 = 1295.25
    // TDEE = 1295.25 × 1.375 = 1780.97;  −500 (lose_weight) = 1280.97 → 1281
    const t = calculateNutritionTargets(
      bio({
        age: 45,
        sex: "female",
        weightKg: 65,
        heightCm: 165,
        activityLevel: "light",
        primaryGoal: "lose_weight",
      }),
    );
    expect(t.calories).toBe(1281);
  });

  it("counts age ONCE — Mifflin already contains −5 × age", () => {
    // The removed bug: TDEE was multiplied by AGE_CALORIE_ADJUSTMENTS on top of
    // the equation's own age term, so a 65-year-old was penalised twice.
    // Correct gap for 30 → 65: 35 years × 5 kcal = 175 BMR, × 1.55 = 271.25.
    const younger = calculateNutritionTargets(bio({ age: 30 }));
    const older = calculateNutritionTargets(bio({ age: 65 }));
    expect(younger.calories - older.calories).toBe(271);

    // The old double-count would have made this gap ~570 kcal.
    expect(younger.calories - older.calories).toBeLessThan(350);
  });

  it("still gives an older, smaller user a workable target", () => {
    const t = calculateNutritionTargets(
      bio({ age: 68, sex: "female", weightKg: 62, heightCm: 160 }),
    );
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });
});

/* ══════════════════════════ 2. INVARIANTS ════════════════════════════════ */

const SEXES: Sex[] = ["male", "female"];
const ACTIVITY: ActivityLevel[] = ["sedentary", "light", "moderate", "very_active"];
const GOALS: PrimaryGoal[] = [
  "lose_weight",
  "build_muscle",
  "improve_fitness",
  "increase_energy",
  "better_health",
  "athletic_performance",
];
const CONDITION_SETS: MedicalCondition[][] = [
  [],
  ["hypertension"],
  ["renal_issues"],
  ["diabetes_type2"],
  ["diabetes_type1"],
  ["prediabetes"],
  ["pcos"],
  ["gout"],
  ["pancreatitis"],
  ["gallbladder"],
  ["pregnancy"],
  ["postpartum"],
  ["renal_issues", "diabetes_type2"],
  ["pregnancy", "hypertension"],
  ["diabetes_type1", "pcos"],
  ["gout", "renal_issues"],
  ["celiac", "ibs", "migraine"],
];

/** A wide, deterministic sweep. ~4k bios — exhaustive beats random here. */
function* bioSpace(): Generator<UserBio> {
  for (const sex of SEXES)
    for (const age of [18, 35, 55, 80])
      for (const weightKg of [42, 65, 95, 140])
        for (const heightCm of [150, 172, 195])
          for (const activityLevel of ACTIVITY)
            for (const primaryGoal of GOALS)
              for (const medicalConditions of CONDITION_SETS) {
                // Only a `pregnancy`/`postpartum` bio carries a trimester, and
                // only a female bio is generated with them — mirroring the app.
                const pregnant = medicalConditions.includes("pregnancy");
                if ((pregnant || medicalConditions.includes("postpartum")) && sex !== "female") {
                  continue;
                }
                yield bio({
                  sex,
                  age,
                  weightKg,
                  heightCm,
                  activityLevel,
                  primaryGoal,
                  medicalConditions,
                  ...(pregnant ? { pregnancyTrimester: 2 as const } : {}),
                });
              }
}

const ALL_BIOS = [...bioSpace()];

/**
 * One pass, results reused. Each invariant below collects VIOLATIONS into a
 * plain array and makes a single assertion — `expect()` inside a 4,000-iteration
 * loop is ~40× slower than the maths it's checking, and a failure that prints
 * the offending bios beats one that prints the first `false`.
 */
const RESULTS = ALL_BIOS.map((b) => ({ b, t: calculateNutritionTargets(b) }));
const describeBio = (b: UserBio) =>
  `${b.sex} ${b.age}y ${b.weightKg}kg ${b.heightCm}cm ${b.activityLevel} ${b.primaryGoal} [${b.medicalConditions.join(",") || "none"}]`;

describe("invariants across the bio space", () => {
  it("covers a wide space (guards against the generator silently shrinking)", () => {
    expect(ALL_BIOS.length).toBeGreaterThan(3000);
  });

  it("never produces NaN or a non-finite number", () => {
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      for (const [key, value] of Object.entries(t)) {
        if (typeof value === "number" && !Number.isFinite(value)) {
          bad.push(`${key}=${value} — ${describeBio(b)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("every tracked target is greater than zero", () => {
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      for (const key of [
        "calories",
        "proteinG",
        "carbsG",
        "fatG",
        "fiberG",
        "sugarG",
        "sodiumMg",
        "waterMl",
      ] as const) {
        if (!(t[key] > 0)) bad.push(`${key}=${t[key]} — ${describeBio(b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("macros sum back to the calorie target (±2%)", () => {
    // This is the invariant a naive cap breaks: clamp carbs for a diabetic
    // without redistributing and the plan no longer adds up to its own number.
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      const drift = Math.abs(macroKcal(t) - t.calories) / t.calories;
      if (drift >= 0.02) {
        bad.push(`${(drift * 100).toFixed(1)}% off at ${t.calories} kcal — ${describeBio(b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("SAFETY: renal impairment never exceeds 0.8 g protein per kg", () => {
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      if (!b.medicalConditions.includes("renal_issues")) continue;
      // Measured against the SAME basis the target was built from — checking
      // against raw weight would pass a bug that used the wrong denominator.
      // +1 g of rounding headroom, and nothing more.
      if (t.proteinG > proteinBasisKg(b) * 0.8 + 1) {
        bad.push(`${t.proteinG}g on ${proteinBasisKg(b).toFixed(1)}kg basis — ${describeBio(b)}`);
      }
    }
    expect(bad).toEqual([]);
    expect(RESULTS.some(({ b }) => b.medicalConditions.includes("renal_issues"))).toBe(true);
  });

  it("SAFETY: pregnancy never guides toward under-eating", () => {
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      if (!b.medicalConditions.includes("pregnancy")) continue;
      if (t.calories < 1800) bad.push(`${t.calories} kcal — ${describeBio(b)}`);

      // …and never below the same person's non-pregnant target.
      const without = calculateNutritionTargets(
        bio({ ...b, medicalConditions: b.medicalConditions.filter((c) => c !== "pregnancy") }),
      );
      if (t.calories < without.calories) {
        bad.push(`${t.calories} < ${without.calories} non-pregnant — ${describeBio(b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("SAFETY: hypertension or renal impairment caps sodium at 1500 mg", () => {
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      const needsCap =
        b.medicalConditions.includes("hypertension") ||
        b.medicalConditions.includes("renal_issues");
      if (needsCap && t.sodiumMg > 1500) bad.push(`${t.sodiumMg}mg — ${describeBio(b)}`);
    }
    expect(bad).toEqual([]);
  });

  it("SAFETY: type 1 diabetes leaves carbohydrate untouched", () => {
    // Insulin is dosed to carbs. A well-meant carb cut here is a hypo risk, so
    // this guards against a future condition entry quietly acquiring one.
    const bad: string[] = [];
    for (const { b, t } of RESULTS) {
      if (!b.medicalConditions.includes("diabetes_type1")) continue;
      const neutral = calculateNutritionTargets(bio({ ...b, medicalConditions: [] }));
      if (t.carbsG !== neutral.carbsG) {
        bad.push(`${t.carbsG}g vs ${neutral.carbsG}g unconditioned — ${describeBio(b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("is monotonic in activity: more movement never means fewer calories", () => {
    const bad: string[] = [];
    // One representative per (everything-but-activity) cell — the sweep already
    // contains all four levels, so filtering to one keeps the work at ~4k calls.
    for (const { b } of RESULTS) {
      if (b.activityLevel !== "sedentary") continue;
      let previous = 0;
      for (const activityLevel of ACTIVITY) {
        const { calories } = calculateNutritionTargets(bio({ ...b, activityLevel }));
        if (calories < previous) {
          bad.push(`${activityLevel} dropped to ${calories} from ${previous} — ${describeBio(b)}`);
        }
        previous = calories;
      }
    }
    expect(bad).toEqual([]);
  });
});

/* ═══════════════════ 3. CONDITION COMBINATIONS ════════════════════════════ */

describe("stacked conditions", () => {
  it("pregnancy + hypertension: surplus survives, sodium is still capped", () => {
    const t = calculateNutritionTargets(
      bio({
        sex: "female",
        weightKg: 68,
        heightCm: 168,
        medicalConditions: ["pregnancy", "hypertension"],
        pregnancyTrimester: 3,
      }),
    );
    expect(t.calories).toBeGreaterThanOrEqual(1800);
    expect(t.sodiumMg).toBeLessThanOrEqual(1500);
    // The trimester-3 surplus is real, not clamped away by the sodium branch.
    const flat = calculateNutritionTargets(
      bio({ sex: "female", weightKg: 68, heightCm: 168, medicalConditions: ["hypertension"] }),
    );
    expect(t.calories).toBeGreaterThan(flat.calories);
  });

  it("renal + type 2: both caps hold AND the macros still sum", () => {
    const t = calculateNutritionTargets(
      bio({ medicalConditions: ["renal_issues", "diabetes_type2"] }),
    );
    expect(t.proteinG).toBeLessThanOrEqual(Math.round(80 * 0.8) + 1);
    expect(t.sodiumMg).toBeLessThanOrEqual(1500);
    expect(Math.abs(macroKcal(t) - t.calories) / t.calories).toBeLessThan(0.02);
    // Carbohydrate moved DOWN even though the protein cap blocks the usual
    // place to put the displaced energy.
    const neutral = calculateNutritionTargets(bio());
    expect(t.carbsG).toBeLessThan(neutral.carbsG);
  });

  it("the renal cap beats the muscle-gain multiplier — the dangerous case", () => {
    // build_muscle asks for 1.6 g/kg: twice the CKD guidance, on the lever that
    // most directly affects renal progression.
    const unsafe = calculateNutritionTargets(bio({ primaryGoal: "build_muscle" }));
    const capped = calculateNutritionTargets(
      bio({ primaryGoal: "build_muscle", medicalConditions: ["renal_issues"] }),
    );
    expect(unsafe.proteinG).toBe(Math.round(80 * 1.6));
    expect(capped.proteinG).toBeLessThanOrEqual(Math.round(80 * 0.8));
    expect(capped.proteinG).toBeLessThan(unsafe.proteinG / 1.9);
  });

  it("leaves an unconditioned user's protein exactly where it was", () => {
    expect(calculateNutritionTargets(bio()).proteinG).toBe(Math.round(80 * 1.2));
  });

  it("gout + renal: purine flag survives alongside the protein cap", () => {
    const t = calculateNutritionTargets(
      bio({ medicalConditions: ["gout", "renal_issues"] }),
    );
    expect(t.proteinG).toBeLessThanOrEqual(Math.round(80 * 0.8) + 1);
    expect(t.guidance?.purineRestricted).toBe(true);
    expect(t.guidance?.potassiumMgMax).toBe(2000);
  });

  it("type 1 + PCOS: the T1 veto beats PCOS's carb cap", () => {
    const t1pcos = calculateNutritionTargets(
      bio({ medicalConditions: ["diabetes_type1", "pcos"] }),
    );
    const pcosOnly = calculateNutritionTargets(bio({ medicalConditions: ["pcos"] }));
    const neutral = calculateNutritionTargets(bio());

    expect(pcosOnly.carbsG).toBeLessThan(neutral.carbsG); // PCOS alone does cap
    expect(t1pcos.carbsG).toBe(neutral.carbsG); // …and T1 vetoes it
  });

  it("insulin-dosed medication vetoes a carb cap the same way T1 does", () => {
    const t = calculateNutritionTargets(
      bio({
        medicalConditions: ["diabetes_type2"],
        medicationCategories: ["diabetes"],
      }),
    );
    expect(t.carbsG).toBe(calculateNutritionTargets(bio()).carbsG);
    expect(t.guidance?.referrals.join(" ")).toMatch(/hypo/i);
  });

  it("a renal cap overrides the pregnancy protein floor, not the other way round", () => {
    const t = calculateNutritionTargets(
      bio({
        sex: "female",
        weightKg: 70,
        medicalConditions: ["pregnancy", "renal_issues"],
        pregnancyTrimester: 2,
      }),
    );
    expect(t.proteinG).toBeLessThanOrEqual(Math.round(70 * 0.8) + 1);
    // And the conflict is disclosed rather than silently resolved.
    expect(t.guidance?.referrals.some((r) => /opposite directions/i.test(r))).toBe(true);
  });
});

/* ═══════════════════ 3b. PROTEIN BASIS (adjusted body weight) ═════════════ */

describe("protein basis weight", () => {
  it("Devine IBW, hand-computed", () => {
    // 180 cm − 152.4 = 27.6 cm = 10.87 in over 5 ft → 50 + 2.3(10.87) = 75.0 kg
    expect(idealBodyWeightKg("male", 180)).toBeCloseTo(74.99, 1);
    // 165 cm − 152.4 = 12.6 cm = 4.96 in over 5 ft → 45.5 + 2.3(4.96) = 56.9 kg
    expect(idealBodyWeightKg("female", 165)).toBeCloseTo(56.91, 1);
  });

  it("adjusted weight is IBW + 40% of the excess, and never exceeds actual", () => {
    const ibw = idealBodyWeightKg("male", 175);
    const abw = adjustedBodyWeightKg("male", 175, 130);
    expect(abw).toBeCloseTo(ibw + 0.4 * (130 - ibw), 5);
    expect(abw).toBeLessThan(130);
    expect(abw).toBeGreaterThan(ibw);
  });

  it("leaves anyone below IBW on their actual weight", () => {
    expect(adjustedBodyWeightKg("female", 170, 52)).toBe(52);
  });

  it("only kicks in at BMI 30 — most users are untouched", () => {
    // 80 kg @ 180 cm = BMI 24.7 → actual weight, unchanged behavior.
    expect(proteinBasisKg(bio({ weightKg: 80, heightCm: 180 }))).toBe(80);
    // 100 kg @ 180 cm = BMI 30.9 → adjusted.
    expect(proteinBasisKg(bio({ weightKg: 100, heightCm: 180 }))).toBeLessThan(100);
  });

  it("lowers protein for a high-BMI user, and only for them", () => {
    const highBmi = calculateNutritionTargets(bio({ weightKg: 130, heightCm: 170 }));
    // Total-weight scaling would have asked for 156 g.
    expect(highBmi.proteinG).toBeLessThan(Math.round(130 * 1.2));
    expect(highBmi.proteinG).toBeGreaterThan(80); // still a real, adequate target

    const normalBmi = calculateNutritionTargets(bio({ weightKg: 75, heightCm: 178 }));
    expect(normalBmi.proteinG).toBe(Math.round(75 * 1.2));
  });

  it("keeps the renal cap measured on the same basis it scales on", () => {
    const b = bio({ weightKg: 130, heightCm: 170, medicalConditions: ["renal_issues"] });
    const t = calculateNutritionTargets(b);
    expect(t.proteinG).toBeLessThanOrEqual(Math.round(proteinBasisKg(b) * 0.8) + 1);
  });
});

/* ═══════════════════ 4. THE CONSTRAINT TABLE ITSELF ═══════════════════════ */

describe("constraint resolution", () => {
  it("takes the lowest ceiling when conditions disagree", () => {
    // hypertension 1500 vs osteoporosis 2000 → 1500.
    const c = resolveConstraints(["hypertension", "osteoporosis"], []);
    expect(c.sodiumMgMax).toBe(1500);
  });

  it("takes the highest floor when conditions disagree", () => {
    const c = resolveConstraints(["constipation", "diabetes_type2"], []);
    expect(c.fiberGPer1000KcalMin).toBe(14);
  });

  it("drops an impossible floor rather than exceeding a cap", () => {
    const c = resolveConstraints(["pregnancy", "renal_issues"], []);
    expect(c.proteinGPerKgMax).toBe(0.8);
    expect(c.proteinGPerKgMin).toBeUndefined();
    expect(c.referrals.length).toBeGreaterThan(0);
  });

  it("medication categories tighten sodium on their own", () => {
    expect(resolveConstraints([], ["diuretics"]).sodiumMgMax).toBe(1500);
    expect(resolveConstraints([], ["blood_pressure"]).sodiumMgMax).toBe(1500);
    expect(resolveConstraints([], ["corticosteroids"]).sodiumMgMax).toBe(1500);
    expect(resolveConstraints([], ["antibiotics"]).sodiumMgMax).toBeUndefined();
  });

  it("gives every condition an answer — including 'no target change'", () => {
    // The point of the table: a condition the app claims to support can no
    // longer fall through to a healthy person's numbers unexamined.
    const cosmetic: MedicalCondition[] = ["gerd", "ibs", "celiac", "menopause", "arthritis"];
    for (const condition of cosmetic) {
      const c = resolveConstraints([condition], []);
      expect(c.unmodeled.length, condition).toBeGreaterThan(0);
    }
  });
});

/* ═══════════════════ 5. BOUNDARY / HOSTILE INPUT ═════════════════════════ */

describe("boundaries", () => {
  it("survives an activity level the database allows and the union doesn't", () => {
    // `activity_level` round-trips through the profile row and the API, where
    // it is a free string. Before the `??` guard this produced NaN everywhere.
    const t = calculateNutritionTargets(
      bio({ activityLevel: "extremely_active" as ActivityLevel }),
    );
    expect(Number.isFinite(t.calories)).toBe(true);
    expect(t.calories).toBe(calculateNutritionTargets(bio({ activityLevel: "moderate" })).calories);
  });

  it("holds the floor for a very small, very sedentary frame", () => {
    const t = calculateNutritionTargets(
      bio({
        sex: "female",
        age: 75,
        weightKg: 40,
        heightCm: 145,
        activityLevel: "sedentary",
        primaryGoal: "lose_weight",
      }),
    );
    expect(t.calories).toBe(1200);
    expect(t.carbsG).toBeGreaterThan(0);
    expect(t.fatG).toBeGreaterThan(0);
  });

  it("holds the ceiling for a very large, very active frame", () => {
    const t = calculateNutritionTargets(
      bio({
        weightKg: 150,
        heightCm: 200,
        age: 25,
        activityLevel: "very_active",
        primaryGoal: "build_muscle",
      }),
    );
    expect(t.calories).toBe(3200);
    expect(Math.abs(macroKcal(t) - t.calories) / t.calories).toBeLessThan(0.02);
  });

  it("leaves an unconstrained user with no guidance block at all", () => {
    expect(calculateNutritionTargets(bio()).guidance).toBeUndefined();
  });
});
