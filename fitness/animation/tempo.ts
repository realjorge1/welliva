/**
 * TEMPO — how the figure MOVES: one rhythm, one curve, every joint together.
 *
 * The figure used to give every movement its own clock and its own feel: reps
 * anywhere from 0.8 s to 5.2 s in 50 ms steps, holds that stopped dead and
 * restarted, an anticipation dip and an overshoot past each end, and every
 * joint trailing the one above it by up to 80 ms. Each piece was defensible on
 * its own; together they read as unsteady — a rep that hitched, an elbow that
 * arrived after the shoulder, a session whose demonstrations each ran to a
 * different beat. The owner's words: "smooth and in a stable rhythm — not too
 * fast, not too slow; everything in sync".
 *
 * So the rules are now few and strict:
 *
 *   1. ONE PULSE. Every rep is a whole number of 500 ms beats, and the clock's
 *      cycle is the same 12 s for every movement. Cardio repeats every second,
 *      strength every three, stretches and holds breathe over six — so a
 *      session's demonstrations, and the 1 Hz session clock under them, all
 *      land on the same grid. See `REP_GRID_MS`.
 *   2. ONE CURVE PER FEEL, and it is a human one. A strength rep is a
 *      minimum-jerk reach (the path a person's own limbs take between two
 *      positions, 10t³ − 15t⁴ + 6t⁵) with a short rest at each end; continuous
 *      work is a plain harmonic swing. Nothing overshoots, nothing dips first.
 *   3. EVERY JOINT TOGETHER. The whole skeleton reads the same curve at the same
 *      instant, so the body moves as one piece — no joint is late. A loose forearm
 *      and hand are behind in the middle of a move, and they leave and arrive with
 *      everything else (motion.ts "The hands").
 *   4. A SPEED BUDGET, still. A movement whose joints would turn faster than a
 *      person can follow on a phone moves up to the next step of the grid —
 *      slower, never faster, and never off the beat.
 *
 * The only thing layered on the body is the breath, and it is tied to the rep.
 *
 * Pure (no React / Skia / Reanimated). The per-frame functions carry the
 * "worklet" directive so the renderer can call them on the UI thread, and are
 * plain functions in the test suite.
 *
 * WORKLET ORDER IS LOAD-BEARING. Reanimated captures a worklet's callees when
 * the caller is created, so every worklet here (and in motion.ts) is declared
 * BEFORE any worklet that calls it. A callee declared later is captured as
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

/** Samples per rep in the timing table (the table has one more, for p = 1). */
export const LUT_N = 240;

/**
 * A rep timeline. Every one starts at pose A (t = 0) and has pose B (t = 1) at
 * p = 0.5, so a still frozen at 0 or 0.5 is exactly the first or second
 * authored pose.
 *
 *   swing — a harmonic oscillation, t = ½ − ½·cos 2πp. Continuous work (a
 *           march, a jumping jack, a breath) never stops; it slows into each
 *           end and away again, like a pendulum.
 *   reach — rest at A, a minimum-jerk move to B, rest at B, back again. `restA`
 *           is the share of the rep spent still at A (half at each end of the
 *           rep), `restB` the share still at B.
 */
type Shape =
  | { kind: "swing" }
  | { kind: "reach"; restA: number; restB: number };

interface FeelSpec {
  shape: Shape;
  /** The rep length a movement of this feel is given, ms — on the beat grid. */
  baseMs: number;
  /** The fastest any joint may turn, degrees per second, at the curve's steepest. */
  maxDegPerSec: number;
}

const FEELS: Record<FeelName, FeelSpec> = {
  // Strength: a beat standing tall, down under control, a short pause at the
  // bottom, up again. Three seconds a rep.
  lift: { shape: { kind: "reach", restA: 0.12, restB: 0.08 }, baseMs: 3000, maxDegPerSec: 330 },
  // Alternating and continuous work: one even swing a second.
  steady: { shape: { kind: "swing" }, baseMs: 1000, maxDegPerSec: 380 },
  // Hops: the same even swing, the body lifting off the floor between the ends.
  bounce: { shape: { kind: "swing" }, baseMs: 1000, maxDegPerSec: 480 },
  // Stretches: ease in, hold the stretch, ease out, hold — one slow breath.
  flow: { shape: { kind: "reach", restA: 0.2, restB: 0.2 }, baseMs: 6000, maxDegPerSec: 220 },
  // Holds: the body is still; what moves is the breath.
  hold: { shape: { kind: "swing" }, baseMs: 6000, maxDegPerSec: 60 },
};

/** The fastest any joint may turn in a feel, degrees per second — the speed budget. */
export function speedBudget(feel: FeelName): number {
  return FEELS[feel].maxDegPerSec;
}

/**
 * THE GRID. Every rep length the figure may take, ms — whole 500 ms beats, each
 * of which divides the clock's 12 s cycle exactly. A movement is never given a
 * length off this list, so whatever plays next, the rhythm does not change.
 */
export const REP_GRID_MS = [1000, 1500, 2000, 3000, 4000, 6000] as const;
/** One clock cycle — the same for every movement, a whole number of every rep. */
export const CYCLE_MS = 12000;

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
  "marchingBridge",
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
 * Moves whose own pace is not their feel's, still on the grid. A rep here is
 * BOTH sides (two poses, A and B), so the steady second would give a dead bug
 * or a bird dog half a second a side — they are done slowly, under control. A
 * broad jump lands and resets before the next; a swing and a crawl are a breath
 * slower than a march.
 */
const OWN_PACE_MS: Partial<Record<FigureMotion, (typeof REP_GRID_MS)[number]>> = {
  deadBug: 3000,
  birdDog: 3000,
  windshieldWiper: 3000,
  // Filed under strength it had three seconds, and pinned the lowest foot all the
  // way: with both feet off the floor mid-switch, the body sank 21 units to reach.
  marchingBridge: 3000,
  russianTwist: 2000,
  broadJump: 2000,
  tuckJump: 1500,
  boxing: 1500,
  kbSwing: 1500,
  bearCrawl: 1500,
};

/**
 * How high a jump's root is lifted, in box units, for the hops that are not
 * already authored with a jump in them (a tuck or broad jump is). Standing steps
 * get a small bob instead. 0 = none.
 */
const HOP: Partial<Record<FigureMotion, number>> = {
  cardio: 4,
  jumpingJack: 4,
  jumpRope: 2.2,
  lateralShuffle: 1.8,
  skater: 2.6,
  fastFeet: 1.4,
  jumpLunge: 3.2,
  highKnee: 1.4,
  buttKick: 1.2,
  march: 0.8,
  boxing: 0.6,
  toeTap: 0.6,
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

/**
 * The minimum-jerk path from 0 to 1: how a person's own limb travels between
 * two positions (Flash & Hogan). No slope and no acceleration at either end, so
 * a move leaves a rest and arrives at one without a jolt.
 */
function minJerk(x: number): number {
  const c = clamp01(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/** The pose parameter at rep progress `p` ∈ [0, 1]: 0 at A, 1 at B. */
function shapeAt(shape: Shape, p: number): number {
  if (shape.kind === "swing") return 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
  const a = shape.restA / 2;
  const b = shape.restB / 2;
  const travel = 0.5 - a - b;
  if (p <= 0.5) return minJerk((p - a) / travel);
  return 1 - minJerk((p - 0.5 - b) / travel);
}

/** The rep's curve, as a lookup table. */
export interface Curve {
  /** 0 at A, 1 at B. LUT_N + 1 samples over p ∈ [0, 1]. */
  base: number[];
}

export function buildCurve(feel: FeelName): Curve {
  const shape = FEELS[feel].shape;
  const base: number[] = [];
  for (let i = 0; i <= LUT_N; i++) base.push(shapeAt(shape, i / LUT_N));
  // Exactly the authored poses at the two ends of the rep and in its middle.
  base[0] = 0;
  base[LUT_N / 2] = 1;
  base[LUT_N] = 0;
  return { base };
}

/** The steepest the curve ever gets, in pose-units per unit of the rep. */
export function peakSlope(curve: Curve): number {
  let peak = 0;
  for (let i = 1; i <= LUT_N; i++) {
    peak = Math.max(peak, Math.abs(curve.base[i] - curve.base[i - 1]) * LUT_N);
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
  /** One rep, ms — a step of REP_GRID_MS. */
  loopMs: number;
  /** Reps in one cycle of the clock. */
  reps: number;
  /** The clock's full cycle, ms — CYCLE_MS for every movement. */
  macroMs: number;
  curve: Curve;
  /** The steepest the curve gets — what the speed budget was solved against. */
  slope: number;
  /** Root lift per hop (cardio) or per step (a bob), box units. 0 = none. */
  hop: number;
}

export function resolveTempo(motion: FigureMotion, m: MotionMetrics): Tempo {
  const feel = feelFor(motion, m);
  const spec = FEELS[feel];
  const curve = buildCurve(feel);
  const slope = peakSlope(curve);
  // The speed budget: the steepest part of the curve carries the biggest swing
  // in `need` seconds, so the rep can be no shorter than that. The rep is the
  // first step of the grid that is at least the feel's own length and leaves
  // every joint inside the budget.
  const need = ((m.swingDeg * slope) / spec.maxDegPerSec) * 1000;
  const want = Math.max(OWN_PACE_MS[motion] ?? spec.baseMs, need);
  const loopMs = REP_GRID_MS.find((ms) => ms >= want - 1) ?? REP_GRID_MS[REP_GRID_MS.length - 1];
  return {
    feel,
    loopMs,
    reps: CYCLE_MS / loopMs,
    macroMs: CYCLE_MS,
    curve,
    slope,
    hop: HOP[motion] ?? 0,
  };
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
  /** Jump height, box units. */
  hop: number;
}

/**
 * Indices into the frame the life layer returns.
 *
 * It is down to the breath. There used to be a whole layer here — the hair
 * dragging behind the head, a squash on every landing and a stretch in the air,
 * a head that tipped back under effort, a ground shadow that shrank as the body
 * rose. Every one of them moved on its own timing, which is exactly what
 * "everything in sync" ruled out: on a figure that demonstrates, the only thing
 * that moves is the body doing the movement.
 */
export const FX = {
  /** Breath, 0 out … 1 full. */
  BREATH: 0,
  LENGTH: 1,
} as const;

/** The hop's arc: 0 on the ground, 1 at the apex, per feel. */
export function arcAt(feel: number, q: number): number {
  "worklet";
  // Hops leave the floor between the two poses and land on each; steady work
  // bobs once a step on the same shape. Both are tied to the swing, so the body
  // rises and lands in time with the limbs.
  if (feel === 2 || feel === 1) {
    const s = Math.sin(2 * Math.PI * q);
    return s * s;
  }
  return 0;
}

/**
 * The breath at rep position `q` — in on the way down, out on the way up, once
 * a rep; a hold breathes on the same 6 s rep it is given. Returns a fresh frame.
 */
export function lifeAt(k: LifeKit, q: number): number[] {
  "worklet";
  const out = new Array<number>(FX.LENGTH);
  out[FX.BREATH] = lutAt(k.base, q);
  return out;
}
