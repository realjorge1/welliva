/**
 * SPARKLINE — a smooth line through a short series, as SVG path data.
 *
 * Pure geometry for Home's Fitness tile. Two choices carry the honesty:
 *
 *   · THE FLOOR IS ZERO. The line's height is the value's size against the
 *     series' own peak (or a fixed `ceiling`, for a score out of 100), not
 *     against its own low. A range-fitted line turns a
 *     120 → 122 wobble into a cliff beside a chip that says "+2%"; here the
 *     curve and the chip tell the same story. A series of nothing but zeros
 *     lies flat along the bottom.
 *
 *   · THE CURVE CANNOT OVERSHOOT. A plain spline dips below a flat stretch and
 *     rises above a peak, drawing minutes that were never trained. This one is
 *     monotone cubic (Fritsch–Carlson): between two points it only ever moves
 *     in the direction the data moves.
 *
 * It also hands back a TRACE of the same curve — dense points with their running
 * length — so the tile can draw the line on from left to right and keep a dot
 * exactly on the pen's tip. The dot and the stroke are both driven by distance
 * ALONG the curve, which is why they cannot drift apart.
 */

export interface SparkPoint {
  x: number;
  y: number;
}

/** The curve as a dense polyline with its running length. */
export interface SparkTrace {
  xs: number[];
  ys: number[];
  /** Length from the start to each point. `cum[0]` is 0, the last is `length`. */
  cum: number[];
  /** Total length of the traced curve. */
  length: number;
}

export interface Sparkline {
  /** Path data, ready for a <Path d>. Empty for an empty series. */
  d: string;
  /** Where each value landed. */
  points: SparkPoint[];
  /** The last point — where the end dot goes. Null for an empty series. */
  end: SparkPoint | null;
  /** The same curve, sampled — see {@link pointAtLength}. */
  trace: SparkTrace;
}

export interface SparkPad {
  x: number;
  top: number;
  bottom: number;
}

/** 8 all round: the end dot's halo is 7 wide, and must not be clipped by the box. */
const DEFAULT_PAD: SparkPad = { x: 8, top: 8, bottom: 8 };

/** Samples per curve segment. Plenty: the error is far under a pixel. */
const SAMPLES_PER_SEGMENT = 8;

const n2 = (v: number) => Math.round(v * 100) / 100;

const EMPTY_TRACE: SparkTrace = { xs: [], ys: [], cum: [], length: 0 };

/** A trace through plain points (a single value, or a curve with no width). */
function polylineTrace(points: readonly SparkPoint[]): SparkTrace {
  const xs: number[] = [];
  const ys: number[] = [];
  const cum: number[] = [];
  let length = 0;
  points.forEach((p, i) => {
    if (i > 0) length += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    xs.push(p.x);
    ys.push(p.y);
    cum.push(length);
  });
  return { xs, ys, cum, length };
}

export function sparkline(
  values: readonly number[],
  width: number,
  height: number,
  pad: SparkPad = DEFAULT_PAD,
  /**
   * The value that reaches the top. Leave out to scale to the series' own peak;
   * a score out of 100 passes 100, so 50 always sits halfway up.
   */
  ceiling?: number,
): Sparkline {
  const count = values.length;
  if (count === 0) return { d: "", points: [], end: null, trace: EMPTY_TRACE };

  const peak = Math.max(1, ceiling ?? 0, ...values);
  const innerW = Math.max(0, width - pad.x * 2);
  const innerH = Math.max(0, height - pad.top - pad.bottom);
  const bottom = height - pad.bottom;

  const points: SparkPoint[] = values.map((v, i) => ({
    x: count === 1 ? width / 2 : pad.x + (i / (count - 1)) * innerW,
    y: bottom - (Math.max(0, v) / peak) * innerH,
  }));
  const end = points[count - 1];

  if (count === 1) {
    return { d: `M${n2(end.x)} ${n2(end.y)}`, points, end, trace: polylineTrace(points) };
  }

  // Equal spacing along x, so a slope is just a rise over one constant step.
  const dx = points[1].x - points[0].x;
  if (!(dx > 0)) {
    // No width to spread over (not laid out yet): a polyline, not a divide by 0.
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${n2(p.x)} ${n2(p.y)}`).join("");
    return { d, points, end, trace: polylineTrace(points) };
  }
  const delta: number[] = [];
  for (let k = 0; k < count - 1; k++) delta.push((points[k + 1].y - points[k].y) / dx);

  const m: number[] = new Array(count);
  m[0] = delta[0];
  m[count - 1] = delta[count - 2];
  for (let k = 1; k < count - 1; k++) {
    m[k] = delta[k - 1] * delta[k] <= 0 ? 0 : (delta[k - 1] + delta[k]) / 2;
  }

  // Fritsch–Carlson: clamp each tangent pair so a segment never overshoots.
  for (let k = 0; k < count - 1; k++) {
    if (delta[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / delta[k];
    const b = m[k + 1] / delta[k];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[k] = tau * a * delta[k];
      m[k + 1] = tau * b * delta[k];
    }
  }

  let d = `M${n2(points[0].x)} ${n2(points[0].y)}`;
  const xs: number[] = [points[0].x];
  const ys: number[] = [points[0].y];
  const cum: number[] = [0];
  let length = 0;

  for (let k = 0; k < count - 1; k++) {
    const p0 = points[k];
    const p1 = points[k + 1];
    const c1x = p0.x + dx / 3;
    const c1y = p0.y + (m[k] * dx) / 3;
    const c2x = p1.x - dx / 3;
    const c2y = p1.y - (m[k + 1] * dx) / 3;
    d += `C${n2(c1x)} ${n2(c1y)} ${n2(c2x)} ${n2(c2y)} ${n2(p1.x)} ${n2(p1.y)}`;

    // Walk the same Bézier in small steps, keeping the running length.
    for (let j = 1; j <= SAMPLES_PER_SEGMENT; j++) {
      const t = j / SAMPLES_PER_SEGMENT;
      const u = 1 - t;
      const x = u * u * u * p0.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p1.x;
      const y = u * u * u * p0.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p1.y;
      length += Math.hypot(x - xs[xs.length - 1], y - ys[ys.length - 1]);
      xs.push(x);
      ys.push(y);
      cum.push(length);
    }
  }
  return { d, points, end, trace: { xs, ys, cum, length } };
}

/**
 * The point `target` units along a trace (clamped to its two ends).
 *
 * A WORKLET, and deliberately self-contained: it runs on the UI thread every
 * frame while the line draws, and a worklet that called another function would
 * need that function declared before it. Binary search, so a long trace costs a
 * handful of steps a frame.
 */
export function pointAtLength(
  xs: readonly number[],
  ys: readonly number[],
  cum: readonly number[],
  target: number,
): SparkPoint {
  "worklet";
  const n = cum.length;
  if (n === 0) return { x: 0, y: 0 };
  if (!(target > 0)) return { x: xs[0], y: ys[0] };
  if (target >= cum[n - 1]) return { x: xs[n - 1], y: ys[n - 1] };

  let lo = 1;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const span = cum[lo] - cum[lo - 1];
  const f = span > 0 ? (target - cum[lo - 1]) / span : 0;
  return {
    x: xs[lo - 1] + (xs[lo] - xs[lo - 1]) * f,
    y: ys[lo - 1] + (ys[lo] - ys[lo - 1]) * f,
  };
}
