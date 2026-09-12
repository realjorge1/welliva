/**
 * ONBOARDING THEME — the editorial layer on top of the app's design system.
 *
 * This file adds NO new colours. Welliva's identity is already fixed in
 * `constants/theme` (an OLED-black canvas, a gold brand, a pale sky wash for
 * surfaces) and the onboarding is the user's first sight of it — inventing a
 * second palette here would make the app they land on look like a different
 * product. What this file does is change the RHYTHM: wider gutters, larger
 * type, more air between layers, and one soft "settled" surface recipe used by
 * every selectable thing in the flow.
 *
 * The brief asked for warm off-white with charcoal ink. The app is locked to
 * dark (`LIGHT_MODE_ENABLED = false`), so the QUALITIES of that request are
 * translated rather than the values: soft neutral surfaces (the sky wash, never
 * a coloured panel), hairline borders, generous radii, restrained gradients
 * (the brand ramp appears exactly twice — the primary action and the calorie
 * ring), and no fill that shouts.
 */
import { Spacing } from "@/constants/theme";

/* ──────────────────────────────── Rhythm ───────────────────────────────── */

/**
 * The onboarding breathes wider than the app. `Spacing.screen` is 12 — correct
 * for dense dashboards, far too tight for a screen holding one question.
 */
export const Gutter = 22;

export const Rhythm = {
  /** Between the layers of a composition (headline → copy → options). */
  layer: Spacing.xxl,
  /** Between a question and its options — the deliberate pause, in space. */
  question: Spacing.xxxl,
  /** Between sibling options. */
  option: Spacing.md,
  /** Top of the content area to the first line of type. */
  crown: Spacing.xl,
  /** Room under the last option so nothing ever kisses the action bar. */
  tail: Spacing.giant,
} as const;

/* ───────────────────────────────── Type ────────────────────────────────── */

/**
 * Onboarding headings run one step larger and MUCH looser than the app scale —
 * `Typography.title` is 22/32, which is right on a crowded dashboard and reads
 * as a form label when it is the only sentence on the screen.
 */
export const Editorial = {
  /** The question itself. Oversized, generous leading, tight tracking. */
  question: { fontSize: 27, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  /** The welcome / plan statement line. */
  statement: { fontSize: 33, lineHeight: 43, fontWeight: "700", letterSpacing: -0.6 },
  /** Supporting copy under a question. Roomy leading, never bold. */
  support: { fontSize: 15, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  /** The kicker above a question. */
  kicker: { fontSize: 11, lineHeight: 15, fontWeight: "600", letterSpacing: 1.4 },
} as const;

/* ───────────────────────────────── Hairlines ───────────────────────────── */

/** The decorative hairline weight used by every drawn line in the flow. */
export const HAIRLINE = 1.25;

/** Opacity ramp for the concentric/ambient hairlines behind a hero. */
export const HALO = [0.06, 0.12, 0.2] as const;

/* ──────────────────────────────── Touch ────────────────────────────────── */

/** Apple's minimum. Every tappable thing in the flow clears it. */
export const MIN_TOUCH = 44;

/** Standard hit expansion for small controls (nodes, chevrons, skip links). */
export const HIT = { top: 12, bottom: 12, left: 12, right: 12 } as const;

export { Gutter as ONBOARDING_GUTTER };
