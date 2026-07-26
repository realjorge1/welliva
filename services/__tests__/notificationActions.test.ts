/**
 * Notification "Mark as Done" — the completion path that runs without the app.
 *
 * These lock the two properties the lock-screen action depends on, because
 * neither is observable in the UI: the write is IDEMPOTENT (a notification
 * response can be replayed on a cold start) and it is dated by the notification's
 * FIRE time, not by the clock when the button is finally pressed. Also covered:
 * linked habits can't be faked, subscribers only fire on a real change, and the
 * widget snapshot is patched in step.
 *
 * `expo-notifications` is mocked; AsyncStorage is the in-memory one from
 * vitest.setup, so storage round-trips for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", TIME_INTERVAL: "timeInterval" },
  AndroidImportance: { DEFAULT: 3 },
  requestPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  getPermissionsAsync: vi.fn(async () => ({ granted: true, canAskAgain: true })),
  scheduleNotificationAsync: vi.fn(async () => "id_1"),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationCategoryAsync: vi.fn(async () => undefined),
}));

import { EVERY_DAY, type Habit } from "../../models/habit";
import { loadLogs, saveHabits, saveLogs } from "../HabitService";
import {
  markHabitDoneFromNotification,
  subscribeHabitLogsChanged,
} from "../notifications/habitActions";
import { toLocalDateString } from "../OfflineStorage";
import { readWidgetSnapshot, writeWidgetSnapshot } from "../notifications/widgets";

const HABIT: Habit = {
  id: "h1",
  name: "Doomscrolling",
  icon: "phone-portrait",
  color: "#FF5D55",
  days: EVERY_DAY,
  source: "manual",
  reminder: { hour: 17, minute: 17 },
  order: 0,
  createdAt: "2026-01-01",
};

/** A notification that fired at 17:17 local, `daysAgo` days back. */
function firedAt(daysAgo: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(17, 17, 0, 0);
  return d.getTime();
}

const today = () => toLocalDateString(new Date());

beforeEach(async () => {
  await saveHabits([HABIT]);
  await saveLogs({});
  await writeWidgetSnapshot({ date: today(), completed: 0, total: 0, habits: [] });
});

describe("markHabitDoneFromNotification", () => {
  it("logs the habit on the date the notification fired", async () => {
    const result = await markHabitDoneFromNotification("h1", firedAt(0));

    expect(result).toMatchObject({ ok: true, habitName: "Doomscrolling", alreadyDone: false });
    expect((await loadLogs())["h1"]).toEqual([today()]);
  });

  it("dates the completion by the FIRE time, not by now", async () => {
    // Reminder fired yesterday evening; actioned now. It completes yesterday.
    const yesterday = toLocalDateString(new Date(firedAt(1)));

    const result = await markHabitDoneFromNotification("h1", firedAt(1));

    expect(result).toMatchObject({ ok: true, date: yesterday });
    expect((await loadLogs())["h1"]).toEqual([yesterday]);
  });

  it("is idempotent — a replayed response reports success without duplicating", async () => {
    await markHabitDoneFromNotification("h1", firedAt(0));
    const second = await markHabitDoneFromNotification("h1", firedAt(0));

    expect(second).toMatchObject({ ok: true, alreadyDone: true });
    expect((await loadLogs())["h1"]).toEqual([today()]);
  });

  it("reports the streak after the completion", async () => {
    const y1 = toLocalDateString(new Date(firedAt(1)));
    const y2 = toLocalDateString(new Date(firedAt(2)));
    await saveLogs({ h1: [y2, y1] });

    const result = await markHabitDoneFromNotification("h1", firedAt(0));

    expect(result).toMatchObject({ ok: true, streak: 3 });
  });

  it("refuses linked habits — a button must not fake logged data", async () => {
    await saveHabits([{ ...HABIT, source: "water" }]);

    const result = await markHabitDoneFromNotification("h1", firedAt(0));

    expect(result).toEqual({ ok: false, reason: "not-manual" });
    expect((await loadLogs())["h1"]).toBeUndefined();
  });

  it("reports not-found for a habit that has since been deleted", async () => {
    await saveHabits([]);
    await expect(markHabitDoneFromNotification("h1", firedAt(0))).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("falls back to now when the fire time is missing or bogus", async () => {
    const result = await markHabitDoneFromNotification("h1", Number.NaN);
    expect(result).toMatchObject({ ok: true, date: today() });
  });

  it("notifies subscribers once, and only on a real change", async () => {
    const seen = vi.fn();
    const unsubscribe = subscribeHabitLogsChanged(seen);

    await markHabitDoneFromNotification("h1", firedAt(0));
    expect(seen).toHaveBeenCalledTimes(1);

    // Replay: nothing changed, so nothing to reload.
    await markHabitDoneFromNotification("h1", firedAt(0));
    expect(seen).toHaveBeenCalledTimes(1);

    unsubscribe();
    await saveLogs({});
    await markHabitDoneFromNotification("h1", firedAt(0));
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("widget snapshot patching", () => {
  it("marks the row done and advances the progress counter", async () => {
    await writeWidgetSnapshot({
      date: today(),
      completed: 0,
      total: 1,
      habits: [
        {
          id: "h1",
          name: "Doomscrolling",
          icon: "phone-portrait",
          color: "#FF5D55",
          streak: 0,
          doneToday: false,
          scheduledToday: true,
        },
      ],
    });

    await markHabitDoneFromNotification("h1", firedAt(0));

    const snap = await readWidgetSnapshot();
    expect(snap).toMatchObject({ completed: 1, total: 1 });
    expect(snap?.habits[0]).toMatchObject({ doneToday: true, streak: 1 });
  });

  it("leaves a snapshot from another day alone", async () => {
    await writeWidgetSnapshot({
      date: "2020-01-01",
      completed: 0,
      total: 1,
      habits: [
        {
          id: "h1",
          name: "Doomscrolling",
          icon: "phone-portrait",
          color: "#FF5D55",
          streak: 0,
          doneToday: false,
          scheduledToday: true,
        },
      ],
    });

    await markHabitDoneFromNotification("h1", firedAt(0));

    const snap = await readWidgetSnapshot();
    expect(snap).toMatchObject({ date: "2020-01-01", completed: 0 });
    expect(snap?.habits[0].doneToday).toBe(false);
  });
});
