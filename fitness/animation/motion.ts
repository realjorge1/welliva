/**
 * MOTION — the rig, the tempo and the life layer, assembled into one kit a
 * worklet can read, and the solver that turns the clock into a pose.
 *
 * One solver serves everything: the animated Skia panel calls it on the UI
 * thread every frame, and the SVG still (a list thumbnail, the Skia-less
 * fallback) calls it once. A thumbnail frozen at the bottom of a rep is therefore
 * exactly the pose the panel passes through there — they cannot drift apart.
 *
 * What the solver does that the old ping-pong did not:
 *
 *   · reads the rep from a FEEL (tempo.ts) instead of one symmetric ease;
 *   · runs each bone slightly behind its parent and lets the loose ones swing
 *     past their mark (overlapping action, follow-through);
 *   · PINS THE PLANTED FOOT. The rig averages bone lengths across the two
 *     authored poses, so its feet used to drift off the floor through a rep (a
 *     squat's rose five units — the athlete hovered at the bottom). When both
 *     authored poses stand the lowest ankle at the same height, the solver holds
 *     it there, and lets go for the airborne part of a hop;
 *   · lifts the root on a hop and bobs it on a step.
 *
 * Pure (no React / Skia / Reanimated); the per-frame functions are worklets, and
 * — as in tempo.ts — each is declared before the worklets that call it.
 */
import { HEAD_SCALE, SOLE_BELOW, type FigureLook, type FigureView } from "./characterArt";
import { motionCameras, motionLoopMs } from "./cameras";
import type { FigureMotion } from "./movementProfiles";
import { buildFrontRig, buildSideRig, type Rig } from "./rig";
import {
  FEEL_CODE,
  arcAt,
  boneFeel,
  lifeAt,
  lutAt,
  resolveTempo,
  strainOf,
  type LifeKit,
  type MotionMetrics,
  type Tempo,
} from "./tempo";

/* ─────────────────────────────── The tempo ───────────────────────────────── */

function metricsOf(motion: FigureMotion): MotionMetrics {
  let swing = 0;
  let root = 0;
  for (const view of motionCameras(motion)) {
    const rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
    rig.bones.forEach((b, i) => {
      if (!b.draw && b.name !== "neck") return;
      swing = Math.max(swing, (Math.abs(rig.anglesB[i] - rig.anglesA[i]) * 180) / Math.PI);
    });
    root = Math.max(root, Math.hypot(rig.rootB[0] - rig.rootA[0], rig.rootB[1] - rig.rootA[1]));
  }
  return { authoredMs: motionLoopMs(motion), swingDeg: swing, rootTravel: root };
}

const tempoCache = new Map<FigureMotion, Tempo>();

/**
 * How a movement moves: its feel, its visible rep length (slowed, never sped
 * up, until no joint turns faster than a person can read) and its clock cycle.
 * Both cameras share it, so they stay in step.
 */
export function motionTempo(motion: FigureMotion): Tempo {
  let t = tempoCache.get(motion);
  if (!t) {
    t = resolveTempo(motion, metricsOf(motion));
    tempoCache.set(motion, t);
  }
  return t;
}

/* ─────────────────────────────────── The kit ─────────────────────────────── */

/** Everything the solver and the life layer read, as flat arrays and numbers. */
export interface MotionKit extends LifeKit {
  n: number;
  parents: number[];
  lengths: number[];
  anglesA: number[];
  anglesB: number[];
  /** Per bone: how far it trails the clock, as a fraction of a rep. */
  lag: number[];
  /** Per bone: how much of the overshoot it takes. */
  gain: number[];
  rootA: number[];
  rootB: number[];
  /** The overshoot table (the clean curve is `base`, from LifeKit). */
  extra: number[];
  /** Bones whose tip is an ankle, and the height they were authored at. */
  ankles: number[];
  footA: number;
  footB: number;
  /** The build's own standing height, held even in the air — see Rig.standOffset. */
  stand: number;
  /** 1 = keep the lowest ankle on its authored floor. */
  lock: number;
  headBone: number;
}

/** No bone trails by more than this much of a rep, or a joint leaves its socket. */
const MAX_LAG = 0.06;
/** Hair's drag against the head's turn, radians of sway per radian turned in 70 ms. */
const HAIR_DRAG = 2.6;

/**
 * How far the character's shoulders are set wider than the rig's, front-on, in
 * box units. The rig hangs each arm just off the trunk's centreline — fine for a
 * pictogram's thin limbs, but a stout body's chunky arms would hang IN FRONT of
 * its torso and hide it, so the character's shoulders are pushed out until the
 * arms hang beside it. It lengthens the (undrawn) clavicle, which every arm bone
 * hangs from, so it moves the whole arm chain and changes no angle.
 */
export const SHOULDER_SPREAD = 4;

export function buildMotionKit(
  motion: FigureMotion,
  view: FigureView,
  look: FigureLook = "character",
): MotionKit {
  const rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
  const tempo = motionTempo(motion);
  const feels = rig.bones.map((b) => boneFeel(b.name));
  const spread = look === "character" && view === "front" ? SHOULDER_SPREAD : 0;
  return {
    feel: FEEL_CODE[tempo.feel],
    reps: tempo.reps,
    macroMs: tempo.macroMs,
    loopMs: tempo.loopMs,
    base: tempo.curve.base,
    strain: strainOf(tempo.feel),
    drag: HAIR_DRAG,
    hop: tempo.hop,
    n: rig.bones.length,
    parents: rig.bones.map((b) => b.parent),
    lengths: rig.bones.map((b) => b.length + (spread > 0 && /^clav[RL]$/.test(b.name) ? spread : 0)),
    anglesA: rig.anglesA,
    anglesB: rig.anglesB,
    lag: feels.map((f) => Math.min(MAX_LAG, f.lagMs / tempo.loopMs)),
    gain: feels.map((f) => f.gain),
    rootA: [rig.rootA[0], rig.rootA[1]],
    rootB: [rig.rootB[0], rig.rootB[1]],
    extra: tempo.curve.extra,
    ankles: rig.ankleBones,
    footA: rig.footY[0],
    footB: rig.footY[1],
    stand: rig.standOffset,
    // Both ends standing the lowest ankle at the same height = planted feet.
    lock: Math.abs(rig.footY[0] - rig.footY[1]) <= 2.5 ? 1 : 0,
    headBone: rig.headBone,
  };
}

/* ─────────────────────────────── The solver ──────────────────────────────── */

/** The clock's position inside one rep, from its position in the macro cycle. */
export function repPhase(k: MotionKit, p: number): number {
  "worklet";
  const x = p * k.reps;
  return x - Math.floor(x);
}

/** A bone's pose parameter at rep position `q`: 0 at A, 1 at B, past either on overshoot. */
function boneT(k: MotionKit, i: number, q: number): number {
  "worklet";
  let qi = q - k.lag[i];
  if (qi < 0) qi += 1;
  return lutAt(k.base, qi) + k.gain[i] * lutAt(k.extra, qi);
}

/** How much the body is lifted off its floor right now, box units (+ is up). */
function lift(k: MotionKit, q: number): number {
  "worklet";
  const arc = arcAt(k.feel, q);
  return k.hop * arc;
}

/** Smooth maximum of two heights, so the lowest foot hands over without a kink. */
function softMax(a: number, b: number): number {
  "worklet";
  const s = 0.7;
  const m = a > b ? a : b;
  return m + s * Math.log(1 + Math.exp(-Math.abs(a - b) / s));
}

/**
 * Walk the skeleton at rep position `q`, returning `[startX, startY, angle]` per
 * bone in box units. Everything the panel draws hangs off this array.
 */
export function solvePose(k: MotionKit, q: number): number[] {
  "worklet";
  const n = k.n;
  const out = new Array<number>(n * 3);
  const tipX = new Array<number>(n);
  const tipY = new Array<number>(n);

  const tRoot = lutAt(k.base, q) + lutAt(k.extra, q);
  const rootX = k.rootA[0] + (k.rootB[0] - k.rootA[0]) * tRoot;
  const rootY = k.rootA[1] + (k.rootB[1] - k.rootA[1]) * tRoot;

  for (let i = 0; i < n; i++) {
    const a = k.anglesA[i] + (k.anglesB[i] - k.anglesA[i]) * boneT(k, i, q);
    const parent = k.parents[i];
    const sx = parent < 0 ? rootX : tipX[parent];
    const sy = parent < 0 ? rootY : tipY[parent];
    tipX[i] = sx + k.lengths[i] * Math.cos(a);
    tipY[i] = sy + k.lengths[i] * Math.sin(a);
    out[i * 3] = sx;
    out[i * 3 + 1] = sy;
    out[i * 3 + 2] = a;
  }

  // Pin the planted foot, then lift the whole body for a hop. In the air the pin
  // lets go (`1 - arc`), so a jump is not dragged back down to the floor.
  const arc = arcAt(k.feel, q);
  let dy = -lift(k, q);
  if (k.lock > 0 && k.ankles.length > 0) {
    let low = tipY[k.ankles[0]];
    for (let j = 1; j < k.ankles.length; j++) low = softMax(low, tipY[k.ankles[j]]);
    const tBase = lutAt(k.base, q);
    const target = k.footA + (k.footB - k.footA) * tBase;
    // The build's own height is held the whole time; only the pose-by-pose part
    // of the correction lets go in the air, or a jump would sag at its apex.
    dy += k.stand + (target - low - k.stand) * (1 - arc);
  }
  if (dy !== 0) for (let i = 0; i < n; i++) out[i * 3 + 1] += dy;
  return out;
}

/** The neck's angle at rep position `q` — the head's own turn, for the hair. */
export function neckAngleAt(k: MotionKit, q: number): number {
  "worklet";
  const i = k.headBone;
  return k.anglesA[i] + (k.anglesB[i] - k.anglesA[i]) * boneT(k, i, q);
}

/** The root's height at rep position `q`, before the foot pin (for the hair's bob). */
function rootYAt(k: MotionKit, q: number): number {
  "worklet";
  const t = lutAt(k.base, q) + lutAt(k.extra, q);
  return k.rootA[1] + (k.rootB[1] - k.rootA[1]) * t - lift(k, q);
}

/** How far back, in ms, the hair looks to see how the head has turned. */
const HAIR_LOOKBACK_MS = 70;
/** The hair's response fades in and out over this long at each end of the cycle. */
const HAIR_EDGE_MS = 160;

/**
 * The face, breath and hair at clock position `p` (the macro cycle). The head's
 * turn and the body's drop over the last few ms are what the hair answers.
 *
 * The hair answers a LAG, so a clock frozen at 0 — a paused figure, reduced
 * motion, the first frame — would otherwise find it still swinging from the
 * settle at the end of the previous rep. Its response is faded to nothing at
 * both ends of the cycle, so a frozen figure rests clean and the loop has no
 * seam; the settle it hides lasts a few hundred ms once in nine seconds.
 */
export function solveLife(k: MotionKit, p: number): number[] {
  "worklet";
  const q = repPhase(k, p);
  let back = q - HAIR_LOOKBACK_MS / k.loopMs;
  if (back < 0) back += 1;
  const ms = p * k.macroMs;
  const edge = Math.min(ms, k.macroMs - ms) / HAIR_EDGE_MS;
  const presence = edge <= 0 ? 0 : edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
  const swing = (neckAngleAt(k, q) - neckAngleAt(k, back)) * presence;
  const drop = (rootYAt(k, q) - rootYAt(k, back)) * presence;
  return lifeAt(k, p, q, swing, drop);
}

/* ─────────────────────────────── The head ────────────────────────────────── */

/**
 * How far back down the neck the head sits, in box units. The big head rests ON
 * the shoulders — its chin at the collar — so the centre sits one head-radius up
 * the neck whatever the rig's neck is. A head bigger than the neck is therefore
 * lifted a little (negative), a long neck pulls it back down, and neither goes
 * far: a folded hinge's short neck must not bury the face in the chest, nor a
 * tall stand float the head off the shoulders.
 */
function headDrop(neckLength: number, radius: number): number {
  "worklet";
  return Math.max(-2.5, Math.min(neckLength - radius, 3));
}

/** The head's radius in box units. */
export function headRadius(rig: Pick<Rig, "headR">): number {
  return rig.headR * HEAD_SCALE;
}

export interface HeadFrame {
  x: number;
  y: number;
  /** Radians: the head's own rotation (the neck's, plus a quarter turn). */
  rot: number;
  r: number;
}

/** Where the head sits and how it is turned, in a solved pose. */
export function headFrame(k: MotionKit, pose: number[], r: number, tilt = 0): HeadFrame {
  "worklet";
  const i = k.headBone;
  const a = pose[i * 3 + 2];
  const along = k.lengths[i] - headDrop(k.lengths[i], r);
  return {
    x: pose[i * 3] + along * Math.cos(a),
    y: pose[i * 3 + 1] + along * Math.sin(a),
    rot: a + Math.PI / 2 + tilt,
    r,
  };
}

/* ─────────────────────────────── Framing ─────────────────────────────────── */

/** How far each bone's drawing reaches around its two ends, in box units. */
function reachOf(name: string): readonly [number, number] {
  if (name === "lowerSpine") return [16, 9.5];
  if (name === "upperSpine") return [9.5, 17.5];
  if (/^(neck|clav|pelvis)/.test(name)) return [0, 0];
  if (/UpArm|upArm/.test(name)) return [8.5, 7];
  if (/ForeArm|foreArm/.test(name)) return [6.5, 9.5];
  if (/Thigh|thigh/.test(name)) return [9.5, 8];
  if (/Shin|shin/.test(name)) return [8, 10];
  if (/Foot|foot/.test(name)) return [8.5, 9.5];
  return [7, 7];
}

/** The ground sits this far under an ankle (the trainer's sole). */
const SOLE_BELOW_ANKLE = SOLE_BELOW;
/** The head's bounding circle, in head radii (hair and ears included). */
const HEAD_REACH = 1.4;
const FRAME_SAMPLES = 24;

export interface MotionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** The lowest point the figure touches — where it stands. */
  floorY: number;
  /** The ground shadow: centre and half-width under the feet. */
  shadowX: number;
  shadowRx: number;
  /** The middle of the figure's room, and how far its silhouette reaches from it. */
  cx: number;
  cy: number;
  radius: number;
}

/** A running measurement, grown pose by pose. */
interface Extents {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  floorY: number;
  contactMin: number;
  contactMax: number;
  /** Every part's bounding circle, flat: x, y, radius. */
  circles: number[];
}

function emptyExtents(): Extents {
  return {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    floorY: -Infinity,
    contactMin: Infinity,
    contactMax: -Infinity,
    circles: [],
  };
}

/** Fold one solved pose into the measurement. */
function measure(e: Extents, k: MotionKit, rig: Pick<Rig, "bones" | "headR">, pose: number[]): void {
  const r = headRadius(rig);
  const grow = (x: number, y: number, rad: number) => {
    e.minX = Math.min(e.minX, x - rad);
    e.maxX = Math.max(e.maxX, x + rad);
    e.minY = Math.min(e.minY, y - rad);
    e.maxY = Math.max(e.maxY, y + rad);
    e.circles.push(x, y, rad);
  };
  for (let i = 0; i < k.n; i++) {
    const name = rig.bones[i].name;
    const [r0, r1] = reachOf(name);
    const sx = pose[i * 3];
    const sy = pose[i * 3 + 1];
    const a = pose[i * 3 + 2];
    const tx = sx + k.lengths[i] * Math.cos(a);
    const ty = sy + k.lengths[i] * Math.sin(a);
    if (r0 > 0) grow(sx, sy, r0);
    if (r1 > 0) grow(tx, ty, r1);
    // What the figure can stand, lie or lean on.
    if (/^(far)?shin/i.test(name)) {
      e.floorY = Math.max(e.floorY, ty + SOLE_BELOW_ANKLE);
      e.contactMin = Math.min(e.contactMin, tx);
      e.contactMax = Math.max(e.contactMax, tx);
    } else if (/ForeArm|foreArm/.test(name)) {
      e.floorY = Math.max(e.floorY, ty + 6.5);
      e.contactMin = Math.min(e.contactMin, tx);
      e.contactMax = Math.max(e.contactMax, tx);
    } else if (name === "lowerSpine") {
      e.floorY = Math.max(e.floorY, sy + 9.5);
    }
  }
  const h = headFrame(k, pose, r);
  grow(h.x, h.y, r * HEAD_REACH);
}

/**
 * The reach radii are generous (a part's bounding circle, not its outline), so a
 * circle fit trims them a little — otherwise a figure would be shrunk for room
 * its own hands never take.
 */
const FIT_TRIM = 0.9;

function finish(e: Extents): MotionBounds {
  const span = Math.max(8, e.contactMax - e.contactMin);
  const maxY = Math.max(e.maxY, e.floorY);
  const cx = (e.minX + e.maxX) / 2;
  const cy = (e.minY + maxY) / 2;
  const shadowX = (e.contactMin + e.contactMax) / 2;
  // A little wider than the feet, no more: it is a soft pool under them.
  const shadowRx = span / 2 + 6;
  let radius = 0;
  for (let i = 0; i < e.circles.length; i += 3) {
    radius = Math.max(
      radius,
      Math.hypot(e.circles[i] - cx, e.circles[i + 1] - cy) + e.circles[i + 2] * FIT_TRIM,
    );
  }
  return {
    minX: e.minX,
    maxX: e.maxX,
    minY: e.minY,
    maxY,
    floorY: e.floorY,
    shadowX,
    shadowRx,
    cx,
    cy,
    radius,
  };
}

/**
 * The room a movement needs, measured over a whole rep (so the figure never
 * changes size mid-rep and nothing is ever clipped), plus the floor it stands on.
 */
export function motionBounds(k: MotionKit, rig: Pick<Rig, "bones" | "headR">): MotionBounds {
  const e = emptyExtents();
  for (let s = 0; s <= FRAME_SAMPLES; s++) measure(e, k, rig, solvePose(k, s / FRAME_SAMPLES));
  return finish(e);
}

/** The room ONE pose needs — what a thumbnail is fitted to. */
export function poseBounds(
  k: MotionKit,
  rig: Pick<Rig, "bones" | "headR">,
  pose: number[],
): MotionBounds {
  const e = emptyExtents();
  measure(e, k, rig, pose);
  return finish(e);
}

/**
 * Drawing scale and placement for a panel of `size` px.
 *
 * By default the figure stands on one baseline whatever it is doing, is centred
 * on the rig's own midline, and is shrunk — never stretched — only as far as the
 * widest or tallest moment of the rep needs.
 *
 * With `fit` (a radius in px around the panel's centre) it is instead centred in
 * the panel and made as BIG as it can be while its whole silhouette, over the
 * whole rep, stays inside that circle: the live player sets it to the ring's
 * inner edge, so a compact pose (a squat, a stand) fills the ring and a wide one
 * (a jumping jack) shrinks just enough to clear the band.
 */
export function framePanel(
  b: MotionBounds,
  view: FigureView,
  size: number,
  fit?: number,
): { k: number; tx: number; ty: number; panelW: number; shadowRx: number } {
  const pad = size * 0.06;
  const panelW = size * (view === "side" ? 0.78 : 0.94);
  if (fit && fit > 0) {
    // Never past the canvas, either: the panel clips whatever leaves it.
    const kRect = Math.min(
      (panelW - size * 0.04) / Math.max(1, b.maxX - b.minX),
      (size - pad * 2) / Math.max(1, b.maxY - b.minY),
    );
    const k = Math.min(kRect, fit / Math.max(1, b.radius));
    // The shadow is a flat pool on the floor: it must not run out of the circle
    // the figure is fitted to, so it is held to the circle's chord at floor level.
    const down = b.floorY - b.cy;
    const chord = Math.sqrt(Math.max(0, (fit / k) ** 2 - down * down));
    const room = Math.max(4, chord - Math.abs(b.shadowX - b.cx));
    return {
      k,
      tx: panelW / 2 - b.cx * k,
      ty: size / 2 - b.cy * k,
      panelW,
      shadowRx: Math.min(b.shadowRx, room),
    };
  }
  const halfWide = Math.max(Math.abs(b.minX - 50), Math.abs(b.maxX - 50), 1);
  const kx = (panelW / 2 - size * 0.02) / halfWide;
  const ky = (size - pad * 2) / Math.max(1, b.floorY - b.minY);
  // The old box scale, as a ceiling: a lone small pose is not blown up.
  const cap = (size * 0.84) / 100;
  const k = Math.min(kx, ky, cap);
  return {
    k,
    tx: panelW / 2 - 50 * k,
    ty: size - pad - b.floorY * k,
    panelW,
    shadowRx: b.shadowRx,
  };
}
