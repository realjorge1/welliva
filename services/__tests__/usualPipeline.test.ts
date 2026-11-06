/**
 * "Had my usual" — the meal reminder's second button, end to end through the
 * one response pipeline, and the reminder that carries it.
 *
 *   · logs the usual EXACTLY as recorded, once, however the press arrives
 *   · a press for a meal already holding the usual logs nothing more
 *   · a usual turned away after the reminder was laid is not logged
 *   · a meal reminder for a usual says so, and carries the snapshot
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
import type { ResolvedFoodItem } from "../../models/nutrients";
import { ACTION_LOG_USUAL, MEAL_USUAL_CATEGORY } from "../notifications/categories";
import { JOURNAL_KEY, readJournal } from "../notifications/journal";
import { saveMealReminders, syncMealReminders, DEFAULT_SETTINGS } from "../notifications/mealReminders";
import { HANDLED_KEY, processNotificationResponse } from "../notifications/pipeline";
import { getFoodLogForDate, type FoodLogEntry } from "../nutrition/foodLogStore";
import { KEYS, toLocalDateString, writeJSON, writeString } from "../OfflineStorage";
import { findUsuals, snapshotOf, type UsualSnapshot } from "../smart/usual";
import { USUALS_FORGOTTEN_KEY, forgetUsual } from "../smart/usualStore";
import { ACTIVE_USER_KEY } from "../sync/syncKeys";

const OWNER = "user-a";
const today = () => toLocalDateString(new Date());
const pad = (n: number) => String(n).padStart(2, "0");

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function item(foodId: string, grams: number, calories: number): ResolvedFoodItem {
  return {
    id: `i-${foodId}`,
    inputText: foodId,
    name: foodId,
    foodId,
    quantity: grams,
    unit: "g",
    grams,
    nutrients: { calories, proteinG: 5 } as ResolvedFoodItem["nutrients"],
    source: null,
    confidence: "verified" as ResolvedFoodItem["confidence"],
    matchScore: 1,
  };
}

let seq = 0;
function breakfast(date: string): FoodLogEntry[] {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(y, m - 1, d, 8, 10).toISOString();
  return [
    { id: `e${++seq}`, date, slot: "breakfast", label: "Oats with milk", items: [item("oats", 50, 190), item("milk", 200, 130)], totals: { calories: 320 } as FoodLogEntry["totals"], partialKeys: [], confidence: "verified" as FoodLogEntry["confidence"], origin: "catalog", loggedAt: at },
    { id: `e${++seq}`, date, slot: "breakfast", label: "coffee", items: [item("coffee", 240, 100)], totals: { calories: 100 } as FoodLogEntry["totals"], partialKeys: [], confidence: "verified" as FoodLogEntry["confidence"], origin: "catalog", loggedAt: at },
  ];
}

async function givenUsual(): Promise<UsualSnapshot> {
  const store = { [daysAgo(1)]: breakfast(daysAgo(1)), [daysAgo(2)]: breakfast(daysAgo(2)), [daysAgo(4)]: breakfast(daysAgo(4)) };
  await writeJSON(KEYS.FOOD_LOG, store);
  const [u] = findUsuals({ foodLog: store, intake: {}, forgotten: [], today: today() });
  return snapshotOf(u);
}

function press(snapshot: unknown, opts: { id?: string } = {}) {
  const fired = new Date();
  fired.setHours(7, 30, 0, 0);
  return {
    actionIdentifier: ACTION_LOG_USUAL,
    notification: {
      date: fired.getTime(),
      request: {
        identifier: opts.id ?? `welliva.meal.${today()}.breakfast`,
        content: {
          title: "Breakfast",
          body: "Your usual? Oats with milk, coffee",
          categoryIdentifier: MEAL_USUAL_CATEGORY,
          data: { type: "meal-reminder", slot: "breakfast", date: today(), usual: snapshot, uid: OWNER },
        },
        trigger: null,
      },
    },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  N.scheduleNotificationAsync.mockImplementation(async (req: { identifier?: string }) => req.identifier ?? "follow-up");
  N.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.dismissNotificationAsync.mockResolvedValue(undefined);
  N.setNotificationChannelAsync.mockResolvedValue(null);
  N.setNotificationCategoryAsync.mockResolvedValue(null);
  await AsyncStorage.setItem(ACTIVE_USER_KEY, OWNER);
  await AsyncStorage.multiRemove([HANDLED_KEY, JOURNAL_KEY, USUALS_FORGOTTEN_KEY]);
  await writeJSON(KEYS.FOOD_LOG, {});
  await writeJSON(KEYS.INTAKE_LEDGER, {});
  await writeJSON(KEYS.SCHEDULED_DIETS, []);
  await writeString(KEYS.LAST_ACTIVE_DATE, today());
});

describe("Had my usual", () => {
  it("logs the usual exactly as recorded, once, however many times it arrives", async () => {
    const snap = await givenUsual();
    const first = await processNotificationResponse(press(snap));
    const again = await processNotificationResponse(press(snap));
    expect(first).toMatchObject({ kind: "meal", ok: true, detail: "Logged as breakfast" });
    expect(again).toMatchObject({ kind: "ignored", reason: "duplicate" });

    const logged = await getFoodLogForDate(today());
    expect(logged.map((e) => e.label)).toEqual(["Oats with milk", "coffee"]);
    expect(logged.every((e) => e.slot === "breakfast")).toBe(true);
    expect(logged[0].items.map((i) => i.foodId)).toEqual(["oats", "milk"]);
    expect(logged[0].totals).toEqual({ calories: 320 });

    const [receipt] = await readJournal();
    expect(receipt).toMatchObject({ kind: "meal", ok: true, title: "Oats with milk, coffee" });
  });

  it("adds nothing when that meal already holds the usual", async () => {
    const snap = await givenUsual();
    await processNotificationResponse(press(snap, { id: "a" }));
    const second = await processNotificationResponse(press(snap, { id: "b" }));
    expect(second).toMatchObject({ ok: true, detail: "Already logged as breakfast" });
    expect(await getFoodLogForDate(today())).toHaveLength(2);
  });

  it("does not log a usual turned away after the reminder was laid", async () => {
    const snap = await givenUsual();
    await forgetUsual(snap.id, new Date(Date.parse(snap.madeAt) + 60_000));
    const out = await processNotificationResponse(press(snap));
    expect(out).toMatchObject({ kind: "meal", ok: false });
    expect(await getFoodLogForDate(today())).toEqual([]);
    // …and says so, with a way to log what was actually eaten.
    const followUp = N.scheduleNotificationAsync.mock.calls.at(-1)?.[0];
    expect(followUp?.content?.data?.route).toBe("/diet/log-food");
  });

  it("writes nothing for a malformed snapshot", async () => {
    const out = await processNotificationResponse(press({ id: "x" }));
    expect(out).toMatchObject({ kind: "meal", ok: false });
    expect(await getFoodLogForDate(today())).toEqual([]);
  });
});

describe("the meal reminder that carries it", () => {
  it("asks about the usual, with the button and the snapshot", async () => {
    await givenUsual();
    const settings = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      slots: { ...DEFAULT_SETTINGS.slots, breakfast: { enabled: true, hour: 23, minute: 59 } },
    };
    await saveMealReminders(settings);
    await syncMealReminders(settings);
    const laid = N.scheduleNotificationAsync.mock.calls.map((c) => c[0]);
    const todayOne = laid.find((r) => r.identifier === `welliva.meal.${today()}.breakfast`) ?? laid[0];
    expect(todayOne.content.categoryIdentifier).toBe(MEAL_USUAL_CATEGORY);
    expect(todayOne.content.body).toBe("Your usual? Oats with milk, coffee");
    expect(todayOne.content.data.usual.entries.map((e: { label: string }) => e.label)).toEqual(["Oats with milk", "coffee"]);
  });
});
