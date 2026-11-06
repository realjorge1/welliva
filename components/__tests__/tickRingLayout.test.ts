/**
 * The Diet screen's graduated calorie dial (components/ui/TickRing). Pinned:
 * it starts where every other ring starts and turns the same way, it fits its
 * box, and the long strokes are where the eye expects them.
 */
import { describe, expect, it } from "vitest";
import { RING_MAJOR_EVERY, RING_TICKS, litTicks, tickRing } from "../ui/tickRingLayout";

const SIZE = 132;
const LEN = 14;
const SW = 2.6;
const C = SIZE / 2;

describe("litTicks", () => {
  it("lights nothing for no progress, and at least one for any", () => {
    expect(litTicks(0)).toBe(0);
    expect(litTicks(Number.NaN)).toBe(0);
    expect(litTicks(0.001)).toBe(1);
    expect(litTicks(0.5)).toBe(RING_TICKS / 2);
    expect(litTicks(1.4)).toBe(RING_TICKS);
  });
});

describe("tickRing", () => {
  const g = tickRing(SIZE, LEN, SW);

  it("draws one segment per stroke, in order", () => {
    expect(g.segments).toHaveLength(RING_TICKS);
    expect(g.all).toBe(g.segments.join(""));
  });

  it("starts at 6 o'clock and turns clockwise, like every Ring", () => {
    // First stroke straight down from the centre.
    expect(g.outerX[0]).toBeCloseTo(C, 1);
    expect(g.outerY[0]).toBeGreaterThan(C + 50);
    // A quarter of the way round is 9 o'clock (left), half is 12 (top).
    const q = RING_TICKS / 4;
    expect(g.outerX[q]).toBeLessThan(C - 50);
    expect(g.outerY[q]).toBeCloseTo(C, 1);
    expect(g.outerY[RING_TICKS / 2]).toBeLessThan(C - 50);
  });

  it("keeps every stroke, round caps included, inside its box", () => {
    for (let i = 0; i < RING_TICKS; i++) {
      for (const v of [g.outerX[i], g.outerY[i], g.innerX[i], g.innerY[i]]) {
        expect(v - SW / 2).toBeGreaterThanOrEqual(-0.01);
        expect(v + SW / 2).toBeLessThanOrEqual(SIZE + 0.01);
      }
    }
  });

  it("makes every fifth stroke the long one", () => {
    const len = (i: number) => Math.hypot(g.outerX[i] - g.innerX[i], g.outerY[i] - g.innerY[i]);
    expect(len(0)).toBeCloseTo(LEN, 1);
    expect(len(RING_MAJOR_EVERY)).toBeCloseTo(LEN, 1);
    expect(len(1)).toBeLessThan(LEN * 0.7);
  });
});
