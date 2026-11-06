/**
 * The adapters — each existing record read as routine samples — and the one
 * new field they rely on: the first glass of the day, kept past midnight.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import type { FoodLogEntry } from "../../nutrition/foodLogStore";
import type { IntakeRecord } from "../../nutrition/IntakeLedger";
import { archiveWaterDay, getWaterHistory, KEYS } from "../../OfflineStorage";
import { readRoutine } from "../clock";
import { checkinSamples, firstWaterSamples, mealSlotSamples, workoutSamples } from "../sources";

const pad = (x: number) => String(x).padStart(2, "0");
const day = (n: number) => `2026-11-${pad(n)}`;

function intake(slot: IntakeRecord["slot"], date: string, hh: number, mm: number): IntakeRecord {
  return { slot, name: "Oats", calories: 300, proteinG: 10, carbsG: 50, fatG: 6, at: `${date}T${pad(hh)}:${pad(mm)}:00+00:00` };
}

function food(slot: FoodLogEntry["slot"], date: string, hh: number, mm: number): FoodLogEntry {
  return {
    id: `f-${date}-${hh}${mm}`,
    date,
    slot,
    label: "coffee",
    items: [],
    totals: {} as FoodLogEntry["totals"],
    partialKeys: [],
    confidence: "verified" as FoodLogEntry["confidence"],
    origin: "manual",
    loggedAt: `${date}T${pad(hh)}:${pad(mm)}:00+00:00`,
  };
}

beforeEach(async () => {
  await AsyncStorage.multiRemove([KEYS.WATER_HISTORY]);
});

describe("mealSlotSamples", () => {
  it("reads a slot from both the ticks and the food log, earliest per day", () => {
    const ledger: Record<string, IntakeRecord[]> = {};
    const log: Record<string, FoodLogEntry[]> = {};
    for (let n = 1; n <= 8; n++) {
      const date = day(n);
      // Ticked the planned breakfast on odd days, logged it freely on even.
      if (n % 2) ledger[date] = [intake("breakfast", date, 8, 10), intake("lunch", date, 13, 0)];
      else log[date] = [food("breakfast", date, 8, 5), food("breakfast", date, 8, 20)];
    }
    const samples = mealSlotSamples(ledger, log, "breakfast");
    expect(samples.every((s) => s.at.includes("T08:"))).toBe(true);
    const r = readRoutine(samples, day(8))!;
    expect(r.count).toBe(8);
    expect(r.medianMinute).toBeGreaterThanOrEqual(8 * 60 + 5);
    expect(r.medianMinute).toBeLessThanOrEqual(8 * 60 + 10);
  });

  it("never reads another slot", () => {
    const ledger = { [day(1)]: [intake("lunch", day(1), 13, 0)] };
    expect(mealSlotSamples(ledger, {}, "breakfast")).toEqual([]);
  });
});

describe("firstWaterSamples", () => {
  it("reads closed days' first glass and today's pours", () => {
    const history = [
      { date: day(1), ml: 2000, firstAt: `${day(1)}T07:30:00+00:00` },
      { date: day(2), ml: 1800 }, // logged before the field existed
    ];
    const pours = { date: day(3), pours: [{ id: "a", ml: 250, at: `${day(3)}T07:40:00+00:00` }] };
    expect(firstWaterSamples(history, pours)).toEqual([
      { date: day(1), at: `${day(1)}T07:30:00+00:00` },
      { date: day(3), at: `${day(3)}T07:40:00+00:00` },
    ]);
  });
});

describe("archiveWaterDay keeps the first glass", () => {
  it("stores it, and a later re-archive without it keeps it", async () => {
    await archiveWaterDay(day(4), 1500, 2500, `${day(4)}T07:15:00+00:00`);
    await archiveWaterDay(day(4), 1750, 2500, null);
    const [row] = await getWaterHistory();
    expect(row).toEqual({ date: day(4), ml: 1750, goalMl: 2500, firstAt: `${day(4)}T07:15:00+00:00` });
  });

  it("writes no field when the time is unknown", async () => {
    await archiveWaterDay(day(5), 900);
    expect(await getWaterHistory()).toEqual([{ date: day(5), ml: 900 }]);
  });
});

describe("check-ins and workouts", () => {
  it("reads a check-in's creation time", () => {
    const created = new Date(2026, 10, 3, 21, 15).getTime();
    const [s] = checkinSamples([{ date: "2026-11-03", createdAt: created }]);
    expect(s.date).toBe("2026-11-03");
    expect(new Date(s.at).getHours()).toBe(21);
  });

  it("reads when a workout finished", () => {
    const [s] = workoutSamples([
      {
        id: "w",
        date: "2026-11-03",
        sessionId: "s",
        sessionLabel: "Push",
        exercisesCompleted: 5,
        totalExercises: 5,
        completionPercent: 100,
        durationMinutes: 40,
        completedAt: "2026-11-03T07:45:00+00:00",
      },
    ]);
    expect(s).toEqual({ date: "2026-11-03", at: "2026-11-03T07:45:00+00:00" });
  });
});
