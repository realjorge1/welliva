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
import { HAND_LENGTH, SOLE_BELOW, sideShoeToeRoom } from "./characterArt";
import { sideFacing, type Facing } from "./facing";
import { getFrontProfile, type FrontProfile } from "./frontProfiles";
import type { FigureMotion } from "./movementProfiles";
import type { FigureZone } from "./muscleEmphasis";
import { propsFor, type FigureProp } from "./props";
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

/** One arm, by bone index — what the solver and the framing need to drive it. */
export interface RigArm {
  upper: number;
  fore: number;
  hand: number;
  /**
   * Which way the elbow folds: +1 turns the forearm toward a smaller angle than
   * the upper arm (a side-on figure facing +x), −1 the other way.
   */
  fold: 1 | -1;
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
  /** Bones whose TIP is an ankle — what the planted-foot lock reads. */
  ankleBones: number[];
  /**
   * Where the BUILT skeleton stands at the top / bottom of the rep, box units —
   * the lowest ankle after walking the chain, not the height the pose was drawn
   * at. Bone lengths are averaged across the two poses and retuned to human
   * proportions, so the two differ; the solver pins the foot to this so it
   * cannot drift through the middle of a movement.
   */
  footY: readonly [number, number];
  /**
   * How far the BUILD stands the figure off the floor its pose was drawn
   * against, box units (+ is up) — longer legs, in practice.
   *
   * The solver applies this the whole time, and fades only the rest of the foot
   * correction out when the figure is airborne. Fading all of it would let a
   * body that is taller on the ground sag back to its drawn height at the top of
   * a jump, and a jumping jack would lose most of its hop to the sag.
   */
  standOffset: number;
  /**
   * False when the movement bears weight through its hands — on the floor or on
   * a bar. Those hands are where they were drawn and nothing may move them: the
   * arms keep their authored length (see `armsAreFree`), and the character's
   * shoulders keep their authored width (motion.ts SHOULDER_SPREAD).
   */
  armsFree: boolean;
  /**
   * Which way the figure faces (animation/facing.ts): +1 toward +x, −1 for the
   * few side profiles authored the other way round. Front rigs are always +1.
   * The renderers turn every side bone's art over for −1, so the belly, calves,
   * thumbs and soles land on the side that really is the front.
   */
  facing: Facing;
  /**
   * The largest turn any drawn bone makes between the poses as they were drawn,
   * radians — what the tempo is solved against. Measured before "The arms" settle
   * the joints: a softer elbow must not change the rhythm of a movement.
   */
  swing: number;
  /** The arms — see "The arms" below. */
  arms: RigArm[];
  /**
   * Bones that swing toward or away from the camera in this movement (see
   * FrontProfile.depth), and how much of each bone's length shows at the top /
   * bottom of the rep. 1 everywhere else.
   */
  depthBones: number[];
  stretchA: number[];
  stretchB: number[];
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
  /** True for a shin: its tip is the ankle. */
  ankle?: boolean;
}

/* ─────────────────────────── Build proportions ───────────────────────────
 *
 * The poses are authored as JOINT POSITIONS in a 0–100 box, and they were drawn
 * around a figure whose head took better than a third of its height. Measured
 * against the body they gave an athlete with arms about a quarter of its
 * standing height and legs under two fifths — a person is nearer 40% and 48% —
 * so the figure read as stubby however well it moved.
 *
 * Re-authoring 160-odd profiles to fix that is not on. Instead the rig retunes
 * the skeleton it assembles from them: the trunk and neck come in, the limbs go
 * out, every authored ANGLE is kept exactly as drawn, and the movement is
 * therefore the movement that was authored — only the body doing it is built
 * like a person. (The head comes down to match in `characterArt.HEAD_SCALE`.)
 *
 * Nothing here can push the figure off its floor: the solver pins the lowest
 * ankle to the height the pose was authored at, so longer legs stand the
 * athlete taller rather than sinking it through the ground.
 */
const BUILD = {
  /** The neck was a third of the trunk; the head now sits on the shoulders. */
  neck: 0.62,
  /**
   * The trunk as drawn. It was cut to 0.88 to make room under a head that took
   * a quarter of the figure; with an athlete's head the trunk gets its own
   * length back — and a push-up's planted hands are exactly where they were
   * authored again, since the trunk is what carries the shoulders to them.
   */
  spine: 1,
  arm: 1.18,
  leg: 1.05,
} as const;

/**
 * How far above the lowest foot a hand still counts as BEARING WEIGHT, in box
 * units — about a forearm's width.
 */
const HAND_CONTACT_BAND = 7;
/** How far a hand may drift between the two poses and still count as fixed. */
const HAND_FIXED_SLOP = 1.5;

function buildScale(name: string, arm: number): number {
  if (/Spine$/.test(name)) return BUILD.spine;
  if (name === "neck") return BUILD.neck;
  if (/Arm/.test(name)) return arm;
  if (/thigh|shin/i.test(name)) return BUILD.leg;
  return 1;
}

/**
 * Whether the arms may be lengthened at all for this movement.
 *
 * A longer arm moves the HAND, and for most work that is exactly right — a
 * press reaches higher, a curl starts lower. But where the hand is holding
 * something up it is not free to move: a push-up's hands are on the floor and a
 * pull-up's are on the bar, and lengthening the arm there drives them straight
 * through it. (Bending the elbow to compensate is worse: it turns a locked-out
 * push-up into a half-rep.) So a movement that bears weight through its hands
 * keeps the arms it was drawn with — those poses were authored against the
 * floor, and the floor is the one thing that cannot give.
 */
function armsAreFree(
  a: Record<string, Pt>,
  b: Record<string, Pt>,
  arms: ArmPair[],
  feet: string[],
): boolean {
  const onFloor = (n: Record<string, Pt>) => {
    const floor = Math.max(...feet.map((f) => n[f][1]));
    return arms.some((arm) => n[arm.hand][1] >= floor - HAND_CONTACT_BAND);
  };
  // A hand that neither moves between the poses nor drops below the shoulder is
  // hanging from something overhead — a bar. It is as fixed as a planted one.
  const onBar = arms.some(
    (arm) =>
      span(a[arm.hand], b[arm.hand]) <= HAND_FIXED_SLOP &&
      a[arm.hand][1] < a[arm.shoulder][1] &&
      b[arm.hand][1] < b[arm.shoulder][1],
  );
  return !onFloor(a) && !onFloor(b) && !onBar;
}

/** A shoulder and the hand on the end of it, by node name. */
interface ArmPair {
  shoulder: string;
  hand: string;
}

const NO_DEPTH: ReadonlySet<string> = new Set();

/**
 * A whole arm's bones, as the front poses draw them standing at ease, before
 * BUILD: what a bone swinging toward the camera is really as long as, however
 * little of it the pose shows.
 */
function fullArmLength(name: string): number {
  if (/^upArm/.test(name)) return 13.2;
  if (/^foreArm/.test(name)) return 12;
  return HAND_LENGTH;
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
  arms: ArmPair[],
  depth: ReadonlySet<string> = NO_DEPTH,
): Rig {
  const bones: RigBone[] = [];
  const anglesA: number[] = [];
  const anglesB: number[] = [];
  const stretchA: number[] = [];
  const stretchB: number[] = [];
  const armsFree = armsAreFree(nodesA, nodesB, arms, feet);
  const armScale = armsFree ? BUILD.arm : 1;

  for (const spec of specs) {
    const [a0, a1] = spec.seg(nodesA);
    const [b0, b1] = spec.seg(nodesB);
    // One length for the whole rep — the average of what the two poses ask for.
    // This is what stops limbs stretching through the middle of a movement.
    // `buildScale` then retunes it to human proportions (see BUILD).
    const scale = buildScale(spec.name, armScale);
    const spanA = span(a0, a1) * scale;
    const spanB = span(b0, b1) * scale;
    // A bone swinging through the camera shows less than its length at one end
    // of the rep. It keeps the arm's full length, and the poses say how much of
    // it shows.
    const full = depth.has(spec.name) ? fullArmLength(spec.name) * scale : 0;
    const length = full > 0 ? Math.max(full, spanA, spanB) : (spanA + spanB) / 2;
    stretchA.push(full > 0 ? spanA / length : 1);
    stretchB.push(full > 0 ? spanB / length : 1);
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
  const ankleBones = specs.flatMap((s, i) => (s.ankle ? [i] : []));

  const lowest = (nodes: Record<string, Pt>) => Math.max(...feet.map((f) => nodes[f][1]));

  /**
   * Where the BUILT skeleton actually stands at one keyframe — the lowest ankle
   * after walking the chain, rather than the height the pose was drawn at.
   *
   * The two differ, and the gap between them is `standOffset`. Bone lengths are
   * averaged across the two poses and then retuned to human proportions (BUILD),
   * so a figure assembled from a pose does not stand at the height that pose was
   * drawn at — longer legs put its feet below the authored floor.
   */
  const builtFootY = (angles: number[], origin: Pt): number => {
    const tipX = new Array<number>(bones.length);
    const tipY = new Array<number>(bones.length);
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const sx = b.parent < 0 ? origin[0] : tipX[b.parent];
      const sy = b.parent < 0 ? origin[1] : tipY[b.parent];
      tipX[i] = sx + b.length * Math.cos(angles[i]);
      tipY[i] = sy + b.length * Math.sin(angles[i]);
    }
    return Math.max(...ankleBones.map((i) => tipY[i]));
  };

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
    ankleBones,
    footY: [lowest(nodesA), lowest(nodesB)],
    standOffset: lowest(nodesA) - builtFootY(anglesA, rootA),
    armsFree,
    facing: 1,
    swing: 0,
    arms: [],
    depthBones: specs.flatMap((s, i) => (depth.has(s.name) ? [i] : [])),
    stretchA,
    stretchB,
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

const handSeg = (wrist: Pt): readonly [Pt, Pt] => [wrist, [wrist[0] + HAND_LENGTH, wrist[1]]];

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
  { name: "shinR", parent: 10, w0: 9.5, w1: 9.5, tip: 4.75, ankle: true, zone: "shin", seg: (n) => [n.knR, n.ftR] },

  { name: "pelvisL", parent: -1, w0: 9.5, w1: 9.5, tip: 0, draw: false, zone: "pelvis", seg: (n) => [n.pelvis, n.hipL] },
  { name: "thighL", parent: 12, w0: 9.5, w1: 9.5, tip: 0, zone: "thigh", seg: (n) => [n.hipL, n.knL] },
  { name: "shinL", parent: 13, w0: 9.5, w1: 9.5, tip: 4.75, ankle: true, zone: "shin", seg: (n) => [n.knL, n.ftL] },

  // The hands go last, so every index above stays where it has always been.
  // Only their length is read from here; "The arms" sets their angles.
  { name: "handR", parent: 5, w0: 3, w1: 3, tip: 1.5, zone: null, seg: (n) => handSeg(n.armHaR) },
  { name: "handL", parent: 8, w0: 3, w1: 3, tip: 1.5, zone: null, seg: (n) => handSeg(n.armHaL) },
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

// The side frames hold one arm and one leg; the far arm and leg are their own
// bones, drawn dimmed and set back for depth. They echo the near limbs unless a
// profile authors them (see SideProfile.framesFar). A synthesized foot keeps the
// athlete planted instead of balancing on the end of a shin.
const SIDE_SPECS: BoneSpec[] = [
  { name: "lowerSpine", parent: -1, w0: 15.5, w1: 17, tip: 0, zone: "torsoLower", seg: (n) => [n.hip, n.midTorso] },
  { name: "upperSpine", parent: 0, w0: 17, w1: 18, tip: 0, zone: "torsoUpper", seg: (n) => [n.midTorso, n.shoulder] },
  { name: "neck", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: null, seg: (n) => [n.shoulder, n.head] },
  { name: "clav", parent: 1, w0: 8, w1: 8, tip: 0, draw: false, zone: "shoulder", seg: (n) => [n.shoulder, n.armShoulder] },
  { name: "upArm", parent: 3, w0: 7.5, w1: 7.5, tip: 0, zone: "upperArm", seg: (n) => [n.armShoulder, n.armElbow] },
  { name: "foreArm", parent: 4, w0: 7.5, w1: 7.5, tip: 3.75, zone: "foreArm", seg: (n) => [n.armElbow, n.armHand] },
  { name: "thigh", parent: -1, w0: 9.5, w1: 9.5, tip: 0, zone: "thigh", seg: (n) => [n.hip, n.knee] },
  { name: "shin", parent: 6, w0: 9.5, w1: 9.5, tip: 0, ankle: true, zone: "shin", seg: (n) => [n.knee, n.foot] },
  { name: "foot", parent: 7, w0: 8, w1: 6, tip: 3, zone: null, seg: (n) => [n.foot, n.toe] },
  { name: "farUpArm", parent: 3, w0: 7.5, w1: 7.5, tip: 0, zone: "upperArm", seg: (n) => [n.armShoulder, n.farArmElbow] },
  { name: "farForeArm", parent: 9, w0: 7.5, w1: 7.5, tip: 3.75, zone: "foreArm", seg: (n) => [n.farArmElbow, n.farArmHand] },
  { name: "farThigh", parent: -1, w0: 9.5, w1: 9.5, tip: 0, zone: "thigh", seg: (n) => [n.hip, n.farKnee] },
  { name: "farShin", parent: 11, w0: 9.5, w1: 9.5, tip: 0, ankle: true, zone: "shin", seg: (n) => [n.farKnee, n.farFoot] },
  { name: "farFoot", parent: 12, w0: 8, w1: 6, tip: 3, zone: null, seg: (n) => [n.farFoot, n.farToe] },
  { name: "hand", parent: 5, w0: 3, w1: 3, tip: 1.5, zone: null, seg: (n) => handSeg(n.armHand) },
  { name: "farHand", parent: 10, w0: 3, w1: 3, tip: 1.5, zone: null, seg: (n) => handSeg(n.farArmHand) },
];

/* ───────────────────────────── The side feet ────────────────────────────
 *
 * The foot used to be one rule: level, toes toward +x. That is a standing foot,
 * and it was drawn on every leg in every pose — so a body on its back had the
 * soles of its trainers pressed flat as if standing on a wall, a body face down
 * or kneeling had its toes pointing back at its own knees, and a leg kicked up
 * behind wore its shoe upside down. Feet are now set the way an ankle sets them:
 *
 *   · STANDING on a surface (the shin within STAND_CONE of hanging straight
 *     down): flat, toes the way the body faces. As before.
 *   · Otherwise the foot sits square to the shin, toes on the shin's FRONT —
 *     the side away from the calf — then relaxes RESTING_POINT toward pointed,
 *     as an unloaded foot does: face up, the toes point at the sky; a knee
 *     driven up, the toes hang a little; a heel kicked back, the sole faces up.
 *   · Unless that would drive the toes into the surface just under the ankle —
 *     kneeling, lying face down, a back foot resting on a bench. Then the top of
 *     the foot rests on the surface: pointed, lying along it, sole up.
 *   · A shin that itself runs down into the floor — a plank, a push-up, a bear
 *     crawl, a quick step — is UP ON ITS TOES: the heel comes up as far as the
 *     floor under that ankle lets the toe clear it. Where a pose puts the ankle
 *     right on the floor (most planks are authored against the floor the hands
 *     are on) that is a slight lift; where the ankle is drawn higher, a full
 *     stand on the toes.
 *   · Hanging from a bar, nothing is under the feet at all: they hang free.
 *   · ONE FOOT, ONE WAY, ALL REP. A foot planted at one end of a rep and
 *     "resting on its top" at the other would turn over mid-rep — a push-up's
 *     legs flatten at the bottom, a lunge's back knee nears the floor — and no
 *     foot does that. The planted one wins at both ends.
 *
 * The surface under an ankle is the floor (the pose's lowest joint) or the top
 * of the equipment it is over — the step of a step-up, the bench a split
 * squat's back foot rests on.
 */

/** A foot bone's length — only its direction is drawn; the length is framing. */
const FOOT_LENGTH = 6.5;
/** A shin within this much of hanging straight down can stand on its foot. */
const STAND_CONE = (55 * Math.PI) / 180;
/**
 * An ankle this close above the surface under it is standing on it. Generous:
 * the two keyframes of a planted foot are not always drawn at one height.
 */
const ON_SURFACE = 3;
/** …and this close, a toe pointed down would dig into it (a trainer is ~9 long). */
const NEAR_SURFACE = 8;
/** How far past square an unloaded foot points its toes, once well off the floor… */
const RESTING_POINT = (30 * Math.PI) / 180;
/** …which it reaches this far above ON_SURFACE: a foot just lifted is still square. */
const RELAX_OVER = 6;
/** A direction whose sin() is above this points down into a surface. */
const DOWNWARD = 0.35;
/**
 * A shin whose sin() is at most this lies along the surface or rises off it
 * toward the foot (kneeling, lying face down, a foot up on a bench) — the foot
 * can rest on its top. Steeper down, it is driving into the floor: a plank.
 */
const SHIN_LEVEL = 0.15;

/** How a foot is set at one keyframe, and which rule set it. */
export interface FootSet {
  angle: number;
  how: "flat" | "rest" | "free";
  /** Where it would be up on its toes instead — what a planted rep keeps. */
  toes: number;
}

/** The top of a piece of equipment a foot can rest on, in box units. */
interface Surface {
  x0: number;
  x1: number;
  top: number;
}

/** Equipment tops, as surfaces. Walls are thin and stand up; they hold no foot. */
function surfacesOf(props: readonly FigureProp[]): Surface[] {
  return props.filter((p) => p.w > p.h * 0.5).map((p) => ({ x0: p.x, x1: p.x + p.w, top: p.y }));
}

/** How far the ankle is above the surface under it, box units (never below 0). */
function liftOf(ankle: Pt, groundY: number, surfaces: readonly Surface[]): number {
  let lift = groundY - ankle[1];
  for (const s of surfaces) {
    const over = ankle[0] >= s.x0 - 2 && ankle[0] <= s.x1 + 2;
    // A standing foot's ankle sits a sole above the top; a resting one, on it.
    const near = ankle[1] >= s.top - SOLE_BELOW - NEAR_SURFACE && ankle[1] <= s.top + 3;
    if (over && near) lift = Math.min(lift, s.top - SOLE_BELOW - ankle[1]);
  }
  return Math.max(0, lift);
}

/** The smaller angle between two directions, radians. */
function angleBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/** Which way the toes point at one keyframe — see "The side feet" above. */
export function footSet(knee: Pt, ankle: Pt, lift: number, facing: Facing): FootSet {
  const shin = dir(knee, ankle);
  const forward = facing > 0 ? 0 : Math.PI;
  const square = shin - facing * (Math.PI / 2);
  // Up on its toes: tipped toward square, as far as the floor under it allows.
  const toes =
    forward + facing * Math.min(sideShoeToeRoom(lift), angleBetween(square, forward));
  if (lift <= ON_SURFACE && angleBetween(shin, Math.PI / 2) <= STAND_CONE) {
    return { angle: forward, how: "flat", toes };
  }
  if (lift <= NEAR_SURFACE && Math.sin(square) > DOWNWARD) {
    // Resting on its top: lying back along the surface, toes away from the body.
    if (Math.sin(shin) <= SHIN_LEVEL) return { angle: forward + Math.PI, how: "rest", toes };
    return { angle: toes, how: "flat", toes };
  }
  const relax = RESTING_POINT * Math.min(1, Math.max(0, (lift - ON_SURFACE) / RELAX_OVER));
  return { angle: square + facing * relax, how: "free", toes };
}

/**
 * A planted foot stays planted for the whole rep — see "one foot, one way". The
 * end that would have rested on its top is up on its toes instead: a lunge's
 * back heel lifts as the knee drops, a push-up's feet stay as they were.
 */
function settleFeet(a: FootSet, b: FootSet): [FootSet, FootSet] {
  if (a.how === "flat" && b.how === "rest") return [a, { ...b, angle: b.toes, how: "flat" }];
  if (b.how === "flat" && a.how === "rest") return [{ ...a, angle: a.toes, how: "flat" }, b];
  return [a, b];
}

/** The near and far feet of both keyframes, settled. */
function sideFeet(
  profile: SideProfile,
  groundY: number,
  surfaces: readonly Surface[],
  facing: Facing,
): { near: [number, number]; far: [number, number] } {
  const leg = (k: 0 | 1, which: "near" | "far"): FootSet => {
    const frame = profile.frames[k];
    const farFrame = profile.framesFar?.[k];
    const knee = which === "far" && farFrame ? at(farFrame, 2) : at(frame, 5);
    const ankle = which === "far" && farFrame ? at(farFrame, 3) : at(frame, 6);
    return footSet(knee, ankle, liftOf(ankle, groundY, surfaces), facing);
  };
  const [nA, nB] = settleFeet(leg(0, "near"), leg(1, "near"));
  const [fA, fB] = settleFeet(leg(0, "far"), leg(1, "far"));
  return { near: [nA.angle, nB.angle], far: [fA.angle, fB.angle] };
}

function sideNodes(
  frame: number[],
  far: number[] | undefined,
  toeAngle: number,
  farToeAngle: number,
): Record<string, Pt> {
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
  // The far limbs either follow their own authored path or echo the near ones.
  const farElbow = far ? at(far, 0) : elbow;
  const farHand = far ? at(far, 1) : hand;
  const farKnee = far ? at(far, 2) : knee;
  const farFoot = far ? at(far, 3) : foot;
  const toeOf = (ankle: Pt, a: number): Pt => [
    ankle[0] + FOOT_LENGTH * Math.cos(a),
    ankle[1] + FOOT_LENGTH * Math.sin(a),
  ];
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
    toe: toeOf(foot, toeAngle),
    farArmElbow: fwd(farElbow),
    farArmHand: fwd(farHand),
    farKnee,
    farFoot,
    farToe: toeOf(farFoot, farToeAngle),
  };
}

/** The lowest authored joint over both keyframes — the floor the pose lies, kneels or stands on. */
function groundOf(profile: SideProfile): number {
  let y = -Infinity;
  for (const f of [...profile.frames, ...(profile.framesFar ?? [])]) {
    for (let i = 1; i < f.length; i += 2) y = Math.max(y, f[i]);
  }
  return y;
}

/* ─────────────────────────────── The arms ───────────────────────────────
 *
 * The legs read as legs because they were given joints: a knee that bends one
 * way, a foot set by its ankle, a planted foot that stays planted. The arms had
 * none of that. They were two rods turning about a fixed point: the elbow bent
 * whichever way the two angles happened to lerp, so a jump squat's forearm spun
 * backwards against its upper arm and a shoulder tap folded through the hip; a
 * swinging arm stayed dead straight; the shoulder never rose under a raised arm.
 * Here the arm gets its joints, and animation/motion.ts plants the hands.
 *
 *   · ONE SHOULDER RANGE. Side-on, an upper arm travels between hanging,
 *     forward and overhead, never round the back of the body: `SHOULDER_FROM`
 *     is the gap it may not cross, measured against the spine so it holds for a
 *     body lying down too. That sets which way round a big swing goes.
 *   · ONE ELBOW. Side-on, a forearm folds only toward the front of the body, and
 *     the elbow's own bend is what travels between the two poses. Because both
 *     bones lerp at the same `t`, this is still a plain angle lerp; only the
 *     revolution changes, so the solver reads it the same way as any other bone.
 *   · NEVER LOCKED. An arm that carries nothing is never dead straight: an elbow
 *     rests a little bent (`ELBOW_REST`), split between the two bones so the
 *     hand stays where the pose put it. Front-on, the bend curves toward the
 *     body's long axis: down at the thigh, up over the head, and through straight
 *     as the arm passes level.
 *   · THE SHOULDER RISES. Raise an arm and the shoulder blade turns with it, so
 *     the shoulder joint climbs: `girdle`, on the undrawn clavicle.
 *   · A WRIST. The hand is its own bone: relaxed a little toward the palm, and
 *     set flat by the solver where it holds something.
 */
const RAD = Math.PI / 180;
/** The gap in an upper arm's range starts here: pointing this far past overhead, measured from the spine. */
const SHOULDER_FROM = -95 * RAD;
/** An elbow may be drawn this far past straight before it reads as folded the other way. */
const ELBOW_FROM = -40 * RAD;
/** How far an unloaded elbow rests bent, side-on and front-on. */
const ELBOW_REST = 12 * RAD;
const FRONT_ELBOW_REST = 10 * RAD;
/** An arm drawn more bent than this, front-on, was bent on purpose: it is left alone. */
const FRONT_ELBOW_POSED = 30 * RAD;
/** How far a relaxed hand curls toward the palm. */
const WRIST_REST = 14 * RAD;
/** The shoulder joint starts to climb once the arm is this far off hanging… */
const GIRDLE_FROM = 35 * RAD;
/** …and is fully up with the arm overhead… */
const GIRDLE_TO = 170 * RAD;
/** …by this much on the clavicle, front-on and side-on (where the clavicle is short). */
const GIRDLE_FRONT = 26 * RAD;
const GIRDLE_SIDE = 55 * RAD;
/** A trunk within this of upright can raise its shoulders; on the floor they stay put. */
const GIRDLE_UPRIGHT = 40 * RAD;

/** The largest turn any bone that sets the pace makes between the two poses. */
function largestSwing(rig: Rig): number {
  let most = 0;
  rig.bones.forEach((b, i) => {
    if (!b.draw && b.name !== "neck") return;
    // A wrist follows its forearm; it doesn't set the pace of a movement.
    if (/^(far)?hand/i.test(b.name)) return;
    most = Math.max(most, Math.abs(rig.anglesB[i] - rig.anglesA[i]));
  });
  return most;
}

/** `a` as the one turn starting at `from`. */
function turnFrom(a: number, from: number): number {
  const full = Math.PI * 2;
  return a - full * Math.floor((a - from) / full);
}

/** `a` wrapped into (−π, π]. */
function wrapAngle(a: number): number {
  return turnFrom(a, -Math.PI);
}

/** How far the clavicle turns for an arm raised `raised` off hanging, at most `most`. */
function girdle(raised: number, most: number): number {
  const w = (raised - GIRDLE_FROM) / (GIRDLE_TO - GIRDLE_FROM);
  return most * Math.max(0, Math.min(1, w));
}

/** The hand's resting set on its forearm, at both ends of the rep. */
function restHands(rig: Rig, arm: RigArm, setA: number, setB: number): void {
  rig.anglesA[arm.hand] = rig.anglesA[arm.fore] + setA;
  rig.anglesB[arm.hand] = rig.anglesB[arm.fore] + setB;
}

function settleSideArms(rig: Rig, facing: Facing): void {
  const index = (name: string) => rig.bones.findIndex((b) => b.name === name);
  const spine = index("upperSpine");
  const clav = index("clav");
  const c = facing;
  const { anglesA: A, anglesB: B } = rig;
  const raisedA: number[] = [];
  const raisedB: number[] = [];

  rig.arms = [
    [index("upArm"), index("foreArm"), index("hand")],
    [index("farUpArm"), index("farForeArm"), index("farHand")],
  ].map(([upper, fore, hand]) => {
    // In the joints' own terms: the upper arm against the spine, the elbow's bend.
    let shoulderA = turnFrom(c * (A[upper] - A[spine]), SHOULDER_FROM);
    let shoulderB = turnFrom(c * (B[upper] - B[spine]), SHOULDER_FROM);
    let elbowA = turnFrom(c * (A[upper] - A[fore]), ELBOW_FROM);
    let elbowB = turnFrom(c * (B[upper] - B[fore]), ELBOW_FROM);
    if (rig.armsFree) {
      // Half the bend into each bone, so the hand stays about where it was.
      if (elbowA < ELBOW_REST) {
        shoulderA += (ELBOW_REST - elbowA) / 2;
        elbowA = ELBOW_REST;
      }
      if (elbowB < ELBOW_REST) {
        shoulderB += (ELBOW_REST - elbowB) / 2;
        elbowB = ELBOW_REST;
      }
    }
    raisedA.push(Math.PI - shoulderA);
    raisedB.push(Math.PI - shoulderB);
    A[upper] = A[spine] + c * shoulderA;
    B[upper] = A[upper] + (B[spine] - A[spine]) + c * (shoulderB - shoulderA);
    A[fore] = A[upper] - c * elbowA;
    B[fore] = B[upper] - c * elbowB;
    const arm: RigArm = { upper, fore, hand, fold: c };
    restHands(rig, arm, -c * WRIST_REST, -c * WRIST_REST);
    return arm;
  });

  // The near and far arm share one clavicle, so it follows the two of them.
  if (rig.armsFree) {
    const upright = (s: number) => Math.abs(wrapAngle(s + Math.PI / 2)) <= GIRDLE_UPRIGHT;
    const mean = (xs: number[]) => (xs[0] + xs[1]) / 2;
    if (upright(A[spine])) A[clav] -= girdle(mean(raisedA), GIRDLE_SIDE);
    if (upright(B[spine])) B[clav] -= girdle(mean(raisedB), GIRDLE_SIDE);
  }
}

function settleFrontArms(rig: Rig, depth: ReadonlySet<string>): void {
  const index = (name: string) => rig.bones.findIndex((b) => b.name === name);
  const spine = index("upperSpine");
  const { anglesA: A, anglesB: B } = rig;
  const upright = (s: number) => Math.abs(wrapAngle(s + Math.PI / 2)) <= GIRDLE_UPRIGHT;

  rig.arms = (["R", "L"] as const).map((letter) => {
    // +1 for the arm on the +x side of the screen, −1 for its mirror.
    const side = letter === "R" ? 1 : -1;
    const clav = index(`clav${letter}`);
    const upper = index(`upArm${letter}`);
    const fore = index(`foreArm${letter}`);
    const hand = index(`hand${letter}`);
    const free = rig.armsFree && !depth.has(rig.bones[fore].name);

    /** The elbow's bend at one end of the rep, signed (forearm − upper arm). */
    const settle = (at: number[]): number => {
      const raw = wrapAngle(at[fore] - at[upper]);
      if (!free || Math.abs(raw) > FRONT_ELBOW_POSED) return raw;
      // Toward the body's long axis: inward hanging, inward overhead, none level.
      const down = Math.sin(at[upper]);
      const want = side * Math.sign(down) * FRONT_ELBOW_REST * Math.min(1, Math.abs(down) / 0.5);
      if (Math.sign(raw) === Math.sign(want) && Math.abs(raw) >= Math.abs(want)) return raw;
      at[upper] -= (want - raw) / 2;
      at[fore] += (want - raw) / 2;
      return want;
    };
    const bendA = settle(A);
    const bendB = settle(B);

    if (rig.armsFree) {
      // Off hanging: an upper arm at +90° hangs, whichever side it is on.
      const raised = (at: number[]) => Math.abs(wrapAngle(at[upper] - Math.PI / 2));
      if (upright(A[spine])) A[clav] -= side * girdle(raised(A), GIRDLE_FRONT);
      if (upright(B[spine])) B[clav] -= side * girdle(raised(B), GIRDLE_FRONT);
    }

    // The bigger of the two bends says which way this elbow goes; an arm drawn
    // straight at both ends folds inward.
    const big = Math.abs(bendA) >= Math.abs(bendB) ? bendA : bendB;
    const fold: 1 | -1 = Math.abs(big) > FRONT_ELBOW_POSED ? (big < 0 ? 1 : -1) : side > 0 ? -1 : 1;
    const arm: RigArm = { upper, fore, hand, fold };
    const wrist = (bend: number) => (Math.abs(bend) < 2 * RAD ? 0 : Math.sign(bend) * WRIST_REST);
    restHands(rig, arm, wrist(bendA), wrist(bendB));
    return arm;
  });
}

/* ─────────────────────────────── Public API ───────────────────────────── */

/**
 * Side-view FAR limb bones (arm, forearm, thigh, shin, foot), drawn dimmed and
 * set back behind the body to read as depth.
 */
export const SIDE_FAR_BONES = [9, 10, 11, 12, 13] as const;

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
  const depth: ReadonlySet<string> =
    profile.depth === "arm"
      ? new Set(["upArmR", "upArmL", "foreArmR", "foreArmL", "handR", "handL"])
      : profile.depth === "fore"
        ? new Set(["foreArmR", "foreArmL", "handR", "handL"])
        : NO_DEPTH;
  const rig = assemble(
    FRONT_SPECS,
    frontNodes(profile.frames[0], profile.framesL?.[0]),
    frontNodes(profile.frames[1], profile.framesL?.[1]),
    "pelvis",
    2,
    10,
    profile.loopMs,
    ["ftR", "ftL"],
    [
      { shoulder: "armShR", hand: "armHaR" },
      { shoulder: "armShL", hand: "armHaL" },
    ],
    depth,
  );
  rig.swing = largestSwing(rig);
  settleFrontArms(rig, depth);
  return rig;
}

/**
 * Movements done hanging from a bar: no floor under the feet in any frame. (The
 * lowest joint would otherwise be taken for the floor, and the hanging feet
 * drawn flat, standing on air.)
 */
const HANGING = new Set<FigureMotion>(["pullUp"]);

/**
 * What the registry knows about a movement's side view beyond its two poses:
 * which way it faces (animation/facing.ts), the equipment a foot can rest on,
 * and whether it hangs from a bar. A profile from outside the registry has
 * none of it — it faces +x on the bare floor.
 */
export interface SideContext {
  facing?: Facing;
  props?: readonly FigureProp[];
  hanging?: boolean;
}

/** The side context of a catalogued movement. */
export function sideContextOf(motion: FigureMotion): SideContext {
  return {
    facing: sideFacing(motion),
    props: propsFor(motion, "side"),
    hanging: HANGING.has(motion),
  };
}

/** The side-view counterpart of `buildFrontRigFrom`. */
export function buildSideRigFrom(profile: SideProfile, context: SideContext = {}): Rig {
  const facing = context.facing ?? 1;
  const ground = context.hanging ? Infinity : groundOf(profile);
  const feet = sideFeet(profile, ground, surfacesOf(context.props ?? []), facing);
  const rig = assemble(
    SIDE_SPECS,
    sideNodes(profile.frames[0], profile.framesFar?.[0], feet.near[0], feet.far[0]),
    sideNodes(profile.frames[1], profile.framesFar?.[1], feet.near[1], feet.far[1]),
    "hip",
    2,
    10,
    profile.loopMs,
    ["foot", "farFoot"],
    [
      { shoulder: "armShoulder", hand: "armHand" },
      { shoulder: "armShoulder", hand: "farArmHand" },
    ],
  );
  // A foot turning half a circle between the two poses (standing ↔ kneeling)
  // could take either way round, and `unwrap` picks one by a hair. It must
  // swing through toes-DOWN — the way an ankle points — never flip over
  // through toes-up.
  rig.bones.forEach((b, i) => {
    if (b.name !== "foot" && b.name !== "farFoot") return;
    const a = rig.anglesA[i];
    const bAng = rig.anglesB[i];
    if (Math.abs(bAng - a) > (150 * Math.PI) / 180 && Math.sin((a + bAng) / 2) < 0) {
      rig.anglesB[i] = bAng + (bAng > a ? -Math.PI * 2 : Math.PI * 2);
    }
  });
  rig.swing = largestSwing(rig);
  settleSideArms(rig, facing);
  return { ...rig, facing };
}

export function buildFrontRig(motion: FigureMotion): Rig {
  return buildFrontRigFrom(getFrontProfile(motion));
}

export function buildSideRig(motion: FigureMotion): Rig {
  return buildSideRigFrom(getSideProfile(motion), sideContextOf(motion));
}

/**
 * The rig's REFERENCE ease: a plain ping-pong (top → bottom → top) with a
 * smootherstep turn at both ends.
 *
 * This is what a rig does with nothing layered on it — the geometry the suite
 * and the practices spike probe (bone lengths, the drawable box, foreshortening).
 * It is NOT how the figure moves on screen: that is animation/motion.ts, which
 * gives each movement its own feel (animation/tempo.ts), trails the joints,
 * pins the planted foot, and runs a life layer on top.
 */
export function repEase(p: number): number {
  const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
  const c = tri < 0 ? 0 : tri > 1 ? 1 : tri;
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Walk the chain at rep progress `p` on the reference ease, returning
 * `[startX, startY, angle]` per bone in box units — the bare rig, for asserting
 * its geometry. The renderers solve poses with `solvePose` (animation/motion.ts).
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
