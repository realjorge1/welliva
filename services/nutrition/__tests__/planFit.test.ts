/**
 * PLAN FIT — do 28 days of generated plans actually feed the person they're for?
 *
 * The 2026-11-16 audit: dishes came at fixed authored sizes and the planner
 * matched calories only, so an 80 kg man on 2,701 kcal was planned 62% of it
 * every day, a muscle-builder 71%, a 120 kg woman 83%, while a 60 kg woman's
 * days ran 142% of her fat target. These replay 28 days per person through the
 * real generator (bundled diets only, as mealVariety.test does; the downloaded
 * clinical library is not in play) and hold the plans to the targets.
 *
 * Tolerances (docs/prompts/06 Phase 5): calories within ±7% on ≥ 90% of days;
 * protein at ≥ 90% on ≥ 80% of days; fat ≤ 130% on average. A diet that cannot
 * get there must say so honestly instead (see the vegan case).
 */
import { describe, expect, it } from "vitest";

import type { DaySchedule } from "../../../models/diet";
import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { calculateDayNutrition, generateDietPlan } from "../../DietPlanGenerator";
import { calculateNutritionTargets } from "../../NutritionService";
import { dishKey } from "../mealRules";
import { planShortfall } from "../portionSolver";

const person = (o: Partial<UserBio>): UserBio =>
  ({
    ...DEFAULT_USER_BIO,
    allergies: [],
    medicalConditions: [],
    foodDislikes: [],
    ...o,
  }) as UserBio;

/** `n` consecutive dates from `from`, local calendar. */
function days(n: number, from = "2026-11-02"): string[] {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(y!, m! - 1, d! + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
}

export const PLAN_PERSONAS: { id: string; bio: UserBio }[] = [
  { id: "F 60 kg light lose (3 meals)", bio: person({ sex: "female", weightKg: 60, heightCm: 165, age: 30, activityLevel: "light", primaryGoal: "lose_weight", mealsPerDay: 3 }) },
  { id: "F 120 kg sedentary lose (3)", bio: person({ sex: "female", weightKg: 120, heightCm: 165, age: 40, activityLevel: "sedentary", primaryGoal: "lose_weight", mealsPerDay: 3 }) },
  { id: "M 80 kg moderate better health (4)", bio: person({ sex: "male", weightKg: 80, heightCm: 178, age: 35, activityLevel: "moderate", primaryGoal: "better_health", mealsPerDay: 4 }) },
  { id: "M 75 kg build muscle (4)", bio: person({ sex: "male", weightKg: 75, heightCm: 178, age: 24, activityLevel: "moderate", primaryGoal: "build_muscle", mealsPerDay: 4 }) },
  { id: "F 62 kg vegan lose (3)", bio: person({ sex: "female", weightKg: 62, heightCm: 166, age: 30, activityLevel: "light", primaryGoal: "lose_weight", dietaryRestriction: "vegan", mealsPerDay: 3 }) },
  { id: "F 58 kg African improve fitness (3)", bio: person({ sex: "female", weightKg: 58, heightCm: 163, age: 28, activityLevel: "moderate", primaryGoal: "improve_fitness", cuisinePreference: "african", mealsPerDay: 3 }) },
];

export interface FitReport {
  id: string;
  targetKcal: number;
  targetProteinG: number;
  avgKcalPct: number;
  kcalWithin7Pct: number;
  avgProteinPct: number;
  proteinAtLeast90Pct: number;
  avgFatPct: number;
  distinctMains: number;
}

export function fitOf(id: string, bio: UserBio, n = 28): { report: FitReport; plans: DaySchedule[] } {
  const targets = calculateNutritionTargets(bio);
  const plans = days(n).map((date) => generateDietPlan(bio, targets, date)!.schedule);
  const rows = plans.map((s) => {
    const t = calculateDayNutrition(s);
    return {
      kcal: t.calories / targets.calories,
      protein: t.proteinG / targets.proteinG,
      fat: t.fatG / targets.fatG,
    };
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const share = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).length / rows.length;
  const mains = new Set(plans.flatMap((s) => [s.breakfast, s.lunch, s.dinner].map((m) => dishKey(m!.name))));
  return {
    plans,
    report: {
      id,
      targetKcal: targets.calories,
      targetProteinG: targets.proteinG,
      avgKcalPct: Math.round(mean(rows.map((r) => r.kcal)) * 100),
      kcalWithin7Pct: Math.round(share((r) => Math.abs(r.kcal - 1) <= 0.07) * 100),
      avgProteinPct: Math.round(mean(rows.map((r) => r.protein)) * 100),
      proteinAtLeast90Pct: Math.round(share((r) => r.protein >= 0.9) * 100),
      avgFatPct: Math.round(mean(rows.map((r) => r.fat)) * 100),
      distinctMains: mains.size,
    },
  };
}

describe("report", () => {
  it("prints the 28-day fit table (REPORT=1)", () => {
    if (!process.env.REPORT) return;
    console.table(PLAN_PERSONAS.map((p) => fitOf(p.id, p.bio).report));
  });
});

const meetsTolerances = (r: FitReport) =>
  r.kcalWithin7Pct >= 90 && r.proteinAtLeast90Pct >= 80 && r.avgFatPct <= 130;

describe("28 days of plans feed the person they're for (Fix 4)", () => {
  it.each(PLAN_PERSONAS.filter((p) => !p.id.includes("vegan")))("$id", ({ id, bio }) => {
    const { report } = fitOf(id, bio);
    expect(report.kcalWithin7Pct, "days with calories within ±7%").toBeGreaterThanOrEqual(90);
    expect(report.proteinAtLeast90Pct, "days with protein ≥ 90%").toBeGreaterThanOrEqual(80);
    expect(report.avgFatPct, "average fat % of target").toBeLessThanOrEqual(130);
  });

  it("the vegan plan either meets the tolerances or says, every day it can't, by how much", () => {
    // Measured 2026-11-20: calories fit on every day, but the vegan dishes and
    // snacks this catalog holds can't carry 99 g of protein on 1,351 kcal
    // (~69% on average). The plan must not pretend: each such day carries the
    // honest line. Closing this needs more vegan protein dishes (content), not
    // arithmetic — flagged to the owner.
    const p = PLAN_PERSONAS.find((x) => x.id.includes("vegan"))!;
    const { report, plans } = fitOf(p.id, p.bio);
    if (meetsTolerances(report)) return;
    expect(report.kcalWithin7Pct).toBeGreaterThanOrEqual(90);
    const targets = calculateNutritionTargets(p.bio);
    for (const day of plans) {
      const t = calculateDayNutrition(day);
      const line = planShortfall(day, targets);
      if (t.proteinG / targets.proteinG < 0.9) {
        expect(line, day.date).toMatch(/^Today's plan reaches \d+% of your protein\.$/);
      }
    }
  });
});

describe("the plans stay plans", () => {
  const p = PLAN_PERSONAS[2]!; // the 4-meal 2,701 kcal man: the most scaling

  it("never renames a dish: servings change the amount, not the identity", () => {
    const targets = calculateNutritionTargets(p.bio);
    const date = "2026-11-05";
    const sized = generateDietPlan(p.bio, targets, date)!.schedule;
    const rows = [sized.breakfast!, sized.lunch!, sized.dinner!, ...sized.snacks];
    for (const m of rows) {
      expect(m.name).not.toMatch(/×|serving/i);
      if (m.servings != null) {
        expect(m.servings).toBeGreaterThanOrEqual(0.5);
        expect(m.servings).toBeLessThanOrEqual(m.mealType === "snack" ? 1.5 : 2);
      }
    }
  });

  it("is deterministic: the same inputs give the same day", () => {
    const targets = calculateNutritionTargets(p.bio);
    expect(generateDietPlan(p.bio, targets, "2026-11-07")).toEqual(generateDietPlan(p.bio, targets, "2026-11-07"));
  });

  it("adds at most two extras, and only snacks", () => {
    for (const { bio } of PLAN_PERSONAS) {
      const targets = calculateNutritionTargets(bio);
      for (const date of ["2026-11-02", "2026-11-09", "2026-11-16"]) {
        const day = generateDietPlan(bio, targets, date)!.schedule;
        const planned = bio.mealsPerDay === 4 ? 2 : 1;
        expect(day.snacks.length - planned).toBeLessThanOrEqual(2);
        for (const s of day.snacks) expect(s.mealType).toBe("snack");
      }
    }
  });
});
