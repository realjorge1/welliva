/**
 * SIDE MOVEMENT PROFILES — profile-view poses for the demonstration figure.
 *
 * The companion to frontProfiles: for every motion, this captures the SAME
 * movement seen from the side (a near arm + near leg silhouette, torso as a
 * line, head), so the two panels of the demo show one exercise from two camera
 * angles — front and side — in lock-step. (The older movementProfiles side data
 * predates the front set and depicted different exercises for some keys; this
 * module is authored to match frontProfiles movement-for-movement.)
 *
 * Each profile is two keyframes ([top, bottom] of one rep); the figure
 * ping-pongs between them driven by the SAME clock as the front panel, so both
 * hit the bottom of the rep together. Coordinates are normalized to a 0–100 box
 * (y grows down); the figure faces right (+x is "forward"). Pure data.
 */
import type { FigureMotion } from "./movementProfiles";

/** Node order in a flat side frame: [x,y] per node (near arm + near leg). */
export const SIDE_NODES = [
  "head",
  "shoulder",
  "elbow",
  "hand",
  "hip",
  "knee",
  "foot",
] as const;
export const SIDE_FRAME_LEN = SIDE_NODES.length * 2; // 14

export interface SideProfile {
  /** [top, bottom] keyframes, each SIDE_FRAME_LEN numbers. */
  frames: [number[], number[]];
  loopMs: number;
}

const P = (
  head: [number, number],
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [...head, ...shoulder, ...elbow, ...hand, ...hip, ...knee, ...foot];

export const SIDE_PROFILES: Record<FigureMotion, SideProfile> = {
  // Bodyweight squat — hips sink back, knees track forward, arms reach forward.
  squat: {
    frames: [
      P([50, 16], [50, 31], [50, 45], [51, 57], [50, 57], [50, 75], [50, 93]),
      P([46, 30], [47, 43], [55, 45], [64, 46], [43, 60], [57, 72], [50, 93]),
    ],
    loopMs: 2400,
  },
  // Hip hinge — torso folds toward horizontal, arms hang, legs stay long.
  hinge: {
    frames: [
      P([50, 17], [50, 32], [50, 45], [50, 57], [50, 58], [50, 76], [50, 93]),
      P([70, 42], [62, 44], [62, 57], [62, 68], [48, 58], [49, 76], [49, 93]),
    ],
    loopMs: 2600,
  },
  // Overhead press — arms drive from the shoulders (racked) to full extension.
  push: {
    frames: [
      P([50, 20], [50, 33], [51, 21], [52, 9], [50, 58], [50, 76], [50, 93]),
      P([50, 20], [50, 33], [45, 43], [53, 33], [50, 58], [50, 76], [50, 93]),
    ],
    loopMs: 2000,
  },
  // Pulldown — arm extends overhead, then the elbow drives down to the chest.
  pull: {
    frames: [
      P([50, 22], [50, 34], [52, 22], [54, 9], [50, 60], [50, 78], [50, 94]),
      P([50, 20], [50, 34], [44, 41], [40, 34], [50, 58], [50, 76], [50, 92]),
    ],
    loopMs: 2200,
  },
  // Core — standing knee tuck: the near knee drives up as the torso curls in.
  core: {
    frames: [
      P([50, 18], [50, 32], [50, 45], [51, 57], [50, 57], [50, 75], [50, 93]),
      P([52, 24], [51, 37], [52, 48], [54, 57], [50, 55], [62, 58], [64, 70]),
    ],
    loopMs: 1900,
  },
  // Cardio — jumping jack seen side-on: arm sweeps overhead, stance opens.
  cardio: {
    frames: [
      P([50, 18], [50, 32], [50, 44], [50, 56], [50, 57], [50, 75], [50, 93]),
      P([50, 18], [50, 32], [54, 22], [56, 10], [50, 57], [54, 75], [58, 93]),
    ],
    loopMs: 700,
  },
  // Mobility — a tall overhead reach folding down toward the floor.
  flexibility: {
    frames: [
      P([50, 20], [50, 34], [50, 22], [50, 9], [50, 58], [50, 77], [50, 94]),
      P([64, 54], [58, 50], [58, 63], [58, 74], [48, 58], [49, 78], [49, 94]),
    ],
    loopMs: 3600,
  },
  // Neutral — a barely-there stand-and-breathe for anything unmapped.
  neutral: {
    frames: [
      P([50, 17], [50, 33], [50, 46], [51, 58], [50, 58], [50, 77], [50, 94]),
      P([50, 19], [50, 35], [50, 47], [51, 59], [50, 58], [50, 78], [50, 94]),
    ],
    loopMs: 3200,
  },
};

export function getSideProfile(motion: FigureMotion): SideProfile {
  return SIDE_PROFILES[motion] ?? SIDE_PROFILES.neutral;
}
