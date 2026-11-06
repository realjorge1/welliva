import { describe, expect, it } from "vitest";
import {
  ENTER_FRACTION,
  INITIAL_ENTRANCE,
  stepEntrance,
  visibleFraction,
  type EntranceInput,
  type EntranceState,
} from "./scrollEntrance";

// A card 140pt tall, sitting 900pt down the page, on a 700pt viewport whose
// bottom 100pt is under the rail.
const BOX = { boxY: 900, boxH: 140 };
const view = (scrollY: number): EntranceInput => ({
  scrollY,
  viewportH: 700,
  reservedBottom: 100,
  ...BOX,
});

describe("visibleFraction", () => {
  it("is 0 while the card is below the usable part of the viewport", () => {
    // Usable bottom = scrollY + 600. At scrollY 300 that is 900 — the card's top edge.
    expect(visibleFraction(view(300))).toBe(0);
    expect(visibleFraction(view(0))).toBe(0);
  });

  it("grows as the card rises into view", () => {
    expect(visibleFraction(view(370))).toBeCloseTo(70 / 140, 6);
    expect(visibleFraction(view(440))).toBe(1);
  });

  it("is 0 once the card has gone off the top", () => {
    expect(visibleFraction(view(1040))).toBe(0);
    expect(visibleFraction(view(2000))).toBe(0);
  });

  it("counts only the part above the rail, not the part under it", () => {
    const withRail = visibleFraction(view(360));
    const noRail = visibleFraction({ ...view(360), reservedBottom: 0 });
    expect(noRail).toBeGreaterThan(withRail);
  });

  it("is 0 for a card with no height yet, never NaN", () => {
    expect(visibleFraction({ ...view(500), boxH: 0 })).toBe(0);
  });
});

describe("stepEntrance", () => {
  const run = (ys: number[], from: EntranceState = INITIAL_ENTRANCE) => {
    let state = from;
    return ys.map((y) => {
      const out = stepEntrance(state, view(y));
      state = out.state;
      return out.signal;
    });
  };

  it("waits while the card is out of view", () => {
    expect(run([0, 50, 120, 200, 290])).toEqual([null, null, null, null, null]);
  });

  it("plays once the card is mostly in view, scrolling DOWN, and then only once", () => {
    // 0.4 of 140 = 56pt in view -> scrollY 356. Scrolling on keeps it armed-off.
    const signals = run([300, 340, 360, 400, 440, 500]);
    expect(signals.filter((s) => s === 1)).toHaveLength(1);
    expect(signals[2]).toBe(1);
    expect(ENTER_FRACTION).toBe(0.4);
  });

  it("does not play at the first pixel — the card has to be mostly there", () => {
    expect(run([300, 310, 330, 350])).toEqual([null, null, null, null]);
  });

  it("wipes the line, and re-arms, only when the card has left the viewport entirely", () => {
    // In view, then back up until it is wholly below the usable area again.
    const signals = run([360, 330, 310, 290]);
    expect(signals).toEqual([1, null, null, 0]);
  });

  it("plays again on the next trip down", () => {
    const signals = run([360, 290, 200, 360]);
    expect(signals).toEqual([1, 0, null, 1]);
  });

  it("shows the finished line, without motion, when it arrives from the top while scrolling UP", () => {
    // Scrolled well past the card, then back up until it re-enters from above.
    const signals = run([1500, 1200, 1050, 1000, 980, 900]);
    // First sample: card is above the viewport, nothing to do. Walking up, the
    // card re-enters from the top: it arrives finished, not replayed.
    expect(signals.filter((s) => s === 1)).toHaveLength(0);
    expect(signals.filter((s) => s === 2)).toHaveLength(1);
  });

  it("treats the opening look, with no scroll yet, as a downward arrival", () => {
    // A tall phone: the card is already in view when the page first lays out.
    const out = stepEntrance(INITIAL_ENTRANCE, view(500));
    expect(out.signal).toBe(1);
  });

  it("stays quiet on every event in between", () => {
    const a = stepEntrance({ armed: false, lastY: 400 }, view(420));
    expect(a.signal).toBeNull();
    const b = stepEntrance({ armed: true, lastY: 0 }, view(100));
    expect(b.signal).toBeNull();
  });
});
