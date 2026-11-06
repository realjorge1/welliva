/**
 * TICK RING — the geometry behind <TickRing>, a dial of graduated strokes.
 *
 * The round sibling of the tick bar: a ring of short radial strokes, like the
 * scale round a watch face, where progress is how many strokes are lit. Every
 * `majorEvery`-th stroke is longer, which marks the dial in equal parts without
 * printing a digit.
 *
 * It starts at 6 o'clock and runs clockwise — the same start and the same
 * direction as every other ring in the app (see Ring), so a dial and the rings
 * beside it fill the same way.
 *
 * Each stroke is its own small path segment, in order round the dial, so "the
 * first k strokes" is just the first k segments joined — which is what lets the
 * ring fill one stroke at a time without re-measuring anything.
 *
 * Pure, so "does it fit its box" and "does a barely-started dial show as
 * started" are arithmetic rather than something to squint at on a phone.
 */

/** Strokes round the dial. 60, like the minutes of a clock. */
export const RING_TICKS = 60;
/** Every fifth is long — twelve marks, like the hours. */
export const RING_MAJOR_EVERY = 5;

/**
 * How many strokes a progress value lights.
 *
 * ANY real progress lights at least one stroke: rounding alone would leave a dial
 * at 1% looking exactly like an empty one, and an empty dial is a statement
 * ("nothing logged") that has to stay true. 0, negatives and NaN light none.
 */
export function litTicks(progress: number, count: number = RING_TICKS): number {
  if (!(progress > 0)) return 0;
  return Math.min(count, Math.max(1, Math.round(progress * count)));
}

/** A minor stroke's length as a share of a major one's. */
const MINOR_SHARE = 0.58;

const n2 = (v: number) => Math.round(v * 100) / 100;

export interface TickRingGeometry {
  /** One "M…L…" segment per stroke, in order round the dial. */
  segments: string[];
  /** Every stroke as one path, for the unlit layer. */
  all: string;
  /** Each stroke's outer end, for the needle that rides the lit edge. */
  outerX: number[];
  outerY: number[];
  /** Each stroke's inner end. */
  innerX: number[];
  innerY: number[];
  /** The stroke width, so round caps stay inside the box. */
  strokeWidth: number;
}

/**
 * The strokes for a dial `size` across.
 *
 * `length` is a major stroke's length. The outer end of every stroke sits half a
 * stroke inside the box, because a round cap adds that much past the end — so
 * the dial fills its box exactly instead of poking out of it.
 */
export function tickRing(
  size: number,
  length: number,
  strokeWidth: number,
  count: number = RING_TICKS,
  majorEvery: number = RING_MAJOR_EVERY,
): TickRingGeometry {
  const c = size / 2;
  const outer = Math.max(0, c - strokeWidth / 2);
  const segments: string[] = [];
  const outerX: number[] = [];
  const outerY: number[] = [];
  const innerX: number[] = [];
  const innerY: number[] = [];

  for (let i = 0; i < count; i++) {
    // 6 o'clock, clockwise: on a screen (y grows downward) the angle π/2 points
    // straight down, and a growing angle turns clockwise.
    const a = Math.PI / 2 + (i / count) * Math.PI * 2;
    const len = i % majorEvery === 0 ? length : length * MINOR_SHARE;
    const inner = Math.max(0, outer - len);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const ox = n2(c + outer * cos);
    const oy = n2(c + outer * sin);
    const ix = n2(c + inner * cos);
    const iy = n2(c + inner * sin);
    outerX.push(ox);
    outerY.push(oy);
    innerX.push(ix);
    innerY.push(iy);
    segments.push(`M${ix} ${iy}L${ox} ${oy}`);
  }

  return { segments, all: segments.join(""), outerX, outerY, innerX, innerY, strokeWidth };
}
