/**
 * "COULD NOT READ" IS NOT "ATE NOTHING".
 *
 * The launch read loads a day's intake from two documents. When that was one
 * `await` chain over both, the first failure decided both — and what the
 * provider was left holding was the value it mounted with: zero. On screen that
 * is a day with its meals still ticked and a 0% ring, which is the report this
 * whole subsystem exists to answer, arriving by a second route.
 *
 * These pin the distinction: a half that could not be read comes back null (the
 * caller keeps what it had), and ZERO is reserved for a day that genuinely
 * records nothing.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KEYS } from "../../OfflineStorage";
import * as ledger from "../IntakeLedger";
import * as logStore from "../foodLogStore";
import { readDayIntake } from "../todayIntake";

const DATE = "2026-08-30";

beforeEach(async () => {
  vi.restoreAllMocks();
  // Never let a console.error from a deliberately-failing read fail the run.
  vi.spyOn(console, "error").mockImplementation(() => {});
  await AsyncStorage.multiRemove([KEYS.INTAKE_LEDGER, KEYS.FOOD_LOG]);
});

const record = (kcal: number) => ({
  slot: "breakfast" as const,
  name: "Oats",
  calories: kcal,
  proteinG: 20,
  carbsG: 40,
  fatG: 10,
  at: new Date().toISOString(),
});

describe("readDayIntake", () => {
  it("sums both halves, unrounded", async () => {
    await AsyncStorage.setItem(
      KEYS.INTAKE_LEDGER,
      JSON.stringify({ [DATE]: [record(420.5)] }),
    );
    await AsyncStorage.setItem(
      KEYS.FOOD_LOG,
      JSON.stringify({
        [DATE]: [{ totals: { calories: 100.5, protein: 5, carbs: 27, fat: 0 } }],
      }),
    );

    const { intake, foodLog } = await readDayIntake(DATE);
    // Unrounded: rounding here, then again on the sum, is how a card's total
    // ends up a kilocalorie off the numbers printed beneath it.
    expect(intake?.calories).toBe(420.5);
    expect(foodLog?.calories).toBe(100.5);
  });

  it("reports a genuinely empty day as ZERO, not as unreadable", async () => {
    const { intake, foodLog } = await readDayIntake(DATE);
    expect(intake).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    expect(foodLog).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("reports an unreadable ledger as null, NEVER as zero", async () => {
    vi.spyOn(ledger, "getIntakeForDate").mockRejectedValue(new Error("disk"));

    const { intake } = await readDayIntake(DATE);
    expect(intake).toBeNull();
  });

  it("a failed half does not take the other half down with it", async () => {
    await AsyncStorage.setItem(
      KEYS.FOOD_LOG,
      JSON.stringify({
        [DATE]: [{ totals: { calories: 250, protein: 5, carbs: 27, fat: 0 } }],
      }),
    );
    vi.spyOn(ledger, "getIntakeForDate").mockRejectedValue(new Error("disk"));

    const { intake, foodLog } = await readDayIntake(DATE);
    expect(intake).toBeNull();
    expect(foodLog?.calories).toBe(250);
  });

  it("survives an unreadable food log the same way", async () => {
    await AsyncStorage.setItem(
      KEYS.INTAKE_LEDGER,
      JSON.stringify({ [DATE]: [record(420)] }),
    );
    vi.spyOn(logStore, "getFoodLogForDate").mockRejectedValue(new Error("disk"));

    const { intake, foodLog } = await readDayIntake(DATE);
    expect(intake?.calories).toBe(420);
    expect(foodLog).toBeNull();
  });
});
