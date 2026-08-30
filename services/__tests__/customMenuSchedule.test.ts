/**
 * THE BRIDGE FROM A HAND-PLANNED MENU TO THE DAY IT LANDS ON.
 *
 * Custom menus were written to their own store and read back by exactly one
 * screen — the planner that wrote them. Everything that actually USES a plan
 * (today's diet, ticking a meal off, the backlog prompt, day-end history, the
 * closing report) reads schedules, so "Thursday dinner: mac and cheese" was real
 * on Tuesday and gone on Thursday, replaced by a generated diet the user had
 * explicitly opted out of.
 *
 * These cover the projection and the three ways it could quietly do harm:
 * un-eating a meal the user already ticked, filling a slot they deliberately
 * left empty, and deleting a generated day that was never ours to delete.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { formatDate, type DaySchedule, type ScheduledMeal } from "../../models/diet";
import type { MealPlanPeriod } from "../../models/mealPlan";
import {
  CUSTOM_DIET_ID,
  isCustomSchedule,
  syncCustomDay,
  syncWholeCustomPeriod,
} from "../CustomMenuSchedule";
import * as MealPlan from "../MealPlanService";
import { KEYS } from "../OfflineStorage";
import {
  getScheduleForDate,
  saveDaySchedule,
  toggleMealConsumed,
} from "../ScheduleService";

const shift = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const TODAY = shift(0);
const TOMORROW = shift(1);

/** A meal in the shape the planner hands to setCustomMeal. */
function meal(name: string, kcal = 400): ScheduledMeal {
  return {
    id: `cm_${name}`,
    mealType: "breakfast",
    name,
    calories: { min: kcal, max: kcal },
    proteinG: { min: 20, max: 20 },
    carbsG: { min: 40, max: 40 },
    fatG: { min: 10, max: 10 },
    isConsumed: false,
  };
}

async function startCustomPeriod(): Promise<MealPlanPeriod> {
  return MealPlan.startPeriod({
    mode: "custom",
    label: "My menu",
    durationKind: "custom",
    startDate: TODAY,
    customEndDate: shift(6),
  });
}

beforeEach(async () => {
  await AsyncStorage.multiRemove([
    KEYS.SCHEDULED_DIETS,
    KEYS.INTAKE_LEDGER,
    KEYS.MEAL_PLAN_PERIODS,
    KEYS.CUSTOM_MENUS,
    KEYS.DIET_HISTORY,
  ]);
});

describe("projecting a planned day onto the calendar", () => {
  it("puts a hand-picked meal where the rest of the app will find it", async () => {
    const period = await startCustomPeriod();
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TOMORROW,
      slot: "dinner",
      meal: meal("Mac and cheese", 650),
    });

    // Nothing is on the calendar until the projection runs — that WAS the bug.
    expect(await getScheduleForDate(TOMORROW)).toBeNull();

    const planned = await syncCustomDay(period, TOMORROW, TODAY);
    expect(planned).toBe(true);

    const schedule = await getScheduleForDate(TOMORROW);
    expect(schedule?.dinner?.name).toBe("Mac and cheese");
    expect(schedule?.dinner?.mealType).toBe("dinner");
    expect(schedule?.dinner?.isConsumed).toBe(false);
    expect(schedule?.status).toBe("upcoming");
    expect(isCustomSchedule(schedule)).toBe(true);
    expect(schedule?.dietName).toBe("My menu");
  });

  it("leaves unplanned slots empty — custom mode never fills a gap", async () => {
    const period = await startCustomPeriod();
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TODAY,
      slot: "breakfast",
      meal: meal("Akara and pap"),
    });
    await syncCustomDay(period, TODAY, TODAY);

    const schedule = await getScheduleForDate(TODAY);
    expect(schedule?.breakfast?.name).toBe("Akara and pap");
    expect(schedule?.lunch).toBeNull();
    expect(schedule?.dinner).toBeNull();
    expect(schedule?.snacks).toEqual([]);
  });

  it("carries every snack across, not just the first", async () => {
    const period = await startCustomPeriod();
    for (const name of ["Groundnuts", "Banana"]) {
      await MealPlan.setCustomMeal({
        periodId: period.id,
        date: TODAY,
        slot: "snack",
        meal: meal(name, 150),
      });
    }
    await syncCustomDay(period, TODAY, TODAY);

    const schedule = await getScheduleForDate(TODAY);
    expect(schedule?.snacks.map((s) => s.name)).toEqual(["Groundnuts", "Banana"]);
  });
});

describe("what must survive a re-projection", () => {
  it("does not un-eat a meal the user already ticked off", async () => {
    const period = await startCustomPeriod();
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TODAY,
      slot: "breakfast",
      meal: meal("Oats"),
    });
    await syncCustomDay(period, TODAY, TODAY);
    expect(await toggleMealConsumed(TODAY, "breakfast")).toBe(true);

    // Planning a different day re-projects the whole period.
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TOMORROW,
      slot: "lunch",
      meal: meal("Jollof rice"),
    });
    await syncWholeCustomPeriod(period, TODAY);

    const schedule = await getScheduleForDate(TODAY);
    expect(schedule?.breakfast?.isConsumed).toBe(true);
    expect(schedule?.breakfast?.consumedAt).toBeTruthy();
  });

  it("drops the tick when the slot's meal is swapped for a different one", async () => {
    const period = await startCustomPeriod();
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TODAY,
      slot: "breakfast",
      meal: meal("Oats"),
    });
    await syncCustomDay(period, TODAY, TODAY);
    await toggleMealConsumed(TODAY, "breakfast");

    // A different meal is not the meal they ate, so the tick must not transfer.
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TODAY,
      slot: "breakfast",
      meal: meal("Pancakes"),
    });
    await syncCustomDay(period, TODAY, TODAY);

    const schedule = await getScheduleForDate(TODAY);
    expect(schedule?.breakfast?.name).toBe("Pancakes");
    expect(schedule?.breakfast?.isConsumed).toBe(false);
    expect(schedule?.breakfast?.consumedAt).toBeUndefined();
  });
});

describe("clearing", () => {
  it("removes the day from the calendar once its last pick is gone", async () => {
    const period = await startCustomPeriod();
    const entry = await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TOMORROW,
      slot: "dinner",
      meal: meal("Mac and cheese"),
    });
    await syncCustomDay(period, TOMORROW, TODAY);
    expect(await getScheduleForDate(TOMORROW)).not.toBeNull();

    await MealPlan.removeCustomMeal(period.id, entry.id);
    expect(await syncCustomDay(period, TOMORROW, TODAY)).toBe(false);
    expect(await getScheduleForDate(TOMORROW)).toBeNull();
  });

  it("never deletes a generated day — that plan belongs to the generator", async () => {
    const period = await startCustomPeriod();
    const generated: DaySchedule = {
      date: TOMORROW,
      dietId: "mediterranean",
      dietName: "Mediterranean",
      breakfast: meal("Greek yogurt"),
      lunch: null,
      dinner: null,
      snacks: [],
      status: "upcoming",
    };
    await saveDaySchedule(generated);

    // The user has planned nothing for that date, so the projection must leave
    // the generated day exactly as it found it.
    expect(await syncCustomDay(period, TOMORROW, TODAY)).toBe(false);
    const still = await getScheduleForDate(TOMORROW);
    expect(still?.dietId).toBe("mediterranean");
    expect(still?.breakfast?.name).toBe("Greek yogurt");
  });

  it("does overwrite a generated day the user has since hand-planned", async () => {
    const period = await startCustomPeriod();
    await saveDaySchedule({
      date: TOMORROW,
      dietId: "mediterranean",
      dietName: "Mediterranean",
      breakfast: meal("Greek yogurt"),
      lunch: meal("Orzo salad"),
      dinner: null,
      snacks: [],
      status: "upcoming",
    });

    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TOMORROW,
      slot: "breakfast",
      meal: meal("Akara and pap"),
    });
    await syncCustomDay(period, TOMORROW, TODAY);

    const schedule = await getScheduleForDate(TOMORROW);
    expect(schedule?.dietId).toBe(CUSTOM_DIET_ID);
    expect(schedule?.breakfast?.name).toBe("Akara and pap");
    // The generated lunch goes with it: an unplanned slot stays empty.
    expect(schedule?.lunch).toBeNull();
  });
});

describe("the repair pass", () => {
  it("projects every planned day of a menu that was never on the calendar", async () => {
    const period = await startCustomPeriod();
    const dates = [TODAY, TOMORROW, shift(2)];
    for (const date of dates) {
      await MealPlan.setCustomMeal({
        periodId: period.id,
        date,
        slot: "breakfast",
        meal: meal(`Breakfast ${date}`),
      });
    }

    expect(await syncWholeCustomPeriod(period, TODAY)).toBe(dates.length);
    for (const date of dates) {
      expect((await getScheduleForDate(date))?.breakfast?.name).toBe(
        `Breakfast ${date}`,
      );
    }
  });
});
