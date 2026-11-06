/**
 * The rough day — today only, five a month that protect the streak, "I'm OK
 * actually" as a tombstone — and the PAUSE it puts on the streak: a protected
 * rough day neither adds to the run nor breaks it, and a kept day beats it.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commitmentStatus, liveStreak, keptOn, pausedOn, readCommitment, runReaches } from "../../commitment";
import { loadStreakData, recordActivity } from "../../StreakService";
import {
  ROUGH_DAYS_KEY,
  ROUGH_DAYS_PER_MONTH,
  canProtect,
  clearRoughDay,
  loadRoughDays,
  markRoughDay,
  pausedDates,
  protectedThisMonth,
  roughDayOn,
  wasMarkedIll,
  withRoughDay,
  type RoughDay,
} from "../roughDay";

const STREAK_KEY = "@welliva_streak_data";

/** Put the clock at local noon on y-m-d. */
function at(y: number, m: number, d: number): Date {
  const t = new Date(y, m - 1, d, 12, 0, 0);
  vi.setSystemTime(t);
  return t;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await AsyncStorage.multiRemove([ROUGH_DAYS_KEY, STREAK_KEY]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("marking a rough day", () => {
  it("marks today, with an optional reason, protected", async () => {
    const now = at(2026, 11, 3);
    await markRoughDay("ill", now);
    const list = await loadRoughDays();
    expect(roughDayOn(list, "2026-11-03")).toMatchObject({ reason: "ill", protected: true });
    expect(wasMarkedIll(list, "2026-11-03")).toBe(true);
    expect(wasMarkedIll(list, "2026-11-02")).toBe(false);
  });

  it("never needs a reason", async () => {
    const now = at(2026, 11, 3);
    await markRoughDay(undefined, now);
    const day = roughDayOn(await loadRoughDays(), "2026-11-03")!;
    expect(day.reason).toBeUndefined();
    expect(wasMarkedIll(await loadRoughDays(), "2026-11-03")).toBe(false);
  });

  it("protects five a month, then makes the day gentle without the protection", () => {
    let list: RoughDay[] = [];
    for (let d = 1; d <= ROUGH_DAYS_PER_MONTH + 1; d++) {
      list = withRoughDay(list, { date: `2026-11-0${d}`, now: new Date(2026, 10, d, 9) });
    }
    expect(protectedThisMonth(list, "2026-11-06")).toBe(ROUGH_DAYS_PER_MONTH);
    expect(roughDayOn(list, "2026-11-06")?.protected).toBe(false);
    expect(canProtect(list, "2026-11-07")).toBe(false);
    // A new month starts the count again.
    expect(canProtect(list, "2026-12-01")).toBe(true);
  });

  it("takes it back as a tombstone", async () => {
    const now = at(2026, 11, 3);
    await markRoughDay("exhausted", now);
    await clearRoughDay(new Date(2026, 10, 3, 15));
    const list = await loadRoughDays();
    expect(roughDayOn(list, "2026-11-03")).toBeNull();
    expect(list.find((r) => r.date === "2026-11-03")?.deleted).toBe(true);
    expect(pausedDates(list)).toEqual([]);
  });
});

describe("the streak, paused", () => {
  it("reaches today across a paused yesterday — and not across a plain gap", () => {
    expect(runReaches("2026-11-01", "2026-11-03", ["2026-11-02"])).toBe(true);
    expect(runReaches("2026-11-01", "2026-11-03", [])).toBe(false);
    expect(runReaches("2026-11-02", "2026-11-03", [])).toBe(true);
    expect(liveStreak({ currentStreak: 4, lastActiveDate: "2026-11-01", paused: ["2026-11-02"] }, "2026-11-03")).toBe(4);
    expect(liveStreak({ currentStreak: 4, lastActiveDate: "2026-11-01" }, "2026-11-03")).toBe(0);
  });

  it("a paused day adds nothing: kept, rough, kept is a run of two", async () => {
    at(2026, 11, 1);
    await recordActivity("2026-11-01");
    const mon = at(2026, 11, 2);
    await markRoughDay(undefined, mon);
    at(2026, 11, 3);
    const { data } = await recordActivity("2026-11-03");
    expect(data.currentStreak).toBe(2);
    expect(data.days).toEqual(["2026-11-01", "2026-11-03"]);
  });

  it("a rough day past the cap does not pause — the gap ends the run", async () => {
    at(2026, 11, 7);
    await recordActivity("2026-11-07");
    // Five protected rough days already this month.
    let list: RoughDay[] = [];
    for (let d = 1; d <= ROUGH_DAYS_PER_MONTH; d++) {
      list = withRoughDay(list, { date: `2026-11-0${d}`, now: new Date(2026, 10, d, 9) });
    }
    await AsyncStorage.setItem(ROUGH_DAYS_KEY, JSON.stringify(list));
    const tue = at(2026, 11, 8);
    await markRoughDay(undefined, tue);
    expect(roughDayOn(await loadRoughDays(), "2026-11-08")?.protected).toBe(false);
    at(2026, 11, 9);
    const { data } = await recordActivity("2026-11-09");
    expect(data.currentStreak).toBe(1);
  });

  it("is not at risk on its own day, and says so plainly", async () => {
    at(2026, 11, 2);
    await recordActivity("2026-11-02");
    const tue = at(2026, 11, 3);
    await markRoughDay("bad-news", tue);
    const data = await loadStreakData();
    const state = readCommitment(data, "2026-11-03");
    expect(state.streak).toBe(1);
    expect(state.pausedToday).toBe(true);
    expect(state.atRisk).toBe(false);
    expect(state.week.find((d) => d.date === "2026-11-03")?.paused).toBe(true);
    expect(commitmentStatus(state)).toBe("A gentle day. Your 1-day streak is paused, not broken.");
  });

  it("a kept day beats a rough day", async () => {
    const mon = at(2026, 11, 2);
    await markRoughDay(undefined, mon);
    await recordActivity("2026-11-02");
    const data = await loadStreakData();
    expect(keptOn(data, ["2026-11-02"])).toEqual([true]);
    expect(pausedOn(data, ["2026-11-02"])).toEqual([false]);
    expect(readCommitment(data, "2026-11-02").pausedToday).toBe(false);
  });

  it("never stores the paused days on the streak record", async () => {
    const mon = at(2026, 11, 2);
    await markRoughDay(undefined, mon);
    at(2026, 11, 3);
    await recordActivity("2026-11-03");
    const raw = JSON.parse((await AsyncStorage.getItem(STREAK_KEY))!);
    expect(raw).not.toHaveProperty("paused");
  });

  it("reconstructs an old run around a paused day", () => {
    // A legacy record (no ledger): a run of 3 ending Thursday, Tuesday paused.
    const data = { currentStreak: 3, longestStreak: 3, lastActiveDate: "2026-11-05", totalActiveDays: 3, paused: ["2026-11-03"] };
    expect(keptOn(data, ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"])).toEqual([true, false, true, true]);
    expect(pausedOn(data, ["2026-11-03"])).toEqual([true]);
  });
});
