import { describe, expect, it } from "vitest";
import { buildConsistency } from "./consistency";
import type { DietHistoryEntry } from "@/models/diet";
import type { WorkoutLogEntry } from "@/models/workout";

const TODAY = "2026-07-08"; // a Wednesday

function diet(date: string, consumed: number, total: number): DietHistoryEntry {
  return {
    date,
    dietId: "d",
    dietName: "Plan",
    mealsConsumed: consumed,
    totalMeals: total,
    status: consumed >= total ? "completed" : consumed > 0 ? "partial" : "skipped",
  };
}

function workout(date: string, pct = 100): WorkoutLogEntry {
  return {
    id: `w-${date}`,
    date,
    sessionId: "s",
    sessionLabel: "Session",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent: pct,
    durationMinutes: 30,
    completedAt: `${date}T08:00:00.000Z`,
  };
}

describe("buildConsistency", () => {
  it("shapes a weeks × 7 matrix and blanks future days in the current week", () => {
    const { matrix, totalDays } = buildConsistency({
      dietHistory: [],
      workoutLog: [],
      today: TODAY,
      weeks: 4,
    });
    expect(matrix.length).toBe(4);
    for (const col of matrix) expect(col.length).toBe(7);

    // Current week is Monday-based; TODAY is Wednesday → Thu/Fri/Sat/Sun are future.
    const currentWeek = matrix[matrix.length - 1];
    expect(currentWeek[0]).toBe(0); // Monday (past, no activity)
    expect(currentWeek[2]).toBe(0); // Wednesday = today (no activity)
    expect(currentWeek[3]).toBe(-1); // Thursday (future)
    expect(currentWeek[6]).toBe(-1); // Sunday (future)

    // 4 weeks: 3 full past weeks (21) + Mon..Wed of the current week (3) = 24.
    expect(totalDays).toBe(24);
  });

  it("counts active days and blends diet + workout intensity", () => {
    const { matrix, activeDays } = buildConsistency({
      dietHistory: [diet(TODAY, 4, 4)], // full adherence today (from history-shaped input)
      workoutLog: [workout(TODAY)], // workout done today
      today: TODAY,
      weeks: 2,
    });
    // 0.6 * 1 (diet) + 0.4 * 1 (workout) = 1.0
    const today = matrix[matrix.length - 1][2];
    expect(today).toBeCloseTo(1);
    expect(activeDays).toBe(1);
  });

  it("prefers the live today signal over any history for today", () => {
    const { matrix } = buildConsistency({
      dietHistory: [diet(TODAY, 0, 4)],
      workoutLog: [],
      today: TODAY,
      weeks: 1,
      liveToday: { dietAdh: 0.5, workoutDone: true },
    });
    // live: 0.6 * 0.5 + 0.4 * 1 = 0.7
    expect(matrix[0][2]).toBeCloseTo(0.7);
  });
});
