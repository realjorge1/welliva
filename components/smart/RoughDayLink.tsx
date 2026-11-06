/**
 * RoughDayLink — the small, calm way in ("Rough day?") and the way out
 * ("I'm OK actually"). Plain words, no icon, no card: it should be there when
 * someone looks for it and easy to read past when they aren't.
 */
import { AppText } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

export function RoughDayLink({
  rough,
  onOpen,
  onOk,
}: {
  /** Today is already a rough day. */
  rough: boolean;
  onOpen: () => void;
  onOk: () => void;
}) {
  return (
    <Pressable
      onPress={rough ? onOk : onOpen}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={rough ? "I'm OK actually. Back to a normal day." : "Rough day? Make today gentle."}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <AppText variant="footnote" weight="600" color="secondary" align="center" style={styles.text}>
        {rough ? "I'm OK actually" : "Rough day?"}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: "center", marginTop: Spacing.sm, paddingVertical: Spacing.xs },
  pressed: { opacity: 0.6 },
  text: { textDecorationLine: "underline" },
});
