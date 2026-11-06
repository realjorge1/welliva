/**
 * TICK LIT COUNT — the rule behind how many strokes of Home's calorie dial are lit.
 *
 * The properties that matter are the ones a dial can quietly get wrong: an empty
 * one must be EMPTY (the owner's rule: at zero there is no colour at all), and one
 * with any progress must not look empty.
 */
import { describe, expect, it } from "vitest";

import { litStrokes } from "@/components/ui/tickBarLayout";

const COUNT = 25;

describe("litStrokes", () => {
  it("lights nothing at zero — an empty dial carries no colour", () => {
    expect(litStrokes(0, COUNT)).toBe(0);
  });

  it("treats negatives and NaN as empty, never as a crash", () => {
    expect(litStrokes(-0.4, COUNT)).toBe(0);
    expect(litStrokes(Number.NaN, COUNT)).toBe(0);
  });

  it("lights at least one stroke for ANY real progress", () => {
    // 1% of 25 rounds to 0, which would draw a started dial as an empty one.
    expect(litStrokes(0.01, COUNT)).toBe(1);
    expect(litStrokes(0.0001, COUNT)).toBe(1);
  });

  it("lights them all at the goal and does not run past it", () => {
    expect(litStrokes(1, COUNT)).toBe(COUNT);
    expect(litStrokes(1.8, COUNT)).toBe(COUNT);
  });

  it("is proportional in between, and never goes backwards as progress grows", () => {
    expect(litStrokes(0.5, COUNT)).toBe(Math.round(0.5 * COUNT));
    let last = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const lit = litStrokes(p, COUNT);
      expect(lit).toBeGreaterThanOrEqual(last);
      last = lit;
    }
  });

  it("follows a custom stroke count", () => {
    expect(litStrokes(0.5, 10)).toBe(5);
  });
});
