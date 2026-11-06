/**
 * DOT MATRIX — the digits behind the dotted figures on Home's macro cards.
 *
 * What is protected is a LOOK that a type checker cannot see: ten shapes that
 * must never be confusable, and a figure that must never outgrow the card it
 * sits in. Both are properties of the geometry, so both are tested as such.
 */
import { describe, expect, it } from "vitest";

import {
  DOT_COLS,
  DOT_FILL,
  DOT_ROWS,
  GHOST_SCALE,
  digitsOf,
  dotLayout,
  dotsPath,
  figureColumns,
  fitPitch,
  glyphRows,
  glyphsOf,
} from "@/components/ui/dotMatrix";

const DIGITS = "0123456789".split("");

describe("the glyphs", () => {
  it("are a full 5×7 grid each, written with only '#' and '.'", () => {
    for (const d of DIGITS) {
      const rows = glyphRows(d);
      expect(rows, d).toHaveLength(DOT_ROWS);
      for (const row of rows ?? []) {
        expect(row, d).toHaveLength(DOT_COLS);
        expect(row, d).toMatch(/^[#.]+$/);
      }
    }
  });

  it("are all distinct, so no two figures can be misread for each other", () => {
    const shapes = DIGITS.map((d) => (glyphRows(d) ?? []).join("|"));
    expect(new Set(shapes).size).toBe(DIGITS.length);
  });

  it("keep zero and eight apart — the pair a slash-less zero risks blurring", () => {
    expect(glyphRows("0")).not.toEqual(glyphRows("8"));
  });
});

describe("dotLayout", () => {
  it("lights every cell the glyph names and ghosts the rest — 35 cells a digit", () => {
    for (const d of DIGITS) {
      const { lit, ghost } = dotLayout(d, 5);
      const art = (glyphRows(d) ?? []).join("");
      expect(lit.length).toBe(art.split("#").length - 1);
      expect(lit.length + ghost.length).toBe(DOT_COLS * DOT_ROWS);
    }
  });

  it("lays digits side by side with a one-column gap", () => {
    expect(figureColumns(1)).toBe(5);
    expect(figureColumns(2)).toBe(11);
    expect(figureColumns(3)).toBe(17);
    expect(dotLayout("350", 4).width).toBe(17 * 4);
    expect(dotLayout("350", 4).height).toBe(7 * 4);
  });

  it("keeps every dot inside the figure's own box", () => {
    const { lit, ghost, width, height, radius } = dotLayout("8080", 5);
    for (const { x, y } of [...lit, ...ghost]) {
      expect(x - radius).toBeGreaterThanOrEqual(0);
      expect(x + radius).toBeLessThanOrEqual(width);
      expect(y - radius).toBeGreaterThanOrEqual(0);
      expect(y + radius).toBeLessThanOrEqual(height);
    }
  });

  it("draws an unlit cell smaller than a lit dot, so the figure stands out of its grid", () => {
    const { radius, ghostRadius } = dotLayout("8", 5);
    expect(ghostRadius).toBeLessThan(radius);
    expect(ghostRadius).toBeGreaterThan(0);
    expect(ghostRadius).toBeCloseTo(radius * GHOST_SCALE, 10);
  });

  it("keeps lit dots from touching: there is always a gap between two", () => {
    const { radius } = dotLayout("8", 5);
    // Two neighbouring cells are one pitch apart; their dots must not meet.
    expect(radius * 2).toBeLessThan(5);
    expect(DOT_FILL).toBeLessThan(0.85);
  });

  it("skips anything that is not a digit rather than drawing a hole", () => {
    expect(dotLayout("1x2", 5).width).toBe(dotLayout("12", 5).width);
    expect(dotLayout("", 5).lit).toHaveLength(0);
    expect(dotLayout("", 5).width).toBe(0);
  });
});

describe("the display words", () => {
  const SIGNS = ["+", "D", "E", "G", "N", "O"];

  it("are full 5×7 glyphs like the digits", () => {
    for (const c of SIGNS) {
      const rows = glyphRows(c);
      expect(rows, c).toHaveLength(DOT_ROWS);
      for (const row of rows ?? []) {
        expect(row, c).toHaveLength(DOT_COLS);
        expect(row, c).toMatch(/^[#.]+$/);
      }
    }
  });

  it("never take the shape of a digit they could be misread for — O is the one lamp-twin of 0", () => {
    const digitShapes = new Set(DIGITS.map((d) => (glyphRows(d) ?? []).join("|")));
    for (const c of SIGNS.filter((s) => s !== "O")) {
      expect(digitShapes.has((glyphRows(c) ?? []).join("|")), c).toBe(false);
    }
    expect(glyphRows("O")).toEqual(glyphRows("0"));
  });

  it("are drawn from a word, case-insensitively, dropping what has no glyph", () => {
    expect(glyphsOf("done")).toBe("DONE");
    expect(glyphsOf("Go!")).toBe("GO");
    expect(glyphsOf("+12")).toBe("+12");
    expect(dotLayout(glyphsOf("DONE"), 4).width).toBe(figureColumns(4) * 4);
  });
});

describe("fitPitch", () => {
  it("leaves a figure at full size when it fits", () => {
    expect(fitPitch(3, 200, 5)).toBe(5);
  });

  it("shrinks the dots, never the card, when the figure would overflow", () => {
    const pitch = fitPitch(3, 68, 5);
    expect(pitch).toBeLessThan(5);
    expect(dotLayout("350", pitch).width).toBeLessThanOrEqual(68 + 1e-9);
  });

  it("makes a fourth digit fit by shrinking, not by overflowing", () => {
    const pitch = fitPitch(4, 90, 5);
    expect(dotLayout("1234", pitch).width).toBeLessThanOrEqual(90 + 1e-9);
  });

  it("falls back to the full pitch when it has nothing to fit into yet", () => {
    expect(fitPitch(3, 0, 5)).toBe(5);
    expect(fitPitch(0, 100, 5)).toBe(5);
  });
});

describe("digitsOf", () => {
  it("rounds and never goes negative", () => {
    expect(digitsOf(349.6)).toBe("350");
    expect(digitsOf(0)).toBe("0");
    expect(digitsOf(-4)).toBe("0");
  });

  it("survives NaN and infinity without printing them", () => {
    expect(digitsOf(Number.NaN)).toBe("0");
    expect(digitsOf(Number.POSITIVE_INFINITY)).toBe("0");
  });

  it("caps a runaway value instead of printing an exponent", () => {
    expect(digitsOf(1e21)).toBe("99999");
  });
});

describe("dotsPath", () => {
  it("draws one circle — two arcs — per dot, as ONE path", () => {
    const { lit, radius } = dotLayout("8", 5);
    const d = dotsPath(lit, radius);
    expect(d.split("M").length - 1).toBe(lit.length);
    expect(d.split("a").length - 1).toBe(lit.length * 2);
  });

  it("is empty for no dots", () => {
    expect(dotsPath([], 2)).toBe("");
  });
});
