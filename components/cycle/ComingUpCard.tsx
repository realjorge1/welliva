/**
 * "COMING UP" — a predicted period that is likely to meet her trip or her race.
 *
 * Every word is services/cycle/upcoming's: "will probably" only when the most
 * likely day falls inside the event, "might" when only the window's edge does,
 * and underneath, the window itself and the same confidence words the cycle
 * screen uses. This file lays it out and nothing else.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { trainingNote, type ComingUp, type CyclePattern, type MomentKind } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCyclePalette } from "./cycleTheme";

const ICON: Record<MomentKind, keyof typeof Ionicons.glyphMap> = {
  travel: "airplane-outline",
  vacation: "sunny-outline",
  holiday: "gift-outline",
  wedding: "heart-outline",
  competition: "trophy-outline",
  exam_period: "school-outline",
};

export function ComingUpCard({
  item,
  patterns,
  style,
}: {
  item: ComingUp;
  /** Her patterns, for what her training says about a race. */
  patterns: readonly CyclePattern[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const training = trainingNote(item, patterns);
  return (
    <View style={[styles.card, { backgroundColor: palette.wash }, style]} accessible>
      <View style={styles.head}>
        <Ionicons name={ICON[item.kind]} size={16} color={palette.period} />
        <AppText variant="caption" color="tertiary" uppercase>
          Coming up
        </AppText>
      </View>
      <AppText variant="subhead" style={[styles.text, { color: colors.text }]}>
        {item.text}
        {training ? ` ${training}` : ""}
      </AppText>
      <AppText variant="caption" color="tertiary" style={styles.detail}>
        {item.detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.xl },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  text: { marginTop: Spacing.sm },
  detail: { marginTop: Spacing.xs },
});
