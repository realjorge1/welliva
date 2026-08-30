/**
 * MOVEMENT PROFILES — the data that makes the demonstration figure move.
 *
 * Each profile is a schematic side-view humanoid captured as TWO keyframe poses
 * (a "top" and a "bottom" of one rep). The figure ping-pongs between them, so
 * one profile = one clean, looping rep of that movement pattern. Coordinates
 * are normalized to a 0–100 box (y grows downward), pattern-agnostic — the Skia
 * renderer scales them to whatever canvas size it's given.
 *
 * This module is PURE (no React, no Skia, no Reanimated) so the fitness test
 * suite can prove every catalogued exercise resolves to a drawable profile and
 * that no pose escapes the box.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import type { ExerciseCategory } from "@/models/exercise";
import type { MovementPattern } from "@/models/workout";
import { EXERCISE_MOTIONS, SPECIFIC_MOTION_FAMILY } from "./exerciseMotions";

/** Point order inside a flat 14-number frame: [x,y] per node. */
export const FIG_NODES = ["head", "shoulder", "elbow", "hand", "hip", "knee", "foot"] as const;
export type FigNode = (typeof FIG_NODES)[number];
export const FIG_INDEX: Record<FigNode, number> = {
  head: 0,
  shoulder: 1,
  elbow: 2,
  hand: 3,
  hip: 4,
  knee: 5,
  foot: 6,
};
export const FRAME_LEN = FIG_NODES.length * 2; // 14
export const HEAD_RADIUS = 7;

/**
 * The FALLBACK rungs: the seven real movement patterns + a calm default.
 * One shape per family — right for an AI-invented move nobody has authored,
 * and only ever a stand-in for a move the catalogue actually names.
 */
export type BaseMotion = MovementPattern | "neutral";

/**
 * Exercise-specific movements authored on top of the pattern rungs.
 *
 * Drawing butt kicks, high knees and jumping jacks with one shared "cardio"
 * loop reads as a broken app rather than a stylised one, so the moves people
 * recognise get their own. `idle` is not an exercise: it is the at-ease pose
 * the live player switches to between rounds. Front + side keyframes for each
 * live in front/sideProfiles; the id map is exerciseMotions.ts.
 */
export type SpecificMotion =
  | "idle"
  // Cardio
  | "jumpingJack"
  | "highKnee"
  | "buttKick"
  | "burpee"
  | "jumpRope"
  | "lateralShuffle"
  | "skater"
  | "march"
  | "boxing"
  | "bearCrawl"
  | "inchworm"
  | "mountainClimber"
  | "tuckJump"
  | "broadJump"
  | "plankJack"
  // Strength & floor work
  | "pushup"
  | "lunge"
  | "plank"
  | "gluteBridge"
  | "legRaise"
  | "calfRaise"
  | "row"
  | "curl"
  | "superman"
  | "sidePlank"
  | "russianTwist"
  | "wallSit"
  | "birdDog"
  | "catCow"
  | "childsPose";

/** Any profile key the figure can be drawn from. */
export type FigureMotion = BaseMotion | SpecificMotion;

export interface MovementProfile {
  /** Two keyframes: [top, bottom] of one rep. Each is FRAME_LEN numbers. */
  frames: [number[], number[]];
  /** Full ping-pong cycle (top→bottom→top) duration in ms. */
  loopMs: number;
  /** Whether the figure lies horizontal (push-up, crunch) — for framing only. */
  horizontal: boolean;
}

// Node helper for authoring readability.
const P = (
  head: [number, number],
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [...head, ...shoulder, ...elbow, ...hand, ...hip, ...knee, ...foot];

/* ── The pattern library. Poses are hand-tuned side-view silhouettes. ── */

export const MOVEMENT_PROFILES: Record<BaseMotion, MovementProfile> = {
  // Bodyweight squat — hips sink back, knees track forward, arms counterbalance.
  squat: {
    frames: [
      P([50, 22], [49, 34], [44, 48], [42, 50], [48, 60], [47, 78], [46, 95]),
      P([52, 42], [48, 52], [58, 52], [66, 52], [44, 74], [52, 80], [46, 95]),
    ],
    loopMs: 2400,
    horizontal: false,
  },
  // Hip hinge (RDL) — torso folds toward horizontal, arms hang, knees soft.
  hinge: {
    frames: [
      P([50, 22], [49, 34], [48, 47], [48, 58], [48, 60], [47, 78], [46, 95]),
      P([76, 50], [66, 50], [64, 64], [63, 76], [48, 62], [48, 79], [46, 95]),
    ],
    loopMs: 2600,
    horizontal: false,
  },
  // Push-up — plank lowers as the elbow bends; hand stays planted.
  push: {
    frames: [
      P([78, 62], [66, 64], [66, 80], [66, 90], [42, 68], [30, 70], [18, 72]),
      P([78, 74], [66, 76], [58, 84], [66, 90], [42, 72], [30, 72], [18, 74]),
    ],
    loopMs: 2200,
    horizontal: true,
  },
  // Pull-up — hands fixed on the bar; the whole body rises, elbows drive down.
  pull: {
    frames: [
      P([50, 30], [50, 40], [51, 24], [52, 12], [49, 60], [48, 76], [48, 92]),
      P([50, 20], [50, 30], [44, 26], [52, 12], [49, 52], [48, 66], [48, 80]),
    ],
    loopMs: 2400,
    horizontal: false,
  },
  // Crunch — supine with knees up; shoulders and head curl toward the knees.
  core: {
    frames: [
      P([76, 80], [66, 80], [64, 82], [62, 78], [46, 80], [30, 64], [20, 78]),
      P([70, 62], [62, 68], [60, 66], [56, 60], [46, 80], [30, 64], [20, 78]),
    ],
    loopMs: 2000,
    horizontal: true,
  },
  // Cardio — running-in-place cadence: near knee drives up, arm swings.
  cardio: {
    frames: [
      P([50, 24], [49, 34], [44, 44], [46, 36], [48, 58], [52, 68], [50, 80]),
      P([50, 25], [49, 34], [54, 44], [52, 52], [48, 60], [46, 78], [44, 95]),
    ],
    loopMs: 900,
    horizontal: false,
  },
  // Mobility — a slow, calm reach-up to gentle forward fold.
  flexibility: {
    frames: [
      P([50, 24], [49, 36], [50, 22], [51, 10], [48, 60], [47, 78], [47, 95]),
      P([62, 50], [56, 50], [58, 60], [58, 70], [48, 61], [47, 79], [47, 95]),
    ],
    loopMs: 3600,
    horizontal: false,
  },
  // Neutral idle — a barely-there stand-and-breathe for anything unmapped.
  neutral: {
    frames: [
      P([50, 22], [49, 34], [48, 47], [48, 58], [48, 60], [47, 78], [46, 95]),
      P([50, 24], [49, 36], [48, 49], [48, 60], [48, 62], [47, 79], [46, 95]),
    ],
    loopMs: 3200,
    horizontal: false,
  },
};

/** Category → movement pattern for exercises absent from the local DB. */
const CATEGORY_TO_MOTION: Record<ExerciseCategory, FigureMotion> = {
  push: "push",
  pull: "pull",
  legs: "squat",
  core: "core",
  cardio: "cardio",
  flexibility: "flexibility",
};

/**
 * Resolve the best demonstration motion for an exercise, most precise first:
 *
 *   1. the exercise's OWN authored movement (a butt kick kicks; see
 *      exerciseMotions.ts),
 *   2. the local DB's movement pattern — the family stand-in,
 *   3. the session's category,
 *   4. a calm neutral idle.
 *
 * Never throws — AI exercises the catalogue has never seen degrade to a
 * sensible pose rather than to nothing.
 */
export function resolveFigureMotion(
  exerciseId?: string,
  category?: ExerciseCategory,
): FigureMotion {
  if (exerciseId) {
    const specific = EXERCISE_MOTIONS[exerciseId];
    if (specific) return specific;
    const entry = EXERCISE_DATABASE.find((e) => e.id === exerciseId);
    if (entry) return entry.movementPattern;
  }
  if (category && CATEGORY_TO_MOTION[category]) return CATEGORY_TO_MOTION[category];
  return "neutral";
}

/** The pattern-level fallback for a motion — the family it belongs to. */
export function baseMotionOf(motion: FigureMotion): BaseMotion {
  return SPECIFIC_MOTION_FAMILY[motion as SpecificMotion] ?? (motion as BaseMotion);
}

export function getMovementProfile(motion: FigureMotion): MovementProfile {
  return MOVEMENT_PROFILES[baseMotionOf(motion)] ?? MOVEMENT_PROFILES.neutral;
}

/** Smoothstep for natural ease at both ends of a rep. */
export function smoothstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Sample the figure at loop progress p∈[0,1). Ping-pongs top→bottom→top and
 * eases the turn-arounds. Returns a fresh 14-number frame. Kept pure (and
 * mirrored by an inline worklet in the renderer) so tests can exercise it.
 */
export function sampleFigure(profile: MovementProfile, p: number): number[] {
  const tri = p < 0.5 ? p * 2 : (1 - p) * 2; // 0→1→0
  const t = smoothstep(tri);
  const [a, b] = profile.frames;
  const out = new Array<number>(FRAME_LEN);
  for (let i = 0; i < FRAME_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

/** Read a node's [x,y] out of a flat frame. */
export function nodeXY(frame: number[], node: FigNode): [number, number] {
  const i = FIG_INDEX[node] * 2;
  return [frame[i], frame[i + 1]];
}
