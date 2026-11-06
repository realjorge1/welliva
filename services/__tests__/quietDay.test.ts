/**
 * A rough day's silence: every reminder for the rest of TODAY, and only today.
 *
 *   · dated reminders (meals, water) skip today's and keep tomorrow's in place
 *   · repeating ones (habits) stand down, and come back with the next normal sync
 *   · taking the rough day back ("I'm OK actually") restores today's
 *
 * And its other promise about habits: a protected rough day can't be missed.
 *
 * `expo-notifications` is mocked; AsyncStorage is vitest.setup's in-memory one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const N = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  dismissNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationCategoryAsync: vi.fn(),
  deleteNotificationChannelAsync: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", DATE: "date", TIME_INTERVAL: "timeInterval" },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  ...N,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { EVERY_DAY, type Habit } from "../../models/habit";
import { buildHeatWeeks, computeStats, isDueToday, reconcileHabitReminders, syncReminders } from "../HabitService";
import { DEFAULT_SETTINGS, syncMealReminders } from "../notifications/mealReminders";
import { quietDate } from "../notifications/pause";
import { syncWaterReminders, type WaterReminderSettings } from "../notifications/waterReminders";
import { KEYS, toLocalDateString, writeJSON } from "../OfflineStorage";
import { ROUGH_DAYS_KEY, clearRoughDay, markRoughDay } from "../smart/roughDay";

const HABIT: Habit = {
  id: "h1",
  name: "Stretch",
  icon: "leaf",
  color: "#34C759",
  days: EVERY_DAY,
  source: "manual",
  reminder: { hour: 21, minute: 0 },
  order: 0,
  createdAt: "2026-01-01",
};

const today = () => toLocalDateString(new Date());
const laidIds = () => N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier as string);

const MEALS = {
  ...DEFAULT_SETTINGS,
  enabled: true,
  // Late enough to still be ahead today whenever the test runs.
  slots: { ...DEFAULT_SETTINGS.slots, dinner: { enabled: true, hour: 23, minute: 59 } },
};

const WATER: WaterReminderSettings = { enabled: true, times: [23 * 60 + 58], glassMl: 250 };

beforeEach(async () => {
  vi.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  N.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
  N.scheduleNotificationAsync.mockImplementation(async (req: { identifier?: string }) => req.identifier ?? "x");
  N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.setNotificationChannelAsync.mockResolvedValue(null);
  N.setNotificationCategoryAsync.mockResolvedValue(null);
  await AsyncStorage.multiRemove([ROUGH_DAYS_KEY]);
  await writeJSON(KEYS.FOOD_LOG, {});
  await writeJSON(KEYS.INTAKE_LEDGER, {});
  await writeJSON(KEYS.SCHEDULED_DIETS, []);
});

describe("quietDate", () => {
  it("is today on a rough day and nothing otherwise", async () => {
    expect(await quietDate()).toBeNull();
    await markRoughDay();
    expect(await quietDate()).toBe(today());
    await clearRoughDay();
    expect(await quietDate()).toBeNull();
  });
});

describe("dated reminders skip today and keep tomorrow", () => {
  it("meals", async () => {
    await markRoughDay();
    await syncMealReminders(MEALS);
    const ids = laidIds();
    expect(ids.some((id) => id.includes(today()))).toBe(false);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("meals come back when the rough day is taken back", async () => {
    await markRoughDay();
    await clearRoughDay();
    await syncMealReminders(MEALS);
    expect(laidIds().some((id) => id.includes(today()))).toBe(true);
  });

  it("water", async () => {
    await markRoughDay();
    await syncWaterReminders(WATER);
    const ids = laidIds();
    expect(ids.some((id) => id.includes(today()))).toBe(false);
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe("repeating reminders stand down until a normal day", () => {
  it("a habit's reminder isn't laid today, and is laid again after", async () => {
    await markRoughDay();
    expect(await syncReminders(HABIT, { prompt: false })).toEqual([]);
    await clearRoughDay();
    expect((await syncReminders(HABIT, { prompt: false })).length).toBe(1);
  });

  it("the repair cancels what's pending on a quiet day, and re-lays after it", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "welliva.habit.h1.0", content: { data: { type: "habit-reminder", habitId: "h1" } } },
    ]);
    await markRoughDay();
    await reconcileHabitReminders([{ ...HABIT, reminderIds: ["welliva.habit.h1.0"] }]);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("welliva.habit.h1.0");

    N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    await clearRoughDay();
    const repaired = await reconcileHabitReminders([{ ...HABIT, reminderIds: ["welliva.habit.h1.0"] }]);
    expect(repaired?.[0].reminderIds).toEqual(["welliva.habit.h1.0"]);
  });
});

describe("habits on a protected rough day", () => {
  const paused = new Set(["2026-11-04"]);
  const done = new Set(["2026-11-02", "2026-11-03", "2026-11-05"]);

  it("doesn't break the streak, and doesn't add to it", () => {
    const stats = computeStats(HABIT, done, "2026-11-05", paused);
    expect(stats.currentStreak).toBe(3);
    expect(computeStats(HABIT, done, "2026-11-05").currentStreak).toBe(1);
  });

  it("isn't due, unless it was done anyway", () => {
    expect(isDueToday(HABIT, new Set(), "2026-11-04", paused)).toBe(false);
    expect(isDueToday(HABIT, new Set(["2026-11-04"]), "2026-11-04", paused)).toBe(true);
  });

  it("counts when done anyway", () => {
    const all = new Set([...done, "2026-11-04"]);
    expect(computeStats(HABIT, all, "2026-11-05", paused).currentStreak).toBe(4);
  });

  it("paints no missed square", () => {
    const [week] = buildHeatWeeks(HABIT, done, "2026-11-08", 1, paused);
    const cell = week.find((c) => c.date === "2026-11-04");
    expect(cell).toMatchObject({ done: false, scheduled: false });
  });
});
