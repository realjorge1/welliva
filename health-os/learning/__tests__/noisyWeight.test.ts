/**
 * The calorie filter and a scale it knows is unreliable.
 *
 * Before a period the scale can read water. Told which days, the filter trusts
 * them less, so a temporary rise isn't read as stored calories. Nothing is
 * subtracted: nobody knows the true size of the water that day. The job takes the
 * dates from outside because this package must not know why (health-os never
 * imports services/cycle), and it refits from scratch, so a date learned today
 * also corrects the past.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "../../__tests__/helpers/MemoryStore";
import { K } from "../../platform/storage/keys";
import { timeline } from "../../timeline";
import { runDailyLearning } from "../engine";
import { initKalman, NOISY_SCALE_FACTOR, read, runFilter, step } from "../tdee";
import type { KalmanState } from "../types";

const TDEE = 2000;
const DAYS = 60;
/** The last week of a flat-weight series reads 1.2 kg high: water, not mass. */
const series = (noisy: boolean) =>
  Array.from({ length: DAYS }, (_, i) => {
    const rising = i >= DAYS - 7;
    return { intakeKcal: TDEE, scaleKg: rising ? 61.2 : 60, noisy: noisy && rising };
  });

describe("the filter", () => {
  it("takes the noisy reading as a reading, just a less trusted one", () => {
    expect(NOISY_SCALE_FACTOR).toBe(4);
    const start = initKalman(60, TDEE);
    const plain = step(start, TDEE, 61, false);
    const noisy = step(start, TDEE, 61, true);
    expect(noisy.observations).toBe(plain.observations);
    expect(Math.abs(noisy.w - 60)).toBeLessThan(Math.abs(plain.w - 60));
    expect(noisy.w).toBeGreaterThan(60);
  });

  it("is unchanged for everyone else: the default is the old behaviour", () => {
    const start = initKalman(60, TDEE);
    expect(step(start, TDEE, 61)).toEqual(step(start, TDEE, 61, false));
    const without = series(false).map(({ intakeKcal, scaleKg }) => ({ intakeKcal, scaleKg }));
    expect(runFilter(start, without)).toEqual(runFilter(start, series(false)));
  });

  it("doesn't read a week of water as stored calories", () => {
    const start = initKalman(60, TDEE);
    const plain = runFilter(start, series(false));
    const told = runFilter(start, series(true));
    const miss = (s: KalmanState) => Math.abs(read(s).learnedTdee - TDEE);
    expect(miss(told)).toBeLessThan(miss(plain));
    expect(Math.abs(told.w - 60)).toBeLessThan(Math.abs(plain.w - 60));
  });
});

describe("the daily job", () => {
  afterEach(() => vi.restoreAllMocks());

  const date = (i: number) => {
    const d = new Date(2026, 0, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const events = Array.from({ length: DAYS }, (_, i) => [
    { type: "nutrition.day.closed", localDate: date(i), payload: { consumedCalories: TDEE, totalMeals: 0, mealsConsumed: 0 } },
    { type: "body.measurement.logged", localDate: date(i), payload: { weightKg: i >= DAYS - 7 ? 61.2 : 60 } },
  ]).flat();

  async function fit(noisyWeightDates?: readonly string[]) {
    vi.spyOn(timeline, "query").mockResolvedValue(events as never);
    const store = new MemoryStore();
    await runDailyLearning({
      mifflinTdee: TDEE,
      weightKg: 60,
      store,
      now: new Date(2026, 0, DAYS, 12),
      ...(noisyWeightDates ? { noisyWeightDates } : {}),
    });
    return store.get<KalmanState>(K.LEARNING_TDEE, null as never);
  }

  it("passes the dates it is given to the filter", async () => {
    const plain = await fit();
    const told = await fit(Array.from({ length: 7 }, (_, i) => date(DAYS - 7 + i)));
    expect(Math.abs(told.w - 60)).toBeLessThan(Math.abs(plain.w - 60));
    expect(Math.abs(read(told).learnedTdee - TDEE)).toBeLessThan(Math.abs(read(plain).learnedTdee - TDEE));
  });

  it("gives the same answer with no dates as with an empty list", async () => {
    expect(await fit([])).toEqual(await fit());
  });

  it("refits from scratch: told about past days, it corrects the past", async () => {
    const first = await fit();
    const later = await fit(Array.from({ length: 7 }, (_, i) => date(DAYS - 7 + i)));
    expect(later).not.toEqual(first);
    // And running it again changes nothing.
    expect(await fit(Array.from({ length: 7 }, (_, i) => date(DAYS - 7 + i)))).toEqual(later);
  });
});
