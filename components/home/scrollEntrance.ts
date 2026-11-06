/**
 * SCROLL ENTRANCE — when a card that has scrolled into view should play.
 *
 * Home's Fitness line draws itself on the way into view: scroll down, the card
 * arrives, the line travels left to right to where your activity has put it.
 * This is the decision of WHEN, kept apart from the drawing so the rules can be
 * pinned without a phone:
 *
 *   · It plays once the card is mostly in view (`ENTER_FRACTION`) — not the
 *     moment its first pixel appears, when it would still be half under the rail.
 *   · It plays going DOWN the page. Scroll back up and the card arrives from the
 *     top already drawn: an entrance that replays every time you nudge the page
 *     either way is a nag, and one that only answers a downward scroll is the
 *     motion people actually asked for.
 *   · It re-arms only when the card has left the viewport entirely, and at that
 *     moment — nobody can see it — it is wiped back to empty, so the next
 *     arrival draws from the start instead of flashing a finished line first.
 *
 * Signals: 1 = play, 2 = show finished (no motion), 0 = wipe and wait. `null`
 * means nothing changed.
 */

/** How much of the card must be in view before it plays. */
export const ENTER_FRACTION = 0.4;

export type EntranceSignal = 0 | 1 | 2;

export interface EntranceInput {
  scrollY: number;
  /** Height of the scroll viewport. */
  viewportH: number;
  /** The card's top and height, in scroll-CONTENT coordinates. */
  boxY: number;
  boxH: number;
  /** Room at the foot of the viewport that something else covers (the rail). */
  reservedBottom: number;
}

export interface EntranceState {
  armed: boolean;
  lastY: number;
}

export const INITIAL_ENTRANCE: EntranceState = { armed: true, lastY: 0 };

/** The share of the card that is inside the usable part of the viewport, 0–1. */
export function visibleFraction(i: EntranceInput): number {
  if (!(i.boxH > 0)) return 0;
  const top = Math.max(i.boxY, i.scrollY);
  const bottom = Math.min(i.boxY + i.boxH, i.scrollY + i.viewportH - i.reservedBottom);
  return Math.min(1, Math.max(0, bottom - top) / i.boxH);
}

export function stepEntrance(
  prev: EntranceState,
  input: EntranceInput,
): { state: EntranceState; signal: EntranceSignal | null } {
  const fraction = visibleFraction(input);
  // Equal counts as down: the first look, at rest, is how the page opens.
  const goingDown = input.scrollY >= prev.lastY;
  const lastY = input.scrollY;

  if (prev.armed && fraction >= ENTER_FRACTION) {
    return { state: { armed: false, lastY }, signal: goingDown ? 1 : 2 };
  }
  if (!prev.armed && fraction <= 0) {
    return { state: { armed: true, lastY }, signal: 0 };
  }
  return { state: { armed: prev.armed, lastY }, signal: null };
}
