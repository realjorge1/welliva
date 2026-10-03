/**
 * PlanReasons — "How this week was built".
 *
 * The plan's own reasons, one line per input that shaped the week: the goal
 * and how it doses work, the days, the session length, the level, what the
 * user's body rules out, the kit, the extras, what last week's sessions moved.
 * Each line is written by the engine from the same value that shaped the plan
 * (services/training/week.ts `weekReasons`), so nothing here is decoration.
 *
 * It replaces the old "Tailored to you 92%" card, whose number started at 92
 * and gained points for owning equipment — a constant dressed as a measurement.
 *
 * Card-less, like the week rail below it: a short list on the canvas, the
 * first four lines open, the rest one tap away.
 */
import { AppText, SectionHeader, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const OPEN_LINES = 4;

export function PlanReasons({
  reasons,
  onEdit,
}: {
  reasons: string[];
  /** Opens the training preferences these lines are built from. */
  onEdit: () => void;
}) {
  const { colors } = useColors();
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  const shown = open ? reasons : reasons.slice(0, OPEN_LINES);
  const hidden = reasons.length - OPEN_LINES;

  return (
    <View>
      <SectionHeader
        title="How this week was built"
        subtitle="From your profile, your preferences and what you logged"
        actionLabel="Edit"
        onAction={onEdit}
        weight="700"
      />
      <View style={styles.list}>
        {shown.map((line) => (
          <View key={line} style={styles.row}>
            <Ionicons
              name="checkmark-circle-outline"
              size={15}
              color={colors.primary}
              style={styles.icon}
            />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              {line}
            </AppText>
          </View>
        ))}
      </View>
      {hidden > 0 && (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={open ? "Show fewer reasons" : `Show all ${reasons.length} reasons`}
          accessibilityState={{ expanded: open }}
        >
          <AppText variant="footnote" color="brand" weight="600">
            {open ? "Show less" : `Show all ${reasons.length}`}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  icon: { marginTop: 1 },
  more: { marginTop: Spacing.md, alignSelf: "flex-start" },
});
