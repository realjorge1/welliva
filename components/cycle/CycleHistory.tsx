/**
 * CycleHistory — her cycles, side by side.
 *
 * One bar per cycle, its length to scale against the longest shown, with the
 * period she logged in rose at its start. Read down the column and the rhythm
 * is visible at a glance: steady, drifting, or one odd month. A gap that looked
 * like a missed log, or a pause she told us about, is drawn faded and labelled
 * "not counted" — the same cycles the prediction leaves out.
 */
import { AppText, useColors } from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import { formatDay, median, type CycleRecord } from "@/services/cycle";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useCyclePalette } from "./cycleTheme";

export interface CycleHistoryProps {
  cycles: readonly CycleRecord[];
  /** The cycle running now: its start and how far in she is. */
  current: { start: string; day: number; expected: number } | null;
  typicalBleed: number;
  max?: number;
}

export function CycleHistory({ cycles, current, typicalBleed, max = 8 }: CycleHistoryProps) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const shown = [...cycles].reverse().slice(0, max);
  const counted = cycles.filter((c) => c.status === "counted").slice(-6).map((c) => c.length);
  const longest = Math.max(
    1,
    ...shown.map((c) => c.length),
    current ? Math.max(current.day, current.expected) : 1,
  );

  if (!shown.length && !current) return null;

  return (
    <View>
      {counted.length >= 2 ? (
        <AppText variant="footnote" color="secondary" style={styles.summary}>
          Typical {Math.round(median(counted))} days · range {Math.min(...counted)}–{Math.max(...counted)} days
        </AppText>
      ) : null}

      {current ? (
        <Row
          label="Now"
          caption={formatDay(current.start)}
          length={current.day}
          scale={longest}
          bleed={Math.min(current.day, typicalBleed)}
          value={`day ${current.day}`}
          ghost={Math.max(0, current.expected - current.day)}
          period={palette.period}
          track={alpha(colors.text, 0.06)}
          fill={alpha(colors.text, 0.16)}
          ghostFill={alpha(colors.text, 0.07)}
        />
      ) : null}

      {shown.map((c) => {
        const faded = c.status !== "counted";
        return (
          <Row
            key={c.start}
            label={formatDay(c.start)}
            caption={
              c.status === "gap"
                ? "not counted · missed log?"
                : c.status === "pause"
                  ? "not counted · a pause"
                  : c.status === "short"
                    ? "not counted · too short"
                    : null
            }
            length={c.length}
            scale={longest}
            bleed={c.periodLength ?? typicalBleed}
            value={`${c.length} d`}
            faded={faded}
            period={palette.period}
            track={alpha(colors.text, 0.06)}
            fill={alpha(colors.text, 0.16)}
          />
        );
      })}
    </View>
  );
}

function Row({
  label,
  caption,
  length,
  scale,
  bleed,
  value,
  ghost = 0,
  faded = false,
  period,
  track,
  fill,
  ghostFill,
}: {
  label: string;
  caption?: string | null;
  length: number;
  scale: number;
  bleed: number;
  value: string;
  ghost?: number;
  faded?: boolean;
  period: string;
  track: string;
  fill: string;
  ghostFill?: string;
}) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / scale) * 100))}%` as const;
  return (
    <View
      style={[styles.row, faded && styles.faded]}
      accessible
      accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ""}`}
    >
      <View style={styles.labelCol}>
        <AppText variant="footnote" numberOfLines={1}>
          {label}
        </AppText>
        {caption ? (
          <AppText variant="caption" color="tertiary" numberOfLines={1}>
            {caption}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.bar, { width: pct(length), backgroundColor: fill }]}>
          <View style={[styles.bleed, { width: pct((bleed / Math.max(1, length)) * scale), backgroundColor: period }]} />
        </View>
        {ghost > 0 && ghostFill ? (
          <View
            style={[
              styles.ghost,
              { left: pct(length), width: pct(ghost), backgroundColor: ghostFill },
            ]}
          />
        ) : null}
      </View>
      <AppText variant="footnote" color="secondary" style={styles.value} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const BAR = 10;

const styles = StyleSheet.create({
  summary: { marginBottom: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  faded: { opacity: 0.5 },
  labelCol: { width: 92 },
  track: { flex: 1, height: BAR, borderRadius: BAR / 2, overflow: "hidden" },
  bar: { height: BAR, borderRadius: BAR / 2, overflow: "hidden" },
  bleed: { height: BAR, borderRadius: BAR / 2 },
  ghost: { position: "absolute", top: 0, height: BAR, borderRadius: BAR / 2 },
  value: { width: 52, textAlign: "right" },
});
