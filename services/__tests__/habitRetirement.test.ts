/**
 * HABIT RETIREMENT — deleting a habit must not delete the fact that it happened.
 *
 * This is the promise the delete confirmation makes out loud ("your record
 * stays"), and it is the one thing about this feature a user cannot verify for
 * themselves until it is too late. So the properties are pinned here:
 *
 *   ARCHIVED FIRST — the record is written before the habit or its log is
 *                    dropped, so a crash mid-delete loses nothing that mattered.
 *   MOVED, NOT COPIED — the completion dates leave the live log blob and travel
 *                    with the record, so the archive is self-contained and the
 *                    active log holds only habits that still exist.
 *   FROZEN — the summary is computed once, at retirement, from the habit's own
 *            last day. Months of silence afterwards must not quietly rewrite
 *            "4× a week for nine weeks" into "0.4× a week".
 *
 * `expo-notifications` is mocked (HabitService imports it for reminders);
 * AsyncStorage is the in-memory one from vitest.setup, so storage round-trips
 * for real.
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

import { EVERY_DAY, retiredSummaryLine, type Habit } from "../../models/habit";
import {
  forgetRetiredHabit,
  loadRetiredHabits,
  retireHabit,
  retiredRecordFor,
  saveRetiredHabits,
} from "../HabitService";

/** A daily habit created on 1 June. */
function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h_code",
    name: "Coding",
    icon: "code-slash",
    color: "#3E9BFF",
    days: EVERY_DAY,
    source: "manual",
    reminder: null,
    order: 0,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

/** `count` completions, every `everyN`th day from `from`. */
function doneDates(from: string, count: number, everyN = 1): Set<string> {
  const out = new Set<string>();
  const d = new Date(`${from}T12:00:00`);
  for (let i = 0; i < count; i++) {
    out.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + everyN);
  }
  return out;
}

beforeEach(async () => {
  await saveRetiredHabits([]);
});

describe("retiredRecordFor", () => {
  it("counts what was actually done and how long it ran", () => {
    // 4× a week for 4 weeks: every other day, 16 times from 1 June.
    const done = doneDates("2026-06-01", 16, 2);
    const record = retiredRecordFor(habit(), done);

    expect(record.totalDone).toBe(16);
    expect(record.firstDone).toBe("2026-06-01");
    expect(record.lastDone).toBe("2026-07-01");
    expect(record.spanDays).toBe(31);
    expect(record.perWeek).toBeCloseTo(3.6, 1);
  });

  it("measures the span to the LAST COMPLETION, not to today", () => {
    // The habit that matters: someone who did it hard for a month and stopped.
    // Measuring to "now" would dilute a real habit into a fraction of one every
    // day that passes, and the record is supposed to be frozen.
    const done = doneDates("2026-06-01", 30);
    const a = retiredRecordFor(habit(), done);
    expect(a.perWeek).toBeCloseTo(7, 1);
    expect(retiredSummaryLine(a)).toContain("almost every day");
  });

  it("survives a habit that was never once completed", () => {
    const record = retiredRecordFor(habit(), new Set());
    expect(record.totalDone).toBe(0);
    expect(record.firstDone).toBeNull();
    expect(record.lastDone).toBeNull();
    expect(record.perWeek).toBe(0);
    expect(retiredSummaryLine(record)).toBe("never got going");
  });

  it("reports a weekly-goal habit's streak in weeks", () => {
    const goal = habit({ id: "h_gym", name: "Gym", weeklyGoal: 4 });
    const record = retiredRecordFor(goal, doneDates("2026-06-01", 16, 2));
    expect(record.streakUnit).toBe("week");
  });
});

describe("retireHabit", () => {
  it("keeps the habit, its dates and a frozen record", async () => {
    const done = doneDates("2026-06-01", 16, 2);
    const entry = await retireHabit(habit(), done, "2026-07-05");

    expect(entry.habit.name).toBe("Coding");
    expect(entry.retiredAt).toBe("2026-07-05");
    expect(entry.done).toHaveLength(16);
    expect(entry.record.totalDone).toBe(16);

    const stored = await loadRetiredHabits();
    expect(stored).toHaveLength(1);
    expect(stored[0].habit.id).toBe("h_code");
    expect(stored[0].done).toEqual(entry.done);
  });

  it("stores the dates sorted, whatever order they arrive in", async () => {
    const entry = await retireHabit(
      habit(),
      new Set(["2026-06-09", "2026-06-01", "2026-06-05"]),
      "2026-07-01",
    );
    expect(entry.done).toEqual(["2026-06-01", "2026-06-05", "2026-06-09"]);
  });

  it("replaces an earlier record for the same habit rather than stacking two", async () => {
    await retireHabit(habit(), doneDates("2026-06-01", 5), "2026-06-10");
    await retireHabit(habit(), doneDates("2026-06-01", 12), "2026-07-01");

    const stored = await loadRetiredHabits();
    expect(stored).toHaveLength(1);
    expect(stored[0].record.totalDone).toBe(12);
    expect(stored[0].retiredAt).toBe("2026-07-01");
  });

  it("lists the most recently retired first", async () => {
    await retireHabit(habit({ id: "a", name: "Reading" }), doneDates("2026-06-01", 8), "2026-06-20");
    await retireHabit(habit({ id: "b", name: "Coding" }), doneDates("2026-06-01", 8), "2026-07-20");

    const stored = await loadRetiredHabits();
    expect(stored.map((r) => r.habit.id)).toEqual(["b", "a"]);
  });

  it("forgets one on request — the only way a record ever leaves", async () => {
    await retireHabit(habit(), doneDates("2026-06-01", 8), "2026-07-01");
    await forgetRetiredHabit("h_code");
    expect(await loadRetiredHabits()).toHaveLength(0);
  });

  it("ignores malformed rows rather than throwing on read", async () => {
    // A blob from an older build, or a half-written one.
    await saveRetiredHabits([
      null as never,
      { habit: null, done: [] } as never,
      (await retireHabit(habit(), doneDates("2026-06-01", 3), "2026-07-01")),
    ]);
    const stored = await loadRetiredHabits();
    expect(stored.every((r) => r?.habit?.id)).toBe(true);
  });
});
