/**
 * IconBadge — an icon inside a soft tinted rounded square. The app's single
 * iconography pattern (replaces ad-hoc emoji + inline tinted Views).
 */
import { Radius, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "./useColors";

export interface IconBadgeProps {
  name: keyof typeof Ionicons.glyphMap;
  /** Hex hue — tints both glyph and background. Optional when `muted`. */
  tone?: string;
  /**
   * Neutral/muted badge: resolves a low-emphasis tone from the *current*
   * surface palette, so it stays correct on the page (dark) and inside a
   * deep-cyan card (light) without the caller plumbing colors.
   */
  muted?: boolean;
  size?: number;
  /** Solid filled background instead of soft tint. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconBadge({ name, tone, muted, size = 40, solid = false, style }: IconBadgeProps) {
  const { colors } = useColors();
  const hue = muted ? colors.textTertiary : tone ?? colors.textTertiary;
  const glyph = Math.round(size * 0.5);
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: Radius.md,
          backgroundColor: solid ? hue : alpha(hue, 0.2),
        },
        style,
      ]}
    >
      <Ionicons name={name} size={glyph} color={solid ? "#FFFFFF" : hue} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
});
