/**
 * The session ring's shape and colours — shared by the animated Skia ring and
 * the static SVG one, so the instrument is the same object on every surface.
 *
 * Pure: no React, no Skia.
 */

/* ── Geometry ─────────────────────────────────────────────────────────────── */

export interface RingGeometry {
  count: number;
  cx: number;
  cy: number;
  R: number;
  /** Radius of the band's centreline, and its width. */
  arcR: number;
  arcW: number;
  /** How far the darker lip sits below the band. */
  lip: number;
  /** The overtime hand's track, outside the band. */
  handR: number;
  /** The stroke of shine along the band: its radius and width. */
  shineR: number;
  shineW: number;
  /** The still plate the figure stands on. */
  plateR: number;
  /** Where set `i`'s arc starts, in degrees (−90 = twelve o'clock). */
  startDeg: (i: number) => number;
  /** Each set's sweep, in degrees, cap to cap. */
  sweepDeg: number;
  /** How far the shine starts inside a fill — clear of its rounded end. */
  shineInsetDeg: number;
}

export function ringGeometry(size: number, segments: number): RingGeometry {
  const count = Math.max(1, Math.round(segments));
  const R = size / 2;
  const arcW = size * 0.052;
  const arcR = R * 0.86;
  // A round cap reaches half a band-width past the end of its arc, so a
  // chunky band eats its own gaps: the arc is cut short by both caps plus the
  // gap you actually see — which shrinks with the set count, so two sets read
  // as two and six don't look like a dashed line.
  const capDeg = (arcW / 2 / arcR) * (180 / Math.PI);
  const visibleGap = count > 1 ? Math.min(6, 30 / count) : 0;
  const gapDeg = count > 1 ? visibleGap + capDeg * 2 : 0;
  const step = 360 / count;
  const sweepDeg = count === 1 ? 359.9 : step - gapDeg;
  return {
    count,
    cx: R,
    cy: R,
    R,
    arcR,
    arcW,
    lip: arcW * 0.3,
    handR: R * 0.975,
    shineR: arcR + arcW * 0.16,
    shineW: arcW * 0.22,
    plateR: R * 0.76,
    startDeg: (i) => -90 + i * step + gapDeg / 2,
    sweepDeg,
    shineInsetDeg: capDeg * 0.9,
  };
}

/* ── Colour ───────────────────────────────────────────────────────────────── */

/** #RGB / #RRGGBB → [r, g, b]; anything else is black. */
function rgb(hex: string): [number, number, number] {
  const h = (hex ?? "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const hex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** `a` laid over `b` at opacity `t` — an OPAQUE colour, so a lip under it stays hidden. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] * t + y[0] * (1 - t), x[1] * t + y[1] * (1 - t), x[2] * t + y[2] * (1 - t)]);
}

/** Toward black by `t` (0…1). */
export function deepen(color: string, t: number): string {
  const [r, g, b] = rgb(color);
  return hex([r * (1 - t), g * (1 - t), b * (1 - t)]);
}

/** Perceived lightness 0–1. */
function lightness(color: string): number {
  const [r, g, b] = rgb(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface RingPalette {
  /** The band, banked or live: the phase colour, flat. */
  fill: string;
  /** Under the band. */
  fillLip: string;
  /** An empty set. */
  track: string;
  trackLip: string;
  /** The stroke of light along the band. */
  shine: string;
  /** The figure's plate. */
  plate: string;
}

/**
 * The ring's colours, from the phase ramp and the ground it sits on.
 *
 * The track and plate are MIXED against the ground rather than drawn
 * translucent: the lip sits under the band, and under a translucent band it
 * would show through as a darker stripe.
 */
export function ringPalette(
  ramp: readonly [string, string, ...string[]],
  ground: string | undefined,
): RingPalette {
  const page = ground && /^#/.test(ground) ? ground : "#000000";
  const dark = lightness(page) < 0.5;
  const fill = ramp[Math.floor(ramp.length / 2)] ?? ramp[0];
  const deep = ramp[ramp.length - 1];
  const track = mix(fill, page, dark ? 0.24 : 0.2);
  return {
    fill,
    fillLip: deepen(deep, 0.28),
    track,
    trackLip: dark ? deepen(track, 0.45) : deepen(track, 0.12),
    shine: dark ? "#FFFFFF59" : "#FFFFFF73",
    plate: mix(fill, page, dark ? 0.06 : 0.07),
  };
}
