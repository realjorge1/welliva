/**
 * GOZLIN — the habit tracker as coach-readable facts.
 *
 * Two things are on trial here, and only one of them is arithmetic.
 *
 * The arithmetic is easy: streaks in, facts out.
 *
 * The other is RESTRAINT, and it is the actual feature. A coach that notices a
 * habit you quit is warm; a coach that notices it the same afternoon, and every
 * afternoon after, is surveillance. The difference between those two products
 * is entirely in these gates — the quiet period, the closing window, the
 * "was this ever really a habit" filter, and the sampling — so each one is
 * pinned separately. A regression in any of them does not fail a screen, it
 * changes what the app feels like to live with.
 */
import { describe, expect, it } from "vitest";

import {
  EVERY_DAY,
  type Habit,
  type HabitStats,
  type RetiredHabit,
} from "../../../models/habit";
import {
  QUIET_DAYS,
  RETIRED_WINDOW_DAYS,
  buildHabitTrackerBrief,
  crossReference,
  pickRetiredBeat,
  sayAgo,
  sayDate,
  type HabitViewLike,
} from "../GozlinTrackerHabits";

const TODAY = "2026-09-01"; // a Tuesday

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Take vitamins",
    icon: "medical",
    color: "#FF5D55",
    days: EVERY_DAY,
    source: "manual",
    reminder: null,
    order: 0,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

function stats(overrides: Partial<HabitStats> = {}): HabitStats {
  return {
    currentStreak: 0,
    bestStreak: 0,
    last30Pct: 0,
    doneToday: false,
    weekDone: 0,
    weekTarget: 7,
    streakUnit: "day",
    ...overrides,
  };
}

function view(
  h: Partial<Habit> = {},
  s: Partial<HabitStats> = {},
  done: string[] = [],
): HabitViewLike {
  return { habit: habit(h), stats: stats(s), done: new Set(done) };
}

function retired(overrides: Partial<RetiredHabit["habit"]> = {}, record: Partial<RetiredHabit["record"]> = {}, retiredAt = "2026-07-01"): RetiredHabit {
  return {
    habit: habit({ id: "r1", name: "Coding", ...overrides }),
    done: [],
    retiredAt,
    record: {
      totalDone: 34,
      spanDays: 60,
      perWeek: 4,
      bestStreak: 9,
      streakUnit: "day",
      firstDone: "2026-05-02",
      lastDone: "2026-06-30",
      ...record,
    },
  };
}

// ════════════════════════════════════════════════════════════════════

describe("buildHabitTrackerBrief", () => {
  it("states a habit's target in the words the user chose it in", () => {
    const brief = buildHabitTrackerBrief({
      views: [
        view({ id: "a", name: "Gym", weeklyGoal: 4 }),
        view({ id: "b", name: "Sleep 8 hours" }),
        view({ id: "c", name: "Stretch", days: [0, 2, 4], weeklyGoal: null }),
      ],
      retired: [],
      today: TODAY,
    });
    expect(brief.tracked.map((t) => t.frequency)).toEqual([
      "4× a week",
      "every day",
      "3 set days a week",
    ]);
  });

  it("names the recent days a weekday habit was due and skipped", () => {
    // Done every day except the 27th and 28th of August.
    const done: string[] = [];
    for (let d = 20; d <= 31; d++) {
      if (d === 27 || d === 28) continue;
      done.push(`2026-08-${d}`);
    }
    const brief = buildHabitTrackerBrief({
      views: [view({}, {}, done)],
      retired: [],
      today: TODAY,
    });
    expect(brief.tracked[0].recentMisses).toEqual(["2026-08-28", "2026-08-27"]);
    expect(brief.tracked[0].lastDone).toBe("2026-08-31");
  });

  it("never accuses a weekly-goal habit of missing a day", () => {
    // A 4×/week habit has no owed days — which days you use is your business,
    // and naming a Tuesday it "missed" would invent an obligation.
    const brief = buildHabitTrackerBrief({
      views: [view({ weeklyGoal: 4 }, {}, ["2026-08-24"])],
      retired: [],
      today: TODAY,
    });
    expect(brief.tracked[0].recentMisses).toEqual([]);
  });

  it("marks a habit that had a real run as consistent, and a false start as not", () => {
    const brief = buildHabitTrackerBrief({
      views: [],
      retired: [
        retired({ id: "real" }),
        retired({ id: "fizzled" }, { totalDone: 2, perWeek: 0.4, bestStreak: 1 }),
      ],
      today: TODAY,
    });
    const byId = Object.fromEntries(brief.retired.map((r) => [r.id, r]));
    expect(byId.real.wasConsistent).toBe(true);
    expect(byId.fizzled.wasConsistent).toBe(false);
    expect(byId.real.summary).toBe("4× a week for 9 weeks");
    expect(byId.fizzled.summary).toContain("0.4× a week");
  });
});

// ════════════════════════════════════════════════════════════════════

describe("pickRetiredBeat — the restraint", () => {
  /** The beat over a range of days, so sampling doesn't hide a gate. */
  const beatsWithin = (entry: RetiredHabit, fromDay: number, toDay: number) => {
    let hits = 0;
    for (let d = fromDay; d <= toDay; d++) {
      const day = new Date("2026-07-01T12:00:00");
      day.setDate(day.getDate() + d);
      const today = day.toISOString().slice(0, 10);
      const brief = buildHabitTrackerBrief({ views: [], retired: [entry], today });
      if (pickRetiredBeat(brief, today)) hits++;
    }
    return hits;
  };

  it("says nothing at all during the quiet period after a habit is dropped", () => {
    // Someone who just quit does not need the app to notice out loud.
    expect(beatsWithin(retired(), 0, QUIET_DAYS - 1)).toBe(0);
  });

  it("does eventually raise it, once", () => {
    expect(beatsWithin(retired(), QUIET_DAYS, QUIET_DAYS + 30)).toBeGreaterThan(0);
  });

  it("stops for good once it is history rather than news", () => {
    expect(
      beatsWithin(retired(), RETIRED_WINDOW_DAYS + 1, RETIRED_WINDOW_DAYS + 60),
    ).toBe(0);
  });

  it("never raises a habit that never took", () => {
    const fizzled = retired({}, { totalDone: 2, perWeek: 0.4 });
    expect(beatsWithin(fizzled, QUIET_DAYS, RETIRED_WINDOW_DAYS)).toBe(0);
  });

  it("speaks on a minority of the days it is allowed to", () => {
    // The gap between "allowed" and "spoken" is the whole difference between a
    // coach mentioning something and an app nagging about it.
    const eligibleDays = RETIRED_WINDOW_DAYS - QUIET_DAYS;
    const hits = beatsWithin(retired(), QUIET_DAYS, RETIRED_WINDOW_DAYS);
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(eligibleDays / 2);
  });

  it("gives the same answer twice for the same day", () => {
    // A hash, not a random draw — a card must not appear, vanish and reappear
    // as the user scrolls.
    const brief = buildHabitTrackerBrief({
      views: [],
      retired: [retired({}, {}, "2026-07-01")],
      today: "2026-08-20",
    });
    expect(pickRetiredBeat(brief, "2026-08-20")).toEqual(
      pickRetiredBeat(brief, "2026-08-20"),
    );
  });

  it("asks a question that offers a reason instead of demanding one", () => {
    // The line matters as much as the timing: "why did you stop" puts the user
    // on trial, and this feature is not that.
    let message: string | null = null;
    for (let d = QUIET_DAYS; d <= RETIRED_WINDOW_DAYS && !message; d++) {
      const day = new Date("2026-07-01T12:00:00");
      day.setDate(day.getDate() + d);
      const today = day.toISOString().slice(0, 10);
      const brief = buildHabitTrackerBrief({ views: [], retired: [retired()], today });
      message = pickRetiredBeat(brief, today)?.message ?? null;
    }
    expect(message).toBeTruthy();
    expect(message!.toLowerCase()).not.toContain("why did you");
    expect(message).toContain("4× a week");
  });
});

// ════════════════════════════════════════════════════════════════════

describe("crossReference — connecting a conversation to real activity", () => {
  const missing = () =>
    buildHabitTrackerBrief({
      views: [view({ id: "v", name: "Take vitamins" }, {}, ["2026-08-20"])],
      retired: [],
      today: TODAY,
    });

  /** Try a run of days, since the gate samples. */
  const anyRefWithin = (text: string, brief = missing(), days = 8) => {
    for (let d = 0; d < days; d++) {
      const day = new Date(`${TODAY}T12:00:00`);
      day.setDate(day.getDate() + d);
      const ref = crossReference(text, brief, day.toISOString().slice(0, 10));
      if (ref) return ref;
    }
    return null;
  };

  it("finds a habit when the user says a word the habit never uses", () => {
    // "Take vitamins" has to be found from "multivitamin" — the habit's own
    // words are rarely the ones people type.
    const ref = anyRefWithin("should i be taking a multivitamin every day?");
    expect(ref?.subject).toBe("Take vitamins");
    expect(ref?.kind).toBe("miss");
  });

  it("stays silent when the subject has nothing to do with any habit", () => {
    for (let d = 0; d < 30; d++) {
      const day = new Date(`${TODAY}T12:00:00`);
      day.setDate(day.getDate() + d);
      expect(
        crossReference("what should i do about my deadlift form", missing(), day.toISOString().slice(0, 10)),
      ).toBeNull();
    }
  });

  it("stays silent when there is nothing worth saying about the habit", () => {
    // On target, no misses, no streak worth naming. "You did your vitamins as
    // usual" is not an observation, it is noise with a number in it.
    const onTrack: string[] = [];
    for (let d = 0; d < 20; d++) {
      const day = new Date(`${TODAY}T12:00:00`);
      day.setDate(day.getDate() - d);
      onTrack.push(day.toISOString().slice(0, 10));
    }
    const dull = buildHabitTrackerBrief({
      views: [view({ name: "Take vitamins" }, { currentStreak: 3, last30Pct: 90 }, onTrack)],
      retired: [],
      today: TODAY,
    });
    expect(anyRefWithin("thinking about vitamins", dull, 30)).toBeNull();
  });

  it("does not fire on every mention — that is the creepy version", () => {
    let fired = 0;
    for (let d = 0; d < 20; d++) {
      const day = new Date(`${TODAY}T12:00:00`);
      day.setDate(day.getDate() + d);
      if (crossReference("about vitamins", missing(), day.toISOString().slice(0, 10))) fired++;
    }
    expect(fired).toBeGreaterThan(0);
    expect(fired).toBeLessThan(20);
  });

  it("prefers a miss to a streak — the miss is the useful half", () => {
    const both = buildHabitTrackerBrief({
      views: [
        view({ id: "a", name: "Meditate" }, { currentStreak: 30, last30Pct: 100 }, [TODAY]),
        view({ id: "b", name: "Take vitamins" }, {}, ["2026-08-20"]),
      ],
      retired: [],
      today: TODAY,
    });
    const ref = anyRefWithin("vitamins and meditation, worth it?", both, 12);
    expect(ref?.kind).toBe("miss");
  });

  it("answers about a habit they used to keep when they raise it themselves", () => {
    // No sampling on this one: they asked. Staying quiet about their own
    // history when they bring it up is amnesia, not tact.
    const brief = buildHabitTrackerBrief({
      views: [],
      retired: [retired({ name: "Coding" }, {}, "2026-07-01")],
      today: "2026-08-20",
    });
    const ref = crossReference("i want to get back into coding", brief, "2026-08-20");
    expect(ref?.kind).toBe("retired");
    expect(ref?.evidence).toContain("4× a week");
  });

  it("keeps the same quiet period as an unprompted beat", () => {
    const brief = buildHabitTrackerBrief({
      views: [],
      retired: [retired({ name: "Coding" }, {}, "2026-08-30")],
      today: TODAY, // two days later
    });
    expect(crossReference("thinking about coding again", brief, TODAY)).toBeNull();
  });

  it("cites only figures the engine produced", () => {
    const ref = anyRefWithin("multivitamin question");
    // Every number in the evidence has to trace to the brief — this string is
    // handed to the model as citable fact, and grounding will let it through.
    expect(ref?.evidence).toMatch(/Take vitamins/);
    expect(ref?.evidence).toMatch(/Last 30 days: \d+%/);
  });
});

// ════════════════════════════════════════════════════════════════════

describe("saying dates like a person", () => {
  it("names the weekday for the last fortnight and a real date beyond it", () => {
    expect(sayDate("2026-09-01", "2026-09-01")).toBe("today");
    expect(sayDate("2026-08-31", "2026-09-01")).toBe("yesterday");
    expect(sayDate("2026-08-27", "2026-09-01")).toBe("on Thursday");
    expect(sayDate("2026-08-24", "2026-09-01")).toBe("last Monday");
    expect(sayDate("2026-07-14", "2026-09-01")).toBe("on 14 July");
  });

  it("rounds a duration the way it would be spoken", () => {
    expect(sayAgo(1)).toBe("yesterday");
    expect(sayAgo(4)).toBe("4 days ago");
    expect(sayAgo(8)).toBe("a week ago");
    expect(sayAgo(21)).toBe("3 weeks ago");
    expect(sayAgo(31)).toBe("about a month ago");
    expect(sayAgo(90)).toBe("about 3 months ago");
  });
});
