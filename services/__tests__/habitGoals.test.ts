/**
 * The habit GOAL engine — weekly quotas.
 *
 * A quota habit ("4× a week") is measured in a different unit from a weekday
 * habit, and that's the whole risk: streaks count WEEKS, "due today" stops
 * asking once the week is banked, and the heatmap must not paint the days you
 * legitimately skipped as misses. These lock all four, plus the guarantee that
 * a habit with no `weeklyGoal` behaves exactly as it did before the field
 * existed.
 *
 * `expo-notifications` is mocked only because HabitService imports it at module
 * scope; nothing here touches reminders.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly" },
  AndroidImportance: { DEFAULT: 3 },
  requestPermissionsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationCategoryAsync: vi.fn(),
}));

import {
  EVERY_DAY,
  frequencyLabel,
  goalModeOf,
  suggestWeeklyGoal,
  type Habit,
} from "../../models/habit";
import {
  buildHeatWeeks,
  computeStats,
  isDueToday,
  weekCount,
  weekStartOf,
} from "../HabitService";

/** 2026-08-17 is a Monday, so every week in these fixtures starts clean. */
const MONDAY = "2026-08-17";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Gym",
    icon: "barbell",
    color: "#3E9BFF",
    days: EVERY_DAY,
    source: "manual",
    reminder: null,
    order: 0,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

/**
 * Days offset from `MONDAY`, as YYYY-MM-DD.
 *
 * Formatted from LOCAL date parts, never `toISOString()` — the engine parses
 * these strings at local midnight, so a UTC round-trip would slide every
 * fixture by a day in any zone west of Greenwich and quietly test the wrong
 * weekdays.
 */
function day(mondayOffsetDays: number, weeksBack = 0): string {
  const d = new Date(`${MONDAY}T00:00:00`);
  d.setDate(d.getDate() + mondayOffsetDays - weeksBack * 7);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

describe("week boundaries", () => {
  it("anchors weeks to Monday", () => {
    expect(weekStartOf(MONDAY)).toBe(MONDAY); // Mon
    expect(weekStartOf(day(3))).toBe(MONDAY); // Thu
    expect(weekStartOf(day(6))).toBe(MONDAY); // Sun
    expect(weekStartOf(day(7))).toBe(day(7)); // next Mon
  });

  it("counts only completions inside the containing week", () => {
    const done = new Set([day(-1), day(0), day(2), day(6), day(7)]);
    expect(weekCount(done, day(3))).toBe(3); // Mon, Wed, Sun
  });
});

describe("isDueToday", () => {
  it("stops asking once the quota is banked", () => {
    const habit = makeHabit({ weeklyGoal: 3 });
    // Mon/Tue done, asking on Wednesday — one still owed.
    expect(isDueToday(habit, new Set([day(0), day(1)]), day(2))).toBe(true);
    // Three banked by Wednesday — Thursday is genuinely free.
    expect(isDueToday(habit, new Set([day(0), day(1), day(2)]), day(3))).toBe(false);
  });

  it("still counts a day that was already ticked, so done never exceeds due", () => {
    const habit = makeHabit({ weeklyGoal: 2 });
    const done = new Set([day(0), day(1)]);
    // Tuesday met the quota AND was ticked today — it must remain in the count.
    expect(isDueToday(habit, done, day(1))).toBe(true);
  });

  it("falls back to the weekday schedule when there is no goal", () => {
    const habit = makeHabit({ weeklyGoal: null, days: [0, 2, 4] }); // Mon/Wed/Fri
    expect(isDueToday(habit, new Set(), MONDAY)).toBe(true);
    expect(isDueToday(habit, new Set(), day(1))).toBe(false); // Tue
  });
});

describe("quota stats", () => {
  it("streaks in weeks, and the week in progress never breaks one", () => {
    const habit = makeHabit({ weeklyGoal: 3, createdAt: day(0, 4) });
    const done = new Set([
      // three full weeks at quota
      day(0, 3), day(2, 3), day(4, 3),
      day(0, 2), day(2, 2), day(4, 2),
      day(0, 1), day(2, 1), day(4, 1),
      // this week: only one so far, on Monday
      day(0),
    ]);
    const stats = computeStats(habit, done, day(1)); // asking on Tuesday

    expect(stats.streakUnit).toBe("week");
    expect(stats.currentStreak).toBe(3);
    expect(stats.weekDone).toBe(1);
    expect(stats.weekTarget).toBe(3);
  });

  it("counts the current week the moment its quota is filled", () => {
    const habit = makeHabit({ weeklyGoal: 2, createdAt: day(0, 2) });
    const done = new Set([day(0, 1), day(3, 1), day(0), day(1)]);
    expect(computeStats(habit, done, day(1)).currentStreak).toBe(2);
  });

  it("breaks the streak on a completed week that fell short", () => {
    const habit = makeHabit({ weeklyGoal: 3, createdAt: day(0, 3) });
    const done = new Set([
      day(0, 2), day(2, 2), day(4, 2), // met
      day(0, 1),                        // last week: 1 of 3 — short
      day(0), day(1), day(2),           // this week: met
    ]);
    const stats = computeStats(habit, done, day(3));
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(1);
  });

  it("does not punish the partial week a habit was created in", () => {
    // Created on a Saturday with a 5×/week goal — unreachable by definition.
    const habit = makeHabit({ weeklyGoal: 5, createdAt: day(5, 1) });
    const done = new Set([day(5, 1), day(6, 1), day(0), day(1), day(2), day(3), day(4)]);
    const stats = computeStats(habit, done, day(4));
    // This week hit 5; the creation week's shortfall must not zero it.
    expect(stats.currentStreak).toBe(1);
  });

  it("measures the 30-day rate against the quota, capped at 100", () => {
    const habit = makeHabit({ weeklyGoal: 3, createdAt: day(0, 4) });
    // Every single day done for four weeks — far past a 3/week quota.
    const done = new Set<string>();
    for (let i = 0; i < 30; i++) done.add(day(-i));
    expect(computeStats(habit, done, MONDAY).last30Pct).toBe(100);
  });
});

describe("quota heatmap", () => {
  it("never marks a skipped day as missed", () => {
    const habit = makeHabit({ weeklyGoal: 3, createdAt: day(0, 1) });
    const weeks = buildHeatWeeks(habit, new Set([day(0), day(2)]), day(4), 2);
    const thisWeek = weeks[weeks.length - 1];

    expect(thisWeek[0].done).toBe(true); // Mon
    expect(thisWeek[1].done).toBe(false); // Tue — skipped, not missed
    expect(thisWeek.every((c) => c.scheduled === false)).toBe(true);
  });

  it("still marks misses for a weekday habit", () => {
    const habit = makeHabit({ weeklyGoal: null, days: [0, 2, 4], createdAt: day(0, 1) });
    const weeks = buildHeatWeeks(habit, new Set([day(0)]), day(4), 2);
    const thisWeek = weeks[weeks.length - 1];

    expect(thisWeek[0]).toMatchObject({ done: true, scheduled: true }); // Mon
    expect(thisWeek[2]).toMatchObject({ done: false, scheduled: true }); // Wed — a real miss
    expect(thisWeek[1].scheduled).toBe(false); // Tue — off-plan
  });
});

describe("weekday habits are untouched by the new field", () => {
  it("keeps day-unit streaks and a scheduled-day week target", () => {
    const habit = makeHabit({ weeklyGoal: null, days: [0, 2, 4], createdAt: day(0, 1) });
    const done = new Set([day(0, 1), day(2, 1), day(4, 1), day(0), day(2)]);
    const stats = computeStats(habit, done, day(2));

    expect(stats.streakUnit).toBe("day");
    expect(stats.currentStreak).toBe(5); // five scheduled days in a row
    expect(stats.weekTarget).toBe(3);
    expect(stats.weekDone).toBe(2);
  });

  it("does not let an off-schedule tick inflate the week", () => {
    const habit = makeHabit({ weeklyGoal: null, days: [0, 2, 4], createdAt: day(0, 1) });
    // Ticked on Tuesday, which isn't one of its days.
    const stats = computeStats(habit, new Set([day(0), day(1)]), day(1));
    expect(stats.weekDone).toBe(1);
    expect(stats.weekDone).toBeLessThanOrEqual(stats.weekTarget);
  });
});

describe("goal vocabulary", () => {
  it("names each mode", () => {
    expect(frequencyLabel(EVERY_DAY, null)).toBe("Every day");
    expect(frequencyLabel(EVERY_DAY, 4)).toBe("4× a week");
    expect(frequencyLabel(EVERY_DAY, 7)).toBe("Every day");
    expect(frequencyLabel([0, 2, 4], null)).toBe("Mon, Wed, Fri");
  });

  it("reads the stored mode back off a habit", () => {
    expect(goalModeOf({ days: EVERY_DAY, weeklyGoal: null })).toBe("daily");
    expect(goalModeOf({ days: EVERY_DAY, weeklyGoal: 4 })).toBe("weekly");
    expect(goalModeOf({ days: [0, 2], weeklyGoal: null })).toBe("days");
  });

  it("suggests rest days for training and the full week for rituals", () => {
    expect(suggestWeeklyGoal("Gym session")).toBe(4);
    expect(suggestWeeklyGoal("Morning run")).toBe(3);
    expect(suggestWeeklyGoal("Drink water")).toBe(7);
    expect(suggestWeeklyGoal("Xyzzy")).toBeNull();
    expect(suggestWeeklyGoal("  ")).toBeNull();
  });
});
