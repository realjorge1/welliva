/**
 * THE AGENDA — what the ladder says when it is allowed to say everything.
 *
 * `resolveNextMove` has its own suite next door, and it still passes unchanged:
 * the single next move is this list, filtered by route and topped. What these
 * tests pin is the part that is new, and the part the Deck's honesty rests on —
 * that the LIST is not filtered, that the ring's two numbers count only what
 * the day actually committed to, and that a "not now" lapses on its own.
 */

import { describe, expect, it } from "vitest";

import { leaseUntil } from "../dismissals";
import {
  MEAL_WINDOWS,
  finishedDayMove,
  resolveAgenda,
  resolveDayProgress,
  resolveNextMove,
  type MealSlot,
  type NextMoveInput,
} from "../nextMove";

/** 09:00 — inside the breakfast window. */
const NINE_AM = 9 * 60;
/** 13:00 — inside lunch, with breakfast's window long closed. */
const ONE_PM = 13 * 60;
/** 16:00 — between lunch and dinner, so no meal is due. */
const FOUR_PM = 16 * 60;
/** 20:00 — the check-in is askable. */
const EIGHT_PM = 20 * 60;

const meal = (
  type: MealSlot["type"],
  name: string,
  consumed = false,
): MealSlot => ({ type, name, consumed });

/** A fully set-up day with nothing outstanding — the bottom of the ladder. */
const settled: NextMoveInput = {
  minutesOfDay: FOUR_PM,
  savedSession: null,
  meals: [
    meal("breakfast", "Oats & berries", true),
    meal("lunch", "Chicken salad", true),
    meal("dinner", "Salmon & rice", true),
  ],
  hasScheduledDiet: true,
  todaySession: null,
  hasPlan: true,
  workoutDoneToday: true,
  isRestDay: false,
  setupComplete: true,
  checkedInToday: true,
  daysSinceWeighIn: 0,
  openConversation: null,
  waterMl: 2500,
  waterGoalMl: 2500,
  tomorrowFocus: null,
};

const on = (patch: Partial<NextMoveInput>): NextMoveInput => ({
  ...settled,
  ...patch,
});

const ids = (input: NextMoveInput) => resolveAgenda(input).map((m) => m.id);

describe("resolveAgenda — it stops hiding its other rungs", () => {
  it("returns every open move, in ladder order", () => {
    const day = on({
      minutesOfDay: EIGHT_PM,
      meals: [meal("dinner", "Salmon & rice")],
      todaySession: { focus: "Push Day", minutes: 42 },
      workoutDoneToday: false,
      checkedInToday: false,
      waterMl: 1000,
    });

    // Dinner is due, training has not happened, the evening can be reported on,
    // and there is water left. The old ladder returned only the first of these.
    expect(ids(day)).toEqual(["log-dinner", "start-session", "checkin", "water"]);
  });

  it("is empty on a day with nothing open", () => {
    expect(resolveAgenda(settled)).toEqual([]);
  });

  it("carries a due meal AND an earlier one that was missed", () => {
    const day = on({
      minutesOfDay: ONE_PM,
      meals: [meal("breakfast", "Oats"), meal("lunch", "Chicken salad")],
    });
    // The single-move ladder could only ever name one of these two.
    expect(ids(day)).toEqual(["log-lunch", "catchup-breakfast"]);
  });
});

describe("resolveAgenda — the count has to be one the list can back", () => {
  it("does NOT drop a row because you are standing on its screen", () => {
    const day: Partial<NextMoveInput> = {
      minutesOfDay: NINE_AM,
      meals: [meal("breakfast", "Oats & berries")],
      todaySession: { focus: "Push Day", minutes: 42 },
      workoutDoneToday: false,
    };

    // Same two moves from Home and from Diet: an agenda that reported "1 open"
    // while two things were open would be a count nobody could trust.
    expect(ids(on({ ...day, currentHref: "/" }))).toEqual([
      "log-breakfast",
      "start-session",
    ]);
    expect(ids(on({ ...day, currentHref: "/diet" }))).toEqual([
      "log-breakfast",
      "start-session",
    ]);
  });

  it("marks the row a screen cannot act on, rather than removing it", () => {
    const [mealRow] = resolveAgenda(
      on({ minutesOfDay: NINE_AM, meals: [meal("breakfast", "Oats")] }),
    );
    expect(mealRow.suppressOn).toBe("/diet");
  });

  it("still hands the cue only what this screen can do", () => {
    const day: Partial<NextMoveInput> = {
      minutesOfDay: NINE_AM,
      meals: [meal("breakfast", "Oats & berries")],
      todaySession: { focus: "Push Day", minutes: 42 },
      workoutDoneToday: false,
    };
    expect(resolveNextMove(on({ ...day, currentHref: "/diet" })).id).toBe(
      "start-session",
    );
  });
});

describe("resolveAgenda — live is not a prompt", () => {
  const paused = { label: "Push Day", index: 2, total: 8 };

  it("marks a paused session live, undismissible, and first", () => {
    const [first] = resolveAgenda(on({ savedSession: paused, waterMl: 0 }));
    expect(first.id).toBe("resume");
    expect(first.live).toBe(true);
    expect(first.dismissible).toBe(false);
    expect(first.segments).toEqual({ at: 2, of: 8 });
  });

  it("keeps the rest of the day behind it, which the old ladder could not", () => {
    expect(ids(on({ savedSession: paused, waterMl: 1000 }))).toEqual([
      "resume",
      "water",
    ]);
  });

  it("stops at the cold start, because every rung below would be a lie", () => {
    expect(ids(on({ hasPlan: false, hasScheduledDiet: false, meals: [] }))).toEqual([
      "build-plan",
    ]);
  });

  it("will not let the two moves that ARE the app be waved away", () => {
    const [coldStart] = resolveAgenda(
      on({ hasPlan: false, hasScheduledDiet: false, meals: [] }),
    );
    expect(coldStart.dismissible).toBe(false);

    const setup = resolveAgenda(on({ setupComplete: false })).find(
      (m) => m.id === "personalize",
    );
    expect(setup?.dismissible).toBe(false);
  });
});

describe("resolveDayProgress — the ring's two numbers", () => {
  it("counts the meals the day actually scheduled, not three", () => {
    expect(
      resolveDayProgress(
        on({ meals: [meal("breakfast", "Oats", true), meal("lunch", "Salad")] }),
      ),
    ).toEqual({ done: 1, total: 2 });
  });

  it("counts today's session only when the plan asked for one", () => {
    expect(
      resolveDayProgress(
        on({
          meals: [],
          todaySession: { focus: "Push Day", minutes: 42 },
          workoutDoneToday: false,
        }),
      ),
    ).toEqual({ done: 0, total: 1 });

    // A rest day is not an unfinished commitment.
    expect(
      resolveDayProgress(
        on({
          meals: [],
          isRestDay: true,
          todaySession: { focus: "Push Day", minutes: 42 },
          workoutDoneToday: false,
        }),
      ),
    ).toEqual({ done: 0, total: 0 });
  });

  it("does not count the check-in before the evening can be reported on", () => {
    const base = { meals: [], todaySession: null, checkedInToday: false };
    expect(resolveDayProgress(on({ ...base, minutesOfDay: NINE_AM }))).toEqual({
      done: 0,
      total: 0,
    });
    expect(resolveDayProgress(on({ ...base, minutesOfDay: EIGHT_PM }))).toEqual({
      done: 0,
      total: 1,
    });
  });

  it("ignores water and the weigh-in, which are targets rather than commitments", () => {
    // Both wide open; neither may move a ring that claims to count the day's
    // scheduled commitments.
    expect(
      resolveDayProgress(
        on({ meals: [], todaySession: null, waterMl: 0, daysSinceWeighIn: 30 }),
      ),
    ).toEqual({ done: 0, total: 0 });
  });

  it("reads zero of zero on a day nobody planned, so no ring is drawn", () => {
    expect(
      resolveDayProgress(
        on({ meals: [], todaySession: null, minutesOfDay: NINE_AM }),
      ),
    ).toEqual({ done: 0, total: 0 });
  });
});

describe("a dismissal is a lease, not a tombstone", () => {
  const DATE = "2026-09-23";
  const midnight = Date.parse(`${DATE}T00:00:00`);
  const at = (minutes: number) => midnight + minutes * 60_000;

  it("lets a meal back in the moment its window closes", () => {
    const [lunch] = resolveAgenda(
      on({ minutesOfDay: ONE_PM, meals: [meal("lunch", "Chicken salad")] }),
    );
    expect(leaseUntil(lunch, DATE)).toBe(at(MEAL_WINDOWS.lunch[1]));
  });

  it("gives everything else until midnight, because tomorrow it is true again", () => {
    const [weighIn] = resolveAgenda(
      on({ minutesOfDay: NINE_AM, daysSinceWeighIn: 30, meals: [] }),
    );
    expect(weighIn.id).toBe("weighin");
    expect(leaseUntil(weighIn, DATE)).toBe(at(24 * 60));
  });

  it("never hands out a lease that has already lapsed", () => {
    const now = at(ONE_PM);
    const [lunch] = resolveAgenda(
      on({ minutesOfDay: ONE_PM, meals: [meal("lunch", "Chicken salad")] }),
    );
    expect(leaseUntil(lunch, DATE)).toBeGreaterThan(now);
  });
});

describe("the finished day still gets its sentence", () => {
  it("is calm, and may be waved away for the night", () => {
    const done = finishedDayMove(on({ currentHref: "/" }));
    expect(done.tone).toBe("calm");
    expect(done.dismissible).toBe(true);
  });

  it("names a rest day rather than calling the day merely complete", () => {
    expect(finishedDayMove(on({ isRestDay: true })).id).toBe("rest");
  });
});
