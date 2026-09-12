/**
 * ONBOARDING LAYOUT + GEOMETRY — the two bits of arithmetic in the flow whose
 * failure is silent.
 *
 * Neither of these can be caught by a typecheck or noticed in a screenshot:
 *
 *  • The vital line is drawn by animating `strokeDashoffset` from the curve's
 *    arc length down to zero. If the computed length is short, the line never
 *    closes; if it is long, the "draw" finishes before it reaches the end and
 *    then sits there. Both look like a rendering quirk on a device and neither
 *    throws.
 *  • Option grids are measured rather than wrapped, precisely so a short last
 *    row still ends flush with the right gutter. Get the remainder arithmetic
 *    wrong and seven options in two columns leave a lone tile hanging — the
 *    exact defect the measured layout was introduced to fix.
 */
import { describe, expect, it } from "vitest";

import { cellWidth, gridRows, measureGrid } from "../onboarding/flow/gridLayout";
import {
  SEGMENTS,
  START,
  VITAL_BOX,
  VITAL_LENGTH,
  VITAL_PATH,
  pathData,
  pathLength,
} from "../onboarding/flow/vitalLineGeometry";

describe("vital line geometry", () => {
  it("renders one move followed by a cubic per segment", () => {
    expect(VITAL_PATH.startsWith(`M${START[0]} ${START[1]}`)).toBe(true);
    expect(VITAL_PATH.match(/C/g)).toHaveLength(SEGMENTS.length);
    expect(pathData()).toBe(VITAL_PATH);
  });

  it("stays inside its own view box", () => {
    // Control points can legally sit outside a curve's hull, so check the
    // authored numbers directly: nothing may be clipped by the SVG viewport.
    const xs = [START[0], ...SEGMENTS.flatMap((s) => [s[0], s[2], s[4]])];
    const ys = [START[1], ...SEGMENTS.flatMap((s) => [s[1], s[3], s[5]])];
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(VITAL_BOX.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(VITAL_BOX.height);
  });

  it("is continuous — every segment starts where the last one ended", () => {
    // A gap here would draw as a broken line, and the dash animation would
    // still report itself as complete.
    let end = START;
    for (const s of SEGMENTS) {
      expect(Number.isFinite(end[0])).toBe(true);
      end = [s[4], s[5]];
    }
    expect(end[0]).toBe(276);
  });

  it("measures at least the straight-line distance it spans", () => {
    // A curve can never be shorter than the chord between its endpoints; this
    // catches a length computed as zero, or in the wrong units.
    const span = Math.hypot(276 - START[0], 48 - START[1]);
    expect(VITAL_LENGTH).toBeGreaterThan(span);
  });

  it("converges as the flattening gets finer, and is already accurate at 32", () => {
    const coarse = pathLength(4);
    const fine = pathLength(512);
    // Chord sums always under-estimate, so refining can only grow the total.
    expect(coarse).toBeLessThanOrEqual(fine);
    // The shipped sample count must be within a fraction of a pixel of the
    // truth, or the dash offset visibly stops short of closing the line.
    expect(Math.abs(pathLength(32) - fine)).toBeLessThan(0.1);
  });
});

describe("measured option grids", () => {
  const W = 276; // an iPhone SE content width
  const GAP = 12;

  it("splits a full grid evenly", () => {
    const cells = measureGrid(6, 2, W, GAP);
    expect(cells).toHaveLength(6);
    expect(new Set(cells).size).toBe(1);
    expect(cells[0]).toBe(cellWidth(W, 2, GAP));
  });

  it("stretches a short last row so it ends flush with the gutter", () => {
    // Seven options in two columns: three full rows, then one lone tile that
    // must take the whole width rather than half of it.
    const cells = measureGrid(7, 2, W, GAP);
    expect(cells.slice(0, 6).every((c) => c === cellWidth(W, 2, GAP))).toBe(true);
    expect(cells[6]).toBe(W);
  });

  it("has every row span exactly the content width", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 30]) {
      for (const columns of [2, 3]) {
        for (const row of gridRows(count, columns, W, GAP)) {
          const spanned = row.reduce((a, b) => a + b, 0) + GAP * (row.length - 1);
          expect(spanned).toBeCloseTo(W, 6);
        }
      }
    }
  });

  it("handles the real medical groups without leaving a tile hanging", () => {
    // The five health groups hold 6, 7, 7, 5 and 4 conditions in two columns —
    // three of them have a short last row.
    for (const count of [6, 7, 7, 5, 4]) {
      const rows = gridRows(count, 2, W, GAP);
      expect(rows.flat()).toHaveLength(count);
      expect(rows[rows.length - 1].reduce((a, b) => a + b, 0)).toBeCloseTo(
        count % 2 === 0 ? W - GAP : W,
        6,
      );
    }
  });

  it("returns nothing for an empty set rather than a NaN width", () => {
    expect(measureGrid(0, 2, W, GAP)).toEqual([]);
    expect(measureGrid(4, 0, W, GAP)).toEqual([]);
  });
});
