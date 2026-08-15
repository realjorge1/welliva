/**
 * TARGETS RECALC CARD — the one-time "I got this wrong, here's the new number".
 *
 * Shown once, next to the targets it's explaining, then never again. It exists
 * because the alternative is worse than the original bug: a user who has been
 * eating to 1,780 kcal opens the app to 2,010 with no explanation and reasonably
 * concludes the numbers are arbitrary.
 *
 * Content comes from services/nutrition/TargetsVersion — this component only
 * renders and dismisses it.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Button, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import {
  dismissTargetsNotice,
  getPendingTargetsNotice,
  type TargetsRecalcNotice,
} from "@/services/nutrition/TargetsVersion";

export function TargetsRecalcCard({ style }: { style?: View["props"]["style"] }) {
  const { colors } = useColors();
  const [notice, setNotice] = useState<TargetsRecalcNotice | null>(null);

  useEffect(() => {
    let alive = true;
    void getPendingTargetsNotice().then((n) => {
      if (alive) setNotice(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!notice) return null;

  const acknowledge = () => {
    setNotice(null); // optimistic — the card should never linger after a tap
    void dismissTargetsNotice();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: alpha(colors.primary, 0.1),
          borderColor: alpha(colors.primary, 0.3),
        },
        style,
      ]}
    >
      <View style={styles.head}>
        <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
        <AppText variant="callout">I&apos;ve corrected your targets</AppText>
      </View>

      {notice.message.split("\n\n").map((paragraph) => (
        <AppText
          key={paragraph}
          variant="footnote"
          color="secondary"
          style={styles.copy}
        >
          {paragraph}
        </AppText>
      ))}

      <Button
        label="Got it"
        variant="tonal"
        size="sm"
        onPress={acknowledge}
        style={styles.action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  copy: { lineHeight: 19 },
  action: { marginTop: Spacing.xs },
});
