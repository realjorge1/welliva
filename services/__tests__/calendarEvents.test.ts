/**
 * services/calendar/events — what welliva writes into the phone's calendar.
 *
 * Owner, 2026-11-15: put my workouts in the calendar, and the cycle (for women
 * who switch it on). These pin the rules that matter: only training days from
 * today on; the cycle in its discreet words by default and never the fertile
 * window unless she shows it; and a sync that touches ONLY welliva's own tagged
 * entries of its own scope.
 */
import { describe, expect, it } from "vitest";

import {
  cycleEventSpecs,
  keyOf,
  planCalendarChanges,
  tagLine,
  workoutEventSpecs,
  type CyclePredictionLike,
  type ExistingEvent,
} from "../calendar/events";
import type { GeneratedWorkoutPlan, WorkoutSession } from "@/models/workout";

function session(day: number, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s${day}`,
    dayLabel: `Day ${day}`,
    dayOfWeek: day,
    focus: "Full Body A",
    warmupMinutes: 5,
    exercises: [],
    cooldownMinutes: 5,
    totalDurationMinutes: 35,
    isRestDay: false,
    ...over,
  } as WorkoutSession;
}

const PLAN = {
  id: "p1",
  createdAt: "2026-11-16T00:00:00Z",
  weekStart: "2026-11-16", // a Monday
  splitType: "Full Body",
  inputHash: "x",
  sessions: [
    session(0),
    session(1, { isRestDay: true, focus: "Rest" }),
    session(2, { focus: "Upper Push", totalDurationMinutes: 0 }),
    session(4),
  ],
} as GeneratedWorkoutPlan;

describe("workouts → calendar", () => {
  it("writes each training day from today on, at the training hour, for its length", () => {
    const specs = workoutEventSpecs(PLAN, 17, "2026-11-17"); // Tuesday
    // Monday is past, Tuesday rests: Wednesday and Friday remain.
    expect(specs.map((s) => s.key)).toEqual([
      "w:2026-11-18",
      "w:2026-11-20",
    ]);
    const wed = specs[0];
    expect(wed.title).toBe("Workout · Upper Push");
    expect(wed.start.getHours()).toBe(17);
    // A 0-minute entry still gets a visible block.
    expect((wed.end.getTime() - wed.start.getTime()) / 60000).toBe(15);
    expect((specs[1].end.getTime() - specs[1].start.getTime()) / 60000).toBe(35);
    expect(keyOf(wed.notes)).toBe(wed.key);
  });

  it("writes nothing with no plan", () => {
    expect(workoutEventSpecs(null, 17, "2026-11-17")).toEqual([]);
  });
});

const PREDICTION: CyclePredictionLike = {
  likely: "2026-11-20",
  earliest: "2026-11-18",
  latest: "2026-11-23",
  periodLength: 5,
  cycleLength: 29,
  fertileStart: "2026-12-02",
  fertileEnd: "2026-12-07",
};

describe("cycle → calendar", () => {
  it("is discreet by default: never names the period or fertility", () => {
    const specs = cycleEventSpecs({ prediction: PREDICTION, discreet: true, fertileWindow: true, today: "2026-11-15" });
    const text = specs.map((s) => `${s.title} ${s.notes}`).join(" ");
    expect(text).not.toMatch(/period|fertil|ovulat|contracep/i);
    expect(specs.map((s) => s.title)).toEqual(["Plan-ahead days", "Plan-ahead days", "Window days"]);
  });

  it("writes the next period as an all-day block of her typical length, and the one after", () => {
    const [next, after] = cycleEventSpecs({
      prediction: PREDICTION,
      discreet: false,
      fertileWindow: false,
      today: "2026-11-15",
    });
    expect(next.title).toBe("Period likely");
    expect(next.allDay).toBe(true);
    expect(next.start.getDate()).toBe(20);
    // Exclusive end: the day after the 5th day (20–24 → 25th).
    expect(next.end.getDate()).toBe(25);
    expect(after.start.getMonth()).toBe(11); // 29 days on: 19 December
    expect(after.start.getDate()).toBe(19);
  });

  it("never writes the fertile window unless she shows it", () => {
    const specs = cycleEventSpecs({ prediction: PREDICTION, discreet: false, fertileWindow: false, today: "2026-11-15" });
    expect(specs.some((s) => s.key.startsWith("c:w"))).toBe(false);
    const shown = cycleEventSpecs({ prediction: PREDICTION, discreet: false, fertileWindow: true, today: "2026-11-15" });
    expect(shown.find((s) => s.key === "c:w1")?.notes).toMatch(/never a form of contraception/);
  });

  it("writes nothing without a prediction (paused, logging only, too little logged)", () => {
    expect(cycleEventSpecs({ prediction: null, discreet: true, fertileWindow: true, today: "2026-11-15" })).toEqual([]);
  });
});

function existing(id: string, key: string | null, over: Partial<ExistingEvent> = {}): ExistingEvent {
  return {
    id,
    title: "x",
    notes: key ? `${tagLine(key)}\n\nold` : "My own note",
    allDay: false,
    start: 0,
    end: 0,
    ...over,
  };
}

describe("the sync diff", () => {
  const wanted = workoutEventSpecs(PLAN, 17, "2026-11-16");

  it("adds what's missing, updates what changed, removes what the plan dropped", () => {
    const ch = planCalendarChanges("workouts", [
      existing("a", "w:2026-11-16"), // changed (old notes)
      existing("b", "w:2026-11-19"), // no longer a training day
    ], wanted);
    expect(ch.update.map((u) => u.id)).toEqual(["a"]);
    expect(ch.remove).toEqual(["b"]);
    expect(ch.create.map((s) => s.key)).toEqual([
      "w:2026-11-18",
      "w:2026-11-20",
    ]);
  });

  it("leaves an unchanged entry alone", () => {
    const w = wanted[0];
    const same = existing("a", null, {
      title: w.title,
      notes: w.notes,
      allDay: w.allDay,
      start: w.start.getTime(),
      end: w.end.getTime(),
    });
    expect(planCalendarChanges("workouts", [same], [w])).toEqual({ create: [], update: [], remove: [] });
  });

  it("never touches anything without our tag, or another scope's entries", () => {
    const ch = planCalendarChanges("workouts", [
      existing("mine", null), // the person's own event
      existing("cyc", "c:p1"),
    ], []);
    expect(ch.remove).toEqual([]);
    expect(ch.update).toEqual([]);
  });

  it("drops a duplicate left by an interrupted sync, keeping the first", () => {
    const k = "w:2026-11-18";
    const ch = planCalendarChanges("workouts", [existing("one", k), existing("two", k)], wanted);
    expect(ch.remove).toContain("two");
    expect(ch.remove).not.toContain("one");
  });
});
