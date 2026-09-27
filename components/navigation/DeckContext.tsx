/**
 * THE DECK — one object at the base of the screen, and the rules it lives by.
 *
 *   ╭────────────────────────────────────────────────────╮
 *   │  ▸ Log lunch          Grilled chicken bowl  2 more │  ← THE DOCK
 *   ╰────────────────────────────────────────────────────╯
 *   ╭──────────────────────────────────────────╮  ╭─────╮
 *   │  ◉ Home    Diet    Fitness    Gozlin     │  │  +  │  ← THE RAIL
 *   ╰──────────────────────────────────────────╯  ╰─────╯
 *
 * WHAT THIS REPLACED, AND WHY. The Action Bar put a full-width gold button at
 * the base of four screens whose meaning changed thirteen ways. It was correct
 * every time and still wrong: the loudest, most permanent control in the app
 * was the one thing you had to READ on every visit, while the stable things —
 * where am I, where else can I go — had no presence at the bottom at all. The
 * weighting was inverted. The Deck swaps it back:
 *
 *   · THE RAIL is furniture. Four destinations and one action, the same four
 *     and the same one on every screen, so muscle memory has somewhere to live
 *     and nothing at the bottom needs reading at rest. It is a pinned SUBSET of
 *     the swipe menu, rendered from the same `menu.ts` and lit with the same
 *     gold, which is what stops it being a second navigation system competing
 *     with the drawer for authority. The drawer is still the map.
 *   · THE DOCK is occasional. One slot above the rail with a priority of
 *     tenants — a live session, then a time-bound cue, then a write receipt,
 *     then NOTHING. The ladder did not die; it was demoted from the biggest
 *     button on screen to a card that has to earn its appearance, and which can
 *     be told "not now" (see dismissals.ts).
 *
 * IT LIVES INSIDE THE DRAWER'S CONTENT, NOT OVER THE APP. Mounted once, as a
 * sibling of `children` inside AppDrawer's transformed view, so it rides the
 * translate/scale with the app it belongs to. Hoisting it above the drawer
 * would leave it hanging in mid-air over the open menu. Mounting it once is
 * also what fixed the Action Bar's other problem: that bar existed on four
 * screens of eleven and so appeared and vanished as you navigated, and
 * furniture that comes and goes is not furniture.
 *
 * NOTHING HERE OWNS A GESTURE. The rail condenses from the scroll position
 * screens already report, not from a pan of its own — deliberately, because the
 * bottom of this app is where the drawer's edge pan and the Android elastic
 * pull were already negotiated once, and a third claimant would have re-opened
 * that. The only new gesture in the whole Deck is the cue card's horizontal
 * swipe, which begins well clear of the drawer's 32pt edge strip.
 */

import React, { createContext, useContext } from "react";

export interface DeckApi {
  /**
   * Where the host screen's list is, in points. Screens feed this through
   * `Screen`'s scroll handler; the Deck alone decides what it means.
   *
   * IT TAKES A NUMBER, NOT AN EVENT, and it is the only thing a screen ever
   * tells the Deck. The fold is hysteresis over this one value — see `FOLD` —
   * which is why the whole collapsing rail costs no gesture of its own.
   */
  reportScroll: (y: number) => void;
  /**
   * Put the rail back to full height. Called on navigation and by screens that
   * do not scroll, so arriving somewhere never lands you on a folded rail.
   */
  settle: () => void;
  /**
   * A one-line receipt shown ABOVE the rail, for a write that changes nothing
   * else on the screen you are standing on.
   *
   * IT IS ANCHORED TO THE DECK, NOT TO THE TOP OF THE PAGE, and that is a fix
   * rather than a preference: the old confirmation was `position: absolute;
   * top: …` inside a zero-height box pinned to the bottom edge, so it was drawn
   * perfectly and landed below the bottom of the screen every time — which is
   * exactly what "water logging doesn't work" looked like from the outside.
   * Here it appears where the finger and the eye already are.
   */
  confirm: (message: string) => void;
}

const DeckContext = createContext<DeckApi | null>(null);

export const DeckProvider = DeckContext.Provider;

/**
 * The Deck, from anywhere inside it. Throws outside, because a silent no-op
 * confirmation is the bug this whole file is a correction for.
 */
export function useDeck(): DeckApi {
  const api = useContext(DeckContext);
  if (!api) throw new Error("useDeck must be used inside <DeckHost>");
  return api;
}

/**
 * The Deck if there is one. `Screen` uses this: it renders inside the shell on
 * eleven destinations and outside it on the auth flow, the consent gate and
 * onboarding, and must not care which.
 */
export function useDeckOptional(): DeckApi | null {
  return useContext(DeckContext);
}

/* ───────────────────────────── Geometry & motion ──────────────────────────
 * Tuned for a 393pt-wide phone: four tabs and a 62pt action still leave the
 * labels room to sit on one line, and the whole object clears the home
 * indicator without floating halfway up the screen.
 */

/** The rail at rest, and the gold action beside it. */
export const RAIL_HEIGHT = 62;
/** The rail folded: glyph, cue, action — the same three objects, one row. */
export const RAIL_CONDENSED = 54;
/** Gutter either side of the whole Deck. */
export const DECK_GUTTER = 16;
/** Between the tab pill and the action button, and between dock and rail. */
export const DECK_GAP = 10;
/** Breathing room between the rail and the device's home indicator. */
export const DECK_BASE_GAP = 12;

/**
 * How much room the Deck takes ABOVE the device's own bottom inset, at rest.
 *
 * The dock is not in this figure, on purpose: it is occasional, and sizing
 * every page for a card that is usually absent would leave a permanent hole at
 * the bottom of the app. A screen reserves the rail; the dock floats over the
 * last inch of content the way a cue is supposed to.
 *
 * `Screen` covers this through NAV_CLEARANCE. The one caller that needs the
 * number directly is Gozlin, whose composer owns the bottom edge and has to sit
 * ON TOP of the rail rather than under it.
 */
export const DECK_BLOCK = DECK_BASE_GAP + RAIL_HEIGHT;

/**
 * Scroll thresholds for the fold. Hysteresis, not a single line: a rail that
 * flips at one exact offset shivers when a finger rests mid-list.
 */
export const FOLD = {
  /** Above this, the rail is always full — the top of a page is a resting state. */
  alwaysOpenAbove: 28,
  /** Downward travel that folds it. */
  foldAfter: 12,
  /** Upward travel that opens it. Smaller, so reaching back up is instant. */
  openAfter: 10,
} as const;

export default DeckContext as React.Context<DeckApi | null>;
