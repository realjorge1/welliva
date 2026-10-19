/**
 * THE MENU'S VERTICAL RHYTHM — how the drawer spends a tall phone's spare height.
 *
 * Owner, 2026-10-15, against a ~790dp phone: "acres of space between Memory and
 * Upgrade … Upgrade & Settings must not permanently dwell at the bottom-most of
 * the screen, they can be raised a bit … this app should be responsive in all
 * screen and device types and not good in some and poor in others."
 *
 * The old panel gave the list `flex: 1` and pinned the footer beneath it, so
 * every spare point a tall phone had became ONE gap, between Memory and
 * Upgrade, and Settings sat on the floor — 4dp off the glass on a phone whose
 * gesture bar reports no inset. Now the footer FOLLOWS the list, and the slack
 * is spent in this order:
 *
 *   1. LIFT — the first 12dp raise Settings off the bottom edge (4 → 16).
 *   2. ROWS — 60% of the rest grows every row (46 → at most 56): bigger
 *      targets and a calmer list, the way a navigation drawer breathes on a
 *      tall phone.
 *   3. GAPS — 15% opens the air around both hairlines (12 → at most 24).
 *   4. Whatever is left lands UNDER Settings, through the flexing spacer.
 *
 * Every step is capped, so a tablet gets a roomy list with the room below it,
 * never rows stretched to fill a 1000dp column. On a short phone there is no
 * slack at all: the metrics are exactly the ones the panel was tuned at, the
 * list scrolls, and the footer stays in view beneath it — the behaviour the
 * owner called fine on small screens.
 *
 * Pure on purpose (no react-native import): the numbers are the whole design,
 * and they are tested across real phone heights in __tests__/menuRhythm.test.ts.
 */

/** A row at its tightest — the height the panel's metrics were tuned at. */
export const ROW_MIN = 46;
/** A row at its roomiest. */
export const ROW_MAX = 56;
/** Between neighbouring rows, in the list and in the footer. */
export const ROW_GAP = 2;
/** Air above and below a hairline at its tightest… */
export const GAP_MIN = 12;
/** …and at its roomiest. */
export const GAP_MAX = 24;
/** The list's top padding, under the profile header. */
export const LIST_PAD_TOP = 12;
/** Settings' distance from the bottom inset when there is no room to spare. */
export const LIFT_TIGHT = 4;
/** How much of the first slack goes to lifting Settings off the edge. */
const LIFT_RAISE = 12;
const ROW_SHARE = 0.6;
const GAP_SHARE = 0.15;
/** Hairline air slots: above and below the list's hairline, the list's foot, the footer's head. */
const GAP_SLOTS = 4;

export interface MenuShape {
  /** Rows in the scrolling list — primary plus secondary. */
  listRows: number;
  /** Rows in the footer. */
  footerRows: number;
  /** `StyleSheet.hairlineWidth`, passed in so this file stays free of react-native. */
  hairline: number;
}

export interface MenuRhythm {
  /** Every row's height, list and footer alike. */
  row: number;
  /** Air above and below each hairline: the list's own, and the footer's. */
  gap: number;
  /** Settings' minimum distance above the bottom inset. The spacer flexes past it. */
  lift: number;
}

/** The list plus the footer at the given metrics — the lift not included. */
export function menuContentHeight(shape: MenuShape, row: number, gap: number): number {
  const { listRows, footerRows, hairline } = shape;
  // listRows + 1 children (the hairline is one), so listRows gaps between them.
  const list =
    LIST_PAD_TOP + listRows * row + listRows * ROW_GAP + (hairline + 2 * gap) + gap;
  const footer = hairline + gap + footerRows * row + (footerRows - 1) * ROW_GAP;
  return list + footer;
}

/**
 * The rhythm for a body of `bodyHeight` (everything under the profile header)
 * above a device inset of `bottomInset`. Never asks for more than the body
 * has: lift + inset + content always fits whenever the tight layout did.
 */
export function menuRhythm(
  bodyHeight: number,
  bottomInset: number,
  shape: MenuShape,
): MenuRhythm {
  const tight: MenuRhythm = { row: ROW_MIN, gap: GAP_MIN, lift: LIFT_TIGHT };
  // Not measured yet — the panel lays out before it is ever seen.
  if (!(bodyHeight > 0)) return tight;

  let free =
    bodyHeight - bottomInset - LIFT_TIGHT - menuContentHeight(shape, ROW_MIN, GAP_MIN);
  if (free <= 0) return tight;

  const raise = Math.min(LIFT_RAISE, free);
  free -= raise;
  const rows = shape.listRows + shape.footerRows;
  const rowGrow = Math.min(ROW_MAX - ROW_MIN, (free * ROW_SHARE) / rows);
  const gapGrow = Math.min(GAP_MAX - GAP_MIN, (free * GAP_SHARE) / GAP_SLOTS);

  return {
    row: Math.floor(ROW_MIN + rowGrow),
    gap: Math.floor(GAP_MIN + gapGrow),
    lift: LIFT_TIGHT + raise,
  };
}
