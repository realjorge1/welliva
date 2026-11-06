/**
 * What your best days have in common, in full: up to three findings, each with
 * both numbers, what they count, and the line that keeps them honest.
 *
 * Opens from the Home insight card and from Memory → "What I've noticed".
 */
import { AppText, Sheet, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import {
  PATTERN_NOT_CAUSE,
  goodDayHeading,
  type GoodDayFinding,
  type GoodDaysReport,
} from "@/services/smart/goodDays";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

function Count({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <View style={styles.count}>
      <AppText variant="headline" style={tone ? { color: tone } : undefined}>
        {value}
      </AppText>
      <AppText variant="footnote" color="tertiary">
        {label}
      </AppText>
    </View>
  );
}

export function GoodDaysSheet({
  visible,
  report,
  findings,
  onClose,
}: {
  visible: boolean;
  report: GoodDaysReport | null;
  findings: readonly GoodDayFinding[];
  onClose: () => void;
}) {
  const { colors } = useColors();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.78}
      header={
        <View style={styles.header}>
          <AppText variant="title">What your best days have in common</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.lead}>
            Your best days are the quarter of your check-in days when you felt best. Days without a
            check-in, and days you marked as rough, aren&apos;t counted.
          </AppText>
        </View>
      }
    >
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {findings.map((f) => (
          <View key={f.id} style={[styles.finding, { backgroundColor: colors.surface }]}>
            <AppText variant="callout" weight="600">
              {goodDayHeading(f)}
            </AppText>
            <View style={styles.counts}>
              <Count value={`${f.bestYes} of ${f.bestKnown}`} label="best days" tone={colors.success} />
              <Count value={`${f.otherYes} of ${f.otherKnown}`} label="other days" />
            </View>
            {f.scope ? (
              <AppText variant="footnote" color="tertiary">
                {f.scope}
              </AppText>
            ) : null}
          </View>
        ))}
        <AppText variant="subhead" weight="600" style={styles.caveat}>
          {PATTERN_NOT_CAUSE}
        </AppText>
        {report ? (
          <AppText variant="footnote" color="tertiary">
            {`From the ${report.scoredDays} days you checked in, over the last ${report.windowDays} days.`}
          </AppText>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },
  lead: { marginTop: Spacing.xs },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md },
  finding: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  counts: { flexDirection: "row", gap: Spacing.md },
  count: { flex: 1 },
  caveat: { marginTop: Spacing.xs },
});
