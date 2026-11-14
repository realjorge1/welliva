/**
 * SUPPORT — what the figure's drawing actually rests on.
 *
 * The solver used to stand the figure on ESTIMATES: an ankle plus a sole, a
 * knee plus a shin's radius, a hip plus a guess at the seat. Where an estimate
 * was off, the figure hovered over its floor or sank into it, and where no
 * estimate existed at all (a back, a belly, a bent-over head) nothing held the
 * body down: a superman rose off the floor mid-rep, a V-up's seat floated, a
 * butterfly sat on air.
 *
 * Here every bone is measured off the art it really wears. For each bone, and
 * for every angle it can take, the table holds how far below the bone's start
 * its drawing reaches — the lowest point of the trainer, the knee, the seat of
 * the shorts, the back of the head — and how far along the floor that point
 * is. The solver reads it every frame (a lookup and a blend per bone) to find
 * the lowest thing the body is resting on, exactly as it is drawn.
 *
 * Built once per (movement, camera), on the JS thread. Pure: no React, Skia or
 * Reanimated.
 */
import { buildCharacterArt, frontShoeTurn, type FigureLook, type FigureView, type Shape } from "./characterArt";
import type { Rig } from "./rig";

/** Angle samples per turn. 5° apart: a limb 20 long is off by ~0.02 between samples. */
export const SUPPORT_STEPS = 72;

export interface SupportTables {
  /** Bone i at angle 2πs/STEPS reaches `depth[i·STEPS+s]` below its start, box units. */
  depth: number[];
  /** …at a point `across[i·STEPS+s]` along x from its start. */
  across: number[];
  /** 1 for a bone that draws something (or carries the head, or a trainer). */
  has: number[];
}

/** What the head hangs on, as the solver places it. */
export interface HeadMount {
  bone: number;
  /** How far along the neck the head's centre sits, box units. */
  along: number;
  /** Its radius, and −1 where the face is drawn mirrored. */
  r: number;
  mirror: number;
}

type Pt = [number, number];

/* ─────────────────────────── Reading the art ───────────────────────────── */

/** The arc of an SVG `A` command, as points (endpoint form → centre form). */
function arcPoints(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phi: number,
  large: number,
  sweep: number,
  x2: number,
  y2: number,
): Pt[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx < 1e-9 || ry < 1e-9) return [[x2, y2]];
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const hx = (x1 - x2) / 2;
  const hy = (y1 - y2) / 2;
  const xp = c * hx + s * hy;
  const yp = -s * hx + c * hy;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  let k = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) k = -k;
  const cxp = (k * rx * yp) / ry;
  const cyp = (-k * ry * xp) / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2;
  const cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= Math.PI * 2;
  if (sweep && dt < 0) dt += Math.PI * 2;
  const out: Pt[] = [];
  const n = 16;
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    out.push([
      c * rx * Math.cos(t) - s * ry * Math.sin(t) + cx,
      s * rx * Math.cos(t) + c * ry * Math.sin(t) + cy,
    ]);
  }
  return out;
}

/**
 * Every outline point of a path, in its own frame — the path vocabulary
 * characterArt writes: M L H V Q C A Z, absolute and relative.
 */
export function pathPoints(d: string): Pt[] {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    if (up === "Z") {
      x = sx;
      y = sy;
      continue;
    }
    if (up === "M" || up === "L") {
      const nx = num();
      const ny = num();
      x = rel ? x + nx : nx;
      y = rel ? y + ny : ny;
      if (up === "M") {
        sx = x;
        sy = y;
        cmd = rel ? "l" : "L";
      }
      pts.push([x, y]);
    } else if (up === "H") {
      const nx = num();
      x = rel ? x + nx : nx;
      pts.push([x, y]);
    } else if (up === "V") {
      const ny = num();
      y = rel ? y + ny : ny;
      pts.push([x, y]);
    } else if (up === "Q") {
      const v = [num(), num(), num(), num()];
      const [cx, cy, ex, ey] = rel ? [x + v[0], y + v[1], x + v[2], y + v[3]] : v;
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        const u = 1 - t;
        pts.push([u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey]);
      }
      x = ex;
      y = ey;
    } else if (up === "C") {
      const v = [num(), num(), num(), num(), num(), num()];
      const [c1x, c1y, c2x, c2y, ex, ey] = rel
        ? [x + v[0], y + v[1], x + v[2], y + v[3], x + v[4], y + v[5]]
        : v;
      for (let k = 1; k <= 12; k++) {
        const t = k / 12;
        const u = 1 - t;
        pts.push([
          u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
        ]);
      }
      x = ex;
      y = ey;
    } else if (up === "A") {
      const rx = num();
      const ry = num();
      const phi = (num() * Math.PI) / 180;
      const large = num();
      const sweep = num();
      let ex = num();
      let ey = num();
      if (rel) {
        ex += x;
        ey += y;
      }
      pts.push(...arcPoints(x, y, rx, ry, phi, large, sweep, ex, ey));
      x = ex;
      y = ey;
    } else {
      // Unknown command: skip a token so a bad path can never hang the build.
      i++;
    }
  }
  return pts;
}

/** The convex hull of a point set (monotone chain) — all a support table needs. */
function hull(points: Pt[]): Pt[] {
  if (points.length <= 3) return points;
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The outline points of a set of shapes; a stroke counts half its width out. */
function shapePoints(shapes: readonly Shape[]): Pt[] {
  const out: Pt[] = [];
  for (const s of shapes) {
    const pad = s.stroke ? s.stroke.width / 2 : 0;
    for (const [x, y] of pathPoints(s.d)) {
      if (pad > 0) out.push([x, y + pad], [x, y - pad], [x + pad, y], [x - pad, y]);
      else out.push([x, y]);
    }
  }
  return out;
}

/** A disc's outline, for the pictogram's round caps. */
function discPoints(cx: number, cy: number, r: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/* ─────────────────────────────── The tables ─────────────────────────────── */

/** The lowest of `pts` once turned by `a`, and how far along x it is. */
function lowestAt(pts: readonly Pt[], a: number): [number, number] {
  const s = Math.sin(a);
  const c = Math.cos(a);
  let low = -Infinity;
  let at = 0;
  for (const [x, y] of pts) {
    const wy = x * s + y * c;
    if (wy > low) {
      low = wy;
      at = x * c - y * s;
    }
  }
  return [low, at];
}

/**
 * Measure every bone of a rig as `view` draws it in `look`. `facing` −1 turns
 * the side art over, as the renderers do; `head` says where the head rides.
 */
export function buildSupport(
  rig: Rig,
  view: FigureView,
  look: FigureLook,
  facing: number,
  head: HeadMount,
): SupportTables {
  const n = rig.bones.length;
  const S = SUPPORT_STEPS;
  const depth = new Array<number>(n * S).fill(-1e6);
  const across = new Array<number>(n * S).fill(0);
  const has = new Array<number>(n).fill(0);
  const flipY = view === "side" && facing < 0 ? -1 : 1;

  // The art in each bone's frame, and the head's in its own.
  let bonePts: Pt[][];
  let headPts: Pt[];
  let shoe: { bone: number; pts: Pt[]; out: number; drop: number }[] = [];
  if (look === "character") {
    const art = buildCharacterArt(rig, view, "full");
    bonePts = rig.bones.map((_, i) => hull(shapePoints([...art.bones[i], ...art.behind[i]])));
    const h = art.head;
    headPts = hull(shapePoints([...h.back, ...h.skull, ...h.face, ...h.front]));
    shoe = art.shoes.map((s) => ({
      bone: s.bone,
      pts: hull(shapePoints(s.shapes)),
      out: /L$/.test(rig.bones[s.bone].name) ? -art.shoeOut : art.shoeOut,
      drop: art.shoeDrop,
    }));
  } else {
    bonePts = rig.bones.map((b) => {
      if (!b.draw) return [];
      const r = (b.w0 + b.w1) / 4;
      return hull([...discPoints(0, 0, r), ...discPoints(Math.max(0, b.length - b.drawInset), 0, r)]);
    });
    headPts = discPoints(0, 0, 1);
  }

  for (let i = 0; i < n; i++) {
    const own = bonePts[i].map(([x, y]) => [x, y * flipY] as Pt);
    const trainer = shoe.find((s) => s.bone === i);
    const L = rig.bones[i].length;
    const carriesHead = i === head.bone;
    if (own.length === 0 && !trainer && !carriesHead) continue;
    has[i] = 1;
    for (let s = 0; s < S; s++) {
      const a = (s / S) * Math.PI * 2;
      let [low, at] = own.length > 0 ? lowestAt(own, a) : [-1e6, 0];
      if (trainer) {
        // The front trainer hangs level under the ankle and turns with a lying leg.
        const turn = frontShoeTurn(a);
        const [d, x] = lowestAt(trainer.pts, turn);
        const ty = L * Math.sin(a) + trainer.drop + d;
        if (ty > low) {
          low = ty;
          at = L * Math.cos(a) + trainer.out + x;
        }
      }
      if (carriesHead) {
        // The head: its art scaled by its radius (mirrored with the face),
        // turned a quarter past the neck, centred `along` the neck.
        const scaled = headPts.map(([x, y]) => [x * head.r * head.mirror, y * head.r] as Pt);
        const [d, x] = lowestAt(scaled, a + Math.PI / 2);
        const hy = head.along * Math.sin(a) + d;
        if (hy > low) {
          low = hy;
          at = head.along * Math.cos(a) + x;
        }
      }
      depth[i * S + s] = low;
      across[i * S + s] = at;
    }
  }
  return { depth, across, has };
}
