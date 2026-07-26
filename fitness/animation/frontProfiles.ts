/**
 * FRONT MOVEMENT PROFILES — camera-facing poses for the demonstration figure.
 *
 * Where movementProfiles.ts captures a SIDE silhouette (one arm, one leg), this
 * captures a FRONT-facing, bilaterally symmetric athlete: only the centerline
 * (head / chest / pelvis) and the RIGHT limbs are authored — the renderer
 * mirrors the left side and turns the whole body on its vertical axis so the
 * viewer sees it from the front and the back.
 *
 * Each profile is two keyframes ([top, bottom] of one rep); the figure
 * ping-pongs between them. Coordinates are normalized to a 0–100 box (y grows
 * down), centered on x=50. Pure data — no React / Skia / Reanimated.
 */
import type { FigureMotion } from "./movementProfiles";

/** Node order in a flat front frame: [x,y] per node. Center nodes sit at x=50. */
export const FRONT_NODES = [
  "head",
  "chest",
  "pelvis",
  "shoulder", // right
  "elbow", // right
  "hand", // right
  "hip", // right
  "knee", // right
  "foot", // right
] as const;
export const FRONT_FRAME_LEN = FRONT_NODES.length * 2; // 18

export interface FrontProfile {
  /** [top, bottom] keyframes, each FRONT_FRAME_LEN numbers (center + right). */
  frames: [number[], number[]];
  loopMs: number;
}

const P = (
  head: [number, number],
  chest: [number, number],
  pelvis: [number, number],
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [
  ...head,
  ...chest,
  ...pelvis,
  ...shoulder,
  ...elbow,
  ...hand,
  ...hip,
  ...knee,
  ...foot,
];

export const FRONT_PROFILES: Record<FigureMotion, FrontProfile> = {
  // Bodyweight squat — hips sink, knees track out, arms reach forward.
  squat: {
    frames: [
      P([50, 16], [50, 32], [50, 56], [61, 33], [65, 47], [68, 59], [57, 57], [58, 76], [59, 94]),
      P([50, 30], [50, 45], [50, 66], [62, 46], [71, 45], [80, 44], [60, 66], [67, 79], [59, 94]),
    ],
    loopMs: 2400,
  },
  // Hip hinge / good-morning — torso folds forward, legs stay long.
  hinge: {
    frames: [
      P([50, 16], [50, 32], [50, 58], [61, 33], [63, 46], [64, 58], [56, 58], [56, 77], [56, 94]),
      P([50, 32], [50, 44], [50, 58], [60, 45], [61, 56], [62, 66], [56, 58], [56, 77], [56, 94]),
    ],
    loopMs: 2600,
  },
  // Overhead press — hands drive from the shoulders to full extension.
  push: {
    frames: [
      P([50, 20], [50, 34], [50, 58], [61, 34], [64, 20], [66, 8], [56, 58], [56, 76], [56, 93]),
      P([50, 18], [50, 33], [50, 58], [61, 34], [67, 40], [64, 30], [56, 58], [56, 76], [56, 93]),
    ],
    loopMs: 2000,
  },
  // Pulldown — arms extend overhead, then elbows drive down and out to the chest.
  pull: {
    frames: [
      P([50, 22], [50, 34], [50, 60], [60, 34], [65, 20], [70, 8], [56, 60], [56, 78], [56, 94]),
      P([50, 18], [50, 33], [50, 58], [60, 34], [66, 46], [59, 34], [56, 58], [56, 76], [56, 92]),
    ],
    loopMs: 2200,
  },
  // Core — knee tuck: knees drive up as the torso curls in.
  core: {
    frames: [
      P([50, 16], [50, 32], [50, 56], [61, 33], [64, 46], [66, 58], [56, 57], [57, 76], [58, 93]),
      P([50, 22], [50, 37], [50, 53], [61, 38], [63, 49], [65, 58], [56, 54], [58, 60], [60, 72]),
    ],
    loopMs: 1900,
  },
  // Cardio — jumping jack: arms + legs open and close together.
  cardio: {
    frames: [
      P([50, 18], [50, 32], [50, 56], [59, 33], [61, 45], [62, 57], [55, 57], [55, 75], [54, 93]),
      P([50, 18], [50, 32], [50, 56], [60, 32], [68, 22], [74, 10], [56, 57], [64, 76], [70, 93]),
    ],
    loopMs: 700,
  },
  // Mobility — a tall overhead reach folding down toward the floor.
  flexibility: {
    frames: [
      P([50, 20], [50, 34], [50, 58], [60, 33], [62, 20], [63, 8], [56, 58], [56, 77], [56, 94]),
      P([50, 40], [50, 48], [50, 60], [58, 49], [59, 62], [60, 73], [56, 60], [56, 78], [56, 94]),
    ],
    loopMs: 3600,
  },
  // Neutral — a barely-there stand-and-breathe for anything unmapped.
  neutral: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [62, 47], [63, 59], [56, 58], [56, 77], [56, 94]),
      P([50, 19], [50, 35], [50, 58], [60, 36], [62, 49], [63, 60], [56, 58], [56, 78], [56, 94]),
    ],
    loopMs: 3200,
  },
};

export function getFrontProfile(motion: FigureMotion): FrontProfile {
  return FRONT_PROFILES[motion] ?? FRONT_PROFILES.neutral;
}
