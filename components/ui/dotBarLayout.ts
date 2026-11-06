/**
 * DOT BAR — the geometry behind <DotBar>, a progress bar made of a few square dots.
 *
 * A single row of EIGHT chunky square cells, the same lit/unlit idea as the dots
 * of <DotNumeral> but big enough to count at a glance. How many are lit is the
 * progress; the lit run starts at the left edge and reaches the far end only when
 * the goal is met.
 *
 * Pure, so "does a barely-started bar still look started", "does a nearly-done
 * bar still look unfinished" and "do the cells fit their box" are arithmetic
 * rather than something to squint at on a phone.
 */

/** Cells in a bar. Few and large on purpose: eight reads at a glance, forty doesn't. */
export const DOT_BAR_CELLS = 8;

/** The space between two cells, as a share of a cell. */
const GAP_SHARE = 0.4;
/** Corner radius as a share of a cell: square, with just the sharpest edge taken off. */
const RADIUS_SHARE = 0.18;

/**
 * How many cells a progress value lights.
 *
 * ANY real progress lights at least one cell: a bar at 1% that looked like a bar
 * at 0% would turn "nothing logged" into a statement that can't be trusted. And
 * the LAST cell belongs to the goal alone — 95% of the way there is seven cells,
 * never eight, so a full bar always means the target was reached. 0, negatives and
 * NaN light none; anything at or past the goal lights every cell.
 */
export function litCells(progress: number, count: number = DOT_BAR_CELLS): number {
  if (!(progress > 0)) return 0;
  if (progress >= 1) return count;
  return Math.max(1, Math.min(count - 1, Math.round(progress * count)));
}

/**
 * Width ÷ height of a bar of `count` square cells — what makes them SQUARE: the
 * geometry divides the width by this to get a cell's side, which is also the
 * bar's height.
 */
export function dotBarAspect(count: number = DOT_BAR_CELLS): number {
  return count + (count - 1) * GAP_SHARE;
}

export interface DotBarGeometry {
  /** A cell's side — and so the bar's height. */
  size: number;
  /** Left edge to left edge of two neighbouring cells. */
  pitch: number;
  /** Every cell as one path (fill it; no stroke). */
  d: string;
  /**
   * `edges[n]` is how wide the coloured window must be to light exactly `n`
   * dots, 0 ≤ n ≤ count.
   *
   * It ends in the MIDDLE of the gap after dot n, not on the left edge of dot
   * n+1. A window ending exactly on the next dot's edge is at the mercy of pixel
   * snapping: a fraction of a pixel too wide and a sliver of the unlit dot comes
   * out coloured (seen at 95% and at 3% in the mock). Half a gap of slack is
   * several pixels — snapping can't reach it, and nothing is drawn in a gap.
   */
  edges: number[];
}

const n2 = (v: number) => Math.round(v * 100) / 100;

/** One rounded square at (x, y), drawn with absolute coordinates so nothing drifts. */
function cellPath(x: number, y: number, s: number, r: number): string {
  const x1 = x + s;
  const y1 = y + s;
  return (
    `M${n2(x + r)} ${n2(y)}H${n2(x1 - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x1)} ${n2(y + r)}` +
    `V${n2(y1 - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x1 - r)} ${n2(y1)}` +
    `H${n2(x + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x)} ${n2(y1 - r)}` +
    `V${n2(y + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + r)} ${n2(y)}Z`
  );
}

/** The cells for a bar `width` wide. Its height is `size`, which is `width / dotBarAspect()`. */
export function dotBarGeometry(width: number, count: number = DOT_BAR_CELLS): DotBarGeometry {
  const size = width / dotBarAspect(count);
  const pitch = size * (1 + GAP_SHARE);
  const radius = size * RADIUS_SHARE;
  const halfGap = (pitch - size) / 2;
  let d = "";
  const edges = [0];
  for (let i = 0; i < count; i++) {
    d += cellPath(i * pitch, 0, size, radius);
    edges.push(Math.min(width, (i + 1) * pitch - halfGap));
  }
  return { size, pitch, d, edges };
}
