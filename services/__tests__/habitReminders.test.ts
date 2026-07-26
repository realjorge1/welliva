/**
 * HabitService reminder scheduling — the expo-notifications boundary.
 *
 * These lock the fail-soft contract the release build depends on: schedule the
 * right DAILY/WEEKLY triggers (on our reminders channel) when permission is
 * granted, cancel stale ids on every re-sync, and no-op cleanly on denial,
 * linked habits, or a thrown native call. `expo-notifications` is fully mocked
 * so the pure logic runs under Node.
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
  requestPermissionsAsync: N.requestPermissionsAsync,
  getPermissionsAsync: N.getPermissionsAsync,
  scheduleNotificationAsync: N.scheduleNotificationAsync,
  cancelScheduledNotificationAsync: N.cancelScheduledNotificationAsync,
  setNotificationChannelAsync: N.setNotificationChannelAsync,
  setNotificationCategoryAsync: N.setNotificationCategoryAsync,
}));

import { EVERY_DAY, type Habit } from "../../models/habit";
import { ensureReminderPermission, syncReminders } from "../HabitService";
import { HABIT_REMINDER_CATEGORY } from "../notifications/categories";
import { REMINDER_LINES } from "../notifications/copy";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Read",
    icon: "book",
    color: "#FFFFFF",
    days: EVERY_DAY,
    source: "manual",
    reminder: { hour: 8, minute: 0 },
    order: 0,
    createdAt: "2026-07-01",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  N.requestPermissionsAsync.mockResolvedValue({ status: "granted", granted: true });
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  let n = 0;
  N.scheduleNotificationAsync.mockImplementation(async () => `id_${++n}`);
  N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  N.setNotificationChannelAsync.mockResolvedValue(undefined);
  N.setNotificationCategoryAsync.mockResolvedValue(undefined);
});

describe("syncReminders", () => {
  it("schedules a single DAILY reminder on the reminders channel for an every-day habit", async () => {
    const ids = await syncReminders(makeHabit());

    expect(ids).toHaveLength(1);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = N.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.trigger.type).toBe("daily");
    expect(arg.trigger.channelId).toBe("reminders");
    expect(arg.trigger).toMatchObject({ hour: 8, minute: 0 });
    // channel is (re)created before scheduling
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      "reminders",
      expect.objectContaining({ name: "Reminders" }),
    );
  });

  it("schedules one WEEKLY reminder per scheduled day, mapped to expo weekdays", async () => {
    // 0=Mon, 2=Wed, 4=Fri  →  expo weekday 2, 4, 6
    const ids = await syncReminders(makeHabit({ days: [0, 2, 4] }));

    expect(ids).toHaveLength(3);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    const weekdays = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].trigger.weekday);
    expect(weekdays).toEqual([2, 4, 6]);
    for (const call of N.scheduleNotificationAsync.mock.calls) {
      expect(call[0].trigger.type).toBe("weekly");
      expect(call[0].trigger.channelId).toBe("reminders");
    }
  });

  it("maps Sunday (day 6) to expo weekday 1", async () => {
    await syncReminders(makeHabit({ days: [6] }));
    expect(N.scheduleNotificationAsync.mock.calls[0][0].trigger.weekday).toBe(1);
  });

  it("no-ops and schedules nothing when permission is denied", async () => {
    N.requestPermissionsAsync.mockResolvedValue({ status: "denied", granted: false });

    const ids = await syncReminders(makeHabit());

    expect(ids).toEqual([]);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("cancels previously scheduled ids before re-scheduling", async () => {
    await syncReminders(makeHabit({ reminderIds: ["stale-1", "stale-2"] }));

    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale-1");
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale-2");
    // and still schedules the fresh one
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("cancels stale ids but schedules nothing for a linked (non-manual) habit", async () => {
    const ids = await syncReminders(
      makeHabit({ source: "water", reminderIds: ["stale"] }),
    );

    expect(ids).toEqual([]);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale");
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels stale ids and returns [] when the reminder is turned off", async () => {
    const ids = await syncReminders(
      makeHabit({ reminder: null, reminderIds: ["stale"] }),
    );

    expect(ids).toEqual([]);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale");
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("carries the action category and habit id, so the banner gets its buttons", async () => {
    await syncReminders(makeHabit());

    const { content } = N.scheduleNotificationAsync.mock.calls[0][0];
    expect(content.categoryIdentifier).toBe(HABIT_REMINDER_CATEGORY);
    expect(content.data).toEqual({ type: "habit-reminder", habitId: "h1" });
    expect(content.title).toBe("Read");
    expect(REMINDER_LINES).toContain(content.body);
  });

  it("varies the nudge line across a weekly habit's days", async () => {
    await syncReminders(makeHabit({ days: [0, 2, 4] }));

    const bodies = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].content.body);
    expect(new Set(bodies).size).toBe(3);
  });

  it("fails soft to [] if a native call throws", async () => {
    N.scheduleNotificationAsync.mockRejectedValue(new Error("no native module"));
    await expect(syncReminders(makeHabit())).resolves.toEqual([]);
  });
});

describe("ensureReminderPermission", () => {
  it("returns true without prompting when already granted", async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    await expect(ensureReminderPermission()).resolves.toBe(true);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("returns false without prompting when permission can't be asked again", async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(ensureReminderPermission()).resolves.toBe(false);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("prompts and returns the grant when still undetermined", async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    N.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });

    await expect(ensureReminderPermission()).resolves.toBe(true);
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("fails soft to false when the native call throws", async () => {
    N.getPermissionsAsync.mockRejectedValue(new Error("no native module"));
    await expect(ensureReminderPermission()).resolves.toBe(false);
  });
});
