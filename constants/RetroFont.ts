import type { TextStyle } from "react-native";

/**
 * The rounded digital-display face (Orbitron) for the few figures that
 * should read like a digital readout: the nutrition card's Target /
 * Remaining and the diet name on Diet's plan banner. The key is the family name
 * registered with useFonts in app/_layout.tsx.
 *
 * It is a variable font whose default weight is used, so the weight is
 * pinned to normal — a bold request would make Android synthesise a smeared one.
 */
export const RETRO_FONT = "Orbitron";

/**
 * Headings of Gozlin's insights (coach card titles, the deep-dive title,
 * moment titles) in the digital face. Body text stays in the normal font.
 * Orbitron runs wide, so it sits a size below the type it replaces. Spread
 * LAST in a style array.
 */
export const insightTitle: TextStyle = {
  fontFamily: RETRO_FONT,
  fontWeight: "normal",
  fontSize: 14,
  lineHeight: 22,
  letterSpacing: 0.3,
};

export const retroText: TextStyle = {
  fontFamily: RETRO_FONT,
  fontWeight: "normal",
  fontSize: 17,
  lineHeight: 24,
};
