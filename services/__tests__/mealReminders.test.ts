/**
 * TAP-TO-LOG MEAL REMINDERS — the rolling window, and the write it triggers.
 *
 * Two things here can hurt a real user, and neither is visible in the UI:
 *
 *   THE WINDOW  — meal reminders are individually-dated notifications, not a
 *                 repeating trigger, so the queue drains as they fire and has
 *                 to be topped up. A re-sync that APPENDED instead of replacing
 *                 would double the user's notifications on every app open; one
 *                 that cancelled everything would silently delete their habit
 *                 reminders, which live in the same OS queue.
 *
 *   THE WRITE   — "Ate it" appends to the intake ledger, which is append-only
 *                 and is where every calorie figure in the app comes from. A
 *                 notification response is replayed on cold start, so applying
 *                 it twice has to mean the same as applying it once — otherwise
 *                 a locked phone can quietly add a second dinner.
 *
 * `expo-notifications` is mocked; AsyncStorage is the in-memory one from
 * vitest.setup, so the schedule and the ledger round-trip for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const N = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, status: "granted" })),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationCategoryAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    WEEKLY: "weekly",
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: N.getPermissionsAsync,
  requestPermissionsAsync: N.requestPermissionsAsync,
  scheduleNotificationAsync: N.scheduleNotificationAsync,
  cancelScheduledNotificationAsync: N.cancelScheduledNotificationAsync,
  setNotificationChannelAsync: N.setNotificationChannelAsync,
  setNotificationCategoryAsync: N.setNotificationCategoryAsync,
}));

import type { DaySchedule, ScheduledMeal } from "../../models/diet";
import { MEAL_REMINDER_CATEGORY } from "../notifications/categories";
import { dayIndexOf, mealBody, mealTitle } from "../notifications/copy";
import { logMealFromNotification } from "../notifications/mealActions";
import {
  DEFAULT_SETTINGS,
  HORIZON_DAYS,
  MEAL_REMINDER_IDS_KEY,
  anyEnabled,
  formatTime,
  loadMealReminders,
  plannedReminders,
  saveMealReminders,
  syncMealReminders,
  type MealReminderSettings,
} from "../notifications/mealReminders";
import { getIntakeForDate } from "../nutrition/IntakeLedger";
import { KEYS, toLocalDateString, writeJSON } from "../OfflineStorage";

function settings(over: Partial<MealReminderSettings["slots"]> = {}): MealReminderSettings {
  return {
    enabled: true,
    slots: {
      ...DEFAULT_SETTINGS.slots,
      breakfast: { enabled: true, hour: 8, minute: 30 },
      lunch: { enabled: true, hour: 13, minute: 0 },
      ...over,
    },
  };
}

const AT = (h: number, m = 0) => {
  const d = new Date("2026-09-01T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
};

beforeEach(async () => {
  N.scheduleNotificationAsync.mockReset();
  let n = 0;
  N.scheduleNotificationAsync.mockImplementation(async () => `id_${++n}`);
  N.cancelScheduledNotificationAsync.mockClear();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  await saveMealReminders(DEFAULT_SETTINGS);
  await writeJSON(MEAL_REMINDER_IDS_KEY, []);
  await writeJSON(KEYS.INTAKE_LEDGER, {});
  await writeJSON(KEYS.SCHEDULED_DIETS, []);
});

// ════════════════════════════════════════════════════════════════════

describe("plannedReminders", () => {
  it("lays down one reminder per enabled slot per day of the horizon", () => {
    // 6am: nothing today has passed yet, so it is a full window.
    const plans = plannedReminders(settings(), AT(6));
    expect(plans).toHaveLength(HORIZON_DAYS * 2);
  });

  it("skips a time that has already gone by today", () => {
    // 3pm — breakfast and lunch are both behind us, so today contributes none.
    const plans = plannedReminders(settings(), AT(15));
    expect(plans).toHaveLength((HORIZON_DAYS - 1) * 2);
    expect(plans.every((p) => p.date !== "2026-09-01")).toBe(true);
  });

  it("schedules nothing while the master switch is off", () => {
    expect(plannedReminders({ ...settings(), enabled: false }, AT(6))).toEqual([]);
  });

  it("schedules nothing when every slot is off", () => {
    const off: MealReminderSettings = {
      enabled: true,
      slots: DEFAULT_SETTINGS.slots,
    };
    expect(anyEnabled(off)).toBe(false);
    expect(plannedReminders(off, AT(6))).toEqual([]);
  });

  it("fires at the exact local time the user chose", () => {
    const [first] = plannedReminders(
      settings({ lunch: { enabled: false, hour: 13, minute: 0 } }),
      AT(6),
    );
    expect(first.when.getHours()).toBe(8);
    expect(first.when.getMinutes()).toBe(30);
    expect(first.date).toBe("2026-09-01");
  });
});

// ════════════════════════════════════════════════════════════════════

describe("syncMealReminders", () => {
  it("cancels exactly what it scheduled last time, and nothing else", async () => {
    await syncMealReminders(settings(), AT(6));
    const first = N.scheduleNotificationAsync.mock.calls.length;
    expect(first).toBeGreaterThan(0);

    N.scheduleNotificationAsync.mockClear();
    await syncMealReminders(settings(), AT(6));

    // Its own previous ids, one cancel each — never a blanket cancel-all, which
    // would take every habit reminder in the app with it.
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(first);
    expect(N.scheduleNotificationAsync.mock.calls.length).toBe(first);
  });

  it("converges rather than accumulating across repeated syncs", async () => {
    const a = await syncMealReminders(settings(), AT(6));
    const b = await syncMealReminders(settings(), AT(6));
    const c = await syncMealReminders(settings(), AT(6));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("carries the meal category, so the banner arrives with its button", async () => {
    await syncMealReminders(settings(), AT(6));
    const [{ content }] = N.scheduleNotificationAsync.mock.calls[0];
    expect(content.categoryIdentifier).toBe(MEAL_REMINDER_CATEGORY);
    expect(content.data.type).toBe("meal-reminder");
    expect(["breakfast", "lunch"]).toContain(content.data.slot);
  });

  it("names the real meal in the body when the plan for that day exists", async () => {
    // The point of a dated window over a repeating trigger: "Grilled chicken
    // salad — had it?" is answerable from a locked screen, "Lunch" is not.
    await writeJSON(KEYS.SCHEDULED_DIETS, [
      {
        date: "2026-09-01",
        dietId: "d1",
        schedule: {
          date: "2026-09-01",
          dietId: "d1",
          dietName: "Balanced",
          breakfast: null,
          lunch: {
            id: "m1",
            mealType: "lunch",
            name: "Grilled chicken salad",
            calories: { min: 500, max: 500 },
            proteinG: { min: 30, max: 30 },
            carbsG: { min: 50, max: 50 },
            fatG: { min: 15, max: 15 },
            isConsumed: false,
          },
          dinner: null,
          snacks: [],
          status: "active",
        },
      },
    ]);

    await syncMealReminders(settings(), AT(6));
    const bodies = N.scheduleNotificationAsync.mock.calls.map(
      ([req]) => req.content.body as string,
    );
    expect(bodies.some((b) => b.includes("Grilled chicken salad"))).toBe(true);
    // Days with no plan yet fall back to the slot line rather than inventing one.
    expect(bodies.some((b) => !b.includes("Grilled chicken salad"))).toBe(true);
  });

  it("schedules nothing without permission, and clears what was there", async () => {
    await syncMealReminders(settings(), AT(6));
    N.scheduleNotificationAsync.mockClear();
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true } as never);

    expect(await syncMealReminders(settings(), AT(6))).toBe(0);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("turning the feature off leaves an empty queue", async () => {
    await syncMealReminders(settings(), AT(6));
    const scheduled = N.scheduleNotificationAsync.mock.calls.length;
    N.scheduleNotificationAsync.mockClear();

    expect(await syncMealReminders({ ...settings(), enabled: false }, AT(6))).toBe(0);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(scheduled);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("survives a thrown native call rather than breaking app open", async () => {
    N.scheduleNotificationAsync.mockRejectedValueOnce(new Error("no native module"));
    await expect(syncMealReminders(settings(), AT(6))).resolves.toBe(0);
  });

  it("round-trips the user's chosen times", async () => {
    const chosen = settings({ dinner: { enabled: true, hour: 20, minute: 30 } });
    await saveMealReminders(chosen);
    const loaded = await loadMealReminders();
    expect(loaded.slots.dinner).toEqual({ enabled: true, hour: 20, minute: 30 });
    expect(formatTime(20, 30)).toBe("8:30 PM");
    expect(formatTime(8, 5)).toBe("8:05 AM");
    expect(formatTime(0, 0)).toBe("12:00 AM");
  });
});

// ════════════════════════════════════════════════════════════════════

describe("the copy", () => {
  it("gives a different line on consecutive days", () => {
    const bodies = new Set<string>();
    const titles = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      const date = `2026-09-0${d}`;
      bodies.add(mealBody("lunch", date));
      titles.add(mealTitle("lunch", date));
    }
    // Seven days, seven distinct lines — a thrice-daily notification that reads
    // the same every time stops being read.
    expect(bodies.size).toBe(7);
    expect(titles.size).toBe(7);
  });

  it("gives different lines to two slots on the same day", () => {
    expect(mealBody("breakfast", "2026-09-01")).not.toBe(mealBody("lunch", "2026-09-01"));
  });

  it("is stable for a given day, so a re-sync never rewrites a pending banner", () => {
    expect(mealBody("dinner", "2026-09-04")).toBe(mealBody("dinner", "2026-09-04"));
    expect(dayIndexOf("2026-09-02") - dayIndexOf("2026-09-01")).toBe(1);
  });

  it("names the meal when the plan knows it", () => {
    const named = mealBody("lunch", "2026-09-01", "Grilled chicken salad");
    expect(named).toContain("Grilled chicken salad");
  });

  it("never scolds or counts", () => {
    const banned = /haven't|didn't|missed|behind|calorie|failed|should have/i;
    for (const slot of ["breakfast", "lunch", "dinner", "snack"] as const) {
      for (let d = 1; d <= 28; d++) {
        const date = `2026-09-${String(d).padStart(2, "0")}`;
        expect(mealBody(slot, date)).not.toMatch(banned);
        expect(mealBody(slot, date, "Oats")).not.toMatch(banned);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════

describe("logMealFromNotification", () => {
  const meal = (name: string): ScheduledMeal => ({
    id: `m_${name}`,
    mealType: "lunch",
    name,
    calories: { min: 500, max: 500 },
    proteinG: { min: 30, max: 30 },
    carbsG: { min: 50, max: 50 },
    fatG: { min: 15, max: 15 },
    isConsumed: false,
  });

  const today = () => toLocalDateString(new Date());

  async function givenPlan(over: Partial<DaySchedule> = {}) {
    const schedule: DaySchedule = {
      date: today(),
      dietId: "d1",
      dietName: "Balanced",
      breakfast: null,
      lunch: meal("Grilled chicken salad"),
      dinner: null,
      snacks: [],
      status: "active",
      ...over,
    };
    await writeJSON(KEYS.SCHEDULED_DIETS, [
      { date: today(), dietId: "d1", schedule },
    ]);
  }

  it("ticks the meal and writes one intake record", async () => {
    await givenPlan();
    const result = await logMealFromNotification("lunch", Date.now());

    expect(result).toMatchObject({ ok: true, alreadyLogged: false, slot: "lunch" });
    const ledger = await getIntakeForDate(today());
    expect(ledger).toHaveLength(1);
    expect(ledger[0].name).toBe("Grilled chicken salad");
  });

  it("is idempotent — a replayed response must not add a second meal", async () => {
    // The cold-start replay. `markMealConsumed` has no guard of its own; without
    // the check in mealActions this is where the day gains a phantom 500 kcal.
    await givenPlan();
    const first = await logMealFromNotification("lunch", Date.now());
    const second = await logMealFromNotification("lunch", Date.now());

    expect(first).toMatchObject({ ok: true, alreadyLogged: false });
    expect(second).toMatchObject({ ok: true, alreadyLogged: true });
    expect(await getIntakeForDate(today())).toHaveLength(1);
  });

  it("logs the day the reminder was FOR, not the day it was pressed", async () => {
    // Fired at 7pm, pressed at 00:20. The ledger is where every calorie figure
    // comes from; a late tap landing on tomorrow makes two days wrong.
    const fired = new Date();
    fired.setHours(19, 0, 0, 0);
    await givenPlan();

    const result = await logMealFromNotification("lunch", fired.getTime());
    expect(result).toMatchObject({ ok: true, date: toLocalDateString(fired) });
  });

  it("refuses when the day has no plan, rather than inventing one", async () => {
    await writeJSON(KEYS.SCHEDULED_DIETS, []);
    expect(await logMealFromNotification("lunch", Date.now())).toEqual({
      ok: false,
      reason: "no-plan",
    });
  });

  it("refuses when the slot is empty", async () => {
    await givenPlan();
    expect(await logMealFromNotification("dinner", Date.now())).toEqual({
      ok: false,
      reason: "no-meal",
    });
    expect(await getIntakeForDate(today())).toHaveLength(0);
  });
});
