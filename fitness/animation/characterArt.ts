/**
 * CHARACTER ART — the drawing of the athlete, as plain data.
 *
 * Both renderers (the animated Skia panel and the SVG still) draw from this one
 * module, so the character in a list thumbnail and the one in the live player
 * are the same person drawn in the same order. Nothing here knows about React,
 * Skia or Reanimated: every part is an SVG path string with a fill, expressed in
 * the rig's own 0–100 box units, in the frame of the bone it rides.
 *
 * ── HOW IT IS BUILT (the Duolingo method, not the Duolingo character) ─────────
 *
 *   · FEW SHAPES, ALL ROUND. Circles, rounded rectangles and soft tapers — no
 *     points, no outlines. A limb is a tapered rounded bar, a hand a mitt, a head
 *     a squircle, the hair a cloud of circles.
 *   · SILHOUETTE FIRST. The curly hair, the chunky trainers and the fat mitts are
 *     exaggerated on purpose; they are what you read at 60pt.
 *   · COLOUR BLOCKS, SEPARATED. Skin / tee / shorts / trainers never share a hue
 *     next to each other, so a pose reads as a flat silhouette.
 *   · A RIG, NOT A PICTURE. Every limb is a part parented to a bone.
 *
 * ── THIS FIGURE DEMONSTRATES; IT DOES NOT PERFORM ────────────────────────────
 *
 * Its whole job is to show a movement clearly — which way an arm travels, how
 * far the knee bends, where the torso is square and where it twists. Everything
 * that competes with that is gone:
 *
 *   · NO ACTING FACE. The face is two eyes and a closed mouth, drawn once and
 *     never animated. There were blinks, glances, brows, four swapping mouths
 *     and a lolling tongue; all of it pulled the eye to the head at exactly the
 *     moment the limbs were doing the thing worth watching. The eyes stay only
 *     because they say which way the body faces.
 *   · HUMAN PROPORTIONS. The head is a head, not a balloon (see HEAD_SCALE), so
 *     the arms and legs get the share of the silhouette they need to read.
 *   · CLOTHING THAT READS AS CLOTHING. The sleeve is one shape with the shoulder
 *     it sits on, hemmed in a deeper shade of its own colour — not a pale sliver
 *     over bare skin, which at demo size looked like a torn seam.
 *
 * Bone frame: origin at the bone's start, +x along the bone to its tip, +y across
 * it (the bone's right-hand side). Head frame: radius 1 at the head's centre,
 * "up" is −y (toward the crown along the neck), the front of the face is +x.
 */
import type { FigureMotion } from "./movementProfiles";
import type { Rig } from "./rig";

export type FigureView = "front" | "side";

/** Which figure demonstrates: the character, or the original flat pictogram. */
export type FigureLook = "character" | "pictogram";

/* ───────────────────────────────── Palette ───────────────────────────────── */

/**
 * Fixed hexes, like the flame and the badge metals: the athlete wears the same
 * kit in either theme. Each colour is a BLOCK with a shade one step down for the
 * hems and the cast shadows — the single flat shadow an illustrator gives a
 * character instead of a gradient.
 */
export const KIT = {
  skin: "#C98B5F",
  skinShade: "#A8693F",
  skinDeep: "#8C5230",
  blush: "#F0846C",
  hair: "#2A1F1F",
  hairLight: "#5A4743",
  tee: "#17B8A3",
  /** The ringer trim on the cuffs and the collar. */
  teeTrim: "#D9F8F1",
  teeTrimShade: "#9FDDD0",
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
 * The head, relative to the rig's own head radius.
 *
 * It used to be 1.75 — a deliberately huge character head, on the theory that a
 * character is read by its face. For a figure whose entire purpose is to
 * demonstrate a movement that was backwards: the head took better than a third
 * of the figure's height, so the arms came to a quarter of it and the legs to
 * well under half, and the whole athlete read as stubby. Worse, a head that big
 * sits ON the shoulders and cut across the sleeves, which is what made the kit
 * look torn.
 *
 * At 1.05 the head is about a quarter of the standing height — still stylised,
 * still friendly at 60pt, but the limbs now carry the silhouette. Measured in
 * `fitness/__tests__/characterArt.test.ts`.
 */
export const HEAD_SCALE = 1.05;

/** One drawn shape. `d` is an SVG path in its frame; fills are flat. */
export interface Shape {
  d: string;
  fill?: string;
  opacity?: number;
  /** A stroked line instead of (or as well as) a fill. */
  stroke?: { color: string; width: number };
  /**
   * Decoration that is invisible below ~100px — a cuff, a lace, a toe cap, a
   * cheek, a catch-light. A list thumbnail skips it: dozens of rows are mounted
   * at once on a 1 GB phone, and a node nobody can see is still a node.
   */
  fine?: boolean;
}

/** Full detail for the live player and the detail screens; `thumb` for list rows. */
export type ArtDetail = "full" | "thumb";

/* ─────────────────────────── Path vocabulary ─────────────────────────────── */

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/*
 * EVERY SHAPE WINDS CLOCKWISE (sweep 1, in screen space). Several of these are
 * concatenated into one path — a mitt and its thumb, a cloud of curls — and the
 * default fill rule cancels the overlap of two opposite windings into a hole.
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
 * sleeve, a sausage. Exact external-tangent construction, so a taper never kinks.
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
 * `dy` — how a hand-authored outline is built up to a new size.
 */
export function scalePath(d: string, k: number, dy = 0): string {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => f(Number(m) * k + (i++ % 2 === 1 ? dy : 0)));
}

/**
 * A bar with FLAT ends and softened corners, along +x from x0 to x1: half-width
 * r0 at the start, r1 at the end — a sleeve, a leg of shorts, anything hemmed.
 */
export function hemmed(x0: number, x1: number, r0: number, r1: number, c = 1.2): string {
  const k0 = Math.min(c, r0);
  const k1 = Math.min(c, r1);
  return (
    `M${f(x0)} ${f(-r0 + k0)}Q${f(x0)} ${f(-r0)} ${f(x0 + k0)} ${f(-r0)}` +
    `L${f(x1 - k1)} ${f(-r1)}Q${f(x1)} ${f(-r1)} ${f(x1)} ${f(-r1 + k1)}` +
    `L${f(x1)} ${f(r1 - k1)}Q${f(x1)} ${f(r1)} ${f(x1 - k1)} ${f(r1)}` +
    `L${f(x0 + k0)} ${f(r0)}Q${f(x0)} ${f(r0)} ${f(x0)} ${f(r0 - k0)}Z`
  );
}

/* ───────────────────────────────── Parts ─────────────────────────────────── */

/**
 * Limb measurements, in box units — radii, not widths. Chunky on purpose: the
 * bones are the rig's (arms 25 long, legs 36), so the build is what makes a body
 * stout rather than lanky, and a thin limb disappears at thumbnail size long
 * before a thick one does.
 */
const ARM = {
  upper: [5.5, 4.8] as const,
  fore: [4.7, 3.9] as const,
  /**
   * The sleeve is only just proud of the arm inside it. It used to be a tube
   * half again as wide as the limb, which read as a shoulder pad rather than a
   * t-shirt and left a wide step down to bare skin at the hem.
   */
  sleeve: [5.9, 5.2] as const,
  sleeveEnd: 0.46,
  cuff: 1.3,
  hand: [5.3, 4.8] as const,
  thumb: 2.2,
  rim: 0.85,
};
const LEG = {
  thigh: [6.2, 5.1] as const,
  shin: [5.1, 4.2] as const,
  shorts: [7.6, 8.1] as const,
  shortsEnd: 0.64,
  hem: 1.4,
};

/** How far under the ankle the trainer's sole lies, in box units — the floor. */
export const SOLE_BELOW = 5.9;
/** The side-on trainer, built up from its 1:1 outline. */
const SHOE_SCALE = 1.2;

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
 * The upper arm: the skin bar with the tee's short sleeve over its top.
 *
 * THE SLEEVE AND THE SHOULDER ARE ONE PATH. They used to be two: a cap disc
 * drawn behind the head, and a sleeve with a FLAT cut across its top drawn in
 * front of it. Anything that landed between those two layers — and with the old
 * head size that was the head itself, every time an arm came up — showed as a
 * straight slice through the shoulder with bare skin under it. It read exactly
 * like a torn seam, which is what it was. `disc ∪ hemmed` (both wound clockwise,
 * so they union) gives one shape with a round shoulder and a hemmed cuff, and
 * nothing can be drawn into the join because there is no join.
 *
 * The cuff is a DEEPER shade of the tee, not the near-white ringer trim it was.
 * At demo size a pale sliver between a mid-teal sleeve and bare skin was the
 * other half of the ripped look; a darker hem says "the sleeve stops here"
 * without ever reading as a hole.
 */
function upperArm(L: number, far: boolean, wholeBehind: boolean): Layered {
  const skin = far ? KIT.skinShade : KIT.skin;
  const sleeve = far ? KIT.teeShade : KIT.tee;
  const cuff = far ? KIT.teeDeep : KIT.teeShade;
  const e = ARM.sleeveEnd * L;
  const [s0, s1] = ARM.sleeve;
  const body: Shape[] = [
    { d: taper(0, L, ARM.upper[0], ARM.upper[1]), fill: skin },
    { d: disc(0, 0, s0) + hemmed(0, e, s0, s1, 1.6), fill: sleeve },
    { d: hemmed(e - ARM.cuff, e, s1, s1, 0.5), fill: cuff, fine: true },
  ];
  // From the front an upper arm passes BESIDE the head, never across the face,
  // so all of it can sit behind the head (only the forearm and hand come in
  // front). From the side the near arm really is in front of the head, so there
  // the whole arm is drawn in front — the shoulder's cap rides with it, so the
  // head can no longer be drawn into the middle of the sleeve.
  return wholeBehind ? { behind: body, front: [] } : { behind: [], front: body };
}

/** A forearm and the mitt on the end of it. */
function foreArm(L: number, far: boolean, side: 1 | -1): Shape[] {
  const skin = far ? KIT.skinShade : KIT.skin;
  const rim = far ? KIT.skinDeep : KIT.skinShade;
  const [along, across] = ARM.hand;
  // The mitt: an egg a touch longer than it is wide, and a thumb tucked against
  // the palm on the inside.
  const mitt = (grow: number): string =>
    oval(L + 1.5, 0, along + grow, across + grow) +
    disc(L + 0.2, side * (across - 0.5), ARM.thumb + grow);
  return [
    { d: taper(0, L, ARM.fore[0], ARM.fore[1]), fill: skin },
    // The mitt is rimmed so a hand in front of a face or a tee stays a hand.
    { d: mitt(ARM.rim), fill: rim },
    { d: mitt(0), fill: skin },
  ];
}

/** A thigh with the shorts' leg over its top. */
function thigh(L: number, far: boolean): Shape[] {
  const skin = far ? KIT.skinShade : KIT.skin;
  const sh = far ? KIT.shortsShade : KIT.shorts;
  const hem = far ? KIT.shortsDeep : KIT.shortsShade;
  const e = LEG.shortsEnd * L;
  return [
    { d: taper(0, L, LEG.thigh[0], LEG.thigh[1]), fill: skin },
    { d: hemmed(-2.5, e, LEG.shorts[0], LEG.shorts[1], 2.2), fill: sh },
    { d: hemmed(e - LEG.hem, e, LEG.shorts[1], LEG.shorts[1], 0.7), fill: hem, fine: true },
  ];
}

/** A shin, with a crew sock over its lower half — the trainer's partner. */
function shin(L: number, far: boolean): Shape[] {
  const x0 = L * 0.56;
  const r = (x: number) => LEG.shin[0] + (LEG.shin[1] - LEG.shin[0]) * (x / L);
  return [
    { d: taper(0, L, LEG.shin[0], LEG.shin[1]), fill: far ? KIT.skinShade : KIT.skin },
    { d: hemmed(x0, L + 0.6, r(x0) + 0.5, r(L) + 0.5, 1.4), fill: far ? KIT.soleShade : KIT.sole },
    // The sock's ribbed top, in the trainers' coral.
    { d: hemmed(x0, x0 + 1.5, r(x0) + 0.6, r(x0) + 0.6, 0.5), fill: far ? KIT.shoeShade : KIT.shoe, fine: true },
  ];
}

/**
 * The side view's trainer. The foot bone is always level, its origin at the
 * ankle, so the shoe is drawn in screen orientation: heel behind, toe in front,
 * sole on the floor, a toe cap and two laces.
 */
function sideShoe(far: boolean): Shape[] {
  const body = far ? KIT.shoeShade : KIT.shoe;
  const cap = far ? KIT.shoeDeep : KIT.shoeLight;
  const sole = far ? KIT.soleShade : KIT.sole;
  // Authored at 1:1, then built up to the chunky size and dropped so the sole's
  // underside lands on the same line as the front-on trainer's.
  const k = SHOE_SCALE;
  const dy = SOLE_BELOW - 5.4 * k;
  return [
    {
      d: scalePath(
        "M-5.8 -0.8C-5.8 -4.6 -3.8 -6 -1 -6L2.4 -6C4.2 -6 5.4 -4 8 -2.8C11 -1.6 12.6 0 12.6 2L12.6 4L-5.8 4Z",
        k,
        dy,
      ),
      fill: body,
    },
    // Toe cap: the rubber bumper over the front.
    {
      d: scalePath("M7 -2.8C9.2 -1.9 10.4 -0.6 10.4 0.8L10.4 4L6 4C6.2 1.2 6.4 -1 7 -2.8Z", k, dy),
      fill: cap,
    },
    // Sole.
    { d: rrect(-6.2 * k, 2.6 * k + dy, 13.1 * k, 5.4 * k + dy, 1.5 * k), fill: sole },
    // Laces.
    { d: rrect(0.2 * k, -4 * k + dy, 4.4 * k, -2.9 * k + dy, 0.6 * k), fill: sole, fine: true },
    { d: rrect(1.7 * k, -2 * k + dy, 5.6 * k, -0.9 * k + dy, 0.6 * k), fill: sole, fine: true },
  ];
}

/** The front view's trainer, in screen orientation, centred under the ankle. */
function frontShoe(): Shape[] {
  return [
    { d: rrect(-9.8, -5.3, 9.8, 5.3, 5.3), fill: KIT.shoe },
    // Toe cap and the sole.
    { d: oval(0, 0.8, 5.7, 3.1), fill: KIT.shoeLight, fine: true },
    { d: rrect(-9.3, 2.5, 9.3, SOLE_BELOW, 1.7), fill: KIT.sole },
    // The laces' pad at the top of the foot.
    { d: rrect(-3.2, -4.3, 3.2, -2.5, 0.85), fill: KIT.sole, fine: true },
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
    { d: rrect(-7.4, -13.4, 5.8, 13.4, 6.4), fill: KIT.shorts },
    // The shadow the tee's hem casts on them…
    { d: rrect(-2.2, -12.8, 4.4, 12.8, 1.3), fill: KIT.shortsShade, fine: true },
    // …and the tee itself, flaring a touch toward the chest.
    { d: hemmed(4.2, L + 2, 14.4, 15, 3), fill: KIT.tee },
  ];
}

function frontUpperSpine(L: number): Shape[] {
  const top = L + 3.6;
  return [
    {
      d:
        `M-2 -14.8L${f(L - 3.8)} -16.4Q${f(L + 0.4)} -16.4 ${f(top - 0.9)} -10.6` +
        `Q${f(top + 0.7)} -5.2 ${f(top + 0.7)} 0Q${f(top + 0.7)} 5.2 ${f(top - 0.9)} 10.6` +
        `Q${f(L + 0.4)} 16.4 ${f(L - 3.8)} 16.4L-2 14.8Z`,
      fill: KIT.tee,
    },
  ];
}

function sideLowerSpine(L: number): Shape[] {
  return [
    { d: rrect(-7.4, -10.6, 6, 11.4, 5.8), fill: KIT.shorts },
    { d: rrect(-2.2, -11.4, 4.4, 12.4, 1.3), fill: KIT.shortsShade, fine: true },
    { d: hemmed(4.2, L + 2, 11.6, 12, 2.8), fill: KIT.tee },
  ];
}

function sideUpperSpine(L: number): Shape[] {
  const top = L + 3.6;
  return [
    {
      d:
        `M-2 -11.8L${f(L - 3.8)} -12.6Q${f(L + 0.7)} -12.6 ${f(top - 0.7)} -8.6` +
        `Q${f(top + 0.7)} -4 ${f(top + 0.7)} 0.5Q${f(top + 0.7)} 5.4 ${f(top - 0.9)} 9.8` +
        `Q${f(L + 0.7)} 13.4 ${f(L - 3.8)} 13.4L-2 12.2Z`,
      fill: KIT.tee,
    },
  ];
}

/**
 * The neck and the tee's collar round its base. The collar is a deeper shade of
 * the tee rather than the near-white ringer it was: with the head down to a
 * human size the neckline is no longer hidden behind a chin, and a pale band
 * across the chest read as a second rip.
 */
function neck(L: number): Shape[] {
  return [
    { d: oval(1.6, 0, 3.6, 8.4), fill: KIT.teeShade, fine: true },
    // The neck, in the shadow the chin casts.
    { d: taper(0.6, L * 0.7, 4.1, 4.1), fill: KIT.skinShade },
  ];
}

/* ───────────────────────────────── The head ──────────────────────────────── */

export interface HeadArt {
  /** Behind the skull — the hair's puffs (they sway). */
  puffs: Shape[];
  /** Behind the skull — the ears of a front-on head. */
  back: Shape[];
  /** The skull. */
  skull: Shape[];
  /**
   * The face: the eyes and the one closed mouth, drawn over the skull and under
   * the hair. A FLAT, FIXED set of shapes — there is nothing here to drive.
   *
   * It was a rig of its own once: a clipped white, a pupil that glanced about,
   * an upper lid that blinked, a lower lid the cheeks pushed up, two brows that
   * raised and frowned, and four mouths that swapped through a rep (a grin, an
   * "oh", gritted teeth, a closed smile). All of it worked, and all of it was
   * wrong for this figure: the one thing moving in a frame pulls the eye, and
   * the thing moving must be the arm, the knee or the waist. The eyes stay
   * because without them a head has no front, and the mouth stays because a
   * head with eyes and no mouth reads as a mask.
   */
  face: Shape[];
  /** Over the skull — the hair's cap. */
  front: Shape[];
  /** Where the hair's puffs pivot as they sway. */
  swayPivot: readonly [number, number];
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
    stroke: { color: KIT.mouth, width: 0.085 },
  };
}

function frontHead(): HeadArt {
  const puffs: [number, number, number][] = [
    [-0.92, -0.42, 0.34],
    [0.92, -0.42, 0.34],
    [-0.64, -0.86, 0.42],
    [0.64, -0.86, 0.42],
    [0, -1.04, 0.5],
  ];
  const fringe: [number, number, number][] = [
    [-0.66, -0.58, 0.19],
    [-0.24, -0.62, 0.19],
    [0.24, -0.62, 0.19],
    [0.66, -0.58, 0.19],
  ];
  return {
    puffs: [{ d: puffs.map(([x, y, r]) => disc(x, y, r)).join(""), fill: KIT.hair }],
    back: [
      // Ears peek out behind the skull.
      { d: disc(-1.0, 0.14, 0.2), fill: KIT.skinShade },
      { d: disc(1.0, 0.14, 0.2), fill: KIT.skinShade },
    ],
    skull: [
      {
        d: "M-1.06 0.06C-1.06 -0.56 -0.62 -1 0 -1C0.62 -1 1.06 -0.56 1.06 0.06C1.06 0.64 0.64 1 0 1C-0.64 1 -1.06 0.64 -1.06 0.06Z",
        fill: KIT.skin,
      },
    ],
    face: [eye(-0.33, 0.1, 0.115, 0.155), eye(0.33, 0.1, 0.115, 0.155), mouth(-0.19, 0.19, 0.58, 0.1)],
    front: [
      // The cap: hair over the crown, curving in at the temples to a high hairline…
      {
        d:
          "M-1.06 0.02C-1.1 -0.62 -0.64 -1.06 0 -1.06C0.64 -1.06 1.1 -0.62 1.06 0.02" +
          "C1.04 -0.12 0.98 -0.26 0.88 -0.36C0.8 -0.46 0.74 -0.56 0.62 -0.6L-0.62 -0.6" +
          "C-0.74 -0.56 -0.8 -0.46 -0.88 -0.36C-0.98 -0.26 -1.04 -0.12 -1.06 0.02Z",
        fill: KIT.hair,
      },
      // …a curly fringe along it…
      { d: fringe.map(([x, y, r]) => disc(x, y, r)).join(""), fill: KIT.hair },
      // …and a stroke of light across the curls.
      { d: "M-0.46 -0.9C-0.28 -0.99 -0.08 -1.01 0.12 -0.99", stroke: { color: KIT.hairLight, width: 0.09 }, fine: true },
    ],
    swayPivot: [0, 0.1],
    reach: { up: 1.54, down: 1, side: 1.26 },
  };
}

function sideHead(): HeadArt {
  const puffs: [number, number, number][] = [
    [-0.8, -0.14, 0.4],
    [-0.66, -0.68, 0.46],
    [-0.14, -1.0, 0.5],
    [0.42, -0.86, 0.42],
    [-0.9, 0.3, 0.3],
  ];
  return {
    puffs: [{ d: puffs.map(([x, y, r]) => disc(x, y, r)).join(""), fill: KIT.hair }],
    back: [],
    skull: [
      {
        // Back and crown round, a clear forehead, a small nose, a lip, a chin.
        d:
          "M-0.98 0.1C-0.98 -0.55 -0.58 -1 0 -1C0.58 -1 0.98 -0.62 1 -0.12" +
          "C1.01 0 1.1 0.1 1.11 0.22C1.12 0.32 1.04 0.36 0.99 0.37" +
          "C1.01 0.45 1.02 0.56 0.97 0.64C1 0.76 0.95 0.9 0.82 0.96" +
          "C0.66 1.04 0.34 1.02 0.1 1C-0.6 1 -0.98 0.64 -0.98 0.1Z",
        fill: KIT.skin,
      },
      // The ear: a shaded crescent with the lit ear inside it.
      { d: disc(-0.12, 0.2, 0.19), fill: KIT.skinShade },
      { d: disc(-0.09, 0.2, 0.125), fill: KIT.skin },
    ],
    face: [eye(0.56, 0.1, 0.1, 0.155), mouth(0.68, 0.94, 0.58, 0.1)],
    front: [
      {
        d:
          "M-0.98 0.2C-1.06 -0.6 -0.6 -1.06 0.02 -1.06C0.6 -1.06 1.0 -0.7 1.02 -0.4" +
          "C0.9 -0.52 0.74 -0.58 0.58 -0.5C0.42 -0.42 0.3 -0.3 0.16 -0.14C0.04 0 -0.1 -0.06 -0.2 -0.12" +
          "C-0.34 -0.08 -0.5 0 -0.6 0.14C-0.7 0.3 -0.86 0.34 -0.98 0.2Z",
        fill: KIT.hair,
      },
      { d: "M-0.4 -0.88C-0.2 -0.99 0.1 -1.01 0.3 -0.95", stroke: { color: KIT.hairLight, width: 0.09 }, fine: true },
    ],
    swayPivot: [-0.3, 0.1],
    reach: { up: 1.5, down: 1, side: 1.2 },
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
    puffs: thin(h.puffs),
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
    if (/^(foreArm|farForeArm)/.test(n)) return keep(foreArm(L, far, thumbSide(n, view)));
    if (/^(thigh|farThigh)/.test(n)) return keep(thigh(L, far));
    if (/^(shin|farShin)/.test(n)) return keep(shin(L, far));
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
      far: view === "side" ? [...pick(/^far(Thigh|Shin|Foot)/), ...pick(/^far(UpArm|ForeArm)/)] : [],
      legs: pick(/^(thigh|shin|foot)/),
      torso: pick(/Spine$/),
      caps: pick(/^upArm/, behind),
      collar: pick(/^neck$/),
      arms: pick(/^(upArm|foreArm)/),
    },
    shoes:
      view === "front" ? pick(/^shin/).map((bone) => ({ bone, shapes: keep(frontShoe()) })) : [],
    head: detail === "thumb" ? thinHead(head) : head,
    // Centred on the ankle; splayed outward so two wide trainers don't become one.
    shoeDrop: 0,
    shoeOut: 4.8,
  };
}

/**
 * Poses whose authored side view puts the head on the opposite side of their
 * facing. Everything else turns its face along the neck's normal.
 *   cobra / yRaise — lying FACE DOWN, but authored with the head on the left.
 *   invertedRow    — hanging FACE UP under the bar, head on the right.
 */
const FACE_MIRRORED = new Set<FigureMotion>(["cobra", "yRaise", "invertedRow"]);

export function faceMirrored(motion: FigureMotion, view: FigureView): boolean {
  return view === "side" && FACE_MIRRORED.has(motion);
}
