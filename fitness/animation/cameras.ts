/**
 * FIGURE CAMERAS — which angles a movement can honestly be shown from.
 *
 * A camera exists for a movement only if a profile was authored for it, so the
 * data decides and nothing has to be kept in sync by hand. Most standing work
 * reads from both the front and the side. Floor and all-fours work does NOT
 * read from the front: the rig cannot foreshorten a bone, so the old "front"
 * view of a plank, a bridge or a bird dog drew a person STANDING upright and
 * flapping an arm. A side plank or a lateral raise is the other way round —
 * the side camera would have to see a limb pointing straight at it.
 *
 * A profile is not enough on its own, though: some were authored for a camera
 * that draws a different movement from the one the other camera shows, and
 * those are vetoed by name (`NOT_SHOWN_FROM`).
 *
 * Callers show a movement only from the cameras listed here. The live player's
 * corner shows the second camera when there is one, in step with the main
 * panel, and the movement's key position otherwise.
 *
 * Pure (no React / Skia / Reanimated).
 */
import { FRONT_PROFILES } from "./frontProfiles";
import type { FigureMotion } from "./movementProfiles";
import { buildFrontRig, buildSideRig } from "./rig";
import { SIDE_PROFILES } from "./sideProfiles";

export type FigureCamera = "front" | "side";

const BOTH: readonly FigureCamera[] = ["front", "side"];
const FRONT_ONLY: readonly FigureCamera[] = ["front"];
const SIDE_ONLY: readonly FigureCamera[] = ["side"];

/**
 * Angles a movement HAS a profile for and must still never be shown from,
 * because what that camera draws is not the movement the other one shows.
 *
 * The live player stands the two cameras side by side — one big, one in the
 * corner — and the owner found pairs that disagreed: a seated Russian twist
 * beside a standing one, a burpee's plank beside a squat, a plank jack whose
 * main panel was a person crouching upright. The rule is the same one that
 * already keeps floor work side-only: a 2D rig cannot foreshorten a bone, so a
 * camera looking straight down the line of a movement draws a different one.
 *
 *   front ✗ — the work happens toward and away from the viewer: hinged or
 *             folded over (a bent-over row, a burpee's plank, a seated twist,
 *             a plank jack, a prone Y raise seen from above), a stride or a
 *             seat (a lunge, a wall sit) or a leap forward (a broad jump, a
 *             tuck jump's knees). Front-on, all of them came out standing up.
 *   side ✗  — the work happens side to side (a shuffle, a skater's bound, a
 *             jumping jack's and a star jump's arms sweeping out). Side-on, the
 *             arms swung forward like a front raise and the feet stayed put.
 *
 * Their one honest camera is the main panel; the corner shows the move's key
 * position instead (see the player's aux panel). Held by cameras.test.ts.
 */
const NOT_SHOWN_FROM: Partial<Record<FigureMotion, FigureCamera>> = {
  row: "front",
  russianTwist: "front",
  burpee: "front",
  plankJack: "front",
  tuckJump: "front",
  broadJump: "front",
  lunge: "front",
  wallSit: "front",
  yRaise: "front",
  // The pattern fallback for core is a standing knee tuck: front-on, its
  // driven knee could only bend both legs into a dip.
  core: "front",
  lateralShuffle: "side",
  skater: "side",
  jumpingJack: "side",
  starJump: "side",
  // The cardio fallback is a jumping jack from the front and a jog from the
  // side: two different movements. It keeps the jack.
  cardio: "side",
};

/** The cameras `motion` is shown from, front first. Never empty. */
export function motionCameras(motion: FigureMotion): readonly FigureCamera[] {
  const vetoed = NOT_SHOWN_FROM[motion];
  const front = !!FRONT_PROFILES[motion] && vetoed !== "front";
  const side = !!SIDE_PROFILES[motion] && vetoed !== "side";
  if (front && side) return BOTH;
  if (side) return SIDE_ONLY;
  if (front) return FRONT_ONLY;
  // Unknown key — the profile getters fall back to `neutral`, which has both.
  return BOTH;
}

export function hasCamera(motion: FigureMotion, camera: FigureCamera): boolean {
  return motionCameras(motion).includes(camera);
}

/**
 * One rep's duration. Both cameras share it by construction; read it from
 * whichever exists so a side-only movement doesn't time itself off the
 * `neutral` fallback.
 */
export function motionLoopMs(motion: FigureMotion): number {
  return (SIDE_PROFILES[motion] ?? FRONT_PROFILES[motion] ?? SIDE_PROFILES.neutral).loopMs;
}

/**
 * Movements a side-on camera reads best; everything else faces the viewer.
 * Only consulted for movements that have both cameras — a single-camera
 * movement always gets its one camera.
 */
const SIDE_READS_BEST = new Set<FigureMotion>([
  "squat",
  "hinge",
  "push",
  "core",
  "flexibility",
  // Anything that happens along the body's own front-back axis: a camera
  // square-on to a push-up or a hip hinge sees a foreshortened blob.
  "pushup",
  "plank",
  "sidePlank",
  "gluteBridge",
  "legRaise",
  "row",
  "superman",
  "birdDog",
  "catCow",
  "childsPose",
  "russianTwist",
  "wallSit",
  "lunge",
  "burpee",
  "inchworm",
  "bearCrawl",
  "mountainClimber",
  "broadJump",
  "tuckJump",
  "curl",
  // Squat family: the hip travelling back is what reads.
  "gobletSquat",
  "jumpSquat",
  "squatPulse",
  "deepSquat",
  // The pull toward the face, and the step under the foot, only show side-on.
  "facePull",
  "toeTap",
]);

/*
 * KNEE DRIVES ARE SIDE-ON ONLY — high knees, marching, butt kicks.
 *
 * They used to face the viewer, because the side rig echoed one leg and a
 * driven knee lifted both (the athlete levitated). The side rig now authors its
 * far leg, so side-on is honest. Front-on never was: a constant-length thigh can
 * only rise toward the camera by swinging OUT through horizontal, so every rep
 * flashed both legs into a sideways split. Those front views are gone.
 */

/**
 * The single best camera angle for a movement — for the places only one panel
 * fits, like the live player stage where the figure IS the screen. A movement
 * authored for one camera only (floor work, a side plank) gets that camera.
 */
export function primaryView(motion: FigureMotion): FigureCamera {
  const cameras = motionCameras(motion);
  if (cameras.length === 1) return cameras[0];
  return SIDE_READS_BEST.has(motion) ? "side" : "front";
}

/**
 * The camera angle the primary one doesn't cover — or null when the movement
 * only reads from one camera, and a second panel would draw a different
 * exercise (a "front" plank was a person standing upright).
 */
export function secondaryView(motion: FigureMotion): FigureCamera | null {
  if (motionCameras(motion).length < 2) return null;
  return primaryView(motion) === "side" ? "front" : "side";
}

/**
 * Motions whose TOP of rep is the frame that says what they are. At the bottom
 * a push-up is a body lying on the floor with its arms folded out of sight —
 * nothing about it says push-up; at the top it is the unmistakable straight
 * body on locked arms.
 */
const TOP_OF_REP_STILLS = new Set<FigureMotion>([
  "pushup",
  "plank",
  // Every push-up variant reads at lockout, and so do the presses.
  "kneePushup",
  "inclinePushup",
  "declinePushup",
  "pikePushup",
  "scapPushup",
  "wallPushup",
  "handstandPushup",
  "chestPress",
  // At the bottom the tapping hand is the dimmed far one; at the top it's near.
  "shoulderTap",
]);

/**
 * The rep position a still should freeze at to be recognisable. For almost
 * every movement that is the bottom — the working position: a squat at the top
 * of its rep is just a person standing; at the bottom it is a squat.
 */
export function stillFrame(motion: FigureMotion): number {
  return TOP_OF_REP_STILLS.has(motion) ? 0 : 0.5;
}

/**
 * What to call the still {@link stillFrame} shows, read off the pose itself:
 * "top" or "bottom" only when the hips really are at the high or the low end of
 * the rep there, and "key pose" for everything else. It used to be top/bottom
 * by rule, which labelled a tuck jump's mid-air tuck, a jumping jack's open star
 * and a row's pull "bottom" — a caption that did not match its picture.
 */
export function stillCaption(motion: FigureMotion): "top" | "bottom" | "key pose" {
  const cameras = motionCameras(motion);
  const rig = cameras[0] === "side" ? buildSideRig(motion) : buildFrontRig(motion);
  // Box y grows downward: a positive drop is a pose B lower than pose A.
  const drop = rig.rootB[1] - rig.rootA[1];
  const atTop = stillFrame(motion) === 0;
  if (drop > 3) return atTop ? "top" : "bottom";
  if (drop < -3) return atTop ? "bottom" : "top";
  return "key pose";
}
