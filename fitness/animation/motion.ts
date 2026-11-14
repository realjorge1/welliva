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
 *   · reads the rep from a FEEL (tempo.ts) instead of one symmetric ease, and
 *     reads it ONCE for the whole skeleton — every joint at the same instant of
 *     the same curve, so the body moves as one piece and nothing arrives late;
 *   · STANDS THE BODY ON ITS FLOOR, every frame. Whatever the body rests on —
 *     the soles of its trainers, a kneeling knee, the seat of its shorts, its
 *     back, its belly — is measured off the drawing itself and held exactly on
 *     the floor, so nothing hovers and nothing sinks (see "The ground"). A jump
 *     pushes off the floor before it leaves it;
 *   · MOVES THE BODY FROM ITS PLANTED FOOT: where a foot stays put all rep, the
 *     hips are placed by walking up the leg from it, so the foot cannot slide
 *     and the hips travel the arc the joints really make (see "The feet");
 *   · PLANTS THE HANDS the same way, on a floor, a bar or a wall, and lets a free
 *     forearm and hand fall a little behind in the middle of a move (see "The
 *     hands" below);
 *   · lifts the root on a hop and bobs it on a step.
 *
 * Pure (no React / Skia / Reanimated); the per-frame functions are worklets, and
 * — as in tempo.ts — each is declared before the worklets that call it.
 */
import {
  HEAD_SCALE,
  KNEE_BELOW,
  SOLE_BELOW,
  faceMirrored,
  handDepth,
  sideShoeDepth,
  type FigureLook,
  type FigureView,
} from "./characterArt";
import { motionCameras, motionLoopMs } from "./cameras";
import type { FigureMotion } from "./movementProfiles";
import { propsFor, type FigureProp } from "./props";
import { HANGING, buildFrontRig, buildSideRig, type Rig, type RigArm } from "./rig";
import { SUPPORT_STEPS, buildSupport } from "./support";
import {
  FEEL_CODE,
  arcAt,
  lifeAt,
  lutAt,
  resolveTempo,
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
    swing = Math.max(swing, (rig.swing * 180) / Math.PI);
    root = Math.max(root, Math.hypot(rig.rootB[0] - rig.rootA[0], rig.rootB[1] - rig.rootA[1]));
  }
  return { authoredMs: motionLoopMs(motion), swingDeg: swing, rootTravel: root };
}

const tempoCache = new Map<FigureMotion, Tempo>();

/**
 * How a movement moves: its feel, its rep length (a step of the beat grid, the
 * first one that keeps every joint inside the speed budget) and its clock
 * cycle. Both cameras share it, so they stay in step.
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
  rootA: number[];
  rootB: number[];
  /** Bones whose tip is an ankle, and the height they were authored at. */
  ankles: number[];
  footA: number;
  footB: number;
  /** The build's own standing height — see Rig.standOffset. */
  stand: number;
  /** 1 = the body rests on its floor the whole rep (`ground` 1). */
  lock: number;
  /**
   * THE GROUND — see "The ground" below. `supp`/`suppX` hold, for every bone
   * and SUPPORT_STEPS angles of it, how far below the bone's start its drawing
   * reaches and how far along x that lowest point is; `suppOn` marks the bones
   * that draw anything.
   */
  supp: number[];
  suppX: number[];
  suppOn: number[];
  suppN: number;
  /** 1 for the parts the body rests its weight on (a planted leg answers to its foot instead). */
  gset: number[];
  /** The body's own height correction at each end, for when only planted legs carry it. */
  cA: number;
  cB: number;
  /** 0 = nothing holds it up (it hangs, or is seen from above); 1 = it rests on its floor; 2 = it jumps. */
  ground: number;
  /** The floor line, box units. */
  floor: number;
  /** A jump: how far the lowest part is off the floor at each end of the rep. */
  clearA: number;
  clearB: number;
  /** Equipment tops a part can rest on, three numbers each: x0, x1, top. */
  surf: number[];
  /** The planted and stepping feet, LEG_PIN_N numbers per leg — see "The feet" below. */
  legPins: number[];
  /**
   * The planted foot the body moves from: the bones from it up to the root
   * (toe → ankle → knee → hip), and where its far end stays. Empty: none.
   */
  anchor: number[];
  anchorX: number;
  anchorY: number;
  /** Loose limbs kept out of the floor, FREE_N numbers each — see "The floor guard". */
  free: number[];
  headBone: number;
  /**
   * Where the head's centre may sit along the neck, box units from the
   * shoulder line: the neck's own length, held between these two.
   */
  headLo: number;
  headHi: number;
  /**
   * How far each bone trails the body through a move, per bone: 0 for nearly
   * all of them, and for a free forearm and hand the share `t ∓ trail·t(1−t)` —
   * see "How an arm follows through" below.
   */
  trail: number[];
  /**
   * Where each foreshortened bone's numbers start in `depthVec`, −1 for the rest.
   * `depthVec` holds its five numbers per bone: the vector it shows at the top
   * of the rep, the one at the bottom, and the least of its length ever drawn.
   */
  depthSlot: number[];
  depthVec: number[];
  /** The planted hands, PIN_N numbers per arm — see "The hands" below. */
  pins: number[];
}

/**
 * How far the character's shoulders are moved in from the rig's, front-on, in
 * box units (negative = narrower).
 *
 * The rig was authored for a pictogram, and then for a stout cartoon whose
 * shoulders had to be pushed OUT (+4) so its thick arms hung beside its torso.
 * That put the shoulder joints over half the figure's height apart — the main
 * reason it read as fat. The athlete now has a person's shoulders, about a
 * quarter of its height across: the rig's clavicle brought IN by four. It
 * changes the (undrawn) clavicle, which every arm bone hangs from, so the whole
 * arm chain moves and no angle does.
 *
 * Only where the arms are free. A hand on the floor or on a bar is where it
 * was drawn, and moving the shoulder would lift it off.
 */
export const SHOULDER_SPREAD = -4;

/**
 * The chin clears the collar by this much, box units: the head's centre sits
 * between one radius plus NECK_MIN and one radius plus NECK_MAX past the
 * shoulder line, and the authored neck length picks the point inside that
 * window — so a folded hinge's short neck doesn't bury the face in the chest
 * and a tall stand doesn't float the head off the shoulders.
 */
const NECK_MIN = 1.6;
const NECK_MAX = 4.4;

/**
 * Front views of a deep hinge, where the head hangs between the shoulders
 * rather than above them: seen from in front, a bent-over body is a short back
 * with the head low on it. Holding the head up on a neck there is what made the
 * bent-over reverse fly read as a small person standing up straight.
 */
const HEAD_DOWN_FRONT = new Set<FigureMotion>(["reverseFly"]);

/**
 * The least of a foreshortened bone that is ever drawn. Pointing straight at the
 * camera a limb is still a limb, seen end on, and a hand is still a fist.
 */
const DEPTH_LEAST_UPPER = 0.42;
const DEPTH_LEAST_FORE = 0.22;
const DEPTH_LEAST_HAND = 0.62;

export function buildMotionKit(
  motion: FigureMotion,
  view: FigureView,
  look: FigureLook = "character",
): MotionKit {
  const rig = view === "side" ? buildSideRig(motion) : buildFrontRig(motion);
  const tempo = motionTempo(motion);
  const character = look === "character";
  const spread = character && view === "front" && rig.armsFree ? SHOULDER_SPREAD : 0;
  const r = character ? headRadius(rig) : rig.headR;
  const down = character && view === "front" && HEAD_DOWN_FRONT.has(motion);
  const depthSlot = rig.bones.map(() => -1);
  const depthVec: number[] = [];
  for (const i of rig.depthBones) {
    depthSlot[i] = depthVec.length;
    const L = rig.bones[i].length;
    depthVec.push(
      L * rig.stretchA[i] * Math.cos(rig.anglesA[i]),
      L * rig.stretchA[i] * Math.sin(rig.anglesA[i]),
      L * rig.stretchB[i] * Math.cos(rig.anglesB[i]),
      L * rig.stretchB[i] * Math.sin(rig.anglesB[i]),
      /hand/i.test(rig.bones[i].name)
        ? DEPTH_LEAST_HAND
        : /upArm/i.test(rig.bones[i].name)
          ? DEPTH_LEAST_UPPER
          : DEPTH_LEAST_FORE,
    );
  }
  const kit: MotionKit = {
    feel: FEEL_CODE[tempo.feel],
    reps: tempo.reps,
    macroMs: tempo.macroMs,
    loopMs: tempo.loopMs,
    base: tempo.curve.base,
    hop: tempo.hop,
    n: rig.bones.length,
    parents: rig.bones.map((b) => b.parent),
    lengths: rig.bones.map((b) => b.length + (spread !== 0 && /^clav[RL]$/.test(b.name) ? spread : 0)),
    anglesA: [...rig.anglesA],
    anglesB: [...rig.anglesB],
    rootA: [rig.rootA[0], rig.rootA[1]],
    rootB: [rig.rootB[0], rig.rootB[1]],
    ankles: rig.ankleBones,
    footA: rig.footY[0],
    footB: rig.footY[1],
    stand: rig.standOffset,
    lock: 0,
    headBone: rig.headBone,
    headLo: down ? r * 0.35 : r + NECK_MIN,
    headHi: down ? r * 0.35 : r + NECK_MAX,
    trail: rig.bones.map(() => 0),
    depthSlot,
    depthVec,
    pins: [],
    supp: [],
    suppX: [],
    suppOn: rig.bones.map(() => 0),
    suppN: SUPPORT_STEPS,
    gset: rig.bones.map(() => 0),
    cA: 0,
    cB: 0,
    ground: 0,
    floor: 0,
    clearA: 0,
    clearB: 0,
    surf: [],
    legPins: [],
    anchor: [],
    anchorX: 0,
    anchorY: 0,
    free: [],
  };
  const planted = settleGround(kit, rig, motion, view, look);
  settleLegs(kit, rig, view, planted);
  settleHands(kit, rig, motion, view);
  settleFree(kit, rig, view);
  return kit;
}

/* ─────────────────────────────── The solver ──────────────────────────────── */

/** How many numbers one loose limb takes in `MotionKit.free`. */
const FREE_N = 3;
/** How many numbers one planted arm takes in `MotionKit.pins`. */
const PIN_N = 11;
/** …and one planted leg in `MotionKit.legPins`. */
const LEG_PIN_N = 13;
/** A part over a bench or a box rests on its top unless it is this far down inside it. */
const SURFACE_SINK = 2;
/** A jump's feet stay on the floor until the legs are this far through the push-off. */
const TAKEOFF = 0.4;
/** A planted leg reaches exactly as far as this share of its length, softly past it. */
const LEG_SOFT_FROM = 0.995;
/** How much of a placed leg's length the hips are kept within, so it always reaches its foot. */
const LEG_REACH = 0.99;
/** A planted arm reaches exactly as far as this share of its length, softly past it. */
const ARM_SOFT_FROM = 0.985;

/** The clock's position inside one rep, from its position in the macro cycle. */
export function repPhase(k: MotionKit, p: number): number {
  "worklet";
  const x = p * k.reps;
  return x - Math.floor(x);
}

/** How much the body is lifted off its floor right now, box units (+ is up). */
function lift(k: MotionKit, q: number): number {
  "worklet";
  const arc = arcAt(k.feel, q);
  return k.hop * arc;
}

/** How far below its start bone `i` reaches at angle `a` — its support table, read between samples. */
function supportAt(k: MotionKit, i: number, a: number): number {
  "worklet";
  const n = k.suppN;
  let u = (a / (Math.PI * 2)) * n;
  u -= Math.floor(u / n) * n;
  const j = Math.floor(u);
  const f = u - j;
  const j2 = j + 1 >= n ? 0 : j + 1;
  return k.supp[i * n + j] * (1 - f) + k.supp[i * n + j2] * f;
}

/** …and how far along x from its start that lowest point is. */
function supportX(k: MotionKit, i: number, a: number): number {
  "worklet";
  const n = k.suppN;
  let u = (a / (Math.PI * 2)) * n;
  u -= Math.floor(u / n) * n;
  const j = Math.floor(u);
  const f = u - j;
  const j2 = j + 1 >= n ? 0 : j + 1;
  return k.suppX[i * n + j] * (1 - f) + k.suppX[i * n + j2] * f;
}

/**
 * How low part `i` of a pose reaches, measured against what is under it: over a
 * bench or a box, its top stands in for the floor.
 */
function partLow(k: MotionKit, out: number[], i: number): number {
  "worklet";
  const a = out[i * 3 + 2];
  const y = out[i * 3 + 1] + supportAt(k, i, a);
  if (k.surf.length === 0) return y;
  const x = out[i * 3] + supportX(k, i, a);
  for (let s = 0; s < k.surf.length; s += 3) {
    if (x >= k.surf[s] && x <= k.surf[s + 1] && y <= k.surf[s + 2] + SURFACE_SINK) {
      return y + k.floor - k.surf[s + 2];
    }
  }
  return y;
}

/** The lowest of the parts the body rests on, in a pose. */
function groundLow(k: MotionKit, out: number[]): number {
  "worklet";
  let low = -1e9;
  for (let i = 0; i < k.n; i++) {
    if (k.gset[i] === 0) continue;
    const y = partLow(k, out, i);
    if (y > low) low = y;
  }
  return low;
}

/**
 * How far to move a pose down (+) so that the lowest of the parts it rests on
 * lies exactly on the floor. With nothing left to rest on but placed legs, the
 * body keeps to the line between its two end placements and the legs reach.
 */
function groundShift(k: MotionKit, out: number[], t: number): number {
  "worklet";
  let best = 1e9;
  for (let i = 0; i < k.n; i++) {
    if (k.gset[i] === 0) continue;
    const d = k.floor - partLow(k, out, i);
    if (d < best) best = d;
  }
  return best < 1e8 ? best : k.cA + (k.cB - k.cA) * t;
}

/**
 * How much of a jump's height is in the air, at share `u` of the way to the end
 * that is airborne: none until the legs have pushed off (TAKEOFF), then a
 * smooth rise to all of it.
 */
function takeoff(u: number): number {
  "worklet";
  if (u <= TAKEOFF) return 0;
  const w = (u - TAKEOFF) / (1 - TAKEOFF);
  return w * w * (3 - 2 * w);
}

/**
 * The thigh's angle that sets an ankle at (tx, ty) from a hip at (sx, sy), the
 * knee folded `fold`'s way. Out of reach the leg goes straight at it: a leg is
 * never stretched. The very last of its reach comes softly (LEG_SOFT_FROM), as
 * an arm's does but much later: a knee solved all the way to locked whips
 * through its last few degrees in a frame, and a standing knee is never quite
 * locked anyway.
 */
function kneeFor(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  L1: number,
  L2: number,
  fold: number,
): number {
  "worklet";
  const dx = tx - sx;
  const dy = ty - sy;
  const full = L1 + L2;
  const least = Math.abs(L1 - L2) + 1e-3;
  const d0 = Math.sqrt(dx * dx + dy * dy);
  const soft = full * LEG_SOFT_FROM;
  const r = d0 > soft ? soft + (full - soft) * (1 - Math.exp(-(d0 - soft) / (full - soft))) : d0 < least ? least : d0;
  const c = (L1 * L1 + r * r - L2 * L2) / (2 * L1 * r);
  return Math.atan2(dy, dx) + fold * Math.acos(c > 1 ? 1 : c < -1 ? -1 : c);
}

/**
 * Put one planted leg's ankle on its spot — or, for a stepping foot, on its way
 * from one spot to the next, lifted clear of the floor — from wherever the hip
 * is now.
 */
function placeLeg(k: MotionKit, out: number[], j: number, t: number): void {
  "worklet";
  const p = k.legPins;
  const u = p[j];
  const f = p[j + 1];
  const ft = p[j + 2];
  // A step happens in its own stretch of the rep: two feet that both move go
  // one after the other, and each lands before the body leans on it.
  let w = (t - p[j + 11]) / (p[j + 12] - p[j + 11]);
  w = w < 0 ? 0 : w > 1 ? 1 : w;
  const e = w * w * (3 - 2 * w);
  const tx = p[j + 3] + (p[j + 5] - p[j + 3]) * e;
  const ty = p[j + 4] + (p[j + 6] - p[j + 4]) * e - p[j + 10] * Math.sin(Math.PI * e);
  const L1 = p[j + 7];
  const L2 = p[j + 8];
  const sx = out[u * 3];
  const sy = out[u * 3 + 1];
  const ua = kneeFor(sx, sy, tx, ty, L1, L2, p[j + 9]);
  const ex = sx + L1 * Math.cos(ua);
  const ey = sy + L1 * Math.sin(ua);
  const fa = Math.atan2(ty - ey, tx - ex);
  out[u * 3 + 2] = ua;
  out[f * 3] = ex;
  out[f * 3 + 1] = ey;
  out[f * 3 + 2] = fa;
  if (ft >= 0) {
    out[ft * 3] = ex + L2 * Math.cos(fa);
    out[ft * 3 + 1] = ey + L2 * Math.sin(fa);
  }
}

/**
 * The upper arm's angle that puts a hand at (tx, ty) from a shoulder at (sx, sy),
 * with the elbow folded `fold`'s way. Out of reach, the arm goes straight at it.
 */
function reachFor(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  L1: number,
  L2: number,
  fold: number,
): number {
  "worklet";
  const dx = tx - sx;
  const dy = ty - sy;
  const full = L1 + L2;
  const least = Math.abs(L1 - L2) + 1e-3;
  const d = Math.sqrt(dx * dx + dy * dy);
  // The last of an arm's reach comes softly. An elbow solved all the way to dead
  // straight whips round as it leaves it; this one eases toward straight and
  // never quite gets there, so a locked-out arm still moves like an arm.
  const soft = full * ARM_SOFT_FROM;
  const r = d > soft ? soft + (full - soft) * (1 - Math.exp(-(d - soft) / (full - soft))) : d < least ? least : d;
  const c = (L1 * L1 + r * r - L2 * L2) / (2 * L1 * r);
  return Math.atan2(dy, dx) + fold * Math.acos(c > 1 ? 1 : c < -1 ? -1 : c);
}

/** Put one planted arm where its hand is held, in a pose the body is already in. */
function placeArm(k: MotionKit, out: number[], j: number, t: number): void {
  "worklet";
  const p = k.pins;
  const u = p[j];
  const f = p[j + 1];
  const h = p[j + 2];
  const L1 = p[j + 7];
  const L2 = p[j + 8];
  const tx = p[j + 3] + (p[j + 5] - p[j + 3]) * t;
  const ty = p[j + 4] + (p[j + 6] - p[j + 4]) * t - p[j + 10] * Math.sin(Math.PI * t);
  const sx = out[u * 3];
  const sy = out[u * 3 + 1];
  const ua = reachFor(sx, sy, tx, ty, L1, L2, p[j + 9]);
  const ex = sx + L1 * Math.cos(ua);
  const ey = sy + L1 * Math.sin(ua);
  const fa = Math.atan2(ty - ey, tx - ex);
  out[u * 3 + 2] = ua;
  out[f * 3] = ex;
  out[f * 3 + 1] = ey;
  out[f * 3 + 2] = fa;
  out[h * 3] = ex + L2 * Math.cos(fa);
  out[h * 3 + 1] = ey + L2 * Math.sin(fa);
}

/**
 * THE FLOOR GUARD. A limb that holds nothing swings on its joint angles alone,
 * and between two poses a foot on its way up (a hamstring curl's kick) or a hand
 * sweeping low (a thread-the-needle) can pass under the floor line. Where its
 * end would, the whole limb lifts at the hip or shoulder, by just the angle
 * that lets it skim the floor. It keeps its own shape — no joint is re-chosen,
 * so nothing can flip — and the lift is nothing at all until it touches.
 */
function clampLimb(k: MotionKit, out: number[], j: number): void {
  "worklet";
  const g = k.free;
  const u = g[j];
  const f = g[j + 1];
  const end = g[j + 2];
  const c = end >= 0 ? end : f;
  const sx = out[u * 3];
  const sy = out[u * 3 + 1];
  // Twice: once turned, the lowest point of the hand or shoe is a new one.
  for (let pass = 0; pass < 2; pass++) {
    const sink = partLow(k, out, c) - k.floor;
    if (sink <= 1e-4) return;
    const a = out[c * 3 + 2];
    const rx = out[c * 3] + supportX(k, c, a) - sx;
    const ry = out[c * 3 + 1] + supportAt(k, c, a) - sy;
    const r = Math.sqrt(rx * rx + ry * ry);
    if (r < 1e-3) return;
    const phi = Math.atan2(ry, rx);
    let v = (ry - sink) / r;
    v = v > 1 ? 1 : v < -1 ? -1 : v;
    const lifted = Math.cos(phi) >= 0 ? Math.asin(v) : Math.PI - Math.asin(v);
    let d = lifted - phi;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const cs = Math.cos(d);
    const sn = Math.sin(d);
    for (let b = 0; b < 3; b++) {
      const i = b === 0 ? u : b === 1 ? f : end;
      if (i < 0) continue;
      out[i * 3 + 2] += d;
      if (i === u) continue;
      const x = out[i * 3] - sx;
      const y = out[i * 3 + 1] - sy;
      out[i * 3] = sx + x * cs - y * sn;
      out[i * 3 + 1] = sy + x * sn + y * cs;
    }
  }
}

/**
 * Where a placed foot cannot be reached — the hips have drifted out of a leg's
 * length between two steps — how far the body must come down so that it can:
 * the little dip a body makes between two steps.
 */
function stepDip(k: MotionKit, out: number[], t: number): number {
  "worklet";
  const p = k.legPins;
  let down = 0;
  for (let j = 0; j < p.length; j += LEG_PIN_N) {
    let w = (t - p[j + 11]) / (p[j + 12] - p[j + 11]);
    w = w < 0 ? 0 : w > 1 ? 1 : w;
    const e = w * w * (3 - 2 * w);
    const tx = p[j + 3] + (p[j + 5] - p[j + 3]) * e;
    const ty = p[j + 4] + (p[j + 6] - p[j + 4]) * e - p[j + 10] * Math.sin(Math.PI * e);
    const u = p[j];
    const reach = (p[j + 7] + p[j + 8]) * LEG_REACH;
    const dx = tx - out[u * 3];
    const h = ty - out[u * 3 + 1];
    if (Math.abs(dx) >= reach || dx * dx + h * h <= reach * reach) continue;
    const need = h - Math.sqrt(reach * reach - dx * dx);
    if (need > down) down = need;
  }
  return down;
}

/**
 * Walk the skeleton at rep position `q`, returning `[startX, startY, angle]` per
 * bone in box units, then one more number per bone: how much of its length shows
 * (1 unless it is swinging toward the camera). Everything the panel draws hangs
 * off this array.
 */
export function solvePose(k: MotionKit, q: number): number[] {
  "worklet";
  const n = k.n;
  const out = new Array<number>(n * 4);
  const tipX = new Array<number>(n);
  const tipY = new Array<number>(n);

  // One reading of the curve for the whole body: every joint is at the same
  // point of the rep at the same instant.
  const t = lutAt(k.base, q);
  // How an arm follows through: see `trail` under "The hands".
  const behind = (q < 0.5 ? -t : t) * (1 - t);
  let rootX = k.rootA[0] + (k.rootB[0] - k.rootA[0]) * t;
  let rootY = k.rootA[1] + (k.rootB[1] - k.rootA[1]) * t;
  // A body on a planted foot moves from it: walk up the leg from the foot, at
  // this instant's angles, to find the hips (see "The feet").
  if (k.anchor.length > 0) {
    rootX = k.anchorX;
    rootY = k.anchorY;
    for (let j = 0; j < k.anchor.length; j++) {
      const b = k.anchor[j];
      const a = k.anglesA[b] + (k.anglesB[b] - k.anglesA[b]) * (t + k.trail[b] * behind);
      rootX -= k.lengths[b] * Math.cos(a);
      rootY -= k.lengths[b] * Math.sin(a);
    }
  }

  for (let i = 0; i < n; i++) {
    const share = t + k.trail[i] * behind;
    const parent = k.parents[i];
    const sx = parent < 0 ? rootX : tipX[parent];
    const sy = parent < 0 ? rootY : tipY[parent];
    const L = k.lengths[i];
    const slot = k.depthSlot[i];
    let a: number;
    let dx: number;
    let dy: number;
    let shows = 1;
    if (slot < 0) {
      a = k.anglesA[i] + (k.anglesB[i] - k.anglesA[i]) * share;
      dx = L * Math.cos(a);
      dy = L * Math.sin(a);
    } else {
      // Turning toward the camera: the bone's far end runs on a straight line
      // across the picture, fastest as the bone points at the viewer.
      const v = k.depthVec;
      const c = 0.5 - 0.5 * Math.cos(Math.PI * share);
      dx = v[slot] + (v[slot + 2] - v[slot]) * c;
      dy = v[slot + 1] + (v[slot + 3] - v[slot + 1]) * c;
      a = Math.atan2(dy, dx);
      shows = Math.sqrt(dx * dx + dy * dy) / L;
      if (shows < v[slot + 4]) shows = v[slot + 4];
    }
    tipX[i] = sx + dx;
    tipY[i] = sy + dy;
    out[i * 3] = sx;
    out[i * 3 + 1] = sy;
    out[i * 3 + 2] = a;
    out[n * 3 + i] = shows;
  }

  // Stand the body on its floor: what it rests on goes exactly onto the floor
  // line (see "The ground"). A jump keeps its lowest part on the floor until
  // the legs have pushed off, then rises to the height its pose was drawn at.
  // A hop lifts the whole body on top of that.
  let dy = -lift(k, q);
  if (k.ground === 2) {
    const clear = k.clearA * takeoff(1 - t) + k.clearB * takeoff(t);
    dy += k.floor - clear - groundLow(k, out);
  } else if (k.ground === 1) {
    dy += groundShift(k, out, t);
  }
  if (dy !== 0) for (let i = 0; i < n; i++) out[i * 3 + 1] += dy;
  // Between two steps the body dips as far as it must for the feet to reach.
  if (k.anchor.length === 0 && k.legPins.length > 0) {
    const dip = stepDip(k, out, t);
    if (dip > 0) for (let i = 0; i < n; i++) out[i * 3 + 1] += dip;
  }
  // A planted foot answers to the floor, not to the hip, and a planted hand to
  // what it holds, not to the shoulder: those limbs are placed last, from
  // wherever the body has ended up.
  for (let j = 0; j < k.legPins.length; j += LEG_PIN_N) placeLeg(k, out, j, t);
  for (let j = 0; j < k.pins.length; j += PIN_N) placeArm(k, out, j, t);
  // A loose foot or hand never goes through the floor: it skims it.
  for (let j = 0; j < k.free.length; j += FREE_N) clampLimb(k, out, j);
  return out;
}

/** Where a bone ends in a solved pose — the far joint, at the length it shows. */
export function boneTip(k: MotionKit, pose: number[], i: number): [number, number] {
  const L = k.lengths[i] * pose[k.n * 3 + i];
  return [pose[i * 3] + L * Math.cos(pose[i * 3 + 2]), pose[i * 3 + 1] + L * Math.sin(pose[i * 3 + 2])];
}

/** The neck's angle at rep position `q` — which way the head is turned. */
export function neckAngleAt(k: MotionKit, q: number): number {
  "worklet";
  const i = k.headBone;
  return k.anglesA[i] + (k.anglesB[i] - k.anglesA[i]) * lutAt(k.base, q);
}

/** The breath at clock position `p` (the clock's cycle), read at its rep position. */
export function solveLife(k: MotionKit, p: number): number[] {
  "worklet";
  return lifeAt(k, repPhase(k, p));
}

/* ─────────────────────────────── The hands ─────────────────────────────────
 *
 * The planted foot has always been pinned; a planted hand never was. Each bone
 * lerped its angle, so between the two poses a push-up's hands skated five units
 * across the floor and dipped through it, and a pull-up's slid along the bar.
 * Now a hand that holds something is held: its arm is solved from the shoulder
 * to that point every frame (an elbow folds, a hand stays), the wrist lies flat
 * on the floor or grips the bar, and a hand crawling from one spot to the next
 * lifts as it goes.
 *
 * HOW AN ARM FOLLOWS THROUGH. An arm that carries nothing is loose: the upper arm
 * leads and the forearm and hand come after it. The old way of drawing that was
 * a delay, and it made the joints arrive late. Here they don't: the forearm and
 * hand leave with the body and arrive with the body, and only in the middle of
 * the move are they behind. The share of the way a trailing bone has come is
 *
 *     t − trail·t(1−t)   going, and   t + trail·t(1−t)   coming back,
 *
 * which is t itself at both ends of the rep, never runs backward and never
 * overshoots. Each way the hand is behind, so it goes out on one line and comes
 * home on another: a swing, not a hinge running the same path back.
 */
const RAD = Math.PI / 180;
/** A hand that moves no more than this between the poses is holding something. */
const HAND_HOLDS = 6.5;
/** How far above the floor line a wrist still bears on it. */
const HAND_ON_FLOOR = 8;
/** A wrist set high stands the hand up onto its fingers, as far as this. */
const HAND_TILT_MOST = 60 * RAD;
/** On the floor at both ends and this close, it takes a step; further, a reach. */
const HAND_STEP_MOST = 12;
/** How high a stepping hand lifts, box units. */
const HAND_STEP_LIFT = 2.4;
/** A flat hand's heel is up by this much, its fingers on the floor. */
const HAND_TILT = 12 * RAD;
/** A grip's fingers come forward over the bar by this much. */
const HAND_GRIP = 14 * RAD;
/** A palm on a wall sits this far off it: half a hand's thickness. */
const WALL_PALM = 1.9;
/** The most a bearing arm may grow to reach the floor the feet stand on. */
const ARM_REACH_MOST = 1.1;
/** On top of that, how much more it may grow for a stretch only the middle of the rep asks for. */
const ARM_REACH_MID = 1.05;
/** How far an elbow eases off straight at the end of a rep where it carries nothing. */
const ELBOW_EASE = 12 * RAD;
/** How many points of the rep are checked for how far a planted arm must reach. */
const REACH_SAMPLES = 12;
/** An elbow this far into the floor folds the other way, if that clears it. */
const ELBOW_SINKS = 0.5;
/** How far a free forearm and hand trail, at most (see above)… */
const TRAIL_FORE = 0.45;
const TRAIL_HAND = 0.7;
/** …once the bone above them swings this far. A curl's still upper arm gives none. */
const TRAIL_FULL = 60 * RAD;

interface Hold {
  kind: "floor" | "top" | "wall" | "bar";
  prop?: FigureProp;
}

/** What a wrist at (x, y) is holding, if anything. */
function holdOf(x: number, y: number, floorLine: number, props: readonly FigureProp[]): Hold | null {
  for (const prop of props) {
    const over = x >= prop.x - 3 && x <= prop.x + prop.w + 3;
    if (prop.h <= 5) {
      if (over && Math.abs(y - (prop.y + prop.h / 2)) <= 6) return { kind: "bar", prop };
    } else if (prop.w <= 5) {
      if (y >= prop.y - 3 && y <= prop.y + prop.h + 3 && Math.abs(x - prop.x) <= 7) return { kind: "wall", prop };
    } else if (over && Math.abs(y - prop.y) <= 6) {
      return { kind: "top", prop };
    }
  }
  return y >= floorLine - HAND_ON_FLOOR ? { kind: "floor" } : null;
}

/** Relax one elbow at one end of the rep, half into each bone, as the rig does. */
function relaxElbow(A: number[], B: number[], arm: RigArm, facing: number, end: 0 | 1): void {
  const at = end === 0 ? A : B;
  const short = ELBOW_EASE - facing * (at[arm.upper] - at[arm.fore]);
  if (short <= 0) return;
  at[arm.upper] += (facing * short) / 2;
  at[arm.fore] -= (facing * short) / 2;
  at[arm.hand] -= (facing * short) / 2;
}

/** The representation of `a` nearest `ref`, so a lerp goes the short way. */
function nearest(a: number, ref: number): number {
  return a + Math.PI * 2 * Math.round((ref - a) / (Math.PI * 2));
}

/** How a wrist sets its hand on what it holds, given the forearm's angle. */
function handSet(kind: Hold["kind"], fore: number, view: FigureView, facing: number, tilt = HAND_TILT): number {
  if (kind === "bar") return view === "side" ? -Math.PI / 2 + facing * HAND_GRIP : -Math.PI / 2;
  // Front-on, a flat hand's fingers point at the camera: it stays on its forearm.
  if (view === "front") return fore;
  if (kind === "wall") return -Math.PI / 2;
  // Flat: the way the forearm leans, or the way the body faces if it stands upright.
  const x = Math.cos(fore);
  const forward = Math.abs(x) > 0.5 ? Math.sign(x) : facing;
  return forward > 0 ? tilt : Math.PI - tilt;
}

/** The tilt that brings a hand's fingers down to a floor `gap` below the wrist. */
function tiltFor(gap: number): number {
  for (let a = HAND_TILT; a < HAND_TILT_MOST; a += 3 * RAD) {
    if (handDepth(a) >= gap) return a;
  }
  return HAND_TILT_MOST;
}

/**
 * Plant one arm: pin its hand at A and B and set its joints to match at both
 * ends. `rep` is the body through the rep, for how far the shoulder ever gets
 * from the hand.
 */
function plantArm(
  k: MotionKit,
  arm: RigArm,
  poses: readonly [number[], number[]],
  rep: readonly number[][],
  targets: readonly [[number, number], [number, number]],
  sets: readonly [number, number],
  lift: number,
): void {
  const { upper: u, fore: f, hand: h, fold } = arm;
  const shoulder = (i: 0 | 1) => [poses[i][u * 3], poses[i][u * 3 + 1]] as const;
  const span = k.lengths[u] + k.lengths[f];
  // The hand holds and the body moves: a bearing arm that comes up short of what
  // it holds grows by that much, as far as a person's arm plausibly can. It is
  // sized to its two poses, with a little more for a stretch in between. Sizing
  // it to the stretch alone would leave the arm bent where it should be locked.
  const atEnds = Math.max(
    Math.hypot(targets[0][0] - shoulder(0)[0], targets[0][1] - shoulder(0)[1]),
    Math.hypot(targets[1][0] - shoulder(1)[0], targets[1][1] - shoulder(1)[1]),
  );
  let between = 0;
  rep.forEach((pose, s) => {
    const share = s / (rep.length - 1);
    const tx = targets[0][0] + (targets[1][0] - targets[0][0]) * share;
    const ty = targets[0][1] + (targets[1][1] - targets[0][1]) * share;
    between = Math.max(between, Math.hypot(tx - pose[u * 3], ty - pose[u * 3 + 1]));
  });
  const need = Math.min(between, atEnds * ARM_REACH_MID) / span;
  if (need > 1) {
    const grow = Math.min(need, ARM_REACH_MOST);
    k.lengths[u] *= grow;
    k.lengths[f] *= grow;
  }
  const L1 = k.lengths[u];
  const L2 = k.lengths[f];
  const solve = (i: 0 | 1, at: number[]) => {
    const [sx, sy] = shoulder(i);
    const [tx, ty] = targets[i];
    const ua = reachFor(sx, sy, tx, ty, L1, L2, fold);
    const ex = sx + L1 * Math.cos(ua);
    const ey = sy + L1 * Math.sin(ua);
    at[u] = ua;
    at[f] = Math.atan2(ty - ey, tx - ex);
  };
  solve(0, k.anglesA);
  solve(1, k.anglesB);
  k.anglesA[h] = nearest(sets[0], k.anglesA[f]);
  k.anglesB[h] = nearest(sets[1], k.anglesA[h]);
  k.pins.push(u, f, h, targets[0][0], targets[0][1], targets[1][0], targets[1][1], L1, L2, fold, lift);
}

/**
 * Which way a planted arm's elbow should fold. Usually the rig's way (side-on,
 * toward the front of the body). But an arm lying along the floor — beside a
 * body on its back, under a cobra's chest — folded that way drives its elbow
 * down through the floor; then it folds the other way, up off it.
 */
function clearFold(
  k: MotionKit,
  arm: RigArm,
  rep: readonly number[][],
  targets: readonly [[number, number], [number, number]],
  lift: number,
): 1 | -1 {
  if (k.ground === 0) return arm.fold;
  const L1 = k.lengths[arm.upper];
  const L2 = k.lengths[arm.fore];
  const sink = (fold: number) => {
    let most = 0;
    rep.forEach((pose, s) => {
      const share = s / (rep.length - 1);
      const tx = targets[0][0] + (targets[1][0] - targets[0][0]) * share;
      const ty = targets[0][1] + (targets[1][1] - targets[0][1]) * share - lift * Math.sin(Math.PI * share);
      const sx = pose[arm.upper * 3];
      const sy = pose[arm.upper * 3 + 1];
      const ua = reachFor(sx, sy, tx, ty, L1, L2, fold);
      const ex = sx + L1 * Math.cos(ua);
      const ey = sy + L1 * Math.sin(ua);
      const fa = Math.atan2(ty - ey, tx - ex);
      most = Math.max(most, sy + supportAt(k, arm.upper, ua) - k.floor, ey + supportAt(k, arm.fore, fa) - k.floor);
    });
    return most;
  };
  const own = sink(arm.fold);
  return own > ELBOW_SINKS && sink(-arm.fold) < own - ELBOW_SINKS ? (-arm.fold as 1 | -1) : arm.fold;
}

/** Decide what each hand of a built kit is doing, and set it up to do that. */
function settleHands(k: MotionKit, rig: Rig, motion: FigureMotion, view: FigureView): void {
  const A = solvePose(k, 0);
  const B = solvePose(k, 0.5);
  const props = propsFor(motion, view);
  const c = rig.facing;
  // The body through one way of the rep, for what a planted arm has to reach.
  const rep: number[][] = [];
  for (let s = 0; s <= REACH_SAMPLES; s++) rep.push(solvePose(k, (s / REACH_SAMPLES) * 0.5));

  // The lowest joint of the whole rep: what a low hand is near. A hand held up
  // over a body lying on the floor is not near it, so every joint counts. Then
  // the floor the body itself stands on, which a planted hand comes down to.
  let floorLine = -Infinity;
  for (const pose of [A, B]) {
    for (let i = 0; i < k.n; i++) floorLine = Math.max(floorLine, boneTip(k, pose, i)[1]);
  }
  const body = emptyExtents();
  measure(body, k, rig, A, false);
  measure(body, k, rig, B, false);

  /** Where a wrist goes to hold `hold`, its hand (bone `h`) set at `set`. */
  const onto = (hold: Hold, wrist: [number, number], set: number, h: number): [number, number] => {
    // How far the hand's drawing reaches below the wrist, read off the art itself.
    const depth = k.suppOn[h] ? supportAt(k, h, set) : handDepth(set);
    if (hold.kind === "wall" && hold.prop) return [hold.prop.x - WALL_PALM, wrist[1]];
    if (hold.kind === "top" && hold.prop) return [wrist[0], hold.prop.y - depth];
    if (hold.kind === "bar") return wrist;
    // Down to the body's floor. If the hands are the lowest thing (a handstand)
    // the body has no floor to offer, and where they were drawn stands.
    const low = (k.ground > 0 ? k.floor : body.floorY) - depth;
    return [wrist[0], low < wrist[1] - 3 ? wrist[1] : low];
  };
  /** How low a wrist at `x` can get, as far as its arm can grow, from both poses. */
  const lowestReach = (arm: RigArm, x: number, wristY: number): number => {
    const most = (k.lengths[arm.upper] + k.lengths[arm.fore]) * ARM_REACH_MOST;
    let y = Infinity;
    for (const pose of [A, B]) {
      const dx = x - pose[arm.upper * 3];
      y = Math.min(y, pose[arm.upper * 3 + 1] + Math.sqrt(Math.max(0, most * most - dx * dx)));
    }
    return Math.max(y, wristY);
  };

  for (const arm of rig.arms) {
    const { upper: u, fore: f, hand: h } = arm;
    if (k.depthSlot[f] >= 0) continue;
    const wa = boneTip(k, A, f);
    const wb = boneTip(k, B, f);
    const holdA = holdOf(wa[0], wa[1], floorLine, props);
    const holdB = holdOf(wb[0], wb[1], floorLine, props);
    const chord = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);

    if (holdA && holdB && holdA.kind === holdB.kind && chord <= HAND_HOLDS) {
      // One point for the whole rep: where the arm is most nearly straight, so
      // a locked-out arm stays locked out and the other pose bends to meet it.
      const reachOfEnd = (pose: number[], w: [number, number]) =>
        Math.hypot(w[0] - pose[u * 3], w[1] - pose[u * 3 + 1]);
      const anchor = reachOfEnd(A, wa) >= reachOfEnd(B, wb) ? wa : wb;
      let setA = handSet(holdA.kind, k.anglesA[f], view, c);
      const target = onto(holdA, anchor, setA, h);
      if (holdA.kind === "floor") {
        // Only as low as the arm can reach, and the hand makes up the difference,
        // up on its fingers.
        const wanted = target[1];
        target[1] = Math.min(wanted, lowestReach(arm, target[0], anchor[1]));
        if (target[1] < wanted) {
          setA = handSet("floor", k.anglesA[f], view, c, tiltFor(handDepth(setA) + wanted - target[1]));
        }
      }
      const setB = view === "front" && holdA.kind !== "bar" ? handSet(holdA.kind, k.anglesB[f], view, c) : setA;
      const fold = holdA.kind === "floor" ? clearFold(k, arm, rep, [target, target], 0) : arm.fold;
      plantArm(k, { ...arm, fold }, [A, B], rep, [target, target], [setA, setB], 0);
      continue;
    }
    if (holdA?.kind === "floor" && holdB?.kind === "floor" && chord <= HAND_STEP_MOST) {
      const setA = handSet("floor", k.anglesA[f], view, c);
      const setB = handSet("floor", k.anglesB[f], view, c);
      const toA = onto(holdA, wa, setA, h);
      const toB = onto(holdB, wb, setB, h);
      toA[1] = Math.min(toA[1], lowestReach(arm, toA[0], wa[1]));
      toB[1] = Math.min(toB[1], lowestReach(arm, toB[0], wb[1]));
      const fold = clearFold(k, arm, rep, [toA, toB], HAND_STEP_LIFT);
      plantArm(k, { ...arm, fold }, [A, B], rep, [toA, toB], [setA, setB], HAND_STEP_LIFT);
      continue;
    }

    // Free, at least for now. A hand that bears weight at one end of the rep was
    // left straight at both (the rig only relaxes an arm that never bears any):
    // the end that carries nothing relaxes here.
    if (!rig.armsFree && view === "side") {
      if (!holdA) relaxElbow(k.anglesA, k.anglesB, arm, c, 0);
      if (!holdB) relaxElbow(k.anglesA, k.anglesB, arm, c, 1);
    }

    // The forearm trails its upper arm, the hand its forearm.
    const swungUpper = Math.abs(k.anglesB[u] - k.anglesA[u]);
    const swungFore = Math.abs(k.anglesB[f] - k.anglesA[f]);
    let fore = TRAIL_FORE * Math.min(1, swungUpper / TRAIL_FULL);
    if (view === "side" && swungFore > 1e-3) {
      // Trailing takes bend out of the elbow one way round: never past straight.
      const bend = (c * (k.anglesA[u] - k.anglesA[f] + (k.anglesB[u] - k.anglesB[f]))) / 2;
      fore = Math.min(fore, Math.max(0, (4 * (bend - RAD)) / swungFore));
    }
    k.trail[f] = fore;
    k.trail[h] = Math.max(fore, TRAIL_HAND * Math.min(1, swungFore / TRAIL_FULL));
    // A hand that lands on the floor at one end of the rep lands flat.
    if (holdA && view === "side") k.anglesA[h] = nearest(handSet(holdA.kind, k.anglesA[f], view, c), k.anglesA[f]);
    if (holdB && view === "side") k.anglesB[h] = nearest(handSet(holdB.kind, k.anglesB[f], view, c), k.anglesB[f]);
  }
}

/* ─────────────────────────────── The ground ────────────────────────────────
 *
 * A person is always standing, kneeling, sitting or lying ON something. The
 * figure used to be stood on estimates — an ankle plus a sole, a knee plus a
 * shin — and only through its feet, and only when both ends of a rep stood its
 * feet at one height. Everything else floated where the averaged rig happened
 * to put it: a superman's belly rose off the floor mid-rep, a V-up's seat
 * hovered, a butterfly sat on air, a calf raise lifted the whole athlete.
 *
 * Now the drawing itself is measured (animation/support.ts), and each frame the
 * body is set down so that the lowest of the parts it rests on lies exactly on
 * the floor line. Which parts those are is read off the two poses: whatever
 * touches the floor at both ends of the rep (a planted foot, a kneeling knee, a
 * seat, a back). If nothing touches at both ends — the feet change over in a
 * march, a climber swaps legs — whichever part is lower carries the body.
 *
 * A jump (JUMPS) has a pose in the air. Its lowest part stays on the floor
 * while the legs push off, and only then rises to the height the pose was
 * drawn at — a person leaves the ground at the END of the push; they don't
 * float up from a standing start.
 *
 * Hanging from a bar, nothing is under the body; a view drawn from above has
 * no "down" at all. Those keep the heights they were drawn at.
 */
/** Parts this close to the lowest point of a pose are resting on the floor… */
const TOUCH = 2;
/** …and this close at both ends, drawn a little off it: still what the body rests on. */
const NEAR = 6;
/**
 * The movements that leave the floor in a pose of their own. Every other
 * movement is on the floor at both ends of its rep, whatever its drawing says
 * (a hop's air is the tempo's, added on top: see `lift`).
 */
const JUMPS = new Set<FigureMotion>(["tuckJump", "broadJump", "jumpSquat", "starJump", "burpee"]);
/** Front views drawn from above, lying down: down the picture is not toward the floor. */
const SEEN_FROM_ABOVE = new Set<FigureMotion>(["snowAngel", "windshieldWiper"]);
/** The arm's bones: weight on a hand is the hand's business ("The hands"). */
const ARM_BONE = /^(far)?(upArm|foreArm|hand)/i;

/** How low every part of a pose reaches, against the floor `floor` (or a top under it). */
function partLows(k: MotionKit, pose: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < k.n; i++) out.push(k.suppOn[i] ? partLow(k, pose, i) : -Infinity);
  return out;
}

/**
 * Measure the drawing, find the floor and decide what the body rests on. Returns
 * the parts that touch the floor at BOTH ends of the rep — what can be planted.
 */
function settleGround(
  k: MotionKit,
  rig: Rig,
  motion: FigureMotion,
  view: FigureView,
  look: FigureLook,
): Set<number> {
  const character = look === "character";
  const neck = k.lengths[k.headBone];
  const along = character ? (neck < k.headLo ? k.headLo : neck > k.headHi ? k.headHi : neck) : neck;
  const tables = buildSupport(rig, view, look, rig.facing, {
    bone: k.headBone,
    along,
    r: character ? headRadius(rig) : rig.headR,
    mirror: character && faceMirrored(motion, view) ? -1 : 1,
  });
  k.supp = tables.depth;
  k.suppX = tables.across;
  k.suppOn = tables.has;
  // Benches and boxes, not bars (thin) or walls (upright).
  for (const p of propsFor(motion, view)) if (p.h > 5 && p.w > p.h * 0.5) k.surf.push(p.x, p.x + p.w, p.y);
  if (HANGING.has(motion) || (view === "front" && SEEN_FROM_ABOVE.has(motion))) return new Set();

  // Both ends of the rep at the height they were drawn at: the lowest ankle on
  // the floor its pose was authored against.
  const end = (q: number, footY: number): number[] => {
    const pose = solvePose(k, q);
    let low = -Infinity;
    for (const a of k.ankles) low = Math.max(low, boneTip(k, pose, a)[1]);
    const dy = Number.isFinite(low) ? footY - low : 0;
    for (let i = 0; i < k.n; i++) pose[i * 3 + 1] += dy;
    return pose;
  };
  const A = end(0, k.footA);
  const B = end(0.5, k.footB);
  const drawn = rig.bones.map((_, i) => k.suppOn[i] === 1);
  // The body proper: the hands only carry it where nothing else can (a handstand).
  const trunkAndLegs = rig.bones.map((b, i) => drawn[i] && !ARM_BONE.test(b.name));
  const body = trunkAndLegs.some(Boolean) ? trunkAndLegs : drawn;
  const bearing = drawn;

  // The floor: the lowest part of either pose that is not over a bench or a box.
  k.floor = -Infinity;
  for (const pose of [A, B]) {
    for (let i = 0; i < k.n; i++) {
      if (!bearing[i]) continue;
      const a = pose[i * 3 + 2];
      const x = pose[i * 3] + supportX(k, i, a);
      const onTop = k.surf.some((_, s) => s % 3 === 0 && x >= k.surf[s] && x <= k.surf[s + 1]);
      if (!onTop) k.floor = Math.max(k.floor, pose[i * 3 + 1] + supportAt(k, i, a));
    }
  }
  if (!Number.isFinite(k.floor)) {
    for (const pose of [A, B]) for (let i = 0; i < k.n; i++) if (bearing[i]) k.floor = Math.max(k.floor, partLow(k, pose, i));
  }
  const lowsA = partLows(k, A);
  const lowsB = partLows(k, B);
  const top = (lows: number[], set: boolean[]) => Math.max(...lows.filter((_, i) => set[i]));

  if (JUMPS.has(motion)) {
    // A jump: whatever of the body is lowest lands, and takes off.
    k.ground = 2;
    k.clearA = Math.max(0, k.floor - top(lowsA, body));
    k.clearB = Math.max(0, k.floor - top(lowsB, body));
    k.gset = body.map((on) => (on ? 1 : 0));
    return new Set();
  }
  // Each end of the rep sits on the floor; how far each part is off it there.
  const LA = top(lowsA, bearing);
  const LB = top(lowsB, bearing);
  const offA = lowsA.map((y) => LA - y);
  const offB = lowsB.map((y) => LB - y);
  const touchA = offA.map((d, i) => bearing[i] && d <= TOUCH);
  const touchB = offB.map((d, i) => bearing[i] && d <= TOUCH);
  const planted = new Set<number>();
  touchA.forEach((on, i) => on && touchB[i] && planted.add(i));
  // What stays down at both ends carries the body — on the floor, or held just
  // off it; failing that, whatever touches at either end (the lower of the feet
  // in a march). The body before the hands.
  const near = (i: number) => bearing[i] && offA[i] <= NEAR && offB[i] <= NEAR;
  const pick = (ok: (i: number) => boolean) => rig.bones.flatMap((_, i) => (ok(i) ? [i] : []));
  // In order: on the floor at both ends (the body, then the hands); drawn just
  // off it at both ends (a back or a seat drawn a little high is still what the
  // body lies or sits on, and is set down); failing that, whatever touches at
  // either end — the feet of a march, each coming right down as it carries.
  let carry = pick((i) => planted.has(i) && body[i]);
  if (carry.length === 0) carry = pick((i) => near(i) && body[i]);
  if (carry.length === 0) carry = pick((i) => planted.has(i));
  if (carry.length === 0) carry = pick(near);
  if (carry.length === 0) carry = pick((i) => (touchA[i] || touchB[i]) && body[i]);
  if (carry.length === 0) carry = pick((i) => touchA[i] || touchB[i]);
  k.ground = 1;
  k.lock = 1;
  k.gset = rig.bones.map((_, i) => (carry.includes(i) ? 1 : 0));
  return planted;
}

/* ─────────────────────────────── The feet ──────────────────────────────────
 *
 * A planted foot used to be held only by height: the body was moved up or down
 * to keep it on the floor, and between the two poses the averaged leg carried
 * it along the floor — a pistol squat's standing foot skated five units, a
 * cossack squat's nearly four, every split squat and goblet squat a couple.
 *
 * A body standing on a foot moves FROM it. So where a foot stays put all rep,
 * that foot is the ANCHOR: each frame the hips are found by walking up the leg
 * from it — toe, ankle, knee, hip — at that instant's joint angles, and the rest
 * of the body hangs from the hips as before. The foot cannot slide; the hips
 * travel the arc the joints really make (a squat sits back, a push-up pivots on
 * its toes, a Nordic curl falls from its knees); and every joint still moves on
 * the one beat, since only the path of the hips changed.
 *
 * Any other foot on the floor at both ends is then held to its spot (or, if it
 * moves, stepped there, lifted on the way) by solving its leg from the hip.
 */
/** A foot that moves no more than this between the poses is standing in one place… */
const FOOT_HOLDS = 4;
/** …and up to this far, on the floor at both ends, it steps — lifted on the way. */
const FOOT_STEP_MOST = 44;
/** Two feet that both step: the first goes in this first share of the rep, the second in the last. */
const STEP_FIRST = 0.62;
/** A foot the body's own movement keeps within this of its path needs no solving… */
const FOOT_STRAYS = 0.6;
/** …checked at this many points of the rep. */
const LEG_SAMPLES = 16;
/** A foot that turns more than this between the poses is lifting its heel, not standing still. */
const FOOT_TURNS = 10 * RAD;
/** How high a stepping foot lifts: a little, and a little more for a long step. */
const FOOT_LIFT_LEAST = 1.5;
const FOOT_LIFT_PER = 0.08;

/** Find the anchor, then plant or step every other foot on the floor. */
function settleLegs(k: MotionKit, rig: Rig, view: FigureView, planted: Set<number>): void {
  if (k.ground !== 1 || k.hop > 0 || planted.size === 0) return;
  const index = (name: string) => rig.bones.findIndex((b) => b.name === name);
  const legs: [number, number, number, number][] =
    view === "side"
      ? [
          [index("thigh"), index("shin"), index("foot"), -rig.facing],
          [index("farThigh"), index("farShin"), index("farFoot"), -rig.facing],
        ]
      : [
          [index("thighR"), index("shinR"), -1, -1],
          [index("thighL"), index("shinL"), -1, 1],
        ];
  const wrap = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

  // The anchor: the planted foot whose toe (side-on) or ankle (front-on) moves
  // least between the poses — if it moves no more than FOOT_HOLDS.
  const A0 = solvePose(k, 0);
  const B0 = solvePose(k, 0.5);
  let anchored = -1;
  let least = FOOT_HOLDS;
  let at: [number, number] = [0, 0];
  legs.forEach(([u, f, ft], li) => {
    if (u < 0 || f < 0) return;
    const contact = ft >= 0 ? ft : f;
    if (!planted.has(contact)) return;
    const pa = boneTip(k, A0, contact);
    const pb = boneTip(k, B0, contact);
    const move = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    if (move <= least + 1e-9 && (anchored < 0 || move < least - 1e-6)) {
      anchored = li;
      least = move;
      at = pa;
    }
  });
  if (anchored >= 0) {
    const [, f, ft] = legs[anchored];
    for (let b = ft >= 0 ? ft : f; b >= 0; b = rig.bones[b].parent) k.anchor.push(b);
    k.anchorX = at[0];
    k.anchorY = at[1];
    // The foot places the body now; nothing else may move it.
    k.gset = k.gset.map(() => 0);
    k.cA = 0;
    k.cB = 0;
  }

  const A = solvePose(k, 0);
  const B = solvePose(k, 0.5);
  const found: number[][] = [];
  for (const [li, [u, f, ft, knee]] of legs.entries()) {
    if (li === anchored) continue;
    if (u < 0 || f < 0) continue;
    if (!planted.has(ft >= 0 ? ft : f)) continue;
    const wa = boneTip(k, A, f);
    const wb = boneTip(k, B, f);
    const step = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
    if (step > FOOT_STEP_MOST) continue;
    const reach = (pose: number[], w: [number, number]) => Math.hypot(w[0] - pose[u * 3], w[1] - pose[u * 3 + 1]);
    // Standing in one place: one spot, where the leg is straightest, so a squat
    // stands up onto a straight leg. Stepping: from where it was to where it goes.
    // A heel that lifts (the foot turning on its toes) carries the ankle with it.
    const turns = ft >= 0 && Math.abs(wrap(k.anglesB[ft] - k.anglesA[ft])) > FOOT_TURNS;
    const holds = step <= FOOT_HOLDS && !turns;
    const anchor = reach(A, wa) >= reach(B, wb) ? wa : wb;
    const from = holds ? anchor : wa;
    const to = holds ? anchor : wb;
    const lift = holds || step <= FOOT_HOLDS ? 0 : FOOT_LIFT_LEAST + FOOT_LIFT_PER * step;
    // Which way the knee goes: the way it was drawn bending, forward if never.
    const bend = (pose: number[], w: [number, number]) =>
      wrap(pose[u * 3 + 2] - Math.atan2(w[1] - pose[u * 3 + 1], w[0] - pose[u * 3]));
    const ba = bend(A, wa);
    const bb = bend(B, wb);
    const big = Math.abs(ba) >= Math.abs(bb) ? ba : bb;
    const fold = Math.abs(big) > RAD ? Math.sign(big) : knee;
    // A leg that already keeps its foot where it belongs, all rep, is left to
    // move with the body: solving it would only add a knee to watch.
    let strays = 0;
    for (let s = 1; s < LEG_SAMPLES; s++) {
      const q = (s / LEG_SAMPLES) * 0.5;
      const t = lutAt(k.base, q);
      const [x, y] = boneTip(k, solvePose(k, q), f);
      const px = from[0] + (to[0] - from[0]) * t;
      const py = from[1] + (to[1] - from[1]) * t - lift * Math.sin(Math.PI * t);
      strays = Math.max(strays, Math.hypot(x - px, y - py));
    }
    // A step is always placed: its whole point is to land somewhere else.
    if (strays <= FOOT_STRAYS && step <= FOOT_HOLDS) continue;
    // Which foot is free to go first: the one bearing less at the start — the
    // higher of the two, a tapped toe rather than a planted heel.
    const startLow = A[ft >= 0 ? ft * 3 + 1 : f * 3 + 1];
    found.push([u, f, ft, from[0], from[1], to[0], to[1], k.lengths[u], k.lengths[f], fold, lift, 0, 1, step, startLow]);
  }
  if (found.length === 0) return;
  // Two feet that both travel the same way take turns — a step-touch, a walk.
  // Two going opposite ways switch together, as a climber's do.
  const steppers = found.filter((p) => p[13] > FOOT_HOLDS);
  const sameWay = (a: number[], b: number[]) => (a[5] - a[3]) * (b[5] - b[3]) + (a[6] - a[4]) * (b[6] - b[4]) > 0;
  if (steppers.length === 2 && sameWay(steppers[0], steppers[1])) {
    const [a, b] = steppers;
    const first = Math.abs(a[14] - b[14]) > 0.5 ? (a[14] < b[14] ? a : b) : a[13] >= b[13] ? a : b;
    const second = first === a ? b : a;
    first[12] = STEP_FIRST;
    second[11] = 1 - STEP_FIRST;
  }
  for (const p of found) p.length = LEG_PIN_N;
  if (anchored < 0) {
    // The body's own corrections at the two ends, taken while the feet still
    // count — for when nothing but these legs is left to carry it. (How far each
    // end was moved onto the floor: where its root ended up.)
    k.cA = solvePose(k, 0)[1] - k.rootA[1];
    k.cB = solvePose(k, 0.5)[1] - k.rootB[1];
  }
  // A placed leg answers to its foot, not to the ground: out of the set.
  for (const [u, f, ft] of found) {
    k.gset[u] = 0;
    k.gset[f] = 0;
    if (ft >= 0) k.gset[ft] = 0;
  }
  for (const pin of found) k.legPins.push(...pin);
  // The two ends re-solved, so a frozen frame is the planted pose. Nothing that
  // places the body reads these legs any more, so once is exact.
  for (const [q, at] of [
    [0, k.anglesA],
    [0.5, k.anglesB],
  ] as const) {
    const pose = solvePose(k, q);
    for (let j = 0; j < k.legPins.length; j += LEG_PIN_N) {
      const u = k.legPins[j];
      const f = k.legPins[j + 1];
      // The foot keeps its own angle; only the leg above it moves.
      at[u] = nearest(pose[u * 3 + 2], at[u]);
      at[f] = nearest(pose[f * 3 + 2], at[f]);
    }
  }
}

/** Every limb that neither carries the body nor is placed: kept out of the floor. */
function settleFree(k: MotionKit, rig: Rig, view: FigureView): void {
  if (k.ground === 0) return;
  const index = (name: string) => rig.bones.findIndex((b) => b.name === name);
  const placed = new Set<number>(k.anchor);
  for (let j = 0; j < k.legPins.length; j += LEG_PIN_N) placed.add(k.legPins[j]);
  for (let j = 0; j < k.pins.length; j += PIN_N) placed.add(k.pins[j]);
  const limbs: [number, number, number][] =
    view === "side"
      ? [
          [index("thigh"), index("shin"), index("foot")],
          [index("farThigh"), index("farShin"), index("farFoot")],
        ]
      : [
          [index("thighR"), index("shinR"), -1],
          [index("thighL"), index("shinL"), -1],
        ];
  for (const arm of rig.arms) limbs.push([arm.upper, arm.fore, arm.hand]);
  for (const [u, f, end] of limbs) {
    if (u < 0 || f < 0 || placed.has(u) || k.depthSlot[f] >= 0) continue;
    // A foot or hand the body rests on is what the floor was found from: it
    // cannot sink. (A thigh can carry the body through the seat of the shorts
    // while its foot is free — a V-up's, a superman's — so only the end counts.)
    if (k.gset[end >= 0 ? end : f]) continue;
    k.free.push(u, f, end);
  }
}

/* ─────────────────────────────── The head ────────────────────────────────── */

/** The head's radius (half its height) in box units. */
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
export function headFrame(k: MotionKit, pose: number[], r: number): HeadFrame {
  "worklet";
  const i = k.headBone;
  const a = pose[i * 3 + 2];
  const L = k.lengths[i];
  const along = L < k.headLo ? k.headLo : L > k.headHi ? k.headHi : L;
  return {
    x: pose[i * 3] + along * Math.cos(a),
    y: pose[i * 3 + 1] + along * Math.sin(a),
    rot: a + Math.PI / 2,
    r,
  };
}

/* ─────────────────────────────── Framing ─────────────────────────────────── */

/**
 * How far each bone's drawing reaches around its two ends, in box units —
 * read off characterArt's measurements (a shorts block, a sleeve's shoulder, a
 * hand past the wrist, a trainer past the ankle).
 */
function reachOf(name: string): readonly [number, number] {
  if (name === "lowerSpine") return [10.5, 9];
  if (name === "upperSpine") return [9, 10.5];
  if (/^(neck|clav|pelvis)/.test(name)) return [0, 0];
  if (/UpArm|upArm/.test(name)) return [3.8, 2.6];
  if (/ForeArm|foreArm/.test(name)) return [2.6, 2];
  if (/^(far)?hand/i.test(name)) return [1.8, 1.6];
  if (/Thigh|thigh/.test(name)) return [5, 3];
  if (/Shin|shin/.test(name)) return [3, 4.6];
  if (/Foot|foot/.test(name)) return [5.6, 4.4];
  return [4, 4];
}

/** The ground sits this far under an ankle (the trainer's sole). */
const SOLE_BELOW_ANKLE = SOLE_BELOW;
/** The head's bounding circle, in head radii (hair and ears included). */
const HEAD_REACH = 1.15;
const FRAME_SAMPLES = 24;

export interface MotionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** The lowest point the figure touches — where it stands. */
  floorY: number;
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
    circles: [],
  };
}

/** The part of a rig the framing reads. `facing` defaults to +1 (front rigs). */
type FramedRig = Pick<Rig, "bones" | "headR"> & Partial<Pick<Rig, "facing">>;

/**
 * Fold one solved pose into the measurement. `hands` false measures what the
 * body alone stands on — the floor a planted hand is then brought down to.
 */
function measure(e: Extents, k: MotionKit, rig: FramedRig, pose: number[], hands = true): void {
  const r = headRadius(rig);
  const grow = (x: number, y: number, rad: number) => {
    e.minX = Math.min(e.minX, x - rad);
    e.maxX = Math.max(e.maxX, x + rad);
    e.minY = Math.min(e.minY, y - rad);
    e.maxY = Math.max(e.maxY, y + rad);
    e.circles.push(x, y, rad);
  };
  // Side rigs carry a foot bone, and its trainer turns with the ankle; front
  // rigs hang a level trainer under each shin.
  const turnedFeet = rig.bones.some((b) => /^(far)?foot$/i.test(b.name));
  for (let i = 0; i < k.n; i++) {
    const name = rig.bones[i].name;
    const [r0, r1] = reachOf(name);
    const sx = pose[i * 3];
    const sy = pose[i * 3 + 1];
    const a = pose[i * 3 + 2];
    const [tx, ty] = boneTip(k, pose, i);
    if (r0 > 0) grow(sx, sy, r0);
    if (r1 > 0) grow(tx, ty, r1);
    // What the figure can stand, kneel, lie or lean on.
    if (/^(far)?shin/i.test(name)) {
      // A knee on the floor (kneeling, a lunge's back knee)…
      e.floorY = Math.max(e.floorY, sy + KNEE_BELOW);
      // …and front-on, the level trainer under the ankle.
      if (!turnedFeet) e.floorY = Math.max(e.floorY, ty + SOLE_BELOW_ANKLE);
    } else if (/^(far)?foot$/i.test(name)) {
      // Side-on, the lowest point of the trainer at the angle the ankle set it.
      e.floorY = Math.max(e.floorY, sy + sideShoeDepth(a, rig.facing ?? 1));
    } else if (hands && /^(far)?hand/i.test(name)) {
      // A hand on the floor, by how the wrist has set it.
      e.floorY = Math.max(e.floorY, sy + handDepth(a));
    } else if (name === "lowerSpine") {
      e.floorY = Math.max(e.floorY, sy + 6.4);
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
  const maxY = Math.max(e.maxY, e.floorY);
  const cx = (e.minX + e.maxX) / 2;
  const cy = (e.minY + maxY) / 2;
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
    cx,
    cy,
    radius,
  };
}

/**
 * The room a movement needs, measured over a whole rep (so the figure never
 * changes size mid-rep and nothing is ever clipped), plus the floor it stands on.
 */
export function motionBounds(k: MotionKit, rig: FramedRig): MotionBounds {
  const e = emptyExtents();
  let low = -Infinity;
  for (let s = 0; s <= FRAME_SAMPLES; s++) {
    const pose = solvePose(k, s / FRAME_SAMPLES);
    measure(e, k, rig, pose);
    low = Math.max(low, drawnLow(k, pose));
  }
  // Where it stands is where the ground was solved — or, hanging, the lowest
  // its drawing ever reaches.
  e.floorY = k.ground > 0 ? k.floor : Number.isFinite(low) ? low : e.floorY;
  return finish(e);
}

/** The lowest point a pose's drawing reaches, box units — exact, from the support tables. */
function drawnLow(k: MotionKit, pose: number[]): number {
  let low = -Infinity;
  for (let i = 0; i < k.n; i++) {
    if (k.suppOn[i]) low = Math.max(low, pose[i * 3 + 1] + supportAt(k, i, pose[i * 3 + 2]));
  }
  return low;
}

/** The room ONE pose needs — what a thumbnail is fitted to. */
export function poseBounds(
  k: MotionKit,
  rig: FramedRig,
  pose: number[],
): MotionBounds {
  const e = emptyExtents();
  measure(e, k, rig, pose);
  const low = drawnLow(k, pose);
  if (Number.isFinite(low)) e.floorY = low;
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
): { k: number; tx: number; ty: number; panelW: number } {
  const pad = size * 0.06;
  const panelW = size * (view === "side" ? 0.78 : 0.94);
  if (fit && fit > 0) {
    // Never past the canvas, either: the panel clips whatever leaves it.
    const kRect = Math.min(
      (panelW - size * 0.04) / Math.max(1, b.maxX - b.minX),
      (size - pad * 2) / Math.max(1, b.maxY - b.minY),
    );
    const k = Math.min(kRect, fit / Math.max(1, b.radius));
    return {
      k,
      tx: panelW / 2 - b.cx * k,
      ty: size / 2 - b.cy * k,
      panelW,
    };
  }
  const halfWide = Math.max(Math.abs(b.minX - 50), Math.abs(b.maxX - 50), 1);
  const kx = (panelW / 2 - size * 0.02) / halfWide;
  const ky = (size - pad * 2) / Math.max(1, b.floorY - b.minY);
  // A ceiling, so a lone small pose is not blown up. It was 0.84 of the box;
  // the athlete is shorter than the cartoon was (a seventh of it is head, not a
  // quarter), and at 0.95 a standing figure fills the same height of the panel
  // the old one did instead of shrinking by an eighth.
  const cap = (size * 0.95) / 100;
  const k = Math.min(kx, ky, cap);
  return {
    k,
    tx: panelW / 2 - 50 * k,
    ty: size - pad - b.floorY * k,
    panelW,
  };
}
