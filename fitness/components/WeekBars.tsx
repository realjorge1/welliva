/**
 * WeekBars — 8-week consistency chart drawn with plain Views (no chart lib,
 * no SVG re-layout cost). Each bar is a week's active minutes; the current
 * week glows in the brand color.
 */

import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { WeekActivity } from "../types";

export function WeekBars({ weeks, height = 72 }: { weeks: WeekActivity[]; height?: number }) {
  const { colors } = useColors();
  const max = Math.max(30, ...weeks.map((w) => w.minutes));
  return (
    <View accessibilityLabel={`Weekly minutes over the last ${weeks.length} weeks`}>
      <View style={[styles.bars, { height }]}>
        {weeks.map((w, i) => {
          const isCurrent = i === weeks.length - 1;
          const h = Math.max(4, Math.round((w.minutes / max) * height));
          return (
            <View key={w.weekStart} style={styles.slot}>
              <View
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: isCurrent
                      ? colors.primary
                      : w.minutes > 0
                        ? alpha(colors.primary, 0.35)
                        : colors.surfaceMuted,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        <AppText variant="caption" color="tertiary">
          {weeks.length} wks ago
        </AppText>
        <AppText variant="caption" color="tertiary">
          This week
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  slot: { flex: 1, alignItems: "stretch", justifyContent: "flex-end" },
  bar: { borderRadius: Radius.xs },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
});
