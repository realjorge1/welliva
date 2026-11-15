/**
 * Streak freezes and the evening "still open" reminder (prompt 04, item A).
 *
 * Freezes: one earned per FREEZE_EARN_EVERY_DAYS kept days, at most
 * FREEZE_MAX held; a missed day spends one automatically — only when that
 * saves the run, never on a rough day the person marked, never today. A frozen
 * day carries the run but is never kept, so "N days kept" doesn't grow. Two
 * phones merge the ledgers as a union.
 *
 * The reminder: one at 20:00, only for a run worth keeping on a day still open,
 * withdrawn once kept, quiet on a rough day, backing off when ignored.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FREEZE_EARN_EVERY_DAYS,
  FREEZE_MAX,
  freezeBalance,
  frozenOn,
  liveStreak,
  pendingFreezes,
  readCommitment,
  shiftDay,
  type StreakLike,
} from "../commitment";
import { freezeMomentLine, unseenFrozen } from "../commitment";
import { mergeStreak } from "../sync/mergeStrategies";
import { streakEveningCopy } from "../notifications/copy";
import {
  BACKOFF_AFTER_IGNORED,
  STREAK_REMINDER_MIN_DAYS,
  backedOff,
  planStreakReminders,
} from "../notifications/streakReminderPlan";
import { loadStreakData } from "../StreakService";
import { twinStateMessage } from "../gozlin/agent/context";

/** `n` consecutive kept days ending on `last`. */
function run(last: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(last, -(n - 1 - i)));
}

function record(over: Partial<StreakLike> = {}): StreakLike {
  const days = over.days ?? [];
  return {
    currentStreak: days.length,
    longestStreak: days.length,
    lastActiveDate: days[days.length - 1] ?? "",
    totalActiveDays: days.length,
    days,
    ...over,
  };
}

describe("earning and holding freezes", () => {
  it("earns one for every seven kept days", () => {
    expect(freezeBalance(run("2026-11-10", FREEZE_EARN_EVERY_DAYS - 1))).toBe(0);
    expect(freezeBalance(run("2026-11-10", FREEZE_EARN_EVERY_DAYS))).toBe(1);
  });

  it("holds at most two — one earned beyond that is not banked", () => {
    expect(freezeBalance(run("2026-11-10", 21))).toBe(FREEZE_MAX);
    // Spend one after 21 days: one left, and the 14 days already counted
    // don't hand the lost one back.
    expect(freezeBalance(run("2026-11-10", 21), ["2026-11-11"])).toBe(1);
  });

  it("spends one per frozen day, in date order", () => {
    const days = run("2026-11-07", 7);
    expect(freezeBalance(days, ["2026-11-08"])).toBe(0);
  });
});

describe("spending a freeze on a missed day", () => {
  const today = "2026-11-12";

  it("covers one missed day when a freeze is held — the run carries on", () => {
    const r = record({ days: run("2026-11-10", 7) }); // last kept the 10th, the 11th missed
    expect(pendingFreezes(r, today)).toEqual(["2026-11-11"]);
    const after = { ...r, frozen: ["2026-11-11"] };
    expect(liveStreak(after, today)).toBe(7);
    expect(pendingFreezes(after, today)).toEqual([]);
  });

  it("never counts a frozen day as kept", () => {
    const after = record({ days: run("2026-11-10", 7), frozen: ["2026-11-11"] });
    const state = readCommitment(after, today);
    expect(state.totalDays).toBe(7);
    expect(state.streak).toBe(7);
    expect(state.week.find((d) => d.date === "2026-11-11")).toMatchObject({ kept: false, frozen: true });
    expect(frozenOn(after, ["2026-11-10", "2026-11-11"])).toEqual([false, true]);
  });

  it("spends none when it can't save the run", () => {
    const r = record({ days: run("2026-11-09", 7) }); // 10th and 11th missed, one freeze
    expect(pendingFreezes(r, today)).toEqual([]);
  });

  it("covers two missed days with two freezes", () => {
    const r = record({ days: run("2026-11-09", 14) });
    expect(pendingFreezes(r, today)).toEqual(["2026-11-10", "2026-11-11"]);
  });

  it("uses a rough day first: a day the person marked rough never spends a freeze", () => {
    const r = record({ days: run("2026-11-10", 7), paused: ["2026-11-11"] });
    expect(pendingFreezes(r, today)).toEqual([]);
    expect(liveStreak(r, today)).toBe(7);
  });

  it("never freezes today — it isn't over", () => {
    const r = record({ days: run("2026-11-11", 7) });
    expect(pendingFreezes(r, today)).toEqual([]);
  });

  it("does nothing without a run", () => {
    expect(pendingFreezes(record(), today)).toEqual([]);
  });

  it("is applied once on load and stored, so every reader agrees", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
    const days = run("2026-11-10", 7);
    await AsyncStorage.setItem(
      "@welliva_streak_data",
      JSON.stringify({ ...record({ days }), badges: [], weekActivity: [] }),
    );
    const loaded = await loadStreakData();
    expect(loaded.currentStreak).toBe(7);
    expect(loaded.frozen).toEqual(["2026-11-11"]);
    expect(JSON.parse((await AsyncStorage.getItem("@welliva_streak_data")) as string).frozen).toEqual(["2026-11-11"]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("two phones", () => {
  const a = { ...record({ days: ["2026-11-08", "2026-11-09"] }), frozen: ["2026-11-05"], badges: [] };
  const b = { ...record({ days: ["2026-11-09", "2026-11-10"] }), frozen: ["2026-11-06"], badges: [] };

  it("keeps every kept day and every frozen day from both", () => {
    const m = mergeStreak(a, b);
    expect(m.days).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(m.frozen).toEqual(["2026-11-05", "2026-11-06"]);
    expect(m.lastActiveDate).toBe("2026-11-10");
    expect(m.currentStreak).toBe(3);
  });

  it("is the same whichever phone is local, and merging again changes nothing", () => {
    const ab = mergeStreak(a, b);
    expect(JSON.stringify(mergeStreak(b, a))).toBe(JSON.stringify(ab));
    expect(JSON.stringify(mergeStreak(ab, b))).toBe(JSON.stringify(ab));
  });

  it("carries a run across a frozen day when it rebuilds it", () => {
    const m = mergeStreak(
      { ...record({ days: ["2026-11-08"] }), badges: [] },
      { ...record({ days: ["2026-11-10"] }), frozen: ["2026-11-09"], badges: [] },
    );
    expect(m.currentStreak).toBe(2);
  });
});

describe("the evening reminder", () => {
  const streak = (days: string[], over: Partial<StreakLike> = {}) => record({ days, ...over });
  const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m);

  it("is laid for 20:00 tonight while the day is open and the run is worth keeping", () => {
    const plan = planStreakReminders({
      now: at(15),
      streak: streak(run("2026-11-11", 12)),
      enabled: true,
      quietToday: null,
      laid: [],
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBe("2026-11-12");
    expect(plan[0].when.getHours()).toBe(20);
    expect(plan[0].body).toMatch(/\b12\b/);
  });

  it("isn't sent for a run shorter than the minimum", () => {
    const plan = planStreakReminders({
      now: at(15),
      streak: streak(run("2026-11-11", STREAK_REMINDER_MIN_DAYS - 1)),
      enabled: true,
      quietToday: null,
      laid: [],
    });
    expect(plan).toEqual([]);
  });

  it("once today is kept, tonight's is gone and tomorrow's waits instead", () => {
    const plan = planStreakReminders({
      now: at(15),
      streak: streak(run("2026-11-12", 5)),
      enabled: true,
      quietToday: null,
      laid: [],
    });
    expect(plan.map((p) => p.date)).toEqual(["2026-11-13"]);
    expect(plan[0].body).toContain("5");
  });

  it("stays quiet on a rough day, when switched off, and after 20:00", () => {
    const base = { streak: streak(run("2026-11-11", 12)), laid: [] as string[] };
    expect(planStreakReminders({ ...base, now: at(15), enabled: true, quietToday: "2026-11-12" })).toEqual([]);
    expect(planStreakReminders({ ...base, now: at(15), enabled: false, quietToday: null })).toEqual([]);
    expect(planStreakReminders({ ...base, now: at(20, 30), enabled: true, quietToday: null })).toEqual([]);
    const paused = streak(run("2026-11-11", 12), { paused: ["2026-11-12"] });
    expect(planStreakReminders({ streak: paused, laid: [], now: at(15), enabled: true, quietToday: null })).toEqual([]);
  });

  it("backs off after being ignored several evenings in a row", () => {
    const s = streak(run("2026-11-11", 12));
    const ignored = ["2026-11-05", "2026-11-06", "2026-11-07"].slice(0, BACKOFF_AFTER_IGNORED);
    // Those evenings ended unkept (they're not in this run's days).
    const gap = streak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"], {
      currentStreak: 4,
    });
    expect(backedOff(ignored, gap, "2026-11-12")).toBe(true);
    expect(planStreakReminders({ now: at(15), streak: gap, enabled: true, quietToday: null, laid: ignored })).toEqual([]);
    // Evenings that ended kept are not ignored.
    expect(backedOff(["2026-11-09", "2026-11-10", "2026-11-11"], s, "2026-11-12")).toBe(false);
  });

  it("speaks calmly and only suggests what really keeps a day", () => {
    for (let d = 1; d <= 30; d++) {
      const date = `2026-11-${String(d).padStart(2, "0")}`;
      const { title, body } = streakEveningCopy(9, date);
      const all = `${title} ${body}`.toLowerCase();
      expect(all).not.toMatch(/water|glass|lose|losing|hurry|before midnight|don't forget|last chance/);
      expect(body).toContain("9");
    }
  });
});

describe("Gozlin and a freeze", () => {
  it("is told in words that a freeze held yesterday", () => {
    const twin = {
      asOf: "2026-11-12T09:00:00",
      identitySummary: "x",
      flags: ["FREEZE_HELD"],
      today: {
        calories: { consumed: 0, target: 2000, pct: 0 },
        protein: { consumed: 0, target: 120, pct: 0 },
        water: { consumed: 0, target: 2500, pct: 0 },
        workout: { planned: null, done: false, minutes: 0 },
        dayProgress: 0.4,
      },
      momentum: { streak: 7, adherence7d: 70, trainingLoad7d: 2, trend: "steady" },
      recovery: { score: 70, level: "green", drivers: [], recommendation: "", basis: "" },
    } as never;
    expect(String(twinStateMessage(twin).content)).toContain("A streak freeze covered yesterday");
  });
});
describe("the freeze moment (owner approved the preview, 2026-11-15)", () => {
  const today = "2026-11-12";

  it("plays for a freeze this phone hasn't shown, once", () => {
    expect(unseenFrozen(["2026-11-11"], null, today)).toEqual(["2026-11-11"]);
    expect(unseenFrozen(["2026-11-11"], "2026-11-11", today)).toEqual([]);
  });

  it("treats an old freeze arriving through sync as history, not news", () => {
    expect(unseenFrozen(["2026-10-20"], null, today)).toEqual([]);
  });

  it("never plays for today", () => {
    expect(unseenFrozen([today], null, today)).toEqual([]);
  });

  it("says what happened, plainly", () => {
    expect(freezeMomentLine(["2026-11-11"], today)).toBe("A freeze held yesterday");
    expect(freezeMomentLine(["2026-11-09"], today)).toBe("A freeze held on Monday");
    expect(freezeMomentLine(["2026-11-10", "2026-11-11"], today)).toBe("Two freezes held your streak");
  });
});
