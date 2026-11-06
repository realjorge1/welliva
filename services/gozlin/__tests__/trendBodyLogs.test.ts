/**
 * The coach's weight trend, and the days the scale reads water.
 *
 * Someone losing a steady 0.5 kg a week with a 1 kg rise before her period would
 * read as nearly stalled on a straight line over 28 days. Once her own history
 * confirms that rise, the TREND leaves those days out. Her current weight and her
 * last weigh-in don't: those are simply what happened.
 */
import { describe, expect, it } from "vitest";

import { buildTwin } from "../GozlinTwin";
import type { GozlinSnapshotInput } from "../gozlin.types";

const NOW = new Date(2026, 8, 14, 12);
const dateAgo = (n: number) => {
  const d = new Date(2026, 8, 14 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** 28 days falling 0.5 kg a week; the last 7 read 1 kg high. */
const LOGS = Array.from({ length: 28 }, (_, i) => {
  const ago = 27 - i;
  return { date: dateAgo(ago), weightKg: 70 - (0.5 / 7) * i + (ago < 7 ? 1 : 0) };
});
const WITHOUT_RISE = LOGS.filter((_, i) => 27 - i >= 7);

function twinOf(over: Partial<GozlinSnapshotInput>) {
  return buildTwin({
    bio: null,
    targets: null,
    consumed: { calories: 0, proteinG: 0, fatG: 0, carbsG: 0, waterMl: 0 },
    waterGoalMl: 2500,
    todayDiet: null,
    workoutSession: null,
    workoutDoneToday: false,
    workoutPlan: null,
    workoutLog: [],
    sessionHistory: [],
    dietHistory: [],
    bodyLogs: LOGS as never,
    streak: { currentStreak: 0, totalActiveDays: 0 } as never,
    goals: {} as never,
    now: NOW,
    ...over,
  });
}

describe("the Twin's weight trend", () => {
  it("reads every weigh-in when nothing has been confirmed", () => {
    expect(twinOf({}).body.measuredRatePerWeek!).toBeGreaterThan(-0.3);
  });

  it("leaves out the confirmed days, so a rise doesn't read as a stall", () => {
    expect(twinOf({ trendBodyLogs: WITHOUT_RISE as never }).body.measuredRatePerWeek!).toBeCloseTo(-0.5, 1);
  });

  it("still reports the real current weight and last weigh-in", () => {
    const body = twinOf({ trendBodyLogs: WITHOUT_RISE as never }).body;
    expect(body.currentWeightKg).toBeCloseTo(LOGS[27].weightKg, 5);
    expect(body.lastWeighInDate).toBe(LOGS[27].date);
  });
});
