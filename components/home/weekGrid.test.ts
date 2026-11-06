import { describe, expect, it } from "vitest";
import type { DietHistoryEntry } from "@/models/diet";
import type { WorkoutLogEntry } from "@/models/workout";
import { WEEK_DAYS, buildWeekTable, type WeekTableInput } from "./weekGrid";

const TODAY = "2026-10-31"; // a Saturday

function dietDay(date: string, kcal: number, protein = 80): DietHistoryEntry {
  return {
    date,
    dietId: "d",
    dietName: "Plan",
    mealsConsumed: 3,
    totalMeals: 4,
    status: "partial",
    consumedCalories: kcal,
    consumedProteinG: protein,
    consumedCarbsG: 200,
    consumedFatG: 60,
  };
}

function session(date: string, minutes: number): WorkoutLogEntry {
  return {
    id: `w-${date}`,
    date,
    sessionId: "s",
    sessionLabel: "Session",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent: 100,
    durationMinutes: minutes,
    completedAt: `${date}T08:00:00.000Z`,
  };
}

const EMPTY: WeekTableInput = {
  today: TODAY,
  dietHistory: [],
  workoutLog: [],
  waterHistory: [],
  live: { calories: 0, waterMl: 0 },
};

const row = (input: WeekTableInput, key: string) =>
  buildWeekTable(input).rows.find((r) => r.key === key)!;

describe("buildWeekTable — the columns", () => {
  it("is the seven days ending today, oldest first, today last", () => {
    const { columns } = buildWeekTable(EMPTY);
    expect(columns).toHaveLength(WEEK_DAYS);
    expect(columns[0].date).toBe("2026-10-25");
    expect(columns[6].date).toBe(TODAY);
    expect(columns.map((c) => c.isToday)).toEqual([false, false, false, false, false, false, true]);
  });

  it("labels each with its weekday and day of the month", () => {
    const { columns } = buildWeekTable(EMPTY);
    expect(columns[6]).toMatchObject({ label: "SAT", dayOfMonth: 31 });
    expect(columns[0]).toMatchObject({ label: "SUN", dayOfMonth: 25 });
  });

  it("walks across a month boundary", () => {
    const { columns } = buildWeekTable({ ...EMPTY, today: "2026-11-02" });
    expect(columns.map((c) => c.dayOfMonth)).toEqual([27, 28, 29, 30, 31, 1, 2]);
  });
});

describe("buildWeekTable — never a zero it did not read", () => {
  it("is a dash for every unlogged day and says it has no data", () => {
    const t = buildWeekTable(EMPTY);
    expect(t.hasData).toBe(false);
    for (const r of t.rows) expect(r.cells.every((c) => c === null)).toBe(true);
  });

  it("does not print a closed day stored as zeros as '0 kcal'", () => {
    // Day-close writes zeros for a day nothing was logged on.
    const t = row({ ...EMPTY, dietHistory: [dietDay("2026-10-29", 0, 0)] }, "calories");
    expect(t.cells[4]).toBeNull();
  });

  it("does not print a day with no session as '0 min'", () => {
    expect(row(EMPTY, "workout").cells.every((c) => c === null)).toBe(true);
  });
});

describe("buildWeekTable — the rows", () => {
  it("reads calories from the closed days and today from the live total", () => {
    const t = row(
      {
        ...EMPTY,
        dietHistory: [dietDay("2026-10-29", 1850), dietDay("2026-10-30", 2140.4)],
        live: { calories: 960.6, waterMl: 0 },
      },
      "calories",
    );
    expect(t.cells).toEqual([null, null, null, null, "1850", "2140", "961"]);
  });

  it("prefers the live figure for today over a stale history row", () => {
    const t = row(
      { ...EMPTY, dietHistory: [dietDay(TODAY, 500)], live: { calories: 1200, waterMl: 0 } },
      "calories",
    );
    expect(t.cells[6]).toBe("1200");
  });

  it("sums two sessions on one day", () => {
    const t = row(
      { ...EMPTY, workoutLog: [session("2026-10-30", 25), session("2026-10-30", 30)] },
      "workout",
    );
    expect(t.cells[5]).toBe("55");
  });

  it("ignores workouts outside the seven days", () => {
    const t = row({ ...EMPTY, workoutLog: [session("2026-10-01", 60)] }, "workout");
    expect(t.cells.every((c) => c === null)).toBe(true);
  });

  it("shows water in litres to one decimal, archived days and today", () => {
    const t = row(
      {
        ...EMPTY,
        waterHistory: [
          { date: "2026-10-30", ml: 2150 },
          { date: "2026-10-29", ml: 0 },
        ],
        live: { calories: 0, waterMl: 750 },
      },
      "water",
    );
    expect(t.cells).toEqual([null, null, null, null, null, "2.2", "0.8"]);
  });

  it("reports data as soon as any single cell has a reading", () => {
    expect(buildWeekTable({ ...EMPTY, live: { calories: 0, waterMl: 250 } }).hasData).toBe(true);
  });

  it("keeps the three rows, in order, with their units", () => {
    const t = buildWeekTable(EMPTY);
    expect(t.rows.map((r) => [r.key, r.unit])).toEqual([
      ["calories", "kcal"],
      ["workout", "min"],
      ["water", "L"],
    ]);
    for (const r of t.rows) expect(r.cells).toHaveLength(WEEK_DAYS);
  });
});
