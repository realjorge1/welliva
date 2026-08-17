/**
 * Stepper — the −/value/+ control that sits on the trailing edge of a ListRow.
 *
 * The value lives BETWEEN the two buttons rather than in the row's subtitle:
 * it's the thing the buttons change, so it belongs under the thumb that changes
 * it, and the row's subtitle stays free to explain what the setting means.
 */
import { Radius, Spacing } from "@/constants/theme";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./Text";
import { useColors } from "./useColors";

export interface StepperProps {
  /** Formatted for display, units included — "2.5 L", "72 kg", "3 / week". */
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  /**
   * What each button changes. "+"/"−" alone tell a screen-reader user nothing,
   * and every stepper on a settings page sounds identical without this.
   */
  label: string;
  /** Minimum width of the value column, so a changing value doesn't shuffle
   *  the buttons left and right as digits are added. */
  valueWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function Stepper({
  value,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
  label,
  valueWidth = 62,
  style,
}: StepperProps) {
  return (
    <View style={[styles.row, style]}>
      <StepButton
        icon="remove"
        onPress={onDecrement}
        disabled={!canDecrement}
        label={`Decrease ${label}`}
      />
      <AppText
        variant="callout"
        align="center"
        style={[styles.value, { minWidth: valueWidth }]}
        // Read as the stepper's own value; the buttons name themselves.
        accessibilityLabel={`${label}: ${value}`}
      >
        {value}
      </AppText>
      <StepButton
        icon="add"
        onPress={onIncrement}
        disabled={!canIncrement}
        label={`Increase ${label}`}
      />
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.surfaceSunken,
          borderColor: colors.border,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  value: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  btn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
