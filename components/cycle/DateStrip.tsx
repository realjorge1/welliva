/**
 * DateStrip — pick a recent day with one tap.
 *
 * Today first, then backwards: the answer to "when did it start?" is almost
 * always within the last few days, so those sit under the thumb and older days
 * are a swipe away. Month names appear where a month begins, so a long scroll
 * never loses its place.
 */
import { AppText, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { addDays, formatDay, weekdayOf } from "@/services/cycle";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useCyclePalette } from "./cycleTheme";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DateStripProps {
  /** The newest day offered — today, unless the question is about the past. */
  today: string;
  /** Label the newest two days "Today" and "Yest." — false when `today` isn't today. */
  relative?: boolean;
  /** How many days back the strip reaches (inclusive of today). */
  days: number;
  value: string | null;
  onChange: (date: string) => void;
  /** Earliest allowed day — older ones are left out. */
  earliest?: string;
}

export function DateStrip({ today, relative = true, days, value, onChange, earliest }: DateStripProps) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = addDays(today, -i);
      if (earliest && d < earliest) break;
      out.push(d);
    }
    return out;
  }, [today, days, earliest]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
      removeClippedSubviews={false}
    >
      {dates.map((d, i) => {
        const selected = d === value;
        const monthStart = i === 0 || d.slice(8, 10) === "01" || i === dates.length - 1;
        const label =
          relative && i === 0 ? "Today" : relative && i === 1 ? "Yest." : WEEKDAY[weekdayOf(d)];
        return (
          <View key={d} style={styles.slot}>
            <AppText variant="caption" color="tertiary" style={styles.month} numberOfLines={1}>
              {monthStart ? MONTH[Number(d.slice(5, 7)) - 1] : " "}
            </AppText>
            <Pressable
              onPress={() => onChange(d)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={
                relative && i === 0 ? `Today, ${formatDay(d)}` : formatDay(d, { weekday: true })
              }
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: selected ? palette.period : alpha(colors.text, 0.06),
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <AppText
                variant="caption"
                style={{ color: selected ? palette.onPeriod : colors.textTertiary }}
                maxFontSizeMultiplier={1.15}
                numberOfLines={1}
              >
                {label}
              </AppText>
              <AppText
                variant="headline"
                style={{ color: selected ? palette.onPeriod : colors.text, fontWeight: "800" }}
                maxFontSizeMultiplier={1.15}
              >
                {Number(d.slice(8, 10))}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  slot: { alignItems: "center" },
  month: { marginBottom: 4 },
  pill: {
    minWidth: 54,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: "center",
    gap: 2,
  },
});
