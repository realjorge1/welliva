/**
 * SESSION SCENE — the stage inside the player's hero card: where the floor is,
 * the perspective lines drawn on it, the light panels set into it, and how big
 * the figure stands.
 *
 * The hero is a ROOM: a floor the athlete demonstrates on. Nothing is written
 * on the stage — the clock is in the card under it, so the body is never behind
 * a digit. The floor keeps time instead: its panels are lights, and how many
 * are on is how much of the phase is left. Everything here is sized from the
 * card's measured box, so the same stage holds on a 569dp phone and a 900dp one.
 *
 * Pure: numbers and path strings, no React.
 */

/** Where the floor meets the wall, as a share of the stage's height. */
export const FLOOR_AT = 0.8;

/** Largest the figure's panel gets — past this the demonstration stops gaining. */
const MAX_FIGURE = 340;

/** Lines across the floor: the wall line is row 0, the card's foot row CROSS. */
const CROSS = 4;
/** Rays fanned across the floor to a vanishing point above the stage. */
const RAYS = 12;
/** How wide the fan is at the card's foot, in stage widths. */
const SPREAD = 1.9;
/** A panel is only part of the clock when this much of it is on the stage. */
const MIN_VISIBLE = 0.4;
/** The dark seam kept around a lit panel, so the light reads as panels. */
const SEAM = 0.75;

const n2 = (v: number) => Math.round(v * 100) / 100;

export interface Stage {
  width: number;
  height: number;
  /** The floor line, from the top of the stage. */
  floorY: number;
}

export function stageOf(width: number, height: number): Stage {
  return { width, height, floorY: Math.round(height * FLOOR_AT) };
}

/** Too small to have a floor worth drawing. */
function flat(stage: Stage): boolean {
  return !(stage.width > 0) || stage.height - stage.floorY < 8;
}

/** Row k's line: 0 where the floor meets the wall, CROSS the card's foot. */
function rowY(stage: Stage, k: number): number {
  if (k <= 0) return stage.floorY;
  if (k >= CROSS) return stage.height;
  return stage.floorY + (stage.height - stage.floorY) * Math.pow(k / CROSS, 1.7);
}

/** Where ray j crosses the height y. */
function rayX(stage: Stage, j: number, y: number): number {
  const depth = stage.height - stage.floorY;
  const vx = stage.width / 2;
  const vy = stage.floorY - depth * 2.4;
  const spread = stage.width * SPREAD;
  const foot = vx - spread / 2 + (spread * j) / RAYS;
  return vx + ((foot - vx) * (y - vy)) / (stage.height - vy);
}

/**
 * The floor: the line where it meets the wall, a few cross lines that close up
 * toward the back, and rays to a vanishing point above the stage. Solid hairlines,
 * one path. Empty when the stage is too small to have a floor worth drawing.
 */
export function floorGrid(stage: Stage): string {
  if (flat(stage)) return "";
  const { width, height, floorY } = stage;
  let d = `M0 ${n2(floorY)}H${n2(width)}`;
  for (let k = 1; k < CROSS; k++) d += `M0 ${n2(rowY(stage, k))}H${n2(width)}`;
  for (let j = 0; j <= RAYS; j++) {
    d += `M${n2(rayX(stage, j, floorY))} ${n2(floorY)}L${n2(rayX(stage, j, height))} ${n2(height)}`;
  }
  return d;
}

/** The panel between rays j and j+1 and rows top/bottom — or null when it is mostly off the stage. */
function panel(stage: Stage, j: number, top: number, bottom: number): string | null {
  const seen = (a: number, b: number) => Math.max(0, Math.min(b, stage.width) - Math.max(a, 0));
  const a1 = rayX(stage, j, top);
  const b1 = rayX(stage, j + 1, top);
  const a2 = rayX(stage, j, bottom);
  const b2 = rayX(stage, j + 1, bottom);
  if ((seen(a1, b1) + seen(a2, b2)) / (b1 - a1 + (b2 - a2)) < MIN_VISIBLE) return null;
  // Inset on every side, the sides re-read at the inset heights so they stay on their rays.
  const t = top + Math.min(SEAM, (bottom - top) * 0.15);
  const b = bottom - Math.min(SEAM, (bottom - top) * 0.15);
  const l1 = rayX(stage, j, t) + SEAM;
  const r1 = rayX(stage, j + 1, t) - SEAM;
  const l2 = rayX(stage, j, b) + SEAM;
  const r2 = rayX(stage, j + 1, b) - SEAM;
  return `M${n2(l1)} ${n2(t)}L${n2(r1)} ${n2(t)}L${n2(r2)} ${n2(b)}L${n2(l2)} ${n2(b)}Z`;
}

/**
 * The floor's light panels, in the order they come on. A step is the mirrored
 * pair of panels at one depth: the middle pair first, from the front edge back
 * to the athlete's feet, then the next pair out. Lighting runs this order and a
 * set switches them off in reverse, so the light closes in on the athlete from
 * the sides and the last panel lit is the big one right in front of them.
 * Panels mostly off the stage are left out — every step is one you can see.
 */
export function floorSteps(stage: Stage): string[] {
  if (flat(stage)) return [];
  const half = RAYS / 2;
  const steps: string[] = [];
  for (let ring = 0; ring < half; ring++) {
    for (let k = CROSS - 1; k >= 0; k--) {
      const top = rowY(stage, k);
      const bottom = rowY(stage, k + 1);
      const pair = [panel(stage, half - 1 - ring, top, bottom), panel(stage, half + ring, top, bottom)];
      if (pair[0] && pair[1]) steps.push(pair[0] + pair[1]);
    }
  }
  return steps;
}

/**
 * The lit part of the floor: as many steps as `lit` (0–1) covers, rounded UP —
 * a step stays on while any of its time is left, so the floor goes dark on the
 * second the box runs out, not a step early.
 */
export function litFloor(steps: readonly string[], lit: number): string {
  const n = Math.ceil(Math.max(0, Math.min(1, lit)) * steps.length - 1e-9);
  return steps.slice(0, n).join("");
}

/**
 * The figure's panel: tall enough that its floor — 94% down the panel, where
 * ExerciseFigure stands a pose — lands on the stage's floor line, and never
 * wider than the stage. Returns the panel size and its top edge.
 */
export function figureBox(stage: Stage): { size: number; top: number } {
  const size = Math.max(
    40,
    Math.min((stage.floorY - 4) / 0.94, (stage.width - 16) / 0.94, MAX_FIGURE),
  );
  return { size: Math.round(size), top: Math.round(stage.floorY - size * 0.94) };
}

/** The small second panel in a top corner — a demonstration, never a smudge. */
export function auxSize(stage: Stage): number {
  return Math.round(Math.max(54, Math.min(110, stage.height * 0.3)));
}
