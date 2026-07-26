/**
 * MOTION LANGUAGE — the one grammar for how Welliva moves.
 *
 * Screens never hand-roll easing curves or durations: they compose these
 * factories, which all derive from the `Motion` tokens in constants/theme.
 * Everything here runs on the UI thread (Reanimated worklets), so animation
 * never competes with JS work.
 *
 *   enterPhase / exitPhase — crossfade+drift for phase-level content swaps
 *                            (the guided session's countdown → set → rest)
 *   enterRise(index)       — staggered entrance for cards/sections
 *   enterHero              — a single hero element landing (springy, rare)
 *   tickIn / tickOut       — micro roll used by RollingNumber digits
 */
import { Motion } from "@/constants/theme";
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";

const [sx1, sy1, sx2, sy2] = Motion.easing.standard;
const [dx1, dy1, dx2, dy2] = Motion.easing.decelerate;
const [ax1, ay1, ax2, ay2] = Motion.easing.accelerate;

/** Shared easing curves, built once from the theme tokens. */
export const Ease = {
  standard: Easing.bezier(sx1, sy1, sx2, sy2),
  decelerate: Easing.bezier(dx1, dy1, dx2, dy2),
  accelerate: Easing.bezier(ax1, ay1, ax2, ay2),
} as const;

/* ── Phase-level transitions (screen regions swapping content) ── */

export const enterPhase = () =>
  FadeInDown.duration(Motion.duration.slow).easing(Ease.decelerate);

export const exitPhase = () =>
  FadeOut.duration(Motion.duration.base).easing(Ease.accelerate);

/* ── Section/card entrances ── */

export const enterRise = (index = 0) =>
  FadeInDown.duration(Motion.duration.slow)
    .delay(index * 90)
    .easing(Ease.decelerate);

export const enterFade = () =>
  FadeIn.duration(Motion.duration.base).easing(Ease.decelerate);

export const exitFade = () =>
  FadeOut.duration(Motion.duration.fast).easing(Ease.accelerate);

/* ── Hero moments (rare, springy) ── */

export const enterHero = () => ZoomIn.springify().damping(14).stiffness(160);

/* ── Micro ticks (RollingNumber digits) ── */

export const tickInUp = () =>
  FadeInUp.duration(Motion.duration.fast).easing(Ease.decelerate);
export const tickOutUp = () =>
  FadeOutUp.duration(Motion.duration.fast).easing(Ease.accelerate);
export const tickInDown = () =>
  FadeInDown.duration(Motion.duration.fast).easing(Ease.decelerate);
export const tickOutDown = () =>
  FadeOutDown.duration(Motion.duration.fast).easing(Ease.accelerate);

/** Layout shifts (row width changing as digits appear) settle smoothly. */
export const settleLayout = () =>
  LinearTransition.duration(Motion.duration.base).easing(Ease.standard);
