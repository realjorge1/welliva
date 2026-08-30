import { describe, expect, it } from "vitest";
import type { NutrientConfidence } from "../../../models/nutrients";
import type { FoodLogEntry } from "../FoodLogService";
import {
  provenanceHeadline,
  sourceBreakdown,
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

// ============================================================================
// THE BREAKDOWN — the receipts screen's arithmetic
// ============================================================================

/**
 * The promise app/diet/receipts.tsx makes is "read down this list and you can
 * check every calorie in your day." That is only true if the rows RECONCILE
 * with the headline above them, and if nothing is quietly left out. Both are
 * arithmetic, so both are testable, and neither should be asserted by eye on a
 * screen whose entire value is that it can be checked.
 */

/** A logged entry with per-item sources, as the resolver produces them. */
function entryWithItems(
  items: { name: string; kcal: number; kind: string | null; confidence: string }[],
): any {
  return {
    id: `e${Math.random()}`,
    date: "2026-08-30",
    slot: null,
    label: items.map((i) => i.name).join(" and "),
    items: items.map((i) => ({
      name: i.name,
      foodId: null,
      quantity: 1,
      unit: "serving",
      grams: 100,
      nutrients: { calories: i.kcal },
      source: i.kind ? { kind: i.kind, description: "x" } : null,
      confidence: i.confidence,
      matchScore: 1,
    })),
    totals: { calories: items.reduce((s, i) => s + i.kcal, 0) },
    partialKeys: [],
    confidence: items[0]?.confidence ?? "measured",
    origin: "gozlin",
    loggedAt: "2026-08-30T08:00:00.000Z",
  };
}

describe("sourceBreakdown", () => {
  it("groups by source at the ITEM level, not the entry level", () => {
    // "2 slices of bread and a boiled egg" is one entry with two sources.
    // Rolling up to the entry would report the weaker one for both, which is
    // the precise thing that makes a measured figure look estimated.
    const tallies = sourceBreakdown([
      entryWithItems([
        { name: "Bread", kcal: 160, kind: "usda", confidence: "measured" },
        { name: "Egg", kcal: 78, kind: "usda", confidence: "measured" },
        { name: "Jollof", kcal: 400, kind: "ai-estimate", confidence: "ai-estimated" },
      ]),
    ]);

    expect(tallies).toHaveLength(2);
    const usda = tallies.find((t) => t.kind === "usda")!;
    expect(usda.items).toBe(2);
    expect(usda.calories).toBe(238);
    expect(usda.measured).toBe(true);

    const est = tallies.find((t) => t.kind === "ai-estimate")!;
    expect(est.items).toBe(1);
    expect(est.measured).toBe(false);
  });

  it("orders by calories, so the row carrying the day is first", () => {
    const tallies = sourceBreakdown([
      entryWithItems([
        { name: "Coffee", kcal: 5, kind: "usda", confidence: "measured" },
        { name: "Stew", kcal: 700, kind: "ai-estimate", confidence: "ai-estimated" },
      ]),
    ]);
    expect(tallies[0].kind).toBe("ai-estimate");
  });

  it("shows an unidentified item rather than hiding it", () => {
    // The row most likely to embarrass us, and the one whose absence would
    // make the rest of the screen a lie.
    const tallies = sourceBreakdown([
      entryWithItems([{ name: "Grandma's soup", kcal: 0, kind: null, confidence: "unmatched" }]),
    ]);
    expect(tallies).toHaveLength(1);
    expect(tallies[0].kind).toBe("none");
    expect(tallies[0].items).toBe(1);
    expect(tallies[0].measured).toBe(false);
  });

  it("reconciles with the headline share it sits under", () => {
    // The screen's whole promise: total the rows and you get the percentage.
    const entries = [
      entryWithItems([{ name: "Oats", kcal: 380, kind: "usda", confidence: "measured" }]),
      entryWithItems([{ name: "Jollof", kcal: 620, kind: "ai-estimate", confidence: "ai-estimated" }]),
    ];
    const tallies = sourceBreakdown(entries);
    const p = dayProvenance(entries);

    const measuredKcal = tallies
      .filter((t) => t.measured)
      .reduce((s, t) => s + t.calories, 0);

    expect(measuredKcal).toBe(p.measuredCalories);
    expect(Math.round((measuredKcal / p.totalCalories) * 100)).toBe(p.measuredPercent);
  });

  it("is empty for an empty day", () => {
    expect(sourceBreakdown([])).toEqual([]);
  });

  it("counts a branded label as measured", () => {
    // A barcode scan resolves to a manufacturer's declared panel. That is a
    // real measurement — see services/nutrition/OpenFoodFacts.ts — and must
    // not be filed with the estimates.
    const tallies = sourceBreakdown([
      entryWithItems([{ name: "Oat Clusters", kcal: 171, kind: "branded", confidence: "measured" }]),
    ]);
    expect(tallies[0].measured).toBe(true);
  });
});

describe("provenanceHeadline", () => {
  it("speaks on a fully measured day, unlike the inline caveat", () => {
    // provenanceLine is silent at 100% so the chip earns attention by being
    // rare. A screen someone OPENED is a different context: the answer to the
    // question they asked is the best thing to show them.
    const p = dayProvenance([entry(800, "measured")]);
    expect(provenanceLine(p)).toBeNull();
    expect(provenanceHeadline(p)).toBe("Every number today was measured");
  });

  it("names the share when it is not everything", () => {
    const p = dayProvenance([entry(900, "measured"), entry(100, "ai-estimated")]);
    expect(provenanceHeadline(p)).toBe("90% of today's calories were measured");
  });

  it("does not accuse an empty day of anything", () => {
    expect(provenanceHeadline(dayProvenance([]))).toBe("Nothing logged yet today");
  });
});
