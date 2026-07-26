/**
 * MacroTrendCard — one compact surface for several nutrition trends.
 *
 * Instead of a tall card per metric, this stacks a metric selector
 * (Calories / Protein / Carbs / Fat) over a single short scrubbable chart: pick
 * a metric, pick a range, drag to inspect any day. It's a fraction of the height
 * of the old one-chart-per-metric stack while showing strictly more.
 *
 * The heavy lifting (draw-in, scrub, Skia vs. SVG) lives in InteractiveChart;
 * this only owns the selector, the live readout and the range tabs.
 */
import { AppText, Card, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { InteractiveChart } from "./InteractiveChart";
import type { TrendSeries } from "./types";

export interface MacroTrendMetric {
  key: string;
  /** Selector chip + readout label ("Calories"). */
  label: string;
  unit: string;
  gradient: readonly [string, string, ...string[]];
  /** Accent for the active chip / readout (defaults to the gradient end). */
  tone?: string;
  series: TrendSeries[];
  footnote?: string;
}

export interface MacroTrendCardProps {
  metrics: MacroTrendMetric[];
  initialMetricKey?: string;
  initialRangeKey?: string;
  /** Compact by design — a third of the old full-height chart. */
  chartHeight?: number;
  emptyHint?: string;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

export function MacroTrendCard({
  metrics,
  initialMetricKey,
  initialRangeKey,
  chartHeight = 92,
  emptyHint = "Log a few days of meals and your trends appear here.",
}: MacroTrendCardProps) {
  const { colors } = useColors();

  const [metricKey, setMetricKey] = useState(
    initialMetricKey ?? metrics[0]?.key ?? "",
  );
  const metric =
    metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const accent = metric?.tone ?? metric?.gradient[metric.gradient.length - 1];

  const [rangeKey, setRangeKey] = useState(
    initialRangeKey ?? metric?.series[0]?.key ?? "",
  );
  const current =
    metric?.series.find((s) => s.key === rangeKey) ??
    metric?.series[0] ?? { key: "", label: "", points: [] };
  const points = current.points;
  const n = points.length;
  const lastIndex = Math.max(0, n - 1);
  const enoughData = n >= 2;

  const [displayIndex, setDisplayIndex] = useState(lastIndex);
  const [scrubbing, setScrubbing] = useState(false);
  const onActiveChange = useCallback((index: number, isScrubbing: boolean) => {
    setDisplayIndex(index);
    setScrubbing(isScrubbing);
  }, []);

  // While scrubbing, follow the finger; otherwise always read the latest day
  // (so switching metric/range never leaves a stale mid-series value showing).
  const shown = scrubbing
    ? points[Math.min(displayIndex, lastIndex)] ?? points[lastIndex]
    : points[lastIndex];
  const delta = useMemo(() => {
    if (n < 2) return 0;
    return points[lastIndex].value - points[0].value;
  }, [points, n, lastIndex]);

  if (!metric) return null;

  return (
    <Card padding="lg">
      {/* Metric selector */}
      <View style={styles.metrics}>
        {metrics.map((m) => {
          const active = m.key === metricKey;
          const tone = m.tone ?? m.gradient[m.gradient.length - 1];
          return (
            <Pressable
              key={m.key}
              onPress={() => {
                setMetricKey(m.key);
                setScrubbing(false);
              }}
              hitSlop={4}
              style={[
                styles.metricChip,
                {
                  backgroundColor: active ? alpha(tone, 0.16) : colors.surfaceMuted,
                },
              ]}
            >
              <View
                style={[styles.metricDot, { backgroundColor: tone, opacity: active ? 1 : 0.5 }]}
              />
              <AppText
                variant="footnote"
                numberOfLines={1}
                style={{
                  fontWeight: "700",
                  color: active ? tone : colors.textSecondary,
                }}
              >
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Live readout + range tabs */}
      <View style={styles.readoutRow}>
        <View style={styles.flex}>
          <View style={styles.valueRow}>
            <AppText variant="metric" numberOfLines={1}>
              {enoughData && shown ? fmt(shown.value) : "—"}
            </AppText>
            {enoughData && (
              <AppText variant="callout" color="tertiary" style={styles.unit}>
                {metric.unit}
              </AppText>
            )}
          </View>
          {enoughData &&
            (scrubbing && shown ? (
              <AppText variant="caption" color="secondary">
                {shown.fullLabel ?? shown.label}
              </AppText>
            ) : (
              <View style={styles.deltaRow}>
                <Ionicons
                  name={delta === 0 ? "remove" : delta > 0 ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={colors.textTertiary}
                />
                <AppText variant="caption" color="tertiary">
                  {`${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmt(Math.abs(delta))} ${metric.unit} over ${current.label.toLowerCase()}`}
                </AppText>
              </View>
            ))}
        </View>

        {metric.series.length > 1 && (
          <View style={styles.tabs}>
            {metric.series.map((s) => {
              const active = s.key === rangeKey;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setRangeKey(s.key)}
                  hitSlop={6}
                  style={[
                    styles.tab,
                    { backgroundColor: active ? alpha(accent, 0.16) : "transparent" },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      fontWeight: "700",
                      color: active ? accent : colors.textTertiary,
                    }}
                  >
                    {s.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Compact chart */}
      {enoughData ? (
        <View style={styles.chart}>
          <InteractiveChart
            points={points}
            height={chartHeight}
            gradient={metric.gradient}
            animKey={`${metricKey}:${rangeKey}`}
            unit={metric.unit}
            onActiveChange={onActiveChange}
          />
        </View>
      ) : (
        <View style={[styles.empty, { height: chartHeight }]}>
          <Ionicons name="analytics-outline" size={24} color={colors.textTertiary} />
          <AppText variant="caption" color="tertiary" align="center" style={styles.emptyText}>
            {emptyHint}
          </AppText>
        </View>
      )}

      {metric.footnote != null && enoughData && (
        <AppText variant="caption" color="tertiary" style={styles.footnote}>
          {metric.footnote}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  metrics: { flexDirection: "row", gap: 6, marginBottom: Spacing.md },
  metricChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  metricDot: { width: 6, height: 6, borderRadius: 3 },
  readoutRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  unit: { marginBottom: 5 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  tabs: { flexDirection: "row", gap: Spacing.xs, alignItems: "center" },
  tab: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  chart: { marginTop: Spacing.xs },
  empty: { alignItems: "center", justifyContent: "center", gap: 6 },
  emptyText: { maxWidth: 220 },
  footnote: { marginTop: Spacing.sm, textAlign: "center" },
});
