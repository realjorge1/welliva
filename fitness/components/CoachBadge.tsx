/**
 * CoachBadge — monogram badge for a Welliva coach persona.
 * Coaches are original editorial characters; no likeness imagery is used.
 */

import { AppText } from "@/components/ui";
import React from "react";
import { StyleSheet, View } from "react-native";
import { getCoach } from "../data/coaches";

const HUE_TINTS: Record<string, string> = {
  brand: "#0E9FC4",
  ember: "#E06A40",
  violet: "#7B84DC",
  gold: "#CBA14E",
  teal: "#2DBE9F",
  sky: "#4FA8DB",
};

export function CoachBadge({ coachId, size = 34 }: { coachId: string; size?: number }) {
  const coach = getCoach(coachId);
  const tint = HUE_TINTS[coach.hue] ?? HUE_TINTS.brand;
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
      ]}
      accessibilityLabel={`Coach ${coach.name}`}
    >
      <AppText variant="callout" style={styles.letter}>
        {coach.name.charAt(0)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
  letter: { color: "#FFFFFF", fontWeight: "800" },
});
