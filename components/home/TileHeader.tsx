/**
 * TileHeader — the title row of a Home tile: an orange square, the name, and an
 * optional control on the far side.
 *
 * The square is the block's one accent mark — the same orange as the calorie
 * ring — so Fitness, Weight and Your week read as one family without any of
 * them needing its own colour.
 */
import { AppText } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import { HOME_ORANGE } from "./surface";

export function TileHeader({
  label,
  right,
  tone = HOME_ORANGE,
}: {
  label: string;
  right?: React.ReactNode;
  /** The square's colour. Orange for the whole block; a card with a colour of
   *  its own (Hydration's water) can say so. */
  tone?: string;
}) {
  return (
    <View style={styles.head}>
      <View style={styles.title}>
        <View style={[styles.square, { backgroundColor: tone }]} />
        <AppText variant="footnote" weight="600" color="secondary" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    minHeight: 28,
  },
  title: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  square: { width: 8, height: 8, borderRadius: 2, backgroundColor: HOME_ORANGE },
});
