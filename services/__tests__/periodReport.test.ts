/**
 * The end-of-period report.
 *
 * The claims under test are the ones a user would be entitled to be angry about
 * if they broke: the report is deterministic, it never counts an unplanned day
 * as a failure, and it never invents a number it doesn't have.
 */

import { describe, expect, it } from "vitest";
import type { DietHistoryEntry } from "../../models/diet";
import type { MealPlanPeriod } from "../../models/mealPlan";
import type { BodyLogEntry } from "../../models/workout";
import { buildPeriodReport } from "../PeriodReportService";

const period = (over: Partial<MealPlanPeriod> = {}): MealPlanPeriod => ({
  id: "p1",
  mode: "diet",
  dietId: "keto",
  dietName: "Keto",
  label: "Keto",
  durationKind: "week",
  startDate: "2026-07-01",
  endDate: "2026-07-07",
  status: "completed",
  baseline: { capturedAt: "2026-07-01T00:00:00Z", weightKg: 80, targetCalories: 2000, targetProteinG: 120 },
  createdAt: "2026-07-01T00:00:00Z",
  ...over,
});

const day = (
  date: string,
  consumed: number,
  total = 3,
  over: Partial<DietHistoryEntry> = {},
): DietHistoryEntry => ({
  date,
  dietId: "keto",
  dietName: "Keto",
  mealsConsumed: consumed,
  totalMeals: total,
  status: consumed === total ? "completed" : consumed > 0 ? "partial" : "skipped",
  consumedCalories: consumed * 600,
  consumedProteinG: consumed * 35,
  consumedCarbsG: consumed * 20,
  consumedFatG: consumed * 25,
  ...over,
});

const fullWeek = [
  day("2026-07-01", 3),
  day("2026-07-02", 3),
  day("2026-07-03", 3),
  day("2026-07-04", 2),
  day("2026-07-05", 3),
  day("2026-07-06", 0),
  day("2026-07-07", 3),
];

describe("buildPeriodReport", () => {
  it("computes adherence across the window", () => {
    const r = buildPeriodReport({ period: period(), history: fullWeek, bodyLogs: [] });
    expect(r.mealsPlanned).toBe(21);
    expect(r.mealsConsumed).toBe(17);
    expect(r.mealsSkipped).toBe(4);
    expect(r.adherenceRate).toBeCloseTo(17 / 21, 5);
    expect(r.perfectDays).toBe(5);
    expect(r.missedDays).toBe(1);
  });

  it("finds the best unbroken streak", () => {
    const r = buildPeriodReport({ period: period(), history: fullWeek, bodyLogs: [] });
    expect(r.bestStreakDays).toBe(3); // 1st–3rd, then the 4th is partial
  });

  it("is deterministic apart from the generation timestamp", () => {
    const a = buildPeriodReport({ period: period(), history: fullWeek, bodyLogs: [] });
    const b = buildPeriodReport({ period: period(), history: fullWeek, bodyLogs: [] });
    expect({ ...a, generatedAt: "" }).toEqual({ ...b, generatedAt: "" });
  });

  // A day the user never planned is not a day they failed.
  it("excludes unplanned days from adherence instead of scoring them zero", () => {
    const partial = [day("2026-07-01", 2, 2), day("2026-07-03", 2, 2)];
    const r = buildPeriodReport({
      period: period({ mode: "custom", dietId: null, dietName: null, label: "My menu" }),
      history: partial,
      bodyLogs: [],
    });
    expect(r.totalDays).toBe(7);
    expect(r.daysWithPlan).toBe(2);
    expect(r.adherenceRate).toBe(1);
    expect(r.verdict).toBe("excellent");
    expect(r.highlights.some((h) => h.includes("aren't counted against you"))).toBe(true);
  });

  it("ranks the meals that were skipped most", () => {
    const history = [
      day("2026-07-01", 2, 3, { skippedMeals: ["Kale smoothie"], consumedMeals: ["Eggs", "Steak"] }),
      day("2026-07-02", 2, 3, { skippedMeals: ["Kale smoothie"], consumedMeals: ["Eggs", "Steak"] }),
      day("2026-07-03", 2, 3, { skippedMeals: ["Tuna salad"], consumedMeals: ["Eggs", "Steak"] }),
    ];
    const r = buildPeriodReport({ period: period(), history, bodyLogs: [] });
    expect(r.mostSkipped[0]).toEqual({ name: "Kale smoothie", times: 2 });
    expect(r.mostEaten[0].times).toBe(3);
    expect(r.highlights.some((h) => h.includes("Kale smoothie"))).toBe(true);
  });

  it("measures weight change and normalises it per week", () => {
    const logs: BodyLogEntry[] = [
      { date: "2026-07-01", weightKg: 80 },
      { date: "2026-07-08", weightKg: 79 },
    ];
    // Weigh-ins bracket the period; the 8th is outside the window so the last
    // in-window reading is used.
    const r = buildPeriodReport({
      period: period({ endDate: "2026-07-08" }),
      history: fullWeek,
      bodyLogs: logs,
    });
    expect(r.weight.startKg).toBe(80);
    expect(r.weight.endKg).toBe(79);
    expect(r.weight.deltaKg).toBe(-1);
    expect(r.weight.perWeekKg).toBe(-1);
  });

  // Never fabricate.
  it("reports null weight change when nothing was weighed", () => {
    const r = buildPeriodReport({
      period: period({ baseline: { capturedAt: "x" } }),
      history: fullWeek,
      bodyLogs: [],
    });
    expect(r.weight.deltaKg).toBeNull();
    expect(r.highlights.some((h) => h.includes("No weigh-ins"))).toBe(true);
  });

  it("returns null macro averages when history has none", () => {
    const bare = [
      { date: "2026-07-01", dietId: "k", dietName: "K", mealsConsumed: 2, totalMeals: 3, status: "partial" as const },
    ];
    const r = buildPeriodReport({ period: period(), history: bare, bodyLogs: [] });
    expect(r.avgConsumed.calories).toBeNull();
    expect(r.vsTarget.calories).toBeNull();
  });

  it("says so when there is nothing to score", () => {
    const r = buildPeriodReport({ period: period(), history: [], bodyLogs: [] });
    expect(r.verdict).toBe("insufficient-data");
    expect(r.adherenceRate).toBe(0);
    expect(r.highlights).toHaveLength(1);
  });

  it("compares average intake against the period's targets", () => {
    const r = buildPeriodReport({ period: period(), history: fullWeek, bodyLogs: [] });
    // 17 consumed meals × 600 kcal over 7 days with macros recorded.
    expect(r.targets.calories).toBe(2000);
    expect(r.avgConsumed.calories).not.toBeNull();
    expect(r.vsTarget.calories).toBe(
      Math.round((r.avgConsumed.calories! - 2000) * 10) / 10,
    );
  });
});
