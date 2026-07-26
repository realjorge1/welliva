import { describe, expect, it } from "vitest";
import {
  buildAdherenceTrend,
  buildCaloriesTrend,
  buildMacroMatrix,
  buildWeeklyMinutes,
  buildWeightTrend,
  indexToStart,
  shortDate,
  weekStartOf,
} from "./series";
import type { DietHistoryEntry } from "@/models/diet";
import type { BodyLogEntry, WorkoutLogEntry } from "@/models/workout";

const TODAY = "2026-07-06"; // a Monday

function diet(date: string, extra: Partial<DietHistoryEntry> = {}): DietHistoryEntry {
  return {
    date,
    dietId: "d",
    dietName: "Plan",
    mealsConsumed: 3,
    totalMeals: 4,
    status: "partial",
    ...extra,
  };
}

function workout(date: string, minutes: number): WorkoutLogEntry {
  return {
    id: `w_${date}`,
    date,
    sessionId: "s",
    sessionLabel: "Session",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent: 100,
    durationMinutes: minutes,
    completedAt: `${date}T10:00:00.000Z`,
  };
}

describe("date helpers", () => {
  it("labels a date compactly", () => {
    expect(shortDate("2026-07-03")).toBe("Jul 3");
  });
  it("snaps to the Monday of the week", () => {
    expect(weekStartOf("2026-07-06")).toBe("2026-07-06"); // Mon
    expect(weekStartOf("2026-07-08")).toBe("2026-07-06"); // Wed → Mon
    expect(weekStartOf("2026-07-05")).toBe("2026-06-29"); // Sun → prior Mon
  });
});

describe("buildCaloriesTrend", () => {
  it("plots only days with a recorded consumed total, oldest → newest", () => {
    const history = [
      diet("2026-07-04", { consumedCalories: 2100 }),
      diet("2026-07-02"), // no consumedCalories → skipped
      diet("2026-07-06", { consumedCalories: 1950 }),
    ];
    const points = buildCaloriesTrend(history, TODAY, 7);
    expect(points.map((p) => p.value)).toEqual([2100, 1950]);
    expect(points[0].label).toBe("Jul 4");
  });

  it("excludes days outside the window", () => {
    const history = [
      diet("2026-06-20", { consumedCalories: 3000 }), // > 7 days ago
      diet("2026-07-06", { consumedCalories: 2000 }),
    ];
    expect(buildCaloriesTrend(history, TODAY, 7)).toHaveLength(1);
  });

  it("de-duplicates a re-archived day, last write wins", () => {
    const history = [
      diet("2026-07-06", { consumedCalories: 1000 }),
      diet("2026-07-06", { consumedCalories: 2222 }),
    ];
    const points = buildCaloriesTrend(history, TODAY, 7);
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(2222);
  });
});

describe("buildMacroMatrix", () => {
  it("aligns every macro into one row per logged day, oldest → newest", () => {
    const history = [
      diet("2026-07-04", {
        consumedCalories: 2100,
        consumedProteinG: 150,
        consumedCarbsG: 200,
        consumedFatG: 70,
      }),
      diet("2026-07-06", {
        consumedCalories: 1950,
        consumedProteinG: 160,
        consumedCarbsG: 180,
        consumedFatG: 65,
      }),
    ];
    const rows = buildMacroMatrix(history, TODAY, 7);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      label: "Jul 4",
      calories: 2100,
      proteinG: 150,
      carbsG: 200,
      fatG: 70,
    });
    expect(rows[1].calories).toBe(1950);
  });

  it("keeps a partially-logged day but nulls the missing macros", () => {
    const history = [diet("2026-07-06", { consumedProteinG: 140 })];
    const rows = buildMacroMatrix(history, TODAY, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ proteinG: 140, calories: null, carbsG: null, fatG: null });
  });

  it("drops days that logged no macro at all", () => {
    const history = [
      diet("2026-07-05"), // no consumed* fields
      diet("2026-07-06", { consumedCalories: 2000 }),
    ];
    const rows = buildMacroMatrix(history, TODAY, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0].calories).toBe(2000);
  });
});

describe("indexToStart", () => {
  it("expresses each sample as a percent of the first positive one (start = 100)", () => {
    expect(indexToStart([200, 300, 100])).toEqual([100, 150, 50]);
  });

  it("passes nulls through as gaps and indexes off the first positive value", () => {
    expect(indexToStart([null, 150, 300])).toEqual([null, 100, 200]);
  });

  it("returns all-null when there is no positive base", () => {
    expect(indexToStart([0, null, 0])).toEqual([null, null, null]);
  });
});

describe("buildAdherenceTrend", () => {
  it("computes percent per logged day and treats an empty plan as 0", () => {
    const history = [
      diet("2026-07-05", { mealsConsumed: 2, totalMeals: 4 }),
      diet("2026-07-06", { mealsConsumed: 0, totalMeals: 0 }),
    ];
    const points = buildAdherenceTrend(history, TODAY, 7);
    expect(points.map((p) => p.value)).toEqual([50, 0]);
  });
});

describe("buildWeeklyMinutes", () => {
  it("buckets minutes into weeks and keeps empty weeks", () => {
    const log = [
      workout("2026-07-06", 30), // this week
      workout("2026-07-01", 20), // last week (wk of Jun 29)
      workout("2026-07-02", 25), // last week
    ];
    const points = buildWeeklyMinutes(log, TODAY, 3);
    expect(points).toHaveLength(3);
    expect(points.map((p) => p.value)).toEqual([0, 45, 30]);
  });
});

describe("buildWeightTrend", () => {
  it("plots logged weigh-ins rounded to 0.1kg", () => {
    const logs: BodyLogEntry[] = [
      { date: "2026-07-01", weightKg: 80.04 },
      { date: "2026-07-06", weightKg: 79.46 },
    ];
    const points = buildWeightTrend(logs, TODAY, 30);
    expect(points.map((p) => p.value)).toEqual([80, 79.5]);
  });
});
