import { describe, expect, it } from "vitest";

import { compactDay, compactMonth, compactWeek } from "../memory/compaction";
import type { DaySummary } from "../memory/layers";
import { buildEvent, type HealthEvent } from "../timeline/events";

const NOW = 1_700_000_000_000;
const DAY = "2026-06-15";

/** A meal.logged event with calories (+ optional id/supersedes/redacted). */
function meal(
  name: string,
  calories: number,
  extra: Partial<HealthEvent> = {},
): HealthEvent {
  return {
    ...buildEvent({
      type: "nutrition.meal.logged",
      localDate: DAY,
      source: "user",
      payload: { name, calories, proteinG: calories / 10 },
      id: extra.id,
    }),
    ...extra,
  };
}

describe("compaction — compactDay", () => {
  it("folds meal calories as the sum of non-redacted logged meals (projection = fold)", () => {
    const events = [meal("a", 100), meal("b", 250), meal("c", 50)];
    const day = compactDay(events, DAY, { now: NOW });
    expect(day.nutrition.calories).toBe(400);
    expect(day.nutrition.mealsLogged).toBe(3);
    expect(day.nutrition.tracked).toBe(true);
  });

  it("excludes redacted events from every total", () => {
    const events = [
      meal("a", 100, { id: "m_a" }),
      meal("b", 250, { id: "m_b", redacted: true }),
    ];
    const day = compactDay(events, DAY, { now: NOW });
    expect(day.nutrition.calories).toBe(100);
    expect(day.nutrition.mealsLogged).toBe(1);
  });

  it("resolves a supersede-chain to the latest event", () => {
    const events = [
      meal("a", 100, { id: "m_a" }),
      meal("a (fixed)", 250, { id: "m_a~c1", supersedes: "m_a" }),
    ];
    const day = compactDay(events, DAY, { now: NOW });
    expect(day.nutrition.calories).toBe(250);
    expect(day.nutrition.mealsLogged).toBe(1); // the original is superseded, not double-counted
  });

  it("prefers the authoritative day-close rollup over the meal sum", () => {
    const events = [
      meal("a", 100),
      buildEvent({
        type: "nutrition.day.closed",
        localDate: DAY,
        source: "import",
        payload: {
          dietId: "x",
          dietName: "X",
          mealsConsumed: 3,
          totalMeals: 3,
          status: "completed",
          consumedCalories: 2000,
          consumedProteinG: 120,
        },
      }),
    ];
    const day = compactDay(events, DAY, { now: NOW });
    expect(day.nutrition.calories).toBe(2000);
    expect(day.nutrition.adherence).toBe(1); // 3/3, meals-based
    expect(day.nutrition.status).toBe("completed");
  });

  it("computes meals-based adherence from a partial day-close", () => {
    const day = compactDay(
      [
        buildEvent({
          type: "nutrition.day.closed",
          localDate: DAY,
          payload: {
            dietId: "x",
            dietName: "X",
            mealsConsumed: 2,
            totalMeals: 3,
            status: "partial",
          },
        }),
      ],
      DAY,
      { now: NOW },
    );
    expect(day.nutrition.adherence).toBeCloseTo(2 / 3, 3);
    expect(day.nutrition.status).toBe("partial");
  });

  it("reads hydration metGoal from the day-close event", () => {
    const day = compactDay(
      [
        buildEvent({
          type: "hydration.day.closed",
          localDate: DAY,
          payload: { ml: 2600, goalMl: 2500, metGoal: true },
        }),
      ],
      DAY,
      { now: NOW },
    );
    expect(day.hydration).toMatchObject({ ml: 2600, goalMl: 2500, metGoal: true, tracked: true });
  });

  it("folds workout completion + duration", () => {
    const day = compactDay(
      [
        buildEvent({
          type: "workout.session.completed",
          localDate: DAY,
          payload: {
            sessionId: "s1",
            sessionLabel: "Push",
            durationMinutes: 32,
            completionPercent: 90,
            exercisesCompleted: 5,
            totalExercises: 6,
            completedAt: `${DAY}T08:00:00+00:00`,
          },
        }),
      ],
      DAY,
      { now: NOW },
    );
    expect(day.workout).toMatchObject({ completed: true, durationMin: 32, completionPct: 90, sessions: 1 });
  });

  it("keeps the latest body + check-in of the day and counts milestones", () => {
    const day = compactDay(
      [
        buildEvent({ type: "body.measurement.logged", localDate: DAY, id: "b1", payload: { weightKg: 80 } }),
        buildEvent({ type: "body.measurement.logged", localDate: DAY, id: "b2", payload: { weightKg: 79.5 } }),
        buildEvent({ type: "checkin.logged", localDate: DAY, payload: { mood: 4, sleepHours: 7 } }),
        buildEvent({ type: "coach.episode", localDate: DAY, payload: { summary: "streak!", kind: "milestone" } }),
      ],
      DAY,
      { now: NOW },
    );
    expect(day.body?.weightKg).toBe(79.5); // latest by id order
    expect(day.checkin).toMatchObject({ mood: 4, sleepHours: 7 });
    expect(day.milestones).toBe(1);
  });

  it("ignores events from other days and reports an untracked empty day", () => {
    const otherDay: HealthEvent = { ...meal("o", 999), localDate: "2026-06-14" };
    const day = compactDay([otherDay], DAY, { now: NOW });
    expect(day.nutrition.tracked).toBe(false);
    expect(day.fromEventCount).toBe(0);
  });

  it("is deterministic — same events + fixed clock → identical summary", () => {
    const events = [meal("a", 120), meal("b", 80)];
    expect(compactDay(events, DAY, { now: NOW })).toEqual(compactDay(events, DAY, { now: NOW }));
  });
});

describe("compaction — period rollups", () => {
  const mkDay = (date: string, calories: number, metGoal: boolean, weightKg?: number): DaySummary =>
    compactDay(
      [
        buildEvent({
          type: "nutrition.day.closed",
          localDate: date,
          payload: { dietId: "x", dietName: "X", mealsConsumed: 3, totalMeals: 3, status: "completed", consumedCalories: calories },
        }),
        buildEvent({ type: "hydration.day.closed", localDate: date, payload: { ml: 2500, goalMl: 2500, metGoal } }),
        ...(weightKg != null
          ? [buildEvent({ type: "body.measurement.logged", localDate: date, payload: { weightKg } })]
          : []),
      ],
      date,
      { now: NOW },
    );

  it("averages nutrition + counts hydration goal days over a week", () => {
    const days = [mkDay("2026-06-15", 2000, true), mkDay("2026-06-16", 2200, false), mkDay("2026-06-17", 1800, true)];
    const week = compactWeek(days, "2026-06-15", { now: NOW });
    expect(week.nutrition.avgCalories).toBe(2000);
    expect(week.hydration.goalDays).toBe(2);
    expect(week.fromDayCount).toBe(3);
  });

  it("computes net weight change across a month from first/last weigh-in", () => {
    const days = [mkDay("2026-06-01", 2000, true, 80), mkDay("2026-06-20", 2000, true, 78.5)];
    const month = compactMonth(days, "2026-06", { now: NOW });
    expect(month.body).toMatchObject({ startWeightKg: 80, endWeightKg: 78.5, netKg: -1.5, weighIns: 2 });
  });
});
