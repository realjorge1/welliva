/**
 * The streak's WRITE side — what makes a day count, and the two rules added
 * 2026-10-15: a loaded streak is the live one, and only today can be credited.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      removeItem: async (k: string) => void mem.delete(k),
      __reset: () => mem.clear(),
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeExternalWrites } from "../notifications/externalWrites";
import {
  creditCommitment,
  loadStreakData,
  onCommitmentKept,
  recordActivity,
} from "../StreakService";

const reset = () => (AsyncStorage as unknown as { __reset: () => void }).__reset();

/** Local noon on a date, so "today" is that date in any timezone. */
function setToday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  vi.setSystemTime(new Date(y, m - 1, d, 12, 0, 0));
}

beforeEach(() => {
  reset();
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recordActivity", () => {
  it("starts a run, extends it day by day, and keeps the dated ledger", async () => {
    setToday("2026-10-12");
    let r = await recordActivity("2026-10-12");
    expect(r.data.currentStreak).toBe(1);

    setToday("2026-10-13");
    r = await recordActivity("2026-10-13");
    expect(r.data.currentStreak).toBe(2);
    expect(r.data.longestStreak).toBe(2);
    expect(r.data.totalActiveDays).toBe(2);
    expect(r.data.days).toEqual(["2026-10-12", "2026-10-13"]);
    // The legacy week flags are derived from the ledger now: Mon + Tue.
    expect(r.data.weekActivity).toEqual([true, true, false, false, false, false, false]);
  });

  it("counts a day once, however many things are logged in it", async () => {
    setToday("2026-10-12");
    await recordActivity("2026-10-12");
    await recordActivity("2026-10-12");
    const r = await recordActivity("2026-10-12");
    expect(r.data.currentStreak).toBe(1);
    expect(r.data.totalActiveDays).toBe(1);
  });

  it("ignores a back-dated credit instead of rewinding a live run", async () => {
    // The old bug: ticking yesterday's meal today handed recordActivity a
    // past date, it saw a "gap", and a live 3-day run became 1.
    for (const d of ["2026-10-10", "2026-10-11", "2026-10-12"]) {
      setToday(d);
      await recordActivity(d);
    }
    const r = await recordActivity("2026-10-11");
    expect(r.data.currentStreak).toBe(3);
    expect(r.data.lastActiveDate).toBe("2026-10-12");
  });
});

describe("loadStreakData — the live run", () => {
  it("reads a lapsed run as 0 instead of the number it froze at", async () => {
    for (const d of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]) {
      setToday(d);
      await recordActivity(d);
    }
    setToday("2026-10-06");
    expect((await loadStreakData()).currentStreak).toBe(5); // today still open
    setToday("2026-10-09");
    const lapsed = await loadStreakData();
    expect(lapsed.currentStreak).toBe(0);
    expect(lapsed.longestStreak).toBe(5); // the record stands

    // …and the next kept day starts again at 1.
    const r = await recordActivity("2026-10-09");
    expect(r.data.currentStreak).toBe(1);
  });

  it("re-derives the week, so last week's ticks never sit in this one", async () => {
    // A record written by the old code: weekActivity from LAST week, never
    // reset because the app wasn't opened on a Monday.
    await AsyncStorage.setItem(
      "@welliva_streak_data",
      JSON.stringify({
        currentStreak: 2,
        longestStreak: 2,
        lastActiveDate: "2026-10-09",
        totalActiveDays: 2,
        badges: [],
        weekActivity: [false, false, false, true, true, false, false],
      }),
    );
    setToday("2026-10-14"); // the following Wednesday
    const data = await loadStreakData();
    expect(data.weekActivity).toEqual([false, false, false, false, false, false, false]);
    expect(data.currentStreak).toBe(0);
  });
});

describe("the moment a day is kept", () => {
  it("announces once per day, from the write itself", async () => {
    const seen: string[] = [];
    const off = onCommitmentKept((d) => seen.push(d.lastActiveDate));
    setToday("2026-10-12");
    await recordActivity("2026-10-12");
    await recordActivity("2026-10-12");
    setToday("2026-10-13");
    await recordActivity("2026-10-13");
    off();
    expect(seen).toEqual(["2026-10-12", "2026-10-13"]);
  });

  it("does not announce a record that is merely loaded", async () => {
    setToday("2026-10-12");
    await recordActivity("2026-10-12");
    const seen: string[] = [];
    const off = onCommitmentKept((d) => seen.push(d.lastActiveDate));
    await loadStreakData();
    off();
    expect(seen).toEqual([]);
  });

  it("creditCommitment tells the app about a day kept elsewhere — once", async () => {
    const writes: string[] = [];
    const off = subscribeExternalWrites((w) => writes.push(`${w.kind}:${w.date}`));
    setToday("2026-10-12");
    await creditCommitment("2026-10-12");
    await creditCommitment("2026-10-12");
    await creditCommitment("2026-10-11"); // not today: ignored
    off();
    expect(writes).toEqual(["streak:2026-10-12"]);
    expect((await loadStreakData()).currentStreak).toBe(1);
  });
});
