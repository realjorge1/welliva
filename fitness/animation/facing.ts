/**
 * FACING — which way a side-on pose faces.
 *
 * Every side profile is authored with the athlete facing +x: standing, its
 * face and toes point right; lying on its back, its head is on the left;
 * face down, its head is on the right. Three poses were authored the other
 * way round, and for them EVERYTHING that has a front and a back is reversed
 * along with the face — the belly and the glutes, the calves, the thumbs, the
 * soles of the trainers. Drawn as if they faced +x, a cobra lay face down with
 * its belly painted on its back and the soles of its feet pressed to the floor.
 *
 *   cobra / yRaise — lying FACE DOWN, but with the head on the left.
 *   invertedRow    — hanging FACE UP under the bar, head on the right.
 *
 * Pure data; the rig (feet), the art (which side is the front) and both
 * renderers read it from here, so they can never disagree.
 */
import type { FigureMotion } from "./movementProfiles";

/** +1 = faces +x (the authoring convention); −1 = authored facing −x. */
export type Facing = 1 | -1;

const FACES_LEFT = new Set<FigureMotion>(["cobra", "yRaise", "invertedRow"]);

/** Which way `motion`'s side profile faces. */
export function sideFacing(motion: FigureMotion): Facing {
  return FACES_LEFT.has(motion) ? -1 : 1;
}
