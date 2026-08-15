/**
 * ProLockCard — the in-place upgrade prompt.
 *
 * The standard way a locked feature presents itself: a calm card that explains
 * what Pro adds, in the spot where the feature would have been. It replaces the
 * feature rather than blocking the screen, so a free user can still read and use
 * everything around it.
 *
 * Never use an alert or a full-screen interruption for a lock. The user was
 * mid-task; the ask should be something they can ignore and come back to.
 */
import { Button, Card, AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useBilling } from "@/contexts/BillingContext";
import { LOCK_COPY, type LockId } from "./lockCopy";

export function ProLockCard({
  lock,
  /** Overrides the lock's default headline (e.g. to name the specific diet). */
  title,
  blurb,
  compact = false,
  style,
}: {
  lock: LockId;
  title?: string;
  blurb?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  const { openPaywall } = useBilling();
  const copy = LOCK_COPY[lock];

  return (
    <Card padding={compact ? "lg" : "xxl"} style={style}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: alpha(colors.gold, 0.14) }]}>
          <Ionicons name={copy.icon} size={compact ? 18 : 22} color={colors.gold} />
        </View>
        <AppText variant={compact ? "callout" : "headline"} style={styles.title}>
          {title ?? copy.title}
        </AppText>
      </View>

      <AppText variant={compact ? "footnote" : "subhead"} color="secondary" style={styles.blurb}>
        {blurb ?? copy.blurb}
      </AppText>

      <Button
        label="See Welliva Pro"
        size={compact ? "sm" : "md"}
        icon="arrow-forward"
        iconRight
        onPress={() => openPaywall(lock)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1 },
  blurb: { marginTop: Spacing.md, marginBottom: Spacing.lg },
});
