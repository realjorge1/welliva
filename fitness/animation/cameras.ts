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
 * Callers show a movement only from the cameras listed here, and the live
 * player drops its second-angle corner panel for single-camera movements.
 *
 * Pure (no React / Skia / Reanimated).
 */
import { FRONT_PROFILES } from "./frontProfiles";
import type { FigureMotion } from "./movementProfiles";
import { SIDE_PROFILES } from "./sideProfiles";

export type FigureCamera = "front" | "side";

const BOTH: readonly FigureCamera[] = ["front", "side"];
const FRONT_ONLY: readonly FigureCamera[] = ["front"];
const SIDE_ONLY: readonly FigureCamera[] = ["side"];

/** The cameras `motion` was authored for, front first. Never empty. */
export function motionCameras(motion: FigureMotion): readonly FigureCamera[] {
  const front = !!FRONT_PROFILES[motion];
  const side = !!SIDE_PROFILES[motion];
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
