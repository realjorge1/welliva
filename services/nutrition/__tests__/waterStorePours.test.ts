/**
 * THE DRINKS LIST, THROUGH THE REAL WATER STORE.
 *
 * waterPours.test.ts pins the pure rules. What can only go wrong against storage
 * is the WIRING: that every path that moves the counter also leaves a drink, that
 * taking one back out lowers the counter by exactly that drink, and that none of
 * it can ever cost a glass of water. AsyncStorage is vitest.setup's in-memory
 * one, so every write round-trips through the store's own code.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { KEYS, readJSON, todayDate, writeJSON, writeString } from "../../OfflineStorage";
import {
  WATER_INBOX_KEY,
  WATER_POURS_KEY,
  addWaterToday,
  drainWaterInbox,
  logWaterFor,
  readWaterPours,
  readWaterToday,
  removeWaterPour,
  subscribeWaterPours,
} from "../waterStore";

const today = () => todayDate();

async function reset() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove([...keys]);
}

beforeEach(async () => {
  await reset();
  // The app is open today: the counter IS today's.
  await writeString(KEYS.LAST_ACTIVE_DATE, today());
});

describe("addWaterToday", () => {
  it("leaves a drink for every glass, with the amount and a time", async () => {
    await addWaterToday(250);
    const log = await readWaterPours();
    expect(log?.date).toBe(today());
    expect(log?.pours).toHaveLength(1);
    expect(log?.pours[0]).toMatchObject({ ml: 250 });
    expect(Number.isNaN(Date.parse(log!.pours[0].at))).toBe(false);
  });

  it("keeps the list and the counter in step across several drinks", async () => {
    await addWaterToday(250);
    await addWaterToday(500);
    await addWaterToday(150);
    const log = await readWaterPours();
    expect(log!.pours.map((p) => p.ml)).toEqual([250, 500, 150]);
    expect(await readWaterToday()).toBe(900);
  });

  it("records the amount that actually landed, not what was asked for", async () => {
    await addWaterToday(249.6);
    expect((await readWaterPours())!.pours[0].ml).toBe(250);
  });

  it("records nothing for an add that changed nothing", async () => {
    await addWaterToday(0);
    await addWaterToday(-100);
    await addWaterToday(Number.NaN);
    expect(await readWaterPours()).toBeNull();
    expect(await readWaterToday()).toBe(0);
  });

  it("gives every drink its own id, even two in the same instant", async () => {
    await Promise.all([addWaterToday(250), addWaterToday(250), addWaterToday(250)]);
    const ids = (await readWaterPours())!.pours.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(await readWaterToday()).toBe(750);
  });

  it("starts a fresh list on a new day instead of piling onto yesterday's", async () => {
    await writeJSON(WATER_POURS_KEY, {
      date: "2000-01-01",
      pours: [{ id: "old", ml: 1000, at: "2000-01-01T10:00:00.000Z" }],
    });
    await addWaterToday(250);
    const log = await readWaterPours();
    expect(log?.date).toBe(today());
    expect(log?.pours.map((p) => p.id)).not.toContain("old");
    expect(log?.pours).toHaveLength(1);
  });

  it("never lets a broken list cost a glass of water", async () => {
    await writeJSON(WATER_POURS_KEY, "this is not a log");
    const out = await addWaterToday(250);
    expect(out).toEqual({ prev: 0, next: 250 });
    expect(await readWaterToday()).toBe(250);
  });
});

describe("logWaterFor — the lock-screen button", () => {
  it("leaves a drink when the counter is holding that day", async () => {
    await logWaterFor(today(), 330);
    expect((await readWaterPours())!.pours[0].ml).toBe(330);
    expect(await readWaterToday()).toBe(330);
  });

  it("leaves NO drink when the glass is parked in the inbox for a day the counter isn't on", async () => {
    await writeString(KEYS.LAST_ACTIVE_DATE, "2000-01-01");
    await logWaterFor(today(), 330);
    expect(await readWaterPours()).toBeNull();
    expect(await readJSON(WATER_INBOX_KEY, [])).toHaveLength(1);
  });
});

describe("drainWaterInbox", () => {
  it("turns today's parked glasses into drinks, keeping the time they were PRESSED", async () => {
    await writeJSON(WATER_INBOX_KEY, [
      { date: today(), ml: 250, at: "2026-10-31T07:05:00.000Z" },
    ]);
    await drainWaterInbox(2500, today());
    const log = await readWaterPours();
    expect(log!.pours).toHaveLength(1);
    expect(log!.pours[0]).toMatchObject({ ml: 250, at: "2026-10-31T07:05:00.000Z" });
    expect(await readWaterToday()).toBe(250);
  });

  it("leaves a closed day's glass out of today's list", async () => {
    await writeJSON(WATER_INBOX_KEY, [{ date: "2000-01-01", ml: 330, at: "x" }]);
    await drainWaterInbox(2500, today());
    expect(await readWaterPours()).toBeNull();
  });
});

describe("removeWaterPour", () => {
  it("takes the drink out and lowers the counter by exactly that drink", async () => {
    await addWaterToday(250);
    await addWaterToday(500);
    const [first] = (await readWaterPours())!.pours;
    const out = await removeWaterPour(first.id);

    expect(out).toMatchObject({ prev: 750, next: 500 });
    expect(out.removed?.id).toBe(first.id);
    expect(await readWaterToday()).toBe(500);
    expect((await readWaterPours())!.pours.map((p) => p.ml)).toEqual([500]);
  });

  it("removes the one it was asked for, not the newest", async () => {
    await addWaterToday(250);
    await addWaterToday(500);
    await addWaterToday(150);
    const pours = (await readWaterPours())!.pours;
    await removeWaterPour(pours[1].id);
    expect((await readWaterPours())!.pours.map((p) => p.ml)).toEqual([250, 150]);
    expect(await readWaterToday()).toBe(400);
  });

  it("does nothing for a drink it has never heard of — and says so", async () => {
    await addWaterToday(250);
    const out = await removeWaterPour("nope");
    expect(out).toEqual({ prev: 250, next: 250, removed: null });
    expect(await readWaterToday()).toBe(250);
  });

  it("cannot take the same drink out twice", async () => {
    await addWaterToday(250);
    await addWaterToday(500);
    const [first] = (await readWaterPours())!.pours;
    await Promise.all([removeWaterPour(first.id), removeWaterPour(first.id)]);
    expect(await readWaterToday()).toBe(500);
  });

  it("never takes the counter below zero", async () => {
    await writeJSON(KEYS.WATER_TODAY, 100);
    await writeJSON(WATER_POURS_KEY, {
      date: today(),
      pours: [{ id: "big", ml: 500, at: "2026-10-31T08:00:00.000Z" }],
    });
    const out = await removeWaterPour("big");
    expect(out.next).toBe(0);
    expect(await readWaterToday()).toBe(0);
  });

  it("will not subtract another day's drink from today's counter", async () => {
    await writeJSON(KEYS.WATER_TODAY, 800);
    await writeJSON(WATER_POURS_KEY, {
      date: "2000-01-01",
      pours: [{ id: "yesterdays", ml: 500, at: "2000-01-01T08:00:00.000Z" }],
    });
    const out = await removeWaterPour("yesterdays");
    expect(out).toEqual({ prev: 800, next: 800, removed: null });
    expect(await readWaterToday()).toBe(800);
  });
});

describe("subscribeWaterPours", () => {
  it("announces the new list after a drink is added and after one is removed", async () => {
    const seen: number[] = [];
    const stop = subscribeWaterPours((log) => seen.push(log?.pours.length ?? -1));

    await addWaterToday(250);
    await addWaterToday(500);
    const [first] = (await readWaterPours())!.pours;
    await removeWaterPour(first.id);
    stop();

    expect(seen).toEqual([1, 2, 1]);
  });

  it("stops announcing once unsubscribed, and survives a listener that throws", async () => {
    let calls = 0;
    const stopBad = subscribeWaterPours(() => {
      throw new Error("boom");
    });
    const stopGood = subscribeWaterPours(() => {
      calls += 1;
    });

    await addWaterToday(250);
    expect(calls).toBe(1);
    expect(await readWaterToday()).toBe(250);

    stopBad();
    stopGood();
    await addWaterToday(250);
    expect(calls).toBe(1);
  });
});
