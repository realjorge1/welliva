/**
 * Reminders that move themselves — when to offer, what to offer, and when the
 * reminder is plainly working and should be left alone.
 */
import { describe, expect, it } from "vitest";

import { readRoutine, type RoutineReading, type RoutineSample } from "../../routine/clock";
import {
  MOVE_KEEP_DAYS,
  markEchoesAfter,
  moveId,
  suggestMove,
  windowPhrase,
  type MoveTarget,
} from "../reminderMove";
import type { SmartAnswer } from "../types";

const TODAY = "2026-11-21";
const habit: MoveTarget = { kind: "habit", habitId: "h1", name: "Stretch" };

const reading = (over: Partial<RoutineReading> = {}): RoutineReading => ({
  medianMinute: 21 * 60 + 40,
  spreadMinutes: 30,
  count: 12,
  windowDays: 21,
  echoCount: 0,
  ...over,
});

describe("suggestMove", () => {
  it("offers to move a 7:00 PM reminder to 9:30 PM for a 9:40 PM habit", () => {
    const s = suggestMove({ target: habit, reading: reading(), reminderMinute: 19 * 60, today: TODAY })!;
    expect(s).not.toBeNull();
    expect(s.id).toBe("reminder-move:habit:h1");
    expect(s.suggestedMinute).toBe(21 * 60 + 30);
    expect(s.usualMinute).toBe(21 * 60 + 40);
    expect(s.count).toBe(12);
  });

  it("rounds to five minutes, ten before the habit", () => {
    const s = suggestMove({ target: habit, reading: reading({ medianMinute: 8 * 60 + 13 }), reminderMinute: 7 * 60, today: TODAY })!;
    expect(s.suggestedMinute).toBe(8 * 60 + 5);
  });

  it("stays quiet below the gate or when the routine is scattered", () => {
    expect(suggestMove({ target: habit, reading: null, reminderMinute: 19 * 60, today: TODAY })).toBeNull();
    expect(
      suggestMove({ target: habit, reading: reading({ spreadMinutes: 90 }), reminderMinute: 19 * 60, today: TODAY }),
    ).toBeNull();
  });

  it("leaves a reminder that is close enough", () => {
    expect(
      suggestMove({ target: habit, reading: reading({ medianMinute: 19 * 60 + 40 }), reminderMinute: 19 * 60, today: TODAY }),
    ).toBeNull();
  });

  it("leaves a reminder that is working — half the days answered from its button", () => {
    expect(
      suggestMove({ target: habit, reading: reading({ count: 8, echoCount: 8 }), reminderMinute: 19 * 60, today: TODAY }),
    ).toBeNull();
    expect(
      suggestMove({ target: habit, reading: reading({ count: 9, echoCount: 8 }), reminderMinute: 19 * 60, today: TODAY }),
    ).not.toBeNull();
  });

  it("works across midnight", () => {
    const s = suggestMove({ target: habit, reading: reading({ medianMinute: 5 }), reminderMinute: 22 * 60, today: TODAY })!;
    expect(s.suggestedMinute).toBe(23 * 60 + 55);
  });
});

describe("after a Keep", () => {
  const kept = (over: Partial<SmartAnswer> = {}): SmartAnswer => ({
    id: moveId(habit),
    feature: "reminder-move",
    answer: "declined",
    at: "2026-10-01T20:00:00.000Z",
    until: "2026-10-30",
    value: 21 * 60 + 30,
    ...over,
  });

  it("holds the question for the cool-down", () => {
    expect(
      suggestMove({ target: habit, reading: reading(), reminderMinute: 19 * 60, previous: kept({ until: "2026-11-25" }), today: TODAY }),
    ).toBeNull();
    expect(MOVE_KEEP_DAYS).toBe(30);
  });

  it("then asks only if the routine moved an hour from the last offer", () => {
    expect(
      suggestMove({ target: habit, reading: reading(), reminderMinute: 19 * 60, previous: kept(), today: TODAY }),
    ).toBeNull();
    expect(
      suggestMove({
        target: habit,
        reading: reading({ medianMinute: 22 * 60 + 45 }),
        reminderMinute: 19 * 60,
        previous: kept(),
        today: TODAY,
      }),
    ).not.toBeNull();
  });
});

describe("markEchoesAfter — meals and water", () => {
  it("reads a log in the fifteen minutes after the reminder as the reminder working", () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const samples: RoutineSample[] = [];
    for (let d = 1; d <= 10; d++) {
      const date = `2026-11-${pad(d)}`;
      samples.push({ date, at: `${date}T${d <= 6 ? "08:35" : "07:40"}:00+00:00` });
    }
    const marked = markEchoesAfter(samples, 8 * 60 + 30);
    expect(marked.filter((s) => s.echo)).toHaveLength(6);
    const r = readRoutine(marked, "2026-11-10", { minCount: 4 })!;
    expect(r.count).toBe(4);
    expect(r.echoCount).toBe(6);
    expect(suggestMove({ target: { kind: "meal", slot: "breakfast" }, reading: { ...r, spreadMinutes: 0 }, reminderMinute: 8 * 60 + 30, today: "2026-11-10" })).toBeNull();
  });
});

describe("windowPhrase", () => {
  it("states the scope in plain words", () => {
    expect(windowPhrase(21)).toBe("the last 3 weeks");
    expect(windowPhrase(7)).toBe("the last week");
    expect(windowPhrase(10)).toBe("the last 10 days");
  });
});
