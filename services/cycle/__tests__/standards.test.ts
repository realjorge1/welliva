/**
 * ONE MEDICAL STANDARD (2026-11-20, Fix 10): FIGO 2018 everywhere, held in
 * ./standards. The owner's choice; it makes the app warn less often.
 */
import { describe, expect, it } from "vitest";

import { addDays } from "../dates";
import { doctorNotes, visibleNotes } from "../flags";
import { buildCycles } from "../predict";
import {
  ADOLESCENT_CYCLE_DAYS,
  cycleRangeFor,
  MAX_NORMAL_BLEED_DAYS,
  NORMAL_CYCLE_DAYS,
  regularityLimit,
} from "../standards";
import { history, settings } from "./helpers";

function notes(lengths: number[], age: number | null = 30, bleed = 5) {
  const eps = history("2025-11-01", lengths, bleed);
  const today = addDays(eps[eps.length - 1].start, 12);
  const cycles = buildCycles(eps, settings({ usualCycleDays: 28 }), today);
  return doctorNotes({ cycles, episodes: eps, today, mode: "normal", profile: { age, conditions: [] } });
}
const ids = (n: { id: string }[]) => n.map((x) => x.id);

describe("the numbers", () => {
  it("FIGO 2018: 24–38 days, bleeding up to 8; 21–45 under 20", () => {
    expect(NORMAL_CYCLE_DAYS).toEqual({ min: 24, max: 38 });
    expect(MAX_NORMAL_BLEED_DAYS).toBe(8);
    expect(cycleRangeFor(30)).toEqual(NORMAL_CYCLE_DAYS);
    expect(cycleRangeFor(null)).toEqual(NORMAL_CYCLE_DAYS);
    expect(cycleRangeFor(19)).toEqual(ADOLESCENT_CYCLE_DAYS);
    expect(cycleRangeFor(20)).toEqual(NORMAL_CYCLE_DAYS);
    expect(regularityLimit(30)).toBe(7);
    expect(regularityLimit(17)).toBe(9);
    expect(regularityLimit(45)).toBe(9);
  });
});

describe("the notes use them, and say them", () => {
  it("23 is short, 24 isn't; 39 is long, 38 isn't — and the words carry the line", () => {
    const short = notes([23, 23, 28, 28]).find((n) => n.id === "short_cycles")!;
    expect(short.body).toContain("shorter than 24 days");
    expect(ids(notes([24, 24, 28, 28]))).not.toContain("short_cycles");
    const long = notes([39, 39, 28, 28]).find((n) => n.id === "long_cycles")!;
    expect(long.body).toContain("longer than 38 days");
    expect(ids(notes([38, 38, 28, 28]))).not.toContain("long_cycles");
  });

  it("a 9-day bleed is long, an 8-day one isn't", () => {
    expect(notes([28, 28, 28], 30, 9).find((n) => n.id === "long_bleeding")?.body).toContain("more than 8 days");
    expect(ids(notes([28, 28, 28], 30, 8))).not.toContain("long_bleeding");
  });

  it("at 17 the adolescent range applies; at 30 it doesn't", () => {
    expect(ids(notes([44, 44, 28, 28], 17))).not.toContain("long_cycles");
    expect(notes([46, 46, 28, 28], 17).find((n) => n.id === "long_cycles")?.body).toContain("longer than 45 days");
    expect(ids(notes([22, 22, 28, 28], 17))).not.toContain("short_cycles");
    expect(ids(notes([20, 20, 28, 28], 17))).toContain("short_cycles");
    expect(ids(notes([44, 44, 28, 28], 30))).toContain("long_cycles");
  });
});

describe("a note she dismissed", () => {
  it("stays dismissed when fewer of the same cycles qualify (as when the standard moved)", () => {
    const now = notes([36, 40, 28, 41]).find((n) => n.id === "long_cycles")!;
    const starts = now.signature.split(",");
    expect(starts).toHaveLength(2);
    // Dismissed under the old 35-day line, when the 36-day cycle counted too.
    const olderSignature = ["2025-11-01", ...starts].join(",");
    expect(visibleNotes([now], { dismissedFlags: { long_cycles: olderSignature } })).toEqual([]);
  });

  it("comes back when a new long cycle joins the evidence", () => {
    const now = notes([40, 28, 41, 42]).find((n) => n.id === "long_cycles")!;
    const firstTwo = now.signature.split(",").slice(0, 2).join(",");
    expect(visibleNotes([now], { dismissedFlags: { long_cycles: firstTwo } })).toEqual([now]);
  });

  it("stays dismissed when nothing changed", () => {
    const now = notes([40, 41, 28, 28]).find((n) => n.id === "long_cycles")!;
    expect(visibleNotes([now], { dismissedFlags: { long_cycles: now.signature } })).toEqual([]);
  });
});
