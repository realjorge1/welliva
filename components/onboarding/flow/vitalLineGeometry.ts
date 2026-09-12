/**
 * VITAL LINE GEOMETRY — the curve, and how long it is.
 *
 * Pure data and arithmetic, kept out of the component so it can be tested
 * without a React Native runtime. That is not ceremony: the line is drawn by
 * animating `strokeDashoffset` from its arc length to zero, and a length that
 * disagreed with the path would show as a line that either finishes early or
 * never closes — a silent, device-only bug. `getTotalLength()` is a DOM API and
 * is not available to us on native, so the length is computed here from the
 * same segment data the `d` string is built from, and the two can never drift.
 *
 * The shape itself: a long calm run, one full breath, a smaller second breath,
 * then calm again. Authored in a 280 × 72 box.
 */

/** Where the pen starts. */
export const START: readonly [number, number] = [4, 48];

/**
 * Each entry is one cubic Bézier segment, continuing from the previous end
 * point: [control1x, control1y, control2x, control2y, endx, endy].
 */
export const SEGMENTS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [30, 48, 44, 48, 62, 48], //    calm
  [80, 48, 84, 10, 104, 10], //   the breath in
  [124, 10, 128, 48, 146, 48], // and out
  [162, 48, 168, 48, 180, 48], // calm
  [194, 48, 198, 28, 212, 28], // a smaller second breath
  [226, 28, 230, 48, 244, 48],
  [256, 48, 266, 48, 276, 48], // calm again
];

export const VITAL_BOX = { width: 280, height: 72 } as const;

/** The segment data rendered as an SVG path. */
export function pathData(): string {
  return (
    `M${START[0]} ${START[1]}` +
    SEGMENTS.map((s) => ` C${s[0]} ${s[1]} ${s[2]} ${s[3]} ${s[4]} ${s[5]}`).join("")
  );
}

/** One axis of a cubic Bézier at parameter `t`. */
function cubicAt(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/**
 * Arc length, by flattening every segment into `samples` chords and summing
 * them. Chord-sum always UNDER-estimates a curve, so the sample count is what
 * bounds the error; at 32 per segment on a 280pt box it is well under a tenth
 * of a pixel, which is far finer than the dash animation can express.
 */
export function pathLength(samples = 32): number {
  let total = 0;
  let px = START[0];
  let py = START[1];
  for (const [c1x, c1y, c2x, c2y, ex, ey] of SEGMENTS) {
    const sx = px;
    const sy = py;
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const x = cubicAt(sx, c1x, c2x, ex, t);
      const y = cubicAt(sy, c1y, c2y, ey, t);
      total += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    px = ex;
    py = ey;
  }
  return total;
}

/** Built once at module load — both the component and its tests read these. */
export const VITAL_PATH = pathData();
export const VITAL_LENGTH = pathLength();
