/**
 * THE WINDOW CHECKS ITSELF (2026-11-20, Fix 8).
 *
 * Each of her recent completed cycles is forecast again as it stood the day
 * after that period began, and held against the start that came. From four
 * such forecasts, the count is said back exactly and the window's width is
 * scaled by it (./backtest).
 */
import { describe, expect, it } from "vitest";

import {
  backtest,
  BACKTEST_CYCLES,
  BACKTEST_SKIP_FIRST,
  BIAS_CORRECTION,
  biasShift,
  CALIBRATION_RANGE,
  calibrationScale,
  MIN_BACKTEST,
} from "../backtest";
import { calibrationLine } from "../copy";
import { addDays } from "../dates";
import { buildCycles, predict, todayStatus, type CycleProfile, type PredictInput } from "../predict";
import { planCycleReminders } from "../reminderPlan";
import { computeView } from "../view";
import { history, settings } from "./helpers";

const ADULT: CycleProfile = { age: 30, conditions: [] };
const S = settings({ usualCycleDays: 28 });

function input(lengths: number[], days = 3): PredictInput {
  const eps = history("2024-01-07", lengths);
  return { episodes: eps, days: {}, settings: S, today: addDays(eps[eps.length - 1].start, days), profile: ADULT };
}

describe("the count", () => {
  it(`checks her last ${BACKTEST_CYCLES} completed cycles, never her first ${BACKTEST_SKIP_FIRST}`, () => {
    const p = predict(input(Array(12).fill(28)))!;
    expect(p.calibration).toMatchObject({ n: BACKTEST_CYCLES });
  });

  it("a perfect forecaster: every one landed, and it says so exactly", () => {
    const p = predict(input(Array(10).fill(28)))!;
    expect(p.calibration).toMatchObject({ n: 6, hits: 6 });
    expect(calibrationLine(p)).toBe("6 of your last 6 forecasts landed inside the window.");
  });

  it(`too little to go on: below ${MIN_BACKTEST} checked forecasts, no count, no line, no scaling`, () => {
    const p = predict(input([28, 28, 28, 28, 28]))!; // 5 cycles: 3 checkable
    expect(p.calibration).toBeNull();
    expect(calibrationLine(p)).toBeNull();
    expect(calibrationScale(null)).toBe(1);
  });

  it("counts exactly the starts that fell inside the window it re-ran, using only what was logged by then", () => {
    // Nine cycles; the first two are skipped and the last six checked: 28, 28, 28, 40, 21, 28.
    const i = input([28, 28, 28, 28, 28, 28, 40, 21, 28]);
    const cycles = buildCycles(i.episodes, i.settings, i.today);
    const seen: string[] = [];
    // A stand-in forecast whose window is "the next 28 days": a start lands iff its cycle was ≤ 28 days.
    const run = (x: PredictInput) => {
      const p = predict(x)!;
      seen.push(x.today);
      expect(x.episodes.every((e) => e.start <= x.today)).toBe(true);
      expect(Object.keys(x.days).every((d) => d <= x.today)).toBe(true);
      return { ...p, earliest: x.today, latest: addDays(x.today, 27) };
    };
    const c = backtest(i, cycles, run)!;
    expect(c).toMatchObject({ n: 6, hits: 5 });
    expect(seen).toHaveLength(6);
  });
});

describe("it corrects the width", () => {
  it("a window that keeps missing widens", () => {
    // Steady for a long while, then much more variable: the old spread misses.
    const steady = Array(10).fill(28);
    const wild = [22, 36, 24, 35, 21, 37];
    const i = input([...steady, ...wild]);
    const p = predict(i)!;
    expect(p.calibration!.hits).toBeLessThan(p.calibration!.n);
    expect(calibrationScale(p.calibration)).toBeGreaterThan(1);
  });

  it("a very regular one tightens a little, never below a day either side", () => {
    expect(calibrationScale({ n: 6, hits: 6, meanError: 0 })).toBeLessThan(1);
    expect(calibrationScale({ n: 6, hits: 6, meanError: 0 })).toBeGreaterThanOrEqual(CALIBRATION_RANGE.min);
    const p = predict(input(Array(14).fill(28)))!;
    expect(p.halfWidth).toBeGreaterThanOrEqual(1);
  });

  it("stays within its range, and pulls harder the more forecasts it has", () => {
    expect(calibrationScale({ n: 6, hits: 0, meanError: 0 })).toBeLessThanOrEqual(CALIBRATION_RANGE.max);
    const four = calibrationScale({ n: 4, hits: 2, meanError: 0 });
    const six = calibrationScale({ n: 6, hits: 3, meanError: 0 });
    expect(six).toBeGreaterThan(four);
    expect(four).toBeGreaterThan(1);
  });

  it("the lean shift is off: the simulator showed it hurt more people than it helped", () => {
    expect(BIAS_CORRECTION).toBe(false);
    expect(biasShift({ n: 6, hits: 2, meanError: 4 })).toBe(0);
  });
});

describe("one plan everywhere, and fast", () => {
  it("the lean reminder path reads the same calibrated window as the view", () => {
    const i = input([28, 30, 27, 33, 26, 31, 29, 34, 25, 30]);
    const view = computeView({ settings: S, periods: [...i.episodes], days: {} }, { today: i.today, profile: ADULT });
    const prediction = predict(i);
    expect(prediction).toEqual(view.prediction);
    const now = new Date(2024, 11, 1, 8);
    expect(planCycleReminders({ settings: S, status: todayStatus(i, prediction), prediction, now })).toEqual(
      planCycleReminders({ settings: S, status: view.status, prediction: view.prediction, now }),
    );
  });

  it("the whole view over 120 cycles of history stays quick", () => {
    const lengths = Array.from({ length: 120 }, (_, k) => 26 + ((k * 7) % 7));
    const i = input(lengths);
    const data = { settings: S, periods: [...i.episodes], days: {} };
    computeView(data, { today: i.today, profile: ADULT }); // warm-up
    // The FASTEST of several batches: a test runner sharing the machine with
    // a hundred other files slows some batches down, never the code itself.
    let best = Infinity;
    for (let batch = 0; batch < 6; batch += 1) {
      const t0 = performance.now();
      for (let r = 0; r < 5; r += 1) computeView(data, { today: i.today, profile: ADULT });
      best = Math.min(best, (performance.now() - t0) / 5);
    }
    if (process.env.REPORT) console.log(`computeView, 120 cycles: ${best.toFixed(2)} ms`);
    // "A few milliseconds" on a laptop; the bound leaves room for a slow CI box.
    expect(best).toBeLessThan(40);
  });
});
