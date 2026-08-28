/**
 * FitnessNotifications — the expo-notifications boundary.
 *
 * These lock the contract a release build depends on: schedule the right
 * WEEKLY/DAILY triggers on the app's reminders channel, cancel only our own
 * ids on every re-sync, and — the part that used to be missing — report WHY
 * nothing was scheduled, so no UI can leave a toggle switched on behind a
 * reminder that will never arrive. `expo-notifications` is fully mocked so the
 * scheduling logic runs under Node.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const N = vi.hoisted(() => ({
  requestPermissionsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationCategoryAsync: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly" },
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  requestPermissionsAsync: N.requestPermissionsAsync,
  getPermissionsAsync: N.getPermissionsAsync,
  scheduleNotificationAsync: N.scheduleNotificationAsync,
  cancelScheduledNotificationAsync: N.cancelScheduledNotificationAsync,
  setNotificationChannelAsync: N.setNotificationChannelAsync,
  setNotificationCategoryAsync: N.setNotificationCategoryAsync,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FITNESS_PROFILE_KEY,
  createDefaultProfile,
  saveFitnessProfile,
} from "@/fitness/services/FitnessProfileStore";
import {
  cancelFitnessReminders,
  normalizeDays,
  normalizeHour,
  refreshFitnessReminders,
  requestNotificationPermission,
  syncFitnessReminders,
  toExpoWeekday,
} from "@/fitness/services/FitnessNotifications";
import type { FitnessProfile, ReminderPrefs } from "@/fitness/types";

function makeProfile(
  reminders: Partial<ReminderPrefs> = {},
  overrides: Partial<FitnessProfile> = {},
): FitnessProfile {
  const base = createDefaultProfile();
  return {
    ...base,
    ...overrides,
    reminders: { ...base.reminders, ...reminders },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await AsyncStorage.removeItem(FITNESS_PROFILE_KEY);
  await AsyncStorage.removeItem("@welliva_fitness_notification_ids");
  N.requestPermissionsAsync.mockResolvedValue({ status: "granted", granted: true });
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  let n = 0;
  N.scheduleNotificationAsync.mockImplementation(async () => `id_${++n}`);
  N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  N.setNotificationChannelAsync.mockResolvedValue(undefined);
});

describe("weekday mapping", () => {
  it("maps our Mon-first index onto expo's Sunday-first weekday", () => {
    expect(toExpoWeekday(0)).toBe(2); // Mon
    expect(toExpoWeekday(4)).toBe(6); // Fri
    expect(toExpoWeekday(5)).toBe(7); // Sat
    expect(toExpoWeekday(6)).toBe(1); // Sun
  });
});

describe("input normalisation", () => {
  it("drops junk day indices, de-dupes and orders", () => {
    expect(normalizeDays([4, 0, 4, -1, 7, 2.5, Number.NaN])).toEqual([0, 4]);
    expect(normalizeDays(undefined)).toEqual([]);
  });

  it("clamps a stored hour into a schedulable 0-23", () => {
    expect(normalizeHour(7)).toBe(7);
    expect(normalizeHour(-3)).toBe(0);
    expect(normalizeHour(99)).toBe(23);
    expect(normalizeHour(undefined)).toBe(17);
  });
});

describe("syncFitnessReminders", () => {
  it("schedules one WEEKLY workout reminder per training day, on the reminders channel", async () => {
    const result = await syncFitnessReminders(
      makeProfile({ workouts: true, hour: 7 }, { daysAvailable: [0, 2, 4] }),
    );

    expect(result).toEqual({ status: "ok", scheduled: 3 });
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    // The channel is (re)created before scheduling — Android drops anything
    // posted to a channel that doesn't exist.
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      "reminders",
      expect.objectContaining({ name: "Reminders" }),
    );
    for (const call of N.scheduleNotificationAsync.mock.calls) {
      expect(call[0].trigger.type).toBe("weekly");
      expect(call[0].trigger.channelId).toBe("reminders");
      expect(call[0].trigger.hour).toBe(7);
      // A tapped reminder must land somewhere specific.
      expect(call[0].content.data.route).toBe("/exercise");
    }
    expect(
      N.scheduleNotificationAsync.mock.calls.map((c: unknown[]) => (c[0] as any).trigger.weekday),
    ).toEqual([2, 4, 6]);
  });

  it("names the right day in each reminder body", async () => {
    await syncFitnessReminders(makeProfile({ workouts: true }, { daysAvailable: [6] }));
    expect(N.scheduleNotificationAsync.mock.calls[0][0].content.body).toContain("Sunday");
  });

  it("schedules the daily and weekly extras with their own triggers", async () => {
    const result = await syncFitnessReminders(
      makeProfile(
        { workouts: false, hydration: true, stretch: true, weeklySummary: true },
        { daysAvailable: [] },
      ),
    );

    expect(result).toEqual({ status: "ok", scheduled: 3 });
    const triggers = N.scheduleNotificationAsync.mock.calls.map((c: unknown[]) => (c[0] as any).trigger);
    expect(triggers[0]).toMatchObject({ type: "daily", hour: 12, minute: 30 });
    expect(triggers[1]).toMatchObject({ type: "daily", hour: 20, minute: 30 });
    expect(triggers[2]).toMatchObject({ type: "weekly", weekday: 1, hour: 18 });
    // The weekly wrap-up opens progress, not the dashboard.
    expect(N.scheduleNotificationAsync.mock.calls[2][0].content.data.route).toBe(
      "/fitness/progress",
    );
  });

  it("reports no-permission and schedules nothing when the OS refused", async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    const result = await syncFitnessReminders(makeProfile({ workouts: true }));

    expect(result).toEqual({ status: "no-permission", scheduled: 0 });
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("reports no-days when workouts are on but no day is picked", async () => {
    const result = await syncFitnessReminders(
      makeProfile({ workouts: true }, { daysAvailable: [] }),
    );

    expect(result).toEqual({ status: "no-days", scheduled: 0 });
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("is how reminders are turned OFF: cancels the previous schedule and reports off", async () => {
    await syncFitnessReminders(makeProfile({ workouts: true }, { daysAvailable: [0, 2] }));
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

    const result = await syncFitnessReminders(makeProfile({ workouts: false }));

    expect(result).toEqual({ status: "off", scheduled: 0 });
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("id_1");
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("id_2");
  });

  it("re-syncing cancels exactly its own previous ids, never more", async () => {
    await syncFitnessReminders(makeProfile({ workouts: true }, { daysAvailable: [0] }));
    N.cancelScheduledNotificationAsync.mockClear();

    await syncFitnessReminders(makeProfile({ workouts: true }, { daysAvailable: [1, 3] }));

    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("id_1");
  });

  it("reports failed — not off — when every native schedule call throws", async () => {
    N.scheduleNotificationAsync.mockRejectedValue(new Error("no native module"));

    const result = await syncFitnessReminders(
      makeProfile({ workouts: true }, { daysAvailable: [0] }),
    );

    expect(result).toEqual({ status: "failed", scheduled: 0 });
  });

  it("reports failed, not no-days, when a non-workout reminder was the one that failed", async () => {
    N.scheduleNotificationAsync.mockRejectedValue(new Error("no native module"));

    const result = await syncFitnessReminders(
      makeProfile({ workouts: true, hydration: true }, { daysAvailable: [] }),
    );

    expect(result).toEqual({ status: "failed", scheduled: 0 });
  });

  it("ignores junk day data rather than scheduling an invalid weekday", async () => {
    const result = await syncFitnessReminders(
      makeProfile({ workouts: true }, { daysAvailable: [0, 9, -2, 0] }),
    );

    expect(result).toEqual({ status: "ok", scheduled: 1 });
    expect(N.scheduleNotificationAsync.mock.calls[0][0].trigger.weekday).toBe(2);
  });
});

describe("refreshFitnessReminders (boot repair)", () => {
  it("re-derives the schedule from stored preferences", async () => {
    await saveFitnessProfile(
      makeProfile({ workouts: true, hour: 6 }, { daysAvailable: [1, 3] }),
    );

    const result = await refreshFitnessReminders();

    expect(result).toEqual({ status: "ok", scheduled: 2 });
    expect(N.scheduleNotificationAsync.mock.calls[0][0].trigger.hour).toBe(6);
  });

  it("is a no-op when nothing is switched on", async () => {
    await saveFitnessProfile(makeProfile());

    const result = await refreshFitnessReminders();

    expect(result).toEqual({ status: "off", scheduled: 0 });
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("permission + cleanup", () => {
  it("treats an iOS provisional grant as permission", async () => {
    N.requestPermissionsAsync.mockResolvedValue({ granted: false, ios: { status: 3 } });
    expect(await requestNotificationPermission()).toBe(true);
  });

  it("reads a thrown native call as denied rather than assuming success", async () => {
    N.requestPermissionsAsync.mockRejectedValue(new Error("unavailable"));
    expect(await requestNotificationPermission()).toBe(false);
  });

  it("cancelFitnessReminders clears the owned-id list so it never double-cancels", async () => {
    await syncFitnessReminders(makeProfile({ workouts: true }, { daysAvailable: [0, 2] }));
    await cancelFitnessReminders();
    N.cancelScheduledNotificationAsync.mockClear();

    await cancelFitnessReminders();

    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
