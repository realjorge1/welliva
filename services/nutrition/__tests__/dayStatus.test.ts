/**
 * HONEST RECORDS — what counts as a day (Fix 8) and how much she ate (Fix 7).
 *
 * One snack used to make a "recorded" day, averaged as if she ate one snack;
 * and a ticked meal could only ever be recorded as exactly the planned amount.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import type { DaySchedule, DietHistoryEntry } from "../../../models/diet";
import { DEFAULT_USER_BIO, type UserBio } from "../../../models/user";
import { generateDietPlan } from "../../DietPlanGenerator";
import { calculateNutritionTargets } from "../../NutritionService";
import { KEYS, todayDate, writeJSON } from "../../OfflineStorage";
import {
  getDietHistory,
  getScheduleForDate,
  markDayComplete,
  markMealConsumed,
  processDayEnd,
  saveDaySchedule,
  setMealPortion,
  toggleMealConsumed,
} from "../../ScheduleService";
import { merge } from "../../sync/mergeStrategies";
import { macrosOfMeal } from "../DayTotals";
import { DAY_COMPLETE_KEY, countsAsDay, dayLoggedness, wholeDayIntake } from "../dayStatus";
import { getIntakeForDate, recordFor, type IntakeRecord } from "../IntakeLedger";
import { shiftDate } from "../logWindow";

const day = (o: Partial<DietHistoryEntry>): DietHistoryEntry => ({
  date: "2026-11-10",
  dietId: "everyday",
  dietName: "Everyday",
  mealsConsumed: 0,
  totalMeals: 3,
  status: "partial",
  consumedCalories: 0,
  consumedProteinG: 0,
  consumedCarbsG: 0,
  consumedFatG: 0,
  ...o,
});

const TARGET = 1800;

describe("what counts as a day", () => {
  it("nothing logged is unknown", () => {
    expect(dayLoggedness(day({}), { targetKcal: TARGET })).toBe("none");
  });

  it("one snack is a partial day", () => {
    const snack = day({ mealsConsumed: 1, consumedCalories: 180, consumedCarbsG: 30 });
    expect(dayLoggedness(snack, { targetKcal: TARGET })).toBe("partial");
    expect(countsAsDay(snack, TARGET)).toBe(false);
  });

  it("three meals ticked infer a whole day, whatever the calories", () => {
    const three = day({ mealsConsumed: 3, consumedCalories: 900, consumedProteinG: 50 });
    expect(dayLoggedness(three, { targetKcal: TARGET })).toBe("inferred");
  });

  it("70% of her target infers a whole day", () => {
    const logged = day({ mealsConsumed: 0, consumedCalories: 1300, consumedProteinG: 60 });
    expect(dayLoggedness(logged, { targetKcal: TARGET })).toBe("inferred"); // 72%
    expect(dayLoggedness({ ...logged, consumedCalories: 1200 }, { targetKcal: TARGET })).toBe("partial"); // 67%
  });

  it("her 'that's everything' wins over inference — either way", () => {
    const snack = day({ mealsConsumed: 1, consumedCalories: 180, consumedCarbsG: 30 });
    expect(dayLoggedness(snack, { explicit: true, targetKcal: TARGET })).toBe("complete");
    const full = day({ mealsConsumed: 3, consumedCalories: 1700, consumedProteinG: 80 });
    expect(dayLoggedness(full, { explicit: false, targetKcal: TARGET })).toBe("partial");
  });

  it("old history needs no migration: an unstamped day is inferred against her target", () => {
    const old = day({ mealsConsumed: 1, consumedCalories: 1500, consumedProteinG: 70 });
    expect(old.loggedness).toBeUndefined();
    expect(countsAsDay(old, TARGET)).toBe(true);
    expect(countsAsDay(old, 2600)).toBe(false);
  });

  it("a stamped day is read as stamped", () => {
    const stamped = day({ mealsConsumed: 1, consumedCalories: 180, consumedCarbsG: 30, loggedness: "complete" });
    expect(countsAsDay(stamped, TARGET)).toBe(true);
  });
});

describe("the cycle readers no longer count partial days", () => {
  it("wholeDayIntake keeps only whole days, and never a zero day", () => {
    const history = [
      day({ date: "2026-11-01", mealsConsumed: 3, consumedCalories: 1750, consumedProteinG: 80 }),
      day({ date: "2026-11-02", mealsConsumed: 1, consumedCalories: 150, consumedCarbsG: 20 }), // a snack
      day({ date: "2026-11-03" }), // nothing logged
      day({ date: "2026-11-04", mealsConsumed: 0, consumedCalories: 1500, consumedProteinG: 70 }),
    ];
    expect(wholeDayIntake(history, TARGET)).toEqual([
      { date: "2026-11-01", kcal: 1750 },
      { date: "2026-11-04", kcal: 1500 },
    ]);
  });
});

/* ───────────────────────────── through the store ───────────────────────────*/

const bio = {
  ...DEFAULT_USER_BIO,
  allergies: [],
  medicalConditions: [],
  foodDislikes: [],
  sex: "female",
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activityLevel: "light",
  primaryGoal: "lose_weight",
} as UserBio;

const planFor = (date: string): DaySchedule => generateDietPlan(bio, calculateNutritionTargets(bio), date)!.schedule;

beforeEach(async () => {
  await AsyncStorage.removeItem(KEYS.SCHEDULED_DIETS);
  await AsyncStorage.removeItem(KEYS.INTAKE_LEDGER);
  await AsyncStorage.removeItem(KEYS.DIET_HISTORY);
  await AsyncStorage.removeItem(DAY_COMPLETE_KEY);
  await writeJSON(KEYS.USER_BIO, bio);
});

describe("day close records the day's status", () => {
  it("stamps a one-snack day partial, with the target it was judged against", async () => {
    const yesterday = shiftDate(todayDate(), -1);
    await saveDaySchedule(planFor(yesterday));
    await markMealConsumed(yesterday, "snack", 0);
    await processDayEnd(yesterday);
    const row = (await getDietHistory()).find((h) => h.date === yesterday)!;
    expect(row.loggedness).toBe("partial");
    expect(row.targetCalories).toBe(calculateNutritionTargets(bio).calories);
  });

  it("'That's everything' re-judges a closed day at once", async () => {
    const yesterday = shiftDate(todayDate(), -1);
    await saveDaySchedule(planFor(yesterday));
    await markMealConsumed(yesterday, "snack", 0);
    await processDayEnd(yesterday);
    await markDayComplete(yesterday, true);
    const row = (await getDietHistory()).find((h) => h.date === yesterday)!;
    expect(row.loggedness).toBe("complete");
  });
});

describe("how much she ate (Fix 7)", () => {
  it("one tap still records the planned amount", async () => {
    const today = todayDate();
    const plan = planFor(today);
    await saveDaySchedule(plan);
    await markMealConsumed(today, "lunch");
    const [line] = await getIntakeForDate(today);
    expect(line!.calories).toBeCloseTo(macrosOfMeal(plan.lunch).calories, 5);
    expect(line!.portion).toBeUndefined();
  });

  it("'I had half' rescales the line, keeps its tick time and the meal's name", async () => {
    const today = todayDate();
    const plan = planFor(today);
    await saveDaySchedule(plan);
    await markMealConsumed(today, "lunch");
    const [before] = await getIntakeForDate(today);

    expect(await setMealPortion(today, "lunch", undefined, 0.5)).toBe(true);
    const [after] = await getIntakeForDate(today);
    expect(after!.calories).toBeCloseTo(before!.calories / 2, 5);
    expect(after!.portion).toBe(0.5);
    expect(after!.at).toBe(before!.at);
    expect(after!.name).toBe(plan.lunch!.name);

    const day = await getScheduleForDate(today);
    expect(day!.lunch!.portionEaten).toBe(0.5);
    expect(day!.lunch!.name).toBe(plan.lunch!.name);

    // And double, from the half: rescaled from its own base, not compounded.
    await setMealPortion(today, "lunch", undefined, 2);
    const [doubled] = await getIntakeForDate(today);
    expect(doubled!.calories).toBeCloseTo(before!.calories * 2, 5);
  });

  it("an un-tick forgets the portion, and a new tick starts as planned", async () => {
    const today = todayDate();
    await saveDaySchedule(planFor(today));
    await toggleMealConsumed(today, "dinner");
    await setMealPortion(today, "dinner", undefined, 1.5);
    await toggleMealConsumed(today, "dinner"); // un-tick
    expect(await getIntakeForDate(today)).toHaveLength(0);
    await toggleMealConsumed(today, "dinner"); // tick again
    const [line] = await getIntakeForDate(today);
    expect(line!.portion).toBeUndefined();
  });

  it("a portion edit wins a cloud merge against the old copy (one line, not two)", () => {
    const meal = planFor("2026-11-10").lunch!;
    const original = recordFor(meal, "lunch", "2026-11-10T12:00:00.000Z");
    const edited: IntakeRecord = {
      ...original,
      calories: original.calories / 2,
      proteinG: original.proteinG / 2,
      carbsG: original.carbsG / 2,
      fatG: original.fatG / 2,
      portion: 0.5,
      loggedAt: "2026-11-10T12:30:00.000Z",
    };
    const merged = JSON.parse(
      merge(
        KEYS.INTAKE_LEDGER,
        JSON.stringify({ "2026-11-10": [edited] }),
        JSON.stringify({ "2026-11-10": [original] }),
      )!,
    ) as Record<string, IntakeRecord[]>;
    expect(merged["2026-11-10"]).toHaveLength(1);
    expect(merged["2026-11-10"]![0]!.portion).toBe(0.5);
  });
});
