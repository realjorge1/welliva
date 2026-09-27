/**
 * The two inks the price tags need that the theme doesn't carry.
 *
 * Palette gold (#E9C16B) is right as a FILL or a BORDER in both themes, and as
 * text on black. As text on a light surface it is about 1.7:1 — which is how
 * the storefront's "Save $10.00 a year" used to render in light mode: the one
 * sentence it most wanted read, at a contrast nobody can read.
 */
import type { ThemeColors } from "@/constants/theme";

/** The same hue taken down to ~5.4:1 on white (~5:1 on a gold-tinted card). */
const GOLD_INK_LIGHT = "#8A6415";

/** Text sitting ON a gold fill, in either theme — ~9.5:1. */
export const ON_GOLD = "#2A1F05";

/** Gold as a colour for WORDS: palette gold in dark mode, the deep ink in light. */
export function goldInk(colors: ThemeColors, isDark: boolean): string {
  return isDark ? colors.gold : GOLD_INK_LIGHT;
}
