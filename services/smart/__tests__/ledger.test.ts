/**
 * The ledger — claims are synchronous (two screens can't both take the last
 * slot), answers persist with their cool-down, and Clear forgets both.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { clearGozlinMemory } from "../../gozlin/GozlinMemoryStore";
import { purgeAppData } from "../../sync/UserScope";
import { USUALS_FORGOTTEN_KEY, forgetUsual, loadForgottenUsuals } from "../usualStore";
import {
  SMART_ANSWERS_KEY,
  SMART_SHOWN_KEY,
  answerSmart,
  claimSmartSlot,
  clearSmartLedger,
  ensureSmartLedger,
  refreshSmartLedger,
  smartLedgerSnapshot,
} from "../ledger";
import type { SmartCandidate } from "../types";

const TODAY = "2026-11-20";
const a: SmartCandidate = { id: "usual:breakfast", feature: "usual", priority: 50 };
const b: SmartCandidate = { id: "hard-day:3", feature: "hard-day", priority: 60 };
const c: SmartCandidate = { id: "reminder-move:water", feature: "reminder-move", priority: 40 };

beforeEach(async () => {
  await AsyncStorage.multiRemove([SMART_SHOWN_KEY, SMART_ANSWERS_KEY]);
  await clearSmartLedger();
  await refreshSmartLedger();
});

describe("claimSmartSlot", () => {
  it("takes a slot, and taking it again is free", () => {
    expect(claimSmartSlot(a, "home", TODAY)).toBe(true);
    expect(claimSmartSlot(a, "home", TODAY)).toBe(true);
    expect(smartLedgerSnapshot().shown).toHaveLength(1);
  });

  it("refuses a second new moment on the same screen", () => {
    expect(claimSmartSlot(a, "diet", TODAY)).toBe(true);
    expect(claimSmartSlot(b, "diet", TODAY)).toBe(false);
  });

  it("refuses a third moment across the app", () => {
    expect(claimSmartSlot(a, "home", TODAY)).toBe(true);
    expect(claimSmartSlot(b, "fitness", TODAY)).toBe(true);
    expect(claimSmartSlot(c, "reminders", TODAY)).toBe(false);
  });

  it("persists the day's showings for the next launch", async () => {
    claimSmartSlot(a, "home", TODAY);
    await new Promise((r) => setTimeout(r, 0));
    await refreshSmartLedger();
    expect(smartLedgerSnapshot().shown.map((s) => s.id)).toEqual([a.id]);
  });
});

describe("answerSmart", () => {
  it("stores the answer with its cool-down, counting today", async () => {
    await answerSmart({
      id: c.id,
      feature: "reminder-move",
      answer: "declined",
      coolDownDays: 30,
      value: 1290,
      now: new Date(2026, 10, 20, 21, 0),
    });
    await refreshSmartLedger();
    const [saved] = smartLedgerSnapshot().answers;
    expect(saved).toMatchObject({ id: c.id, answer: "declined", until: "2026-12-19", value: 1290 });
  });

  it("keeps one answer per moment, the latest", async () => {
    await answerSmart({ id: c.id, feature: "reminder-move", answer: "declined", now: new Date(2026, 10, 1) });
    await answerSmart({ id: c.id, feature: "reminder-move", answer: "accepted", now: new Date(2026, 10, 2) });
    expect(smartLedgerSnapshot().answers).toHaveLength(1);
    expect(smartLedgerSnapshot().answers[0].answer).toBe("accepted");
  });
});

describe("clearSmartLedger", () => {
  it("forgets showings and answers", async () => {
    await ensureSmartLedger();
    claimSmartSlot(a, "home", TODAY);
    await answerSmart({ id: c.id, feature: "reminder-move", answer: "declined" });
    await clearSmartLedger();
    await refreshSmartLedger();
    expect(smartLedgerSnapshot().shown).toEqual([]);
    expect(smartLedgerSnapshot().answers).toEqual([]);
  });

  it("removes the records, so the deletion syncs instead of merging back", async () => {
    await answerSmart({ id: c.id, feature: "reminder-move", answer: "declined" });
    await clearSmartLedger();
    expect(await AsyncStorage.getItem(SMART_ANSWERS_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(SMART_SHOWN_KEY)).toBeNull();
  });
});

describe("erasing", () => {
  it("'Clear memory' takes the answers and the turned-away usuals with it", async () => {
    await answerSmart({ id: c.id, feature: "reminder-move", answer: "declined" });
    await forgetUsual("usual:breakfast:1");
    await clearGozlinMemory();
    expect(smartLedgerSnapshot().answers).toEqual([]);
    expect(await loadForgottenUsuals()).toEqual([]);
    expect(await AsyncStorage.getItem(USUALS_FORGOTTEN_KEY)).toBeNull();
  });

  it("wiping the device leaves no answers in memory to write back", async () => {
    await answerSmart({ id: c.id, feature: "reminder-move", answer: "declined" });
    await purgeAppData();
    expect(smartLedgerSnapshot().answers).toEqual([]);
    await answerSmart({ id: "next-owner", feature: "usual", answer: "dismissed" });
    const stored = JSON.parse((await AsyncStorage.getItem(SMART_ANSWERS_KEY)) ?? "[]");
    expect(stored.map((a: { id: string }) => a.id)).toEqual(["next-owner"]);
  });
});
