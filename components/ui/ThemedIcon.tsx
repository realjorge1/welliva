/**
 * ThemedIcon — an Ionicon whose color is resolved from the *current* surface
 * palette (via useColors). Use inside cards in place of a raw
 * `<Ionicons color={colors.textTertiary} />`: because it reads colors during
 * its own render, it picks up a Card's inverted (light-on-dark) palette
 * automatically, and stays dark when placed on the page. Works in both themes.
 */
import type { ThemeColors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import type { StyleProp, TextStyle } from "react-native";
import { useColors } from "./useColors";

/** Color tokens that make sense for a glyph. */
type IconRole = "text" | "textSecondary" | "textTertiary" | "icon" | "primary";

export interface ThemedIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  /** Which palette token to tint with (default: textTertiary). */
  role?: IconRole & keyof ThemeColors;
  style?: StyleProp<TextStyle>;
  /**
   * Spoken name, for the rare glyph that carries meaning on its own. Almost
   * always leave this unset: these icons are chevrons and affordance hints
   * beside text that already says the same thing.
   */
  accessibilityLabel?: string;
}

export function ThemedIcon({
  name,
  size = 18,
  role = "textTertiary",
  style,
  accessibilityLabel,
}: ThemedIconProps) {
  const { colors } = useColors();
  const decorative = !accessibilityLabel;
  return (
    <Ionicons
      name={name}
      size={size}
      color={colors[role]}
      style={style}
      // An Ionicon is a Text node carrying a private-use glyph, so left alone a
      // screen reader reads it as a meaningless character. Decorative by
      // default — which is what a chevron next to a labelled row actually is.
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
