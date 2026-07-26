/**
 * Stat — a compact value/label pair used in stat rows and summaries.
 */
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./Text";

export interface StatProps {
  value: string | number;
  label: string;
  tone?: string;
  align?: "center" | "flex-start" | "flex-end";
  style?: StyleProp<ViewStyle>;
}

export function Stat({ value, label, tone, align = "center", style }: StatProps) {
  return (
    <View style={[{ alignItems: align }, style]}>
      <AppText variant="title" color={tone ?? "primary"} style={styles.value}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary" uppercase style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { fontWeight: "800" },
  label: { marginTop: Spacing.xs },
});
