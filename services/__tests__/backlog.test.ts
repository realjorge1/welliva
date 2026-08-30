/**
 * The day-rollover and back-logging rules.
 *
 * These encode the product decision directly: the new day's plan appears at
 * midnight whether or not yesterday was ticked, yesterday stays editable for
 * exactly one day, and anything older is frozen. Each is a rule a future
 * refactor could plausibly break without anyone noticing in the UI.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";
import { formatDate, type DaySchedule, type ScheduledMeal } from "../../models/diet";
import { KEYS } from "../OfflineStorage";
import {
  canLogForDate,
  getBacklogPrompt,
  getDietHistory,
  getScheduledDietForDate,
  logPermissionFor,
  processDayEnd,
  purgeExpiredSchedules,
  saveDaySchedule,
  sweepClosedDays,
  toggleMealConsumed,
} from "../ScheduleService";

const shift = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const TODAY = shift(0);
const YESTERDAY = shift(-1);
const TWO_DAYS_AGO = shift(-2);

function meal(name: string, calories = 400): ScheduledMeal {
  return {
    id: `m_${name}`,
    mealType: "breakfast",
    name,
    calories: { min: calories, max: calories },
    proteinG: { min: 20, max: 20 },
    carbsG: { min: 40, max: 40 },
    fatG: { min: 10, max: 10 },
    isConsumed: false,
  };
}

function schedule(date: string): DaySchedule {
  return {
    date,
    dietId: "test_diet",
    dietName: "Test Diet",
    breakfast: { ...meal("Oats"), mealType: "breakfast" },
    lunch: { ...meal("Rice & chicken"), mealType: "lunch" },
    dinner: { ...meal("Soup"), mealType: "dinner" },
    snacks: [],
    status: "active",
  };
}

beforeEach(async () => {
  await AsyncStorage.multiRemove([KEYS.SCHEDULED_DIETS,
    KEYS.INTAKE_LEDGER, KEYS.INTAKE_LEDGER]);
  await AsyncStorage.removeItem(KEYS.DIET_HISTORY);
});

describe("logPermissionFor", () => {
  it("opens today, allows yesterday, locks anything older", () => {
    expect(logPermissionFor(TODAY, TODAY)).toBe("open");
    expect(logPermissionFor(YESTERDAY, TODAY)).toBe("backlog");
    expect(logPermissionFor(TWO_DAYS_AGO, TODAY)).toBe("locked");
    expect(logPermissionFor(shift(-30), TODAY)).toBe("locked");
  });

  it("reports future dates as not-yet-loggable", () => {
    expect(logPermissionFor(shift(1), TODAY)).toBe("future");
  });

  it("canLogForDate agrees with the permission", () => {
    expect(canLogForDate(TODAY, TODAY)).toBe(true);
    expect(canLogForDate(YESTERDAY, TODAY)).toBe(true);
    expect(canLogForDate(TWO_DAYS_AGO, TODAY)).toBe(false);
  });
});

describe("back-log window enforcement", () => {
  it("allows ticking a meal on today", async () => {
    await saveDaySchedule(schedule(TODAY));
    expect(await toggleMealConsumed(TODAY, "breakfast")).toBe(true);
    const saved = await getScheduledDietForDate(TODAY);
    expect(saved!.schedule.breakfast!.isConsumed).toBe(true);
  });

  it("allows back-logging yesterday", async () => {
    await saveDaySchedule(schedule(YESTERDAY));
    expect(await toggleMealConsumed(YESTERDAY, "lunch")).toBe(true);
    const saved = await getScheduledDietForDate(YESTERDAY);
    expect(saved!.schedule.lunch!.isConsumed).toBe(true);
  });

  // The rule that stops history being rewritten indefinitely.
  it("refuses to log two days back, and changes nothing", async () => {
    await saveDaySchedule(schedule(TWO_DAYS_AGO));
    expect(await toggleMealConsumed(TWO_DAYS_AGO, "breakfast")).toBe(false);
    const saved = await getScheduledDietForDate(TWO_DAYS_AGO);
    expect(saved!.schedule.breakfast!.isConsumed).toBe(false);
  });

  it("rewrites yesterday's history row when it is back-logged", async () => {
    await saveDaySchedule(schedule(YESTERDAY));
    await processDayEnd(YESTERDAY);

    let history = await getDietHistory();
    expect(history.find((h) => h.date === YESTERDAY)).toMatchObject({
      mealsConsumed: 0,
      status: "skipped",
    });

    await toggleMealConsumed(YESTERDAY, "breakfast");
    await toggleMealConsumed(YESTERDAY, "lunch");

    history = await getDietHistory();
    const entry = history.find((h) => h.date === YESTERDAY);
    expect(entry).toMatchObject({ mealsConsumed: 2, totalMeals: 3, status: "partial" });
    // And exactly one row for the date — recomputed, not appended.
    expect(history.filter((h) => h.date === YESTERDAY)).toHaveLength(1);
  });
});

describe("processDayEnd", () => {
  // Regression: it used to delete the schedule, which made back-logging
  // impossible because there was nothing left to tick.
  it("keeps the schedule so the day can still be back-logged", async () => {
    await saveDaySchedule(schedule(YESTERDAY));
    await processDayEnd(YESTERDAY);
    expect(await getScheduledDietForDate(YESTERDAY)).not.toBeNull();
  });

  it("records consumed macros in history", async () => {
    await saveDaySchedule(schedule(TODAY));
    await toggleMealConsumed(TODAY, "breakfast");
    await processDayEnd(TODAY);
    const entry = (await getDietHistory()).find((h) => h.date === TODAY);
    expect(entry!.consumedCalories).toBe(400);
    expect(entry!.consumedMeals).toEqual(["Oats"]);
    expect(entry!.skippedMeals).toEqual(["Rice & chicken", "Soup"]);
  });
});

describe("sweepClosedDays", () => {
  // The multi-day catch-up. Closing the app for a week used to leave every
  // intervening day unclosed and absent from history.
  it("closes every past day, not just the most recent", async () => {
    for (const d of [shift(-4), shift(-3), TWO_DAYS_AGO, YESTERDAY]) {
      await saveDaySchedule(schedule(d));
    }
    await saveDaySchedule(schedule(TODAY));

    const { closed } = await sweepClosedDays(TODAY);
    expect(closed).toEqual([shift(-4), shift(-3), TWO_DAYS_AGO, YESTERDAY]);

    const history = await getDietHistory();
    for (const d of closed) {
      expect(history.find((h) => h.date === d), d).toBeDefined();
    }
  });

  it("leaves today's plan untouched", async () => {
    await saveDaySchedule(schedule(TODAY));
    await sweepClosedDays(TODAY);
    expect(await getScheduledDietForDate(TODAY)).not.toBeNull();
    expect((await getDietHistory()).find((h) => h.date === TODAY)).toBeUndefined();
  });

  it("purges aged schedules but keeps their history", async () => {
    await saveDaySchedule(schedule(TWO_DAYS_AGO));
    await saveDaySchedule(schedule(YESTERDAY));

    const { purged } = await sweepClosedDays(TODAY);
    expect(purged).toContain(TWO_DAYS_AGO);

    // Aged out of the schedule store…
    expect(await getScheduledDietForDate(TWO_DAYS_AGO)).toBeNull();
    // …but its outcome is permanently recorded.
    expect((await getDietHistory()).find((h) => h.date === TWO_DAYS_AGO)).toBeDefined();
    // Yesterday survives — still inside the window.
    expect(await getScheduledDietForDate(YESTERDAY)).not.toBeNull();
  });

  it("is safe to run repeatedly", async () => {
    await saveDaySchedule(schedule(YESTERDAY));
    await sweepClosedDays(TODAY);
    await sweepClosedDays(TODAY);
    expect((await getDietHistory()).filter((h) => h.date === YESTERDAY)).toHaveLength(1);
  });
});

describe("getBacklogPrompt", () => {
  it("offers yesterday's unticked meals", async () => {
    await saveDaySchedule(schedule(YESTERDAY));
    await toggleMealConsumed(YESTERDAY, "breakfast");

    const prompt = await getBacklogPrompt(TODAY);
    expect(prompt).not.toBeNull();
    expect(prompt!.date).toBe(YESTERDAY);
    expect(prompt!.unloggedMeals.map((m) => m.name)).toEqual([
      "Rice & chicken",
      "Soup",
    ]);
  });

  it("stays quiet when yesterday was fully logged", async () => {
    await saveDaySchedule(schedule(YESTERDAY));
    await toggleMealConsumed(YESTERDAY, "breakfast");
    await toggleMealConsumed(YESTERDAY, "lunch");
    await toggleMealConsumed(YESTERDAY, "dinner");
    expect(await getBacklogPrompt(TODAY)).toBeNull();
  });

  it("stays quiet when there was no plan yesterday", async () => {
    expect(await getBacklogPrompt(TODAY)).toBeNull();
  });

  it("never offers a day that has aged out", async () => {
    await saveDaySchedule(schedule(TWO_DAYS_AGO));
    await purgeExpiredSchedules(TODAY);
    expect(await getBacklogPrompt(TODAY)).toBeNull();
  });
});
