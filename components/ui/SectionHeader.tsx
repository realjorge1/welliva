/**
 * SectionHeader — a titled section break with an optional trailing action.
 */
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { useColors } from "./useColors";
import type { TextStyle } from "react-native";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  weight?: TextStyle["fontWeight"];
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, weight }: SectionHeaderProps) {
  const { colors } = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText variant="headline" weight={weight}>{title}</AppText>
        {subtitle && (
          <AppText variant="footnote" color="tertiary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        )}
      </View>
      {actionLabel && (
        <Pressable onPress={onAction} hitSlop={8} style={styles.action}>
          <AppText variant="callout" color="brand">
            {actionLabel}
          </AppText>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  flex: { flex: 1 },
  subtitle: { marginTop: 2 },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
});
