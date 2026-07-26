/**
 * ForecastCard — the AI Transformation Forecast.
 *
 * Surfaces all five outputs of the forecast system so the user can *see* their
 * projected future: Likelihood of Success (hero), goal progress, Progress
 * Velocity, Expected Goal Date, the Current Projection summary, the evidence,
 * and the ranked Recommended Adjustments.
 */

import { AppText, Card, ProgressBar, ThemedIcon } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing, type ThemeColors } from "@/constants/theme";
import type {
  ForecastConfidence,
  GozlinForecast,
  SuccessBand,
  VelocityTrend,
} from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { CardHeader, Chip, kitStyles, LeverBox } from "./GozlinCardKit";

const CONF_LABEL: Record<ForecastConfidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

const BAND_META: Record<
  SuccessBand,
  { label: string; key: keyof ThemeColors }
> = {
  on_track: { label: "On track", key: "success" },
  achievable: { label: "Achievable", key: "primary" },
  at_risk: { label: "At risk", key: "warning" },
  off_track: { label: "Off track", key: "error" },
  unknown: { label: "Calibrating", key: "textSecondary" },
};

const VELOCITY_META: Record<VelocityTrend, { icon: string; word: string }> = {
  accelerating: { icon: "trending-up", word: "speeding up" },
  steady: { icon: "arrow-forward", word: "steady" },
  slowing: { icon: "trending-down", word: "slowing" },
  flat: { icon: "remove", word: "flat" },
  reversing: { icon: "swap-vertical", word: "reversing" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatGoalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return "—";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function ForecastCard({ data }: { data: GozlinForecast }) {
  const { colors } = useColors();

  const band = BAND_META[data.successBand];
  const bandColor = colors[band.key] as string;
  const confColor =
    data.confidence === "high"
      ? colors.success
      : data.confidence === "medium"
        ? colors.primary
        : colors.warning;

  const vel = VELOCITY_META[data.velocity.trend];
  const hasGoal = data.goalWeightKg != null && data.currentWeightKg != null;
  const remaining =
    hasGoal && data.currentWeightKg != null && data.goalWeightKg != null
      ? Math.abs(Math.round((data.currentWeightKg - data.goalWeightKg) * 10) / 10)
      : null;

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="trending-up" label="Transformation forecast" color={colors.primary} />

        {/* ── Likelihood of Success (hero) ── */}
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <View style={styles.scoreRow}>
              <AppText variant="metric" style={{ color: bandColor }}>
                {data.successBand === "unknown" ? "—" : data.successScore}
              </AppText>
              {data.successBand !== "unknown" ? (
                <AppText variant="headline" style={{ color: bandColor, marginBottom: 4 }}>
                  %
                </AppText>
              ) : null}
            </View>
            <AppText variant="caption" color="tertiary" uppercase>
              Likelihood of success
            </AppText>
          </View>
          <View style={[styles.bandPill, { backgroundColor: alpha(bandColor, 0.14) }]}>
            <AppText variant="footnote" style={{ color: bandColor, fontWeight: "700" }}>
              {band.label}
            </AppText>
          </View>
        </View>
        {data.successBand !== "unknown" ? (
          <ProgressBar progress={data.successScore / 100} tone={bandColor} height={8} />
        ) : null}

        {/* ── Goal progress ── */}
        {hasGoal ? (
          <View style={styles.block}>
            <View style={styles.weightRow}>
              <Endpoint label="Now" value={`${data.currentWeightKg}kg`} colors={colors} />
              <View style={styles.weightTrack}>
                <ProgressBar
                  progress={data.goalProgress ?? 0}
                  tone={colors.primary}
                  height={6}
                />
                <AppText variant="caption" color="tertiary" style={styles.remaining}>
                  {remaining != null && remaining > 0
                    ? `${remaining}kg to go`
                    : "At goal"}
                </AppText>
              </View>
              <Endpoint label="Goal" value={`${data.goalWeightKg}kg`} colors={colors} align="right" />
            </View>
          </View>
        ) : (
          <View style={[styles.hintBox, { borderColor: colors.border, backgroundColor: alpha(colors.primary, 0.08) }]}>
            <ThemedIcon name="flag-outline" size={15} role="textSecondary" />
            <AppText variant="footnote" color="secondary" style={{ flex: 1 }}>
              Set a goal weight to unlock your Expected Goal Date and success odds.
            </AppText>
          </View>
        )}

        {/* ── Velocity · Goal date ── */}
        <View style={[styles.statRow, { borderColor: colors.divider }]}>
          <StatCell
            icon={vel.icon}
            tint={data.velocity.trend === "reversing" ? colors.warning : colors.water}
            label="Velocity"
            value={data.velocity.perWeek == null ? "—" : data.velocity.label}
            sub={vel.word}
            colors={colors}
          />
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <StatCell
            icon="calendar-outline"
            tint={colors.primary}
            label="Goal date"
            value={data.expectedGoalDate ? formatGoalDate(data.expectedGoalDate) : "—"}
            sub={
              data.etaWeeks == null
                ? "not in sight yet"
                : data.etaWeeks === 0
                  ? "now"
                  : `~${data.etaWeeks} wk`
            }
            colors={colors}
          />
        </View>

        {/* ── Current Projection ── */}
        <AppText variant="body" color="secondary">
          {data.summary}
        </AppText>

        {/* ── Evidence + confidence ── */}
        <View style={kitStyles.chipsRow}>
          <Chip text={CONF_LABEL[data.confidence]} color={confColor} />
          {data.drivers.map((d, i) => (
            <Chip key={i} text={d} />
          ))}
        </View>

        {/* ── Recommended Adjustments ── */}
        {data.adjustments[0] ? (
          <LeverBox label="Biggest lever" text={data.adjustments[0].text} color={colors.primary} />
        ) : null}
        {data.adjustments.length > 1 ? (
          <View style={styles.adjList}>
            {data.adjustments.slice(1).map((adj, i) => (
              <View key={i} style={styles.adjRow}>
                <ThemedIcon name={adj.icon as keyof typeof Ionicons.glyphMap} size={14} role="textSecondary" />
                <AppText variant="subhead" color="secondary" style={{ flex: 1 }}>
                  {adj.text}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function Endpoint({
  label,
  value,
  colors,
  align = "left",
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  align?: "left" | "right";
}) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start", minWidth: 52 }}>
      <AppText variant="callout">{value}</AppText>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
    </View>
  );
}

function StatCell({
  icon,
  tint,
  label,
  value,
  sub,
  colors,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
  sub: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.statCell}>
      <View style={styles.statHead}>
        <View style={[styles.statIcon, { backgroundColor: alpha(tint, 0.14) }]}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={13} color={tint} />
        </View>
        <AppText variant="caption" color="tertiary" uppercase>
          {label}
        </AppText>
      </View>
      <AppText variant="callout" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary">
        {sub}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLeft: { gap: 0 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end" },
  bandPill: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill },
  block: { gap: Spacing.xs },
  weightRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  weightTrack: { flex: 1, gap: 4 },
  remaining: { textAlign: "center" },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Spacing.md,
  },
  statDivider: { width: 1, marginHorizontal: Spacing.md },
  statCell: { flex: 1, gap: 3 },
  statHead: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  statIcon: {
    width: 20,
    height: 20,
    borderRadius: Radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  adjList: { gap: Spacing.sm, marginTop: 2 },
  adjRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
});
