/**
 * DetectiveCard — the Progress Detective's case (Phase 8).
 *
 * Leads with an auditable metric strip, then the marquee ROOT CAUSE (the "why"),
 * then supporting findings. Every claim carries its numbers, so the card can
 * always answer "why are you telling me this?".
 */

import { AppText, Card, Divider } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type {
  DetectiveMetric,
  FindingKind,
  GozlinDetectiveReport,
  ProgressFinding,
} from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Bullet, CardHeader, Chip, kitStyles } from "./GozlinCardKit";

type IconName = keyof typeof Ionicons.glyphMap;

export function DetectiveCard({ data }: { data: GozlinDetectiveReport }) {
  const { colors } = useColors();

  const kindColor = (kind: FindingKind): string => {
    switch (kind) {
      case "root_cause":
        return colors.primary;
      case "accelerator":
      case "hidden_win":
        return colors.success;
      case "blocker":
        return colors.error;
      case "plateau":
      case "stall":
        return colors.warning;
      default:
        return colors.water;
    }
  };

  const metricColor = (d: DetectiveMetric["direction"]): string =>
    d === "good" ? colors.success : d === "bad" ? colors.warning : colors.textSecondary;

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="search" label="Progress detective" color={colors.primary} />

        {/* ── Metric strip (the evidence) ── */}
        {data.metrics.length > 0 ? (
          <View style={styles.metricStrip}>
            {data.metrics.map((m, i) => {
              const c = metricColor(m.direction);
              return (
                <View
                  key={i}
                  style={[styles.metric, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
                >
                  <Ionicons name={m.icon as IconName} size={14} color={c} />
                  <AppText variant="callout" style={{ color: c }}>
                    {m.value}
                  </AppText>
                  <AppText variant="caption" color="tertiary" uppercase>
                    {m.delta ? `${m.label} · ${m.delta}` : m.label}
                  </AppText>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── Root cause (the marquee insight) ── */}
        {data.rootCause ? (
          <RootCauseBox finding={data.rootCause} color={kindColor(data.rootCause.kind)} />
        ) : null}

        {/* ── Supporting findings ── */}
        {data.findings.length > 0 ? (
          <View style={{ gap: Spacing.md }}>
            {data.rootCause ? (
              <AppText variant="caption" color="tertiary" uppercase>
                Also in the data
              </AppText>
            ) : null}
            {data.findings.map((f, i) => (
              <Finding key={i} finding={f} color={kindColor(f.kind)} showDivider={i > 0} />
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function RootCauseBox({ finding, color }: { finding: ProgressFinding; color: string }) {
  return (
    <View style={[styles.root, { backgroundColor: alpha(color, 0.1), borderColor: alpha(color, 0.28) }]}>
      <View style={styles.rootHead}>
        <View style={[styles.rootIcon, { backgroundColor: alpha(color, 0.16) }]}>
          <Ionicons name={finding.icon as IconName} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" uppercase style={{ color, letterSpacing: 0.6 }}>
            Root cause
          </AppText>
          <AppText variant="callout">{finding.title}</AppText>
        </View>
      </View>
      <AppText variant="subhead" color="secondary" style={styles.rootDetail}>
        {finding.detail}
      </AppText>
      {finding.evidence.length > 0 ? (
        <View style={kitStyles.chipsRow}>
          {finding.evidence.map((e, j) => (
            <Chip key={j} text={e} color={color} />
          ))}
        </View>
      ) : null}
      {finding.lever ? (
        <View style={styles.leverRow}>
          <Ionicons name="arrow-forward-circle" size={15} color={color} />
          <AppText variant="subhead" style={{ color, flex: 1 }}>
            {finding.lever}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Finding({
  finding,
  color,
  showDivider,
}: {
  finding: ProgressFinding;
  color: string;
  showDivider: boolean;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      {showDivider ? <Divider /> : null}
      <Bullet icon={finding.icon} title={finding.title} detail={finding.detail} color={color} />
      {finding.evidence.length > 0 ? (
        <View style={[kitStyles.chipsRow, styles.indent]}>
          {finding.evidence.map((e, j) => (
            <Chip key={j} text={e} color={color} />
          ))}
        </View>
      ) : null}
      {finding.lever ? (
        <View style={[styles.findingLever, styles.indent, { backgroundColor: alpha(color, 0.08) }]}>
          <AppText variant="subhead" style={{ color }}>
            → {finding.lever}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metricStrip: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  metric: {
    flexGrow: 1,
    minWidth: 92,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  root: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rootHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  rootIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rootDetail: { lineHeight: 20 },
  leverRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs },
  indent: { paddingLeft: 42 },
  findingLever: { borderRadius: Radius.sm, padding: Spacing.sm },
});
