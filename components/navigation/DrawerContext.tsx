/**
 * DRAWER CONTEXT — one shared value, read by everything that moves.
 *
 * `progress` is the whole drawer: 0 is closed, 1 is fully open, and every frame
 * in between is a real, draggable state. It lives on the UI thread as a
 * Reanimated shared value, which is what lets the finger drive the exact same
 * animation the buttons do — the content slide, the scale, the scrim, the menu's
 * parallax, the staggered rows, and the hamburger's own morph all read this one
 * number. Nothing re-renders while you drag.
 *
 * `isOpen` is the React-side mirror, and it exists for the things the UI thread
 * can't do: pointer-events, accessibility hiding, and the Android back handler.
 * It flips at the START of each animation, not the end, so a tap on the scrim is
 * ignored the instant the drawer begins closing.
 */

import React, { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export interface DrawerApi {
  /** 0 = closed, 1 = open. Continuous during a drag. */
  progress: SharedValue<number>;
  /** React-side mirror of intent, flipped when an animation starts. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const DrawerContext = createContext<DrawerApi | null>(null);

export const DrawerProvider = DrawerContext.Provider;

/**
 * The drawer, from anywhere inside the shell. Throws outside it rather than
 * returning a no-op: a hamburger that silently does nothing is a bug that ships.
 */
export function useDrawer(): DrawerApi {
  const api = useContext(DrawerContext);
  if (!api) {
    throw new Error("useDrawer must be used inside <AppDrawer>");
  }
  return api;
}

/**
 * The drawer if there is one, otherwise null. For components that render both
 * inside and outside the shell and must degrade rather than crash.
 */
export function useDrawerOptional(): DrawerApi | null {
  return useContext(DrawerContext);
}

/* ───────────────────────────── Geometry & motion ──────────────────────────
 * Tuned against the real thing: a wide panel, content that slides and shrinks
 * just enough to read as a card lifted off the page, and corners that round as
 * it goes.
 */

/**
 * Panel width — about half the viewport, capped so tablets stay sane.
 *
 * It started at 84% (a full ChatGPT-width panel) and that read as the app being
 * shoved off-screen rather than slid aside. 55% → 52% → 49%, each step asked
 * for: the app keeps a visibly larger presence and the menu still has room for
 * every label. The ~48% floor was set by "What Welliva knows" (now "Memory")
 * wrapping on every phone below it; with the longest label now "Settings" that
 * floor is slack, so 49% is held for how it looks, not because it has to be.
 * The menu's row metrics are tuned to this width — see SideMenu's padding.
 */
export function menuWidthFor(screenWidth: number): number {
  return Math.round(Math.min(268, screenWidth * 0.49));
}

/**
 * The panel's own surface: a neutral, really-dark grey, deliberately OFF the
 * app's teal-tinted palette. The app canvas is OLED black with a faint teal
 * cast; a neutral grey behind it reads as a different layer instead of another
 * card, which is the whole job of a drawer background.
 */
export const MENU_SURFACE = "#121212";

/** Separators inside the panel. The theme's divider is teal-tinted and vanishes
 *  against neutral grey, so the menu uses its own neutral hairline. */
export const MENU_HAIRLINE = "rgba(255, 255, 255, 0.08)";

/** How far in from the left edge a swipe can START an open. */
export const EDGE_HIT_WIDTH = 32;

/**
 * Content scale at full open — a shrink you feel more than see.
 *
 * IT IS ALSO HALF THE GAP. The app slides right by `menuWidth`, then the shrink
 * pulls its left edge a further `(1 - scale) / 2 × screenWidth` across, opening
 * a bare strip of panel surface between the menu and the card. At 0.88 that
 * strip was ~23pt on a normal phone — read as "the screen has been pushed too
 * far". At 0.94 it's ~12pt, and the rounded corners plus the scrim still do
 * enough of the lifting on their own.
 */
export const CONTENT_SCALE = 0.94;

/** Corner radius the content reaches at full open. */
export const CONTENT_RADIUS = 28;

/** Peak dim over the content when the menu is out. */
export const SCRIM_OPACITY = 0.45;

/** How far the panel lags behind the content — the parallax that gives depth. */
export const MENU_PARALLAX = 0.28;

/**
 * The snap. Firm and quick, with a touch of overshoot allowed on the shared
 * value (every consumer clamps its interpolation, so it never renders past the
 * ends — the spring just settles honestly instead of dying flat).
 */
export const DRAWER_SPRING = {
  damping: 24,
  stiffness: 240,
  mass: 0.9,
  restDisplacementThreshold: 0.002,
  restSpeedThreshold: 0.02,
} as const;

/**
 * Seconds of flick to project past the release point. A fast swipe that hasn't
 * crossed the halfway mark still opens, because that's plainly the intent.
 */
export const FLICK_PROJECTION = 0.14;

export type { SharedValue };
export default DrawerContext as React.Context<DrawerApi | null>;
