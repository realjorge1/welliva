/**
 * PORTION SHEET — "how much of it did you have?" for a ticked meal.
 *
 * One tap still ticks a meal as planned; this is the optional second tap. Each
 * choice shows what it records in her numbers ("Less (½) · 210 kcal"), and the
 * one she has now is marked. The meal keeps its name: only the amount changes.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { servingsLabel } from "./types";

const CHOICES: { portion: number; label: string }[] = [
  { portion: 0.5, label: "Less" },
  { portion: 0.75, label: "A little less" },
  { portion: 1, label: "As planned" },
  { portion: 1.25, label: "A little more" },
  { portion: 1.5, label: "More" },
  { portion: 2, label: "Double" },
];

export interface PortionSheetProps {
  visible: boolean;
  /** The meal's name, for the title. */
  name: string;
  /** kcal of the meal AS PLANNED (portion 1). */
  plannedKcal: number;
  current: number;
  onPick: (portion: number) => void;
  onClose: () => void;
}

export function PortionSheet({ visible, name, plannedKcal, current, onPick, onClose }: PortionSheetProps) {
  const { colors } = useColors();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={
        <View style={styles.header}>
          <AppText variant="headline">How much did you have?</AppText>
          <AppText variant="footnote" color="secondary" numberOfLines={2}>
            {name}
          </AppText>
        </View>
      }
    >
      <View style={styles.list} accessibilityRole="radiogroup">
        {CHOICES.map((c) => {
          const active = Math.abs(c.portion - current) < 0.01;
          return (
            <Pressable
              key={c.portion}
              onPress={() => onPick(c.portion)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, checked: active }}
              accessibilityLabel={`${c.label}, ${servingsLabel(c.portion)}, ${Math.round(plannedKcal * c.portion)} calories`}
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: active ? alpha(colors.primary, 0.6) : colors.border,
                  backgroundColor: active ? alpha(colors.primary, 0.1) : "transparent",
                },
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="callout" style={styles.flex}>
                {c.label} ({servingsLabel(c.portion)})
              </AppText>
              <AppText variant="footnote" color="secondary">
                {Math.round(plannedKcal * c.portion).toLocaleString()} kcal
              </AppText>
              {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingBottom: Spacing.sm },
  list: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
});
