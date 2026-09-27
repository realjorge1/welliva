/**
 * Onboarding's "let me choose" — from picked dishes to the day they land on.
 *
 * Replays the save the onboarding step makes (MealPlanContext.startMenuPlan is
 * this sequence behind a provider): build every day of the menu, open a custom
 * period, write the days in one pass, project them in one pass. What must hold
 * is what the user was promised on the screen: their dishes on their days, the
 * rest filled from their cuisine, and every day of the stretch on the calendar.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { formatDate } from "../../models/diet";
import { addDays, dateRange } from "../../models/mealPlan";
import type { UserBio } from "../../models/user";
import { CUSTOM_DIET_ID, syncCustomDays, syncWholeCustomPeriod } from "../CustomMenuSchedule";
import * as MealPlan from "../MealPlanService";
import { calculateNutritionTargets } from "../NutritionService";
import {
  buildMenuDays,
  dishesForSlot,
  emptyDraft,
  weekdayIndex,
  withDish,
} from "../nutrition/menuBuilder";
import { mealCuisine } from "../nutrition/mealRules";
import { KEYS } from "../OfflineStorage";
import { getScheduleForDate, getScheduledDates, toggleMealConsumed } from "../ScheduleService";

const TODAY = formatDate(new Date());

const bio = {
  age: 34,
  sex: "female",
  heightCm: 165,
  weightKg: 70,
  activityLevel: "light",
  exerciseLevel: "beginner",
  primaryGoal: "lose_weight",
  goals: ["lose_weight"],
  trainingEnabled: false,
  dietaryRestriction: "none",
  cuisinePreference: "african",
  equipment: ["none"],
  workoutDaysPerWeek: 3,
  allergies: [],
  medicalConditions: [],
  mealsPerDay: 3,
} as UserBio;

beforeEach(async () => {
  await AsyncStorage.multiRemove([
    KEYS.SCHEDULED_DIETS,
    KEYS.INTAKE_LEDGER,
    KEYS.MEAL_PLAN_PERIODS,
    KEYS.CUSTOM_MENUS,
    KEYS.DIET_HISTORY,
  ]);
});

async function saveMenu(lengthDays: number) {
  const targets = calculateNutritionTargets(bio);
  const draft = emptyDraft();
  const breakfasts = dishesForSlot("breakfast", { cuisinePreference: "african" }).slice(0, 2);
  for (const dish of breakfasts) {
    draft.dishes[dish.key] = dish;
    draft.weeks.breakfast = withDish(draft.weeks.breakfast, dish.key);
  }
  const dates = dateRange(TODAY, addDays(TODAY, lengthDays - 1));
  const days = buildMenuDays({ draft, bio, targets, dates });

  const period = await MealPlan.startPeriod({
    mode: "custom",
    label: "My African menu",
    durationKind: "custom",
    startDate: TODAY,
    customEndDate: addDays(TODAY, lengthDays - 1),
  });
  await MealPlan.setCustomMenuDays(period.id, days);
  await syncCustomDays(period, Object.keys(days), TODAY);
  return { period, draft, dates };
}

describe("a menu picked during onboarding", () => {
  it("puts every day of the stretch on the calendar, today included", async () => {
    const { dates } = await saveMenu(30);
    const scheduled = await getScheduledDates();
    for (const date of dates) expect(scheduled).toContain(date);

    const today = await getScheduleForDate(TODAY);
    expect(today?.dietId).toBe(CUSTOM_DIET_ID);
    expect(today?.dietName).toBe("My African menu");
    expect(today?.breakfast && today.lunch && today.dinner).toBeTruthy();
    expect(today?.snacks.length).toBeGreaterThan(0);
  });

  it("serves the picked dish on its weekday and African dishes everywhere else", async () => {
    const { draft, dates } = await saveMenu(14);
    for (const date of dates) {
      const day = (await getScheduleForDate(date))!;
      const key = draft.weeks.breakfast[weekdayIndex(date)]!;
      expect(draft.dishes[key]!.portions.map((p) => p.name)).toContain(day.breakfast!.name);
      expect(mealCuisine(day.lunch!)).toBe("Nigerian");
      expect(mealCuisine(day.dinner!)).toBe("Nigerian");
    }
  });

  it("survives the daily repair pass without losing a tick", async () => {
    const { period } = await saveMenu(7);
    await toggleMealConsumed(TODAY, "breakfast");
    const before = (await getScheduleForDate(TODAY))!;
    expect(before.breakfast?.isConsumed).toBe(true);

    await syncWholeCustomPeriod(period, TODAY);

    const after = (await getScheduleForDate(TODAY))!;
    expect(after.breakfast?.name).toBe(before.breakfast?.name);
    expect(after.breakfast?.isConsumed).toBe(true);
  });
});
