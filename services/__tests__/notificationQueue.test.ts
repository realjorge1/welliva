/**
 * Reading the OS queue, and leaving other people's notifications alone.
 *
 *   · nextFireOf — the "Up next" times are computed from the triggers the OS
 *     holds, in both platforms' shapes (Android daily/weekly/date; iOS calendar).
 *   · isProactive — turning Gozlin's coaching off used to empty the ENTIRE queue
 *     (every habit, meal and workout reminder with it). It now cancels only what
 *     the coaching scheduler owns.
 *   · reconcileHabitReminders — the boot repair: re-lay what went missing,
 *     cancel what nothing wants, touch nothing that's intact, never prompt.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const N = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationCategoryAsync: vi.fn(),
  deleteNotificationChannelAsync: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", DATE: "date" },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  ...N,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isProactive } from "../../health-os/notifications/ExpoNotificationAdapter";
import { EVERY_DAY, type Habit } from "../../models/habit";
import { habitReminderId, reconcileHabitReminders } from "../HabitService";
import { kindOf, nextFireOf, toQueued } from "../notifications/queue";
import { ACTIVE_USER_KEY } from "../sync/syncKeys";

// Tuesday 2026-09-01, 10:00 local.
const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

describe("nextFireOf", () => {
  it("reads an Android daily trigger — later today, or tomorrow once passed", () => {
    expect(nextFireOf({ type: "daily", hour: 13, minute: 0 }, NOW)).toEqual(
      new Date(2026, 8, 1, 13, 0),
    );
    expect(nextFireOf({ type: "daily", hour: 8, minute: 30 }, NOW)).toEqual(
      new Date(2026, 8, 2, 8, 30),
    );
  });

  it("reads an Android weekly trigger (1 = Sunday)", () => {
    // Next Friday (weekday 6) from Tuesday.
    expect(nextFireOf({ type: "weekly", weekday: 6, hour: 7, minute: 0 }, NOW)).toEqual(
      new Date(2026, 8, 4, 7, 0),
    );
  });

  it("reads an Android date trigger", () => {
    const at = new Date(2026, 8, 3, 19, 30).getTime();
    expect(nextFireOf({ type: "date", value: at }, NOW)?.getTime()).toBe(at);
  });

  it("reads iOS calendar triggers — dated, weekly and daily", () => {
    expect(
      nextFireOf(
        { type: "calendar", repeats: false, dateComponents: { year: 2026, month: 9, day: 3, hour: 19, minute: 30 } },
        NOW,
      ),
    ).toEqual(new Date(2026, 8, 3, 19, 30));
    expect(
      nextFireOf({ type: "calendar", repeats: true, dateComponents: { weekday: 1, hour: 18, minute: 0 } }, NOW),
    ).toEqual(new Date(2026, 8, 6, 18, 0));
    expect(
      nextFireOf({ type: "calendar", repeats: true, dateComponents: { hour: 21, minute: 0 } }, NOW),
    ).toEqual(new Date(2026, 8, 1, 21, 0));
  });

  it("admits it doesn't know for a relative trigger", () => {
    expect(nextFireOf({ type: "timeInterval", seconds: 1800 }, NOW)).toBeNull();
  });
});

describe("kindOf / toQueued", () => {
  it("sorts each owner's notifications into its kind", () => {
    expect(kindOf({ type: "habit-reminder" })).toBe("habit");
    expect(kindOf({ type: "meal-reminder" })).toBe("meal");
    expect(kindOf({ type: "water-reminder" })).toBe("water");
    expect(kindOf({ type: "fitness-reminder", kind: "hydration" })).toBe("water");
    expect(kindOf({ type: "fitness-reminder", kind: "workout" })).toBe("workout");
    expect(kindOf({ source: "proactive", route: "/x" })).toBe("coach");
  });

  it("marks the ones that carry a lock-screen button", () => {
    const q = toQueued(
      {
        identifier: "a",
        content: { title: "Lunch", categoryIdentifier: "welliva.meal-reminder", data: { type: "meal-reminder" } },
        trigger: { type: "daily", hour: 13, minute: 0 },
      },
      NOW,
    );
    expect(q).toMatchObject({ kind: "meal", actionable: true, repeats: true, title: "Lunch" });
  });
});

describe("isProactive — the coaching switch cancels only coaching", () => {
  it("claims tagged and legacy coaching notifications", () => {
    expect(isProactive("anything", { source: "proactive" })).toBe(true);
    expect(isProactive("briefing:2026-09-01", {})).toBe(true);
    expect(isProactive("ant:trip-1", { route: "/life" })).toBe(true);
    expect(isProactive("anniversary:1", undefined)).toBe(true);
  });

  it("never claims a reminder the user set", () => {
    expect(isProactive("welliva.habit.h1.0", { type: "habit-reminder", habitId: "h1" })).toBe(false);
    expect(isProactive("random-uuid", { type: "meal-reminder" })).toBe(false);
    expect(isProactive("random-uuid", { type: "fitness-reminder" })).toBe(false);
    expect(isProactive("random-uuid", {})).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Read",
  icon: "book",
  color: "#fff",
  days: EVERY_DAY,
  source: "manual",
  reminder: { hour: 8, minute: 0 },
  order: 0,
  createdAt: "2026-07-01",
  reminderIds: [habitReminderId("h1", 0)],
  ...over,
});

const pending = (id: string, habitId: string, uid?: string) => ({
  identifier: id,
  content: { data: { type: "habit-reminder", habitId, ...(uid ? { uid } : {}) } },
  trigger: { type: "daily", hour: 8, minute: 0 },
});

describe("reconcileHabitReminders", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    N.scheduleNotificationAsync.mockImplementation(async (req: { identifier: string }) => req.identifier);
    N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    await AsyncStorage.setItem(ACTIVE_USER_KEY, "user-a");
  });

  it("leaves an intact, stamped queue alone", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      pending(habitReminderId("h1", 0), "h1", "user-a"),
    ]);
    expect(await reconcileHabitReminders([habit()])).toBeNull();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("re-lays a reminder the OS lost — without prompting", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    const out = await reconcileHabitReminders([habit()]);
    expect(out?.[0].reminderIds).toEqual([habitReminderId("h1", 0)]);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync.mock.calls[0][0].content.data.uid).toBe("user-a");
  });

  it("cancels reminders still pending for a habit that is gone", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      pending(habitReminderId("h1", 0), "h1", "user-a"),
      pending("orphan", "deleted-habit", "user-a"),
    ]);
    await reconcileHabitReminders([habit()]);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("orphan");
  });

  it("re-lays an unstamped (pre-owner) reminder once so it carries the owner", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([pending(habitReminderId("h1", 0), "h1")]);
    expect(await reconcileHabitReminders([habit()])).not.toBeNull();
  });

  it("does nothing without permission", async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await reconcileHabitReminders([habit()])).toBeNull();
    expect(N.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});
