/**
 * FIGURE PROPS — the equipment a movement rests on, drawn behind the figure.
 *
 * Some movements are only honest with their support in the picture. A bench
 * dip without the bench is a person sitting on air; a step-up without the step
 * is a march on one leg; a pull-up without the bar is a standing pulldown. The
 * figure's pose already depends on the object (hands on the chair edge, a foot
 * on the box, heels against the wall), so leaving the object out made those
 * demonstrations read as a different exercise or as nothing at all.
 *
 * Props are deliberately as plain as the pictogram: flat blocks in the figure's
 * own colour, set back at the far-limb opacity so they read as the setting, not
 * as part of the body. Static — nothing here moves or allocates per frame.
 *
 * Coordinates are the figure's own 0–100 box (y grows down), so a prop lines up
 * with the pose it was authored against. Pure data.
 */
import type { FigureMotion } from "./movementProfiles";

/** One block of equipment, in box units. */
export interface FigureProp {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Camera = "front" | "side";

export const MOTION_PROPS: Partial<Record<FigureMotion, Partial<Record<Camera, readonly FigureProp[]>>>> = {
  // Benches, chairs and boxes the body rests on.
  dip: { side: [{ x: 14, y: 72, w: 28, h: 26 }] },
  chestPress: { side: [{ x: 12, y: 80.5, w: 52, h: 17.5 }] },
  hipThrust: { side: [{ x: 6, y: 82.5, w: 28, h: 15.5 }] },
  inclinePushup: { side: [{ x: 70, y: 81.5, w: 22, h: 16 }] },
  declinePushup: { side: [{ x: 1, y: 68, w: 23, h: 29.8 }] },
  splitSquat: { side: [{ x: 4, y: 72, w: 26, h: 26 }] },
  stepUp: { side: [{ x: 56, y: 86, w: 26, h: 12 }] },
  toeTap: { side: [{ x: 58, y: 88, w: 24, h: 10 }] },
  // Walls and door frames.
  wallSit: { side: [{ x: 31.5, y: 8, w: 4, h: 82 }] },
  wallPushup: { side: [{ x: 83.5, y: 4, w: 4, h: 94 }] },
  handstandPushup: { side: [{ x: 37.5, y: 2, w: 4, h: 96 }] },
  couchStretch: { side: [{ x: 26, y: 54, w: 4, h: 44 }] },
  leanRow: { side: [{ x: 77.5, y: 4, w: 4, h: 94 }] },
  // Bars.
  invertedRow: { side: [{ x: 64, y: 48, w: 18, h: 3.5 }] },
  pullUp: {
    front: [{ x: 16, y: 17.3, w: 68, h: 3.5 }],
    side: [{ x: 46, y: 17.3, w: 16, h: 3.5 }],
  },
};

const NONE: readonly FigureProp[] = [];

/** The equipment drawn behind `motion` from one camera (usually none). */
export function propsFor(motion: FigureMotion, camera: Camera): readonly FigureProp[] {
  return MOTION_PROPS[motion]?.[camera] ?? NONE;
}
