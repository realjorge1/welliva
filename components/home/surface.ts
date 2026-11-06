/**
 * THE INSTRUMENT SURFACE — the look of Home's black cards.
 *
 * Pure black, the same as the canvas, so a card is drawn by its EDGE and not by
 * its fill: white around the hero, orange around the three macro cards. One
 * accent carries the whole block — the orange of the calorie ring — and it is
 * read OFF the ring's own gradient, so the glow, the edges, the markers and the
 * ring can never drift apart.
 */
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";

/** The calorie ring's orange. */
export const HOME_ORANGE = Gradients.calories[1];
/** The canvas colour, so the card has no fill of its own. */
export const INSTRUMENT_BLACK = "#000000";
/** Full white: the lit dots of a figure, on a card that is black. */
export const INSTRUMENT_WHITE = "#FFFFFF";
/** The hero card's thin white edge. */
export const EDGE_WHITE = alpha("#FFFFFF", 0.26);
/** The macro cards' thin orange edge. */
export const EDGE_ORANGE = alpha(HOME_ORANGE, 0.6);
/** Dark ink for text that sits ON the orange (a "+", a button label). */
export const ON_ORANGE = "#1F1000";

/**
 * The plain instrument card: black, a thin white edge, the hero's corner. Every
 * edge-drawn card that has no colour of its own (Your week, Fitness, the Diet
 * screen's Consistency) wears exactly this, so they read as one family with the
 * calorie hero and the hydration card.
 */
export const INSTRUMENT_CARD = {
  backgroundColor: INSTRUMENT_BLACK,
  borderRadius: Radius.xxl,
  borderWidth: 1,
  borderColor: EDGE_WHITE,
  padding: Spacing.lg,
} as const;

/**
 * The orange glow at the foot of an instrument card: transparent at the top of
 * its band, strongest at the card's bottom edge. Fractions of the BAND, never of
 * the card — whatever sits above the band can't be reached by it. Shared by the
 * calorie hero and the Diet screen's Consistency card.
 */
export const GLOW_ORANGE = [
  alpha(HOME_ORANGE, 0),
  alpha(HOME_ORANGE, 0.1),
  alpha(HOME_ORANGE, 0.44),
  alpha(HOME_ORANGE, 0.76),
] as const;
export const GLOW_AT = [0, 0.35, 0.75, 1] as const;

/**
 * The macros' own colours for the dot beside the name and the lit dots of the
 * bar: the SATURATED end of each metric's gradient in the theme, not the pastel
 * data-viz tones (`colors.protein` and friends).
 *
 * The pastels are right on a chart, where they sit beside one another. Here a lit
 * dot has to read as a colour at a glance, directly beside an unlit dot that is
 * plain white — and a pale gold or a periwinkle is within a shade of white.
 * These are full-chroma, and bright enough to stay legible on black (the violet
 * is the lightest of the three so that it keeps its distance from the unlit dot
 * in brightness as well as in hue).
 */
export const MACRO_VIVID = {
  protein: "#00E0AC",
  carbs: "#FFB020",
  fat: "#8E80FF",
} as const;

/**
 * The same three hues pushed as bright as they go while staying themselves — for
 * Home's macro cards only, where the lit dots sit on pure black beside a nearly
 * invisible unlit row and have to GLOW (owner, 2026-11-01: "make colors
 * brighter"). The mint is at full value, the amber and the violet are lifted
 * toward white by a notch — any further and they drift into the pastels the card
 * is deliberately not using (see MACRO_VIVID). The Diet screen's cards and charts
 * keep MACRO_VIVID.
 */
export const MACRO_BRIGHT = {
  protein: "#00FFC6",
  carbs: "#FFC83D",
  fat: "#A99BFF",
} as const;
