/**
 * LEARNING REPLAY — ten weeks of one synthetic person, through the real series
 * builder and the real filter.
 *
 * She truly burns 2,200 kcal a day and truly eats 1,700. The formula guessed
 * her at 2,000. She weighs in every third day on a scale that wobbles about
 * ±0.4 kg. What changes between runs is only her LOGGING habit:
 *
 *   complete  — every day logged in full
 *   partial   — 3 days in 10 she logs only a 300 kcal snack and stops
 *   unlogged  — 3 days in 10 she logs nothing (the day-close writes 0 kcal)
 *   underlog  — every day logged, but at 75% of what she ate (the real-world
 *               norm: free-living logs run 20–30% low)
 *
 * The 2026-11-16 audit found the filter reading an unlogged day as a starving
 * day and a one-snack day as a whole one. A missing value is not zero: those
 * days must reach the filter as unknown, and the weight's uncertainty — not
 * an assumed intake — has to carry them.
 */
import { describe, expect, it } from "vitest";

import { buildEvent, type HealthEvent } from "../../timeline/events";
import type { BodyMeasurementPayload, NutritionDayClosedPayload } from "../../timeline/catalog";
import { buildSeries } from "../engine";
import { initKalman, read, runFilter } from "../tdee";

const TRUE_TDEE = 2200;
const TRUE_INTAKE = 1700;
const FORMULA_TDEE = 2000;
/** Her calorie target: what "a complete day" is judged against. */
const TARGET_KCAL = 1700;
const DAYS = 70;
const START_KG = 85;

type Habit = "complete" | "partial" | "unlogged" | "underlog";

const date = (i: number) => {
  const d = new Date(2026, 0, 5 + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Deterministic noise: Lehmer generator → Box–Muller. */
function gaussian(seed: number) {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return (sd: number) => {
    const u = Math.max(1e-9, next());
    const v = next();
    return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/** Days 3, 6, 9 of every 10 are the "off" days for the partial/unlogged habits. */
const offDay = (i: number) => i % 10 === 3 || i % 10 === 6 || i % 10 === 9;

export function personEvents(habit: Habit, seed = 42): HealthEvent[] {
  const noise = gaussian(seed);
  const events: HealthEvent[] = [];
  let trueKg = START_KG;
  for (let i = 0; i < DAYS; i++) {
    const localDate = date(i);
    let logged = TRUE_INTAKE;
    let meals = 3;
    if (habit === "underlog") logged = Math.round(TRUE_INTAKE * 0.75);
    if (habit === "partial" && offDay(i)) {
      logged = 300;
      meals = 1;
    }
    if (habit === "unlogged" && offDay(i)) {
      logged = 0;
      meals = 0;
    }
    events.push(
      buildEvent<NutritionDayClosedPayload>({
        type: "nutrition.day.closed",
        id: `day-${i}`,
        localDate,
        source: "app",
        payload: {
          dietId: "everyday",
          dietName: "Everyday",
          mealsConsumed: meals,
          totalMeals: 3,
          status: meals === 3 ? "completed" : meals > 0 ? "partial" : "skipped",
          consumedCalories: logged,
          consumedProteinG: Math.round(logged * 0.025),
          consumedCarbsG: Math.round(logged * 0.12),
          consumedFatG: Math.round(logged * 0.033),
        },
      }),
    );
    trueKg += (TRUE_INTAKE - TRUE_TDEE) / 7700;
    if (i % 3 === 0) {
      events.push(
        buildEvent<BodyMeasurementPayload>({
          type: "body.measurement.logged",
          id: `w-${i}`,
          localDate,
          source: "app",
          payload: { weightKg: Number((trueKg + noise(0.4)).toFixed(1)) },
        }),
      );
    }
  }
  return events;
}

export function learn(habit: Habit, seed = 42) {
  const events = personEvents(habit, seed);
  const series = buildSeries(events, date(DAYS - 1), { targetKcal: TARGET_KCAL });
  const first = series.find((r) => r.weightKg !== null)!.weightKg!;
  const state = runFilter(
    initKalman(first, FORMULA_TDEE),
    series.map((r) => ({ intakeKcal: r.intakeKcal, scaleKg: r.weightKg })),
  );
  return { series, state, reading: read(state) };
}

describe("report", () => {
  it("prints the replay table (REPORT=1)", () => {
    if (!process.env.REPORT) return;
    console.table(
      (["complete", "partial", "unlogged", "underlog"] as const).map((habit) => {
        const { reading, series } = learn(habit);
        return {
          habit,
          learnedTdee: reading.learnedTdee,
          missVsTruth: reading.learnedTdee - TRUE_TDEE,
          sd: reading.uncertainty,
          confident: reading.confident,
          daysWithIntake: series.filter((r) => r.intakeKcal !== null).length,
          zeroIntakeDays: series.filter((r) => r.intakeKcal === 0).length,
        };
      }),
    );
  });
});

describe("unknown is not zero", () => {
  it("an unlogged day reaches the filter as unknown, never as 0", () => {
    const { series } = learn("unlogged");
    expect(series.filter((r) => r.intakeKcal === 0)).toHaveLength(0);
    const off = series.filter((_, i) => offDay(i));
    expect(off.every((r) => r.intakeKcal === null)).toBe(true);
  });

  it("a one-snack day reaches the filter as unknown, not as a whole day", () => {
    const { series } = learn("partial");
    expect(series.filter((_, i) => offDay(i)).every((r) => r.intakeKcal === null)).toBe(true);
    expect(series.filter((_, i) => !offDay(i)).every((r) => r.intakeKcal === TRUE_INTAKE)).toBe(true);
  });
});

describe("the filter lands on her real burn", () => {
  it("a complete logger: within 150 kcal of the truth", () => {
    const { reading } = learn("complete");
    expect(Math.abs(reading.learnedTdee - TRUE_TDEE)).toBeLessThanOrEqual(150);
  });

  it.each(["partial", "unlogged"] as const)("a %s logger is not dragged down by the missing days", (habit) => {
    const { reading } = learn(habit);
    expect(Math.abs(reading.learnedTdee - TRUE_TDEE)).toBeLessThanOrEqual(150);
  });

  it("an under-logger gets the right deficit FOR HER LOGGING", () => {
    // She logs 1,275 of the 1,700 she eats. The filter should learn a burn
    // ~425 below the truth, so that "learned − logged" is still her real 500
    // deficit: targets built from it produce the change she asked for.
    const { reading } = learn("underlog");
    const logged = Math.round(TRUE_INTAKE * 0.75);
    expect(Math.abs(reading.learnedTdee - logged - (TRUE_TDEE - TRUE_INTAKE))).toBeLessThanOrEqual(150);
  });
});

describe("a silent week", () => {
  const silent = (from: number, to: number) =>
    personEvents("complete").filter(
      (e) => !(e.type === "nutrition.day.closed" && e.localDate >= date(from) && e.localDate < date(to)),
    );
  const fitTo = (events: HealthEvent[], n: number) => {
    const series = buildSeries(events, date(DAYS - 1), { targetKcal: TARGET_KCAL });
    return runFilter(
      initKalman(START_KG, FORMULA_TDEE),
      series.slice(0, n).map((r) => ({ intakeKcal: r.intakeKcal, scaleKg: r.weightKg })),
    );
  };

  it("grows the weight's uncertainty beyond a logged week's", () => {
    // Day 46 has no weigh-in (46 % 3 ≠ 0), so both runs end on a predict step.
    const known = fitTo(personEvents("complete"), 47);
    const unknown = fitTo(silent(40, 47), 47);
    // Seven unknown days add at least most of 7 × 0.15² kg² over a logged week.
    expect(unknown.P[0][0]).toBeGreaterThan(known.P[0][0] + 0.05);
  });

  it("invents nothing about her burn while she is silent", () => {
    // No weigh-ins and no intake: the burn estimate must not move at all.
    const series = buildSeries(silent(40, 47), date(DAYS - 1), { targetKcal: TARGET_KCAL });
    const steps = series.map((r) => ({ intakeKcal: r.intakeKcal, scaleKg: null as number | null }));
    const at = (n: number) => runFilter(initKalman(START_KG, FORMULA_TDEE), steps.slice(0, n));
    expect(at(47).e).toBe(at(40).e);
  });
});
