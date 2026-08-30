/**
 * COLD BOOT — "I ticked breakfast, closed the app, and my day is back to zero."
 *
 * dayTotals.test.ts pins the arithmetic and the ledger's own guarantees. This
 * file pins the thing the user actually does: tick a meal, kill the app, open
 * it again, and read the number off the Home ring.
 *
 * It replays the REAL launch sequence — AppContext.loadData's rollover branch,
 * then refreshTodayDiet, then MealPlanContext's custom-menu repair pass — over
 * real storage, because every version of this bug lived in the ORDER those run
 * in rather than in any one of them.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  formatDate,
  getDayName,
  type DaySchedule,
  type ScheduledMeal,
  type WeekSchedule,
} from "../../../models/diet";
import { syncWholeCustomPeriod } from "../../CustomMenuSchedule";
import * as MealPlan from "../../MealPlanService";
import { KEYS } from "../../OfflineStorage";
import {
  getTodayDiet,
  markMealConsumed,
  saveDaySchedule,
  sweepClosedDays,
  toggleMealConsumed,
} from "../../ScheduleService";
import { sumMacros, foodLogMacrosRaw, intakeMacrosRaw } from "../DayTotals";
import { getIntakeForDate } from "../IntakeLedger";
import { getFoodLogForDate } from "../foodLogStore";

const shift = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};
const TODAY = shift(0);

function meal(name: string, kcal: number, proteinG = 40): ScheduledMeal {
  return {
    id: `m_${name}_${Math.random().toString(36).slice(2, 6)}`,
    mealType: "breakfast",
    name,
    calories: { min: kcal, max: kcal },
    proteinG: { min: proteinG, max: proteinG },
    carbsG: { min: 30, max: 30 },
    fatG: { min: 10, max: 10 },
    isConsumed: false,
  };
}

const day = (over: Partial<DaySchedule> = {}): DaySchedule => ({
  date: TODAY,
  dietId: "mediterranean",
  dietName: "Mediterranean",
  breakfast: null,
  lunch: null,
  dinner: null,
  snacks: [],
  status: "active",
  ...over,
});

/**
 * THE LAUNCH READ, exactly as contexts/domain/useNutritionState.refreshTodayDiet
 * performs it: resolve today's plan (which reconciles it against the ledger),
 * then read both halves of the day's intake and sum them once.
 *
 * Returned together with the schedule the user would see, so a test can assert
 * on BOTH — the whole bug is the two disagreeing.
 */
async function coldBoot() {
  const today = TODAY;
  const diet = await getTodayDiet();
  const [intake, log] = await Promise.all([
    getIntakeForDate(today),
    getFoodLogForDate(today),
  ]);
  const totals = sumMacros(intakeMacrosRaw(intake), foodLogMacrosRaw(log));
  return { schedule: diet.schedule, totals };
}

/** Whether the plan still shows a slot as ticked. */
const ticked = (schedule: DaySchedule | null, slot: "breakfast" | "lunch") =>
  !!schedule?.[slot]?.isConsumed;

beforeEach(async () => {
  await AsyncStorage.multiRemove([
    KEYS.INTAKE_LEDGER,
    KEYS.SCHEDULED_DIETS,
    KEYS.WEEK_SCHEDULES,
    KEYS.DIET_HISTORY,
    KEYS.FOOD_LOG,
    KEYS.MEAL_PLAN_PERIODS,
    KEYS.CUSTOM_MENUS,
    KEYS.LAST_CHECKED_DATE,
  ]);
});

// ───────────────────────── the report, verbatim ─────────────────────────────

describe("the reported bug: ticked meals, zeroed totals", () => {
  it("a generated day survives a relaunch", async () => {
    await saveDaySchedule(day({ breakfast: meal("Oats & berries", 420) }));
    await markMealConsumed(TODAY, "breakfast");

    const { schedule, totals } = await coldBoot();

    expect(ticked(schedule, "breakfast")).toBe(true);
    expect(totals.calories).toBe(420);
    expect(totals.proteinG).toBe(40);
  });

  it("a hand-planned (custom menu) day survives a relaunch and its repair pass", async () => {
    const period = await MealPlan.startPeriod({
      mode: "custom",
      durationKind: "week",
      label: "My week",
      startDate: TODAY,
    });
    await MealPlan.setCustomMeal({
      periodId: period.id,
      date: TODAY,
      slot: "breakfast",
      meal: meal("Akara & pap", 380),
    });
    await syncWholeCustomPeriod(period, TODAY);
    await markMealConsumed(TODAY, "breakfast");

    // MealPlanContext re-projects the whole period on EVERY app open.
    await syncWholeCustomPeriod(period, TODAY);
    const { schedule, totals } = await coldBoot();

    expect(ticked(schedule, "breakfast")).toBe(true);
    expect(totals.calories).toBe(380);
  });

  it("a day regenerated under the tick keeps the calories that were eaten", async () => {
    await saveDaySchedule(day({ breakfast: meal("Oats & berries", 420) }));
    await markMealConsumed(TODAY, "breakfast");

    // The generator / AI backend rewrites the day into something else entirely.
    await saveDaySchedule(day({ breakfast: meal("Scrambled eggs", 300) }));

    const { totals } = await coldBoot();
    expect(totals.calories).toBe(420);
  });

  it("an un-tick actually removes the calories", async () => {
    await saveDaySchedule(day({ breakfast: meal("Oats & berries", 420) }));
    await markMealConsumed(TODAY, "breakfast");
    await toggleMealConsumed(TODAY, "breakfast");

    const { schedule, totals } = await coldBoot();
    expect(ticked(schedule, "breakfast")).toBe(false);
    expect(totals.calories).toBe(0);
  });

  it("the UPGRADE launch: ticks made before the ledger existed still count", async () => {
    // Every current user arrives here exactly once. Their day is ticked in
    // SCHEDULED_DIETS and the ledger has never heard of it, which is precisely
    // the state the bug report describes — so the first launch after this ships
    // has to show them their day, with no migration step to run or forget.
    await saveDaySchedule(
      day({
        breakfast: { ...meal("Oats & berries", 420), isConsumed: true },
        lunch: meal("Jollof rice", 610),
      }),
    );
    expect(await getIntakeForDate(TODAY)).toHaveLength(0);

    const { schedule, totals } = await coldBoot();

    expect(ticked(schedule, "breakfast")).toBe(true);
    expect(totals.calories).toBe(420);
    // …and it was adopted, so the NEXT rewrite of the plan can't lose it either.
    expect(await getIntakeForDate(TODAY)).toHaveLength(1);
  });

  it("free-form logged food counts too, and survives the same relaunch", async () => {
    await saveDaySchedule(day({ breakfast: meal("Oats & berries", 420) }));
    await markMealConsumed(TODAY, "breakfast");
    await AsyncStorage.setItem(
      KEYS.FOOD_LOG,
      JSON.stringify({
        [TODAY]: [
          { totals: { calories: 105, protein: 1, carbs: 27, fat: 0 } },
          { totals: { calories: 95, protein: 0, carbs: 25, fat: 0 } },
        ],
      }),
    );

    const { totals } = await coldBoot();
    expect(totals.calories).toBe(620);
  });

  it("relaunching twice does not double-count", async () => {
    await saveDaySchedule(day({ breakfast: meal("Oats & berries", 420) }));
    await markMealConsumed(TODAY, "breakfast");

    await coldBoot();
    await coldBoot();
    const { totals } = await coldBoot();
    expect(totals.calories).toBe(420);
  });
});

// ─────────────────────── the paths that reach the same day ──────────────────

describe("every way a day can be served", () => {
  it("a WEEKLY schedule becomes a real, tickable, ledger-backed day", async () => {
    // A weekly day used to be handed to the screen straight out of
    // WEEK_SCHEDULES: it rendered, and every writer in ScheduleService looked
    // it up in SCHEDULED_DIETS, found nothing, and did nothing. The meal could
    // not be ticked and its calories could never reach the day.
    const week: WeekSchedule = {
      id: "w1",
      weekStart: TODAY,
      dietId: "mediterranean",
      dietName: "Mediterranean",
      days: {
        [getDayName(new Date())]: day({ breakfast: meal("Weekly oats", 500) }),
      } as WeekSchedule["days"],
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEYS.WEEK_SCHEDULES, JSON.stringify([week]));

    // The day has to be on screen before anyone can tap it, and that read is
    // what materialises it into the one store every writer speaks.
    const first = await getTodayDiet();
    expect(first.schedule?.breakfast?.name).toBe("Weekly oats");
    expect(first.source).toBe("weekly");

    expect(await markMealConsumed(TODAY, "breakfast")).toBe(true);

    const { schedule, totals } = await coldBoot();
    expect(ticked(schedule, "breakfast")).toBe(true);
    expect(totals.calories).toBe(500);
  });

  it("a materialised weekly day still calls itself a weekly plan", async () => {
    const week: WeekSchedule = {
      id: "w1",
      weekStart: TODAY,
      dietId: "mediterranean",
      dietName: "Mediterranean",
      days: {
        [getDayName(new Date())]: day({ breakfast: meal("Weekly oats", 500) }),
      } as WeekSchedule["days"],
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEYS.WEEK_SCHEDULES, JSON.stringify([week]));

    await getTodayDiet();
    // Second read takes the single-day branch — the label must not flip.
    expect((await getTodayDiet()).source).toBe("weekly");
  });

  it("a day closed by the overnight sweep still reports its intake", async () => {
    const yesterday = shift(-1);
    await saveDaySchedule({
      ...day({ breakfast: meal("Oats & berries", 420) }),
      date: yesterday,
    });
    await markMealConsumed(yesterday, "breakfast");
    await sweepClosedDays(TODAY);

    const records = await getIntakeForDate(yesterday);
    expect(intakeMacrosRaw(records).calories).toBe(420);
  });
});
