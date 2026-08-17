/**
 * Chip — a selectable pill for choosing from an open-ended list (cuisines,
 * allergies, conditions). Single- or multi-select is the caller's business;
 * the chip only knows whether it is on.
 *
 * The unselected fill is the SUNKEN surface, not the card surface: a chip drawn
 * in `surface` inside a card of the same color leaves only its hairline border
 * visible, which is what made long chip groups read as a field of empty
 * outlines in dark mode.
 */
import { Radius, Spacing } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./Text";
import { useColors } from "./useColors";

export interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Selected fill. Defaults to the brand color. */
  tone?: string;
  size?: "sm" | "md";
  /**
   * What the chip actually does, when the label is a shorthand for it. A filter
   * reading "Low carb" is a name, not a definition — sighted users can find the
   * threshold elsewhere on the screen, and this is where everyone else gets it.
   */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  tone,
  size = "md",
  hint,
  style,
}: ChipProps) {
  const { colors } = useColors();
  const hue = tone ?? colors.primary;
  const isSm = size === "sm";
  const fg = active ? colors.onPrimary : colors.textSecondary;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint ? { accessibilityHint: hint } : {})}
      // Without `selected` every chip in a group sounds identical to a screen
      // reader — there'd be no way to hear which option is currently chosen.
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: isSm ? 6 : Spacing.sm,
          paddingHorizontal: isSm ? Spacing.md : Spacing.lg,
          backgroundColor: active ? hue : colors.surfaceSunken,
          borderColor: active ? hue : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={isSm ? 13 : 15} color={fg} /> : null}
      <AppText variant={isSm ? "footnote" : "subhead"} color={fg} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  label: { fontWeight: "600" },
});
