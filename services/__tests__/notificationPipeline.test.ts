/**
 * The notification response pipeline — every lock-screen press goes through it.
 *
 * These lock the guarantees that are invisible in the UI and fatal when broken:
 *
 *   · EXACTLY ONCE across the three doors a press arrives by (live listener,
 *     cold-start replay, Android background task) — including the raw task
 *     payload whose data is still a JSON string.
 *   · DATED BY FIRE TIME on both platforms — iOS reports SECONDS, Android ms.
 *   · OWNED — a reminder from another account (or a signed-out device) writes
 *     nothing and is cancelled.
 *   · HONEST — a press that can't be counted answers with a follow-up that says
 *     so and links to finish it; every press lands in the lock-screen journal.
 *   · WATER ON THE RIGHT DAY — straight to the counter only when the counter is
 *     holding that day; otherwise the inbox, folded in after the rollover.
 *
 * `expo-notifications` is mocked; AsyncStorage is vitest.setup's in-memory one,
 * so every write round-trips through real storage code.
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
import { EVERY_DAY, type Habit } from "../../models/habit";
import type { DaySchedule, ScheduledMeal } from "../../models/diet";
import { loadLogs, saveHabits, saveLogs, updateLogs } from "../HabitService";
import { markMealConsumedOnce } from "../ScheduleService";
import {
  ACTION_LOG_MEAL,
  ACTION_LOG_WATER,
  ACTION_MARK_DONE,
  ACTION_SNOOZE,
  MEAL_REMINDER_CATEGORY,
  MEAL_SNOOZE_MINUTES,
} from "../notifications/categories";
import { subscribeExternalWrites } from "../notifications/externalWrites";
import { fireDateOf, fireTimeMs } from "../notifications/fireTime";
import { JOURNAL_KEY, readJournal } from "../notifications/journal";
import {
  DEFAULT_ACTION,
  HANDLED_KEY,
  normalizeResponse,
  processNotificationResponse,
  subscribeRouteIntents,
} from "../notifications/pipeline";
import { getIntakeForDate } from "../nutrition/IntakeLedger";
import {
  WATER_INBOX_KEY,
  drainWaterInbox,
  readWaterToday,
} from "../nutrition/waterStore";
import { KEYS, readJSON, toLocalDateString, writeJSON, writeString } from "../OfflineStorage";
import { ACTIVE_USER_KEY } from "../sync/syncKeys";

const OWNER = "user-a";

const HABIT: Habit = {
  id: "h1",
  name: "Meditate",
  icon: "leaf",
  color: "#34C759",
  days: EVERY_DAY,
  source: "manual",
  reminder: { hour: 7, minute: 0 },
  order: 0,
  createdAt: "2026-01-01",
};

const today = () => toLocalDateString(new Date());

/** A fire time `daysAgo` back at 19:00 local, in epoch MILLISECONDS. */
function firedMs(daysAgo = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(19, 0, 0, 0);
  return d.getTime();
}

/** A response as expo's listener hands it over (mapped: data is an object). */
function mapped(
  action: string,
  data: Record<string, unknown>,
  opts: { id?: string; date?: number; title?: string; category?: string } = {},
) {
  return {
    actionIdentifier: action,
    notification: {
      date: opts.date ?? firedMs(),
      request: {
        identifier: opts.id ?? "req-1",
        content: {
          title: opts.title ?? "Meditate",
          body: "A small step keeps the ember burning.",
          categoryIdentifier: opts.category ?? null,
          data,
        },
        trigger: null,
      },
    },
  };
}

/** The same response as the Android background task receives it (raw bundle). */
function rawTask(action: string, data: Record<string, unknown>, opts: { id?: string; date?: number } = {}) {
  return {
    actionIdentifier: action,
    notification: {
      date: opts.date ?? firedMs(),
      request: {
        identifier: opts.id ?? "req-1",
        content: {
          title: "Meditate",
          body: "A small step keeps the ember burning.",
          dataString: JSON.stringify(data),
        },
        trigger: { type: "daily", hour: 7, minute: 0 },
      },
    },
  };
}

function meal(name: string, over: Partial<ScheduledMeal> = {}): ScheduledMeal {
  return {
    id: `m_${name}`,
    mealType: "lunch",
    name,
    calories: { min: 500, max: 500 },
    proteinG: { min: 30, max: 30 },
    carbsG: { min: 50, max: 50 },
    fatG: { min: 15, max: 15 },
    isConsumed: false,
    ...over,
  };
}

async function givenPlan(date: string, over: Partial<DaySchedule> = {}) {
  const schedule: DaySchedule = {
    date,
    dietId: "d1",
    dietName: "Balanced",
    breakfast: null,
    lunch: meal("Grilled chicken salad"),
    dinner: null,
    snacks: [],
    status: "active",
    ...over,
  };
  await writeJSON(KEYS.SCHEDULED_DIETS, [{ date, dietId: "d1", schedule }]);
}

beforeEach(async () => {
  vi.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  N.scheduleNotificationAsync.mockResolvedValue("follow-up");
  N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.dismissNotificationAsync.mockResolvedValue(undefined);
  N.setNotificationChannelAsync.mockResolvedValue(null);
  N.setNotificationCategoryAsync.mockResolvedValue(null);

  await AsyncStorage.setItem(ACTIVE_USER_KEY, OWNER);
  await AsyncStorage.removeItem(HANDLED_KEY);
  await AsyncStorage.removeItem(JOURNAL_KEY);
  await AsyncStorage.removeItem(WATER_INBOX_KEY);
  await saveHabits([HABIT]);
  await saveLogs({});
  await writeJSON(KEYS.INTAKE_LEDGER, {});
  await writeJSON(KEYS.SCHEDULED_DIETS, []);
  await writeJSON(KEYS.WATER_TODAY, 0);
  await writeJSON(KEYS.WATER_HISTORY, []);
  await writeString(KEYS.LAST_ACTIVE_DATE, today());
});

// ════════════════════════════════════════════════════════════════════

describe("fireTime — one unit on both platforms", () => {
  it("reads iOS seconds and Android milliseconds as the same instant", () => {
    const ms = firedMs();
    expect(fireTimeMs(ms)).toBe(ms);
    expect(fireTimeMs(ms / 1000)).toBe(ms);
  });

  it("never lands an iOS fire time in 1970", () => {
    // The bug this module exists for: `new Date(seconds)` is January 1970.
    expect(fireDateOf(firedMs() / 1000).getFullYear()).toBe(new Date().getFullYear());
  });

  it("falls back to now for an unusable value", () => {
    expect(fireTimeMs(undefined)).toBeNull();
    expect(fireTimeMs("nope")).toBeNull();
    expect(Math.abs(fireDateOf(null).getTime() - Date.now())).toBeLessThan(5000);
  });
});

describe("normalizeResponse", () => {
  it("reads the listener's mapped response", () => {
    const n = normalizeResponse(mapped(ACTION_MARK_DONE, { habitId: "h1" }))!;
    expect(n.data).toEqual({ habitId: "h1" });
    expect(n.identifier).toBe("req-1");
  });

  it("reads the Android task's raw bundle, where data is still a JSON string", () => {
    const n = normalizeResponse(rawTask(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER }))!;
    expect(n.data).toEqual({ habitId: "h1", uid: OWNER });
  });

  it("keys both shapes of one press identically", () => {
    const a = normalizeResponse(mapped(ACTION_MARK_DONE, { habitId: "h1" }))!;
    const b = normalizeResponse(rawTask(ACTION_MARK_DONE, { habitId: "h1" }))!;
    expect(a.key).toBe(b.key);
  });

  it("ignores a non-response task payload (an incoming push)", () => {
    expect(normalizeResponse({ notification: null, data: { dataString: "{}" } })).toBeNull();
    expect(normalizeResponse(null)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════

describe("Mark as Done", () => {
  it("completes the habit once, even when the press arrives by two doors", async () => {
    // Android with the app backgrounded: the task AND the listener both fire.
    const [first, second] = await Promise.all([
      processNotificationResponse(rawTask(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER }), "task"),
      processNotificationResponse(mapped(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER }), "listener"),
    ]);

    expect(first).toMatchObject({ kind: "habit", ok: true });
    expect(second).toMatchObject({ kind: "ignored", reason: "duplicate" });
    expect((await loadLogs())["h1"]).toEqual([today()]);
    expect(await readJournal()).toHaveLength(1);
  });

  it("is not re-applied by the cold-start replay of the same press", async () => {
    const press = mapped(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER });
    await processNotificationResponse(press, "listener");
    const replay = await processNotificationResponse(press, "cold");
    expect(replay).toMatchObject({ kind: "ignored", reason: "duplicate" });
  });

  it("dates an iOS press (seconds) by the day it fired, not 1970", async () => {
    await processNotificationResponse(
      mapped(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER }, { date: firedMs(1) / 1000 }),
    );
    const yesterday = toLocalDateString(new Date(firedMs(1)));
    expect((await loadLogs())["h1"]).toEqual([yesterday]);
  });

  it("announces the write so a live screen re-reads it", async () => {
    const seen: string[] = [];
    const off = subscribeExternalWrites((w) => seen.push(w.kind));
    await processNotificationResponse(mapped(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER }));
    off();
    expect(seen).toContain("habit");
  });

  it("dismisses the banner it answered", async () => {
    await processNotificationResponse(mapped(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER }, { id: "req-9" }));
    expect(N.dismissNotificationAsync).toHaveBeenCalledWith("req-9");
  });

  it("switches off a reminder for a habit that no longer exists", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "gone-0", content: { data: { type: "habit-reminder", habitId: "gone" } } },
      { identifier: "h1-0", content: { data: { type: "habit-reminder", habitId: "h1" } } },
    ]);
    const out = await processNotificationResponse(
      mapped(ACTION_MARK_DONE, { habitId: "gone", uid: OWNER }),
    );
    expect(out).toMatchObject({ kind: "habit", ok: false });
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("gone-0");
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("h1-0");
  });
});

describe("the owner guard", () => {
  it("never writes another account's reminder, and cancels it", async () => {
    const out = await processNotificationResponse(
      mapped(ACTION_MARK_DONE, { habitId: "h1", uid: "user-b" }, { id: "stale" }),
    );
    expect(out).toMatchObject({ kind: "ignored", reason: "not-owner" });
    expect((await loadLogs())["h1"]).toBeUndefined();
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale");
  });

  it("never writes on a signed-out, purged device", async () => {
    await AsyncStorage.removeItem(ACTIVE_USER_KEY);
    const out = await processNotificationResponse(mapped(ACTION_MARK_DONE, { habitId: "h1" }));
    expect(out).toMatchObject({ kind: "ignored", reason: "not-owner" });
    expect((await loadLogs())["h1"]).toBeUndefined();
  });

  it("still honours a pre-stamp reminder while the device has an owner", async () => {
    const out = await processNotificationResponse(mapped(ACTION_MARK_DONE, { habitId: "h1" }));
    expect(out).toMatchObject({ kind: "habit", ok: true });
  });
});

// ════════════════════════════════════════════════════════════════════

describe("Ate it", () => {
  it("ticks the planned meal and writes exactly one intake record", async () => {
    await givenPlan(today());
    const press = mapped(ACTION_LOG_MEAL, { slot: "lunch", uid: OWNER });
    await processNotificationResponse(press, "listener");
    await processNotificationResponse({ ...press }, "cold");

    const ledger = await getIntakeForDate(today());
    expect(ledger).toHaveLength(1);
    expect((await readJournal())[0]).toMatchObject({
      kind: "meal",
      ok: true,
      title: "Grilled chicken salad",
    });
  });

  it("answers a press on an unplanned slot with a link to log it", async () => {
    await givenPlan(today(), { lunch: null });
    const out = await processNotificationResponse(mapped(ACTION_LOG_MEAL, { slot: "lunch", uid: OWNER }));

    expect(out).toMatchObject({ kind: "meal", ok: false });
    const followUp = N.scheduleNotificationAsync.mock.calls.at(-1)![0];
    expect(followUp.content.data.route).toBe("/diet/log-food");
    expect((await readJournal())[0]).toMatchObject({ ok: false });
    expect(await getIntakeForDate(today())).toHaveLength(0);
  });
});

describe("markMealConsumedOnce", () => {
  it("records one meal when two deliveries race", async () => {
    // The check and the tick share the schedule lock: the second sees the first.
    await givenPlan(today());
    const [a, b] = await Promise.all([
      markMealConsumedOnce(today(), "lunch"),
      markMealConsumedOnce(today(), "lunch"),
    ]);
    expect([a.status, b.status].sort()).toEqual(["already", "logged"]);
    expect(await getIntakeForDate(today())).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════

describe("Drank a glass", () => {
  it("adds the glass to today's counter when the counter is today's", async () => {
    await processNotificationResponse(mapped(ACTION_LOG_WATER, { ml: 330, uid: OWNER }));
    expect(await readWaterToday()).toBe(330);
    expect((await readJournal())[0]).toMatchObject({ kind: "water", detail: "+330 ml" });
  });

  it("adds one glass for one press, however many times it is delivered", async () => {
    // Water has no identity to dedupe on — two glasses ARE two glasses — so the
    // handled-key ledger is the only thing standing between a replay and 500 ml.
    const press = mapped(ACTION_LOG_WATER, { ml: 250, uid: OWNER });
    await processNotificationResponse(press, "listener");
    await processNotificationResponse(rawTask(ACTION_LOG_WATER, { ml: 250, uid: OWNER }), "task");
    expect(await readWaterToday()).toBe(250);
  });

  it("parks a glass for a day the counter isn't holding, instead of handing it to yesterday", async () => {
    // The app last opened yesterday: WATER_TODAY is still yesterday's water.
    const yesterday = toLocalDateString(new Date(firedMs(1)));
    await writeString(KEYS.LAST_ACTIVE_DATE, yesterday);
    await writeJSON(KEYS.WATER_TODAY, 1200);

    await processNotificationResponse(mapped(ACTION_LOG_WATER, { ml: 250, uid: OWNER }));

    expect(await readWaterToday()).toBe(1200); // yesterday's counter untouched
    const inbox = await readJSON<{ date: string; ml: number }[]>(WATER_INBOX_KEY, []);
    expect(inbox).toEqual([expect.objectContaining({ date: today(), ml: 250 })]);
  });
});

describe("drainWaterInbox", () => {
  it("waits until the rollover has made the counter today's", async () => {
    const yesterday = toLocalDateString(new Date(firedMs(1)));
    await writeString(KEYS.LAST_ACTIVE_DATE, yesterday);
    await writeJSON(WATER_INBOX_KEY, [{ date: today(), ml: 250, at: "" }]);

    expect((await drainWaterInbox(2500)).applied).toBe(0);
    expect(await readJSON(WATER_INBOX_KEY, [])).toHaveLength(1);
  });

  it("folds today's glasses into the counter and a closed day's into its history", async () => {
    const yesterday = toLocalDateString(new Date(firedMs(1)));
    await writeJSON(KEYS.WATER_TODAY, 500);
    await writeJSON(KEYS.WATER_HISTORY, [{ date: yesterday, ml: 1000, goalMl: 2500 }]);
    await writeJSON(WATER_INBOX_KEY, [
      { date: today(), ml: 250, at: "" },
      { date: yesterday, ml: 330, at: "" },
      { date: "2999-01-01", ml: 250, at: "" },
    ]);

    const out = await drainWaterInbox(2500);

    expect(out).toMatchObject({ prev: 500, next: 750, applied: 2 });
    const history = await readJSON<{ date: string; ml: number }[]>(KEYS.WATER_HISTORY, []);
    expect(history.find((h) => h.date === yesterday)?.ml).toBe(1330);
    // A future-dated entry (clock skew) is kept, not applied.
    expect(await readJSON(WATER_INBOX_KEY, [])).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════

describe("taps, tests and snoozes", () => {
  it("holds a tap's route until the app subscribes, then delivers it once", async () => {
    await processNotificationResponse(
      mapped(DEFAULT_ACTION, { route: "/(tabs)/diet" }, { id: "tap-1" }),
    );
    const routes: string[] = [];
    const off = subscribeRouteIntents((r) => routes.push(r));
    off();
    expect(routes).toEqual(["/(tabs)/diet"]);
  });

  it("answers a test press with a confirmation and writes nothing", async () => {
    const out = await processNotificationResponse(
      mapped(ACTION_LOG_WATER, { test: true }, { id: "demo" }),
    );
    expect(out).toEqual({ kind: "test" });
    expect(await readWaterToday()).toBe(0);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1); // the confirmation
  });

  it("stamps the day a snoozed reminder is for, so a post-midnight press logs there", async () => {
    // An iOS press (seconds) on a habit reminder that fired yesterday evening.
    await processNotificationResponse(
      mapped(ACTION_SNOOZE, { type: "habit-reminder", habitId: "h1", uid: OWNER }, {
        date: firedMs(1) / 1000,
      }),
    );
    const snoozed = N.scheduleNotificationAsync.mock.calls[0][0];
    const yesterday = toLocalDateString(new Date(firedMs(1)));
    expect(snoozed.content.data.forDate).toBe(yesterday);

    // The snoozed copy fires TODAY; its button still completes yesterday.
    await processNotificationResponse(
      mapped(ACTION_MARK_DONE, snoozed.content.data, { id: "snoozed-1", date: firedMs(0) }),
    );
    expect((await loadLogs())["h1"]).toEqual([yesterday]);
  });

  it("dates a meal press by the day the reminder names", async () => {
    const yesterday = toLocalDateString(new Date(firedMs(1)));
    await givenPlan(yesterday);
    const out = await processNotificationResponse(
      mapped(ACTION_LOG_MEAL, { slot: "lunch", date: yesterday, uid: OWNER }, { date: firedMs(0) }),
    );
    expect(out).toMatchObject({ kind: "meal", ok: true });
    expect(await getIntakeForDate(yesterday)).toHaveLength(1);
  });

  it("snoozes a meal reminder on its own category, at the meal delay", async () => {
    await processNotificationResponse(
      mapped(ACTION_SNOOZE, { type: "meal-reminder", slot: "lunch", uid: OWNER }, {
        category: MEAL_REMINDER_CATEGORY,
        title: "Lunch",
      }),
    );
    const req = N.scheduleNotificationAsync.mock.calls[0][0];
    expect(req.content.categoryIdentifier).toBe(MEAL_REMINDER_CATEGORY);
    expect(req.trigger.seconds).toBe(MEAL_SNOOZE_MINUTES * 60);
    expect(req.content.data).toMatchObject({ slot: "lunch", snoozed: true });
  });
});

// ════════════════════════════════════════════════════════════════════

describe("updateLogs — two writers, no lost completions", () => {
  it("keeps a lock-screen completion that lands while the app toggles another habit", async () => {
    await saveHabits([HABIT, { ...HABIT, id: "h2", name: "Read" }]);
    await Promise.all([
      processNotificationResponse(mapped(ACTION_MARK_DONE, { habitId: "h1", uid: OWNER })),
      updateLogs((logs) => ({ ...logs, h2: [today()] })),
    ]);
    const logs = await loadLogs();
    expect(logs.h1).toEqual([today()]);
    expect(logs.h2).toEqual([today()]);
  });
});
