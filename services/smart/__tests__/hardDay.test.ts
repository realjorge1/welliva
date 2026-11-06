/**
 * The hard weekday — exactly what the sentence claims: planned sessions on that
 * weekday against workouts logged on it, over completed days, rough days and
 * unknown weeks left out. And the short session, built by the engine.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { EXERCISE_DATABASE } from "../../../constants/ExerciseDatabase";
import type { UserBio } from "../../../models/user";
import { shiftDay } from "../../commitment";
import { resolveTrainingPrefs } from "../../training/prefs";
import { shortenSession } from "../../training/lighten";
import { buildTrainingWeek } from "../../training/week";
import {
  HARD_MIN_MISSED,
  PLANNED_DAYS_KEY,
  SHORT_MINUTES,
  SHORT_WEEKDAYS_KEY,
  SHORT_WEEKS,
  activeShortDay,
  endWeekdayShort,
  findHardWeekday,
  habitDayCopy,
  habitDayOffer,
  hardDayCopy,
  loadPlannedDays,
  loadShortWeekdays,
  makeWeekdayShort,
  offerDue,
  recordPlanWeek,
  reviewCopy,
  shortReviewDue,
  withPlanWeek,
  type PlannedDays,
} from "../hardDay";

// 2026-11-19 is a Thursday; "today" is the Friday after it.
const TODAY = "2026-11-20";
const thursdays = [0, 1, 2, 3, 4, 5].map((w) => shiftDay("2026-11-19", -7 * w));
const mondays = [0, 1, 2, 3, 4, 5].map((w) => shiftDay("2026-11-16", -7 * w));

function plannedOn(dates: string[]): PlannedDays {
  const out: PlannedDays = {};
  for (const d of dates) out[d] = { planned: true, sessionId: "s", updatedAt: "2026-01-01T00:00:00.000Z" };
  return out;
}

const none = new Set<string>();

describe("findHardWeekday", () => {
  const planned = plannedOn([...thursdays, ...mondays]);

  it("finds the weekday missed 3+ of the last 5, while other days go well", () => {
    // Thursdays: only the oldest of the last five was done. Mondays: all done.
    const workouts = new Set([...mondays, thursdays[4]]);
    const hard = findHardWeekday({ planned, workoutDates: workouts, roughDates: none, today: TODAY });
    expect(hard).toEqual({ weekday: 3, recent: 5, missed: 4 });
  });

  it("says nothing with fewer than four planned on that weekday", () => {
    const few = plannedOn([...thursdays.slice(0, 3), ...mondays]);
    expect(findHardWeekday({ planned: few, workoutDates: new Set(mondays), roughDates: none, today: TODAY })).toBeNull();
  });

  it("says nothing when missed fewer than three", () => {
    const workouts = new Set([...mondays, thursdays[0], thursdays[1], thursdays[2]]);
    expect(findHardWeekday({ planned, workoutDates: workouts, roughDates: none, today: TODAY })).toBeNull();
    expect(HARD_MIN_MISSED).toBe(3);
  });

  it("says nothing when everything is slipping, not just that day", () => {
    const workouts = new Set([mondays[0], mondays[1]]); // Mondays at 2 of 6
    expect(findHardWeekday({ planned, workoutDates: workouts, roughDates: none, today: TODAY })).toBeNull();
  });

  it("says nothing without other days to compare against", () => {
    expect(
      findHardWeekday({ planned: plannedOn(thursdays), workoutDates: none, roughDates: none, today: TODAY }),
    ).toBeNull();
  });

  it("doesn't count a rough day as a miss", () => {
    const workouts = new Set([...mondays, thursdays[4]]);
    const rough = new Set([thursdays[0], thursdays[1]]);
    const hard = findHardWeekday({ planned, workoutDates: workouts, roughDates: rough, today: TODAY });
    // Without those two the last five are thursdays 2,3,4,5 — three missed of four.
    expect(hard).toEqual({ weekday: 3, recent: 4, missed: 3 });
  });

  it("doesn't count today, which isn't over, or a re-plan that took the day away", () => {
    const withToday = plannedOn([...thursdays.slice(0, 4), ...mondays, TODAY]);
    const hard = findHardWeekday({ planned: withToday, workoutDates: new Set(mondays), roughDates: none, today: TODAY });
    expect(hard?.weekday).toBe(3);
    const unplanned = { ...planned, [thursdays[0]]: { planned: false, updatedAt: "x" } };
    const again = findHardWeekday({ planned: unplanned, workoutDates: new Set(mondays), roughDates: none, today: TODAY });
    expect(again?.recent).toBe(5);
    expect(thursdays.slice(1, 6).length).toBe(5);
  });
});

describe("withPlanWeek", () => {
  const plan = {
    weekStart: "2026-11-16",
    sessions: [
      { id: "mon", dayOfWeek: 0, isRestDay: false },
      { id: "thu", dayOfWeek: 3, isRestDay: false },
    ],
  } as never;

  it("records today onward, and never rewrites a day already gone", () => {
    const out = withPlanWeek({}, plan, "2026-11-17", new Date(2026, 10, 17, 9));
    expect(out["2026-11-16"]).toBeUndefined();
    expect(out["2026-11-19"]).toMatchObject({ planned: true, sessionId: "thu" });
  });

  it("takes a day back when a re-plan removes it", () => {
    const first = withPlanWeek({}, plan, "2026-11-17", new Date(2026, 10, 17, 9));
    const replanned = { weekStart: "2026-11-16", sessions: [{ id: "fri", dayOfWeek: 4, isRestDay: false }] } as never;
    const out = withPlanWeek(first, replanned, "2026-11-18", new Date(2026, 10, 18, 9));
    expect(out["2026-11-19"].planned).toBe(false);
    expect(out["2026-11-20"]).toMatchObject({ planned: true, sessionId: "fri" });
  });

  it("is written only for the week it is", async () => {
    await AsyncStorage.removeItem(PLANNED_DAYS_KEY);
    await recordPlanWeek(plan, new Date(2026, 10, 25, 9));
    expect(await loadPlannedDays()).toEqual({});
    await recordPlanWeek(plan, new Date(2026, 10, 17, 9));
    expect((await loadPlannedDays())["2026-11-19"].planned).toBe(true);
  });
});

describe("offerDue", () => {
  it("the evening before, or the morning of", () => {
    expect(offerDue(3, "2026-11-18", 18)).toBe(true); // Wednesday evening
    expect(offerDue(3, "2026-11-18", 12)).toBe(false); // Wednesday noon
    expect(offerDue(3, "2026-11-19", 9)).toBe(true); // Thursday morning
    expect(offerDue(3, "2026-11-19", 15)).toBe(false); // Thursday afternoon
    expect(offerDue(3, "2026-11-17", 20)).toBe(false); // Tuesday
  });
});

describe("the short weekday", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(SHORT_WEEKDAYS_KEY);
  });

  it("lasts four weeks and then stops applying", async () => {
    await makeWeekdayShort(3, new Date(2026, 10, 18, 18));
    const list = await loadShortWeekdays();
    expect(activeShortDay(list, "2026-11-19")?.weekday).toBe(3);
    expect(activeShortDay(list, "2026-11-20")).toBeNull(); // a Friday
    expect(activeShortDay(list, shiftDay("2026-11-18", SHORT_WEEKS * 7 + 1))).toBeNull();
  });

  it("goes back to full as a tombstone", async () => {
    await makeWeekdayShort(3, new Date(2026, 10, 18, 18));
    await endWeekdayShort(3, new Date(2026, 10, 20, 9));
    const list = await loadShortWeekdays();
    expect(list[0].deleted).toBe(true);
    expect(activeShortDay(list, "2026-11-19")).toBeNull();
  });

  it("asks once it ends, with the real numbers", () => {
    const shortDays = [
      { id: "short:3", weekday: 3, since: "2026-10-22", until: "2026-11-18", updatedAt: "x" },
    ];
    const planned = plannedOn(["2026-10-22", "2026-10-29", "2026-11-05", "2026-11-12", "2026-11-19"]);
    const review = shortReviewDue({
      shortDays,
      planned,
      workoutDates: new Set(["2026-10-22", "2026-10-29", "2026-11-05", "2026-11-12"]),
      roughDates: none,
      today: TODAY,
    })!;
    // 11-19 is past the run's end, so it isn't one of these.
    expect(review).toMatchObject({ weekday: 3, planned: 4, done: 4 });
    expect(reviewCopy(review).message).toBe("Thursdays have gone better: 4 of the last 4. Keep them short?");
    expect(reviewCopy({ ...review, done: 1 }).message).toBe("Short Thursdays: 1 of the last 4 done. Keep them short?");
  });

  it("says exactly what was counted", () => {
    expect(hardDayCopy({ weekday: 3, recent: 5, missed: 4 }).message).toBe(
      "Thursdays are your toughest: you missed 4 of the last 5 planned workouts on a Thursday. Want a 15-minute Thursday?",
    );
  });
});

describe("habitDayOffer", () => {
  const habit = {
    id: "h1",
    name: "Stretch",
    days: [0, 3],
    weeklyGoal: null,
    createdAt: "2026-01-01",
    source: "manual",
  };
  // Mondays all done; Thursdays: only the oldest of the last five.
  const done = new Set([...mondays, thursdays[4]]);

  it("offers to move a weekday missed 4 of the last 5, while the others go well", () => {
    const offer = habitDayOffer({ habit, done, paused: none, today: TODAY })!;
    expect(offer).toMatchObject({ weekday: 3, missed: 4, recent: 5, kind: "habit-day" });
    expect(habitDayCopy(offer).message).toBe("You missed this on 4 of the last 5 Thursdays. Move it off Thursdays?");
  });

  it("not when everything's slipping", () => {
    expect(habitDayOffer({ habit, done: new Set(), paused: none, today: TODAY })).toBeNull();
  });

  it("not for a quota habit, a one-day habit, or one too new to say", () => {
    expect(habitDayOffer({ habit: { ...habit, weeklyGoal: 2 }, done, paused: none, today: TODAY })).toBeNull();
    expect(habitDayOffer({ habit: { ...habit, days: [3] }, done, paused: none, today: TODAY })).toBeNull();
    expect(habitDayOffer({ habit: { ...habit, createdAt: "2026-11-01" }, done, paused: none, today: TODAY })).toBeNull();
  });

  it("doesn't count a rough day as a miss", () => {
    // One rough Thursday: the last five reach one further back instead.
    const oneOff = habitDayOffer({ habit, done, paused: new Set([thursdays[0]]), today: TODAY })!;
    expect(oneOff).toMatchObject({ weekday: 3, missed: 4, recent: 5 });
    // Two: only four Thursdays are left in the window, which is too few to say.
    expect(habitDayOffer({ habit, done, paused: new Set([thursdays[0], thursdays[1]]), today: TODAY })).toBeNull();
  });
});

describe("shortenSession — built by the engine", () => {
  const bio = {
    age: 28,
    sex: "male",
    heightCm: 180,
    weightKg: 76,
    activityLevel: "active",
    exerciseLevel: "intermediate",
    primaryGoal: "improve_fitness",
    goals: ["improve_fitness", "lose_weight"],
    trainingEnabled: true,
    dietaryRestriction: "none",
    allergies: [],
    medicalConditions: [],
    mealsPerDay: 3,
    equipment: ["none"],
    workoutDaysPerWeek: 3,
  } as UserBio;
  const plan = buildTrainingWeek({
    bio,
    prefs: resolveTrainingPrefs(bio, null),
    sessions: [],
    weekStart: "2026-10-05",
    today: "2026-10-05",
    pool: EXERCISE_DATABASE,
    now: new Date("2026-10-05T07:00:00.000Z"),
  });
  const full = plan.sessions[0];
  const reason = { headline: "A short Thursday, as you asked", dose: "Trimmed" };
  const work = (s: typeof full) => s.exercises.filter((e) => (e.block ?? "main") === "main");

  it("fits about fifteen minutes, keeps warm-up and cool-down, invents nothing", () => {
    expect(full.totalDurationMinutes).toBeGreaterThan(SHORT_MINUTES);
    const out = shortenSession(full, SHORT_MINUTES, EXERCISE_DATABASE, reason)!;
    expect(out.session.totalDurationMinutes).toBeLessThanOrEqual(SHORT_MINUTES + 3);
    expect(work(out.session).length).toBeGreaterThanOrEqual(1);
    const ids = new Set(full.exercises.map((e) => e.exerciseId));
    expect(out.session.exercises.every((e) => ids.has(e.exerciseId))).toBe(true);
    expect(out.session.exercises.filter((e) => e.block === "warmup").length).toBe(
      full.exercises.filter((e) => e.block === "warmup").length,
    );
    expect(out.changes[0]).toBe(reason.headline);
    expect(out.changes.at(-1)).toMatch(/^About \d+ minutes$/);
  });

  it("drops the least important first, so a main move stays", () => {
    const out = shortenSession(full, 1, EXERCISE_DATABASE, reason)!;
    expect(work(out.session)).toHaveLength(1);
    expect(work(out.session)[0].role).toBe("main");
  });

  it("leaves a session that already fits", () => {
    expect(shortenSession(full, 500, EXERCISE_DATABASE, reason)).toBeNull();
  });
});
