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
import type { BaseMotion, FigureMotion } from "./movementProfiles";

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

/** Node order in an explicit FAR-limb frame: [x,y] per node. */
export const SIDE_FAR_NODES = ["elbow", "hand", "knee", "foot"] as const;
export const SIDE_FAR_LEN = SIDE_FAR_NODES.length * 2; // 8

export interface SideProfile {
  /** [top, bottom] keyframes, each SIDE_FRAME_LEN numbers. */
  frames: [number[], number[]];
  /**
   * Optional explicit FAR arm and leg — [top, bottom], each SIDE_FAR_LEN
   * numbers (elbow, hand, knee, foot). They hang off the same shoulder and hip
   * as the near limbs; the renderer sets them back for depth.
   *
   * Without it the far side ECHOES the near one, which is right for every
   * symmetric movement (a squat, a push-up) and wrong for every split or
   * alternating one: an echoed lunge bends both knees forward and reads as a
   * squat, an echoed bird dog lifts both hands off the floor. Authoring the far
   * limbs is what lets the side camera show one leg forward and one back.
   */
  framesFar?: [number[], number[]];
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

/** The same, for the explicit FAR arm and leg (no head, trunk or joints). */
const F = (
  elbow: [number, number],
  hand: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [...elbow, ...hand, ...knee, ...foot];

/**
 * Every motion that can be shown side-on. The pattern fallbacks and the idle
 * pose are always here; a movement that only reads from the front (a side
 * plank, a lateral raise) simply has no entry — see animation/cameras.ts.
 */
type SideProfileMap = Partial<Record<FigureMotion, SideProfile>> & Record<BaseMotion | "idle", SideProfile>;

export const SIDE_PROFILES: SideProfileMap = {
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

  // Side view: one knee drives to hip height while the other leg stays
  // planted; arms pump opposite.
  highKnee: {
    frames: [
      P([50, 16], [50, 32], [43.9, 43.5], [48, 54.8], [50, 57], [68.8, 54.4], [70.6, 71.3]),
      P([50, 16], [50, 32], [58, 42.2], [69.7, 39.7], [50, 57], [49.3, 76], [48.7, 93]),
    ],
    framesFar: [
      F([58, 42.2], [69.7, 39.7], [49.3, 76], [48.7, 93]),
      F([43.9, 43.5], [48, 54.8], [68.8, 54.4], [70.6, 71.3]),
    ],
    loopMs: 620,
  },

  // Side view: jogging on the spot, each heel snapping up to the glute.
  buttKick: {
    frames: [
      P([50, 16], [50, 32], [55.3, 43.9], [66.8, 40.6], [50, 57], [46, 75.6], [37.5, 60.9]),
      P([50, 16], [50, 32], [44.7, 43.9], [44.3, 55.9], [50, 57], [50.7, 76], [51.3, 93]),
    ],
    framesFar: [
      F([44.7, 43.9], [44.3, 55.9], [50.7, 76], [51.3, 93]),
      F([55.3, 43.9], [66.8, 40.6], [46, 75.6], [37.5, 60.9]),
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

  // Side view: a brisk march, knees lifting toward hip height one at a time.
  march: {
    frames: [
      P([50, 17], [50, 33], [46.4, 45.5], [46, 57.5], [50, 58], [67.4, 65.7], [65, 82.6]),
      P([50, 17], [50, 33], [55.3, 44.9], [65.2, 51.6], [50, 58], [50, 77], [50, 94]),
    ],
    framesFar: [
      F([55.3, 44.9], [65.2, 51.6], [50, 77], [50, 94]),
      F([46.4, 45.5], [46, 57.5], [67.4, 65.7], [65, 82.6]),
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

  // On hands and toes, knees hovering: opposite hand and foot step forward
  // together.
  bearCrawl: {
    frames: [
      P([80.5, 59.7], [64.8, 62.5], [68.2, 75], [70.9, 86.7], [40, 66], [42.3, 84.9], [28, 94]),
      P([80.5, 59.7], [64.8, 62.5], [63.4, 75.5], [61.6, 87.3], [40, 66], [52.3, 80.5], [42, 94]),
    ],
    framesFar: [
      F([63.4, 75.5], [61.6, 87.3], [52.3, 80.5], [42, 94]),
      F([68.2, 75], [70.9, 86.7], [42.3, 84.9], [28, 94]),
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

  // High plank: one knee drives under the chest while the other leg stays
  // long, then they switch.
  mountainClimber: {
    frames: [
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [58.7, 74.9], [49.7, 86.4]),
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
    ],
    framesFar: [
      F([66, 73], [66, 86], [31.6, 78.2], [18.7, 85]),
      F([66, 73], [66, 86], [58.7, 74.9], [49.7, 86.4]),
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

  /*
   * Hands AND toes on one floor line (y≈85–86), one straight body from head to
   * heel. The old frames put the feet 14 units above the hands, which read as a
   * decline push-up with the feet on a bench — and at the bottom the chest lay
   * on the floor with the arms folded out of sight, so a still of it said
   * "lying down", not "push-up". Segment lengths match across the two frames
   * (the rig averages them), so nothing stretches mid-rep.
   *   top:    arms locked under the shoulders, body inclined ~28°
   *   bottom: chest a hand's width off the floor, elbows bent back past the
   *           shoulders, body pivoting on the toes
   */
  pushup: {
    frames: [
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
      P([84.2, 76.4], [71.7, 78], [59, 75], [66, 86], [47.6, 81.2], [33.2, 83.1], [18.7, 85]),
    ],
    loopMs: 2200,
  },

  // Side view: the front leg steps forward to a 90° knee while the back knee
  // drops toward the floor.
  lunge: {
    frames: [
      P([50, 17], [50, 33], [50, 46], [51, 58], [50, 58], [50, 77], [50, 94]),
      P([48, 32], [48, 48], [47.5, 61], [48.4, 73], [48, 73], [66.6, 77], [66, 94]),
    ],
    framesFar: [
      F([50, 46], [51, 58], [50, 77], [50, 94]),
      F([47.5, 61], [48.4, 73], [44, 91.6], [27, 92]),
    ],
    loopMs: 2400,
  },

  // The push-up's top position held, with a slow breath through the trunk.
  // Same floor line as the push-up — hands and toes both down.
  plank: {
    frames: [
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
      P([77, 55.3], [66, 60.8], [66, 73.4], [66, 86], [44.5, 72.3], [31.6, 78.8], [18.7, 85]),
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

  // On all fours, reach one arm forward and the opposite leg back, then
  // switch.
  birdDog: {
    frames: [
      P([80.5, 64.1], [65, 68], [77.9, 66.6], [89.9, 65.8], [40.7, 74], [40.7, 93], [23.7, 93]),
      P([80.5, 64.1], [65, 68], [65.3, 81], [65, 93], [40.7, 74], [21.8, 72], [4.8, 70.8]),
    ],
    framesFar: [
      F([65.3, 81], [65, 93], [21.8, 72], [4.8, 70.8]),
      F([77.9, 66.6], [89.9, 65.8], [40.7, 93], [23.7, 93]),
    ],
    loopMs: 2800,
  },

  // On all fours: cow lifts the head and drops the belly; cat drops the head
  // and rounds the back up.
  catCow: {
    frames: [
      P([75.5, 56.4], [64.8, 68.3], [66.9, 81.1], [65, 93], [40.7, 75], [40.7, 94], [23.7, 94]),
      P([76.4, 79.7], [65.3, 68.2], [66.5, 81.1], [65, 93], [40.7, 72.5], [40.7, 91.5], [23.7, 91.5]),
    ],
    loopMs: 3400,
  },

  // Kneeling, sit the hips back to the heels and fold forward, forehead down,
  // arms reaching long.
  childsPose: {
    frames: [
      P([80.7, 89.2], [64.8, 87.5], [77.3, 90.8], [89, 93.5], [40, 84], [53.6, 97.3], [37, 93.5]),
      P([80.2, 90.7], [64.3, 88.7], [76.8, 92.3], [88.4, 95.2], [39.6, 84.8], [53.4, 97.8], [37, 93.5]),
    ],
    loopMs: 3600,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * THE REST OF THE CATALOGUE — 2026-10-15 accuracy pass.
   *
   * A user reported the standing torso twist playing the wrong movement. It
   * was: flex_14 had no profile of its own and fell back to the flexibility
   * family loop (a reach-up into a forward fold). So did forty other
   * exercises — crunches, sit-ups and V-ups drew a STANDING knee tuck, every
   * stretch drew the same fold, lateral raises drew an overhead press. Every
   * catalogued exercise now has a profile of its own, authored on constant
   * bone lengths (so nothing stretches mid-rep) and checked frame by frame.
   * ══════════════════════════════════════════════════════════════════════ */

  // Standing torso twist — arms swing loose around the body, head follows,
  // trailing heel pivots.
  torsoTwist: {
    frames: [
      P([50, 17], [50, 33], [56.1, 44.5], [67.5, 48.2], [50, 58], [50, 77], [50, 94]),
      P([50, 17], [50, 33], [42.7, 43.8], [31, 46.3], [50, 58], [56.5, 75.9], [53, 92.5]),
    ],
    framesFar: [
      F([42.7, 43.8], [31, 46.3], [53.3, 76.7], [47, 92.5]),
      F([56.1, 44.5], [67.5, 48.2], [50, 77], [50, 94]),
    ],
    loopMs: 2400,
  },

  // Band face pull: arms reach forward at face height, then elbows drive high
  // and wide, hands to the ears.
  facePull: {
    frames: [
      P([47.1, 17.1], [48.3, 33.1], [61.1, 31.3], [72.9, 29.2], [50, 58], [54.5, 76.5], [57.8, 93.1]),
      P([47.1, 17.1], [48.3, 33.1], [37.3, 26.1], [48.6, 22], [50, 58], [54.5, 76.5], [57.8, 93.1]),
    ],
    framesFar: [
      F([61.1, 31.3], [72.9, 29.2], [46.3, 76.6], [42.2, 93.1]),
      F([37.3, 26.1], [48.6, 22], [46.3, 76.6], [42.2, 93.1]),
    ],
    loopMs: 2200,
  },

  // Forearms on the door frame at shoulder height (goal posts); the chest
  // leans gently through.
  doorwayStretch: {
    frames: [
      P([54.3, 17.2], [52.6, 33.1], [39.7, 34.9], [41, 23], [50, 58], [56, 76], [60.6, 92.4]),
      P([60.2, 18.5], [56.6, 34], [43.6, 34.5], [44.5, 22.5], [51, 58.4], [56.5, 76.6], [60.8, 93]),
    ],
    framesFar: [
      F([39.7, 34.9], [41, 23], [44.4, 76.2], [38.7, 92.2]),
      F([43.6, 34.5], [44.5, 22.5], [44.9, 76.4], [38.7, 92.2]),
    ],
    loopMs: 4200,
  },

  // Wide stance, toes out; sink straight down with the knees pushing out over
  // the toes. Hands at the chest.
  sumoSquat: {
    frames: [
      P([50, 17], [50, 33], [41.9, 43.2], [53.6, 46], [50, 58], [50, 77], [50, 94]),
      P([54.1, 32.6], [51.3, 48.4], [43.6, 58.8], [55.6, 58], [47, 73], [63.5, 82.5], [51, 94]),
    ],
    loopMs: 2400,
  },

  // Standing on one leg, the other foot just off the floor; a quiet sway, arms
  // a little out.
  singleLegBalance: {
    frames: [
      P([50, 17], [50, 33], [50.9, 46], [53, 57.8], [50, 58], [56, 76], [41, 84]),
      P([49.9, 17], [50.2, 33], [52.4, 45.8], [55.7, 57.3], [50.6, 58], [56.6, 76], [41.6, 84]),
    ],
    framesFar: [
      F([50.9, 46], [53, 57.8], [50, 77], [50, 94]),
      F([52.4, 45.8], [55.7, 57.3], [50.7, 77], [50, 94]),
    ],
    loopMs: 4200,
  },

  // Squat holding the weight at the chest, elbows down and inside the knees at
  // the bottom.
  gobletSquat: {
    frames: [
      P([50, 17], [50, 33], [41.6, 43], [53.6, 44], [50, 58], [50, 77], [50, 94]),
      P([59.7, 36.5], [53.2, 51.2], [48.9, 63.4], [59.6, 58], [43, 74], [61, 80.2], [51, 94]),
    ],
    loopMs: 2400,
  },

  // Squat, then explode off the floor with the arms swinging up; land soft
  // back into the squat.
  jumpSquat: {
    frames: [
      P([63.2, 37.8], [55.7, 51.9], [49.6, 63.4], [43.3, 73.6], [44, 74], [61.7, 80.8], [51, 94]),
      P([51.4, 8], [50.9, 24], [57, 12.5], [61.1, 1.3], [50, 49], [48.7, 68], [46.9, 84.9]),
    ],
    loopMs: 1400,
  },

  // Stay low and pulse a few inches up and down without standing.
  squatPulse: {
    frames: [
      P([61, 38.1], [54, 52.5], [66.5, 56.1], [78.4, 57.4], [43, 75], [61.2, 80.4], [51, 94]),
      P([59.9, 32], [53.9, 46.8], [66.5, 50], [78.4, 50.8], [44.5, 70], [60.7, 80], [51, 94]),
    ],
    loopMs: 900,
  },

  // Rest at the very bottom of a squat, heels down, elbows pressing the knees
  // out, palms together.
  deepSquat: {
    frames: [
      P([55.7, 45], [50.7, 60.2], [52.2, 73.1], [56.6, 62], [43, 84], [61.6, 79.9], [52, 94]),
      P([57, 46], [51.6, 61], [53.3, 73.9], [57.1, 62.5], [43, 84.5], [61.4, 79.9], [52, 94]),
    ],
    loopMs: 4200,
  },

  // From a quarter squat, explode into the air with arms and legs flung wide
  // into a star.
  starJump: {
    frames: [
      P([56.9, 25.2], [53, 40.7], [48.6, 53], [44.1, 64.1], [47, 65], [59.5, 79.3], [51, 94]),
      P([50, 9], [50, 25], [52.3, 12.2], [53.5, 0.3], [50, 50], [51.3, 69], [51.9, 85.9]),
    ],
    loopMs: 1200,
  },

  // Low athletic stance, the fastest smallest steps on the spot, arms pumping.
  fastFeet: {
    frames: [
      P([58.3, 25.6], [53.9, 41], [44.8, 50.3], [56.6, 48], [47, 65], [62.5, 75.9], [53, 90]),
      P([58.3, 25.6], [53.9, 41], [42.7, 47.6], [48.6, 58], [47, 65], [60.2, 78.6], [53, 94]),
    ],
    framesFar: [
      F([41.9, 46], [42.6, 58], [59.1, 79.6], [50, 94]),
      F([44.8, 50.3], [56.6, 48], [61.4, 77.4], [50, 90]),
    ],
    loopMs: 420,
  },

  // On one foot, rise as high as possible onto the ball of the foot; the free
  // foot hooks behind.
  singleCalfRaise: {
    frames: [
      P([50, 17], [50, 33], [50.9, 46], [52.6, 57.9], [50, 58], [50, 77], [50, 94]),
      P([50, 11], [50, 27], [50.9, 40], [52.6, 51.9], [50, 52], [50, 71], [50, 88]),
    ],
    framesFar: [
      F([50.9, 46], [52.6, 57.9], [55.9, 76.1], [40, 82]),
      F([50.9, 40], [52.6, 51.9], [55.9, 70.1], [40, 76]),
    ],
    loopMs: 1800,
  },

  // Supine, knees bent, hands behind the head: the shoulders curl off the
  // floor and lower.
  crunch: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [19.4, 86.2], [12.7, 96.2], [57, 89.5], [72.4, 78.3], [79, 94]),
      P([22.6, 67.8], [34.5, 78.5], [25.6, 69], [15.5, 75.5], [57, 89.5], [72.4, 78.3], [79, 94]),
    ],
    loopMs: 2000,
  },

  // Full sit-up: from flat, curl the whole torso up until the chest nears the
  // thighs.
  situp: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [19.4, 86.2], [12.7, 96.2], [57, 89.5], [72.4, 78.3], [79, 94]),
      P([74.4, 52.5], [66.4, 66.3], [73.4, 55.4], [63.1, 49.3], [57, 89.5], [72.4, 78.3], [79, 94]),
    ],
    loopMs: 2600,
  },

  // Lying long with arms overhead, lift legs and torso together into a V,
  // hands reaching for the feet.
  vUp: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [19.5, 85.9], [7.8, 83.4], [57, 89.5], [75.8, 92], [92.7, 93.9]),
      P([36, 55.9], [43, 70.3], [51, 60], [59.4, 51.4], [57, 91], [68.7, 76], [79.2, 62.6]),
    ],
    loopMs: 2400,
  },

  // Legs straight up; crunch the shoulders off the floor reaching the hands
  // toward the toes.
  toeTouch: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [31.5, 76.5], [31.5, 64.5], [57, 89.5], [57.7, 70.5], [58.3, 53.5]),
      P([22.3, 68.3], [34.5, 78.5], [42, 67.9], [49.4, 58.5], [57, 89.5], [57.7, 70.5], [58.3, 53.5]),
    ],
    loopMs: 1900,
  },

  // Shoulders held curled, feet flat and wide; reach one hand down the side
  // toward its heel, then the other.
  heelTap: {
    frames: [
      P([20.2, 72], [33.5, 80.9], [44.9, 87.3], [55.6, 92.5], [57, 89.5], [71.9, 77.8], [77, 94]),
      P([20.2, 72], [33.5, 80.9], [44.5, 87.8], [42.6, 76], [57, 89.5], [71.9, 77.8], [77, 94]),
    ],
    framesFar: [
      F([44.5, 87.8], [42.6, 76], [71.9, 77.8], [77, 94]),
      F([44.9, 87.3], [55.6, 92.5], [71.9, 77.8], [77, 94]),
    ],
    loopMs: 1500,
  },

  // Supine, arms to the ceiling, knees over hips: extend one arm overhead and
  // the opposite leg long, then switch.
  deadBug: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [21, 82.6], [10.4, 77], [57, 89.5], [57, 70.5], [74, 70.5]),
      P([16.1, 87.7], [32, 89.5], [32, 76.5], [32, 64.5], [57, 89.5], [76, 88.2], [92.9, 87.6]),
    ],
    framesFar: [
      F([32, 76.5], [32, 64.5], [76, 88.2], [92.9, 87.6]),
      F([21, 82.6], [10.4, 77], [57, 70.5], [74, 70.5]),
    ],
    loopMs: 2600,
  },

  // Banana shape: lower back down, shoulders and straight legs a few inches
  // up, arms long overhead.
  hollowHold: {
    frames: [
      P([18.1, 78.1], [33, 84.1], [20.8, 79.7], [9.3, 76], [57, 91], [75.7, 87.4], [92.3, 84.1]),
      P([18.5, 77.4], [33.2, 83.8], [21.1, 79], [9.7, 75], [57, 91.3], [75.5, 87.2], [92.1, 83.5]),
    ],
    loopMs: 4200,
  },

  // The hollow shape held rigid and rocked from shoulders to hips.
  hollowRock: {
    frames: [
      P([16.7, 83.6], [32.2, 87.5], [19.5, 84.8], [7.7, 82.7], [57, 91], [74.6, 83.9], [90.4, 77.5]),
      P([21.2, 67.9], [33.8, 77.8], [23.3, 70.1], [13.3, 63.4], [55, 91], [74, 91.7], [91, 92.3]),
    ],
    loopMs: 1300,
  },

  // Lying long, hands under the glutes, straight legs scissor in small fast
  // kicks just off the floor.
  flutterKick: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [44.7, 92.2], [56.7, 93], [57, 89.5], [75.5, 85.2], [92.1, 81.4]),
      P([16.1, 87.7], [32, 89.5], [44.7, 92.2], [56.7, 93], [57, 89.5], [76, 88.8], [93, 88.2]),
    ],
    framesFar: [
      F([44.7, 92.2], [56.7, 93], [76, 88.8], [93, 88.2]),
      F([44.7, 92.2], [56.7, 93], [75.5, 85.2], [92.1, 81.4]),
    ],
    loopMs: 620,
  },

  // Knees at 90° over the hips; curl them toward the chest so the hips peel
  // off the floor, then lower.
  reverseCrunch: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [44.8, 91.5], [56.8, 92.8], [57, 89.5], [57, 70.5], [74, 71.1]),
      P([16.3, 88.6], [32.3, 89.2], [45.1, 91.2], [57, 92.5], [57, 85.5], [45.3, 70.5], [53.3, 55.5]),
    ],
    loopMs: 2200,
  },

  // Hands behind the head, shoulders up, legs pedalling: one knee drives in as
  // the other leg extends.
  bicycleCrunch: {
    frames: [
      P([21.9, 69], [34.2, 79.3], [25, 70.1], [15, 76.8], [57, 89.5], [48.1, 72.7], [64.9, 70.4]),
      P([21.9, 69], [34.2, 79.3], [25, 70.1], [15, 76.8], [57, 89.5], [75.6, 85.5], [92.3, 82.6]),
    ],
    framesFar: [
      F([25, 70.1], [15, 76.8], [75.6, 85.5], [92.3, 82.6]),
      F([25, 70.1], [15, 76.8], [48.1, 72.7], [64.9, 70.4]),
    ],
    loopMs: 1300,
  },

  // Seated V balancing on the sit bones: chest lifted, legs raised, arms
  // reaching forward alongside them.
  boatHold: {
    frames: [
      P([32.2, 55.2], [38.8, 69.8], [51.7, 68.4], [63.7, 67.6], [52, 91], [64.7, 76.9], [76.1, 64.2]),
      P([33.2, 54.7], [39.3, 69.5], [52.3, 68.4], [64.3, 67.9], [52, 91], [64.3, 76.6], [75.4, 63.6]),
    ],
    loopMs: 4200,
  },

  // Prone, hands under the shoulders: press the chest up with hips and legs
  // staying on the floor.
  cobra: {
    frames: [
      P([16, 89.4], [32, 90], [45, 91.1], [33.6, 95], [57, 90], [75.9, 91.8], [92.9, 93.2]),
      P([27.3, 62.8], [36.3, 76], [38.9, 88.8], [28.6, 95], [57, 90], [75.9, 91.8], [92.9, 93.2]),
    ],
    loopMs: 4000,
  },

  // Prone Y-T raises. From above the arms switch between a Y and a T; from the
  // side they lift off the floor.
  yRaise: {
    frames: [
      P([16, 88.4], [32, 89.6], [19.1, 88.2], [7.1, 87.4], [57, 90], [75.9, 91.8], [92.9, 93.2]),
      P([16.6, 83.2], [32.2, 86.5], [20.4, 81.2], [9.2, 76.7], [57, 90], [75.9, 91.8], [92.9, 93.2]),
    ],
    loopMs: 2600,
  },

  // Supine figure-4: one ankle crossed over the other knee, hands pulling the
  // supporting thigh toward the chest.
  figureFour: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [41.7, 80.8], [51, 73.3], [57, 89.5], [74.3, 81.7], [62, 70]),
      P([16.1, 87.7], [32, 89.5], [40.4, 79.6], [48.7, 70.9], [57, 89.5], [72.4, 78.4], [59, 68]),
    ],
    framesFar: [
      F([41.7, 80.8], [51, 73.3], [53, 70.9], [68.8, 64.5]),
      F([40.4, 79.6], [48.7, 70.9], [49.9, 71.9], [64.6, 63.4]),
    ],
    loopMs: 4200,
  },

  // Sit tall with legs long, then hinge forward from the hips reaching toward
  // the feet.
  seatedFold: {
    frames: [
      P([41.4, 48.9], [38.6, 64.6], [43.1, 76.9], [53.5, 82.9], [36, 89.5], [55, 90], [72, 90.4]),
      P([72.9, 72.1], [57.7, 77], [70.6, 77.9], [82.6, 78.7], [36, 89.5], [55, 90], [72, 90.4]),
    ],
    loopMs: 4200,
  },

  // Full bridge (wheel): hands and feet on the floor, arms pressing straight,
  // hips and chest lifted high.
  wheel: {
    frames: [
      P([22.3, 90.4], [38.2, 89.3], [26.7, 83.4], [23.6, 95], [60, 77], [79, 77], [79, 94]),
      P([24.9, 87.3], [36.4, 76.1], [25.3, 83], [24.6, 95], [60, 68], [76.6, 77.2], [79, 94]),
    ],
    loopMs: 3600,
  },

  // Forearm plank: elbows under shoulders, one straight line from head to
  // heels. A breathing hold.
  forearmPlank: {
    frames: [
      P([76.1, 70.2], [64.1, 73], [64.1, 86], [77.1, 86], [40.5, 78.4], [26.2, 81.7], [12, 85]),
      P([76.4, 71.3], [64.3, 73.8], [64.3, 86.8], [77.3, 86.8], [40.6, 78.9], [26.3, 82], [12, 85]),
    ],
    loopMs: 4200,
  },

  // Forearm plank from the knees: one straight line from head to knees, feet
  // resting up.
  kneePlank: {
    frames: [
      P([76.2, 68.6], [64.6, 72.8], [64.6, 85.8], [77.6, 85.8], [41.7, 81], [28, 86], [19, 74.5]),
      P([76.5, 69.7], [64.9, 73.6], [64.9, 86.6], [77.9, 86.6], [41.8, 81.3], [28, 86], [19, 74.5]),
    ],
    loopMs: 4200,
  },

  // High plank, hips still: one hand lifts to tap the opposite shoulder, then
  // the other.
  shoulderTap: {
    frames: [
      P([77, 54.5], [66, 60], [70.8, 72.1], [60.6, 64], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
    ],
    framesFar: [
      F([66, 73], [66, 86], [31.6, 78.2], [18.7, 85]),
      F([70.8, 72.1], [60.6, 64], [31.6, 78.2], [18.7, 85]),
    ],
    loopMs: 1400,
  },

  // From a forearm plank, press up one arm at a time into a high plank, then
  // lower back down.
  plankUpDown: {
    frames: [
      P([82.8, 70.2], [70.8, 73], [70.8, 86], [83.8, 86], [47.2, 78.4], [32.9, 81.7], [18.7, 85]),
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
    ],
    loopMs: 2200,
  },

  // Push-up from the knees: one line from head to knees, chest lowering
  // between the hands.
  kneePushup: {
    frames: [
      P([75.1, 51.8], [66, 60], [66, 73], [66, 86], [47.9, 76.3], [37, 86], [28, 74.5]),
      P([86, 71], [74.2, 74.6], [61.2, 73.9], [66, 86], [51, 81.7], [37, 86], [28, 74.5]),
    ],
    loopMs: 2200,
  },

  // Hands on a raised surface, body in one straight incline; the chest lowers
  // to the edge.
  inclinePushup: {
    frames: [
      P([67.3, 50.3], [58, 58.4], [66.5, 68.2], [75, 78], [39.6, 74.3], [28.6, 83.9], [17.6, 93.5]),
      P([74.6, 60.6], [63.9, 66.8], [62.2, 79.6], [75.1, 78], [42.9, 78.9], [30.2, 86.2], [17.6, 93.5]),
    ],
    loopMs: 2200,
  },

  // Feet up on a bench, hands on the floor; the body declines toward the head
  // as the chest lowers.
  declinePushup: {
    frames: [
      P([76.6, 68.9], [64.4, 68], [64.4, 81], [64.4, 94], [40.1, 66.2], [25.6, 65.1], [11, 64]),
      P([73.8, 83.7], [62.1, 80], [52.5, 88.8], [64.4, 94], [38.9, 72.7], [24.9, 68.4], [11, 64]),
    ],
    loopMs: 2200,
  },

  // Inverted V, hips high: bend the elbows to lower the head toward the floor
  // between the hands.
  pikePushup: {
    frames: [
      P([63.5, 80.6], [47.9, 76.7], [57.3, 85.7], [66, 94], [29.9, 59.4], [25.1, 77.8], [20, 94]),
      P([53.9, 95], [49.8, 79.5], [54.2, 91.8], [66, 94], [33, 61], [29, 79.6], [20, 94]),
    ],
    loopMs: 2400,
  },

  // From an inverted V, swoop the chest low and forward up into an upward dog,
  // then back.
  hinduPushup: {
    frames: [
      P([63.5, 80.6], [47.9, 76.7], [57.3, 85.7], [66, 94], [29.9, 59.4], [25.1, 77.8], [20, 94]),
      P([68.1, 53.5], [64.2, 69], [64.2, 82], [64.2, 94], [53.3, 91.5], [34.3, 92.8], [17.4, 94]),
    ],
    loopMs: 2800,
  },

  // High plank with locked arms: the chest sinks between the shoulder blades,
  // then pushes the floor away.
  scapPushup: {
    frames: [
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
      P([78.4, 57.2], [67.1, 62.2], [61.3, 73.9], [66, 86], [45.1, 72.6], [31.9, 78.8], [18.7, 85]),
    ],
    loopMs: 1600,
  },

  // As the chest lowers, one knee draws out and up toward the same-side elbow.
  spidermanPushup: {
    frames: [
      P([77, 54.5], [66, 60], [66, 73], [66, 86], [44.5, 71.4], [31.6, 78.2], [18.7, 85]),
      P([83.9, 76.4], [71.7, 78], [59, 75], [66, 86], [47.6, 81.2], [58.8, 71.8], [46.1, 79.1]),
    ],
    framesFar: [
      F([66, 73], [66, 86], [31.6, 78.2], [18.7, 85]),
      F([59, 75], [66, 86], [33.1, 83.1], [18.7, 85.1]),
    ],
    loopMs: 2400,
  },

  // Back to a chair, hands on its edge: bend the elbows straight back to lower
  // the hips, then press up.
  dip: {
    frames: [
      P([37, 26.8], [36.5, 42.7], [36.2, 55.7], [36.6, 67.7], [40, 67.5], [53.6, 80.8], [65.2, 93.2]),
      P([38.6, 39.3], [37.5, 55.2], [26.5, 62.1], [36.6, 68.5], [41, 80], [60, 79], [68, 94]),
    ],
    loopMs: 2200,
  },

  // Standing at arm's length, palms on the wall: bend the elbows to bring the
  // chest to the wall.
  wallPushup: {
    frames: [
      P([55.4, 18.5], [52.2, 34.2], [64.7, 37.6], [76.5, 40], [47.2, 58.7], [43.4, 77.3], [40, 94]),
      P([71.3, 23.7], [64.8, 38.3], [70.2, 50.1], [76.6, 40], [54.6, 61.1], [46.9, 78.5], [40, 94]),
    ],
    loopMs: 2200,
  },

  // Handstand against the wall: bend the elbows to lower the crown of the head
  // toward the floor.
  handstandPushup: {
    frames: [
      P([54.6, 82.9], [46.6, 69], [46.6, 82], [46.6, 94], [46.6, 44], [46.6, 25], [46.6, 8]),
      P([54.1, 94.1], [46.6, 80], [56.9, 87.9], [46.6, 94], [46.6, 55], [46.6, 36], [46.6, 19]),
    ],
    loopMs: 2600,
  },

  // Lying on a flat bench: press the dumbbells from the chest to straight arms
  // over the shoulders.
  chestPress: {
    frames: [
      P([17, 70.9], [33, 72], [33, 59], [33, 47], [58, 72], [76.3, 77.2], [79, 94]),
      P([17, 70.9], [33, 72], [21.8, 65.3], [33.6, 63], [58, 72], [76.3, 77.2], [79, 94]),
    ],
    loopMs: 2400,
  },

  // Upper back on a bench edge, feet flat: drive the hips up until the torso
  // is level, then lower.
  hipThrust: {
    frames: [
      P([15.9, 69.1], [30.9, 74.6], [18.4, 71], [6.4, 70.6], [52, 88], [68.2, 78], [74, 94]),
      P([15, 72.9], [30.9, 74.6], [18.1, 72.3], [6.1, 72.3], [55.9, 74.6], [74.7, 77], [74, 94]),
    ],
    loopMs: 2400,
  },

  // Kneeling tall with the ankles anchored: lower the rigid body toward the
  // floor as slowly as possible.
  nordicCurl: {
    frames: [
      P([28, 33.3], [28, 49.3], [29.8, 62.1], [33.5, 73.5], [28, 74.3], [28, 93.3], [11, 93.3]),
      P([80, 63.3], [66.1, 71.3], [70.6, 83.5], [77.3, 93.4], [44.5, 83.8], [28, 93.3], [11, 93.3]),
    ],
    loopMs: 3600,
  },

  // Lunge, explode up and switch legs in the air, landing in a lunge on the
  // other side.
  jumpLunge: {
    frames: [
      P([47, 31], [47, 47], [53.9, 58], [65.2, 62.1], [47, 72], [65.3, 77], [65, 94]),
      P([47, 31], [47, 47], [40.1, 58], [29.7, 64], [47, 72], [42.9, 90.6], [26, 92]),
    ],
    framesFar: [
      F([40.1, 58], [29.7, 64], [42.9, 90.6], [26, 92]),
      F([53.9, 58], [65.2, 62.1], [65.3, 77], [65, 94]),
    ],
    loopMs: 1100,
  },

  // Bulgarian split squat: rear foot on a bench behind; the front knee bends
  // to a 90° lunge.
  splitSquat: {
    frames: [
      P([52, 18], [52, 34], [52, 47], [53, 59], [52, 59], [58.6, 76.8], [63.7, 93]),
      P([47, 34], [47, 50], [47, 63], [48, 75], [47, 75], [65.9, 77.1], [64, 94]),
    ],
    framesFar: [
      F([52, 47], [53, 59], [38.4, 72.3], [22, 68]),
      F([47, 63], [48, 75], [29.8, 83.1], [22, 68]),
    ],
    loopMs: 2400,
  },

  // One whole foot on a step: drive through it to stand tall on top, then
  // lower slowly.
  stepUp: {
    frames: [
      P([52.3, 17.7], [50.6, 33.6], [55.1, 45.9], [61.1, 56.2], [48, 58.5], [65.8, 65.1], [64, 82]),
      P([63, 5], [63, 21], [62.1, 34], [62.5, 46], [63, 46], [64.5, 64.9], [65, 81.9]),
    ],
    framesFar: [
      F([46.2, 45.9], [44.1, 57.7], [48.1, 77.5], [44, 94]),
      F([62.1, 34], [62.5, 46], [69.1, 64], [57, 76]),
    ],
    loopMs: 2400,
  },

  // On one leg, sink and reach the rear knee down toward the floor behind;
  // arms forward.
  skaterSquat: {
    frames: [
      P([50, 17], [50, 33], [62.8, 35.3], [74.8, 35.7], [50, 58], [50, 77], [50, 94]),
      P([66.1, 41.2], [56.2, 53.8], [69, 51.1], [80.8, 49], [43, 75], [61.4, 79.8], [52, 94]),
    ],
    framesFar: [
      F([62.8, 35.3], [74.8, 35.7], [54.9, 76.4], [38, 78]),
      F([69, 51.1], [80.8, 49], [38.2, 93.4], [24, 84]),
    ],
    loopMs: 2600,
  },

  // Single-leg squat to full depth, the other leg held long in front, arms
  // forward to balance.
  pistolSquat: {
    frames: [
      P([50, 17], [50, 33], [63, 33.9], [75, 33.9], [50, 58], [50, 77], [50, 94]),
      P([64.9, 47.8], [55.7, 60.9], [68.7, 59.6], [80.6, 58.3], [44, 83], [62.9, 80.9], [52, 94]),
    ],
    framesFar: [
      F([63, 33.9], [75, 33.9], [55.9, 76.1], [61.1, 92.2]),
      F([68.7, 59.6], [80.6, 58.3], [63, 82.3], [80, 81.7]),
    ],
    loopMs: 3000,
  },

  // Balancing on one leg, hinge forward as the free leg extends straight back
  // in one long line.
  singleLegRdl: {
    frames: [
      P([50, 17], [50, 33], [50, 46], [51, 58], [50, 58], [50, 77], [50, 94]),
      P([86.6, 53.3], [70.8, 55.5], [70.8, 68.5], [70.8, 80.5], [46, 59], [51.1, 77.3], [48, 94]),
    ],
    framesFar: [
      F([50, 46], [51, 58], [39.6, 73.9], [45, 90]),
      F([70.8, 68.5], [70.8, 80.5], [27.2, 61.6], [10.4, 64]),
    ],
    loopMs: 3000,
  },

  // Hike the bell back between the legs, then snap the hips forward to float
  // it to chest height.
  kbSwing: {
    frames: [
      P([76.1, 39.3], [63.2, 48.8], [56.3, 59.8], [51.4, 70.7], [42, 62], [53.6, 77.1], [52, 94]),
      P([50, 17], [50, 33], [63, 33.7], [75, 33.7], [50, 58], [51.5, 76.9], [52, 93.9]),
    ],
    loopMs: 1600,
  },

  // Hands behind the head, soft knees: hinge at the hips until the back is
  // nearly level, then stand.
  goodMorning: {
    frames: [
      P([50, 17], [50, 33], [44, 21.5], [55.1, 17], [50, 58], [50, 77], [50, 94]),
      P([84, 47.3], [68.8, 52.3], [79, 44.2], [83.2, 55.4], [45, 60], [52.9, 77.3], [50, 94]),
    ],
    loopMs: 2600,
  },

  // Standing tall on one leg, curl the other heel up toward the glute, then
  // lower with control.
  hamstringCurl: {
    frames: [
      P([50, 17], [50, 33], [54.4, 45.2], [63.6, 52.9], [50, 58], [44.6, 76.2], [51, 92]),
      P([50, 17], [50, 33], [54.4, 45.2], [63.6, 52.9], [50, 58], [47.7, 76.9], [41.3, 61.1]),
    ],
    framesFar: [
      F([54.4, 45.2], [63.6, 52.9], [50, 77], [50, 94]),
      F([54.4, 45.2], [63.6, 52.9], [50, 77], [50, 94]),
    ],
    loopMs: 2400,
  },

  // On all fours, knee bent at 90°: drive the heel up toward the ceiling, then
  // lower without touching down.
  donkeyKick: {
    frames: [
      P([80.5, 64.1], [65, 68], [65.3, 81], [65, 93], [40.7, 74], [38.1, 92.8], [21.1, 91]),
      P([80.5, 64.1], [65, 68], [65.3, 81], [65, 93], [40.7, 74], [22, 70.7], [26.1, 54.2]),
    ],
    framesFar: [
      F([65.3, 81], [65, 93], [40.7, 93], [23.7, 93]),
      F([65.3, 81], [65, 93], [40.7, 93], [23.7, 93]),
    ],
    loopMs: 1800,
  },

  // On all fours: thread one arm under the body, shoulder toward the floor,
  // then sweep it up to the ceiling.
  threadNeedle: {
    frames: [
      P([79.8, 79.8], [65.6, 72.3], [56.9, 81.9], [48.3, 90.3], [40.7, 74], [40.7, 93], [23.7, 93]),
      P([77, 56.8], [64.7, 67.1], [63.8, 54.1], [63.4, 42.1], [40.7, 74], [40.7, 93], [23.7, 93]),
    ],
    framesFar: [
      F([72.3, 83.4], [65, 93], [40.7, 93], [23.7, 93]),
      F([65.2, 80.1], [65, 92.1], [40.7, 93], [23.7, 93]),
    ],
    loopMs: 3600,
  },

  // Inverted V, hips high and back: heels pedal toward the floor one at a
  // time.
  downDog: {
    frames: [
      P([65.6, 83.5], [50.8, 77.5], [60, 86.7], [68.5, 95.2], [33.1, 59.8], [35.5, 78.6], [25, 92]),
      P([65.6, 83.5], [50.8, 77.5], [60, 86.7], [68.5, 95.2], [33.1, 59.8], [28.1, 78.1], [22, 94]),
    ],
    framesFar: [
      F([60, 86.7], [68.5, 95.2], [28.1, 78.1], [22, 94]),
      F([60, 86.7], [68.5, 95.2], [35.5, 78.6], [25, 92]),
    ],
    loopMs: 3200,
  },

  // Front shin folded across the floor, back leg long behind: sit tall, then
  // fold over the front leg.
  pigeon: {
    frames: [
      P([49.7, 45.4], [47.5, 61.2], [46.1, 74.2], [45.7, 86.2], [44, 86], [61.4, 93.7], [44.4, 93.7]),
      P([83.9, 77.9], [68, 79.6], [80.6, 82.8], [92.5, 84.4], [44, 86.5], [61.4, 94.2], [44.4, 94.2]),
    ],
    framesFar: [
      F([46.1, 74.2], [45.7, 86.2], [25, 87.3], [8.1, 87.9]),
      F([80.6, 82.8], [92.5, 84.4], [25, 87.8], [8.1, 88.4]),
    ],
    loopMs: 4200,
  },

  // Half-kneeling hip-flexor stretch: front knee at 90°, back knee down; the
  // hips press gently forward.
  kneelingLunge: {
    frames: [
      P([46, 35], [46, 51], [55.4, 60], [54.6, 72], [46, 76], [65, 77], [64, 94]),
      P([47.6, 36], [48.1, 52], [57.5, 61], [56.6, 73], [49, 77], [68, 77.5], [64, 94]),
    ],
    framesFar: [
      F([55.4, 60], [54.6, 72], [37, 92.7], [20, 93.3]),
      F([57.5, 61], [56.6, 73], [39, 93.2], [22, 93.3]),
    ],
    loopMs: 4200,
  },

  // Back knee down against the wall with that shin up it, front foot planted:
  // the torso rises tall.
  couchStretch: {
    frames: [
      P([66, 41.1], [59, 55.5], [54.1, 67.6], [62.6, 76], [48, 78], [67, 77], [66, 94]),
      P([47.4, 36], [46.9, 52], [57.1, 60.1], [58.6, 72], [46, 77], [65, 77], [66, 94]),
    ],
    framesFar: [
      F([54.1, 67.6], [62.6, 76], [39.1, 94.8], [39.1, 77.8]),
      F([57.1, 60.1], [58.6, 72], [35.1, 92.6], [35.1, 75.6]),
    ],
    loopMs: 4200,
  },

  // Deep lunge, both hands down inside the front foot; rotate the inside arm
  // up to the ceiling.
  worldsGreatest: {
    frames: [
      P([77, 55.9], [63.2, 63.9], [61.6, 76.8], [59.7, 88.7], [44, 80], [62.9, 77.8], [68, 94]),
      P([65.3, 47], [62, 62.6], [61.5, 49.6], [61.1, 37.6], [44, 80], [62.9, 77.8], [68, 94]),
    ],
    framesFar: [
      F([60.8, 76.7], [58.1, 88.4], [28.9, 91.6], [12, 93]),
      F([60.2, 75.5], [58, 87.3], [28.9, 91.6], [12, 93]),
    ],
    loopMs: 3200,
  },

  // One heel forward, toes up, leg straight: hinge from the hips reaching
  // toward that foot.
  hamstringStretch: {
    frames: [
      P([67, 24.7], [59, 38.5], [60, 51.5], [60.4, 63.5], [48, 61], [58.9, 76.6], [68, 90.9]),
      P([82.5, 45.6], [67.5, 51], [69.8, 63.8], [71.5, 75.7], [45, 62], [57, 76.7], [67.2, 90.3]),
    ],
    framesFar: [
      F([60, 51.5], [60.4, 63.5], [54, 79], [46, 94]),
      F([69.8, 63.8], [71.5, 75.7], [53.7, 78.9], [46, 94]),
    ],
    loopMs: 4200,
  },

  // Standing on one leg, the other heel pulled to the glute with the same-side
  // hand.
  quadStretch: {
    frames: [
      P([50, 17], [50, 33], [43.6, 44.3], [38.2, 55], [50, 58], [46.4, 76.7], [36.4, 62.9]),
      P([49.8, 17], [50.1, 33], [43.8, 44.4], [38.5, 55.2], [50.5, 58], [46.5, 76.6], [36.8, 62.7]),
    ],
    framesFar: [
      F([56.1, 44.5], [65.3, 52.2], [50, 77], [50, 94]),
      F([57, 44], [66.7, 51.1], [50.5, 77], [50.5, 94]),
    ],
    loopMs: 4200,
  },

  // Seated tall, legs long, band around the feet: drive the elbows back to
  // bring the hands to the ribs.
  seatedRow: {
    frames: [
      P([35.4, 48.5], [34.9, 64.5], [47.8, 65.9], [59.8, 66.7], [34, 89.5], [53, 90], [70, 90.4]),
      P([35.4, 48.5], [34.9, 64.5], [29.4, 76.3], [40.6, 72], [34, 89.5], [53, 90], [70, 90.4]),
    ],
    loopMs: 2200,
  },

  // Gripping a door frame, lean back on straight arms; pull the chest to the
  // frame and lower.
  leanRow: {
    frames: [
      P([46.8, 20], [51.2, 35.4], [61.7, 43], [71.8, 49.5], [58.1, 59.4], [63.3, 77.7], [68, 94]),
      P([65.3, 17], [65.9, 33], [61.6, 45.3], [72.6, 50], [66.7, 58], [67.4, 77], [68, 94]),
    ],
    loopMs: 2200,
  },

  // Hanging under a bar with a straight body, heels down: pull the chest up to
  // the bar.
  invertedRow: {
    frames: [
      P([86.4, 72.1], [70.9, 76.2], [72.6, 63.3], [68.6, 52], [46.8, 82.7], [28.4, 87.6], [12, 92]),
      P([80, 55.9], [65.9, 63.4], [56.8, 54.1], [68.6, 52], [43.8, 75.1], [27, 84], [12, 92]),
    ],
    loopMs: 2200,
  },

  // Hang from the bar, hands fixed; drive the elbows down to pull the chin
  // over the bar.
  pullUp: {
    frames: [
      P([50, 28], [50, 44], [50.7, 31], [50.6, 19], [50, 69], [46.7, 87.7], [34.1, 99.1]),
      P([51.1, 7], [50, 23], [38.9, 16.2], [50.6, 19], [50, 48], [46.7, 66.7], [34.1, 78.1]),
    ],
    loopMs: 2600,
  },

  // From standing, hands to the floor, jump the feet back to a high plank,
  // jump them in and stand.
  squatThrust: {
    frames: [
      P([50, 17], [50, 33], [50, 46], [51, 58], [50, 58], [50, 77], [50, 94]),
      P([77.3, 62.7], [62.6, 69], [62.6, 82], [62.6, 94], [39.6, 78.8], [22.1, 86.3], [6.5, 93]),
    ],
    loopMs: 2400,
  },

  // A wrestler's sprawl: hands down, legs kicked back so the hips meet the
  // floor, chest up; then pop back up.
  sprawl: {
    frames: [
      P([59.7, 25], [54.7, 40.2], [64.4, 48.9], [76.3, 50.6], [47, 64], [58.4, 79.2], [50, 94]),
      P([70.3, 58.4], [60, 70.6], [64.7, 82.7], [60.6, 94], [42, 88], [23.1, 90], [6.1, 91.2]),
    ],
    loopMs: 2200,
  },

  // Facing a low step: tap one toe on it, then quickly switch feet, arms
  // pumping.
  toeTap: {
    frames: [
      P([48, 16], [48, 32], [41.9, 43.5], [45.2, 55], [48, 57], [64.2, 67], [64, 84]),
      P([48, 16], [48, 32], [55.3, 42.8], [67.2, 41.5], [48, 57], [47.3, 76], [46.7, 93]),
    ],
    framesFar: [
      F([55.3, 42.8], [67.2, 41.5], [47.3, 76], [46.7, 93]),
      F([41.9, 43.5], [45.2, 55], [64.2, 67], [64, 84]),
    ],
    loopMs: 700,
  },

  // One foot planted, the other leg held straight up: drive through the
  // planted heel to lift the hips.
  singleLegBridge: {
    frames: [
      P([16.1, 87.7], [32, 89.5], [44.8, 91.5], [56.8, 92.8], [57, 89.5], [72.4, 78.3], [79, 94]),
      P([22.1, 88.6], [38.1, 88.1], [50.6, 91.7], [62.5, 93.3], [60, 76], [79, 77], [79, 94]),
    ],
    framesFar: [
      F([44.8, 91.5], [56.8, 92.8], [62.9, 71.4], [68.1, 55.3]),
      F([50.6, 91.7], [62.5, 93.3], [70.1, 59.9], [79.1, 45.5]),
    ],
    loopMs: 2400,
  },

  // Hold the bridge up top and march: one knee lifts toward the chest, then
  // the other, hips dead level.
  marchingBridge: {
    frames: [
      P([22.1, 88.6], [38.1, 88.1], [50.6, 91.7], [62.5, 93.3], [60, 76], [55.4, 57.6], [72.4, 57.6]),
      P([22.1, 88.6], [38.1, 88.1], [50.6, 91.7], [62.5, 93.3], [60, 76], [79, 77], [79, 94]),
    ],
    framesFar: [
      F([50.6, 91.7], [62.5, 93.3], [79, 77], [79, 94]),
      F([50.6, 91.7], [62.5, 93.3], [55.4, 57.6], [72.4, 57.6]),
    ],
    loopMs: 1800,
  },
};

export function getSideProfile(motion: FigureMotion): SideProfile {
  return SIDE_PROFILES[motion] ?? SIDE_PROFILES.neutral;
}
