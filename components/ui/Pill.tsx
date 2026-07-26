/**
 * Pill — compact status/label chip with a tinted tone.
 */
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./Text";
import { useColors } from "./useColors";

export interface PillProps {
  label: string;
  /** Any hex (e.g. a data-viz hue) — drives tint + text color. */
  tone?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Custom icon node, takes precedence over `icon`. */
  iconNode?: React.ReactNode;
  /** Solid filled style instead of soft tint. */
  solid?: boolean;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

export function Pill({ label, tone, icon, iconNode, solid = false, size = "md", style }: PillProps) {
  const { colors } = useColors();
  const hue = tone ?? colors.primary;
  const isSm = size === "sm";
  const fg = solid ? "#FFFFFF" : hue;

  return (
    <View
      style={[
        styles.base,
        {
          paddingVertical: isSm ? 3 : 5,
          paddingHorizontal: isSm ? Spacing.sm : Spacing.md,
          backgroundColor: solid ? hue : alpha(hue, 0.14),
        },
        style,
      ]}
    >
      {iconNode ? (
        <View style={styles.icon}>{iconNode}</View>
      ) : icon ? (
        <Ionicons name={icon} size={isSm ? 11 : 13} color={fg} style={styles.icon} />
      ) : null}
      <AppText
        variant={isSm ? "caption" : "footnote"}
        color={fg}
        style={{ fontWeight: "700" }}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
  },
  icon: { marginRight: 4 },
});
