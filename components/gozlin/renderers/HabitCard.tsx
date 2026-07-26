/**
 * HabitCard — the Habit Awareness report (Phase 7).
 *
 * Gozlin's read on who the user is behaviorally: an overall behavior score,
 * per-domain scores, the patterns it has learned, the slips it predicts, and the
 * rescue plans for them. Every part is evidence-backed, so it lands as
 * "understood," not "judged."
 */

import { AppText, Card, Divider, ProgressBar, Ring } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing } from "@/constants/theme";
import type {
  BehaviorScore,
  BehaviorTrend,
  GozlinHabitReport,
  HabitPattern,
  HabitRescue,
  HabitRisk,
} from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import AILogoIcon from "../AILogoIcon";
import { CardHeader } from "./GozlinCardKit";

type IconName = keyof typeof Ionicons.glyphMap;

export function HabitCard({ data }: { data: GozlinHabitReport }) {
  const { colors } = useColors();

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.lg }}>
        <CardHeader iconNode={<AILogoIcon size={13} color={colors.primary} />} label="Habit awareness" color={colors.primary} />

        {/* ── Overall behavior score ── */}
        <View style={styles.heroRow}>
          <Ring progress={data.overallScore / 100} size={84} strokeWidth={9} gradient={colors.brandGradient}>
            <AppText variant="headline">{data.overallScore}</AppText>
            <AppText variant="caption" color="tertiary" uppercase>
              {data.scoreLabel}
            </AppText>
          </Ring>
          <View style={styles.heroText}>
            <AppText variant="body" color="secondary">
              {data.headline}
            </AppText>
          </View>
        </View>

        {/* ── Per-domain behavior scores ── */}
        {data.behaviorScores.length > 0 ? (
          <View style={{ gap: Spacing.sm }}>
            <AppText variant="caption" color="tertiary" uppercase>
              By domain
            </AppText>
            {data.behaviorScores.map((s) => (
              <DomainRow key={s.domain} score={s} />
            ))}
          </View>
        ) : null}

        {/* ── Learned patterns ── */}
        {data.patterns.length > 0 ? (
          <View style={{ gap: Spacing.sm }}>
            <Divider />
            <AppText variant="caption" color="tertiary" uppercase>
              {"What I've learned about you"}
            </AppText>
            {data.patterns.map((p, i) => (
              <PatternRow key={i} pattern={p} />
            ))}
          </View>
        ) : null}

        {/* ── Predicted risks ── */}
        {data.risks.length > 0 ? (
          <View style={{ gap: Spacing.sm }}>
            <Divider />
            <AppText variant="caption" color="tertiary" uppercase>
              What I see coming
            </AppText>
            {data.risks.map((r, i) => (
              <RiskRow key={i} risk={r} />
            ))}
          </View>
        ) : null}

        {/* ── Rescue plans ── */}
        {data.rescues.length > 0 ? (
          <View style={{ gap: Spacing.sm }}>
            <Divider />
            <AppText variant="caption" color="tertiary" uppercase>
              Your rescue plan
            </AppText>
            {data.rescues.map((r) => (
              <RescueBox key={r.id} rescue={r} />
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function trendMeta(trend: BehaviorTrend, colors: ReturnType<typeof useColors>["colors"]) {
  switch (trend) {
    case "rising":
      return { icon: "arrow-up" as const, color: colors.success };
    case "cooling":
      return { icon: "arrow-down" as const, color: colors.warning };
    default:
      return { icon: "remove" as const, color: colors.textTertiary };
  }
}

function DomainRow({ score }: { score: BehaviorScore }) {
  const { colors } = useColors();
  const c = score.score >= 75 ? colors.success : score.score >= 40 ? colors.primary : colors.warning;
  const t = trendMeta(score.trend, colors);
  return (
    <View style={styles.domainRow}>
      <View style={[styles.domainIcon, { backgroundColor: alpha(c, 0.14) }]}>
        <Ionicons name={score.icon as IconName} size={15} color={c} />
      </View>
      <View style={styles.domainBody}>
        <View style={styles.domainHead}>
          <AppText variant="subhead">{score.label}</AppText>
          <View style={styles.domainScore}>
            <Ionicons name={t.icon} size={12} color={t.color} />
            <AppText variant="caption" color="tertiary">
              {score.band}
            </AppText>
            <AppText variant="callout" style={{ color: c }}>
              {score.score}
            </AppText>
          </View>
        </View>
        <ProgressBar progress={score.score / 100} tone={c} height={6} />
        {score.drivers.length > 0 ? (
          <AppText variant="caption" color="tertiary">
            {score.drivers.join(" · ")}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function PatternRow({ pattern }: { pattern: HabitPattern }) {
  const { colors } = useColors();
  const c = pattern.kind === "anchor" || pattern.kind === "consistency" ? colors.success : pattern.kind === "bad_habit" || pattern.kind === "skip" ? colors.warning : colors.water;
  return (
    <View style={styles.patternRow}>
      <Ionicons name={(pattern.icon ?? "ellipse-outline") as IconName} size={16} color={c} style={{ marginTop: 2 }} />
      <AppText variant="subhead" color="secondary" style={{ flex: 1 }}>
        {pattern.message}
      </AppText>
    </View>
  );
}

function RiskRow({ risk }: { risk: HabitRisk }) {
  const { colors } = useColors();
  const c = risk.likelihood >= 0.66 ? colors.error : risk.likelihood >= 0.4 ? colors.warning : colors.textSecondary;
  return (
    <View style={styles.riskRow}>
      <View style={[styles.riskIcon, { backgroundColor: alpha(c, 0.14) }]}>
        <Ionicons name={risk.icon as IconName} size={15} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.riskHead}>
          <AppText variant="callout" style={{ flex: 1 }}>
            {risk.title}
          </AppText>
          <View style={[styles.whenPill, { backgroundColor: alpha(c, 0.14) }]}>
            <AppText variant="caption" style={{ color: c }}>
              {risk.whenLabel}
            </AppText>
          </View>
        </View>
        {risk.why.length > 0 ? (
          <AppText variant="caption" color="tertiary">
            {risk.why.join(" · ")}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function RescueBox({ rescue }: { rescue: HabitRescue }) {
  const { colors } = useColors();
  return (
    <View style={[styles.rescue, { backgroundColor: alpha(colors.primary, 0.08), borderColor: alpha(colors.primary, 0.2) }]}>
      <View style={styles.rescueHead}>
        <Ionicons name={rescue.icon as IconName} size={15} color={colors.primary} />
        <AppText variant="callout" style={{ color: colors.primary, flex: 1 }}>
          {rescue.title}
        </AppText>
      </View>
      {rescue.steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={[styles.stepNum, { backgroundColor: alpha(colors.primary, 0.16) }]}>
            <AppText variant="caption" style={{ color: colors.primary }}>
              {i + 1}
            </AppText>
          </View>
          <AppText variant="subhead" color="secondary" style={{ flex: 1 }}>
            {step}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  heroText: { flex: 1 },
  domainRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  domainIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  domainBody: { flex: 1, gap: Spacing.xs },
  domainHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  domainScore: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  patternRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  riskRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  riskIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  riskHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  whenPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  rescue: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  rescueHead: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  stepRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
