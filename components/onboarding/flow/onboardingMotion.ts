/**
 * ONBOARDING MOTION — one grammar for the whole ritual.
 *
 * Every animation in the onboarding derives its timing, easing and distance
 * from this file. No screen invents a curve. The point is not consistency for
 * its own sake: a flow where every element decelerates on the same curve reads
 * as ONE object breathing, and a flow where each screen picks its own reads as
 * a pile of components.
 *
 * THE FOUR REGISTERS (see `Dur`)
 *   micro     150–250ms  a tap acknowledging itself
 *   ui        350–550ms  content changing inside a screen
 *   content   600–900ms  a whole composition arriving or leaving
 *   cinematic 900–1400ms the two signature moments (build, exit)
 *   ambient   2–6s       loops that never resolve
 *
 * THE ONE RULE: movement never stops suddenly. Every entrance easing here is a
 * long-tailed ease-out — the element is still moving, imperceptibly, for the
 * last third of its travel. That tail is the whole difference between
 * "expensive" and "a React Native form".
 *
 * REDUCE MOTION is not an afterthought and not an off-switch. `useMotion()`
 * collapses distance to zero and clamps duration, but KEEPS opacity changes and
 * the tiny scale on a press — a user with Reduce Motion on must still be able to
 * see that their tap registered.
 */
import { Easing, useReducedMotion } from "react-native-reanimated";

/* ───────────────────────────────── Durations ───────────────────────────── */

export const Dur = {
  /** Micro feedback — a card compressing, a check appearing. */
  micro: 200,
  /** Press release / selection settle. */
  tap: 260,
  /** Standard element change inside a screen. */
  ui: 440,
  /** A composition arriving or leaving. */
  content: 720,
  /** Signature moments only: the plan ring drawing, the exit. */
  cinematic: 1100,
  /** Step hand-over — the outgoing half. */
  stepOut: 280,
  /** Step hand-over — the incoming half (starts before the outgoing ends). */
  stepIn: 520,
  /** Ambient loops. */
  breath: 4200,
  drift: 6000,
} as const;

/* ───────────────────────────────── Easing ──────────────────────────────── */

/**
 * Organic curves. All entrances use a long ease-out tail; exits accelerate
 * away so the screen never feels like it is waiting for something to finish.
 */
export const Ease = {
  /** Entrances. Quintic-ish ease-out: fast commit, very long settle. */
  soft: Easing.bezier(0.22, 1, 0.36, 1),
  /** Content that travels a distance — slightly gentler start than `soft`. */
  glide: Easing.bezier(0.16, 0.84, 0.24, 1),
  /** Standard in-place changes (opacity, colour). */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Exits — accelerates out of the way. */
  exit: Easing.bezier(0.4, 0, 0.9, 0.35),
  /** Symmetrical, for loops that must not read as having a start or an end. */
  breath: Easing.bezier(0.45, 0, 0.55, 1),
  /** A line drawing itself — almost linear, with just enough tail to land. */
  draw: Easing.bezier(0.35, 0.15, 0.2, 1),
} as const;

/* ───────────────────────────────── Distance ────────────────────────────── */

/**
 * Travel distances. Deliberately small: the reference language moves things
 * 8–16px, not across the screen. Anything larger reads as a page swap.
 */
export const Travel = {
  /** Text and chips rising into place. */
  rise: 12,
  /** A card entering from below. */
  card: 20,
  /** The outgoing half of a step hand-over. */
  stepOut: 10,
  /** The incoming half of a step hand-over. */
  stepIn: 14,
} as const;

/* ───────────────────────────────── Stagger ─────────────────────────────── */

/**
 * The gap between layers of one composition. The reference reveals a screen
 * over roughly a second — headline, then copy, then the options, then the
 * action — so the eye is led rather than presented with everything at once.
 */
export const Stagger = {
  /** Layers of a single composition (headline → copy → options → action). */
  layer: 120,
  /** Items inside one group (six goal cards revealing in sequence). */
  item: 64,
  /** Deliberate pause before a question's options appear. */
  question: 300,
} as const;

/* ──────────────────────────────── Springs ──────────────────────────────── */

/**
 * Low/medium stiffness, generous damping — a spring that settles rather than
 * one that bounces. `overshootClamping` is deliberately OFF on `settle` so the
 * card has the faintest overshoot (a physical object arriving), and ON for
 * `press` so a finger-driven compression never wobbles.
 */
export const Spring = {
  /** A selected card settling into place. */
  settle: { damping: 18, stiffness: 140, mass: 0.9 },
  /** Press compression — no overshoot, tracks the finger. */
  press: { damping: 26, stiffness: 320, mass: 0.7, overshootClamping: true },
  /** A large element landing (the plan hero). */
  land: { damping: 20, stiffness: 110, mass: 1 },
} as const;

/* ─────────────────────────── Reduce Motion profile ─────────────────────── */

export interface MotionProfile {
  /** True when the OS asks for reduced motion. */
  reduced: boolean;
  /** Clamp a duration. Reduced motion keeps a crossfade, not a still cut. */
  dur: (ms: number) => number;
  /** Collapse a travel distance to zero under reduced motion. */
  dist: (px: number) => number;
  /** Compress a stagger so the sequence still reads, but quickly. */
  delay: (ms: number) => number;
  /** Whether ambient loops (breathing, drift) should run at all. */
  ambient: boolean;
}

const REDUCED_MAX = 220;
const REDUCED_DELAY_MAX = 60;

const FULL: MotionProfile = {
  reduced: false,
  dur: (ms) => ms,
  dist: (px) => px,
  delay: (ms) => ms,
  ambient: true,
};

const CALM: MotionProfile = {
  reduced: true,
  dur: (ms) => Math.min(ms, REDUCED_MAX),
  dist: () => 0,
  delay: (ms) => Math.min(ms, REDUCED_DELAY_MAX),
  ambient: false,
};

/**
 * The single accessibility gate for the flow. Read it once per component and
 * pass every duration/distance through it — never branch on `reduced` by hand,
 * or the two paths drift.
 *
 * THE RETURNED OBJECT IS A MODULE CONSTANT, NOT A FRESH LITERAL, and that is
 * load-bearing rather than a micro-optimisation. Every component here puts
 * `motion` in an effect's dependency array; a new object per render would
 * re-run all of those on EVERY parent render, which means every entrance
 * animation in the flow restarting on every keystroke and every timer being
 * cleared and re-scheduled before it could fire. Two frozen profiles, switched
 * by one boolean, make the dependency honest.
 */
export function useMotion(): MotionProfile {
  return useReducedMotion() ? CALM : FULL;
}

/* ───────────────────────────────── Pacing ──────────────────────────────── */

/**
 * How long the interface holds still after a selection before moving on.
 * Long enough that the acknowledgement is felt; short enough that it is never
 * a wait. The activity step's existing 380ms auto-continue lives here so the
 * rest of the flow can match it.
 */
export const Pace = {
  /** Selection → the interface reacts. */
  react: 260,
  /** Selection → the flow advances (the established activity-step value). */
  advance: 380,
  /** Selection → a sub-question inside a screen hands over. */
  handover: 420,
} as const;
