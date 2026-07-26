/**
 * Divider — a hairline rule that respects the theme.
 */
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "./useColors";

export function Divider({
  spacing = Spacing.lg,
  style,
}: {
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.divider,
          marginVertical: spacing,
        },
        style,
      ]}
    />
  );
}
