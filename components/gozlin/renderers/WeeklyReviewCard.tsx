/**
 * WeeklyReviewCard — the "sit-down with your coach": adherence, wins, watchouts,
 * trajectory, and exactly one focus for next week.
 */

import { AppText, Card, Ring } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Spacing } from "@/constants/theme";
import type { GozlinWeeklyReview } from "@/services/gozlin";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { CardHeader, LeverBox } from "./GozlinCardKit";

type IconName = keyof typeof Ionicons.glyphMap;

export function WeeklyReviewCard({ data }: { data: GozlinWeeklyReview }) {
  const { colors } = useColors();

  return (
    <Card padding="lg" elevated style={{ marginTop: Spacing.sm }}>
      <View style={{ gap: Spacing.md }}>
        <CardHeader icon="calendar" label={data.title} color={colors.primary} />

        <View style={styles.heroRow}>
          <Ring progress={data.adherence / 100} size={84} strokeWidth={9} gradient={colors.brandGradient}>
            <AppText variant="headline">{data.adherence}</AppText>
            <AppText variant="caption" color="tertiary" uppercase>
              adherence
            </AppText>
          </Ring>
          <View style={styles.heroText}>
            <AppText variant="body" color="secondary">
              {data.trajectoryLine}
            </AppText>
          </View>
        </View>

        {data.wins.length > 0 ? (
          <View style={{ gap: Spacing.xs }}>
            <AppText variant="caption" color="tertiary" uppercase>
              Wins
            </AppText>
            {data.wins.map((w, i) => (
              <Line key={i} icon={w.icon} text={w.text} color={colors.success} />
            ))}
          </View>
        ) : null}

        {data.watchouts.length > 0 ? (
          <View style={{ gap: Spacing.xs }}>
            <AppText variant="caption" color="tertiary" uppercase>
              Watch-outs
            </AppText>
            {data.watchouts.map((w, i) => (
              <Line key={i} icon={w.icon} text={w.text} color={colors.warning} />
            ))}
          </View>
        ) : null}

        <LeverBox label="Next week, just this" text={data.oneFocusNextWeek} color={colors.primary} />
      </View>
    </Card>
  );
}

function Line({
  icon,
  text,
  color,
}: {
  icon: string;
  text: string;
  color: string;
}) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon as IconName} size={15} color={color} />
      <AppText variant="subhead" color="secondary" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  heroText: { flex: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
});
