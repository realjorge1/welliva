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

  // Idle — at ease between rounds. See the front profile for why it exists.
  idle: {
    frames: [
      P([50, 18], [50, 34], [50, 47], [51, 59], [50, 58], [50, 77], [50, 94]),
      P([51, 20], [51, 36], [51, 49], [52, 60], [50, 59], [50, 78], [50, 94]),
    ],
    loopMs: 4200,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * EXERCISE-SPECIFIC MOVEMENTS — the side companion to the front set. Same
   * keys, same rep clock, same movement seen from the other camera.
   * ══════════════════════════════════════════════════════════════════════ */

  // ── Cardio ──────────────────────────────────────────────────────────────

  jumpingJack: {
    frames: [
      P([50, 18], [50, 32], [50, 45], [50, 57], [50, 57], [50, 75], [50, 92]),
      P([50, 18], [50, 32], [55, 20], [57, 8], [50, 57], [55, 75], [59, 92]),
    ],
    loopMs: 700,
  },

  highKnee: {
    frames: [
      P([50, 17], [50, 32], [47, 44], [57, 38], [50, 57], [50, 76], [50, 93]),
      P([50, 17], [50, 32], [53, 44], [44, 37], [50, 57], [58, 40], [53, 56]),
    ],
    loopMs: 620,
  },

  buttKick: {
    frames: [
      P([50, 17], [50, 32], [47, 44], [57, 38], [50, 57], [50, 76], [50, 93]),
      P([50, 17], [50, 32], [53, 44], [44, 37], [50, 57], [49, 76], [34, 68]),
    ],
    loopMs: 640,
  },

  burpee: {
    frames: [
      P([50, 14], [50, 29], [54, 18], [58, 7], [50, 54], [50, 73], [50, 90]),
      P([76, 58], [64, 62], [64, 74], [64, 86], [40, 68], [24, 72], [10, 76]),
    ],
    loopMs: 2600,
  },

  jumpRope: {
    frames: [
      P([50, 18], [50, 33], [47, 44], [57, 49], [50, 58], [50, 76], [50, 93]),
      P([50, 15], [50, 30], [47, 41], [58, 44], [50, 55], [51, 72], [49, 88]),
    ],
    loopMs: 620,
  },

  lateralShuffle: {
    frames: [
      P([50, 20], [50, 34], [50, 46], [52, 58], [50, 58], [50, 76], [50, 93]),
      P([50, 23], [50, 37], [51, 49], [54, 60], [50, 61], [52, 78], [50, 94]),
    ],
    loopMs: 760,
  },

  skater: {
    frames: [
      P([50, 20], [50, 34], [52, 46], [56, 55], [50, 58], [50, 76], [50, 93]),
      P([56, 30], [52, 42], [56, 52], [64, 59], [46, 62], [52, 76], [50, 93]),
    ],
    loopMs: 1100,
  },

  march: {
    frames: [
      P([50, 17], [50, 33], [48, 45], [52, 56], [50, 57], [54, 42], [52, 58]),
      P([50, 17], [50, 33], [52, 45], [48, 56], [50, 57], [50, 76], [50, 93]),
    ],
    loopMs: 1300,
  },

  boxing: {
    frames: [
      P([50, 18], [50, 33], [59, 38], [70, 41], [50, 58], [50, 76], [50, 93]),
      P([50, 18], [50, 33], [48, 45], [57, 40], [50, 58], [50, 76], [50, 93]),
    ],
    loopMs: 700,
  },

  bearCrawl: {
    frames: [
      P([74, 52], [64, 56], [66, 68], [68, 80], [40, 60], [46, 74], [44, 86]),
      P([76, 50], [66, 54], [64, 66], [62, 78], [42, 58], [52, 70], [54, 84]),
    ],
    loopMs: 1400,
  },

  inchworm: {
    frames: [
      P([80, 44], [70, 52], [72, 64], [74, 76], [46, 58], [46, 76], [46, 93]),
      P([80, 54], [68, 58], [68, 70], [68, 82], [44, 64], [28, 68], [12, 72]),
    ],
    loopMs: 3000,
  },

  mountainClimber: {
    frames: [
      P([78, 58], [66, 62], [66, 74], [66, 86], [42, 66], [28, 70], [14, 74]),
      P([78, 58], [66, 62], [66, 74], [66, 86], [42, 66], [56, 72], [50, 84]),
    ],
    loopMs: 700,
  },

  tuckJump: {
    frames: [
      P([50, 24], [50, 38], [48, 50], [52, 60], [50, 60], [51, 78], [50, 95]),
      P([50, 10], [50, 24], [55, 33], [64, 39], [50, 46], [58, 36], [58, 50]),
    ],
    loopMs: 1100,
  },

  broadJump: {
    frames: [
      P([46, 28], [48, 42], [40, 50], [30, 58], [44, 66], [52, 80], [46, 94]),
      P([66, 20], [56, 32], [66, 38], [76, 44], [54, 56], [68, 66], [80, 72]),
    ],
    loopMs: 1600,
  },

  plankJack: {
    frames: [
      P([78, 58], [66, 62], [66, 74], [66, 86], [42, 66], [28, 70], [14, 74]),
      P([78, 58], [66, 62], [66, 74], [66, 86], [42, 66], [28, 72], [14, 78]),
    ],
    loopMs: 800,
  },

  // ── Strength & floor work ───────────────────────────────────────────────

  pushup: {
    frames: [
      P([78, 56], [66, 60], [66, 74], [66, 86], [42, 64], [28, 68], [14, 72]),
      P([78, 72], [66, 76], [55, 82], [66, 86], [42, 76], [28, 78], [14, 80]),
    ],
    loopMs: 2200,
  },

  lunge: {
    frames: [
      P([50, 17], [50, 32], [50, 45], [51, 57], [50, 57], [50, 76], [50, 93]),
      P([50, 28], [50, 43], [50, 56], [51, 68], [50, 68], [60, 82], [54, 96]),
    ],
    loopMs: 2400,
  },

  plank: {
    frames: [
      P([78, 58], [66, 62], [66, 74], [66, 86], [42, 66], [28, 70], [14, 74]),
      P([78, 59], [66, 63], [66, 75], [66, 86], [42, 68], [28, 72], [14, 76]),
    ],
    loopMs: 4200,
  },

  gluteBridge: {
    frames: [
      P([22, 80], [32, 78], [36, 88], [46, 90], [56, 82], [70, 72], [74, 90]),
      P([22, 80], [32, 78], [36, 88], [46, 90], [56, 68], [72, 70], [76, 88]),
    ],
    loopMs: 2400,
  },

  legRaise: {
    frames: [
      P([20, 84], [30, 82], [32, 92], [42, 94], [54, 86], [72, 88], [88, 90]),
      P([20, 84], [30, 82], [32, 92], [42, 94], [54, 86], [58, 68], [60, 52]),
    ],
    loopMs: 2600,
  },

  calfRaise: {
    frames: [
      P([50, 20], [50, 35], [50, 48], [51, 60], [50, 60], [50, 78], [50, 95]),
      P([50, 14], [50, 29], [50, 42], [51, 54], [50, 54], [50, 72], [50, 89]),
    ],
    loopMs: 1800,
  },

  row: {
    frames: [
      P([80, 42], [68, 49], [70, 61], [72, 73], [46, 60], [46, 78], [46, 95]),
      P([80, 42], [68, 49], [60, 58], [70, 62], [46, 60], [46, 78], [46, 95]),
    ],
    loopMs: 2200,
  },

  curl: {
    frames: [
      P([50, 17], [50, 33], [50, 46], [51, 58], [50, 58], [50, 77], [50, 94]),
      P([50, 17], [50, 33], [50, 46], [57, 38], [50, 58], [50, 77], [50, 94]),
    ],
    loopMs: 2000,
  },

  superman: {
    frames: [
      P([76, 84], [64, 86], [72, 90], [82, 92], [40, 88], [24, 90], [10, 92]),
      P([76, 78], [64, 82], [72, 78], [82, 74], [40, 86], [24, 82], [10, 76]),
    ],
    loopMs: 3000,
  },

  sidePlank: {
    frames: [
      P([36, 30], [42, 42], [44, 30], [46, 18], [52, 62], [60, 78], [64, 94]),
      P([36, 34], [42, 46], [44, 34], [46, 22], [52, 66], [60, 81], [64, 96]),
    ],
    loopMs: 4000,
  },

  russianTwist: {
    frames: [
      P([64, 48], [56, 60], [62, 68], [70, 74], [40, 80], [56, 70], [64, 86]),
      P([64, 48], [56, 60], [54, 72], [64, 76], [40, 80], [56, 70], [64, 86]),
    ],
    loopMs: 1600,
  },

  wallSit: {
    frames: [
      P([44, 28], [44, 42], [48, 54], [52, 64], [44, 66], [62, 68], [62, 86]),
      P([44, 29], [44, 43], [48, 55], [52, 65], [44, 67], [62, 69], [62, 87]),
    ],
    loopMs: 4200,
  },

  birdDog: {
    frames: [
      P([74, 54], [62, 58], [62, 70], [62, 82], [38, 62], [38, 74], [38, 86]),
      P([74, 52], [62, 56], [72, 50], [82, 44], [38, 60], [26, 56], [14, 52]),
    ],
    loopMs: 2800,
  },

  catCow: {
    frames: [
      P([76, 46], [64, 52], [64, 64], [64, 76], [40, 58], [40, 72], [40, 86]),
      P([72, 60], [62, 54], [64, 66], [64, 78], [40, 52], [40, 68], [40, 84]),
    ],
    loopMs: 3400,
  },

  childsPose: {
    frames: [
      P([70, 66], [58, 72], [68, 74], [80, 76], [36, 80], [38, 92], [26, 94]),
      P([72, 70], [58, 76], [68, 78], [80, 80], [36, 84], [38, 94], [26, 96]),
    ],
    loopMs: 3600,
  },
};

export function getSideProfile(motion: FigureMotion): SideProfile {
  return SIDE_PROFILES[motion] ?? SIDE_PROFILES.neutral;
}
