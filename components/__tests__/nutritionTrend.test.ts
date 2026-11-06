/**
 * The Diet screen's "Nutrition trends": each finished day as a share of the
 * target. Pinned: what counts as a day, the arithmetic, the scale, which range
 * the card opens on, and that the curve never shows intake that wasn't logged.
 */
import { describe, expect, it } from "vitest";
import type { DietHistoryEntry } from "@/models/diet";
import {
  TREND_MIN_TOP,
  buildNutritionTrend,
  monotoneCurve,
  pickTrendRange,
  trendGeometry,
} from "../diet/nutritionTrend";

const TODAY = "2026-10-31";
const TARGETS = { calories: 2000, proteinG: 100, carbsG: 250, fatG: 70 };

const day = (date: string, kcal: number, p = 0, c = 0, f = 0): DietHistoryEntry => ({
  date,
  dietId: "d",
  dietName: "Diet",
  mealsConsumed: 1,
  totalMeals: 3,
  status: "partial",
  consumedCalories: kcal,
  consumedProteinG: p,
  consumedCarbsG: c,
  consumedFatG: f,
});

describe("buildNutritionTrend", () => {
  it("measures each finished day against the targets, in whole percent", () => {
    const t = buildNutritionTrend([day("2026-10-29", 1500, 80, 250, 35)], TODAY, 7, TARGETS);
    expect(t.days).toHaveLength(1);
    expect(t.days[0].pct).toEqual({ calories: 75, protein: 80, carbs: 100, fat: 50 });
    expect(t.days[0].amount.calories).toBe(1500);
  });

  it("leaves out a closed day with nothing logged — not a zero", () => {
    const t = buildNutritionTrend(
      [day("2026-10-28", 0), day("2026-10-29", 1800, 90, 200, 60)],
      TODAY,
      7,
      TARGETS,
    );
    expect(t.days.map((d) => d.date)).toEqual(["2026-10-29"]);
  });

  it("never includes today, which is still being eaten", () => {
    const t = buildNutritionTrend([day(TODAY, 900, 40, 100, 20)], TODAY, 7, TARGETS);
    expect(t.days).toEqual([]);
  });

  it("keeps 100% well under the top, and grows the scale for a big day", () => {
    expect(buildNutritionTrend([day("2026-10-29", 1000)], TODAY, 7, TARGETS).top).toBe(TREND_MIN_TOP);
    // 3,100 kcal on a 2,000 target is 155% → the scale tops out at 175.
    expect(buildNutritionTrend([day("2026-10-29", 3100)], TODAY, 7, TARGETS).top).toBe(175);
  });

  it("has no percentages without targets", () => {
    const t = buildNutritionTrend([day("2026-10-29", 1500, 80)], TODAY, 7, null);
    expect(t.days[0].pct).toEqual({ calories: null, protein: null, carbs: null, fat: null });
  });
});

describe("pickTrendRange", () => {
  it("opens on the first visible range with a line to draw", () => {
    expect(
      pickTrendRange([
        { key: "1W", locked: false, days: 0 },
        { key: "1M", locked: false, days: 2 },
        { key: "3M", locked: false, days: 5 },
      ]),
    ).toBe("1M");
  });

  it("never opens on a locked range, even one with data", () => {
    expect(
      pickTrendRange([
        { key: "1W", locked: false, days: 1 },
        { key: "1M", locked: true, days: 9 },
      ]),
    ).toBe("1W");
  });
});

describe("geometry", () => {
  const trend = buildNutritionTrend(
    [
      day("2026-10-26", 2000, 100, 250, 70),
      day("2026-10-27", 1000, 50, 125, 35),
      day("2026-10-28", 2500, 120, 300, 90),
    ],
    TODAY,
    7,
    TARGETS,
  );
  const g = trendGeometry(trend, 300, 150, { x: 10, top: 10, bottom: 10 });

  it("spaces the days evenly across the width", () => {
    expect(g.xs).toEqual([10, 150, 290]);
  });

  it("puts the target line at 100% of the scale", () => {
    // 150 tall, 10 padding each end: 100 / top(150) of 130.
    expect(trend.top).toBe(150);
    expect(g.targetY).toBeCloseTo(140 - (100 / 150) * 130, 5);
    expect(g.lines.calories.points[0]?.y).toBeCloseTo(g.targetY, 5);
  });

  it("ends each line on its last reading", () => {
    expect(g.lines.fat.end).toEqual(g.lines.fat.points[2]);
  });
});

describe("monotoneCurve", () => {
  it("never swings past the readings either side of a segment", () => {
    const pts = [
      { x: 0, y: 100 },
      { x: 10, y: 20 },
      { x: 25, y: 20 },
      { x: 30, y: 90 },
    ];
    const { trace } = monotoneCurve(pts);
    for (const y of trace.ys) {
      expect(y).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(y).toBeLessThanOrEqual(100 + 1e-6);
    }
    expect(trace.length).toBeGreaterThan(0);
  });

  it("joins the days either side of a missing one", () => {
    const { d } = monotoneCurve([
      { x: 0, y: 50 },
      { x: 20, y: 60 },
    ]);
    expect(d.startsWith("M0 50C")).toBe(true);
    expect(d.endsWith("20 60")).toBe(true);
  });
});
