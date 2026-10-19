/**
 * THE RECEIPT — a one-line "that worked", stacked directly above the rail.
 *
 * What is left of the dock. The dock was a card that carried a live session, the
 * next prompt and a finished-day sentence above the rail; it is gone, and the
 * rail's own folded pill is the only place those are spoken now. This stayed,
 * because a write with no visible result ("250 ml logged") is indistinguishable
 * from a write that failed, and it is the one thing the dock did that the rail
 * cannot.
 *
 * It sits in the flow above the rail rather than `position: absolute; top:`
 * inside the bottom-pinned Deck, which is how the old confirmation landed below
 * the bottom edge of the screen every time.
 */

import { enterFade, exitFade } from "@/components/motion";
import { AppText } from "@/components/ui/Text";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { DECK_GAP } from "./DeckContext";

export function Receipt({ message }: { message: string }) {
  const { colors } = useColors();
  return (
    <Animated.View
      entering={enterFade()}
      exiting={exitFade()}
      style={styles.wrap}
      pointerEvents="none"
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}
      >
        <Ionicons name="checkmark-circle" size={15} color={colors.success} />
        <AppText variant="caption" weight="700" numberOfLines={1}>
          {message}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: DECK_GAP },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "92%",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
