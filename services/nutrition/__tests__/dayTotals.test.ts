/**
 * A DAY'S INTAKE, AND THE THREE WAYS IT USED TO READ ZERO.
 *
 * The report was "close the app, reopen it, and the nutrition card says 0%
 * even though the meals are still ticked". Nothing was ever deleted from disk;
 * three separate things summed to nothing:
 *
 *  1. Free-form logs were never counted at all. The Foods catalog, Gozlin and
 *     the log-food sheet write FOOD_LOG; every calorie readout read the
 *     schedule. A day logged entirely through them totalled zero, forever.
 *  2. One malformed macro turned the whole day into NaN, which renders blank.
 *  3. The custom-menu repair pass — which runs on EVERY app open — rebuilt the
 *     day's snacks from the menu alone, deleting anything logged onto the day
 *     from outside the planner. Visible all day, gone by the next launch.
 *
 * The last one matched the report exactly: the planned meals kept their ticks
 * (they are in the menu), and the food carrying the calories did not.
 *
 * Fixing those three did not fix the class. A total derived by re-reading the
 * plan is only ever as durable as the least careful of the SIX code paths that
 * rewrite the plan, so the tick became its own record — see IntakeLedger. The
 * "no rewrite of the plan can zero the day" block at the bottom is the one that
 * pins that guarantee; the rest pin the arithmetic.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  formatDate,
  type DaySchedule,
  type MealType,
  type ScheduledMeal,
} from "../../../models/diet";
import type { MealPlanPeriod } from "../../../models/mealPlan";
import { syncWholeCustomPeriod } from "../../CustomMenuSchedule";
import * as MealPlan from "../../MealPlanService";
import { KEYS } from "../../OfflineStorage";
import {
  addSnackToSchedule,
  getDietHistory,
  getScheduleForDate,
  markMealConsumed,
  processDayEnd,
  saveDaySchedule,
  toggleMealConsumed,
} from "../../ScheduleService";
import { dayMacros, foodLogMacros, macrosOfMeal, sumMacros } from "../DayTotals";
import type { FoodLogEntry } from "../foodLogStore";
import { getIntakeForDate, type IntakeRecord } from "../IntakeLedger";

const shift = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};
const TODAY = shift(0);

function meal(name: string, kcal: number): ScheduledMeal {
  return {
    id: `m_${name}`,
    mealType: "breakfast",
    name,
    calories: { min: kcal, max: kcal },
    proteinG: { min: 20, max: 20 },
    carbsG: { min: 40, max: 40 },
    fatG: { min: 10, max: 10 },
    isConsumed: false,
  };
}

function logEntry(kcal: number): FoodLogEntry {
  return {
    id: `log_${kcal}`,
    date: TODAY,
    slot: null,
    label: "Banana",
    items: [],
    totals: { calories: kcal, protein: 5, carbs: 27, fat: 0 },
    partialKeys: [],
    confidence: "measured",
    origin: "catalog",
    loggedAt: new Date().toISOString(),
  };
}

function intake(name: string, kcal: number, slot: MealType = "breakfast"): IntakeRecord {
  return {
    slot,
    name,
    calories: kcal,
    proteinG: 20,
    carbsG: 40,
    fatG: 10,
    at: new Date().toISOString(),
  };
}

/** The day's calories exactly as the app computes them: ledger + food log. */
async function totalFor(date: string): Promise<number> {
  // Reading the plan first is what the app does, and what reconciles the ledger.
  await getScheduleForDate(date);
  return dayMacros(await getIntakeForDate(date), []).calories;
}

const day = (over: Partial<DaySchedule> = {}): DaySchedule => ({
  date: TODAY,
  dietId: "d1",
  dietName: "D1",
  breakfast: null,
  lunch: null,
  dinner: null,
  snacks: [],
  status: "active",
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.multiRemove([
    KEYS.INTAKE_LEDGER,
    KEYS.SCHEDULED_DIETS,
    KEYS.WEEK_SCHEDULES,
    KEYS.DIET_HISTORY,
    KEYS.FOOD_LOG,
    KEYS.MEAL_PLAN_PERIODS,
    KEYS.CUSTOM_MENUS,
  ]);
});

// ───────────────────────────── the sum itself ──────────────────────────────

describe("what the user ate today", () => {
  it("counts free-form logs the schedule has never heard of", () => {
    expect(foodLogMacros([logEntry(100), logEntry(250)]).calories).toBe(350);
  });

  it("counts BOTH — the bug was that nothing ever added them up", () => {
    expect(dayMacros([intake("Oats", 400)], [logEntry(100)]).calories).toBe(500);
  });

  it("rounds once, so the total equals the sum of its parts", () => {
    // 100.5 + 100.5 — rounding each half first would report 202.
    expect(
      dayMacros([intake("A", 100.5), intake("B", 100.5)], []).calories,
    ).toBe(201);
  });
});

// ──────────────────── a bad row costs only its own row ─────────────────────

describe("a malformed meal", () => {
  it("does not turn the day into NaN", () => {
    const broken = { ...meal("Legacy", 0), isConsumed: true } as unknown as Record<
      string,
      unknown
    >;
    // Older/hand-built rows stored a plain number where a {min,max} belongs.
    broken.calories = 300;
    broken.proteinG = undefined;

    const schedule = day({
      breakfast: broken as unknown as ScheduledMeal,
      lunch: { ...meal("Rice", 600), isConsumed: true },
    });
    const totals = sumMacros(
      macrosOfMeal(schedule.breakfast),
      macrosOfMeal(schedule.lunch),
    );
    expect(Number.isFinite(totals.calories)).toBe(true);
    expect(totals.calories).toBe(900);
    expect(totals.proteinG).toBe(20); // the good row still contributes
  });

  it("records what it can from one, rather than nothing", async () => {
    const broken = meal("Legacy", 0) as unknown as Record<string, unknown>;
    broken.calories = 300; // a plain number where a {min,max} belongs
    await saveDaySchedule(day({ breakfast: broken as unknown as ScheduledMeal }));
    await markMealConsumed(TODAY, "breakfast");
    expect(await totalFor(TODAY)).toBe(300);
  });

  it("costs a ledger record nothing — its numbers were captured at the tick", () => {
    const bad = { slot: "lunch", name: "X", at: "" } as unknown as IntakeRecord;
    expect(dayMacros([intake("Oats", 400), bad], []).calories).toBe(400);
  });
});

// ───────────────── the cold start that started all of this ─────────────────

describe("reopening the app", () => {
  async function customPeriod(): Promise<MealPlanPeriod> {
    return MealPlan.startPeriod({
      mode: "custom",
      label: "My menu",
      durationKind: "custom",
      startDate: TODAY,
      customEndDate: shift(6),
    });
  }

  async function planBreakfast(period: MealPlanPeriod): Promise<void> {
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TODAY,
      slot: "breakfast",
      meal: meal("Oats", 300),
    });
    await syncWholeCustomPeriod(period, TODAY);
  }

  const banana = (): ScheduledMeal => ({
    ...meal("Banana", 100),
    mealType: "snack",
    isConsumed: true,
  });

  async function emptyTheMenu(period: MealPlanPeriod): Promise<void> {
    const entries = await MealPlan.getCustomEntriesForDate(period.id, TODAY);
    for (const entry of entries) await MealPlan.removeCustomMeal(period.id, entry.id);
    await syncWholeCustomPeriod(period, TODAY);
  }

  it("keeps a food logged onto a hand-planned day", async () => {
    const period = await customPeriod();
    await planBreakfast(period);
    await markMealConsumed(TODAY, "breakfast");
    await addSnackToSchedule(TODAY, banana());

    expect(await totalFor(TODAY)).toBe(400);

    // The repair pass, exactly as MealPlanContext runs it on every app open.
    await syncWholeCustomPeriod(period, TODAY);

    expect(await totalFor(TODAY)).toBe(400);
  });

  it("does not duplicate it on the launch after that", async () => {
    const period = await customPeriod();
    await planBreakfast(period);
    await addSnackToSchedule(TODAY, banana());

    await syncWholeCustomPeriod(period, TODAY);
    await syncWholeCustomPeriod(period, TODAY);
    await syncWholeCustomPeriod(period, TODAY);

    const schedule = await getScheduleForDate(TODAY);
    expect(schedule!.snacks.map((s) => s.name)).toEqual(["Banana"]);
  });

  it("keeps a logged food even when the menu for that day is emptied", async () => {
    const period = await customPeriod();
    await planBreakfast(period);
    await addSnackToSchedule(TODAY, banana());

    // An empty menu means "no plan for this day", never "I ate nothing".
    await emptyTheMenu(period);

    const schedule = await getScheduleForDate(TODAY);
    expect(schedule).not.toBeNull();
    expect(await totalFor(TODAY)).toBe(100);
  });

  it("still un-plans a day that holds nothing at all", async () => {
    const period = await customPeriod();
    await planBreakfast(period);
    await emptyTheMenu(period);

    expect(await getScheduleForDate(TODAY)).toBeNull();
  });
});

// ─────────── no rewrite of the plan can zero the day. this is the fix ───────

describe("whatever happens to the plan afterwards", () => {
  async function planAndEat(): Promise<void> {
    await saveDaySchedule(
      day({ breakfast: meal("Oats", 400), lunch: meal("Rice", 600) }),
    );
    await markMealConsumed(TODAY, "breakfast");
    await markMealConsumed(TODAY, "lunch");
    expect(await totalFor(TODAY)).toBe(1000);
  }

  it("survives the whole day being regenerated into different meals", async () => {
    await planAndEat();

    // What the rollover, a preference change or the AI backend does: a fresh
    // day, written straight over the top, remembering nothing.
    await saveDaySchedule(
      day({ breakfast: meal("Pancakes", 500), lunch: meal("Salad", 300) }),
    );

    // The meals are gone; what was eaten is not. This is the guarantee.
    expect(await totalFor(TODAY)).toBe(1000);
  });

  it("puts the ticks back on a plan that was rewritten with the same meals", async () => {
    await planAndEat();

    // The commonest shape of the bug: same meals, ticks dropped.
    await saveDaySchedule(
      day({ breakfast: meal("Oats", 400), lunch: meal("Rice", 600) }),
    );

    const healed = await getScheduleForDate(TODAY);
    expect(healed!.breakfast!.isConsumed).toBe(true);
    expect(healed!.lunch!.isConsumed).toBe(true);
    expect(await totalFor(TODAY)).toBe(1000);
  });

  it("adopts ticks that predate the ledger, so existing users just open the app", async () => {
    // A day exactly as it was stored before any of this existed: consumption
    // on the plan, nothing in the ledger. No migration runs — the read heals it.
    await saveDaySchedule(
      day({
        breakfast: { ...meal("Oats", 400), isConsumed: true },
        lunch: meal("Rice", 600),
      }),
    );
    expect(await getIntakeForDate(TODAY)).toHaveLength(0);

    expect(await totalFor(TODAY)).toBe(400);
    expect(await getIntakeForDate(TODAY)).toHaveLength(1);
  });

  it("does not double-count on the second, third and fourth read", async () => {
    await saveDaySchedule(day({ breakfast: { ...meal("Oats", 400), isConsumed: true } }));
    await getScheduleForDate(TODAY);
    await getScheduleForDate(TODAY);
    await getScheduleForDate(TODAY);
    expect(await totalFor(TODAY)).toBe(400);
  });

  it("still lets a meal be un-eaten", async () => {
    await saveDaySchedule(day({ breakfast: meal("Oats", 400) }));
    await toggleMealConsumed(TODAY, "breakfast");
    expect(await totalFor(TODAY)).toBe(400);

    await toggleMealConsumed(TODAY, "breakfast");
    expect(await totalFor(TODAY)).toBe(0);
    // …and stays un-eaten through a rewrite, or un-ticking would be a no-op.
    await saveDaySchedule(day({ breakfast: meal("Oats", 400) }));
    expect(await totalFor(TODAY)).toBe(0);
  });

  it("counts two identical snacks as two, and un-ticking one as one", async () => {
    await saveDaySchedule(day({ snacks: [meal("Banana", 100), meal("Banana", 100)] }));
    await markMealConsumed(TODAY, "snack", 0);
    await markMealConsumed(TODAY, "snack", 1);
    expect(await totalFor(TODAY)).toBe(200);

    await toggleMealConsumed(TODAY, "snack", 1);
    expect(await totalFor(TODAY)).toBe(100);

    const healed = await getScheduleForDate(TODAY);
    expect(healed!.snacks.map((s) => s.isConsumed)).toEqual([true, false]);
  });
});

// ────────────────── and the record the day leaves behind ───────────────────

describe("closing the day", () => {
  it("writes what was eaten, not just what was ticked off the plan", async () => {
    const yesterday = shift(-1);
    await saveDaySchedule(
      day({ date: yesterday, breakfast: { ...meal("Oats", 400), isConsumed: true } }),
    );
    await AsyncStorage.setItem(
      KEYS.FOOD_LOG,
      JSON.stringify({ [yesterday]: [{ ...logEntry(250), date: yesterday }] }),
    );

    await processDayEnd(yesterday);

    const row = (await getDietHistory()).find((h) => h.date === yesterday)!;
    // 400 planned + 250 logged. The row used to say 400, and the trend charts,
    // the period report and the TDEE learning filter all believed it.
    expect(row.consumedCalories).toBe(650);
    // Adherence is still the plan alone — a banana is not evidence you ate lunch.
    expect(row.mealsConsumed).toBe(1);
    expect(row.totalMeals).toBe(1);
  });
});
