/**
 * HYDRATION LOGIC — the small decisions behind the hydration card, kept pure.
 *
 * Nothing here draws anything. It answers the questions the card would
 * otherwise bury in JSX: where the glass marks go on the gauge, what the status
 * line says, how far the custom amount can be pushed — so each can be pinned by
 * a test instead of by a thumb on one phone.
 */

/** The size the app has always called a glass. */
export const GLASS_ML = 250;

/** The one-tap sizes, in the order they sit. The glass is the primary key. */
export const QUICK_ML = [150, 250, 500] as const;

/** The custom amount's range and step. */
export const CUSTOM_MIN = 50;
export const CUSTOM_MAX = 2000;
export const CUSTOM_STEP = 50;
/** Where the custom amount starts each time it opens: a can, a small bottle. */
export const CUSTOM_DEFAULT = 330;
/** Sizes people actually drink, one tap from setting the custom amount. */
export const CUSTOM_PRESETS = [100, 200, 300, 330, 600, 750] as const;

/** An amount held inside the custom range. */
export function clampCustom(ml: number): number {
  if (!Number.isFinite(ml)) return CUSTOM_DEFAULT;
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Math.round(ml)));
}

/** One step up or down, held inside the range. */
export function stepCustom(ml: number, dir: 1 | -1): number {
  return clampCustom(ml + dir * CUSTOM_STEP);
}

export interface GaugeTick {
  /** How far up the gauge, 0 (the floor) to 1 (the goal). */
  at: number;
  /** A whole litre — drawn longer, so the eye can count in litres. */
  major: boolean;
}

/** More marks than this and a small gauge is a barcode, however large the goal. */
const MAX_TICKS = 24;

/**
 * The marks up the side of the gauge: one per glass, a long one at each litre.
 *
 * The goal itself is the rim, so there is no mark AT it — only the glasses
 * below it. A goal that is not a whole number of glasses simply has a shorter
 * last stretch.
 */
export function gaugeTicks(goalMl: number, glassMl: number = GLASS_ML): GaugeTick[] {
  if (!(goalMl > 0) || !(glassMl > 0)) return [];
  const out: GaugeTick[] = [];
  for (let ml = glassMl; ml < goalMl && out.length < MAX_TICKS; ml += glassMl) {
    out.push({ at: ml / goalMl, major: ml % 1000 === 0 });
  }
  return out;
}

export interface HydrationStatus {
  reached: boolean;
  text: string;
}

/**
 * The one line under the figure. No exclamation, no emoji: reaching the goal is
 * stated, not cheered, and the line before it says how much is left to drink.
 */
export function hydrationStatus(totalMl: number, goalMl: number): HydrationStatus {
  const total = Math.max(0, Math.round(totalMl) || 0);
  const goal = Math.max(0, Math.round(goalMl) || 0);
  if (goal > 0 && total >= goal) return { reached: true, text: "Goal reached" };
  return { reached: false, text: `${(goal - total).toLocaleString()} ml to go` };
}

/** "1 drink", "5 drinks". */
export function drinkCount(n: number): string {
  return `${n} ${n === 1 ? "drink" : "drinks"}`;
}

/** The time of day a drink was had, in the phone's own style ("8:12 AM" or "08:12"). */
export function clockLabel(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** How many drinks the card shows before it folds the rest behind "Show all". */
export const COLLAPSED_ROWS = 3;
