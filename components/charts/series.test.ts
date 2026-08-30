import { describe, expect, it } from "vitest";
import {
  buildAdherenceTrend,
  buildCaloriesTrend,
  buildMacroMatrix,
  buildWeeklyMinutes,
  buildWeightTrend,
  indexToStart,
  sharedDomain,
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

describe("sharedDomain — a legend chip is a filter, not a zoom", () => {
  // Two overlaid macros indexed to their own first day = 100. Calories swing
  // wide, carbs stay close to flat — the exact pairing that made the bug
  // visible on the Nutrition trends card.
  const calories = [100, 140, 90, 120];
  const carbs = [100, 104, 98, 102];

  /** Where a value lands vertically, 0 = bottom of the plot, 1 = top. */
  const place = (v: number, [lo, hi]: [number, number]) => (v - lo) / (hi - lo);

  it("moves a line when the domain is narrowed to the visible set — the bug", () => {
    // This is what the OLD code did: build the domain from visible series only.
    // Hiding calories left carbs alone in the domain, and carbs stretched to
    // fill the plot — landing where calories used to be. Asserted so nobody
    // reintroduces it thinking it looks tidier.
    const allSeries = sharedDomain([calories, carbs]);
    const carbsAlone = sharedDomain([carbs]);

    expect(carbsAlone).not.toEqual(allSeries);
    // Carbs' own peak sits low in the shared domain and at the very top of its
    // own — a jump of most of the plot's height, from one chip tap.
    expect(place(104, allSeries)).toBeLessThan(0.5);
    expect(place(104, carbsAlone)).toBeGreaterThan(0.8);
  });

  it("holds every line still when the hidden series are still passed in", () => {
    // The contract the component now honours: hidden series stay in the input,
    // so the domain — and therefore every line's position — cannot move.
    const shown = sharedDomain([calories, carbs]);
    const caloriesHidden = sharedDomain([calories, carbs]);

    expect(caloriesHidden).toEqual(shown);
    expect(place(104, caloriesHidden)).toBe(place(104, shown));
  });

  it("spans every series, not just the widest one", () => {
    const [lo, hi] = sharedDomain([calories, carbs], 0);
    expect(lo).toBe(90);
    expect(hi).toBe(140);
  });

  it("pads the span symmetrically so strokes clear the edges", () => {
    const [lo, hi] = sharedDomain([[0, 100]], 0.1);
    expect(lo).toBe(-10);
    expect(hi).toBe(110);
  });

  it("ignores nulls rather than treating them as zero", () => {
    // An untracked day must not drag the floor down to 0 and squash the plot.
    expect(sharedDomain([[null, 100, null, 120]], 0)).toEqual([100, 120]);
  });

  it("opens out a flat series instead of dividing by zero", () => {
    const [lo, hi] = sharedDomain([[100, 100, 100]], 0);
    expect(hi).toBeGreaterThan(lo);
  });

  it("survives a series with no finite values at all", () => {
    const [lo, hi] = sharedDomain([[null, null]], 0);
    expect(Number.isFinite(lo)).toBe(true);
    expect(Number.isFinite(hi)).toBe(true);
    expect(hi).toBeGreaterThan(lo);
  });
});
