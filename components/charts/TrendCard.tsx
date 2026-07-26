/**
 * TrendCard — the full "scrub your history" surface.
 *
 * Wraps {@link InteractiveChart} in a titled Card with a big live readout (the
 * value updates as you drag across the line, exactly like a stock/price card),
 * an at-a-glance change-over-range, and range tabs that re-draw the line when
 * tapped. Drop one in wherever a history deserves to be felt, not just listed.
 */
import { AppText, Card, IconBadge, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { InteractiveChart } from "./InteractiveChart";
import type { TrendSeries } from "./types";

export interface TrendCardProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Unit suffix on the readout ("kcal", "min", "kg", "%"). */
  unit?: string;
  /** Line + fill accent (defaults to the brand ramp). */
  gradient?: readonly [string, string, ...string[]];
  /** One entry per range tab (e.g. 1W / 1M / 3M). */
  series: TrendSeries[];
  initialRangeKey?: string;
  chartHeight?: number;
  /** Value formatter for the readout + delta. */
  format?: (v: number) => string;
  /** Frame the change: true → up is good (minutes), false → down is good (weight). */
  higherIsBetter?: boolean;
  /** Don't color the change good/bad (e.g. body weight, where it depends on goal). */
  neutralDelta?: boolean;
  /** Shown under the chart when there's plenty of data. */
  footnote?: string;
  /** Shown in place of the chart when a range has too little data. */
  emptyHint?: string;
}

function defaultFormat(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(1);
}

export function TrendCard({
  title,
  icon = "trending-up",
  unit,
  gradient,
  series,
  initialRangeKey,
  chartHeight = 200,
  format = defaultFormat,
  higherIsBetter = true,
  neutralDelta = false,
  footnote,
  emptyHint = "Keep logging to see this trend come to life.",
}: TrendCardProps) {
  const { colors } = useColors();
  // Default the accent to the theme brand ramp (orange in light, gold in dark).
  const grad = gradient ?? colors.brandGradient;
  const [rangeKey, setRangeKey] = useState(
    initialRangeKey ?? series[0]?.key ?? "",
  );

  const current =
    series.find((s) => s.key === rangeKey) ?? series[0] ?? { key: "", label: "", points: [] };
  const points = current.points;
  const n = points.length;
  const lastIndex = Math.max(0, n - 1);

  const [displayIndex, setDisplayIndex] = useState(lastIndex);
  const [scrubbing, setScrubbing] = useState(false);

  const onActiveChange = useCallback((index: number, isScrubbing: boolean) => {
    setDisplayIndex(index);
    setScrubbing(isScrubbing);
  }, []);

  const shown = points[Math.min(displayIndex, lastIndex)] ?? points[lastIndex];

  const delta = useMemo(() => {
    if (n < 2) return 0;
    return points[lastIndex].value - points[0].value;
  }, [points, n, lastIndex]);

  const deltaGood = higherIsBetter ? delta >= 0 : delta <= 0;
  const deltaColor =
    delta === 0 || neutralDelta
      ? colors.textTertiary
      : deltaGood
        ? colors.success
        : colors.warning;

  const enoughData = n >= 2;

  return (
    <Card padding="lg">
      {/* Header — icon, title, live readout */}
      <View style={styles.header}>
        <IconBadge name={icon} tone={grad[grad.length - 1]} size={38} />
        <View style={styles.flex}>
          <AppText variant="caption" color="tertiary" uppercase>
            {title}
          </AppText>
          <View style={styles.readoutRow}>
            <AppText variant="metric" numberOfLines={1}>
              {enoughData && shown ? format(shown.value) : "—"}
            </AppText>
            {unit != null && enoughData && (
              <AppText variant="headline" color="tertiary" style={styles.unit}>
                {unit}
              </AppText>
            )}
          </View>
          {enoughData &&
            (scrubbing && shown ? (
              <AppText variant="footnote" color="secondary">
                {shown.fullLabel ?? shown.label}
              </AppText>
            ) : (
              <View style={styles.deltaRow}>
                <Ionicons
                  name={
                    delta === 0
                      ? "remove"
                      : delta > 0
                        ? "arrow-up"
                        : "arrow-down"
                  }
                  size={13}
                  color={deltaColor}
                />
                <AppText variant="footnote" style={{ color: deltaColor }}>
                  {`${delta > 0 ? "+" : delta < 0 ? "−" : ""}${format(
                    Math.abs(delta),
                  )}${unit ? ` ${unit}` : ""}`}
                </AppText>
                <AppText variant="footnote" color="tertiary">
                  {`over ${current.label.toLowerCase()}`}
                </AppText>
              </View>
            ))}
        </View>
      </View>

      {/* Chart or empty state */}
      {enoughData ? (
        <View style={styles.chart}>
          <InteractiveChart
            points={points}
            height={chartHeight}
            gradient={grad}
            animKey={rangeKey}
            unit={unit}
            onActiveChange={onActiveChange}
          />
        </View>
      ) : (
        <View style={[styles.empty, { height: chartHeight }]}>
          <Ionicons
            name="analytics-outline"
            size={30}
            color={colors.textTertiary}
          />
          <AppText variant="footnote" color="tertiary" align="center" style={styles.emptyText}>
            {emptyHint}
          </AppText>
        </View>
      )}

      {/* Range tabs */}
      {series.length > 1 && (
        <View style={styles.tabs}>
          {series.map((s) => {
            const active = s.key === rangeKey;
            return (
              <Pressable
                key={s.key}
                onPress={() => setRangeKey(s.key)}
                hitSlop={6}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active
                      ? alpha(grad[grad.length - 1], 0.16)
                      : "transparent",
                  },
                ]}
              >
                <AppText
                  variant="footnote"
                  style={{
                    fontWeight: "700",
                    color: active
                      ? grad[grad.length - 1]
                      : colors.textTertiary,
                  }}
                >
                  {s.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      {footnote != null && enoughData && (
        <AppText variant="caption" color="tertiary" style={styles.footnote}>
          {footnote}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  readoutRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  unit: { marginBottom: 4 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chart: { marginTop: Spacing.sm },
  empty: { alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  emptyText: { maxWidth: 220 },
  tabs: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    alignSelf: "center",
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  footnote: { marginTop: Spacing.md, textAlign: "center" },
});
