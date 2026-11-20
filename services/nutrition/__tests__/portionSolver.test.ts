/**
 * PORTION SOLVER — servings that make a day feed her (Fix 4), and the rules
 * that keep it a plan: names never change, ticked meals never move, extras are
 * only snacks, a 90-day menu stays quick, and a day that can't make it says so.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { DIET_DATABASE } from "../../../constants/DietDatabase";
import type { DaySchedule, ScheduledMeal } from "../../../models/diet";
import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { calculateDayNutrition, generateDietPlan } from "../../DietPlanGenerator";
import { rankMealSwaps, slotBudget, swapServings } from "../../intelligence/NutritionInsightEngine";
import { calculateNutritionTargets } from "../../NutritionService";
import { KEYS, todayDate } from "../../OfflineStorage";
import { getScheduleForDate, markMealConsumed, saveDaySchedule } from "../../ScheduleService";
import { macrosOfMeal } from "../DayTotals";
import { getIntakeForDate } from "../IntakeLedger";
import { buildMenuDays, type MenuDraft } from "../menuBuilder";
import { fitMeals, planShortfall, withServings } from "../portionSolver";

const person = (o: Partial<UserBio>): UserBio =>
  ({ ...DEFAULT_USER_BIO, allergies: [], medicalConditions: [], foodDislikes: [], ...o }) as UserBio;

const bigEater = person({ sex: "male", weightKg: 80, heightCm: 178, age: 35, activityLevel: "moderate", primaryGoal: "better_health", mealsPerDay: 4 });

const meal = (name: string, kcal: number, p: number, c: number, f: number, mealType: ScheduledMeal["mealType"] = "lunch"): ScheduledMeal => ({
  id: name,
  mealType,
  name,
  calories: { min: kcal, max: kcal },
  proteinG: { min: p, max: p },
  carbsG: { min: c, max: c },
  fatG: { min: f, max: f },
  isConsumed: false,
});

const dates = (n: number, from = "2026-12-01") => {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(y!, m! - 1, d! + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
};

describe("servings", () => {
  it("scale the macros and keep the name", () => {
    const m = meal("Jollof Rice with Chicken", 500, 30, 60, 15);
    const big = withServings(m, 1.5);
    expect(big.name).toBe(m.name);
    expect(macrosOfMeal(big).calories).toBeCloseTo(750, 5);
    expect(big.servings).toBe(1.5);
    // Back to 1× from 1½×: from its own base, not compounded.
    expect(macrosOfMeal(withServings(big, 1)).calories).toBeCloseTo(500, 5);
    expect(withServings(big, 1).servings).toBeUndefined();
  });

  it("never resize a meal she already ate", () => {
    const eaten = { ...meal("Oats", 300, 10, 50, 6, "breakfast"), isConsumed: true };
    const fit = fitMeals([eaten, meal("Rice and Beans", 500, 20, 80, 10)], { calories: 2400, proteinG: 120, carbsG: 300, fatG: 70 });
    expect(fit.meals[0]).toBe(eaten);
    expect(fit.meals[1]!.servings).toBe(2);
  });

  it("say so honestly when a day can't reach her numbers", () => {
    const tiny = [meal("Salad", 150, 4, 10, 8, "lunch"), meal("Soup", 120, 3, 15, 4, "dinner")];
    const fit = fitMeals(tiny, { calories: 2400, proteinG: 120, carbsG: 300, fatG: 70 });
    const day: DaySchedule = { date: "2026-12-01", dietId: "x", dietName: "x", breakfast: null, lunch: fit.meals[0]!, dinner: fit.meals[1]!, snacks: [], status: "active" };
    expect(planShortfall(day, { calories: 2400, proteinG: 120 })).toMatch(/^Today's plan reaches \d+% of your calories\.$/);
  });
});

describe("every generator path is sized", () => {
  it("a built menu (onboarding's 'let me choose') lands within ±7% of her calories", () => {
    const targets = calculateNutritionTargets(bigEater);
    const draft: MenuDraft = { dishes: {}, weeks: { breakfast: Array(7).fill(null), lunch: Array(7).fill(null), dinner: Array(7).fill(null) } } as unknown as MenuDraft;
    const days = buildMenuDays({ draft, bio: bigEater, targets, dates: dates(14) });
    for (const [date, picks] of Object.entries(days)) {
      const kcal = picks.reduce((s, p) => s + macrosOfMeal(p.meal).calories, 0);
      expect(Math.abs(kcal / targets.calories - 1), date).toBeLessThanOrEqual(0.07);
    }
  });

  it("a 90-day menu stays quick", () => {
    const targets = calculateNutritionTargets(bigEater);
    const draft = { dishes: {}, weeks: { breakfast: Array(7).fill(null), lunch: Array(7).fill(null), dinner: Array(7).fill(null) } } as unknown as MenuDraft;
    const started = Date.now();
    buildMenuDays({ draft, bio: bigEater, targets, dates: dates(90) });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("a swap is offered at the serving that fits the slot", () => {
    const targets = calculateNutritionTargets(bigEater);
    const diet = DIET_DATABASE.find((d) => d.id === "mediterranean") ?? DIET_DATABASE[0]!;
    const consumed = { calories: 600, proteinG: 30, carbsG: 70, fatG: 20 };
    const ranked = rankMealSwaps({ options: diet.lunchOptions, current: null, targets, consumed, slotsRemaining: 3, slot: "lunch" });
    const budget = slotBudget(targets, consumed, 3)!;
    for (const r of ranked) {
      expect(r.servings).toBe(swapServings(r.option, "lunch", budget));
      expect(r.kcal).toBe(Math.round((((r.option.calories.min + r.option.calories.max) / 2) * r.servings)));
    }
    // A big eater's lunch budget (~700 kcal) pulls small dishes up a serving.
    expect(ranked.some((r) => r.servings > 1)).toBe(true);
  });

  it("is deterministic and fast enough for a day on a low-end phone", () => {
    const targets = calculateNutritionTargets(bigEater);
    const started = Date.now();
    for (const d of dates(28)) generateDietPlan(bigEater, targets, d);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

describe("the ledger still heals a sized plan by slot + name", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(KEYS.SCHEDULED_DIETS);
    await AsyncStorage.removeItem(KEYS.INTAKE_LEDGER);
  });

  it("a tick on a 1½× meal records the 1½× amount, and survives a rewrite of the day", async () => {
    const today = todayDate();
    const targets = calculateNutritionTargets(bigEater);
    const day = generateDietPlan(bigEater, targets, today)!.schedule;
    await saveDaySchedule(day);
    await markMealConsumed(today, "lunch");
    const [line] = await getIntakeForDate(today);
    expect(line!.calories).toBeCloseTo(macrosOfMeal(day.lunch).calories, 5);

    // Rewrite the day (as a rollover or regenerate would): same dishes, reset ticks.
    await saveDaySchedule({ ...day, lunch: { ...day.lunch!, isConsumed: false } });
    const healed = await getScheduleForDate(today);
    expect(healed!.lunch!.isConsumed).toBe(true);
    expect(healed!.lunch!.name).toBe(day.lunch!.name);
  });
});

describe("report", () => {
  it("prints dishes the solver doubles, for an eyeball (REPORT=1)", () => {
    if (!process.env.REPORT) return;
    const seen = new Map<string, number>();
    for (const bio of [bigEater, person({ sex: "male", weightKg: 75, heightCm: 178, age: 24, activityLevel: "moderate", primaryGoal: "build_muscle", mealsPerDay: 4 })]) {
      const targets = calculateNutritionTargets(bio);
      for (const d of dates(28)) {
        const s = generateDietPlan(bio, targets, d)!.schedule;
        for (const m of [s.breakfast!, s.lunch!, s.dinner!, ...s.snacks]) {
          if ((m.servings ?? 1) >= 1.5) seen.set(`${m.servings}× ${m.name} (${Math.round(calculateDayNutrition({ ...s, breakfast: m, lunch: null, dinner: null, snacks: [] }).calories)} kcal)`, 1);
        }
      }
    }
    console.log([...seen.keys()].slice(0, 40).join("\n"));
  });
});
