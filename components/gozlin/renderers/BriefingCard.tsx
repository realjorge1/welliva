/**
 * BriefingCard — the Daily AI Briefing (Phase 4).
 *
 * Renders Gozlin's morning sit-down beneath the greeting + headline (which live
 * in the chat bubble text above): the journey day-counter, Yesterday Summary,
 * Today's Plan (workout + nutrition focus), Risk Alerts, Suggested Adjustments,
 * the Gozlin Insight (motivation), and the single next move.
 */

import { AppText, Card } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { alpha, Radius, Spacing, type ThemeColors } from "@/constants/theme";
import type { BriefingLine, GozlinBriefing } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import AILogoIcon from "../AILogoIcon";
import { CardHeader, LeverBox, toneColor } from "./GozlinCardKit";

type IconName = keyof typeof Ionicons.glyphMap;

export function BriefingCard({ data }: { data: GozlinBriefing }) {
  const { colors } = useColors();

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.lg }}>
        {/* ── Journey day-counter ── */}
        <View style={styles.journeyRow}>
          <View style={[styles.journeyPill, { backgroundColor: alpha(colors.primary, 0.12) }]}>
            <Ionicons name="sunny-outline" size={13} color={colors.primary} />
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: "700" }}>
              {data.dayCount != null ? `Day ${data.dayCount}` : "Briefing"}
            </AppText>
          </View>
          <AppText variant="footnote" color="secondary">
            {data.journeyLabel}
          </AppText>
        </View>

        {/* ── Yesterday ── */}
        {data.yesterday.length > 0 ? (
          <Section title="Yesterday" icon="time-outline" colors={colors}>
            {data.yesterday.map((l, i) => (
              <LineRow key={i} line={l} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* ── Today's plan ── */}
        <Section title={`Today · ${data.todayFocus}`} icon="today-outline" colors={colors}>
          <LineRow line={data.workoutFocus} colors={colors} />
          <LineRow line={data.nutritionFocus} colors={colors} />
        </Section>

        {/* ── Risk alerts ── */}
        {data.riskAlerts.length > 0 ? (
          <Section title="Heads up" icon="alert-circle-outline" colors={colors} tint={colors.warning}>
            {data.riskAlerts.map((l, i) => (
              <LineRow key={i} line={l} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* ── Suggested adjustments ── */}
        {data.adjustments.length > 0 ? (
          <Section title="Suggested adjustments" icon="options-outline" colors={colors}>
            {data.adjustments.map((l, i) => (
              <LineRow key={i} line={l} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* ── Gozlin Insight (motivation) ── */}
        <View style={[styles.insight, { backgroundColor: alpha(colors.primary, 0.08), borderColor: alpha(colors.primary, 0.2) }]}>
          <View style={styles.insightHead}>
            <AILogoIcon size={14} color={colors.primary} />
            <AppText variant="caption" uppercase style={{ color: colors.primary, letterSpacing: 0.6 }}>
              Gozlin insight
            </AppText>
          </View>
          <AppText variant="callout" style={{ lineHeight: 21 }}>
            {data.motivation}
          </AppText>
        </View>

        {/* ── The one move ── */}
        <LeverBox label="Your one move" text={data.microAction} color={colors.primary} />
      </View>
    </Card>
  );
}

function Section({
  title,
  icon,
  colors,
  tint,
  children,
}: {
  title: string;
  icon: string;
  colors: ThemeColors;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <CardHeader icon={icon} label={title} color={tint ?? colors.primary} />
      <View style={{ gap: Spacing.sm }}>{children}</View>
    </View>
  );
}

function LineRow({ line, colors }: { line: BriefingLine; colors: ThemeColors }) {
  const tint = toneColor(colors, line.tone);
  return (
    <View style={styles.lineRow}>
      <View style={[styles.lineIcon, { backgroundColor: alpha(tint, 0.14) }]}>
        <Ionicons name={line.icon as IconName} size={14} color={tint} />
      </View>
      <AppText variant="subhead" color="secondary" style={{ flex: 1, lineHeight: 19 }}>
        {line.text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  journeyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  journeyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  lineRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  lineIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  insight: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  insightHead: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
});
