import { describe, expect, it } from "vitest";
import type { NutrientConfidence } from "../../../models/nutrients";
import type { FoodLogEntry } from "../FoodLogService";
import {
  dayProvenance,
  isMeasured,
  provenanceDetail,
  provenanceLine,
} from "../dayProvenance";

function entry(calories: number, confidence: NutrientConfidence): FoodLogEntry {
  return {
    id: `e${calories}${confidence}`,
    date: "2026-08-21",
    slot: null,
    label: "test",
    items: [],
    totals: { calories } as FoodLogEntry["totals"],
    partialKeys: [],
    confidence,
    origin: "catalog",
    loggedAt: "2026-08-21T09:00:00.000Z",
  };
}

describe("what counts as measured", () => {
  it("counts a reference match, even when the portion was assumed", () => {
    // The FOOD was measured; only the amount is approximate. That is a much
    // smaller claim than "these numbers were invented".
    expect(isMeasured("measured")).toBe(true);
    expect(isMeasured("portion-estimated")).toBe(true);
  });

  it("does not count figures that were derived rather than read", () => {
    expect(isMeasured("recipe-estimated")).toBe(false);
    expect(isMeasured("macros-only")).toBe(false);
    expect(isMeasured("ai-estimated")).toBe(false);
    expect(isMeasured("unmatched")).toBe(false);
  });
});

describe("the measured share", () => {
  it("is null on an empty day, never zero", () => {
    // "0% measured" on a day with no food is an accusation, not information.
    expect(dayProvenance([]).measuredPercent).toBeNull();
    expect(provenanceLine(dayProvenance([]))).toBeNull();
  });

  it("weights by calories, not by entry count", () => {
    // Three tiny measured coffees + one big estimated stew. By count that is
    // 75% measured; by energy it is nothing like it, and energy is what a
    // person actually cares about.
    const p = dayProvenance([
      entry(5, "measured"),
      entry(5, "measured"),
      entry(5, "measured"),
      entry(985, "ai-estimated"),
    ]);
    expect(p.measuredPercent).toBe(2);
  });

  it("reports a clean split for a realistic day", () => {
    const p = dayProvenance([
      entry(400, "measured"),
      entry(1200, "portion-estimated"),
      entry(260, "ai-estimated"),
    ]);
    expect(p.totalCalories).toBe(1860);
    expect(p.measuredCalories).toBe(1600);
    expect(p.estimatedCalories).toBe(260);
    expect(p.measuredPercent).toBe(86);
    expect(provenanceLine(p)).toBe("86% measured");
  });

  it("does NOT let one estimated item relabel the whole day", () => {
    // This is the bug the weakest-confidence rule would have produced: a single
    // estimated dinner turning 2,000 measured calories into "AI estimate".
    const p = dayProvenance([
      entry(2000, "measured"),
      entry(100, "ai-estimated"),
    ]);
    expect(p.measuredPercent).toBe(95);
  });

  it("keeps unmatched foods separate rather than flattering the percentage", () => {
    const p = dayProvenance([entry(500, "measured"), entry(0, "unmatched")]);
    expect(p.unknownCalories).toBe(0);
    expect(p.estimatedEntries).toBe(1);
    // The zero-calorie unmatched entry must not silently make the day 100%
    // trustworthy — it is counted as an entry that carries no figures.
    expect(p.measuredPercent).toBe(100);
  });
});

describe("the line shown to the user", () => {
  it("stays silent on a fully measured day", () => {
    // Printing "100% measured" daily trains people to stop reading the line on
    // the days it matters.
    const p = dayProvenance([entry(800, "measured")]);
    expect(provenanceLine(p)).toBeNull();
    expect(provenanceDetail(p)).toBeNull();
  });

  it("says how many items were estimated, in plain words", () => {
    const one = dayProvenance([entry(900, "measured"), entry(100, "ai-estimated")]);
    expect(provenanceDetail(one)).toContain("one item");

    const many = dayProvenance([
      entry(900, "measured"),
      entry(100, "ai-estimated"),
      entry(80, "recipe-estimated"),
    ]);
    expect(provenanceDetail(many)).toContain("2 items");
  });

  it("never apologises or hedges the app's own numbers", () => {
    const p = dayProvenance([entry(900, "measured"), entry(300, "ai-estimated")]);
    const text = `${provenanceLine(p)} ${provenanceDetail(p)}`.toLowerCase();
    for (const weasel of ["sorry", "unfortunately", "we think", "roughly right"]) {
      expect(text).not.toContain(weasel);
    }
  });
});
