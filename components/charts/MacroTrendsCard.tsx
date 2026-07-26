/**
 * MacroTrendsCard — every macro on ONE plot, not one-at-a-time.
 *
 * Calories, protein, carbs and fat are drawn together as bold overlaid lines.
 * Because their units are incomparable (kcal vs. grams), each series is indexed
 * to its own first day = 100 (see {@link indexToStart}) so they share a single
 * axis and a single starting point — the *shape* shows how each macro moved,
 * while the legend below carries the real absolute value at the day you're
 * looking at (the latest day, or whichever you drag to).
 *
 * The card owns identity + readout; the scrub, draw-in and Skia-vs-SVG drawing
 * live in {@link MultiTrendChart}.
 */
import { AppText, Card, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MultiTrendChart, type MultiSeries } from "./MultiTrendChart";
import { indexToStart } from "./series";

/** Identity of one overlaid macro (values are supplied per range below). */
export interface MacroDescriptor {
  key: string;
  label: string;
  unit: string;
  /** Solid accent (marker + legend dot). */
  color: string;
  /** Stroke ramp. */
  gradient: readonly [string, string, ...string[]];
}

/** One time range's aligned data: shared labels + absolute value per macro. */
export interface MacroRangeData {
  key: string;
  label: string;
  /** Compact x labels, oldest → newest (e.g. "Jul 3"). */
  labels: string[];
  /** Fuller per-day labels for the scrub caption. */
  fullLabels: string[];
  /** macroKey → absolute values aligned to `labels` (null = untracked day). */
  values: Record<string, (number | null)[]>;
}

export interface MacroTrendsCardProps {
  macros: MacroDescriptor[];
  ranges: MacroRangeData[];
  initialRangeKey?: string;
  chartHeight?: number;
  emptyHint?: string;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

function lastNonNull(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

export function MacroTrendsCard({
  macros,
  ranges,
  initialRangeKey,
  chartHeight = 190,
  emptyHint = "Log a few days of meals and your macro trends appear here.",
}: MacroTrendsCardProps) {
  const { colors } = useColors();

  const [rangeKey, setRangeKey] = useState(
    initialRangeKey ?? ranges[0]?.key ?? "",
  );
  const range = ranges.find((r) => r.key === rangeKey) ?? ranges[0];

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const onActiveChange = useCallback((index: number, isScrubbing: boolean) => {
    setActiveIdx(index);
    setScrubbing(isScrubbing);
  }, []);

  const toggle = useCallback(
    (key: string) => {
      setScrubbing(false);
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else if (macros.length - next.size > 1) {
          // Keep at least one macro on screen.
          next.add(key);
        }
        return next;
      });
    },
    [macros.length],
  );

  const length = range?.labels.length ?? 0;

  // Overlaid, index-to-start series for the chart (memoized per range/toggles).
  const series = useMemo<MultiSeries[]>(() => {
    if (!range) return [];
    return macros.map((m) => ({
      key: m.key,
      color: m.color,
      gradient: m.gradient,
      values: indexToStart(range.values[m.key] ?? []),
      visible: !hidden.has(m.key),
    }));
  }, [range, macros, hidden]);

  const enoughData = useMemo(() => {
    if (!range || length < 2) return false;
    return macros.some((m) => {
      const vals = range.values[m.key] ?? [];
      return vals.filter((v) => v != null && Number.isFinite(v)).length >= 2;
    });
  }, [range, macros, length]);

  if (!range) return null;

  const caption =
    scrubbing && range.fullLabels[activeIdx]
      ? range.fullLabels[activeIdx]
      : `Last ${range.label.toLowerCase()}`;

  return (
    <Card padding="lg">
      {/* Header — the day in view + range tabs */}
      <View style={styles.header}>
        <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.flex}>
          {enoughData ? caption : "Nutrition trends"}
        </AppText>
        {ranges.length > 1 && (
          <View style={styles.tabs}>
            {ranges.map((r) => {
              const active = r.key === rangeKey;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => {
                    setRangeKey(r.key);
                    setScrubbing(false);
                  }}
                  hitSlop={6}
                  style={[
                    styles.tab,
                    { backgroundColor: active ? alpha(colors.primary, 0.16) : "transparent" },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      fontWeight: "700",
                      color: active ? colors.primary : colors.textTertiary,
                    }}
                  >
                    {r.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Chart */}
      {enoughData ? (
        <View style={styles.chart}>
          <MultiTrendChart
            series={series}
            length={length}
            height={chartHeight}
            animKey={rangeKey}
            onActiveChange={onActiveChange}
          />
          {/* First / last axis labels */}
          <View style={styles.axis}>
            <AppText variant="caption" color="tertiary">
              {range.labels[0]}
            </AppText>
            <AppText variant="caption" color="tertiary">
              {range.labels[length - 1]}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={[styles.empty, { height: chartHeight }]}>
          <Ionicons name="analytics-outline" size={24} color={colors.textTertiary} />
          <AppText variant="caption" color="tertiary" align="center" style={styles.emptyText}>
            {emptyHint}
          </AppText>
        </View>
      )}

      {/* Legend = live readout. Each chip shows the macro's real value at the
          day in view; tap to fold that line out of the overlay. */}
      {enoughData && (
        <View style={styles.legend}>
          {macros.map((m) => {
            const vals = range.values[m.key] ?? [];
            const shown = scrubbing ? vals[activeIdx] ?? null : lastNonNull(vals);
            const off = hidden.has(m.key);
            return (
              <Pressable
                key={m.key}
                onPress={() => toggle(m.key)}
                hitSlop={4}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surfaceMuted, opacity: off ? 0.45 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: off ? "transparent" : m.color,
                      borderColor: m.color,
                    },
                  ]}
                />
                <View style={styles.flex}>
                  <AppText
                    variant="caption"
                    color="tertiary"
                    numberOfLines={1}
                    style={styles.chipLabel}
                  >
                    {m.label}
                  </AppText>
                  <View style={styles.chipValueRow}>
                    <AppText variant="callout" numberOfLines={1} style={styles.chipValue}>
                      {shown != null ? fmt(shown) : "—"}
                    </AppText>
                    {shown != null && (
                      <AppText variant="caption" color="tertiary" style={styles.chipUnit}>
                        {m.unit}
                      </AppText>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {enoughData && (
        <AppText variant="caption" color="tertiary" style={styles.footnote}>
          Lines share a starting point — each tracks its change from the first
          day. Tap a macro to toggle it, drag across to read any day.
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
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  tabs: { flexDirection: "row", gap: Spacing.xs, alignItems: "center" },
  tab: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  chart: { marginTop: Spacing.xs },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 12,
  },
  empty: { alignItems: "center", justifyContent: "center", gap: 6 },
  emptyText: { maxWidth: 220 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexGrow: 1,
    flexBasis: "47%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  chipLabel: { fontWeight: "600" },
  chipValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  chipValue: { fontWeight: "700" },
  chipUnit: { marginBottom: 1 },
  footnote: { marginTop: Spacing.md, textAlign: "center" },
});
