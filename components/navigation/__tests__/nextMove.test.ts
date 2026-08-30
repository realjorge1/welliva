/**
 * THE NEXT-MOVE LADDER.
 *
 * The Action Bar states a fact on every screen it appears on, so the rung it
 * picks is a correctness question, not a styling one. These lock the order
 * itself (each rung beats every rung below it), the clock behaviour that makes
 * the bar read as though it knows the time, and the two ways the ladder could
 * quietly start lying: claiming a meal is due when it isn't, and asking for
 * water that has already been drunk.
 *
 * Copy is deliberately asserted through `id`, not through `label` — the
 * wording is allowed to be retuned, the priority is not.
 */
import { describe, expect, it } from "vitest";

import {
  MEAL_WINDOWS,
  WATER_TAP_ML,
  mealDueAt,
  resolveNextMove,
  type MealSlot,
  type NextMoveInput,
} from "../nextMove";

/** 09:00 — inside the breakfast window, so meal rungs are reachable. */
const NINE_AM = 9 * 60;
/** 16:00 — between lunch and dinner, so no meal is due. */
const FOUR_PM = 16 * 60;

const meal = (
  type: MealSlot["type"],
  name: string,
  consumed = false,
): MealSlot => ({ type, name, consumed });

/**
 * A fully set-up day with nothing outstanding — the bottom of the ladder.
 * Every test raises exactly one condition off this base, so whatever rung comes
 * back is attributable to that one change.
 */
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

describe("resolveNextMove — the ladder's order", () => {
  it("a paused session beats everything below it", () => {
    // Every lower rung is also screaming here: no plan, no diet, a meal due,
    // setup incomplete, no water. The abandoned session still wins.
    const move = resolveNextMove(
      on({
        minutesOfDay: NINE_AM,
        savedSession: { label: "Push Day", index: 2, total: 8 },
        meals: [meal("breakfast", "Oats & berries")],
        hasScheduledDiet: false,
        hasPlan: false,
        setupComplete: false,
        waterMl: 0,
      }),
    );

    expect(move.id).toBe("resume");
    expect(move.action).toEqual({ kind: "resume" });
    // 0-based index, 1-based prose: "Exercise 3 of 8", never "2 of 8".
    expect(move.caption).toBe("Exercise 3 of 8");
  });

  it("a cold-start account is sent to build a plan, not nudged", () => {
    const move = resolveNextMove(
      on({ hasPlan: false, hasScheduledDiet: false, setupComplete: false }),
    );

    expect(move.id).toBe("build-plan");
    expect(move.action).toEqual({ kind: "push", href: "/fitness/setup" });
  });

  it("a due meal beats today's training", () => {
    const move = resolveNextMove(
      on({
        minutesOfDay: NINE_AM,
        meals: [meal("breakfast", "Oats & berries")],
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: false,
      }),
    );

    expect(move.id).toBe("log-breakfast");
    expect(move.action).toEqual({ kind: "route", href: "/diet" });
  });

  it("training surfaces between meal windows", () => {
    // Same unlogged breakfast as above — but it is 4pm, so no meal is due and
    // the workout is genuinely the next thing. This is the pairing that makes
    // the bar read as though it knows what time it is.
    const move = resolveNextMove(
      on({
        minutesOfDay: FOUR_PM,
        meals: [meal("breakfast", "Oats & berries")],
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: false,
      }),
    );

    expect(move.id).toBe("start-session");
    expect(move.action).toEqual({ kind: "startSession" });
    expect(move.caption).toBe("~42 min");
  });

  it("an unscheduled day asks for meals before it asks for training", () => {
    const move = resolveNextMove(
      on({
        hasScheduledDiet: false,
        meals: [],
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: false,
      }),
    );

    expect(move.id).toBe("plan-meals");
  });

  it("setup sits below the day's real work", () => {
    const withWork = resolveNextMove(
      on({
        setupComplete: false,
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: false,
      }),
    );
    expect(withWork.id).toBe("start-session");

    const withoutWork = resolveNextMove(on({ setupComplete: false }));
    expect(withoutWork.id).toBe("personalize");
  });

  it("water fills the gap when nothing is scheduled for the hour", () => {
    const move = resolveNextMove(on({ waterMl: 1300, waterGoalMl: 2500 }));

    expect(move.id).toBe("water");
    expect(move.action).toEqual({ kind: "water", ml: WATER_TAP_ML });
    // 1200ml outstanding → "1.2 L to go". The number on the bar is the number
    // in the store, not a rounded impression of it.
    expect(move.caption).toBe("1.2 L to go");
  });

  it("a finished day says so, and points at tomorrow", () => {
    const move = resolveNextMove(on({ tomorrowFocus: "Pull Day" }));

    expect(move.id).toBe("complete");
    expect(move.caption).toBe("Tomorrow: Pull Day");
    // Calm, not primary: a finished day must not look like an unpressed button.
    expect(move.tone).toBe("calm");
    // And never a dead end.
    expect(move.action).toEqual({ kind: "route", href: "/logs" });
  });

  it("a finished day with no next session still offers somewhere to go", () => {
    const move = resolveNextMove(on({ tomorrowFocus: null }));

    expect(move.id).toBe("complete");
    expect(move.caption).toBe("See your record");
  });
});

describe("resolveNextMove — it never invents work", () => {
  it("does not ask for a meal that was already logged", () => {
    // Breakfast IS due by the clock, but it's eaten. The bar must fall through
    // rather than ask a second time.
    const move = resolveNextMove(
      on({
        minutesOfDay: NINE_AM,
        meals: [meal("breakfast", "Oats & berries", true)],
        waterMl: 1000,
      }),
    );

    expect(move.id).toBe("water");
  });

  it("does not ask for water once the goal is met", () => {
    expect(resolveNextMove(on({ waterMl: 2500, waterGoalMl: 2500 })).id).toBe(
      "complete",
    );
    // Over the goal is still met — a passed target must not reopen.
    expect(resolveNextMove(on({ waterMl: 3200, waterGoalMl: 2500 })).id).toBe(
      "complete",
    );
  });

  it("treats a missing water goal as nothing to ask for", () => {
    // A zero goal would otherwise make `waterMl < waterGoalMl` false only by
    // luck; assert it explicitly so a divide-by-target never ships.
    expect(resolveNextMove(on({ waterMl: 0, waterGoalMl: 0 })).id).toBe(
      "complete",
    );
  });

  it("does not offer a session that is already done", () => {
    const move = resolveNextMove(
      on({
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: true,
      }),
    );

    expect(move.id).toBe("complete");
  });

  it("is total — an empty snapshot still resolves", () => {
    const move = resolveNextMove({
      minutesOfDay: 0,
      savedSession: null,
      meals: [],
      hasScheduledDiet: false,
      todaySession: null,
      hasPlan: false,
      workoutDoneToday: false,
      isRestDay: false,
      setupComplete: false,
      checkedInToday: false,
      daysSinceWeighIn: null,
      openConversation: null,
      waterMl: 0,
      waterGoalMl: 0,
      tomorrowFocus: null,
    });

    expect(move.id).toBe("build-plan");
  });
});

describe("resolveNextMove — what's missed, and the periodic prompts", () => {
  const EIGHT_PM = 20 * 60;

  it("offers a catch-up once a meal's window has closed unlogged", () => {
    // 16:00 — the lunch window shut at 15:00 and lunch is still empty.
    const move = resolveNextMove(
      on({
        minutesOfDay: FOUR_PM,
        meals: [
          meal("breakfast", "Oats", true),
          meal("lunch", "Chicken salad"),
          meal("dinner", "Salmon"),
        ],
      }),
    );

    expect(move.id).toBe("catchup-lunch");
    expect(move.caption).toBe("Earlier today");
  });

  it("asks about the most recent miss, not the oldest", () => {
    // Both breakfast and lunch were missed; at 4pm lunch is the live question.
    const move = resolveNextMove(
      on({
        minutesOfDay: FOUR_PM,
        meals: [meal("breakfast", "Oats"), meal("lunch", "Salad")],
      }),
    );

    expect(move.id).toBe("catchup-lunch");
  });

  it("ranks a catch-up below today's training", () => {
    // The session is time-sensitive; the record can be caught up later.
    const move = resolveNextMove(
      on({
        minutesOfDay: FOUR_PM,
        meals: [meal("lunch", "Salad")],
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: false,
      }),
    );

    expect(move.id).toBe("start-session");
  });

  it("never treats a meal as missed before its window has closed", () => {
    // 12:00 is INSIDE lunch — that's "due", not "missed".
    const move = resolveNextMove(
      on({ minutesOfDay: 12 * 60, meals: [meal("lunch", "Salad")] }),
    );
    expect(move.id).toBe("log-lunch");
  });

  it("asks for the check-in only once the evening can be reported on", () => {
    const morning = resolveNextMove(
      on({ minutesOfDay: NINE_AM, checkedInToday: false }),
    );
    expect(morning.id).not.toBe("checkin");

    const evening = resolveNextMove(
      on({ minutesOfDay: EIGHT_PM, checkedInToday: false }),
    );
    expect(evening.id).toBe("checkin");
    expect(evening.action).toEqual({ kind: "checkin" });
  });

  it("does not ask to check in twice in a day", () => {
    expect(
      resolveNextMove(on({ minutesOfDay: EIGHT_PM, checkedInToday: true })).id,
    ).toBe("complete");
  });

  it("offers a weigh-in on the interval, not daily", () => {
    expect(resolveNextMove(on({ daysSinceWeighIn: 3 })).id).toBe("complete");

    const due = resolveNextMove(on({ daysSinceWeighIn: 9 }));
    expect(due.id).toBe("weighin");
    expect(due.caption).toBe("9 days since the last");
    expect(due.action).toEqual({ kind: "weighin" });
  });

  it("offers a first weigh-in when there has never been one", () => {
    const move = resolveNextMove(on({ daysSinceWeighIn: null }));
    expect(move.id).toBe("weighin");
    expect(move.caption).toBe("Your first one");
  });

  it("stays quiet in the small hours", () => {
    // A weigh-in is due, but nothing should be asked for at 4am.
    const move = resolveNextMove(on({ minutesOfDay: 4 * 60, daysSinceWeighIn: 30 }));
    expect(move.id).not.toBe("weighin");
  });

  it("names a rest day rather than calling the day merely complete", () => {
    const move = resolveNextMove(on({ isRestDay: true }));
    expect(move.id).toBe("rest");
    expect(move.caption).toBe("Rest day — recovery counts");
    expect(move.tone).toBe("calm");
  });
});

describe("resolveNextMove — it never points at the screen you're on", () => {
  it("skips the meal rung on Diet and offers what Diet cannot do", () => {
    const day: Partial<NextMoveInput> = {
      minutesOfDay: NINE_AM,
      meals: [meal("breakfast", "Oats & berries")],
      todaySession: { focus: "Push Day", minutes: 42 },
      workoutDoneToday: false,
    };

    // From Home, logging breakfast is the move.
    expect(resolveNextMove(on({ ...day, currentHref: "/" })).id).toBe(
      "log-breakfast",
    );
    // From Diet, the meal list is already on screen — "go to Diet" would be a
    // button that does nothing, so the training rung takes over.
    expect(resolveNextMove(on({ ...day, currentHref: "/diet" })).id).toBe(
      "start-session",
    );
  });

  it("skips the unscheduled-day rung on Diet too", () => {
    const day: Partial<NextMoveInput> = {
      hasScheduledDiet: false,
      meals: [],
      todaySession: { focus: "Push Day", minutes: 42 },
      workoutDoneToday: false,
    };

    expect(resolveNextMove(on({ ...day, currentHref: "/" })).id).toBe(
      "plan-meals",
    );
    expect(resolveNextMove(on({ ...day, currentHref: "/diet" })).id).toBe(
      "start-session",
    );
  });

  it("sends the finished day home when the record is already open", () => {
    const fromHome = resolveNextMove(on({ currentHref: "/" }));
    expect(fromHome.action).toEqual({ kind: "route", href: "/logs" });

    const fromLogs = resolveNextMove(on({ currentHref: "/logs" }));
    expect(fromLogs.action).toEqual({ kind: "route", href: "/" });
    expect(fromLogs.caption).toBe("Back to today");
  });

  it("never suppresses a rung that does something rather than navigates", () => {
    // Water writes in place, so it stands on every screen including Diet.
    const move = resolveNextMove(
      on({ waterMl: 1000, waterGoalMl: 2500, currentHref: "/diet" }),
    );
    expect(move.id).toBe("water");
  });

  it("behaves exactly as before when no route is supplied", () => {
    const withoutHref = resolveNextMove(
      on({ minutesOfDay: NINE_AM, meals: [meal("breakfast", "Oats")] }),
    );
    expect(withoutHref.id).toBe("log-breakfast");
  });
});

describe("resolveNextMove — the conversation nobody finished", () => {
  const openChat = { topic: "Protein intake", nudgeSeed: 3 };
  /** After the check-in hour, so the rungs below this one are all reachable. */
  const EVENING = 20 * 60;

  it("offers it once the day's own work is clear", () => {
    const move = resolveNextMove(on({ openConversation: openChat }));
    expect(move.id).toBe("continue-chat");
    expect(move.caption).toBe("Protein intake");
    expect(move.action).toEqual({ kind: "route", href: "/gozlin" });
  });

  it("never displaces a meal that is due right now", () => {
    const move = resolveNextMove(
      on({
        minutesOfDay: NINE_AM,
        meals: [meal("breakfast", "Oats")],
        openConversation: openChat,
      }),
    );
    expect(move.id).toBe("log-breakfast");
  });

  it("never displaces today's session", () => {
    const move = resolveNextMove(
      on({
        todaySession: { focus: "Push Day", minutes: 42 },
        workoutDoneToday: false,
        openConversation: openChat,
      }),
    );
    expect(move.id).toBe("start-session");
  });

  it("outranks setup, the check-in and the weigh-in", () => {
    const move = resolveNextMove(
      on({
        minutesOfDay: EVENING,
        setupComplete: false,
        checkedInToday: false,
        daysSinceWeighIn: 30,
        openConversation: openChat,
      }),
    );
    expect(move.id).toBe("continue-chat");
  });

  it("says nothing on the coach screen itself", () => {
    const move = resolveNextMove(
      on({ openConversation: openChat, currentHref: "/gozlin" }),
    );
    expect(move.id).not.toBe("continue-chat");
  });

  it("varies its wording with the seed, and is deterministic for one", () => {
    const labels = new Set(
      Array.from(
        { length: 12 },
        (_, seed) =>
          resolveNextMove(on({ openConversation: { topic: "Sleep", nudgeSeed: seed } }))
            .label,
      ),
    );
    expect(labels.size).toBeGreaterThan(1);

    // Same seed, same words — the bar must not reshuffle while you look at it.
    const a = resolveNextMove(on({ openConversation: openChat })).label;
    const b = resolveNextMove(on({ openConversation: openChat })).label;
    expect(a).toBe(b);
  });

  it("is skipped entirely when there is no open thread", () => {
    expect(resolveNextMove(on({ openConversation: null })).id).toBe("complete");
  });
});

describe("mealDueAt — the clock windows", () => {
  const all = [
    meal("breakfast", "Oats"),
    meal("lunch", "Salad"),
    meal("dinner", "Salmon"),
  ];

  it("matches each slot inside its own window", () => {
    expect(mealDueAt(8 * 60, all)?.type).toBe("breakfast");
    expect(mealDueAt(12 * 60, all)?.type).toBe("lunch");
    expect(mealDueAt(19 * 60, all)?.type).toBe("dinner");
  });

  it("returns nothing between windows", () => {
    expect(mealDueAt(11 * 60, all)).toBeNull(); // after breakfast, before lunch
    expect(mealDueAt(16 * 60, all)).toBeNull(); // the afternoon gap
    expect(mealDueAt(23 * 60, all)).toBeNull(); // after dinner
    expect(mealDueAt(3 * 60, all)).toBeNull(); // the small hours
  });

  it("is closed at the start and open at the end", () => {
    // Locks the boundary convention so the windows can never double-match.
    const [start, end] = MEAL_WINDOWS.lunch;
    expect(mealDueAt(start, all)?.type).toBe("lunch");
    expect(mealDueAt(end, all)).toBeNull();
    expect(mealDueAt(end - 1, all)?.type).toBe("lunch");
  });

  it("windows never overlap", () => {
    const spans = Object.values(MEAL_WINDOWS)
      .map(([s, e]) => [s, e] as const)
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
    }
  });

  it("ignores a slot the day does not have", () => {
    // A two-meal day at breakfast time has no breakfast to ask about.
    expect(mealDueAt(8 * 60, [meal("lunch", "Salad"), meal("dinner", "Salmon")]))
      .toBeNull();
  });
});
