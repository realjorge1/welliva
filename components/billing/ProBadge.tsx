/**
 * ProBadge — the "PRO" marker on a locked row.
 *
 * Used in lists where locked and unlocked items sit side by side (the diet
 * catalog, the habit list). Showing the locked item rather than hiding it is
 * deliberate: a diet the user can see and wants is a reason to upgrade, whereas
 * a catalog that quietly holds 22 entries back teaches them the app is small.
 */
import { Pill } from "@/components/ui";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { useColors } from "@/components/ui";

export function ProBadge({
  size = "sm",
  style,
}: {
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return <Pill label="PRO" tone={colors.gold} icon="lock-closed" size={size} style={style} />;
}
