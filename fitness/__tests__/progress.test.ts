/**
 * ProgressService — streaks, weekly history, personal bests and the snapshot.
 */

import { describe, expect, it } from "vitest";
import {
  buildProgressSnapshot,
  longestStreakDays,
  weeklyHistory,
  weekStartOf,
  workoutStreakDays,
} from "@/fitness/services/ProgressService";
import type { WorkoutLogEntry } from "@/models/workout";

function entry(date: string, minutes = 30): WorkoutLogEntry {
  return {
    id: `log_${date}_${minutes}`,
    date,
    sessionId: "s",
    sessionLabel: "Session",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent: 100,
    durationMinutes: minutes,
    completedAt: `${date}T18:00:00Z`,
  };
}

describe("date math", () => {
  it("weekStartOf returns the Monday of the week", () => {
    expect(weekStartOf("2026-07-01")).toBe("2026-06-29"); // Wed → Mon
    expect(weekStartOf("2026-06-29")).toBe("2026-06-29"); // Mon → itself
    expect(weekStartOf("2026-07-05")).toBe("2026-06-29"); // Sun → prior Mon
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today", () => {
    const log = [entry("2026-06-29"), entry("2026-06-30"), entry("2026-07-01")];
    expect(workoutStreakDays(log, "2026-07-01")).toBe(3);
  });

  it("grants a grace day when today has no workout yet", () => {
    const log = [entry("2026-06-29"), entry("2026-06-30")];
    expect(workoutStreakDays(log, "2026-07-01")).toBe(2);
  });

  it("breaks on a gap", () => {
    const log = [entry("2026-06-27"), entry("2026-06-30")];
    expect(workoutStreakDays(log, "2026-07-01")).toBe(1);
    expect(longestStreakDays(log)).toBe(1);
  });

  it("finds the longest historical streak", () => {
    const log = [
      entry("2026-06-01"),
      entry("2026-06-02"),
      entry("2026-06-03"),
      entry("2026-06-10"),
    ];
    expect(longestStreakDays(log)).toBe(3);
  });
});

describe("weekly history", () => {
  it("returns the requested number of weeks, empty weeks included", () => {
    const log = [entry("2026-07-01", 25)];
    const weeks = weeklyHistory(log, "2026-07-01", 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].weekStart).toBe("2026-06-29");
    expect(weeks[7].minutes).toBe(25);
    expect(weeks[0].workouts).toBe(0);
  });
});

describe("snapshot", () => {
  it("aggregates totals, this-week and goal progress", () => {
    const log = [
      entry("2026-06-20", 40), // previous week
      entry("2026-06-30", 30),
      entry("2026-07-01", 20),
    ];
    const snap = buildProgressSnapshot({
      workoutLog: log,
      sessionHistory: [],
      today: "2026-07-01",
      weeklyTargetDays: 4,
    });
    expect(snap.totalWorkouts).toBe(3);
    expect(snap.thisWeekWorkouts).toBe(2);
    expect(snap.thisWeekMinutes).toBe(50);
    expect(snap.thisMonthMinutes).toBe(20); // July only
    expect(snap.weeklyGoalProgress).toBeCloseTo(0.5);
    expect(snap.personalBests.longestSessionMin).toBe(40);
    expect(snap.currentStreakDays).toBe(2);
  });
});
