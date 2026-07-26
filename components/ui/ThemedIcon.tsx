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
}

export function ThemedIcon({ name, size = 18, role = "textTertiary", style }: ThemedIconProps) {
  const { colors } = useColors();
  return <Ionicons name={name} size={size} color={colors[role]} style={style} />;
}
