/**
 * HYDRATION LOGIC — the decisions behind the card.
 */
import { describe, expect, it } from "vitest";

import {
  CUSTOM_DEFAULT,
  CUSTOM_MAX,
  CUSTOM_MIN,
  CUSTOM_PRESETS,
  CUSTOM_STEP,
  GLASS_ML,
  QUICK_ML,
  clampCustom,
  clockLabel,
  drinkCount,
  gaugeTicks,
  hydrationStatus,
  stepCustom,
} from "@/components/hydration/hydrationLogic";

describe("the one-tap sizes", () => {
  it("keep the sizes people already use, with the glass among them", () => {
    expect([...QUICK_ML]).toEqual([150, 250, 500]);
    expect(QUICK_ML).toContain(GLASS_ML);
  });

  it("offer presets that all sit inside the custom range", () => {
    for (const p of CUSTOM_PRESETS) {
      expect(p).toBeGreaterThanOrEqual(CUSTOM_MIN);
      expect(p).toBeLessThanOrEqual(CUSTOM_MAX);
    }
    expect(CUSTOM_DEFAULT).toBeGreaterThanOrEqual(CUSTOM_MIN);
    expect(CUSTOM_DEFAULT).toBeLessThanOrEqual(CUSTOM_MAX);
  });
});

describe("the custom amount", () => {
  it("is held inside its range", () => {
    expect(clampCustom(5)).toBe(CUSTOM_MIN);
    expect(clampCustom(99_999)).toBe(CUSTOM_MAX);
    expect(clampCustom(330)).toBe(330);
  });

  it("rounds a fraction to a whole millilitre", () => {
    expect(clampCustom(249.6)).toBe(250);
  });

  it("falls back to the default for a number that is not one", () => {
    expect(clampCustom(Number.NaN)).toBe(CUSTOM_DEFAULT);
    expect(clampCustom(Number.POSITIVE_INFINITY)).toBe(CUSTOM_DEFAULT);
  });

  it("steps by the step, either way", () => {
    expect(stepCustom(300, 1)).toBe(300 + CUSTOM_STEP);
    expect(stepCustom(300, -1)).toBe(300 - CUSTOM_STEP);
  });

  it("stops at both ends instead of running past them", () => {
    expect(stepCustom(CUSTOM_MAX, 1)).toBe(CUSTOM_MAX);
    expect(stepCustom(CUSTOM_MIN, -1)).toBe(CUSTOM_MIN);
  });
});

describe("gaugeTicks", () => {
  it("marks every glass below the goal, and none at it — the rim is the goal", () => {
    const t = gaugeTicks(2500);
    expect(t).toHaveLength(9); // 250 … 2250
    expect(t[0].at).toBeCloseTo(0.1, 10);
    expect(t[t.length - 1].at).toBeCloseTo(0.9, 10);
    expect(t.every((x) => x.at > 0 && x.at < 1)).toBe(true);
  });

  it("makes a whole litre the long mark", () => {
    const majors = gaugeTicks(2500).filter((x) => x.major);
    expect(majors.map((x) => x.at)).toEqual([0.4, 0.8]); // 1 L and 2 L of 2.5 L
  });

  it("copes with a goal that is not a whole number of glasses", () => {
    const t = gaugeTicks(2300);
    expect(t).toHaveLength(9);
    expect(t[t.length - 1].at).toBeCloseTo(2250 / 2300, 10);
  });

  it("is empty for a goal too small to hold a glass, or for no goal", () => {
    expect(gaugeTicks(250)).toEqual([]);
    expect(gaugeTicks(0)).toEqual([]);
    expect(gaugeTicks(Number.NaN)).toEqual([]);
  });

  it("never draws a barcode, however large the goal", () => {
    expect(gaugeTicks(50_000).length).toBeLessThanOrEqual(24);
  });

  it("climbs steadily", () => {
    const t = gaugeTicks(3000);
    for (let i = 1; i < t.length; i++) expect(t[i].at).toBeGreaterThan(t[i - 1].at);
  });
});

describe("hydrationStatus", () => {
  it("says how much is left, in whole millilitres", () => {
    expect(hydrationStatus(1250, 2500)).toEqual({ reached: false, text: "1,250 ml to go" });
    expect(hydrationStatus(0, 2500)).toEqual({ reached: false, text: "2,500 ml to go" });
  });

  it("states the goal as reached, without cheering, the moment it is met", () => {
    expect(hydrationStatus(2500, 2500)).toEqual({ reached: true, text: "Goal reached" });
    expect(hydrationStatus(3200, 2500).reached).toBe(true);
    expect(hydrationStatus(3200, 2500).text).not.toMatch(/!/);
  });

  it("does not call a day with no goal 'reached'", () => {
    expect(hydrationStatus(0, 0).reached).toBe(false);
  });

  it("survives bad numbers", () => {
    expect(hydrationStatus(Number.NaN, 2500).text).toBe("2,500 ml to go");
    expect(hydrationStatus(-10, 2500).text).toBe("2,500 ml to go");
  });
});

describe("labels", () => {
  it("counts drinks in the singular and the plural", () => {
    expect(drinkCount(0)).toBe("0 drinks");
    expect(drinkCount(1)).toBe("1 drink");
    expect(drinkCount(5)).toBe("5 drinks");
  });

  it("reads a time of day from a stored timestamp", () => {
    expect(clockLabel("2026-10-31T08:12:00.000Z")).toMatch(/\d{1,2}:\d{2}/);
  });

  it("is empty, not 'Invalid Date', for a timestamp that is not one", () => {
    expect(clockLabel("nonsense")).toBe("");
  });
});
