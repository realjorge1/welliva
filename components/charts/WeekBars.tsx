/**
 * WeekBars — a week of adherence as one clean row of vertical bars.
 *
 * Replaces the pie: each day of the week is a rounded column that grows from the
 * baseline to that day's adherence (meals consumed / total), tinted by its
 * status — on-plan green, partial orange, missed pink, untracked a faint track.
 * The bars cascade up on mount for a smooth reveal, and a compact legend keys
 * the colours. Pure react-native + reanimated, so it needs no Skia.
 */
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { AppText, useColors } from "@/components/ui";
import { alpha, Spacing } from "@/constants/theme";
import type { DayAdherence } from "@/services/intelligence";
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const PLOT_H = 96; // bar track height
const BAR_W = 16;
const MIN_FILL = 8; // shortest visible fill for a non-zero day

// Same friendly hues the pie used — green / orange / pink / blue.
const LIGHT = {
  completed: "#7BD88F",
  partial: "#F5B368",
  skipped: "#F49CC4",
  none: "#6FB1F0",
} as const;

type Status = DayAdherence["status"];

const CATS: { key: Status; label: string; color: string }[] = [
  { key: "completed", label: "On plan", color: LIGHT.completed },
  { key: "partial", label: "Partial", color: LIGHT.partial },
  { key: "skipped", label: "Missed", color: LIGHT.skipped },
];

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function weekdayLetter(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAY[d.getDay()];
}

export interface WeekBarsProps {
  days: DayAdherence[];
}

export function WeekBars({ days }: WeekBarsProps) {
  const { colors } = useColors();
  const reduced = useReducedMotion();
  // Snap (no grow) on a warm re-entry; animate on a genuine cold reveal.
  // Capture intro at mount so the decision is stable across re-renders.
  const introAtMount = useRef(useIntroReveal()).current;
  const animate = !reduced && introAtMount;

  const present = useMemo(() => {
    const seen = new Set(days.map((d) => d.status));
    return CATS.filter((c) => seen.has(c.key));
  }, [days]);

  if (days.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {days.map((d, i) => (
          <Bar
            key={d.date || i}
            pct={Math.max(0, Math.min(1, d.pct))}
            color={LIGHT[d.status]}
            track={alpha(colors.borderStrong, 0.16)}
            label={weekdayLetter(d.date)}
            index={i}
            animate={animate}
          />
        ))}
      </View>

      {present.length > 0 && (
        <View style={styles.legend}>
          {present.map((c) => (
            <View key={c.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c.color }]} />
              <AppText variant="caption" color="tertiary">
                {c.label}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Bar({
  pct,
  color,
  track,
  label,
  index,
  animate,
}: {
  pct: number;
  color: string;
  track: string;
  label: string;
  index: number;
  animate: boolean;
}) {
  const target = pct > 0 ? Math.max(MIN_FILL, pct * PLOT_H) : 0;
  const grow = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      grow.value = 1;
      return;
    }
    grow.value = withDelay(
      index * 65,
      withTiming(1, { duration: 620, easing: Ease.decelerate }),
    );
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    height: target * grow.value,
  }));

  return (
    <View style={styles.col}>
      <View style={[styles.track, { backgroundColor: track }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: color }, fillStyle]}
        />
      </View>
      <AppText variant="caption" color="tertiary" style={styles.dayLabel}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  col: { alignItems: "center", flex: 1 },
  track: {
    width: BAR_W,
    height: PLOT_H,
    borderRadius: BAR_W / 2,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: "100%", borderRadius: BAR_W / 2 },
  dayLabel: { marginTop: Spacing.sm },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
});
