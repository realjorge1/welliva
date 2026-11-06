/**
 * DOT BAR — the row of square dots under Home's macro cards.
 *
 * The properties that matter are the ones a bar can quietly get wrong: an empty
 * bar must be EMPTY (the owner's rule: at zero there is no colour at all), a bar
 * with any progress must not look empty, a bar short of its goal must not look
 * finished, and the dots must fit — and be square in — the box they are drawn in.
 */
import { describe, expect, it } from "vitest";

import {
  DOT_BAR_CELLS,
  dotBarAspect,
  dotBarGeometry,
  litCells,
} from "@/components/ui/dotBarLayout";

describe("litCells", () => {
  it("lights nothing at zero — an empty bar carries no colour", () => {
    expect(litCells(0)).toBe(0);
  });

  it("treats negatives and NaN as empty, never as a crash", () => {
    expect(litCells(-0.4)).toBe(0);
    expect(litCells(Number.NaN)).toBe(0);
  });

  it("lights at least one dot for ANY real progress", () => {
    // 1% of 8 rounds to 0, which would draw a started bar as an empty one.
    expect(litCells(0.01)).toBe(1);
    expect(litCells(0.0001)).toBe(1);
  });

  it("lights every dot at the goal and does not run past it", () => {
    expect(litCells(1)).toBe(DOT_BAR_CELLS);
    expect(litCells(1.8)).toBe(DOT_BAR_CELLS);
    expect(litCells(Number.POSITIVE_INFINITY)).toBe(DOT_BAR_CELLS);
  });

  it("keeps the last dot for the goal: nearly there is never a full bar", () => {
    // 95% rounds to all eight, which would say "done" with 5% still to eat.
    expect(litCells(0.95)).toBe(DOT_BAR_CELLS - 1);
    expect(litCells(0.9999)).toBe(DOT_BAR_CELLS - 1);
  });

  it("is proportional in between, and never goes backwards as progress grows", () => {
    expect(litCells(0.5)).toBe(4);
    expect(litCells(0.25)).toBe(2);
    let last = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const lit = litCells(p);
      expect(lit).toBeGreaterThanOrEqual(last);
      last = lit;
    }
  });

  it("follows a custom dot count", () => {
    expect(litCells(0.5, 10)).toBe(5);
  });
});

describe("dotBarGeometry", () => {
  const W = 90;

  it("draws about eight dots — few and large, not a texture", () => {
    expect(DOT_BAR_CELLS).toBe(8);
    const { d } = dotBarGeometry(W);
    expect(d.split("M").length - 1).toBe(DOT_BAR_CELLS);
  });

  it("makes the bar exactly as tall as one dot, so the aspect ratio is the shape", () => {
    const { size } = dotBarGeometry(W);
    expect(W / dotBarAspect()).toBeCloseTo(size, 10);
  });

  it("makes the dots big enough to count at a glance on a three-across card", () => {
    // ~90pt of room: a dot under 6pt would be the "too tiny" the owner ruled out.
    expect(dotBarGeometry(W).size).toBeGreaterThan(6);
  });

  it("spaces the dots with a gap, and ends flush with both edges", () => {
    const { size, pitch } = dotBarGeometry(W);
    expect(pitch).toBeGreaterThan(size);
    const lastRight = (DOT_BAR_CELLS - 1) * pitch + size;
    expect(lastRight).toBeCloseTo(W, 6);
  });

  it("keeps every dot inside the box", () => {
    const { size, d } = dotBarGeometry(W);
    const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    // Every coordinate in the path is an x, a y or a radius — none leaves the box.
    for (const v of nums) {
      expect(v).toBeGreaterThanOrEqual(-0.01);
      expect(v).toBeLessThanOrEqual(W + 0.01);
    }
    expect(size).toBeLessThanOrEqual(W);
  });

  it("gives the lit window one width per dot count, from nothing to the whole bar", () => {
    const { edges } = dotBarGeometry(W);
    expect(edges).toHaveLength(DOT_BAR_CELLS + 1);
    expect(edges[0]).toBe(0);
    expect(edges[DOT_BAR_CELLS]).toBeCloseTo(W, 6);
  });

  it("ends each lit window in the gap after its last dot, clear of the next one", () => {
    const { edges, size, pitch } = dotBarGeometry(W);
    for (let n = 1; n < DOT_BAR_CELLS; n++) {
      const lastLitRight = (n - 1) * pitch + size;
      const nextLeft = n * pitch;
      // Past the lit dot, short of the unlit one — with room to spare either way,
      // so pixel snapping can't colour a sliver of a dot that isn't lit.
      expect(edges[n]).toBeGreaterThan(lastLitRight + 0.5);
      expect(edges[n]).toBeLessThan(nextLeft - 0.5);
    }
  });

  it("scales down to a narrow bar and keeps the dots separate", () => {
    const narrow = dotBarGeometry(60);
    expect(narrow.pitch).toBeGreaterThan(narrow.size);
    expect(narrow.size).toBeLessThan(dotBarGeometry(W).size);
  });
});
