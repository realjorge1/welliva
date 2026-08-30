/**
 * FIGURE RIG — turns the authored keyframe POSES into a skeletal rig.
 *
 * The demonstration figure used to be drawn by rebuilding every limb path from
 * interpolated joint POSITIONS on each frame. That had two problems, one
 * cosmetic and one fatal:
 *
 *   · Cosmetic — interpolating positions does not preserve bone length, so
 *     limbs stretched and shrank through the middle of every rep. It read as
 *     rubber, not anatomy.
 *   · Fatal — it allocated a fresh native SkPath per limb per frame. At 60fps
 *     across two panels that is well over a thousand native objects a second
 *     with nothing disposing them; the exercise screens leaked until the app
 *     stalled and died.
 *
 * A rig fixes both. Each bone gets a CONSTANT rest length and a per-keyframe
 * ANGLE sampled from the authored poses. Playback interpolates angles and walks
 * the chain (forward kinematics), so limbs keep their length and the renderer
 * only has to move pre-built capsules with a matrix — zero per-frame allocation.
 *
 * Pure TS (no React / Skia / Reanimated) so the fitness suite can prove every
 * catalogued movement resolves to a well-formed, drawable skeleton.
 */
import { getFrontProfile, type FrontProfile } from "./frontProfiles";
import type { FigureMotion } from "./movementProfiles";
import type { FigureZone } from "./muscleEmphasis";
import { getSideProfile, type SideProfile } from "./sideProfiles";

/**
 * One bone: a rounded capsule of fixed length hanging off its parent's tip.
 *
 * Widths follow the pictogram reference the figure is held to — a blocky trunk,
 * uniform limbs, fully rounded ends. Some bones exist only to POSITION what
 * hangs off them (the neck carries the head; the clavicle and pelvis links
 * place the shoulder and hip joints inside the trunk) and are never drawn,
 * exactly as a pictogram has no visible neck.
 */
export interface RigBone {
  name: string;
  /** Index of the bone this one hangs from, or -1 to attach to the root. */
  parent: number;
  /** Rest length in 0–100 box units. Constant for the whole animation. */
  length: number;
  /** Capsule width at the base / at the tip, in box units. */
  w0: number;
  w1: number;
  /** Extra rounding at the tip — hands, feet. 0 for bones that run into another. */
  tip: number;
  /** False for positioning-only bones (neck, clavicle, pelvis link). */
  draw: boolean;
  /**
   * Shorten the DRAWN capsule at the tip, in box units. The trunk uses it so
   * its rounded top lands on the shoulder line instead of bulging half a torso
   * width up into the head.
   */
  drawInset: number;
  /** Depth in the chain — drives the follow-through lag during playback. */
  depth: number;
  /** Which muscle zone this bone belongs to (kept for non-visual consumers). */
  zone: FigureZone | null;
}

/** A whole skeleton plus the two poses it ping-pongs between. */
export interface Rig {
  bones: RigBone[];
  /** Absolute bone angles (radians) at the top / bottom of the rep. */
  anglesA: number[];
  anglesB: number[];
  /** Root (pelvis) position at the top / bottom of the rep, in box units. */
  rootA: readonly [number, number];
  rootB: readonly [number, number];
  /** Bone whose tip carries the head. */
  headBone: number;
  /** Head radius in box units. */
  headR: number;
  /** Full ping-pong cycle (top → bottom → top) in ms. */
  loopMs: number;
  /** Floor line the contact shadow sits on, in box units. */
  groundY: number;
  /** Widest span either pose reaches from the root, for framing. */
  reach: number;
}

type Pt = readonly [number, number];

const at = (frame: number[], i: number): Pt => [frame[i * 2], frame[i * 2 + 1]];
const flip = (p: Pt): Pt => [100 - p[0], p[1]];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const span = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
const dir = (a: Pt, b: Pt): number => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** A bone's authored segment, resolved against one keyframe's joint set. */
interface BoneSpec extends Omit<RigBone, "length" | "depth" | "draw" | "drawInset"> {
  seg: (n: Record<string, Pt>) => readonly [Pt, Pt];
  /** Defaults to true — set false for positioning-only bones. */
  draw?: boolean;
  drawInset?: number;
}

/**
 * Pick the representation of `b` closest to `a` so a plain lerp always takes
 * the short way round. Without this a bone crossing the ±π seam would spin all
 * the way back through the body.
 */
function unwrap(a: number, b: number): number {
  let out = b;
  while (out - a > Math.PI) out -= Math.PI * 2;
  while (a - out > Math.PI) out += Math.PI * 2;
  return out;
}

function assemble(
  specs: BoneSpec[],
  nodesA: Record<string, Pt>,
  nodesB: Record<string, Pt>,
  root: string,
  headBone: number,
  headR: number,
  loopMs: number,
  feet: string[],
): Rig {
  const bones: RigBone[] = [];
  const anglesA: number[] = [];
  const anglesB: number[] = [];

  for (const spec of specs) {
    const [a0, a1] = spec.seg(nodesA);
    const [b0, b1] = spec.seg(nodesB);
    // One length for the whole rep — the average of what the two poses ask for.
    // This is what stops limbs stretching through the middle of a movement.
    const length = (span(a0, a1) + span(b0, b1)) / 2;
    const angA = dir(a0, a1);
    bones.push({
      name: spec.name,
      parent: spec.parent,
      length,
      w0: spec.w0,
      w1: spec.w1,
      tip: spec.tip,
      draw: spec.draw !== false,
      drawInset: spec.drawInset ?? 0,
      depth: spec.parent < 0 ? 0 : bones[spec.parent].depth + 1,
      zone: spec.zone,
    });
    anglesA.push(angA);
    anglesB.push(unwrap(angA, dir(b0, b1)));
  }

  // Park the trunk's rounded top a fixed gap below the head instead of using a
  // hand-tuned constant. Neck length varies by pose set (a folded hinge sits the
  // head much closer to the shoulders than a tall stand), so a constant inset
  // either lets the trunk bulge into the head or leaves it floating.
  const trunk = bones.findIndex((b) => b.name === "upperSpine");
  if (trunk >= 0) {
    const capR = bones[trunk].w1 / 2;
    const neckLen = bones[headBone].length;
    const wanted = capR - neckLen + headR + HEAD_GAP;
    bones[trunk].drawInset = Math.max(
      0,
      Math.min(wanted, bones[trunk].length * 0.92),
    );
  }

  const rootA = nodesA[root];
  const rootB = nodesB[root];
  const groundY =
    Math.max(...feet.flatMap((f) => [nodesA[f][1], nodesB[f][1]])) + 1.5;

  // How far the silhouette reaches from the root — the renderer uses it so a
  // wide pose (a jumping jack) still fits inside its panel.
  const reach = Math.max(
    ...Object.values(nodesA).map((p) => Math.abs(p[0] - rootA[0])),
    ...Object.values(nodesB).map((p) => Math.abs(p[0] - rootB[0])),
  );

  return {
    bones,
    anglesA,
    anglesB,
    rootA,
    rootB,
    headBone,
    headR,
    loopMs,
    groundY,
    reach,
  };
}

/* ──────────────────────────── Front skeleton ──────────────────────────── */

// Authored front frames hold the centerline + the RIGHT limbs; the left side is
// the mirror.
//
// Proportions are measured off the pictogram reference the figure is held to:
// against a ~89-unit-tall body the trunk is ~18 wide, arms ~7.5, legs ~9.5 and
// the head ~20 across. Limbs are UNIFORM width with round caps — no tapering,
// no anatomy. The trunk narrows slightly toward the hips, which is what opens
// the thin light gap between a hanging arm and the body.
/** Light gap between the bottom of the head and the top of the trunk. */
const HEAD_GAP = 3;

const FRONT_SPECS: BoneSpec[] = [
  { name: "lowerSpine", parent: -1, w0: 16.5, w1: 18, tip: 0, zone: "torsoLower", seg: (n) => [n.pelvis, n.midTorso] },
  { name: "upperSpine", parent: 0, w0: 18, w1: 19, tip: 0, zone: "torsoUpper", seg: (n) => [n.midTorso, n.chest] },
  { name: "neck", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: null, seg: (n) => [n.chest, n.head] },

  { name: "clavR", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: "shoulder", seg: (n) => [n.chest, n.armShR] },
  { name: "upArmR", parent: 3, w0: 7.5, w1: 7.5, tip: 0, zone: "upperArm", seg: (n) => [n.armShR, n.armElR] },
  { name: "foreArmR", parent: 4, w0: 7.5, w1: 7.5, tip: 3.75, zone: "foreArm", seg: (n) => [n.armElR, n.armHaR] },

  { name: "clavL", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: "shoulder", seg: (n) => [n.chest, n.armShL] },
  { name: "upArmL", parent: 6, w0: 7.5, w1: 7.5, tip: 0, zone: "upperArm", seg: (n) => [n.armShL, n.armElL] },
  { name: "foreArmL", parent: 7, w0: 7.5, w1: 7.5, tip: 3.75, zone: "foreArm", seg: (n) => [n.armElL, n.armHaL] },

  { name: "pelvisR", parent: -1, w0: 9.5, w1: 9.5, tip: 0, draw: false, zone: "pelvis", seg: (n) => [n.pelvis, n.hipR] },
  { name: "thighR", parent: 9, w0: 9.5, w1: 9.5, tip: 0, zone: "thigh", seg: (n) => [n.hipR, n.knR] },
  { name: "shinR", parent: 10, w0: 9.5, w1: 9.5, tip: 4.75, zone: "shin", seg: (n) => [n.knR, n.ftR] },

  { name: "pelvisL", parent: -1, w0: 9.5, w1: 9.5, tip: 0, draw: false, zone: "pelvis", seg: (n) => [n.pelvis, n.hipL] },
  { name: "thighL", parent: 12, w0: 9.5, w1: 9.5, tip: 0, zone: "thigh", seg: (n) => [n.hipL, n.knL] },
  { name: "shinL", parent: 13, w0: 9.5, w1: 9.5, tip: 4.75, zone: "shin", seg: (n) => [n.knL, n.ftL] },
];

/**
 * How far the whole arm chain is carried clear of the body, in box units.
 *
 * The authored shoulder sits ON the trunk's centreline-ish, which in a flat
 * one-colour pictogram means a hanging arm vanishes into the torso — the figure
 * reads as a blob with no arms at all. Translating the chain (shoulder, elbow
 * AND hand by the same amount, so no angle changes) parks it just outside the
 * trunk edge, which is what opens the thin light gap the reference has. The
 * undrawn clavicle absorbs the offset.
 */
const ARM_CLEARANCE = 3.6;
const SIDE_ARM_CLEARANCE = 3.4;

function frontNodes(frame: number[], left?: number[]): Record<string, Pt> {
  const head = at(frame, 0);
  const chest = at(frame, 1);
  const pelvis = at(frame, 2);
  const shR = at(frame, 3);
  const elR = at(frame, 4);
  const haR = at(frame, 5);
  const hipR = at(frame, 6);
  const knR = at(frame, 7);
  const ftR = at(frame, 8);
  const out = (p: Pt): Pt => [p[0] + ARM_CLEARANCE, p[1]];
  const armShR = out(shR);
  const armElR = out(elR);
  const armHaR = out(haR);

  // An ALTERNATING movement authors its own left side; everything symmetric
  // mirrors the right. The arm clearance runs the other way on an authored
  // left arm, so a hanging hand clears the trunk on both sides.
  const outL = (p: Pt): Pt => [p[0] - ARM_CLEARANCE, p[1]];
  const armShL = left ? outL(at(left, 0)) : flip(armShR);
  const armElL = left ? outL(at(left, 1)) : flip(armElR);
  const armHaL = left ? outL(at(left, 2)) : flip(armHaR);

  return {
    head,
    chest,
    pelvis,
    midTorso: mid(chest, pelvis),
    hipR,
    knR,
    ftR,
    hipL: left ? at(left, 3) : flip(hipR),
    knL: left ? at(left, 4) : flip(knR),
    ftL: left ? at(left, 5) : flip(ftR),
    armShR,
    armElR,
    armHaR,
    armShL,
    armElL,
    armHaL,
  };
}

/* ───────────────────────────── Side skeleton ──────────────────────────── */

// The side frames hold one arm and one leg; the renderer re-draws those bones
// dimmed and offset for the far side. A synthesized foot keeps the athlete
// planted instead of balancing on the end of a shin.
const SIDE_SPECS: BoneSpec[] = [
  { name: "lowerSpine", parent: -1, w0: 15.5, w1: 17, tip: 0, zone: "torsoLower", seg: (n) => [n.hip, n.midTorso] },
  { name: "upperSpine", parent: 0, w0: 17, w1: 18, tip: 0, zone: "torsoUpper", seg: (n) => [n.midTorso, n.shoulder] },
  { name: "neck", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: null, seg: (n) => [n.shoulder, n.head] },
  { name: "clav", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: "shoulder", seg: (n) => [n.shoulder, n.armShoulder] },
  { name: "upArm", parent: 3, w0: 7.5, w1: 7.5, tip: 0, zone: "upperArm", seg: (n) => [n.armShoulder, n.armElbow] },
  { name: "foreArm", parent: 4, w0: 7.5, w1: 7.5, tip: 3.75, zone: "foreArm", seg: (n) => [n.armElbow, n.armHand] },
  { name: "thigh", parent: -1, w0: 9.5, w1: 9.5, tip: 0, zone: "thigh", seg: (n) => [n.hip, n.knee] },
  { name: "shin", parent: 6, w0: 9.5, w1: 9.5, tip: 0, zone: "shin", seg: (n) => [n.knee, n.foot] },
  { name: "foot", parent: 7, w0: 8, w1: 6, tip: 3, zone: null, seg: (n) => [n.foot, n.toe] },
];

function sideNodes(frame: number[]): Record<string, Pt> {
  const head = at(frame, 0);
  const shoulder = at(frame, 1);
  const elbow = at(frame, 2);
  const hand = at(frame, 3);
  const hip = at(frame, 4);
  const knee = at(frame, 5);
  const foot = at(frame, 6);
  // The near arm is carried forward of the trunk so a profile figure has a
  // visible arm instead of one swallowed by the torso.
  const fwd = (p: Pt): Pt => [p[0] + SIDE_ARM_CLEARANCE, p[1]];
  return {
    head,
    shoulder,
    elbow,
    hand,
    hip,
    knee,
    foot,
    midTorso: mid(shoulder, hip),
    armShoulder: fwd(shoulder),
    armElbow: fwd(elbow),
    armHand: fwd(hand),
    // The athlete faces +x, so the foot always points forward and stays flat.
    toe: [foot[0] + 6.5, foot[1]] as Pt,
  };
}

/* ─────────────────────────────── Public API ───────────────────────────── */

/** Side-view limb bones, echoed dimmed behind the body to read as depth. */
export const SIDE_FAR_BONES = [4, 5, 6, 7, 8] as const;

/**
 * Rig a front profile that is NOT in the exercise registry.
 *
 * `buildFrontRig` takes a `FigureMotion`, which is the EXERCISE vocabulary —
 * a closed union every catalogued lift resolves into. Modalities that are not
 * exercises (a tai chi form, a breathwork posture) have their own vocabulary
 * and must not widen that union just to be drawn; a `SpecificMotion` key for
 * "cloudHands" would force every exhaustive `Record<FigureMotion, …>` in the
 * fitness layer to grow a tai chi column it has no business having.
 *
 * So the skeleton is separated from the registry: both callers assemble the
 * same bones from the same specs, and only the lookup differs.
 */
export function buildFrontRigFrom(profile: FrontProfile): Rig {
  return assemble(
    FRONT_SPECS,
    frontNodes(profile.frames[0], profile.framesL?.[0]),
    frontNodes(profile.frames[1], profile.framesL?.[1]),
    "pelvis",
    2,
    10,
    profile.loopMs,
    ["ftR", "ftL"],
  );
}

/** The side-view counterpart of `buildFrontRigFrom`. */
export function buildSideRigFrom(profile: SideProfile): Rig {
  return assemble(
    SIDE_SPECS,
    sideNodes(profile.frames[0]),
    sideNodes(profile.frames[1]),
    "hip",
    2,
    10,
    profile.loopMs,
    ["foot"],
  );
}

export function buildFrontRig(motion: FigureMotion): Rig {
  return buildFrontRigFrom(getFrontProfile(motion));
}

export function buildSideRig(motion: FigureMotion): Rig {
  return buildSideRigFrom(getSideProfile(motion));
}

/**
 * Ease one rep: a ping-pong (top → bottom → top) with a smootherstep turn at
 * both ends, so the athlete decelerates into the bottom of the movement the way
 * a real lifter does instead of snapping between poses.
 */
export function repEase(p: number): number {
  const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
  const c = tri < 0 ? 0 : tri > 1 ? 1 : tri;
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Walk the chain at rep progress `p`, returning `[startX, startY, angle]` per
 * bone in box units. A pure mirror of the worklet inside the renderer, kept
 * here so the suite can assert the skeleton never leaves the drawable box.
 */
export function poseRig(rig: Rig, p: number): number[] {
  const t = repEase(p);
  const rootX = rig.rootA[0] + (rig.rootB[0] - rig.rootA[0]) * t;
  const rootY = rig.rootA[1] + (rig.rootB[1] - rig.rootA[1]) * t;
  const out = new Array<number>(rig.bones.length * 3);
  const tipX = new Array<number>(rig.bones.length);
  const tipY = new Array<number>(rig.bones.length);

  for (let i = 0; i < rig.bones.length; i++) {
    const bone = rig.bones[i];
    const a = rig.anglesA[i] + (rig.anglesB[i] - rig.anglesA[i]) * t;
    const sx = bone.parent < 0 ? rootX : tipX[bone.parent];
    const sy = bone.parent < 0 ? rootY : tipY[bone.parent];
    tipX[i] = sx + bone.length * Math.cos(a);
    tipY[i] = sy + bone.length * Math.sin(a);
    out[i * 3] = sx;
    out[i * 3 + 1] = sy;
    out[i * 3 + 2] = a;
  }
  return out;
}
