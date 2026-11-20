/**
 * PERSONAS — the target formula measured on the people the 2026-11-16 audit used.
 *
 * Each row is a real shape of user: a small sedentary woman, a large man, two
 * athletes, a muscle-builder. The audit ran these through the real code and
 * found the ceiling turning a surplus into a deficit, one fixed −500 cut for
 * every body, and 1.2 g/kg protein for exactly the people losing weight. These
 * tests pin the fixed behaviour; docs/nutrition/engine-accuracy.md holds the
 * before/after table they produce (run with REPORT=1 to print it).
 *
 * Bio defaults come from DEFAULT_USER_BIO, so a persona differs from a fresh
 * install only by what it states.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { calculateNutritionTargets, maintenanceTdee } from "../../NutritionService";
import { proteinBasisKg } from "../bodyWeight";

const person = (o: Partial<UserBio>): UserBio =>
  ({
    ...DEFAULT_USER_BIO,
    allergies: [],
    medicalConditions: [],
    foodDislikes: [],
    ...o,
  }) as UserBio;

export const PERSONAS: { id: string; bio: UserBio }[] = [
  { id: "F 50 kg, 155 cm, 28, sedentary, lose", bio: person({ sex: "female", weightKg: 50, heightCm: 155, age: 28, activityLevel: "sedentary", primaryGoal: "lose_weight" }) },
  { id: "F 60 kg, 165 cm, 30, light, lose", bio: person({ sex: "female", weightKg: 60, heightCm: 165, age: 30, activityLevel: "light", primaryGoal: "lose_weight" }) },
  { id: "F 120 kg, 165 cm, 40, sedentary, lose", bio: person({ sex: "female", weightKg: 120, heightCm: 165, age: 40, activityLevel: "sedentary", primaryGoal: "lose_weight" }) },
  { id: "M 140 kg, 180 cm, 35, light, lose", bio: person({ sex: "male", weightKg: 140, heightCm: 180, age: 35, activityLevel: "light", primaryGoal: "lose_weight" }) },
  { id: "M 85 kg, 183 cm, 24, active, build muscle", bio: person({ sex: "male", weightKg: 85, heightCm: 183, age: 24, activityLevel: "active", primaryGoal: "build_muscle" }) },
  { id: "M 95 kg, 190 cm, 22, very active, athletic", bio: person({ sex: "male", weightKg: 95, heightCm: 190, age: 22, activityLevel: "very_active", primaryGoal: "athletic_performance" }) },
  { id: "F 68 kg, 172 cm, 25, very active, athletic", bio: person({ sex: "female", weightKg: 68, heightCm: 172, age: 25, activityLevel: "very_active", primaryGoal: "athletic_performance" }) },
  { id: "F 72 kg, 168 cm, 34, active, build muscle", bio: person({ sex: "female", weightKg: 72, heightCm: 168, age: 34, activityLevel: "active", primaryGoal: "build_muscle" }) },
];

/** Must never be given a deficit, whatever the goal says. */
const TEEN = person({ sex: "female", weightKg: 60, heightCm: 165, age: 17, activityLevel: "light", primaryGoal: "lose_weight" });
const UNDERWEIGHT = person({ sex: "female", weightKg: 47, heightCm: 165, age: 26, activityLevel: "light", primaryGoal: "lose_weight" }); // BMI 17.3
const PREGNANT = person({ sex: "female", weightKg: 66, heightCm: 165, age: 31, activityLevel: "light", primaryGoal: "lose_weight", medicalConditions: ["pregnancy"], pregnancyTrimester: 2 });
const POSTPARTUM = person({ sex: "female", weightKg: 70, heightCm: 165, age: 31, activityLevel: "light", primaryGoal: "lose_weight", medicalConditions: ["postpartum"] });

const row = (bio: UserBio) => {
  const t = calculateNutritionTargets(bio);
  const m = maintenanceTdee(bio);
  return {
    target: t.calories,
    maintenance: m,
    gap: t.calories - m,
    proteinPerKg: Number((t.proteinG / proteinBasisKg(bio)).toFixed(2)),
    fiberG: t.fiberG,
    sugarG: t.sugarG,
  };
};

describe("report", () => {
  it("prints the persona table (REPORT=1)", () => {
    if (!process.env.REPORT) return;
    const rows = [
      ...PERSONAS.map((p) => ({ id: p.id, ...row(p.bio) })),
      ...PERSONAS.filter((p) => p.bio.primaryGoal === "lose_weight").map((p) => ({
        id: `${p.id} (steady pace)`,
        ...row({ ...p.bio, pace: "steady" }),
      })),
      { id: "F 17, lose", ...row(TEEN) },
      { id: "F BMI 17.3, lose", ...row(UNDERWEIGHT) },
      { id: "Pregnant T2", ...row(PREGNANT) },
      { id: "Postpartum", ...row(POSTPARTUM) },
    ];
    console.table(rows);
  });
});

describe("the ceiling no longer turns a surplus into a deficit (Fix 3)", () => {
  const gainers = PERSONAS.filter((p) =>
    ["build_muscle", "athletic_performance"].includes(p.bio.primaryGoal),
  );

  it.each(gainers)("$id is above maintenance by at least the goal's modifier", ({ bio }) => {
    const { gap } = row(bio);
    const floor = bio.primaryGoal === "build_muscle" ? 300 : 200;
    expect(gap).toBeGreaterThanOrEqual(floor - 1); // −1: rounding
  });

  it("the three rows the audit measured", () => {
    expect(row(PERSONAS[4]!.bio).gap).toBeGreaterThanOrEqual(299); // was −41
    expect(row(PERSONAS[5]!.bio).gap).toBeGreaterThanOrEqual(199); // was −662
    expect(row(PERSONAS[6]!.bio).gap).toBeGreaterThanOrEqual(199); // was +9
  });

  it("muscle gain on a chosen pace is a share of maintenance, 150–500 kcal", () => {
    for (const p of gainers.filter((g) => g.bio.primaryGoal === "build_muscle")) {
      const m = maintenanceTdee(p.bio);
      const steady = row({ ...p.bio, pace: "steady" }).gap;
      expect(Math.abs(steady - Math.min(500, Math.max(150, m * 0.1)))).toBeLessThanOrEqual(1);
      expect(row({ ...p.bio, pace: "gentle" }).gap).toBeLessThan(steady);
      expect(row({ ...p.bio, pace: "faster" }).gap).toBeGreaterThan(steady);
    }
  });

  it("a plausibility bound still exists", () => {
    const huge = person({ sex: "male", weightKg: 250, heightCm: 210, age: 20, activityLevel: "very_active", primaryGoal: "build_muscle" });
    expect(calculateNutritionTargets(huge).calories).toBeLessThanOrEqual(5500);
  });
});

describe("weight-loss pace (Fix 5)", () => {
  const losers = PERSONAS.filter((p) => p.bio.primaryGoal === "lose_weight");

  it.each(losers)("$id: steady is 20% of maintenance, never past 1 kg a week or the floor", ({ bio }) => {
    const paced = { ...bio, pace: "steady" as const };
    const m = maintenanceTdee(paced);
    const t = calculateNutritionTargets(paced).calories;
    const floor = bio.sex === "male" ? 1500 : 1200;
    const wanted = m - Math.min(m * 0.2, 1100);
    expect(Math.abs(t - Math.max(floor, wanted))).toBeLessThanOrEqual(1); // rounding
    expect(m - t).toBeLessThanOrEqual(1100);
  });

  it("the deficit scales with the person instead of one −500 for all", () => {
    const small = maintenanceTdee(PERSONAS[1]!.bio) - row({ ...PERSONAS[1]!.bio, pace: "steady" }).target;
    const large = maintenanceTdee(PERSONAS[3]!.bio) - row({ ...PERSONAS[3]!.bio, pace: "steady" }).target;
    expect(small).toBeLessThan(500);
    expect(large).toBeGreaterThan(500);
  });

  it("gentle < steady < faster, and faster stops at 25%", () => {
    const bio = PERSONAS[3]!.bio; // big enough that no floor interferes
    const m = maintenanceTdee(bio);
    const cut = (pace: "gentle" | "steady" | "faster") => m - row({ ...bio, pace }).target;
    expect(cut("gentle")).toBeLessThan(cut("steady"));
    expect(cut("steady")).toBeLessThan(cut("faster"));
    expect(cut("faster")).toBeLessThanOrEqual(Math.round(m * 0.25) + 1);
  });

  it("D3: someone already losing weight with no chosen pace keeps exactly −500", () => {
    const bio = PERSONAS[1]!.bio; // no `pace` field: an existing user
    expect(row(bio).gap).toBe(-500);
  });

  it("near the goal weight the deficit halves", () => {
    const bio = { ...PERSONAS[3]!.bio, pace: "steady" as const };
    const full = maintenanceTdee(bio) - row(bio).target;
    const tapered = maintenanceTdee(bio) - row({ ...bio, nearGoalTaper: true }).target;
    expect(Math.abs(tapered - full / 2)).toBeLessThanOrEqual(1);
  });
});

describe("safety: no deficit for a teenager or an underweight adult", () => {
  it.each([
    ["17-year-old", TEEN],
    ["BMI under 18.5", UNDERWEIGHT],
  ] as const)("%s on lose_weight gets maintenance, with or without a pace", (_label, bio) => {
    expect(row(bio).gap).toBeGreaterThanOrEqual(0);
    expect(row({ ...bio, pace: "faster" }).gap).toBeGreaterThanOrEqual(0);
  });

  it("says why, calmly, in the guidance the target screen already renders", () => {
    for (const bio of [TEEN, UNDERWEIGHT]) {
      const lines = calculateNutritionTargets(bio).guidance?.referrals ?? [];
      expect(lines.some((l) => /calorie cut|deficit/i.test(l))).toBe(true);
      for (const l of lines) expect(l).not.toMatch(/underweight|eating disorder|too thin/i);
    }
  });

  it("ignores a learned maintenance correction for them", () => {
    for (const bio of [TEEN, UNDERWEIGHT, PREGNANT, POSTPARTUM]) {
      expect(calculateNutritionTargets({ ...bio, maintenanceAdjustKcal: -200 }).calories).toBe(
        calculateNutritionTargets(bio).calories,
      );
    }
  });
});

describe("pregnancy and postpartum keep their rules", () => {
  // Pinned from the code as it stood on 2026-11-20 (see engine-accuracy.md).
  it("pregnant, second trimester", () => {
    const t = calculateNutritionTargets(PREGNANT);
    expect(t.calories).toBe(PREGNANT_BEFORE.calories);
    expect(t.proteinG).toBe(PREGNANT_BEFORE.proteinG);
  });
  it("postpartum", () => {
    const t = calculateNutritionTargets(POSTPARTUM);
    expect(t.calories).toBe(POSTPARTUM_BEFORE.calories);
    expect(t.proteinG).toBe(POSTPARTUM_BEFORE.proteinG);
  });
});

describe("protein while losing weight (Fix 6)", () => {
  it.each(PERSONAS.filter((p) => p.bio.primaryGoal === "lose_weight"))(
    "$id gets 1.6 g per kg of the protein basis",
    ({ bio }) => {
      const t = calculateNutritionTargets(bio);
      expect(t.proteinG).toBe(Math.round(proteinBasisKg(bio) * 1.6));
    },
  );

  it("only when a cut is actually set: no cut, no weight-loss protein", () => {
    for (const bio of [TEEN, UNDERWEIGHT]) {
      expect(calculateNutritionTargets(bio).proteinG).toBe(Math.round(proteinBasisKg(bio) * 1.2));
    }
  });

  it("a kidney condition still caps it", () => {
    const bio = { ...PERSONAS[1]!.bio, medicalConditions: ["renal_issues" as const] };
    expect(calculateNutritionTargets(bio).proteinG).toBeLessThanOrEqual(Math.round(proteinBasisKg(bio) * 0.8));
  });

  it("everyone else is unchanged", () => {
    const maintain = person({ sex: "male", weightKg: 80, heightCm: 180, age: 30, primaryGoal: "better_health" });
    expect(calculateNutritionTargets(maintain).proteinG).toBe(96);
  });
});

describe("fibre and sugar follow how much she eats (Fix 10)", () => {
  it.each(PERSONAS)("$id: fibre is 14 g per 1,000 kcal, 20–45 g", ({ bio }) => {
    const t = calculateNutritionTargets(bio);
    expect(t.fiberG).toBe(Math.min(45, Math.max(20, Math.round((14 * t.calories) / 1000))));
  });

  it.each(PERSONAS)("$id: sugar is under 10% of energy and never above the sex limit", ({ bio }) => {
    const t = calculateNutritionTargets(bio);
    const limit = bio.sex === "male" ? 36 : 25;
    expect(t.sugarG).toBe(Math.min(limit, Math.round((0.1 * t.calories) / 4)));
  });

  it("sodium stays flat (the guideline is absolute)", () => {
    for (const p of PERSONAS) expect(calculateNutritionTargets(p.bio).sodiumMg).toBe(2300);
  });
});

/*
 * The pinned "before" numbers for the two life stages whose rules must not move
 * (measured on the 2026-11-20 code). Protein stays at the 1.4 g/kg pregnancy
 * floor: the weight-loss 1.6 applies only when a cut is actually applied, and
 * pregnancy never gets one.
 */
const PREGNANT_BEFORE = { calories: 2231, proteinG: 92 };
const POSTPARTUM_BEFORE = { calories: 2346, proteinG: 98 };
