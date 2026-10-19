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

/**
 * Every motion that can be shown from the front. The pattern fallbacks that
 * have a front view and the idle pose are always here; floor and all-fours
 * work has no entry, because the rig cannot foreshorten a bone and its "front"
 * view drew a person standing upright — see animation/cameras.ts.
 */
type AlwaysFront = "squat" | "push" | "pull" | "core" | "cardio" | "flexibility" | "neutral" | "idle";
type FrontProfileMap = Partial<Record<FigureMotion, FrontProfile>> & Record<AlwaysFront, FrontProfile>;

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

/** Node order in an explicit LEFT frame: [x,y] per node. */
export const FRONT_LEFT_NODES = [
  "shoulder",
  "elbow",
  "hand",
  "hip",
  "knee",
  "foot",
] as const;
export const FRONT_LEFT_LEN = FRONT_LEFT_NODES.length * 2; // 12

export interface FrontProfile {
  /** [top, bottom] keyframes, each FRONT_FRAME_LEN numbers (center + right). */
  frames: [number[], number[]];
  /**
   * Optional explicit LEFT limbs — [top, bottom], each FRONT_LEFT_LEN numbers
   * (shoulder, elbow, hand, hip, knee, foot) in the same coordinate space,
   * authored on the x < 50 side.
   *
   * Without it the renderer MIRRORS the right side, which is right for every
   * symmetric movement (a jumping jack, a squat) and wrong for every
   * alternating one: mirroring a high knee gives an athlete with both knees in
   * the air at once. Authoring the left side is what lets one profile show a
   * real left-right cadence.
   */
  framesL?: [number[], number[]];
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

/** The same, for an explicit LEFT side (no centerline nodes). */
const L = (
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [...shoulder, ...elbow, ...hand, ...hip, ...knee, ...foot];

export const FRONT_PROFILES: FrontProfileMap = {
  // Bodyweight squat — hips sink, knees track out, arms reach forward.
  squat: {
    frames: [
      P([50, 16], [50, 32], [50, 56], [61, 33], [65, 47], [68, 59], [57, 57], [58, 76], [59, 94]),
      P([50, 30], [50, 45], [50, 66], [62, 46], [71, 45], [80, 44], [60, 66], [67, 79], [59, 94]),
    ],
    loopMs: 2400,
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

  // Idle — the figure AT EASE. Not a movement: the player shows it between
  // rounds so the demonstration visibly stops performing the exercise the
  // moment the athlete does. A slow weight-shift and a breath, nothing more.
  idle: {
    frames: [
      P([50, 18], [50, 34], [50, 58], [60, 35], [62, 48], [63, 60], [56, 58], [56, 77], [56, 94]),
      P([51, 20], [51, 36], [50, 59], [61, 37], [63, 50], [64, 61], [56, 59], [57, 78], [56, 94]),
    ],
    loopMs: 4200,
  },

  /* ══════════════════════════════════════════════════════════════════════
   * EXERCISE-SPECIFIC MOVEMENTS
   *
   * The seven pattern profiles above are FALLBACKS — one shape for a whole
   * family. That is fine for an AI-invented move nobody has authored, and
   * badly wrong for the moves people actually recognise: butt kicks, high
   * knees and jumping jacks are three different motions, and drawing them all
   * as one reads as a broken app, not as a stylised one.
   *
   * Every profile below is authored to ONE named exercise family (see
   * exerciseMotions.ts for the id map). Alternating movements carry an
   * explicit `framesL`, because a mirrored high knee is a jumping athlete.
   * ══════════════════════════════════════════════════════════════════════ */

  // ── Cardio ──────────────────────────────────────────────────────────────

  // Jumping jack — arms and legs open and close together.
  jumpingJack: {
    frames: [
      P([50, 18], [50, 32], [50, 56], [59, 33], [61, 46], [62, 58], [55, 57], [55, 75], [55, 92]),
      P([50, 18], [50, 32], [50, 56], [60, 32], [68, 22], [73, 11], [56, 57], [63, 75], [70, 91]),
    ],
    loopMs: 700,
  },

  // Burpee — the whole body drops to the floor and springs back up tall.
  burpee: {
    frames: [
      P([50, 14], [50, 30], [50, 54], [59, 31], [62, 18], [64, 6], [55, 55], [55, 73], [55, 90]),
      P([50, 46], [50, 58], [50, 74], [59, 59], [64, 69], [62, 81], [58, 74], [68, 84], [60, 95]),
    ],
    loopMs: 2600,
  },

  // Jump rope — a small, fast bounce with the elbows pinned and wrists turning.
  jumpRope: {
    frames: [
      P([50, 18], [50, 33], [50, 57], [59, 34], [63, 45], [70, 54], [55, 58], [55, 76], [55, 93]),
      P([50, 15], [50, 30], [50, 54], [59, 31], [63, 42], [69, 52], [55, 55], [56, 72], [54, 88]),
    ],
    loopMs: 620,
  },

  // Lateral shuffle — the whole athlete slides side to side in a low stance.
  lateralShuffle: {
    frames: [
      P([54, 20], [53, 34], [52, 58], [62, 35], [66, 46], [68, 57], [58, 58], [62, 76], [64, 93]),
      P([46, 20], [47, 34], [48, 58], [57, 35], [60, 46], [62, 57], [54, 58], [56, 76], [58, 93]),
    ],
    framesL: [
      L([43, 35], [40, 46], [38, 57], [46, 58], [44, 76], [42, 93]),
      L([38, 35], [34, 46], [32, 57], [42, 58], [38, 76], [36, 93]),
    ],
    loopMs: 760,
  },

  // Skater — a lateral bound landing on one leg, the other swept behind.
  skater: {
    frames: [
      P([56, 20], [54, 34], [52, 58], [62, 34], [64, 46], [62, 57], [57, 58], [62, 76], [64, 93]),
      P([44, 20], [46, 34], [48, 58], [56, 35], [64, 43], [73, 50], [53, 58], [56, 74], [64, 85]),
    ],
    framesL: [
      L([44, 35], [36, 43], [27, 50], [47, 58], [44, 74], [36, 85]),
      L([38, 34], [36, 46], [38, 57], [43, 58], [38, 76], [36, 93]),
    ],
    loopMs: 1100,
  },

  // Shadow boxing — alternating straight punches over a live guard.
  boxing: {
    frames: [
      P([50, 18], [50, 33], [50, 58], [60, 34], [70, 41], [80, 46], [56, 58], [57, 76], [58, 93]),
      P([50, 18], [50, 33], [50, 58], [60, 34], [62, 45], [56, 36], [56, 58], [57, 76], [58, 93]),
    ],
    framesL: [
      L([40, 34], [38, 45], [44, 36], [44, 58], [43, 76], [42, 93]),
      L([40, 34], [30, 41], [20, 46], [44, 58], [43, 76], [42, 93]),
    ],
    loopMs: 700,
  },

  // Tuck jump — load, then leave the floor with the knees pulled to the chest.
  tuckJump: {
    frames: [
      P([50, 24], [50, 38], [50, 60], [59, 39], [60, 51], [58, 62], [56, 60], [60, 77], [58, 94]),
      P([50, 10], [50, 24], [50, 46], [59, 25], [64, 34], [72, 41], [55, 46], [59, 34], [62, 48]),
    ],
    loopMs: 1100,
  },

  // Broad jump — a loaded arm swing into a long forward leap.
  broadJump: {
    frames: [
      P([50, 26], [50, 40], [50, 62], [59, 41], [58, 53], [54, 64], [56, 62], [60, 78], [58, 95]),
      P([50, 18], [50, 32], [50, 54], [59, 33], [63, 44], [66, 55], [56, 54], [58, 72], [57, 90]),
    ],
    loopMs: 1600,
  },

  // Plank jack — the plank never moves; the feet jump wide and back.
  plankJack: {
    frames: [
      P([50, 50], [50, 58], [50, 78], [60, 58], [62, 70], [63, 82], [55, 78], [55, 88], [55, 97]),
      P([50, 50], [50, 58], [50, 78], [60, 58], [62, 70], [63, 82], [55, 78], [62, 86], [68, 94]),
    ],
    loopMs: 800,
  },

  // ── Strength & floor work ───────────────────────────────────────────────

  // Lunge — a split stance sinking straight down, not a squat.
  lunge: {
    frames: [
      P([50, 17], [50, 33], [50, 57], [60, 34], [62, 46], [63, 58], [56, 57], [56, 76], [56, 93]),
      P([50, 29], [50, 45], [50, 68], [60, 46], [62, 58], [63, 70], [56, 68], [58, 86], [58, 98]),
    ],
    framesL: [
      L([40, 34], [38, 46], [37, 58], [44, 57], [44, 76], [44, 93]),
      L([40, 46], [38, 58], [37, 70], [44, 68], [42, 84], [41, 97]),
    ],
    loopMs: 2400,
  },

  // Calf raise — the whole body rises on the toes and lowers.
  calfRaise: {
    frames: [
      P([50, 20], [50, 36], [50, 60], [60, 37], [62, 49], [63, 61], [56, 60], [56, 78], [56, 95]),
      P([50, 14], [50, 30], [50, 54], [60, 31], [62, 43], [63, 55], [56, 54], [56, 72], [56, 89]),
    ],
    loopMs: 1800,
  },

  // Row — hinged at the hip, the elbows drive back past the ribs.
  row: {
    frames: [
      P([50, 40], [50, 50], [50, 68], [60, 50], [62, 62], [63, 74], [56, 68], [56, 84], [56, 97]),
      P([50, 40], [50, 50], [50, 68], [60, 50], [68, 58], [62, 68], [56, 68], [56, 84], [56, 97]),
    ],
    loopMs: 2200,
  },

  // Curl — the elbows stay pinned and only the forearms travel.
  curl: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [62, 46], [63, 58], [56, 58], [56, 77], [56, 94]),
      P([50, 17], [50, 33], [50, 58], [60, 34], [62, 46], [58, 35], [56, 58], [56, 77], [56, 94]),
    ],
    loopMs: 2000,
  },

  // Forearm side plank seen from the front: one low straight line, feet
  // stacked, top arm to the ceiling.
  sidePlank: {
    frames: [
      P([82.5, 65], [67.5, 70.4], [44, 79], [70, 80.2], [70, 93.4], [82, 93.4], [46.1, 84.6], [27.9, 90.1], [11.2, 93.5]),
      P([82.8, 66.5], [67.6, 71.7], [44, 79.8], [69.9, 81.4], [69.9, 94.6], [81.9, 94.6], [46, 85.5], [28.1, 92.1], [11.2, 93.5]),
    ],
    framesL: [
      L([63.1, 61.4], [63.1, 48.2], [63.1, 36.2], [41.9, 73.4], [23.6, 78.5], [7.1, 82.3]),
      L([63.4, 62.5], [63.4, 49.3], [63.4, 37.3], [42, 74.1], [23.7, 78.9], [7, 82.3]),
    ],
    loopMs: 4000,
  },

  // Russian twist — seated and leaning back, the torso rotates side to side.
  russianTwist: {
    frames: [
      P([58, 32], [54, 46], [50, 68], [62, 46], [70, 54], [76, 62], [56, 68], [62, 80], [58, 92]),
      P([42, 32], [46, 46], [50, 68], [54, 47], [46, 55], [38, 62], [56, 68], [62, 80], [58, 92]),
    ],
    framesL: [
      L([46, 47], [54, 55], [62, 62], [44, 68], [38, 80], [42, 92]),
      L([38, 46], [30, 54], [24, 62], [44, 68], [38, 80], [42, 92]),
    ],
    loopMs: 1600,
  },

  // Wall sit — a held seat. Nothing travels; the athlete simply endures.
  wallSit: {
    frames: [
      P([50, 26], [50, 42], [50, 66], [60, 43], [62, 55], [63, 66], [57, 66], [62, 82], [60, 96]),
      P([50, 27], [50, 43], [50, 67], [60, 44], [62, 56], [63, 67], [57, 67], [62, 83], [60, 97]),
    ],
    loopMs: 4200,
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
      P([51.9, 17.1], [50, 33], [50, 58], [60, 34], [72.9, 36.7], [84, 41.2], [56, 58], [58, 76.9], [59, 93.9]),
      P([48.1, 17.1], [50, 33], [50, 58], [60, 34], [48.9, 41.1], [38.5, 47.1], [56, 58], [51.7, 76.5], [57.5, 92.5]),
    ],
    framesL: [
      L([40, 34], [51.1, 41.1], [61.5, 47.1], [44, 58], [48.3, 76.5], [42.5, 92.5]),
      L([40, 34], [27.1, 36.7], [16, 41.2], [44, 58], [42, 76.9], [41, 93.9]),
    ],
    loopMs: 2400,
  },

  // Arms out at shoulder height; seen from the front a circle is an
  // up-and-down bob of the hands.
  armCircles: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [73.1, 32.4], [85, 30.5], [56, 58], [56, 77], [56, 94]),
      P([50, 17], [50, 33], [50, 58], [60, 34], [73.1, 35.4], [85, 37.3], [56, 58], [56, 77], [56, 94]),
    ],
    loopMs: 1300,
  },

  // Half neck rolls, ear toward one shoulder then the other. Body still.
  neckRoll: {
    frames: [
      P([57.5, 18.9], [50, 33], [50, 58], [60, 34], [62.1, 47], [63.1, 59], [56, 58], [56, 77], [56, 94]),
      P([42.5, 18.9], [50, 33], [50, 58], [60, 34], [62.1, 47], [63.1, 59], [56, 58], [56, 77], [56, 94]),
    ],
    framesL: [
      L([40, 34], [37.9, 47], [36.9, 59], [44, 58], [44, 77], [44, 94]),
      L([40, 34], [37.9, 47], [36.9, 59], [44, 58], [44, 77], [44, 94]),
    ],
    loopMs: 5200,
  },

  // Arms rise out to the sides to shoulder height, elbows soft and leading.
  lateralRaise: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [62.7, 46.9], [64, 58.8], [56, 58], [57.2, 77], [57.5, 94]),
      P([50, 17], [50, 33], [50, 58], [60, 34], [73.2, 33.1], [85.1, 34.5], [56, 58], [57.2, 77], [57.5, 94]),
    ],
    loopMs: 2400,
  },

  // Band pull-apart: hands start together in front of the chest and open into
  // a T.
  pullApart: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [49.5, 26], [50.4, 38], [56, 58], [57.2, 77], [57.5, 94]),
      P([50, 17], [50, 33], [50, 58], [60, 34], [73.2, 33.8], [85.2, 34], [56, 58], [57.2, 77], [57.5, 94]),
    ],
    loopMs: 2000,
  },

  // Band face pull: arms reach forward at face height, then elbows drive high
  // and wide, hands to the ears.
  facePull: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [49.2, 41.6], [52.4, 30], [56, 58], [57.2, 77], [57.5, 94]),
      P([50, 17], [50, 33], [50, 58], [60, 34], [73.2, 33.1], [67.9, 22.3], [56, 58], [57.2, 77], [57.5, 94]),
    ],
    loopMs: 2200,
  },

  // Bent-over reverse fly, seen from the front: the hinged torso foreshortens,
  // arms sweep from hanging to a T.
  reverseFly: {
    frames: [
      P([50, 47], [50, 56], [50, 66], [60, 57], [60.5, 70.2], [60, 82.2], [56, 66], [55.4, 82], [55.4, 96]),
      P([50, 47], [50, 56], [50, 66], [60, 57], [73.1, 55.6], [85.1, 56], [56, 66], [55.4, 82], [55.4, 96]),
    ],
    loopMs: 2400,
  },

  // Forearms on the door frame at shoulder height (goal posts); the chest
  // leans gently through.
  doorwayStretch: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [73.2, 34.2], [73.2, 22.2], [56, 58], [57, 77], [57, 94]),
      P([50, 17.6], [50, 33.6], [50, 58.6], [60, 34.6], [73.2, 35.3], [73.6, 23.3], [56, 58.6], [59.8, 77.2], [57, 94]),
    ],
    loopMs: 4200,
  },

  // Standing on one leg, the other lifts straight out to the side, hands on
  // hips.
  hipAbduction: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [60.5, 47.2], [52.4, 56], [56, 58], [60.2, 76.5], [59, 93.5]),
      P([50, 17], [50, 33], [50, 58], [60, 34], [60.5, 47.2], [52.4, 56], [56, 58], [66.6, 73.8], [76.1, 87.8]),
    ],
    framesL: [
      L([40, 34], [39.5, 47.2], [47.6, 56], [44, 58], [44, 77], [44, 94]),
      L([40, 34], [39.5, 47.2], [47.6, 56], [44, 58], [44, 77], [44, 94]),
    ],
    loopMs: 2200,
  },

  // From a wide stance, sit the hips over one bent leg; the other leg stays
  // long. Hands at the chest.
  lateralLunge: {
    frames: [
      P([50, 19.6], [50, 35.6], [50, 60.6], [60, 36.6], [47, 34.2], [49.4, 46], [56, 60.6], [64.4, 77.6], [69, 94]),
      P([61.4, 29], [60.9, 45], [60, 70], [70.8, 46.4], [57.6, 46.2], [52.4, 57], [66, 70], [80.9, 81.8], [69, 94]),
    ],
    framesL: [
      L([40, 36.6], [53, 34.2], [50.6, 46], [44, 60.6], [35.6, 77.6], [31, 94]),
      L([50.8, 45.7], [63.8, 48.2], [55.6, 57], [54, 70], [46.7, 87.6], [31, 94]),
    ],
    loopMs: 2400,
  },

  // Wide stance, sink deep onto one leg with the other long, then shift across
  // to the other side.
  cossackSquat: {
    frames: [
      P([65.9, 36.1], [64.7, 52.1], [63, 77], [74.6, 53.8], [61.5, 53.1], [56.4, 64], [69, 77], [86.7, 83.9], [73, 94]),
      P([34.1, 36.1], [35.3, 52.1], [37, 77], [45.3, 52.4], [32.4, 55.1], [40.4, 64], [43, 77], [56.4, 90.5], [73, 94]),
    ],
    framesL: [
      L([54.7, 52.4], [67.6, 55.1], [59.6, 64], [57, 77], [43.6, 90.5], [27, 94]),
      L([25.4, 53.8], [38.5, 53.1], [43.6, 64], [31, 77], [13.3, 83.9], [27, 94]),
    ],
    loopMs: 3000,
  },

  // One leg steps diagonally behind and across the other; both knees bend,
  // hips stay square.
  curtsyLunge: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [46.8, 34.3], [49.4, 46], [56, 58], [56, 77], [56, 94]),
      P([49, 26], [49, 42], [49, 67], [59, 43], [45.8, 43.3], [48.4, 55], [55, 67], [38, 75.5], [38, 92.5]),
    ],
    framesL: [
      L([40, 34], [53.2, 34.3], [50.6, 46], [44, 58], [44, 77], [44, 94]),
      L([39, 43], [52.2, 43.1], [50.6, 55], [43, 67], [54.9, 81.8], [43, 94]),
    ],
    loopMs: 2400,
  },

  // Wide stance, toes out; sink straight down with the knees pushing out over
  // the toes. Hands at the chest.
  sumoSquat: {
    frames: [
      P([50, 19], [50, 35], [50, 60], [60, 36], [46.9, 34.3], [49.4, 46], [56, 60], [63.2, 77.6], [68.9, 93.6]),
      P([50, 33], [50, 49], [50, 74], [60, 50], [46.9, 48.3], [49.4, 60], [56, 74], [74.6, 77.9], [69, 94]),
    ],
    loopMs: 2400,
  },

  // Standing on one leg, the other foot just off the floor; a quiet sway, arms
  // a little out.
  singleLegBalance: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [64.5, 46.4], [67, 58.1], [56, 58], [67.8, 72.9], [57, 86]),
      P([49.7, 17], [50.1, 33], [50.8, 58], [60.2, 33.7], [65.5, 45.8], [68.8, 57.3], [56.8, 58], [68.5, 73], [57.5, 86]),
    ],
    framesL: [
      L([40, 34], [35.5, 46.4], [33, 58.1], [44, 58], [44, 77], [44, 94]),
      L([40.2, 34.3], [35.4, 46.6], [32.7, 58.3], [44.8, 58], [45.3, 77], [45, 94]),
    ],
    loopMs: 4200,
  },

  // Hands behind the head; one knee lifts out to the side as the same-side
  // elbow crunches down to meet it.
  sideCrunch: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [66.8, 22.7], [54.9, 21], [56, 58], [56, 77], [56, 94]),
      P([60.7, 19], [55.7, 34.2], [48, 58], [64.9, 38.3], [72, 27.1], [60.4, 24], [53.9, 57.2], [72.8, 59.2], [74.6, 76.1]),
    ],
    framesL: [
      L([40, 34], [33.2, 22.7], [45.1, 21], [44, 58], [44, 77], [44, 94]),
      L([45.9, 32.1], [45.3, 18.9], [56.6, 15], [42.1, 58.8], [46.8, 77.2], [44, 94]),
    ],
    loopMs: 2000,
  },

  // Upright side steps: step out, tap the other foot in, step back the other
  // way.
  stepTouch: {
    frames: [
      P([59, 17.8], [59, 33.8], [59, 58.8], [69, 34.8], [76.4, 45.7], [81.3, 56.7], [65, 58.8], [70.4, 77], [71, 94]),
      P([41, 17.8], [41, 33.8], [41, 58.8], [51, 34.8], [52.8, 47.9], [53.7, 59.8], [47, 58.8], [38.1, 75.6], [40, 92.5]),
    ],
    framesL: [
      L([49, 34.8], [47.2, 47.9], [46.3, 59.8], [53, 58.8], [61.9, 75.6], [60, 92.5]),
      L([31, 34.8], [23.6, 45.7], [18.7, 56.7], [35, 58.8], [29.6, 77], [29, 94]),
    ],
    loopMs: 1300,
  },

  // Squat holding the weight at the chest, elbows down and inside the knees at
  // the bottom.
  gobletSquat: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [46.9, 32.3], [49.4, 44], [56, 58], [58.5, 76.8], [60, 93.8]),
      P([50, 29], [50, 45], [50, 70], [60, 46], [46.8, 45.3], [49.4, 57], [56, 70], [71.3, 81.3], [60, 94]),
    ],
    loopMs: 2400,
  },

  // Squat, then explode off the floor with the arms swinging up; land soft
  // back into the squat.
  jumpSquat: {
    frames: [
      P([50, 29], [50, 45], [50, 70], [60, 46], [57.7, 59], [56.5, 70.9], [56, 70], [70.9, 81.8], [59, 94]),
      P([50, 8], [50, 24], [50, 49], [60, 25], [66.2, 13.3], [70.3, 2.1], [56, 49], [55.3, 68], [54.7, 85]),
    ],
    loopMs: 1400,
  },

  // Stay low and pulse a few inches up and down without standing.
  squatPulse: {
    frames: [
      P([50, 31], [50, 47], [50, 72], [60, 48], [46.9, 46.3], [49.4, 58], [56, 72], [72.1, 82.1], [60, 94]),
      P([50, 26], [50, 42], [50, 67], [60, 43], [46.9, 41.3], [49.4, 53], [56, 67], [69.8, 80.1], [60, 94]),
    ],
    loopMs: 900,
  },

  // Rest at the very bottom of a squat, heels down, elbows pressing the knees
  // out, palms together.
  deepSquat: {
    frames: [
      P([50, 39], [50, 55], [50, 80], [60, 56], [47.8, 51.1], [48.9, 63], [56, 80], [74.8, 82.8], [62, 94]),
      P([50, 39.6], [50, 55.6], [50, 80.6], [60, 56.6], [47.8, 51.6], [48.9, 63.5], [56, 80.6], [74.9, 82.9], [62, 94]),
    ],
    loopMs: 4200,
  },

  // From a quarter squat, explode into the air with arms and legs flung wide
  // into a star.
  starJump: {
    frames: [
      P([50, 23], [50, 39], [50, 64], [60, 40], [58.6, 53.1], [58.2, 65.1], [56, 64], [65.4, 80.5], [55, 94]),
      P([50, 9], [50, 25], [50, 50], [60, 26], [70.1, 17.5], [79, 9.5], [56, 50], [63.7, 67.4], [70.6, 82.9]),
    ],
    loopMs: 1200,
  },

  // Low athletic stance, the fastest smallest steps on the spot, arms pumping.
  fastFeet: {
    frames: [
      P([50, 23], [50, 39], [50, 64], [60, 40], [68.4, 50.2], [56.4, 50], [56, 64], [70.3, 76.5], [60, 90]),
      P([50, 23], [50, 39], [50, 64], [60, 40], [65.7, 51.9], [54.4, 56], [56, 64], [67.8, 78.9], [60, 94]),
    ],
    framesL: [
      L([40, 40], [34.3, 51.9], [45.6, 56], [44, 64], [32.2, 78.9], [40, 94]),
      L([40, 40], [31.6, 50.2], [43.6, 50], [44, 64], [29.7, 76.5], [40, 90]),
    ],
    loopMs: 420,
  },

  // On one foot, rise as high as possible onto the ball of the foot; the free
  // foot hooks behind.
  singleCalfRaise: {
    frames: [
      P([50, 17], [50, 33], [50, 58], [60, 34], [63.4, 46.8], [65.5, 58.6], [56, 58], [41.7, 70.5], [52, 84]),
      P([50, 11], [50, 27], [50, 52], [60, 28], [63.4, 40.8], [65.5, 52.6], [56, 52], [41.7, 64.5], [52, 78]),
    ],
    framesL: [
      L([40, 34], [36.6, 46.8], [34.5, 58.6], [44, 58], [44, 77], [44, 94]),
      L([40, 28], [36.6, 40.8], [34.5, 52.6], [44, 52], [44, 71], [44, 88]),
    ],
    loopMs: 1800,
  },

  // Seen from above, lying face down: the arms hover and sweep from the hips
  // to overhead and back.
  snowAngel: {
    frames: [
      P([81, 60], [65, 60], [40, 60], [64, 70], [51.4, 73.9], [39.7, 76.8], [40, 66], [21, 67.3], [4.1, 67.9]),
      P([81, 60], [65, 60], [40, 60], [64, 70], [76.6, 73.9], [88.3, 76.8], [40, 66], [21, 67.3], [4.1, 67.9]),
    ],
    framesL: [
      L([64, 50], [51.4, 46.1], [39.7, 43.2], [40, 54], [21, 52.7], [4.1, 52.1]),
      L([64, 50], [76.6, 46.1], [88.3, 43.2], [40, 54], [21, 52.7], [4.1, 52.1]),
    ],
    loopMs: 3000,
  },

  // Prone Y-T raises. From above the arms switch between a Y and a T; from the
  // side they lift off the floor.
  yRaise: {
    frames: [
      P([81, 60], [65, 60], [40, 60], [64, 70], [74.1, 78.5], [83.3, 86.2], [40, 66], [21, 67.3], [4.1, 67.9]),
      P([81, 60], [65, 60], [40, 60], [64, 70], [64, 83.2], [64, 95.2], [40, 66], [21, 67.3], [4.1, 67.9]),
    ],
    framesL: [
      L([64, 50], [74.1, 41.5], [83.3, 33.8], [40, 54], [21, 52.7], [4.1, 52.1]),
      L([64, 50], [64, 36.8], [64, 24.8], [40, 54], [21, 52.7], [4.1, 52.1]),
    ],
    loopMs: 2600,
  },

  // Seen from above, lying face up with arms out wide: the legs, held
  // together, sweep from side to side.
  windshieldWiper: {
    frames: [
      P([81, 60], [65, 60], [40, 60], [64, 70], [63.5, 83.2], [63.1, 95.2], [40, 66], [23.9, 55.9], [9.5, 46.9]),
      P([81, 60], [65, 60], [40, 60], [64, 70], [63.5, 83.2], [63.1, 95.2], [40, 66], [23.9, 76.1], [9.5, 85.1]),
    ],
    framesL: [
      L([64, 50], [63.5, 36.8], [63.1, 24.8], [40, 54], [23.9, 43.9], [9.5, 34.9]),
      L([64, 50], [63.5, 36.8], [63.1, 24.8], [40, 54], [23.9, 64.1], [9.5, 73.1]),
    ],
    loopMs: 2600,
  },

  // Forearm side plank: lower the bottom hip toward the floor, then drive it
  // back up.
  sidePlankDip: {
    frames: [
      P([82.5, 65], [67.5, 70.4], [44, 79], [70, 80.2], [70, 93.4], [82, 93.4], [46.1, 84.6], [27.9, 90.1], [11.2, 93.5]),
      P([77.6, 64], [64.5, 73.2], [44, 87.5], [69.4, 81.9], [69.4, 95.1], [81.4, 95.1], [47.4, 92.4], [28.5, 93.4], [11.5, 93.5]),
    ],
    framesL: [
      L([63.1, 61.4], [63.1, 48.2], [63.1, 36.2], [41.9, 73.4], [23.6, 78.5], [7.1, 82.3]),
      L([57.9, 65.5], [57.9, 52.3], [57.9, 40.3], [40.6, 82.6], [22.7, 88.9], [7, 82.3]),
    ],
    loopMs: 2000,
  },

  // Seated tall, soles together, knees dropped out to the sides; the knees
  // ease toward the floor.
  butterfly: {
    frames: [
      P([50, 43], [50, 59], [50, 84], [60, 60], [57.1, 72.9], [53.9, 84.4], [56, 84], [71.5, 85.1], [56.5, 85.9]),
      P([50, 43.4], [50, 59.4], [50, 84.4], [60, 60.4], [57.4, 73.3], [54.4, 85], [56, 84.4], [71, 88.4], [56.1, 90.5]),
    ],
    loopMs: 4200,
  },

  // Seated 90/90: front knee bent in front, back knee bent out to the side;
  // sit tall, then lean over the front shin.
  ninetyNinety: {
    frames: [
      P([50, 43], [50, 59], [50, 84], [60, 60], [58.9, 73.2], [57.3, 85], [56, 84], [71.5, 87.9], [56.6, 88.9]),
      P([59, 43.9], [55.7, 59.5], [50.5, 84], [65.3, 62.6], [63.5, 75.7], [61.2, 87.5], [56.5, 84], [72, 87.9], [57.1, 88.9]),
    ],
    framesL: [
      L([40, 60], [39.5, 73.2], [39.6, 85.2], [44, 84], [28.5, 87.9], [19.2, 99.7]),
      L([45.7, 58.4], [46.1, 71.6], [47.1, 83.6], [44.5, 84], [29, 87.9], [19.7, 99.7]),
    ],
    loopMs: 4200,
  },

  // On all fours, seen head-on: the knee lifts out to the side to hip height,
  // hips staying square.
  fireHydrant: {
    frames: [
      P([50, 58], [50, 68], [50, 74], [62.4, 69.2], [62.9, 82.4], [62.9, 94.4], [56, 74], [56, 93], [56, 96]),
      P([50, 58], [50, 68], [50, 74], [62.4, 69.2], [62.9, 82.4], [62.9, 94.4], [56, 74], [74.9, 76], [75.9, 78.8]),
    ],
    framesL: [
      L([37.6, 69.2], [37.1, 82.4], [37.1, 94.4], [44, 74], [44, 93], [44, 96]),
      L([37.6, 69.2], [37.1, 82.4], [37.1, 94.4], [44, 74], [44, 93], [44, 96]),
    ],
    loopMs: 2000,
  },

  // Hang from the bar, hands fixed; drive the elbows down to pull the chin
  // over the bar.
  pullUp: {
    frames: [
      P([50, 27], [50, 43], [50, 68], [60, 44], [63.6, 31.3], [66.3, 19.6], [56, 68], [55.7, 84], [55.7, 97]),
      P([50, 7], [50, 23], [50, 48], [60, 24], [71.9, 29.6], [66.4, 19], [56, 48], [55.7, 64], [55.7, 77]),
    ],
    loopMs: 2600,
  },

  // Facing a low step: tap one toe on it, then quickly switch feet, arms
  // pumping.
  toeTap: {
    frames: [
      P([50, 16], [50, 32], [50, 57], [60, 33], [66.9, 44.2], [56.4, 50], [56, 57], [66.6, 72.7], [56, 86]),
      P([50, 16], [50, 32], [50, 57], [60, 33], [58.5, 46.1], [56.4, 57.9], [56, 57], [56, 76], [56, 93]),
    ],
    framesL: [
      L([40, 33], [41.5, 46.1], [43.6, 57.9], [44, 57], [44, 76], [44, 93]),
      L([40, 33], [33.1, 44.2], [43.6, 50], [44, 57], [33.4, 72.7], [44, 86]),
    ],
    loopMs: 700,
  },
};

export function getFrontProfile(motion: FigureMotion): FrontProfile {
  return FRONT_PROFILES[motion] ?? FRONT_PROFILES.neutral;
}
