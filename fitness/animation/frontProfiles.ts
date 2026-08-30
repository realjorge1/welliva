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

  // High knees — knee drives to hip height, opposite arm pumps up.
  highKnee: {
    frames: [
      P([50, 17], [50, 32], [50, 56], [60, 32], [62, 45], [57, 56], [56, 56], [60, 38], [58, 55]),
      P([50, 17], [50, 32], [50, 56], [60, 32], [62, 45], [54, 36], [56, 56], [56, 75], [56, 92]),
    ],
    framesL: [
      L([40, 32], [38, 45], [46, 36], [44, 56], [44, 75], [44, 92]),
      L([40, 32], [38, 45], [42, 56], [44, 56], [40, 38], [42, 55]),
    ],
    loopMs: 620,
  },

  // Butt kicks — the heel snaps up toward the glute; the knee barely moves.
  buttKick: {
    frames: [
      P([50, 17], [50, 32], [50, 57], [60, 33], [62, 46], [57, 56], [56, 57], [56, 76], [65, 62]),
      P([50, 17], [50, 32], [50, 57], [60, 33], [62, 46], [55, 38], [56, 57], [56, 76], [56, 93]),
    ],
    framesL: [
      L([40, 33], [38, 46], [45, 38], [44, 57], [44, 76], [44, 93]),
      L([40, 33], [38, 46], [43, 56], [44, 57], [44, 76], [35, 62]),
    ],
    loopMs: 640,
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

  // March in place — the same alternation as a high knee, half the tempo and
  // half the lift.
  march: {
    frames: [
      P([50, 17], [50, 33], [50, 57], [60, 34], [62, 46], [60, 58], [56, 57], [58, 42], [57, 58]),
      P([50, 17], [50, 33], [50, 57], [60, 34], [62, 46], [60, 58], [56, 57], [56, 76], [56, 93]),
    ],
    framesL: [
      L([40, 34], [38, 46], [42, 58], [44, 57], [44, 76], [44, 93]),
      L([40, 34], [38, 46], [40, 58], [44, 57], [42, 42], [43, 58]),
    ],
    loopMs: 1300,
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

  // Bear crawl — a quadruped travelling on hands and toes, hips low.
  bearCrawl: {
    frames: [
      P([50, 42], [50, 54], [50, 74], [60, 54], [64, 68], [66, 82], [56, 74], [62, 84], [60, 95]),
      P([50, 40], [50, 52], [50, 72], [60, 52], [62, 66], [62, 80], [56, 72], [64, 82], [64, 94]),
    ],
    loopMs: 1400,
  },

  // Inchworm — a standing fold that walks its hands out to a plank.
  inchworm: {
    frames: [
      P([50, 46], [50, 58], [50, 76], [59, 58], [61, 70], [62, 82], [55, 76], [55, 86], [55, 96]),
      P([50, 52], [50, 62], [50, 78], [59, 62], [60, 74], [60, 86], [55, 78], [56, 87], [57, 96]),
    ],
    loopMs: 3000,
  },

  // Mountain climber — a held plank with one knee driving under the chest.
  mountainClimber: {
    frames: [
      P([50, 52], [50, 60], [50, 78], [59, 60], [61, 72], [62, 84], [55, 78], [55, 88], [55, 97]),
      P([50, 52], [50, 60], [50, 78], [59, 60], [61, 72], [62, 84], [55, 78], [62, 72], [64, 84]),
    ],
    framesL: [
      L([41, 60], [39, 72], [38, 84], [45, 78], [45, 88], [45, 97]),
      L([41, 60], [39, 72], [38, 84], [45, 78], [38, 72], [36, 84]),
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

  // Push-up — a real push-up. The `push` fallback is an overhead press, which
  // is the single most-noticed wrong demonstration in the catalogue.
  pushup: {
    frames: [
      P([50, 44], [50, 56], [50, 76], [60, 56], [68, 64], [74, 74], [55, 76], [55, 87], [55, 96]),
      P([50, 50], [50, 62], [50, 80], [60, 62], [72, 62], [74, 74], [55, 80], [55, 89], [55, 97]),
    ],
    loopMs: 2200,
  },

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

  // Plank — a hold. It breathes and does nothing else, which is the point.
  plank: {
    frames: [
      P([50, 50], [50, 58], [50, 78], [60, 58], [62, 70], [63, 82], [55, 78], [55, 88], [55, 97]),
      P([50, 51], [50, 59], [50, 79], [60, 59], [62, 71], [63, 83], [55, 79], [55, 89], [55, 98]),
    ],
    loopMs: 4200,
  },

  // Glute bridge — supine, the hips drive to the ceiling.
  gluteBridge: {
    frames: [
      P([50, 16], [50, 32], [50, 56], [60, 33], [64, 44], [66, 55], [56, 56], [57, 72], [56, 88]),
      P([50, 16], [50, 32], [50, 52], [60, 33], [64, 44], [66, 55], [56, 52], [58, 68], [56, 86]),
    ],
    loopMs: 2400,
  },

  // Leg raise — supine, straight legs travel from the floor to vertical.
  legRaise: {
    frames: [
      P([50, 14], [50, 30], [50, 54], [60, 31], [64, 42], [66, 53], [56, 54], [56, 72], [56, 90]),
      P([50, 14], [50, 30], [50, 54], [60, 31], [64, 42], [66, 53], [56, 54], [59, 66], [60, 80]),
    ],
    loopMs: 2600,
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

  // Superman — prone, arms and legs lift off the floor together.
  superman: {
    frames: [
      P([50, 16], [50, 30], [50, 54], [60, 31], [64, 22], [68, 12], [56, 54], [57, 72], [57, 90]),
      P([50, 13], [50, 28], [50, 53], [60, 29], [64, 19], [68, 8], [56, 53], [57, 70], [57, 87]),
    ],
    loopMs: 3000,
  },

  // Side plank — the body is one diagonal line, the top arm stacked above it.
  sidePlank: {
    frames: [
      P([36, 30], [42, 42], [52, 62], [46, 40], [48, 28], [50, 16], [54, 62], [60, 78], [64, 94]),
      P([36, 34], [42, 46], [52, 66], [46, 44], [48, 32], [50, 20], [54, 66], [60, 81], [64, 96]),
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

  // Bird dog — on all fours, opposite arm and leg reach out long.
  birdDog: {
    frames: [
      P([50, 46], [50, 56], [50, 76], [60, 56], [62, 68], [63, 80], [55, 76], [56, 86], [56, 96]),
      P([50, 44], [50, 54], [50, 74], [60, 54], [62, 42], [63, 30], [55, 74], [56, 84], [56, 94]),
    ],
    framesL: [
      L([41, 56], [39, 68], [38, 80], [45, 76], [44, 86], [44, 96]),
      L([41, 54], [39, 66], [38, 78], [45, 74], [44, 88], [44, 98]),
    ],
    loopMs: 2800,
  },

  // Cat-cow — on all fours, the spine rolls between arched and rounded.
  catCow: {
    frames: [
      P([50, 48], [50, 58], [50, 78], [60, 58], [62, 70], [63, 82], [55, 78], [55, 88], [55, 97]),
      P([50, 54], [50, 60], [50, 76], [60, 60], [62, 72], [63, 84], [55, 76], [55, 86], [55, 95]),
    ],
    loopMs: 3400,
  },

  // Child's pose — kneeling, folded forward, arms reaching long.
  childsPose: {
    frames: [
      P([50, 62], [50, 70], [50, 84], [60, 70], [62, 60], [63, 48], [55, 84], [55, 94], [52, 98]),
      P([50, 64], [50, 72], [50, 86], [60, 72], [62, 62], [63, 50], [55, 86], [55, 96], [52, 99]),
    ],
    loopMs: 3600,
  },
};

export function getFrontProfile(motion: FigureMotion): FrontProfile {
  return FRONT_PROFILES[motion] ?? FRONT_PROFILES.neutral;
}
