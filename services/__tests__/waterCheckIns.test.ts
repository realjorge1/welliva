/**
 * Smart reminders — the water check-ins that know what you've done, the meal
 * reminders that don't ask about a meal already eaten, and "Pause all".
 *
 * These lock the promises the Notifications screen makes in words:
 *
 *   · a check-in is skipped for 90 minutes after a logged glass, and none come
 *     once today's goal is met — tomorrow's are untouched by either;
 *   · today's wording names the time of the last glass ("had another since
 *     2:10 PM?") and never counts what's missing;
 *   · today's water is read from the same storage the app AND the lock-screen
 *     button write (counter, inbox, pour times);
 *   · paused means nothing is laid, by any module, and resuming changes no
 *     setting;
 *   · a meal ticked on the plan, or logged under that slot, is not asked about.
 *
 * `expo-notifications` is mocked; AsyncStorage is vitest.setup's in-memory one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const N = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  dismissNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationCategoryAsync: vi.fn(),
  deleteNotificationChannelAsync: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    WEEKLY: "weekly",
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  ...N,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DaySchedule, ScheduledMeal } from "../../models/diet";
import { KEYS, toLocalDateString } from "../OfflineStorage";
import {
  DEFAULT_SETTINGS as DEFAULT_MEAL_SETTINGS,
  alreadyEaten,
  syncMealReminders,
} from "../notifications/mealReminders";
import {
  NOTIFICATIONS_PAUSED_KEY,
  notificationsPaused,
  setNotificationsPaused,
  subscribeNotificationPause,
} from "../notifications/pause";
import {
  QUIET_AFTER_LOG_MINUTES,
  WATER_GOAL_CACHE_KEY,
  WATER_HORIZON_DAYS,
  WATER_REMINDER_IDS_KEY,
  loadWaterReminders,
  planWaterCheckIns,
  readWaterDayState,
  saveWaterReminders,
  syncWaterReminders,
  waterCheckInCopy,
  type WaterDayState,
  type WaterReminderSettings,
} from "../notifications/waterReminders";
import { WATER_INBOX_KEY, WATER_POURS_KEY } from "../nutrition/waterStore";

// 3 Nov 2026, 09:00 local — a Tuesday, well away from any DST change.
const NOW = new Date(2026, 10, 3, 9, 0, 0, 0);
const TODAY = toLocalDateString(NOW);
const at = (h: number, m = 0, dayOffset = 0) =>
  new Date(2026, 10, 3 + dayOffset, h, m, 0, 0);

const ON: WaterReminderSettings = { enabled: true, times: [600, 840, 1080], glassMl: 250 };

function state(over: Partial<WaterDayState> = {}): WaterDayState {
  return { date: TODAY, totalMl: 0, goalMl: 2500, lastLogAt: null, ...over };
}

beforeEach(async () => {
  for (const fn of Object.values(N)) fn.mockReset();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
  N.scheduleNotificationAsync.mockImplementation(async (req: { identifier?: string }) =>
    req.identifier ?? `auto-${Math.random()}`,
  );
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  N.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
  N.setNotificationChannelAsync.mockResolvedValue(undefined);
  N.setNotificationCategoryAsync.mockResolvedValue(undefined);
  N.deleteNotificationChannelAsync.mockResolvedValue(undefined);
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove([...keys]);
});

// ════════════════════════════════════════════════════════════════════
describe("planWaterCheckIns — the skip rules", () => {
  it("lays nothing when water reminders are off", () => {
    expect(planWaterCheckIns({ ...ON, enabled: false }, NOW, state())).toEqual([]);
    expect(planWaterCheckIns({ ...ON, times: [] }, NOW, state())).toEqual([]);
  });

  it("lays every chosen time across the horizon, dropping times already past", () => {
    const plan = planWaterCheckIns(ON, at(11, 0), state());
    // today: 14:00 and 18:00 (10:00 is past); then all three on each day ahead
    expect(plan).toHaveLength(2 + 3 * (WATER_HORIZON_DAYS - 1));
    expect(plan[0].when).toEqual(at(14, 0));
    expect(plan.every((p) => p.when.getTime() > at(11, 0).getTime())).toBe(true);
  });

  it("uses deterministic ids, so a re-lay replaces rather than duplicates", () => {
    const a = planWaterCheckIns(ON, NOW, state());
    const b = planWaterCheckIns(ON, NOW, state());
    expect(a.map((p) => p.identifier)).toEqual(b.map((p) => p.identifier));
    expect(a[0].identifier).toBe(`welliva.water.${TODAY}.600`);
  });

  it(`stays quiet for ${QUIET_AFTER_LOG_MINUTES} minutes after a glass — today only`, () => {
    // a glass at 9:40 → the 10:00 check-in is inside the window, 14:00 is not
    const plan = planWaterCheckIns(ON, at(9, 45), state({ totalMl: 250, lastLogAt: at(9, 40) }));
    const todays = plan.filter((p) => p.date === TODAY).map((p) => p.minutes);
    expect(todays).toEqual([840, 1080]);
    // tomorrow still has its 10:00
    const tomorrow = toLocalDateString(at(0, 0, 1));
    expect(plan.some((p) => p.date === tomorrow && p.minutes === 600)).toBe(true);
  });

  it("asks nothing more today once the goal is met, and keeps tomorrow", () => {
    const plan = planWaterCheckIns(ON, NOW, state({ totalMl: 2500, lastLogAt: at(8, 30) }));
    expect(plan.some((p) => p.date === TODAY)).toBe(false);
    expect(plan.length).toBe(3 * (WATER_HORIZON_DAYS - 1));
  });

  it("treats state for another day as unknown: plain wording, nothing skipped", () => {
    const stale = { ...state({ totalMl: 9999, lastLogAt: at(8, 50) }), date: "2026-11-02" };
    const plan = planWaterCheckIns(ON, NOW, stale);
    expect(plan.filter((p) => p.date === TODAY)).toHaveLength(3);
    expect(plan[0].body).not.toMatch(/since/);
  });

  it("names the last glass's time in today's check-ins, not in days ahead", () => {
    const plan = planWaterCheckIns(ON, at(11, 0), state({ totalMl: 500, lastLogAt: at(10, 5) }));
    const today = plan.find((p) => p.date === TODAY)!;
    expect(today.body).toContain("10:05 AM");
    const ahead = plan.find((p) => p.date !== TODAY)!;
    expect(ahead.body).not.toContain("10:05");
  });
});

// ════════════════════════════════════════════════════════════════════
describe("waterCheckInCopy — the wording", () => {
  const copy = (minutes: number, s: Partial<WaterDayState>, when = at(Math.floor(minutes / 60))) =>
    waterCheckInCopy({ minutes, date: TODAY, glassMl: 250, when, state: state(s) });

  it("with nothing logged yet, asks by time of day", () => {
    expect(copy(480, {}).title).toBe("Morning glass");
    expect(copy(780, {}).title).toBe("Water break");
    expect(copy(1080, {}).title).toBe("Hydration check");
  });

  it("one glass from the goal says so", () => {
    const c = copy(1080, { totalMl: 2300, lastLogAt: at(15, 10) });
    expect(c.title).toBe("One glass to go");
    expect(c.body).toContain("3:10 PM");
  });

  it("two glasses from the goal says so", () => {
    expect(copy(1080, { totalMl: 2000, lastLogAt: at(15, 10) }).title).toBe("Nearly there");
  });

  it("names the time of the last glass, whatever the gap", () => {
    for (const last of [at(13, 0), at(10, 30), at(7, 15)]) {
      expect(copy(840, { totalMl: 500, lastLogAt: last }).body).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    }
  });

  it("never scolds or counts what's missing", () => {
    const lines: string[] = [];
    for (const m of [480, 600, 780, 840, 1080, 1200]) {
      for (const s of [
        {},
        { totalMl: 250, lastLogAt: at(7, 0) },
        { totalMl: 1500, lastLogAt: at(9, 0) },
        { totalMl: 2300, lastLogAt: at(9, 0) },
      ]) {
        const c = copy(m, s);
        lines.push(c.title, c.body);
      }
    }
    for (const line of lines) {
      expect(line).not.toMatch(/behind|missed|haven't|only \d|should|must|forgot/i);
    }
  });

  it("is deterministic — the same day and time always read the same", () => {
    const s = { totalMl: 500, lastLogAt: at(11, 20) };
    expect(copy(840, s)).toEqual(copy(840, s));
  });
});

// ════════════════════════════════════════════════════════════════════
describe("readWaterDayState — from the stores the app and the button write", () => {
  it("adds today's counter, today's inbox, and takes the latest time", async () => {
    await AsyncStorage.setItem(KEYS.LAST_ACTIVE_DATE, TODAY);
    await AsyncStorage.setItem(KEYS.WATER_TODAY, JSON.stringify(500));
    await AsyncStorage.setItem(
      WATER_POURS_KEY,
      JSON.stringify({
        date: TODAY,
        pours: [
          { id: "a", ml: 250, at: at(7, 30).toISOString() },
          { id: "b", ml: 250, at: at(8, 15).toISOString() },
        ],
      }),
    );
    await AsyncStorage.setItem(
      WATER_INBOX_KEY,
      JSON.stringify([
        { date: TODAY, ml: 330, at: at(8, 40).toISOString() },
        { date: "2026-11-02", ml: 999, at: at(23, 0, -1).toISOString() },
      ]),
    );
    await AsyncStorage.setItem(WATER_GOAL_CACHE_KEY, JSON.stringify(2600));

    const s = await readWaterDayState(NOW);
    expect(s.totalMl).toBe(830);
    expect(s.goalMl).toBe(2600);
    expect(s.lastLogAt?.getTime()).toBe(at(8, 40).getTime());
  });

  it("ignores a counter still holding yesterday", async () => {
    await AsyncStorage.setItem(KEYS.LAST_ACTIVE_DATE, "2026-11-02");
    await AsyncStorage.setItem(KEYS.WATER_TODAY, JSON.stringify(1800));
    const s = await readWaterDayState(NOW);
    expect(s.totalMl).toBe(0);
    expect(s.lastLogAt).toBeNull();
    expect(s.goalMl).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe("syncWaterReminders — the OS queue", () => {
  it("lays dated check-ins carrying the glass button and the day they ask about", async () => {
    await saveWaterReminders(ON);
    const n = await syncWaterReminders(undefined, NOW);
    expect(n).toBe(3 * WATER_HORIZON_DAYS);
    const first = N.scheduleNotificationAsync.mock.calls[0][0];
    expect(first.trigger.type).toBe("date");
    expect(first.content.categoryIdentifier).toBe("welliva.water-reminder");
    expect(first.content.data).toMatchObject({ type: "water-reminder", ml: 250, date: TODAY });
  });

  it("sweeps its own leftovers, including the old repeating ids", async () => {
    await saveWaterReminders(ON);
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "welliva.water.600" },
      { identifier: "welliva.habit.h1.0" },
    ]);
    await syncWaterReminders(undefined, NOW);
    const cancelled = N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]);
    expect(cancelled).toContain("welliva.water.600");
    expect(cancelled).not.toContain("welliva.habit.h1.0");
  });

  it("lays nothing while paused, and keeps the settings", async () => {
    await saveWaterReminders(ON);
    await AsyncStorage.setItem(NOTIFICATIONS_PAUSED_KEY, JSON.stringify(true));
    expect(await syncWaterReminders(undefined, NOW)).toBe(0);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await loadWaterReminders()).toEqual(ON);
    expect(JSON.parse((await AsyncStorage.getItem(WATER_REMINDER_IDS_KEY)) ?? "[]")).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
describe("pause", () => {
  it("empties the queue now, persists, and tells listeners", async () => {
    const heard: boolean[] = [];
    const off = subscribeNotificationPause((p) => heard.push(p));
    await setNotificationsPaused(true);
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(await notificationsPaused()).toBe(true);
    await setNotificationsPaused(false);
    expect(await notificationsPaused()).toBe(false);
    // resuming cancels nothing
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(heard).toEqual([true, false]);
    off();
  });
});

// ════════════════════════════════════════════════════════════════════
describe("meal reminders — never about a meal already eaten", () => {
  const meal = (over: Partial<ScheduledMeal> = {}): ScheduledMeal => ({
    id: "m",
    mealType: "lunch",
    name: "Jollof rice",
    calories: { min: 500, max: 600 },
    proteinG: { min: 20, max: 30 },
    carbsG: { min: 60, max: 70 },
    fatG: { min: 10, max: 15 },
    isConsumed: false,
    ...over,
  });
  const day = (over: Partial<DaySchedule> = {}): DaySchedule => ({
    date: TODAY,
    dietId: "d",
    dietName: "Diet",
    breakfast: meal({ mealType: "breakfast", name: "Oats" }),
    lunch: meal(),
    dinner: meal({ mealType: "dinner", name: "Soup" }),
    snacks: [meal({ mealType: "snack", name: "Apple" })],
    status: "active",
    ...over,
  });

  it("knows a ticked plan meal, a food-log entry under the slot, and any snack", () => {
    const ticked = day({ lunch: meal({ isConsumed: true }) });
    expect(alreadyEaten(ticked, {}, TODAY, "lunch")).toBe(true);
    expect(alreadyEaten(ticked, {}, TODAY, "dinner")).toBe(false);
    expect(alreadyEaten(undefined, { [TODAY]: [{ slot: "dinner" }] }, TODAY, "dinner")).toBe(true);
    expect(alreadyEaten(undefined, { [TODAY]: [{ slot: null }] }, TODAY, "dinner")).toBe(false);
    expect(
      alreadyEaten(day({ snacks: [meal(), meal({ isConsumed: true })] }), {}, TODAY, "snack"),
    ).toBe(true);
  });

  it("drops today's reminder for a ticked meal and keeps the rest of the week", async () => {
    await AsyncStorage.setItem(
      KEYS.SCHEDULED_DIETS,
      JSON.stringify([{ date: TODAY, schedule: day({ lunch: meal({ isConsumed: true }) }) }]),
    );
    const settings = {
      enabled: true,
      slots: { ...DEFAULT_MEAL_SETTINGS.slots, lunch: { enabled: true, hour: 13, minute: 0 } },
    };
    await syncMealReminders(settings, NOW);
    const ids = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier as string);
    expect(ids).not.toContain(`welliva.meal.${TODAY}.lunch`);
    const tomorrow = toLocalDateString(at(0, 0, 1));
    expect(ids).toContain(`welliva.meal.${tomorrow}.lunch`);
  });

  it("lays nothing while paused", async () => {
    await AsyncStorage.setItem(NOTIFICATIONS_PAUSED_KEY, JSON.stringify(true));
    const settings = {
      enabled: true,
      slots: { ...DEFAULT_MEAL_SETTINGS.slots, lunch: { enabled: true, hour: 13, minute: 0 } },
    };
    expect(await syncMealReminders(settings, NOW)).toBe(0);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
