/**
 * The habit tick-time record — same-day only, tombstones on un-tick, the cap,
 * the reminder echo, and the merge that keeps an un-tick un-ticked.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { merge } from "../../sync/mergeStrategies";
import { readRoutine } from "../clock";
import { habitSamples, isEcho } from "../sources";
import {
  HABIT_TICK_TIMES_KEY,
  TICKS_PER_HABIT,
  clearHabitTick,
  liveTicksFor,
  loadTickTimes,
  recordHabitTick,
  withTick,
  withoutTick,
  type HabitTickTime,
} from "../tickTimes";

const pad = (x: number) => String(x).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

beforeEach(async () => {
  await AsyncStorage.multiRemove([HABIT_TICK_TIMES_KEY]);
});

describe("recordHabitTick", () => {
  it("keeps the time of a tick made on its own day", async () => {
    const now = new Date(2026, 10, 3, 21, 40);
    await recordHabitTick("h1", ymd(now), "app", { now });
    const list = await loadTickTimes();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: `h1:${ymd(now)}`, habitId: "h1", via: "app" });
    expect(list[0].at.startsWith(`${ymd(now)}T21:40`)).toBe(true);
    expect(list[0].updatedAt.endsWith("Z")).toBe(true);
  });

  it("records nothing for a back-filled day", async () => {
    const now = new Date(2026, 10, 3, 9, 0);
    await recordHabitTick("h1", "2026-11-02", "app", { now });
    expect(await loadTickTimes()).toEqual([]);
  });

  it("keeps when the reminder fired for a lock-screen press", async () => {
    const now = new Date(2026, 10, 3, 19, 5);
    const firedAt = new Date(2026, 10, 3, 19, 0);
    await recordHabitTick("h1", ymd(now), "notification", { now, firedAt });
    const [tick] = await loadTickTimes();
    expect(tick.via).toBe("notification");
    expect(isEcho(tick)).toBe(true);
  });

  it("tombstones an un-tick so the removal can travel", async () => {
    const now = new Date(2026, 10, 3, 21, 40);
    await recordHabitTick("h1", ymd(now), "app", { now });
    await clearHabitTick("h1", ymd(now), new Date(2026, 10, 3, 21, 45));
    const list = await loadTickTimes();
    expect(list).toHaveLength(1);
    expect(list[0].deleted).toBe(true);
    expect(liveTicksFor(list, "h1")).toEqual([]);
  });
});

describe("withTick / withoutTick", () => {
  it("re-ticking a day replaces it, including a tombstone", () => {
    const t1 = new Date(2026, 10, 3, 21, 0);
    const t2 = new Date(2026, 10, 3, 21, 5);
    const t3 = new Date(2026, 10, 3, 22, 0);
    let list: HabitTickTime[] = withTick([], { habitId: "h", date: "2026-11-03", at: "2026-11-03T21:00:00+00:00", via: "app" }, t1);
    list = withoutTick(list, "h", "2026-11-03", t2);
    list = withTick(list, { habitId: "h", date: "2026-11-03", at: "2026-11-03T22:00:00+00:00", via: "app" }, t3);
    expect(list).toHaveLength(1);
    expect(list[0].deleted).toBeUndefined();
    expect(list[0].at).toBe("2026-11-03T22:00:00+00:00");
  });

  it("keeps the newest days per habit", () => {
    const now = new Date(2026, 10, 30, 12, 0);
    let list: HabitTickTime[] = [];
    for (let i = 0; i < TICKS_PER_HABIT + 10; i++) {
      const d = new Date(2026, 10, 30);
      d.setDate(d.getDate() - i);
      list = withTick(list, { habitId: "h", date: ymd(d), at: `${ymd(d)}T08:00:00+00:00`, via: "app" }, now);
    }
    const live = liveTicksFor(list, "h");
    expect(live).toHaveLength(TICKS_PER_HABIT);
    expect(live[live.length - 1].date).toBe("2026-11-30");
  });
});

describe("the clock reads a habit's ticks", () => {
  it("leaves the reminder's echoes out and counts them", () => {
    const now = new Date(2026, 10, 21, 22, 0);
    let list: HabitTickTime[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(2026, 10, 21);
      d.setDate(d.getDate() - i);
      const date = ymd(d);
      list = withTick(
        list,
        i < 9
          ? { habitId: "h", date, at: `${date}T21:40:00+00:00`, via: "app" }
          : { habitId: "h", date, at: `${date}T19:03:00+00:00`, via: "notification", firedAt: `${date}T19:00:00+00:00` },
        now,
      );
    }
    const r = readRoutine(habitSamples(list, "h"), "2026-11-21")!;
    expect(r.count).toBe(9);
    expect(r.echoCount).toBe(3);
    expect(r.medianMinute).toBe(21 * 60 + 40);
  });

  it("a late press is a real time, not an echo", () => {
    expect(
      isEcho({ via: "notification", at: "2026-11-03T21:40:00+00:00", firedAt: "2026-11-03T19:00:00+00:00" }),
    ).toBe(false);
    expect(isEcho({ via: "app", at: "2026-11-03T19:01:00+00:00", firedAt: "2026-11-03T19:00:00+00:00" })).toBe(false);
  });
});

describe("sync", () => {
  it("an un-tick on one phone beats the tick on the other, both ways", () => {
    const ticked = JSON.stringify([
      { id: "h1:2026-11-02", habitId: "h1", date: "2026-11-02", at: "2026-11-02T21:40:00+00:00", via: "app", updatedAt: "2026-11-02T21:40:00.000Z" },
    ]);
    const unticked = JSON.stringify([
      { id: "h1:2026-11-02", habitId: "h1", date: "2026-11-02", at: "2026-11-02T21:40:00+00:00", via: "app", updatedAt: "2026-11-02T22:05:00.000Z", deleted: true },
    ]);
    for (const merged of [
      merge(HABIT_TICK_TIMES_KEY, ticked, unticked),
      merge(HABIT_TICK_TIMES_KEY, unticked, ticked),
    ]) {
      const rows = JSON.parse(merged!) as HabitTickTime[];
      expect(rows).toHaveLength(1);
      expect(rows[0].deleted).toBe(true);
    }
  });
});
