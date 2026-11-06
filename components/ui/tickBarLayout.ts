/**
 * TICK LIT COUNT — how many strokes of <TickRing> a progress value lights.
 *
 * (The straight bar of strokes this file was written for is gone — Home's macro
 * cards use <DotBar> now, see dotBarLayout.ts — but the dial still counts its
 * strokes by this rule.)
 *
 * Pure, so "is a barely-started dial still visibly started" is arithmetic rather
 * than something to squint at on a phone.
 */

/**
 * How many of `count` strokes a progress value lights.
 *
 * ANY real progress shows at least one stroke. Rounding alone would leave a
 * dial at 1% looking exactly like a dial at 0%, and an empty one is a statement
 * ("nothing logged") that has to stay true. 0, negatives and NaN light none.
 */
export function litStrokes(progress: number, count: number): number {
  if (!(progress > 0)) return 0;
  return Math.min(count, Math.max(1, Math.round(progress * count)));
}
