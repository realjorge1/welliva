/**
 * TEMPO — how the character MOVES: timing, feel and life.
 *
 * The old figure ran every exercise on one curve: a symmetric ping-pong between
 * two poses on a quintic ease, one rep to the clock. That is why some moves were
 * a blur (a jumping jack's forearm turned 900° a second) and the rest were stiff
 * (every joint stopped and started at once, nothing overshot, nothing breathed).
 *
 * Three things replace it, borrowed from how a rigged cartoon is animated:
 *
 *   1. A FEEL PER MOVEMENT. A squat is not a stretch is not a jump. Each feel is
 *      a rep timeline — controlled lowering, a held bottom, a driven rise that
 *      overshoots and settles, a quiet top — not one ease. Joints trail their
 *      parents (overlapping action) and the loosest ones swing past their mark
 *      (follow-through). See `FEELS`.
 *   2. A SPEED BUDGET. No joint is allowed to turn faster than a person can read
 *      on a phone. A movement whose authored rep would exceed it is slowed until
 *      it doesn't; nothing is ever sped up. See `resolveTempo`.
 *   3. A LIFE LAYER that runs on top of the body and never blocks it: the
 *      breath, the squash of a landing, the hair that drags. No face: see FX. It is
 *      scheduled on a MACRO CYCLE of several reps, so the face does not repeat
 *      every rep the way the limbs must. See `lifeAt`.
 *
 * Everything the animation needs per frame is a function of one number — the
 * clock — so a paused or reduced-motion figure rests exactly on its first pose.
 *
 * Pure (no React / Skia / Reanimated). The per-frame functions carry the
 * "worklet" directive so the renderer can call them on the UI thread, and are
 * plain functions in the test suite.
 *
 * WORKLET ORDER IS LOAD-BEARING. Reanimated captures a worklet's callees when
 * the caller is created, so every worklet here (and in motion.ts) is declared
 * BEFORE any worklet that calls it — `smooth` and `bump` before `arcAt`, and
 * `arcAt` before `lifeAt`. A callee declared later is captured as
 * undefined and the figure dies on the UI thread, where no test can see it.
 * Don't reorder them, and give any new helper the "worklet" directive too.
 */
import { baseMotionOf, type FigureMotion } from "./movementProfiles";

/* ───────────────────────────────── Feels ─────────────────────────────────── */

export type FeelName = "lift" | "steady" | "bounce" | "flow" | "hold";

/** Feels are passed to worklets as small integers. */
export const FEEL_CODE: Record<FeelName, number> = {
  lift: 0,
  steady: 1,
  bounce: 2,
  flow: 3,
  hold: 4,
};

/** Samples per rep in the timing tables (the table has one more, for p = 1). */
export const LUT_N = 240;

type Ease = "hold" | "sine";
/** A point on the rep timeline: at progress `p` the pose is `t` of the way to B. */
type Knot = readonly [p: number, t: number, ease: Ease];

/**
 * How far past each end the pose swings, as a fraction of A→B, and when. A
 * window is [from, to] in rep progress; `amp` is its depth.
 *   ant    — a counter-move before the drive (the dip before a jump).
 *   top    — the settle after arriving back at A.
 *   bottom — the rebound after arriving at B.
 */
interface Window {
  from: number;
  to: number;
  amp: number;
}
interface FeelSpec {
  knots: readonly Knot[];
  ant?: Window;
  top?: Window;
  bottom?: Window;
  /** The fastest any joint may turn, degrees per second, at the curve's steepest. */
  maxDegPerSec: number;
  /** The shortest a rep may be, whatever its joints do. */
  floorMs: number;
}

/**
 * The timelines. Every one starts at A (t = 0) and has B (t = 1) at p = 0.5, so
 * a still frozen at 0 or 0.5 is exactly the first or second authored pose.
 */
const FEELS: Record<FeelName, FeelSpec> = {
  // Strength: lower under control, hold the bottom, drive up, settle, breathe.
  lift: {
    knots: [
      [0, 0, "hold"],
      [0.1, 0, "sine"],
      [0.42, 1, "hold"],
      [0.58, 1, "sine"],
      [0.9, 0, "hold"],
      [1, 0, "hold"],
    ],
    ant: { from: 0.03, to: 0.1, amp: 0.06 },
    top: { from: 0.9, to: 1, amp: 0.06 },
    // The rebound has settled by the middle of the hold, so p = 0.5 is B exactly.
    bottom: { from: 0.42, to: 0.5, amp: 0.035 },
    maxDegPerSec: 330,
    floorMs: 1800,
  },
  // Alternating and continuous work: one smooth swing, no holds.
  steady: {
    knots: [
      [0, 0, "sine"],
      [0.5, 1, "sine"],
      [1, 0, "hold"],
    ],
    maxDegPerSec: 380,
    floorMs: 1000,
  },
  // Hops and jumps: a short airborne transition, a landing that holds.
  bounce: {
    knots: [
      [0, 0, "hold"],
      [0.08, 0, "sine"],
      [0.42, 1, "hold"],
      [0.58, 1, "sine"],
      [0.92, 0, "hold"],
      [1, 0, "hold"],
    ],
    top: { from: 0.92, to: 1, amp: 0.04 },
    bottom: { from: 0.42, to: 0.5, amp: 0.04 },
    // A jump's arms really do move fast, but only for an instant.
    maxDegPerSec: 600,
    floorMs: 1100,
  },
  // Stretches and mobility: slow in, a long breath at each end, slow out.
  flow: {
    knots: [
      [0, 0, "hold"],
      [0.12, 0, "sine"],
      [0.42, 1, "hold"],
      [0.58, 1, "sine"],
      [0.88, 0, "hold"],
      [1, 0, "hold"],
    ],
    maxDegPerSec: 220,
    floorMs: 3200,
  },
  // Holds: the body is still; what moves is the breath.
  hold: {
    knots: [
      [0, 0, "sine"],
      [0.5, 1, "sine"],
      [1, 0, "hold"],
    ],
    maxDegPerSec: 60,
    floorMs: 3600,
  },
};

/** The fastest any joint may turn in a feel, degrees per second — the speed budget. */
export function speedBudget(feel: FeelName): number {
  return FEELS[feel].maxDegPerSec;
}

/** Hops and jumps the standing cardio set is drawn doing — see `feelFor`. */
const BOUNCE = new Set<FigureMotion>([
  "cardio",
  "jumpingJack",
  "starJump",
  "tuckJump",
  "broadJump",
  "jumpRope",
  "lateralShuffle",
  "skater",
  "fastFeet",
  "jumpSquat",
  "jumpLunge",
]);

/** Alternating, cyclic or swinging work: one continuous sweep per rep. */
const STEADY = new Set<FigureMotion>([
  "highKnee",
  "buttKick",
  "march",
  "mountainClimber",
  "boxing",
  "toeTap",
  "stepTouch",
  "plankJack",
  "bearCrawl",
  "flutterKick",
  "hollowRock",
  "bicycleCrunch",
  "heelTap",
  "shoulderTap",
  "russianTwist",
  "birdDog",
  "deadBug",
  "windshieldWiper",
  "kbSwing",
  "squatPulse",
  "armCircles",
  "torsoTwist",
]);

/** A movement that is a slow reach in disguise, whatever family it is filed under. */
const FLOWING = new Set<FigureMotion>(["inchworm"]);

/**
 * Short loops where the authored cadence IS the point, so the family floor is
 * lowered (fast feet are meant to look quick) — never below this.
 */
const FLOOR_OVERRIDE: Partial<Record<FigureMotion, number>> = {
  fastFeet: 800,
  jumpRope: 900,
  flutterKick: 900,
};

/**
 * How high a jump's root is lifted, in box units, for the hops that are not
 * already authored with a jump in them (a tuck or broad jump is). Standing steps
 * get a small bob instead. 0 = none.
 */
const HOP: Partial<Record<FigureMotion, number>> = {
  cardio: 4.5,
  jumpingJack: 4.5,
  jumpRope: 2.4,
  lateralShuffle: 2,
  skater: 3,
  fastFeet: 1.6,
  jumpLunge: 3.5,
  highKnee: 1.6,
  buttKick: 1.4,
  march: 1,
  boxing: 0.8,
  toeTap: 0.8,
};

export interface MotionMetrics {
  /** The rep length the profile was authored with, ms. */
  authoredMs: number;
  /** The largest angle any drawn bone turns between pose A and pose B, degrees. */
  swingDeg: number;
  /** How far the root travels between the poses, box units. */
  rootTravel: number;
}

/**
 * Which feel a movement has. Static poses (a plank, a wall sit, a deep squat
 * hold) barely change between A and B — they are breathing, not repping — and
 * the long stretches are slow flows; the lists above name the rest; everything
 * else is a strength rep.
 */
export function feelFor(motion: FigureMotion, m: MotionMetrics): FeelName {
  const family = baseMotionOf(motion);
  if (motion === "idle" || family === "neutral") return "hold";
  if (m.swingDeg < 12 && m.rootTravel < 3.6 && m.authoredMs >= 3000) return "hold";
  if (BOUNCE.has(motion)) return "bounce";
  if (STEADY.has(motion)) return "steady";
  if (FLOWING.has(motion)) return "flow";
  if (family === "flexibility") return m.authoredMs >= 3000 ? "flow" : "steady";
  return "lift";
}

/* ─────────────────────────── The timing table ────────────────────────────── */

function clamp01(x: number): number {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** 0 → 1 across [0, 1], with no slope at either end. */
function smooth(x: number): number {
  "worklet";
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

/** 0 → 1 → 0 across a window, with no slope at either end. */
function bump(x: number): number {
  "worklet";
  const s = Math.sin(Math.PI * clamp01(x));
  return s * s;
}

/**
 * A single overshoot and a slow return, peak 1 about a third of the way in:
 * the shape of a body carried a little past its mark by its own momentum.
 */
function settle(x: number): number {
  const c = clamp01(x);
  return (Math.sin(Math.PI * c) * Math.pow(Math.cos((Math.PI * c) / 2), 2)) / 0.65;
}

function baseAt(knots: readonly Knot[], p: number): number {
  for (let i = 0; i < knots.length - 1; i++) {
    const [p0, t0, kind] = knots[i];
    const [p1, t1] = knots[i + 1];
    if (p <= p1 || i === knots.length - 2) {
      if (kind === "hold") return t0;
      const x = p1 > p0 ? clamp01((p - p0) / (p1 - p0)) : 1;
      return t0 + (t1 - t0) * (0.5 - 0.5 * Math.cos(Math.PI * x));
    }
  }
  return 0;
}

function windowAt(w: Window | undefined, p: number, shape: (x: number) => number): number {
  if (!w || p < w.from || p > w.to) return 0;
  return w.amp * shape((p - w.from) / (w.to - w.from));
}

/** The rep's clean curve and the overshoot riding on it, as lookup tables. */
export interface Curve {
  /** 0 at A, 1 at B, no overshoot. LUT_N + 1 samples over p ∈ [0, 1]. */
  base: number[];
  /** The swing past the marks (anticipation, settle, rebound). Same length. */
  extra: number[];
}

export function buildCurve(feel: FeelName): Curve {
  const spec = FEELS[feel];
  const base: number[] = [];
  const extra: number[] = [];
  for (let i = 0; i <= LUT_N; i++) {
    const p = i / LUT_N;
    base.push(baseAt(spec.knots, p));
    extra.push(
      -windowAt(spec.ant, p, bump) -
        windowAt(spec.top, p, settle) +
        windowAt(spec.bottom, p, settle),
    );
  }
  return { base, extra };
}

/** The steepest the full curve ever gets, in pose-units per unit of the rep. */
export function peakSlope(curve: Curve): number {
  let peak = 0;
  for (let i = 1; i <= LUT_N; i++) {
    const a = curve.base[i] + curve.extra[i] - curve.base[i - 1] - curve.extra[i - 1];
    peak = Math.max(peak, Math.abs(a) * LUT_N);
  }
  return peak;
}

/** Read a table at rep progress `p` ∈ [0, 1), interpolating. */
export function lutAt(table: number[], p: number): number {
  "worklet";
  const x = p * LUT_N;
  const i = Math.floor(x);
  if (i >= LUT_N) return table[LUT_N];
  const f = x - i;
  return table[i] + (table[i + 1] - table[i]) * f;
}

/* ───────────────────────────── The resolved tempo ────────────────────────── */

export interface Tempo {
  feel: FeelName;
  /** The visible rep, ms — the authored one, slowed if its joints were too quick. */
  loopMs: number;
  /** Reps in one cycle of the clock (the life layer's schedule spans them all). */
  reps: number;
  /** The clock's full cycle, ms. */
  macroMs: number;
  curve: Curve;
  /** The steepest the curve gets — what the speed budget was solved against. */
  slope: number;
  /** Root lift per hop (cardio) or per step (a bob), box units. 0 = none. */
  hop: number;
}

const roundTo = (v: number, step: number): number => Math.round(v / step) * step;

/** A rep is cycled until the macro cycle is about this long. */
const MACRO_TARGET_MS = 9000;

export function resolveTempo(motion: FigureMotion, m: MotionMetrics): Tempo {
  const feel = feelFor(motion, m);
  const spec = FEELS[feel];
  const curve = buildCurve(feel);
  const slope = peakSlope(curve);
  const floor = FLOOR_OVERRIDE[motion] ?? spec.floorMs;
  // The speed budget: the steepest part of the curve carries the biggest swing
  // in `need` seconds, so the rep can be no shorter than that.
  const need = ((m.swingDeg * slope) / spec.maxDegPerSec) * 1000;
  const loopMs = roundTo(Math.max(m.authoredMs, floor, need), 50);
  const reps = Math.max(2, Math.min(6, Math.round(MACRO_TARGET_MS / loopMs)));
  return {
    feel,
    loopMs,
    reps,
    macroMs: loopMs * reps,
    curve,
    slope,
    hop: HOP[motion] ?? 0,
  };
}

/* ───────────────────────────── Per-bone looseness ────────────────────────── */

/**
 * How each kind of bone trails its parent and how far it overshoots, by name.
 * `lagMs` is the delay behind the clock; `gain` scales the overshoot (0 = the
 * joint hits its mark and stops, 1 = the full swing). Elbows and knees get a
 * small gain: a limb that over-extends a joint reads as broken, a shoulder or a
 * hip that carries through reads as weight.
 */
export interface BoneFeel {
  lagMs: number;
  gain: number;
}

export function boneFeel(name: string): BoneFeel {
  if (name === "lowerSpine") return { lagMs: 0, gain: 1 };
  if (name === "upperSpine") return { lagMs: 22, gain: 1 };
  if (name === "neck") return { lagMs: 60, gain: 1.4 };
  if (/^clav/.test(name)) return { lagMs: 22, gain: 1 };
  if (/^(far)?upArm/i.test(name)) return { lagMs: 38, gain: 1.15 };
  if (/^(far)?foreArm/i.test(name)) return { lagMs: 80, gain: 0.45 };
  if (/^pelvis/.test(name)) return { lagMs: 0, gain: 0 };
  if (/^(far)?thigh/i.test(name)) return { lagMs: 14, gain: 0.9 };
  if (/^(far)?shin/i.test(name)) return { lagMs: 34, gain: 0.35 };
  if (/^(far)?foot/i.test(name)) return { lagMs: 55, gain: 0.55 };
  return { lagMs: 0, gain: 0 };
}

/* ──────────────────────────────── The life layer ─────────────────────────── */

/**
 * What the life layer reads. Built once per motion; the numbers inside are all
 * a worklet needs, so it can be copied to the UI thread whole.
 */
export interface LifeKit {
  feel: number;
  reps: number;
  macroMs: number;
  loopMs: number;
  base: number[];
  /** How hard the movement works the BODY, 0…1 (lifts 1, bounces 0.3, holds 0.5). */
  strain: number;
  /** Hair drag and bob gains. */
  drag: number;
  /** Jump height, for the squash and the shadow. */
  hop: number;
}

/** A small stable hash of the movement's name. */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Indices into the frame the life layer returns.
 *
 * THE FACE IS NOT IN HERE ANY MORE. There were ten more slots — lid closure,
 * cheek squint, pupil look, brow raise and frown, and a weight per mouth — and
 * a schedule of blinks and glances to drive them. They are gone with the art
 * that read them (`characterArt.HeadArt.face`): on a figure whose job is to
 * demonstrate a movement, the only thing that should move is the body doing it.
 * What is left is all body — the breath, the squash of a landing, the shadow,
 * the hair's drag, and the effort the tests read.
 */
export const FX = {
  /** Hair: how far the puffs swing (radians) and sink (head radii). */
  SWAY: 0,
  BOB: 1,
  /** Breath, 0 out … 1 full. */
  BREATH: 2,
  /** Vertical squash of the whole body about its feet, −0.06 … +0.04. */
  SQUASH: 3,
  /** The ground shadow's scale, 0.6 … 1. */
  SHADOW: 4,
  /** Head tilt, radians, on top of the neck's own. */
  TILT: 5,
  /** Rep effort 0…1 (the renderer does not draw it; the tests read it). */
  EFFORT: 6,
  LENGTH: 7,
} as const;

/** The hop's arc: 0 on the ground, 1 at the apex, per feel. */
export function arcAt(feel: number, q: number): number {
  "worklet";
  if (feel === 2) {
    // Two airborne windows per rep: A → B and B → A.
    if (q > 0.08 && q < 0.42) return bump((q - 0.08) / 0.34);
    if (q > 0.58 && q < 0.92) return bump((q - 0.58) / 0.34);
    return 0;
  }
  if (feel === 1) {
    const s = Math.sin(2 * Math.PI * q);
    return s * s;
  }
  return 0;
}

/** The crouch before a take-off, 0…1, in the 0.07 of the rep ahead of each. */
function crouchAt(feel: number, q: number): number {
  "worklet";
  if (feel !== 2) return 0;
  if (q > 0.01 && q < 0.08) return bump((q - 0.01) / 0.07);
  if (q > 0.51 && q < 0.58) return bump((q - 0.51) / 0.07);
  return 0;
}

/** The squash after a landing, 0…1, in the 0.08 of the rep behind each. */
function landAt(feel: number, q: number): number {
  "worklet";
  if (feel !== 2) return 0;
  if (q > 0.42 && q < 0.5) return bump((q - 0.42) / 0.08);
  if (q > 0.92 && q < 1) return bump((q - 0.92) / 0.08);
  return 0;
}

/**
 * The breath, the squash and the hair at clock position `p` ∈ [0, 1) (the macro
 * cycle) — `q` is the same moment as a position inside one rep. Returns a fresh
 * frame; `headSwing` is how far the head turned over the last few ms, which the
 * hair answers.
 */
export function lifeAt(k: LifeKit, p: number, q: number, headSwing: number, bodyDrop: number): number[] {
  "worklet";
  const out = new Array<number>(FX.LENGTH);
  const feel = k.feel;
  const depth = lutAt(k.base, q);

  // ── Effort: how hard the movement is being worked right now.
  let effort = 0;
  if (feel === 0) {
    // Lifts: easy lowering, a brace through the held bottom, the strain arrives
    // with the drive and is gone at lockout.
    const brace = 0.25 * smooth((q - 0.38) / 0.14) * (1 - smooth((q - 0.54) / 0.04));
    const drive = smooth((q - 0.54) / 0.08) * (1 - smooth((q - 0.74) / 0.14));
    effort = Math.max(brace, drive) * k.strain;
  } else if (feel === 1) {
    effort = 0.35 * k.strain * (0.5 - 0.5 * Math.cos(4 * Math.PI * q));
  } else if (feel === 4) {
    // A hold works through the breath: the effort arrives at the end of each
    // exhale. (Two breaths a rep; each half-rep inhales, then exhales; zero at
    // q = 0.)
    const ph = (q * 2) % 1;
    const exhale = smooth((ph - 0.5) / 0.3) * (1 - smooth((ph - 0.8) / 0.2));
    effort = k.strain * (0.04 + 0.3 * exhale);
  }

  // ── Breath: in on the way down, out on the way up. Steady work and hops breathe
  // once a rep; a hold or a stretch breathes twice, slowly.
  let breath = depth;
  if (feel === 1 || feel === 2) breath = 0.5 - 0.5 * Math.cos(2 * Math.PI * q);
  else if (feel === 3 || feel === 4) breath = 0.5 - 0.5 * Math.cos(4 * Math.PI * q);

  // ── Hops: the body's squash and its shadow.
  const arc = arcAt(feel, q);
  const land = landAt(feel, q);
  const crouch = crouchAt(feel, q);

  // Hair answers the head's swing and the body's drop: it trails the turn, and
  // when the body drops it hangs a moment in the air (up is −y in the head's frame).
  out[FX.SWAY] = Math.max(-0.24, Math.min(0.24, -k.drag * headSwing));
  out[FX.BOB] = Math.max(-0.14, Math.min(0.12, -0.06 * bodyDrop));

  out[FX.BREATH] = breath;
  out[FX.SQUASH] = k.hop > 0 || feel === 2 ? 0.04 * arc - 0.07 * land - 0.025 * crouch : 0;
  out[FX.SHADOW] = 1 - 0.3 * arc;
  // A held effort tips the head back a hair; a calm hold sways it.
  out[FX.TILT] = -0.05 * effort + (feel === 3 || feel === 4 ? 0.025 * Math.sin(2 * Math.PI * p * k.reps) : 0);
  out[FX.EFFORT] = effort;
  return out;
}

/** How hard a feel works the BODY: a lift strains, a bounce barely does. */
export function strainOf(feel: FeelName): number {
  switch (feel) {
    case "lift":
      return 1;
    case "steady":
      return 0.7;
    case "bounce":
      return 0.25;
    case "hold":
      return 0.6;
    case "flow":
      return 0;
  }
}
