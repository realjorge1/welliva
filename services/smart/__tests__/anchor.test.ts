/**
 * Anchors — steady things only, a real offer when a habit is struggling, and a
 * chain chip that follows the anchor rather than the clock.
 */
import { describe, expect, it } from "vitest";

import { reminderTitle } from "../../../models/habit";
import { shiftDay } from "../../commitment";
import { EMPTY_ROUTINE_SOURCES, type RoutineSources } from "../../routine/load";
import {
  ANCHOR_AFTER_MINUTES,
  anchorCopy,
  anchorLoggedAt,
  anchorReminder,
  chainDue,
  findAnchors,
  isStruggling,
} from "../anchor";

const TODAY = "2026-11-21";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: string, hh: number, mm: number) => `${date}T${pad(hh)}:${pad(mm)}:00+00:00`;

/** Breakfast logged on `days` of the last days, at hh:mm plus a little wobble. */
function withBreakfast(days: number, hh = 8, mm = 10, wobble = 5): RoutineSources {
  const intake: RoutineSources["intake"] = {};
  for (let i = 0; i < days; i++) {
    const date = shiftDay(TODAY, -i);
    intake[date] = [
      {
        slot: "breakfast",
        name: "Oats",
        calories: 300,
        proteinG: 10,
        carbsG: 50,
        fatG: 6,
        at: iso(date, hh, mm + (i % 3) * wobble),
      },
    ];
  }
  return { ...EMPTY_ROUTINE_SOURCES, intake };
}

describe("findAnchors", () => {
  it("names a meal logged steadily on 10 of the last 14 days", () => {
    const [a] = findAnchors(withBreakfast(12), [], TODAY);
    expect(a).toMatchObject({ kind: "breakfast", label: "breakfast", days: 12 });
    expect(a.minute).toBe(8 * 60 + 15);
  });

  it("needs ten days", () => {
    expect(findAnchors(withBreakfast(9), [], TODAY)).toEqual([]);
  });

  it("needs a tight spread", () => {
    expect(findAnchors(withBreakfast(12, 7, 0, 40), [], TODAY)).toEqual([]);
  });

  it("can be another habit, but never the habit itself", () => {
    const tickTimes = Array.from({ length: 12 }, (_, i) => {
      const date = shiftDay(TODAY, -i);
      return { id: `h2:${date}`, habitId: "h2", date, at: iso(date, 7, 0), via: "app" as const, updatedAt: "x" };
    });
    const sources = { ...EMPTY_ROUTINE_SOURCES, tickTimes };
    const habits = [{ id: "h2", name: "Stretch", source: "manual" as const }];
    expect(findAnchors(sources, habits, TODAY)[0]).toMatchObject({ kind: "habit", label: "Stretch", habitId: "h2" });
    expect(findAnchors(sources, habits, TODAY, "h2")).toEqual([]);
  });
});

describe("the offer", () => {
  const [a] = findAnchors(withBreakfast(12), [], TODAY);

  it("sets the reminder just after the anchor", () => {
    expect(anchorReminder(a)).toEqual({ hour: 8, minute: 15 + ANCHOR_AFTER_MINUTES });
  });

  it("says what it rests on", () => {
    const c = anchorCopy(a);
    expect(c.formOffer).toBe("Do it right after breakfast? You log breakfast around 8:15 AM most days.");
    expect(c.strugglingOffer).toBe(
      "This one's been tricky. Want to tie it to breakfast? You log breakfast around 8:15 AM on most days.",
    );
    expect(c.accept).toBe("After breakfast");
    expect(c.source).toBe("From 12 of your last 14 days.");
  });

  it("gives the reminder its name", () => {
    expect(reminderTitle({ name: "Vitamins", anchor: { kind: "breakfast", label: "breakfast" } })).toBe(
      "After breakfast: Vitamins",
    );
    expect(reminderTitle({ name: "Vitamins", anchor: { kind: "checkin", label: "your check-in" } })).toBe(
      "After check-in: Vitamins",
    );
    expect(reminderTitle({ name: "Vitamins" })).toBe("Vitamins");
  });
});

describe("isStruggling", () => {
  const habit = {
    days: [0, 1, 2, 3, 4, 5, 6],
    weeklyGoal: null,
    createdAt: "2026-01-01",
    source: "manual" as const,
  };
  const none = new Set<string>();
  const doneDays = (n: number) => new Set(Array.from({ length: n }, (_, i) => shiftDay(TODAY, -(i + 1))));

  it("is under half of the days it was asked for", () => {
    expect(isStruggling(habit, doneDays(6), none, TODAY)).toBe(true);
    expect(isStruggling(habit, doneDays(7), none, TODAY)).toBe(false);
  });

  it("needs at least six days asked for", () => {
    expect(isStruggling({ ...habit, days: [0, 3] }, none, none, TODAY)).toBe(false);
    expect(isStruggling({ ...habit, createdAt: shiftDay(TODAY, -3) }, none, none, TODAY)).toBe(false);
  });

  it("doesn't count rough days against it", () => {
    const paused = new Set(Array.from({ length: 9 }, (_, i) => shiftDay(TODAY, -(i + 1))));
    expect(isStruggling(habit, none, paused, TODAY)).toBe(false);
  });

  it("skips one that already has an anchor", () => {
    expect(isStruggling({ ...habit, anchor: { kind: "lunch", label: "lunch" } }, none, none, TODAY)).toBe(false);
  });

  it("reads a quota habit against its share of the days", () => {
    const quota = { ...habit, weeklyGoal: 4 };
    expect(isStruggling(quota, doneDays(3), none, TODAY)).toBe(true);
    expect(isStruggling(quota, doneDays(5), none, TODAY)).toBe(false);
  });
});

describe("the chain", () => {
  const habit = { anchor: { kind: "breakfast" as const, label: "breakfast" } };
  const base = { habit, done: new Set<string>(), due: true, loggedAtMinute: 500, nowMinute: 520, today: TODAY };

  it("appears once the anchor is logged", () => {
    expect(chainDue(base)).toBe(true);
    expect(chainDue({ ...base, loggedAtMinute: null })).toBe(false);
  });

  it("not once it's done, not when it isn't due, and not hours later", () => {
    expect(chainDue({ ...base, done: new Set([TODAY]) })).toBe(false);
    expect(chainDue({ ...base, due: false })).toBe(false);
    expect(chainDue({ ...base, nowMinute: 500 + 181 })).toBe(false);
  });

  it("reads today's anchor from the records", () => {
    const at = new Date(2026, 10, 21, 8, 20).toISOString();
    const sources: RoutineSources = {
      ...EMPTY_ROUTINE_SOURCES,
      intake: { [TODAY]: [{ slot: "breakfast", name: "Oats", calories: 1, proteinG: 1, carbsG: 1, fatG: 1, at }] },
    };
    expect(anchorLoggedAt({ kind: "breakfast", label: "breakfast" }, sources, TODAY)).toBe(8 * 60 + 20);
    expect(anchorLoggedAt({ kind: "lunch", label: "lunch" }, sources, TODAY)).toBeNull();
  });
});
