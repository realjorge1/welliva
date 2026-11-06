/**
 * CHARACTER ART — the drawing of the athlete, as plain data.
 *
 * Both renderers (the animated Skia panel and the SVG still) draw from this one
 * module, so the character in a list thumbnail and the one in the live player
 * are the same person drawn in the same order. Nothing here knows about React,
 * Skia or Reanimated: every part is an SVG path string with a fill, expressed in
 * the rig's own 0–100 box units, in the frame of the bone it rides.
 *
 * ── AN ATHLETE, DRAWN FLAT ─────────────────────────────────────────────────────
 *
 * The figure is held to the swimmer in the owner's "glide" reference: a real
 * body in a flat illustration — slim, long-limbed, quietly shaped — not a
 * cartoon. It used to be a 4-heads-tall character with shoulders over half its
 * own height apart, limbs as wide as half its head and trainers twice the
 * length of a foot; the owner's verdict was "too fat". Now:
 *
 *   · HUMAN PROPORTIONS. About seven heads tall, shoulders a quarter of the
 *     height across, limbs a person's width. Measured in the tests.
 *   · LIMBS WITH A SHAPE. A limb is a soft taper with its muscle belly on it —
 *     a calf behind the shin, a forearm thicker at the elbow, a biceps under the
 *     sleeve — so a bending knee or elbow reads as a joint, not a hose.
 *   · FLAT COLOUR, ONE SHADE. Skin / tee / shorts / trainers are blocks, each with
 *     one shade a step down for the far limbs, hems and collar. No gradients,
 *     no outlines — except a hairline rim on the sleeve and the hand, which is
 *     what keeps a teal sleeve legible over a teal tee and a hand over a face.
 *   · THE KIT IS UNCHANGED. Same tee, shorts, socks and trainers; only cut to the
 *     body now wearing them.
 *
 * ── THIS FIGURE DEMONSTRATES; IT DOES NOT PERFORM ────────────────────────────
 *
 * Its whole job is to show a movement clearly. The face is two eyes and a
 * closed mouth, drawn once and never animated: the eyes say which way the body
 * faces, and nothing on the head moves while the limbs do the thing worth
 * watching. The hair is cropped close, so it has nothing to swing.
 *
 * Bone frame: origin at the bone's start, +x along the bone to its tip, +y across
 * it (the bone's right-hand side) — for a limb of the side-on figure that is the
 * BACK of it, where the calf is. Head frame: radius 1 = half the head's height,
 * at its centre; "up" is −y (toward the crown along the neck), the front of the
 * face is +x.
 */
import { sideFacing } from "./facing";
import type { FigureMotion } from "./movementProfiles";
import type { Rig } from "./rig";

export type FigureView = "front" | "side";

/** Which figure demonstrates: the character, or the original flat pictogram. */
export type FigureLook = "character" | "pictogram";

/* ───────────────────────────────── Palette ───────────────────────────────── */

/**
 * Fixed hexes, like the flame and the badge metals: the athlete wears the same
 * kit in either theme. Each colour is a BLOCK with a shade one step down for the
 * hems and the far limbs — the single flat shadow an illustrator gives a figure
 * instead of a gradient.
 */
export const KIT = {
  skin: "#C98B5F",
  skinShade: "#A8693F",
  skinDeep: "#8C5230",
  hair: "#2A1F1F",
  hairLight: "#5A4743",
  tee: "#17B8A3",
  teeShade: "#0E8E7F",
  teeDeep: "#0A6B5F",
  shorts: "#5560D8",
  shortsShade: "#3D47AD",
  shortsDeep: "#2B3380",
  shoe: "#FF6B4F",
  shoeShade: "#D9503A",
  shoeDeep: "#B63F2B",
  shoeLight: "#FF9A83",
  sole: "#FFF4EA",
  soleShade: "#D9CCC0",
  pupil: "#241B1F",
  mouth: "#5A2119",
} as const;

/**
 * The head's half-height, relative to the rig's own head radius.
 *
 * It was 1.75 (a cartoon head, more than a third of the figure), then 1.05 (a
 * quarter of it — still a 4-heads-tall character). At 0.58 the head is about a
 * seventh of the standing height: an athlete's head, the share a person's has.
 * Measured in `fitness/__tests__/rig.test.ts`.
 */
export const HEAD_SCALE = 0.58;

/** One drawn shape. `d` is an SVG path in its frame; fills are flat. */
export interface Shape {
  d: string;
  fill?: string;
  opacity?: number;
  /** A stroked line instead of (or as well as) a fill. */
  stroke?: { color: string; width: number };
  /**
   * Decoration that is invisible below ~100px — a cuff, a lace, a toe cap, a
   * waistband, a highlight. A list thumbnail skips it: dozens of rows are
   * mounted at once on a 1 GB phone, and a node nobody can see is still a node.
   */
  fine?: boolean;
}

/** Full detail for the live player and the detail screens; `thumb` for list rows. */
export type ArtDetail = "full" | "thumb";

/* ─────────────────────────── Path vocabulary ─────────────────────────────── */

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/*
 * EVERY SHAPE WINDS CLOCKWISE (sweep 1, in screen space). Several of these are
 * concatenated into one path — a limb and its muscle, a mitt and its thumb —
 * and the default fill rule cancels the overlap of two opposite windings into a
 * hole.
 */

/** A circle. */
export function disc(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 1 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-r * 2)} 0Z`;
}

/** An ellipse. */
export function oval(cx: number, cy: number, rx: number, ry: number): string {
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 1 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 1 ${f(-rx * 2)} 0Z`;
}

/** A rounded rectangle, corners `r` (clamped to fit). */
export function rrect(x0: number, y0: number, x1: number, y1: number, r: number): string {
  const w = x1 - x0;
  const h = y1 - y0;
  const c = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${f(x0 + c)} ${f(y0)}H${f(x1 - c)}A${f(c)} ${f(c)} 0 0 1 ${f(x1)} ${f(y0 + c)}` +
    `V${f(y1 - c)}A${f(c)} ${f(c)} 0 0 1 ${f(x1 - c)} ${f(y1)}H${f(x0 + c)}` +
    `A${f(c)} ${f(c)} 0 0 1 ${f(x0)} ${f(y1 - c)}V${f(y0 + c)}A${f(c)} ${f(c)} 0 0 1 ${f(x0 + c)} ${f(y0)}Z`
  );
}

/**
 * A rounded bar along +x from x0 to x1: radius r0 at the start, r1 at the end,
 * both ends fully round and the sides running tangent between them — a limb, a
 * neck. Exact external-tangent construction, so a taper never kinks.
 */
export function taper(x0: number, x1: number, r0: number, r1: number): string {
  const d = Math.max(0.01, x1 - x0);
  const s = Math.max(-0.98, Math.min(0.98, (r0 - r1) / d));
  const c = Math.sqrt(1 - s * s);
  const large0 = s > 0 ? 1 : 0;
  const large1 = s > 0 ? 0 : 1;
  return (
    `M${f(x0 + r0 * s)} ${f(-r0 * c)}L${f(x1 + r1 * s)} ${f(-r1 * c)}` +
    `A${f(r1)} ${f(r1)} 0 ${large1} 1 ${f(x1 + r1 * s)} ${f(r1 * c)}` +
    `L${f(x0 + r0 * s)} ${f(r0 * c)}` +
    `A${f(r0)} ${f(r0)} 0 ${large0} 1 ${f(x0 + r0 * s)} ${f(-r0 * c)}Z`
  );
}

/**
 * Scale a path made only of absolute x,y pairs (M, L, C, Z) by `k`, then drop it
 * `dy` — how a hand-authored outline is cut to a new size.
 */
export function scalePath(d: string, k: number, dy = 0, ky = k): string {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => (i++ % 2 === 1 ? f(Number(m) * ky + dy) : f(Number(m) * k)));
}

/**
 * A bar with FLAT ends and softened corners, along +x from x0 to x1: half-width
 * r0 at the start, r1 at the end — a sleeve, a leg of shorts, anything hemmed.
 */
export function hemmed(x0: number, x1: number, r0: number, r1: number, c = 1.2): string {
  return slab(x0, x1, r0, r0, r1, r1, c);
}

/**
 * `hemmed` with its two sides set separately: `back0`/`back1` is how far it
 * reaches to −y at the start/end, `front0`/`front1` to +y. A torso seen
 * side-on — a back and a belly that are not the same distance from the spine.
 */
export function slab(
  x0: number,
  x1: number,
  back0: number,
  front0: number,
  back1: number,
  front1: number,
  c = 1.2,
): string {
  const k = (r: number) => Math.min(c, r, (x1 - x0) / 2);
  const [b0, b1, f0, f1] = [k(back0), k(back1), k(front0), k(front1)];
  return (
    `M${f(x0)} ${f(-back0 + b0)}Q${f(x0)} ${f(-back0)} ${f(x0 + b0)} ${f(-back0)}` +
    `L${f(x1 - b1)} ${f(-back1)}Q${f(x1)} ${f(-back1)} ${f(x1)} ${f(-back1 + b1)}` +
    `L${f(x1)} ${f(front1 - f1)}Q${f(x1)} ${f(front1)} ${f(x1 - f1)} ${f(front1)}` +
    `L${f(x0 + f0)} ${f(front0)}Q${f(x0)} ${f(front0)} ${f(x0)} ${f(front0 - f0)}Z`
  );
}

/* ───────────────────────────────── Parts ─────────────────────────────────── */

/**
 * Limb measurements, in box units — radii (half-widths), not widths. The
 * standing figure is about 84 units tall, so an upper arm is ~6% of the height
 * across and a thigh ~10%: a fit person's, not a cartoon's.
 */
const ARM = {
  /** Deltoid → just above the elbow. */
  upper: [2.55, 2.05] as const,
  /** The biceps' belly, under the sleeve's hem. */
  belly: 2.3,
  /** Below the elbow → the wrist, and the forearm's belly near the elbow. */
  fore: [2.15, 1.45] as const,
  foreBelly: 2.3,
  /** The short sleeve: just proud of the arm, so it reads as cloth. */
  sleeve: [3.05, 2.75] as const,
  sleeveEnd: 0.46,
  cuff: 0.7,
  /** The hand: a small mitt, about a forearm's width. */
  hand: [2.0, 1.45] as const,
  thumb: 0.75,
  /** The hairline outline on a sleeve and a hand. */
  rim: 0.32,
};
const LEG = {
  /** Hip → just above the knee. */
  thigh: [4.0, 2.65] as const,
  /** Below the knee → the ankle, and the calf's belly behind it. */
  shin: [2.4, 1.4] as const,
  calf: 2.7,
  shorts: [4.75, 4.35] as const,
  shortsEnd: 0.5,
  hem: 0.75,
};

/** How far under the ankle the trainer's sole lies, in box units — the floor. */
export const SOLE_BELOW = 3.8;
/** The side-on trainer, cut down from its 1:1 outline to the size of a foot… */
const SHOE_SCALE = 0.68;
/** …and to a running shoe's height. */
const SHOE_HEIGHT = 0.54;

/** Which way a hand's thumb points, in the forearm's frame: toward the body. */
function thumbSide(boneName: string, view: FigureView): 1 | -1 {
  if (view === "side") return -1;
  return /L$/.test(boneName) ? -1 : 1;
}

/** A bone's art in two layers: what sits behind the head, and what sits in front. */
interface Layered {
  behind: Shape[];
  front: Shape[];
}

/**
 * The upper arm: the skin with its biceps, and the tee's short sleeve over the
 * top of it.
 *
 * THE SLEEVE AND THE SHOULDER ARE ONE PATH (`disc ∪ hemmed`, both clockwise, so
 * they union): a round shoulder and a hemmed cuff with no join for anything to
 * be drawn into — two separate pieces once read as a torn seam. A hairline rim
 * a shade down runs round it, because a teal sleeve lying over a teal tee (the
 * whole near arm, side-on) is otherwise invisible.
 */
function upperArm(L: number, far: boolean, wholeBehind: boolean): Layered {
  const skin = far ? KIT.skinShade : KIT.skin;
  const sleeve = far ? KIT.teeShade : KIT.tee;
  const edge = far ? KIT.teeDeep : KIT.teeShade;
  const e = ARM.sleeveEnd * L;
  const [s0, s1] = ARM.sleeve;
  const g = ARM.rim;
  // FRONT-ON THE SLEEVE HAS NO RIM ROUND ITS CROWN. There the arm hangs beside
  // the body, never across it, and a dark ring round the top of the shoulder
  // stood the crown up off the tee like a shoulder pad. Without it the sleeve
  // runs on from the tee's shoulder as one piece of cloth, the way a tee does;
  // the cuff keeps its band. Side-on, the near arm lies over the tee, and the
  // rim is the only thing that keeps a teal sleeve visible on a teal chest.
  const rim: Shape[] = wholeBehind
    ? []
    : [{ d: disc(0, 0, s0 + g) + hemmed(0, e + g, s0 + g, s1 + g, 1.1), fill: edge }];
  const body: Shape[] = [
    { d: taper(0, L, ARM.upper[0], ARM.upper[1]) + oval(0.6 * L, 0, 0.28 * L, ARM.belly), fill: skin },
    ...rim,
    { d: disc(0, 0, s0) + hemmed(0, e, s0, s1, 1.1), fill: sleeve },
    { d: hemmed(e - ARM.cuff, e, s1, s1, 0.35), fill: edge, fine: true },
  ];
  // From the front an upper arm passes BESIDE the head, never across the face,
  // so all of it can sit behind the head (only the forearm and hand come in
  // front). From the side the near arm really is in front of the head, so there
  // the whole arm is drawn in front — the shoulder rides with it, so the head
  // can never be drawn into the middle of the sleeve.
  return wholeBehind ? { behind: body, front: [] } : { behind: [], front: body };
}

/** A forearm, wrist to elbow. The hand is a bone of its own, on the wrist. */
function foreArm(L: number, far: boolean): Shape[] {
  return [
    {
      d: taper(0, L, ARM.fore[0], ARM.fore[1]) + oval(0.3 * L, 0, 0.3 * L, ARM.foreBelly),
      fill: far ? KIT.skinShade : KIT.skin,
    },
  ];
}

/**
 * The hand, in its own bone's frame: origin at the wrist, fingers along +x. An
 * egg a touch longer than it is wide, the thumb tucked against the palm on the
 * inside, and rimmed so a hand in front of a face or a tee stays a hand.
 */
function hand(far: boolean, side: 1 | -1): Shape[] {
  const [along, across] = ARM.hand;
  const mitt = (grow: number): string =>
    oval(HAND_CENTRE, 0, along + grow, across + grow) +
    disc(0.2, side * (across - 0.25), ARM.thumb + grow);
  return [
    { d: mitt(ARM.rim), fill: far ? KIT.skinDeep : KIT.skinShade },
    { d: mitt(0), fill: far ? KIT.skinShade : KIT.skin },
  ];
}

/** How far the hand's egg sits past the wrist, along the fingers. */
const HAND_CENTRE = 1.2;
/** From the wrist to the fingertips, box units — the hand bone's length. */
export const HAND_LENGTH = HAND_CENTRE + ARM.hand[0];

/**
 * How far below the wrist the hand reaches with its bone at `angle`: fingers
 * down, the fingertips; flat, the palm. What the framing lays a hand on the
 * floor with, and how low a planted wrist has to sit.
 */
export function handDepth(angle: number): number {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const [along, across] = ARM.hand;
  return HAND_CENTRE * s + Math.hypot(along * s, across * c) + ARM.rim;
}

/**
 * A thigh with the shorts' leg over its top.
 *
 * THE SHORTS' LEG STARTS WITH A ROUND SEAT (`disc ∪ hemmed`, one clockwise
 * path, like the sleeve). It used to start just behind the hip joint with a
 * square end, which left the round top of the thigh bare: front-on it showed as
 * a hump of skin between the tee and the shorts at each hip, and side-on the
 * far thigh — set back behind the body — stuck out as a bare bulge behind the
 * seat of the shorts. Now the cloth covers the whole top of the leg at every
 * angle the hip can take, and the far one reads as the far side of the shorts.
 */
function thigh(L: number, far: boolean): Shape[] {
  const skin = far ? KIT.skinShade : KIT.skin;
  const sh = far ? KIT.shortsShade : KIT.shorts;
  const hem = far ? KIT.shortsDeep : KIT.shortsShade;
  const e = LEG.shortsEnd * L;
  const [r0, r1] = LEG.shorts;
  return [
    { d: taper(0, L, LEG.thigh[0], LEG.thigh[1]), fill: skin },
    { d: disc(0, 0, r0) + hemmed(0, e, r0, r1, 1.4), fill: sh },
    { d: hemmed(e - LEG.hem, e, r1, r1, 0.4), fill: hem, fine: true },
  ];
}

/**
 * A shin, its calf, and a crew sock over its lower half — the trainer's
 * partner. Side-on the calf sits behind the shin bone (+y); front-on it bulges
 * evenly, as a lower leg does seen from in front.
 */
function shin(L: number, far: boolean, view: FigureView): Shape[] {
  const x0 = L * 0.7;
  const r = (x: number) => LEG.shin[0] + (LEG.shin[1] - LEG.shin[0]) * (x / L);
  const calfY = view === "side" ? 0.5 : 0;
  return [
    {
      d: taper(0, L, LEG.shin[0], LEG.shin[1]) + oval(0.3 * L, calfY, 0.27 * L, LEG.calf),
      fill: far ? KIT.skinShade : KIT.skin,
    },
    { d: hemmed(x0, L + 0.5, r(x0) + 0.35, r(L) + 0.35, 0.8), fill: far ? KIT.soleShade : KIT.sole },
    // The sock's ribbed top, in the trainers' coral.
    {
      d: hemmed(x0, x0 + 0.9, r(x0) + 0.4, r(x0) + 0.4, 0.3),
      fill: far ? KIT.shoeShade : KIT.shoe,
      fine: true,
    },
  ];
}

/**
 * The side view's trainer, in the foot bone's frame: origin at the ankle, toe
 * along +x, sole toward +y — heel behind, toe in front, a toe cap and two laces.
 * Standing, the foot bone is level and this is a shoe flat on the floor; the
 * rig turns it with the ankle everywhere else (rig.ts "The side feet").
 */
function sideShoe(far: boolean): Shape[] {
  const body = far ? KIT.shoeShade : KIT.shoe;
  const cap = far ? KIT.shoeDeep : KIT.shoeLight;
  const sole = far ? KIT.soleShade : KIT.sole;
  // Authored at 1:1, then cut to a foot's length — and lower than it is long,
  // a running shoe rather than a high-top — and dropped so the sole's underside
  // lands on the same line as the front-on trainer's.
  const k = SHOE_SCALE;
  const ky = SHOE_HEIGHT;
  const dy = SOLE_BELOW - 5.4 * ky;
  return [
    {
      d: scalePath(
        "M-5.8 -0.8C-5.8 -4.6 -3.8 -6 -1 -6L2.4 -6C4.2 -6 5.4 -4 8 -2.8C11 -1.6 12.6 0 12.6 2L12.6 4L-5.8 4Z",
        k,
        dy,
        ky,
      ),
      fill: body,
    },
    // Toe cap: the rubber bumper over the front.
    {
      d: scalePath("M7 -2.8C9.2 -1.9 10.4 -0.6 10.4 0.8L10.4 4L6 4C6.2 1.2 6.4 -1 7 -2.8Z", k, dy, ky),
      fill: cap,
      fine: true,
    },
    // Sole.
    { d: rrect(-6.2 * k, 2.6 * ky + dy, 13.1 * k, 5.4 * ky + dy, 1.5 * ky), fill: sole },
    // Laces.
    { d: rrect(0.2 * k, -4 * ky + dy, 4.4 * k, -2.9 * ky + dy, 0.5 * ky), fill: sole, fine: true },
    { d: rrect(1.7 * k, -2 * ky + dy, 5.6 * k, -0.9 * ky + dy, 0.5 * ky), fill: sole, fine: true },
  ];
}

/**
 * The side trainer's bounding box in the foot bone's frame (x0/x1 heel → toe,
 * y0/y1 laces → sole), from the numbers `sideShoe` draws with.
 */
const SIDE_SHOE_BOX = {
  x0: -6.2 * SHOE_SCALE,
  x1: 13.1 * SHOE_SCALE,
  y0: -6 * SHOE_HEIGHT + (SOLE_BELOW - 5.4 * SHOE_HEIGHT),
  y1: SOLE_BELOW,
} as const;

/**
 * How far below the ankle the side trainer reaches, box units, with the foot
 * bone at `angle` — flat, that is the sole; kneeling with the sole up, the
 * laces; on the toes, the toe. `facing` −1 is the turned-over art of a pose
 * that faces −x. What the framing stands the figure on.
 */
export function sideShoeDepth(angle: number, facing: number): number {
  const s = Math.sin(angle);
  const c = Math.cos(angle) * (facing < 0 ? -1 : 1);
  let low = -Infinity;
  for (const x of [SIDE_SHOE_BOX.x0, SIDE_SHOE_BOX.x1]) {
    for (const y of [SIDE_SHOE_BOX.y0, SIDE_SHOE_BOX.y1]) low = Math.max(low, x * s + y * c);
  }
  return low;
}

/**
 * The steepest the side trainer can tip toe-down (radians) and still have its
 * toe clear a floor `clearance` further below than a flat sole would sit — how
 * high the heel of a foot on its toes can come up, given where the ankle is.
 * 0 when the ankle is at standing height; the full tip once it is a foot's
 * length up.
 */
export function sideShoeToeRoom(clearance: number): number {
  const reach = Math.hypot(SIDE_SHOE_BOX.x1, SIDE_SHOE_BOX.y1);
  const base = Math.atan2(SIDE_SHOE_BOX.y1, SIDE_SHOE_BOX.x1);
  const s = (Math.max(0, clearance) + SIDE_SHOE_BOX.y1) / reach;
  return s >= 1 ? Math.PI / 2 - base : Math.max(0, Math.asin(s) - base);
}

/** A kneeling knee rests on the floor this far under its joint — the shin's radius there. */
export const KNEE_BELOW = LEG.shin[0];

/**
 * How far the front view's trainer turns with its shin, radians, given the
 * shin's angle. A leg within 45° of hanging straight down stands on a level
 * shoe (a squat, a jumping jack); a leg lying along the floor or raised in the
 * air — a snow angel, a side plank, a windshield wiper, seen from in front or
 * above — carries the shoe on the end of it, its top toward the knee. In
 * between it blends, so a leg swinging up never snaps its foot round.
 * A worklet: the Skia panel calls it every frame.
 */
export function frontShoeTurn(shinAngle: number): number {
  "worklet";
  let dev = shinAngle - Math.PI / 2;
  while (dev > Math.PI) dev -= Math.PI * 2;
  while (dev < -Math.PI) dev += Math.PI * 2;
  const from = Math.PI / 4;
  const span = (25 * Math.PI) / 180;
  let w = (Math.abs(dev) - from) / span;
  w = w < 0 ? 0 : w > 1 ? 1 : w;
  return dev * w * w * (3 - 2 * w);
}

/** The front view's trainer, in screen orientation, centred under the ankle. */
function frontShoe(): Shape[] {
  return [
    { d: rrect(-2.8, -1.4, 2.8, 3.0, 1.7), fill: KIT.shoe },
    // Toe cap and the sole.
    { d: oval(0, 1.5, 1.8, 1.0), fill: KIT.shoeLight, fine: true },
    { d: rrect(-3.0, 2.5, 3.0, SOLE_BELOW, 0.6), fill: KIT.sole },
    // The laces' pad up the front of the foot.
    { d: rrect(-1.0, -1.0, 1.0, 0.3, 0.35), fill: KIT.sole, fine: true },
  ];
}

/* ── Torso ──────────────────────────────────────────────────────────────────
 * The tee is two pieces, one per spine bone, drawn to overlap and share a
 * colour so a straight torso is one clean shape and a bent one folds at the
 * waist. The shorts' block rides the lower spine (the pelvis).
 */

function frontLowerSpine(L: number): Shape[] {
  return [
    // Shorts over the hips, running down into the legs.
    { d: rrect(-4.8, -9.2, 4.4, 9.2, 3.8), fill: KIT.shorts },
    // The waistband, in the shadow of the tee's hem…
    { d: rrect(2.6, -8.6, 4.4, 8.6, 0.6), fill: KIT.shortsShade, fine: true },
    // …and the tee itself, from the waist up to the ribs.
    { d: hemmed(3.6, L + 2, 7.9, 8.6, 1.4), fill: KIT.tee },
  ];
}

/**
 * The chest, the shoulders' slope and the base of the neck. The shoulder seam
 * runs out to where the sleeve's crown is, so a sleeve meets the tee flush
 * instead of standing proud of it like a pad.
 */
function frontUpperSpine(L: number): Shape[] {
  const t = L + 2.6;
  return [
    {
      d:
        `M-2 -8.4L${f(L - 4)} -9.6Q${f(L - 0.4)} -10.2 ${f(L + 1.9)} -8.6` +
        `L${f(t)} -3.6Q${f(t + 0.4)} 0 ${f(t)} 3.6` +
        `L${f(L + 1.9)} 8.6Q${f(L - 0.4)} 10.2 ${f(L - 4)} 9.6L-2 8.4Z`,
      fill: KIT.tee,
    },
  ];
}

/** Side-on, −y is the back and +y the front: glutes behind, a belly in front. */
function sideLowerSpine(L: number): Shape[] {
  return [
    { d: slab(-4.8, 4.4, 6.3, 4.9, 5.2, 4.7, 3.2), fill: KIT.shorts },
    { d: slab(2.6, 4.4, 5.1, 4.6, 5.1, 4.6, 0.5), fill: KIT.shortsShade, fine: true },
    { d: slab(3.6, L + 2, 4.8, 4.6, 5.3, 5.2, 1.4), fill: KIT.tee },
  ];
}

/** Side-on: the upper back, the chest in front of it, the slope up to the neck. */
function sideUpperSpine(L: number): Shape[] {
  const t = L + 2.3;
  return [
    {
      d:
        `M-2 -4.9L${f(L - 3.5)} -5.5Q${f(L + 0.4)} -5.7 ${f(t)} -3L${f(t + 0.1)} 1.6` +
        `Q${f(L + 1)} 6 ${f(L - 3.2)} 6.1Q${f(L - 6.5)} 6.1 ${f(L - 8)} 5.3L-2 4.8Z`,
      fill: KIT.tee,
    },
  ];
}

/**
 * The neck, coming up out of the tee's crew collar — a band a shade deeper
 * than the tee, laid OVER the base of the neck. The neck is in the shadow the
 * chin casts.
 *
 * It used to be the other way round: the neck drawn over the collar, starting
 * at the shoulder line, so its lower half lay on the front of the tee as a
 * brown tab — front-on it read as a bib hanging from the chin. Now the neck
 * starts under the collar and only shows above it.
 */
const NECK_BASE = 1.8;
function neck(L: number): Shape[] {
  const top = Math.max(NECK_BASE + 1, L * 0.8);
  return [
    { d: taper(NECK_BASE, top, 2.1, 1.95), fill: KIT.skinShade },
    { d: oval(NECK_BASE + 0.6, 0, 0.95, 3.0), fill: KIT.teeShade },
  ];
}

/* ───────────────────────────────── The head ──────────────────────────────── */

export interface HeadArt {
  /** Behind the skull — the ears of a front-on head. */
  back: Shape[];
  /** The skull (and, side-on, the ear on it). */
  skull: Shape[];
  /**
   * The face: the eyes and the one closed mouth, drawn over the skull and under
   * the hair. A FLAT, FIXED set of shapes — there is nothing here to drive. The
   * eyes stay because without them a head has no front, and the mouth because
   * a head with eyes and no mouth reads as a mask.
   */
  face: Shape[];
  /** Over the skull — the hair, cropped close. */
  front: Shape[];
  /** Furthest the art reaches from the centre, in head radii (framing). */
  reach: { up: number; down: number; side: number };
}

/** One eye: a flat dark oval. It states where the face points; nothing more. */
function eye(cx: number, cy: number, rx: number, ry: number): Shape {
  return { d: oval(cx, cy, rx, ry), fill: KIT.pupil };
}

/** The resting mouth: one short closed line, drawn the same in every frame. */
function mouth(x0: number, x1: number, y: number, dip: number): Shape {
  const cx = (x0 + x1) / 2;
  return {
    d: `M${f(x0)} ${f(y)}Q${f(cx)} ${f(y + dip)} ${f(x1)} ${f(y)}`,
    stroke: { color: KIT.mouth, width: 0.055 },
  };
}

/** Front-on: an oval face a little narrower than it is tall. */
function frontHead(): HeadArt {
  return {
    back: [
      { d: disc(-0.79, 0.06, 0.17), fill: KIT.skinShade },
      { d: disc(0.79, 0.06, 0.17), fill: KIT.skinShade },
    ],
    skull: [
      {
        d: "M-0.8 -0.06C-0.8 -0.62 -0.44 -1 0 -1C0.44 -1 0.8 -0.62 0.8 -0.06C0.8 0.42 0.52 0.86 0 1C-0.52 0.86 -0.8 0.42 -0.8 -0.06Z",
        fill: KIT.skin,
      },
    ],
    face: [eye(-0.29, 0.08, 0.075, 0.1), eye(0.29, 0.08, 0.075, 0.1), mouth(-0.14, 0.14, 0.56, 0.06)],
    front: [
      // Short hair: a close cap over the crown, down to the temples.
      {
        d:
          "M-0.86 0.02C-0.9 -0.66 -0.48 -1.12 0 -1.12C0.48 -1.12 0.9 -0.66 0.86 0.02" +
          "C0.8 -0.16 0.76 -0.3 0.68 -0.4C0.46 -0.54 0.22 -0.5 0 -0.52" +
          "C-0.22 -0.5 -0.46 -0.54 -0.68 -0.4C-0.76 -0.3 -0.8 -0.16 -0.86 0.02Z",
        fill: KIT.hair,
      },
      { d: "M-0.38 -0.94C-0.2 -1.03 0.04 -1.05 0.22 -1", stroke: { color: KIT.hairLight, width: 0.07 }, fine: true },
    ],
    reach: { up: 1.12, down: 1, side: 0.96 },
  };
}

/** Side-on, facing +x: the back of the skull, a brow, a nose, lips and a chin. */
function sideHead(): HeadArt {
  return {
    back: [],
    skull: [
      {
        d:
          "M-0.92 -0.04C-0.92 -0.64 -0.52 -1 0.04 -1C0.54 -1 0.8 -0.68 0.8 -0.3L0.8 -0.14" +
          "C0.84 -0.04 0.93 0.1 0.95 0.2C0.96 0.27 0.9 0.31 0.84 0.32" +
          "C0.86 0.4 0.86 0.48 0.81 0.54C0.84 0.64 0.8 0.82 0.62 0.92" +
          "C0.46 1 0.22 0.98 0.06 0.86C-0.18 0.72 -0.34 0.74 -0.6 0.62" +
          "C-0.84 0.48 -0.92 0.26 -0.92 -0.04Z",
        fill: KIT.skin,
      },
      // The ear: a shaded disc with the lit ear inside it.
      { d: disc(-0.08, 0.1, 0.17), fill: KIT.skinShade },
      { d: disc(-0.06, 0.1, 0.1), fill: KIT.skin, fine: true },
    ],
    face: [eye(0.56, 0.02, 0.06, 0.1), mouth(0.7, 0.81, 0.56, 0.05)],
    front: [
      {
        d:
          "M-0.97 0.26C-1.04 -0.52 -0.6 -1.12 0.04 -1.12C0.58 -1.12 0.9 -0.78 0.88 -0.38" +
          "C0.66 -0.48 0.44 -0.46 0.26 -0.34C0.14 -0.24 0.12 -0.04 0.14 0.12L0.04 0.14" +
          "C0 -0.06 -0.16 -0.14 -0.3 -0.1C-0.44 -0.04 -0.48 0.24 -0.58 0.5" +
          "C-0.74 0.52 -0.9 0.44 -0.97 0.26Z",
        fill: KIT.hair,
      },
      { d: "M-0.42 -0.9C-0.22 -1.02 0.08 -1.04 0.3 -0.98", stroke: { color: KIT.hairLight, width: 0.07 }, fine: true },
    ],
    reach: { up: 1.12, down: 1, side: 1 },
  };
}

/* ─────────────────────────────── Assembly ────────────────────────────────── */

/** True for the bones that sit on the far side of a side view. */
export function isFarBone(boneName: string): boolean {
  return boneName.startsWith("far");
}

export interface CharacterArt {
  /** Shapes per rig bone, in the bone's frame. Empty = nothing is drawn. */
  bones: Shape[][];
  /**
   * Shapes that ride a bone but are drawn BEHIND the head — a shoulder's cap.
   * Same frame as `bones`; empty for every bone but the upper arms.
   */
  behind: Shape[][];
  /** Draw order, back to front. */
  layers: {
    far: number[];
    legs: number[];
    torso: number[];
    /** The shoulders' caps: over the torso, under the head. */
    caps: number[];
    collar: number[];
    arms: number[];
  };
  /** Front view only: a level trainer under each shin. */
  shoes: { bone: number; shapes: Shape[] }[];
  head: HeadArt;
  /** The front trainer's centre sits this far under the ankle, outward by `out`. */
  shoeDrop: number;
  shoeOut: number;
  /** Which level of detail this is — the renderer skips its own fine work to match. */
  detail: ArtDetail;
}

/** A head without its fine decoration. The face stays: it is what says "head". */
function thinHead(h: HeadArt): HeadArt {
  const thin = (shapes: Shape[]) => shapes.filter((s) => !s.fine);
  return {
    ...h,
    back: thin(h.back),
    skull: thin(h.skull),
    front: thin(h.front),
  };
}

/**
 * Dress a rig. Pure and cheap — called once per (rig, view), never per frame.
 * `thumb` leaves out the decoration nobody can see at list-row size.
 */
export function buildCharacterArt(
  rig: Rig,
  view: FigureView,
  detail: ArtDetail = "full",
): CharacterArt {
  const names = rig.bones.map((b) => b.name);
  const keep = (shapes: Shape[]): Shape[] =>
    detail === "thumb" ? shapes.filter((s) => !s.fine) : shapes;
  const behind: Shape[][] = rig.bones.map(() => []);
  const bones: Shape[][] = rig.bones.map((b, i) => {
    const L = b.length;
    const far = isFarBone(b.name);
    const n = b.name;
    if (n === "lowerSpine") return keep(view === "front" ? frontLowerSpine(L) : sideLowerSpine(L));
    if (n === "upperSpine") return keep(view === "front" ? frontUpperSpine(L) : sideUpperSpine(L));
    if (n === "neck") return keep(neck(L));
    if (/^(upArm|farUpArm)/.test(n)) {
      const arm = upperArm(L, far, view === "front");
      behind[i] = keep(arm.behind);
      return keep(arm.front);
    }
    if (/^(foreArm|farForeArm)/.test(n)) return keep(foreArm(L, far));
    if (/^(hand|farHand)/.test(n)) return keep(hand(far, thumbSide(n, view)));
    if (/^(thigh|farThigh)/.test(n)) return keep(thigh(L, far));
    if (/^(shin|farShin)/.test(n)) return keep(shin(L, far, view));
    if (/^(foot|farFoot)/.test(n)) return keep(sideShoe(far));
    return [];
  });
  const pick = (re: RegExp, from: Shape[][] = bones): number[] =>
    names.flatMap((n, i) => (re.test(n) && from[i].length > 0 ? [i] : []));
  const head = view === "side" ? sideHead() : frontHead();
  return {
    detail,
    bones,
    behind,
    layers: {
      far: view === "side" ? [...pick(/^far(Thigh|Shin|Foot)/), ...pick(/^far(UpArm|ForeArm|Hand)/)] : [],
      legs: pick(/^(thigh|shin|foot)/),
      torso: pick(/Spine$/),
      caps: pick(/^upArm/, behind),
      collar: pick(/^neck$/),
      arms: pick(/^(upArm|foreArm|hand)/),
    },
    shoes:
      view === "front" ? pick(/^shin/).map((bone) => ({ bone, shapes: keep(frontShoe()) })) : [],
    head: detail === "thumb" ? thinHead(head) : head,
    // Centred under the ankle, turned out a touch the way feet stand.
    shoeDrop: 0,
    shoeOut: 0.8,
  };
}

/**
 * Poses whose authored side view faces −x (animation/facing.ts): the face is
 * mirrored, and the renderers turn every side bone's art over to match.
 * Everything else turns its face along the neck's normal.
 *   cobra / yRaise — lying FACE DOWN, but authored with the head on the left.
 *   invertedRow    — hanging FACE UP under the bar, head on the right.
 */
export function faceMirrored(motion: FigureMotion, view: FigureView): boolean {
  return view === "side" && sideFacing(motion) < 0;
}
