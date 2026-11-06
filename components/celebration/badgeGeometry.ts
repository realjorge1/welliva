/**
 * BADGE GEOMETRY — the shapes an achievement is struck in, as SVG path data.
 *
 * The owner (2026-11-01, Duolingo as the reference): the badges "appear
 * premium, but poor". Sixty-seven of them were the same round coin, so the
 * shelf read as a list of coloured circles: the only thing a bronze had that a
 * mythic didn't was a colour. Duolingo's league badges answer this with a
 * SHAPE per rank, and so do these — the rank is legible across the room
 * before a single word is read:
 *
 *   bronze → coin · silver → hexagon · gold → shield · platinum → rosette seal
 *   mythic → star
 *
 * Every shape is built the same way, so they stay one family: a plate standing
 * on its own thickness (the lip), a rim with one stroke of light along its
 * upper left, a face struck down into the rim (a crescent of shadow, then the
 * lit face with its own stroke of light), the glyph, and — when the badge
 * carries a label — a ribbon across its lower half, the way Duolingo writes
 * "LEVEL 3" across the foot of an award.
 *
 * Pure: no React, no react-native-svg. components/celebration/Badge draws
 * these; the tests read them directly.
 *
 * Geometry: a 100 × 108 box. Each plate fills roughly a 92-wide disc centred
 * at (50, 50), and its lip is the same silhouette dropped 6 below it, so a
 * badge is sized by width and never by tier.
 */

import type { BadgeShape } from "@/services/achievementBadges";

/** Height : width of the drawing (the lip hangs below the plate). */
export const BADGE_ASPECT = 1.08;
/** The drawing's box height, in the 100-wide units every path is written in. */
export const BADGE_BOX_H = 100 * BADGE_ASPECT;

/** How far the lip — the badge's own thickness — hangs below the plate. */
const LIP = 6;

type Pt = readonly [number, number];

export interface RibbonGeometry {
  /** The band the label is written on. */
  band: string;
  /** The two notched tails behind its ends. */
  tails: string;
  /** The folds where the band turns under into the tails. */
  folds: string;
  /** Where the label sits: its centre, cap height and the widest it may run. */
  text: { cx: number; cy: number; size: number; width: number };
}

export interface BadgeGeometry {
  /** The plate's silhouette. */
  rim: string;
  /** The same silhouette, dropped LIP below — the badge's thickness. */
  lip: string;
  /** An open stroke of light along the rim's upper left. */
  rimShine: string;
  /** The face's shadow: the face, centred, before the light nudges it. */
  faceShadow: string;
  /** The lit face — a touch smaller, nudged up and left. */
  face: string;
  /** An open stroke of light inside the face's upper left. */
  faceShine: string;
  /** Where the glyph sits: its centre and its size, in box units. */
  glyph: { cx: number; cy: number; size: number };
  /** The centre and radius of the lit face's widest round region (for a sheen clip). */
  faceDisc: { cx: number; cy: number; r: number };
  /** Present when the badge carries a label. */
  ribbon?: RibbonGeometry;
}

/* ── Point builders ───────────────────────────────────────────────────────── */

const r1 = (n: number) => Math.round(n * 10) / 10;

function bezier2(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function bezier3(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return [
    w0 * a[0] + w1 * c1[0] + w2 * c2[0] + w3 * b[0],
    w0 * a[1] + w1 * c1[1] + w2 * c2[1] + w3 * b[1],
  ];
}

/** A point `d` from `from` toward `to`. */
function toward(from: Pt, to: Pt, d: number): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [from[0] + (dx / len) * d, from[1] + (dy / len) * d];
}

function circlePts(cx: number, cy: number, r: number, n = 96): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/**
 * A polygon with every corner rounded off — `cut` back along each edge. The
 * straight runs between corners are sampled too, not just their ends: a stroke
 * of light that follows the outline (see openArc) walks these points, and with
 * only the corners to stand on it stopped short at the first one.
 */
function roundedPolygonPts(
  vertices: readonly Pt[],
  cut: (i: number) => number,
  steps = 7,
  edgeSteps = 8,
): Pt[] {
  const n = vertices.length;
  const corners = vertices.map((v, i) => ({
    a: toward(v, vertices[(i - 1 + n) % n], cut(i)),
    v,
    b: toward(v, vertices[(i + 1) % n], cut(i)),
  }));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const { a, v, b } = corners[i];
    for (let s = 0; s <= steps; s++) out.push(bezier2(a, v, b, s / steps));
    const next = corners[(i + 1) % n].a;
    for (let s = 1; s < edgeSteps; s++) {
      const t = s / edgeSteps;
      out.push([b[0] + (next[0] - b[0]) * t, b[1] + (next[1] - b[1]) * t]);
    }
  }
  return out;
}

/** Vertices of a regular polygon (or a star, with two radii) round (cx, cy). */
function radialVertices(cx: number, cy: number, radii: readonly number[], count: number, startDeg: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((startDeg + (360 / count) * i) * Math.PI) / 180;
    const r = radii[i % radii.length];
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** A pointy-topped hexagon of circumradius R, corners rounded. */
function hexPts(cx: number, cy: number, R: number): Pt[] {
  return roundedPolygonPts(radialVertices(cx, cy, [R], 6, -90), () => R * 0.2);
}

/**
 * A heater shield: a flat top with rounded shoulders, straight sides, and a
 * curved foot meeting in a point. Written for scale 1 about its own centre and
 * scaled from there, so the face is the same shield, smaller.
 */
function shieldPts(cx: number, cy: number, s: number): Pt[] {
  const P = (x: number, y: number): Pt => [cx + x * s, cy + y * s];
  const out: Pt[] = [];
  const line = (a: Pt, b: Pt, steps: number) => {
    for (let i = 0; i < steps; i++) out.push([a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]);
  };
  const quad = (a: Pt, c: Pt, b: Pt, steps: number) => {
    for (let i = 0; i < steps; i++) out.push(bezier2(a, c, b, i / steps));
  };
  const cubic = (a: Pt, c1: Pt, c2: Pt, b: Pt, steps: number) => {
    for (let i = 0; i < steps; i++) out.push(bezier3(a, c1, c2, b, i / steps));
  };
  const W = 42;
  const TOP = -45;
  const C = 12;
  const SIDE = 4;
  const TIP = 47;
  line(P(-W + C, TOP), P(W - C, TOP), 8);
  quad(P(W - C, TOP), P(W, TOP), P(W, TOP + C), 6);
  line(P(W, TOP + C), P(W, SIDE), 6);
  cubic(P(W, SIDE), P(W, 26), P(22, 40), P(0, TIP), 14);
  cubic(P(0, TIP), P(-22, 40), P(-W, 26), P(-W, SIDE), 14);
  line(P(-W, SIDE), P(-W, TOP + C), 6);
  quad(P(-W, TOP + C), P(-W, TOP), P(-W + C, TOP), 6);
  return out;
}

/**
 * A rosette seal: sixteen round lobes with sharp valleys between them — the
 * edge of a prize ribbon's rosette. `|cos|^0.55` is what makes the lobes full
 * and the valleys cut, instead of the soft ripple a plain cosine gives.
 */
function sealPts(cx: number, cy: number, inner: number, depth: number, n = 192): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rho = inner + depth * Math.pow(Math.abs(Math.cos(8 * a)), 0.55);
    out.push([cx + rho * Math.cos(a), cy + rho * Math.sin(a)]);
  }
  return out;
}

/** An eight-pointed star, tips and valleys rounded so it reads chunky, not sharp. */
function starPts(cx: number, cy: number, R: number, r: number): Pt[] {
  return roundedPolygonPts(radialVertices(cx, cy, [R, r], 16, -90), (i) => (i % 2 === 0 ? R * 0.13 : r * 0.1));
}

/* ── Path writers ─────────────────────────────────────────────────────────── */

function closed(pts: readonly Pt[], dy = 0): string {
  return (
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${r1(p[0])} ${r1(p[1] + dy)}`).join("") + "Z"
  );
}

/** Polar angle of a point about (cx, cy), 0–360 with y down: 180 = left, 270 = top. */
function angleOf(p: Pt, cx: number, cy: number): number {
  const a = (Math.atan2(p[1] - cy, p[0] - cx) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
}

/**
 * The run of a closed outline between two angles, as an open path — a stroke of
 * light that follows the shape exactly, whatever the shape is. Walks the
 * outline from the point nearest `from`, so a run that crosses the outline's
 * first point is still drawn in one piece.
 */
function openArc(pts: readonly Pt[], cx: number, cy: number, from: number, to: number): string {
  const inside = (p: Pt) => {
    const a = angleOf(p, cx, cy);
    return a >= from && a <= to;
  };
  const n = pts.length;
  let start = pts.findIndex((p, i) => inside(p) && !inside(pts[(i - 1 + n) % n]));
  if (start < 0) start = 0;
  const run: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const p = pts[(start + k) % n];
    if (!inside(p)) break;
    run.push(p);
  }
  return run.map((p, i) => `${i === 0 ? "M" : "L"}${r1(p[0])} ${r1(p[1])}`).join("");
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${r1(x + r)} ${r1(y)}H${r1(x + w - r)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}` +
    `V${r1(y + h - r)}Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - r)} ${r1(y + h)}` +
    `H${r1(x + r)}Q${r1(x)} ${r1(y + h)} ${r1(x)} ${r1(y + h - r)}` +
    `V${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}Z`
  );
}

/* ── The ribbon ───────────────────────────────────────────────────────────── */

/** The ribbon's tails reach x = 0 and x = 100 exactly — the box's own edges. */
const RIBBON = { x: 7, y: 62, w: 86, h: 19, drop: 4, tail: 7, notch: 4.5 } as const;

function ribbonGeometry(): RibbonGeometry {
  const { x, y, w, h, drop, tail, notch } = RIBBON;
  const right = x + w;
  const ty = y + drop;
  const tb = y + h + drop;
  const mid = (ty + tb) / 2;
  const tails =
    `M${x + 6} ${ty}L${x - tail} ${ty}L${x - tail + notch} ${mid}L${x - tail} ${tb}L${x + 6} ${tb}Z` +
    `M${right - 6} ${ty}L${right + tail} ${ty}L${right + tail - notch} ${mid}L${right + tail} ${tb}L${right - 6} ${tb}Z`;
  const folds =
    `M${x} ${y + h}L${x + 6} ${y + h}L${x + 6} ${tb}Z` +
    `M${right} ${y + h}L${right - 6} ${y + h}L${right - 6} ${tb}Z`;
  return {
    band: roundedRect(x, y, w, h, 3),
    tails,
    folds,
    text: { cx: 50, cy: y + h / 2, size: 10.6, width: w - 10 },
  };
}

/* ── The shapes ───────────────────────────────────────────────────────────── */

interface ShapeSpec {
  outer: Pt[];
  /** The outer outline pulled in, for the rim's stroke of light. */
  rimLine: Pt[];
  faceShadow: Pt[];
  face: Pt[];
  faceLine: Pt[];
  faceDisc: { cx: number; cy: number; r: number };
  glyph: { cx: number; cy: number; size: number };
  /** The glyph with a ribbon across the face: higher, a little smaller. */
  glyphLabelled: { cx: number; cy: number; size: number };
}

function spec(shape: BadgeShape): ShapeSpec {
  switch (shape) {
    case "hex":
      return {
        outer: hexPts(50, 50, 49),
        rimLine: hexPts(50, 50, 44.6),
        faceShadow: hexPts(50, 50, 39.5),
        face: hexPts(48.6, 48.4, 37.3),
        faceLine: hexPts(48.6, 48.4, 30),
        faceDisc: { cx: 48.6, cy: 48.4, r: 32 },
        glyph: { cx: 48.6, cy: 48.4, size: 38 },
        glyphLabelled: { cx: 48.6, cy: 39, size: 31 },
      };
    case "shield":
      return {
        outer: shieldPts(50, 50, 1),
        rimLine: shieldPts(50, 50, 0.9),
        faceShadow: shieldPts(50, 48.5, 0.79),
        face: shieldPts(48.6, 47, 0.75),
        faceLine: shieldPts(48.6, 47, 0.6),
        faceDisc: { cx: 48.6, cy: 44, r: 28 },
        glyph: { cx: 48.6, cy: 44, size: 36 },
        glyphLabelled: { cx: 48.6, cy: 36.5, size: 29 },
      };
    case "seal":
      return {
        outer: sealPts(50, 50, 40.5, 6.5),
        rimLine: sealPts(50, 50, 37, 5.2),
        faceShadow: circlePts(50, 50, 34),
        face: circlePts(48.6, 48.6, 31.8),
        faceLine: circlePts(48.6, 48.6, 25.5),
        faceDisc: { cx: 48.6, cy: 48.6, r: 31.8 },
        glyph: { cx: 48.6, cy: 48.6, size: 33 },
        glyphLabelled: { cx: 48.6, cy: 40.5, size: 28 },
      };
    case "star":
      return {
        outer: starPts(50, 50, 49.5, 36.5),
        rimLine: starPts(50, 50, 45, 33),
        faceShadow: circlePts(50, 50, 30.5),
        face: circlePts(48.6, 48.6, 28.4),
        faceLine: circlePts(48.6, 48.6, 22.4),
        faceDisc: { cx: 48.6, cy: 48.6, r: 28.4 },
        glyph: { cx: 48.6, cy: 48.6, size: 30 },
        glyphLabelled: { cx: 48.6, cy: 41, size: 25 },
      };
    case "coin":
    default:
      return {
        outer: circlePts(50, 50, 46),
        rimLine: circlePts(50, 50, 41.5),
        faceShadow: circlePts(50, 50, 37),
        face: circlePts(48.4, 48.4, 34.8),
        faceLine: circlePts(48.4, 48.4, 28),
        faceDisc: { cx: 48.4, cy: 48.4, r: 34.8 },
        glyph: { cx: 48.4, cy: 48.4, size: 40 },
        glyphLabelled: { cx: 48.4, cy: 40, size: 32 },
      };
  }
}

const cache = new Map<string, BadgeGeometry>();

/**
 * Everything one badge draws, for a shape — with or without the ribbon.
 * Computed once per (shape, ribbon) and kept: a shelf of sixty badges draws
 * five shapes, not sixty.
 */
export function badgeGeometry(shape: BadgeShape, labelled = false): BadgeGeometry {
  const key = `${shape}:${labelled ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = spec(shape);
  const geometry: BadgeGeometry = {
    rim: closed(s.outer),
    lip: closed(s.outer, LIP),
    rimShine: openArc(s.rimLine, 50, 50, 200, 256),
    faceShadow: closed(s.faceShadow),
    face: closed(s.face),
    faceShine: openArc(s.faceLine, s.faceDisc.cx, s.faceDisc.cy, 200, 250),
    glyph: labelled ? s.glyphLabelled : s.glyph,
    faceDisc: s.faceDisc,
    ribbon: labelled ? ribbonGeometry() : undefined,
  };
  cache.set(key, geometry);
  return geometry;
}
