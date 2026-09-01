/**
 * CHIP GRID LAYOUT — the row-breaking behind the profile editor's option groups.
 *
 * What is being protected here is a LOOK, which is why it is tested as
 * arithmetic. The bug this component exists to fix — every group of chips piled
 * to the left with a different ragged gutter — is invisible to a type checker
 * and obvious to anyone holding the phone, so the properties that produce the
 * fix are pinned instead:
 *
 *   FLUSH    — every row spans the full width, to the pixel.
 *   BALANCED — rows are as even as the width allows, so six short options are
 *              3+3 and never 4+2, and five are never 4+widow.
 *   HONEST   — a row never holds more than actually fits, because the fallback
 *              for over-packing is labels silently wrapping to two lines.
 */
import { describe, expect, it } from "vitest";

import {
  estimateChipWidth,
  justifyRow,
  packRows,
} from "@/components/ui/chipGridLayout";

const GAP = 8;
/** A phone-width card's content box, roughly. */
const WIDTH = 320;

const widthsOf = (labels: string[]) =>
  labels.map((label) => estimateChipWidth({ label }, "md"));

/** Sum of a row's chips plus its gaps — what the row actually occupies. */
const rowWidth = (widths: number[], row: number[]) =>
  row.reduce((s, i) => s + widths[i], 0) + GAP * (row.length - 1);

describe("packRows", () => {
  it("keeps everything on one row when it all fits", () => {
    const w = widthsOf(["Male", "Female"]);
    expect(packRows(w, WIDTH, GAP, 4)).toEqual([[0, 1]]);
  });

  it("balances six short options 3+3 rather than 4+2", () => {
    const w = widthsOf(["2 days", "3 days", "4 days", "5 days", "6 days", "7 days"]);
    const rows = packRows(w, WIDTH, GAP, 4);
    expect(rows.map((r) => r.length)).toEqual([3, 3]);
  });

  it("never leaves a single chip widowed under a full row", () => {
    const w = widthsOf(["None", "Vegan", "Halal", "Kosher", "Pescatarian"]);
    const rows = packRows(w, WIDTH, GAP, 4);
    expect(rows[rows.length - 1].length).toBeGreaterThan(1);
  });

  it("puts the longer row first when the deal is uneven", () => {
    const w = widthsOf(["Neck", "Arm", "Hip", "Leg", "Knee"]);
    const rows = packRows(w, WIDTH, GAP, 3);
    expect(rows.map((r) => r.length)).toEqual([3, 2]);
  });

  it("gives an over-long label a row of its own instead of an empty row", () => {
    const w = widthsOf([
      "Moderate — active job or three to four sessions a week",
      "Light",
    ]);
    const rows = packRows(w, WIDTH, GAP, 4);
    expect(rows[0]).toEqual([0]);
    expect(rows[1]).toEqual([1]);
  });

  it("never packs a row wider than the container", () => {
    // Every group in the real profile editor, at three plausible widths.
    const groups = [
      ["Sedentary", "Light", "Moderate", "Very active", "Extra active"],
      ["Lose weight", "Build muscle", "Improve fitness", "More energy", "Better health", "Performance"],
      ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Shellfish", "Fish", "Wheat", "Soy", "Gluten"],
      ["Bodyweight", "Dumbbells", "Bands", "Pull-up bar", "Bench", "Kettlebell"],
      ["1st", "2nd", "3rd"],
    ];
    for (const containerWidth of [280, 320, 400]) {
      for (const labels of groups) {
        const w = widthsOf(labels);
        for (const row of packRows(w, containerWidth, GAP, 4)) {
          if (row.length === 1) continue; // a lone chip is allowed to overflow
          expect(rowWidth(w, row)).toBeLessThanOrEqual(containerWidth);
        }
      }
    }
  });

  it("repairs a widow on a long mixed-length list", () => {
    // The eleven injury areas at a card's real width: the even deal cannot fit,
    // and raw greedy strands "Ankle / foot" on a line of its own at the bottom.
    const w = widthsOf([
      "Neck", "Shoulder", "Arm / elbow", "Wrist / hand", "Chest", "Back",
      "Core / abs", "Hip", "Leg", "Knee", "Ankle / foot",
    ]);
    const rows = packRows(w, 302, GAP, 4);
    expect(rows[rows.length - 1].length).toBeGreaterThan(1);
    for (const row of rows) {
      expect(rowWidth(w, row)).toBeLessThanOrEqual(302);
    }
    expect(rows.flat()).toEqual(w.map((_, i) => i));
  });

  it("leaves a three-option group alone rather than moving its widow upward", () => {
    // Three options that only fit two to a row: someone gets a line to
    // themselves either way, and putting the lone chip FIRST is more
    // conspicuous, not less.
    const w = widthsOf(["Beginner", "Intermediate", "Advanced"]);
    const rows = packRows(w, 302, GAP, 4);
    expect(rows.map((r) => r.length)).toEqual([2, 1]);
  });

  it("respects maxPerRow", () => {
    const w = widthsOf(["a", "b", "c", "d", "e", "f", "g", "h"]);
    for (const row of packRows(w, 900, GAP, 3)) {
      expect(row.length).toBeLessThanOrEqual(3);
    }
  });

  it("returns nothing before the container has been measured", () => {
    expect(packRows(widthsOf(["Male", "Female"]), 0, GAP, 4)).toEqual([]);
    expect(packRows([], WIDTH, GAP, 4)).toEqual([]);
  });

  it("loses no options and keeps them in order", () => {
    const labels = ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Shellfish", "Fish", "Wheat"];
    const rows = packRows(widthsOf(labels), WIDTH, GAP, 4);
    expect(rows.flat()).toEqual(labels.map((_, i) => i));
  });
});

describe("justifyRow", () => {
  it("fills the container edge to edge", () => {
    const w = widthsOf(["Sedentary", "Light", "Moderate"]);
    const cells = justifyRow(w, [0, 1, 2], WIDTH, GAP);
    const total = cells.reduce((a, b) => a + b, 0) + GAP * 2;
    // Floored to a tenth per cell, so at most 0.3pt short of flush — and never
    // over, which is the direction that breaks a row.
    expect(total).toBeLessThanOrEqual(WIDTH);
    expect(total).toBeGreaterThan(WIDTH - 0.4);
  });

  it("never shrinks a chip below the width its label asked for", () => {
    // Only true of rows packRows actually produced — that is the contract the
    // two halves share, and it is what stops a justified label wrapping. A
    // hand-built over-packed row is correctly squeezed instead.
    const w = widthsOf(["None", "Vegetarian", "Vegan", "Gluten-free", "Halal"]);
    for (const row of packRows(w, WIDTH, GAP, 4)) {
      if (row.length === 1) continue;
      const cells = justifyRow(w, row, WIDTH, GAP);
      row.forEach((i, k) => {
        expect(cells[k]).toBeGreaterThanOrEqual(w[i] - 0.1);
      });
    }
  });

  it("keeps a longer label wider than a shorter one", () => {
    const w = widthsOf(["Soy", "Shellfish"]);
    const [short, long] = justifyRow(w, [0, 1], WIDTH, GAP);
    expect(long).toBeGreaterThan(short);
  });
});
