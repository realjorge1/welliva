/**
 * CHOOSING — AND RE-CHOOSING — WHICH DAYS A HAND-PLANNED MENU COVERS.
 *
 * Two things were wrong, and each is a way for the planner to lose a user's
 * food.
 *
 *  1. The schedule question was asked once and then sealed. The only route back
 *     to it went through startPeriod, which closes the incumbent and mints a new
 *     id — and custom menus are keyed by period id, so "actually, just today"
 *     would have orphaned every meal already planned. reschedulePeriod exists to
 *     move the window WITHOUT moving the id.
 *
 *  2. "Custom" only ever meant a contiguous run to an end date, so a user who
 *     wanted the 5th, the 9th and next Saturday got the whole fortnight between
 *     them. Picked days are stored as such, and everything that walks a period
 *     has to walk THOSE days — a gap the user never planned must not be reported
 *     as a day they failed to eat.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { formatDate, type ScheduledMeal } from "../../models/diet";
import {
  periodDays,
  periodLengthDays,
  periodPlansDate,
  scheduleDays,
} from "../../models/mealPlan";
import { syncCustomDays, syncWholeCustomPeriod } from "../CustomMenuSchedule";
import * as MealPlan from "../MealPlanService";
import { KEYS } from "../OfflineStorage";
import { getScheduleForDate } from "../ScheduleService";

const shift = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const TODAY = shift(0);

function meal(name: string): ScheduledMeal {
  return {
    id: `cm_${name}`,
    mealType: "breakfast",
    name,
    calories: { min: 400, max: 400 },
    proteinG: { min: 20, max: 20 },
    carbsG: { min: 40, max: 40 },
    fatG: { min: 10, max: 10 },
    isConsumed: false,
  };
}

const plan = (periodId: string, date: string, name: string) =>
  MealPlan.setCustomMeal({ periodId, date, slot: "breakfast", meal: meal(name) });

beforeEach(async () => {
  await AsyncStorage.multiRemove([
    KEYS.SCHEDULED_DIETS,
    KEYS.INTAKE_LEDGER,
    KEYS.MEAL_PLAN_PERIODS,
    KEYS.CUSTOM_MENUS,
    KEYS.DIET_HISTORY,
  ]);
});

describe("what a schedule choice covers", () => {
  it("resolves one day, a week, and the days the user picked", () => {
    expect(scheduleDays({ durationKind: "day", startDate: TODAY })).toEqual([TODAY]);
    expect(scheduleDays({ durationKind: "week", startDate: TODAY })).toHaveLength(7);
    expect(
      scheduleDays({
        durationKind: "custom",
        startDate: TODAY,
        selectedDates: [shift(9), shift(2), shift(9)],
      }),
    ).toEqual([shift(2), shift(9)]);
  });

  it("falls back to the end date when custom carries no picked days", () => {
    expect(
      scheduleDays({
        durationKind: "custom",
        startDate: TODAY,
        customEndDate: shift(3),
      }),
    ).toEqual([TODAY, shift(1), shift(2), shift(3)]);
  });
});

describe("a plan made of picked days", () => {
  it("plans only those days, and brackets them with its window", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "custom",
      startDate: TODAY,
      selectedDates: [shift(2), shift(6)],
    });

    expect(period.selectedDates).toEqual([shift(2), shift(6)]);
    // The window still starts today so the period is ACTIVE — a plan that only
    // becomes real next Tuesday would leave the planner showing its own setup
    // screen, as if nothing had been created.
    expect(period.startDate).toBe(TODAY);
    expect(period.endDate).toBe(shift(6));

    expect(periodDays(period)).toEqual([shift(2), shift(6)]);
    expect(periodLengthDays(period)).toBe(2);
    expect(periodPlansDate(period, shift(2))).toBe(true);
    expect(periodPlansDate(period, shift(3))).toBe(false);
  });

  it("still governs the days between the picks, so it stays the active plan", async () => {
    await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "custom",
      startDate: TODAY,
      selectedDates: [shift(4)],
    });
    const active = await MealPlan.getActivePeriod();
    expect(active?.selectedDates).toEqual([shift(4)]);
  });
});

describe("changing your mind about the schedule", () => {
  it("keeps the period, and with it every meal already planned", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "week",
      startDate: TODAY,
    });
    await plan(period.id, shift(1), "Moi-moi");

    const after = await MealPlan.reschedulePeriod(period.id, {
      durationKind: "custom",
      startDate: TODAY,
      selectedDates: [TODAY, shift(1)],
    });

    expect(after?.id).toBe(period.id);
    expect(after?.durationKind).toBe("custom");
    expect(after?.selectedDates).toEqual([TODAY, shift(1)]);
    const entries = await MealPlan.getCustomEntriesForDate(period.id, shift(1));
    expect(entries.map((e) => e.meal.name)).toEqual(["Moi-moi"]);
  });

  it("shrinking to a single day narrows the window without touching the menu", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "week",
      startDate: TODAY,
    });
    const after = await MealPlan.reschedulePeriod(period.id, {
      durationKind: "day",
      startDate: TODAY,
    });
    expect(after?.endDate).toBe(TODAY);
    expect(after?.selectedDates).toBeUndefined();
  });

  it("dropping days removes their picks AND takes them off the calendar", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "week",
      startDate: TODAY,
    });
    await plan(period.id, TODAY, "Oats");
    await plan(period.id, shift(3), "Jollof");
    await syncWholeCustomPeriod(period, TODAY);
    expect((await getScheduleForDate(shift(3)))?.breakfast?.name).toBe("Jollof");

    // What the planner does when the user shrinks the week to today: drop the
    // days that fall outside, then reschedule, then re-project.
    const dropped = [shift(3)];
    await MealPlan.dropCustomDates(period.id, dropped);
    const after = await MealPlan.reschedulePeriod(period.id, {
      durationKind: "day",
      startDate: TODAY,
    });
    await syncCustomDays(after!, dropped, TODAY);

    expect(await MealPlan.getPlannedDates(period.id)).toEqual([TODAY]);
    expect(await getScheduleForDate(shift(3))).toBeNull();
    // The day that survived kept its food.
    expect((await getScheduleForDate(TODAY))?.breakfast?.name).toBe("Oats");
  });

  it("never drops a day already behind us", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "custom",
      startDate: shift(-3),
      customEndDate: shift(3),
    });
    await plan(period.id, shift(-2), "Yesterday's dinner");

    const after = await MealPlan.reschedulePeriod(period.id, {
      durationKind: "day",
      startDate: TODAY,
    });

    // The window still reaches back over the day that was eaten…
    expect(after?.startDate).toBe(shift(-3));
    expect(after?.endDate).toBe(TODAY);
    // …and the meal on it is untouched.
    const entries = await MealPlan.getCustomEntriesForDate(period.id, shift(-2));
    expect(entries).toHaveLength(1);
  });

  it("carries past planned days into a picked-days selection", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "custom",
      startDate: shift(-2),
      customEndDate: shift(5),
    });
    await plan(period.id, shift(-1), "Already eaten");

    const after = await MealPlan.reschedulePeriod(period.id, {
      durationKind: "custom",
      startDate: TODAY,
      selectedDates: [shift(4)],
    });

    expect(after?.selectedDates).toEqual([shift(-1), shift(4)]);
    expect(periodPlansDate(after!, shift(-1))).toBe(true);
  });
});
