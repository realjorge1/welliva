/**
 * End-of-period report — "your plan has ended, here's how it went."
 *
 * Every number on this screen is computed by PeriodReportService from stored
 * history. Nothing here is generated prose: the headline and the highlight
 * lines are selected by fixed rules from the same arithmetic, so a user who
 * reads "breakfast was your weak spot" can go and verify it in the day grid
 * below.
 *
 * The three exits at the bottom are the point of the screen — a report the user
 * can't act on is just a scoreboard.
 */

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppText, Button, Card, Divider, Screen, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useMealPlan } from "@/contexts/MealPlanContext";
import {
  formatDuration,
  parseLocalDate,
  periodLengthDays,
  type PeriodReport,
} from "@/models/mealPlan";

const VERDICT_COPY: Record<PeriodReport["verdict"], { label: string; icon: string }> = {
  excellent: { label: "Excellent", icon: "trophy" },
  good: { label: "Good run", icon: "thumbs-up" },
  mixed: { label: "Mixed", icon: "swap-horizontal" },
  struggled: { label: "Tough one", icon: "trending-down" },
  "insufficient-data": { label: "Not enough data", icon: "help-circle" },
};

export default function PeriodReportScreen() {
  const { periodId } = useLocalSearchParams<{ periodId: string }>();
  const { colors } = useColors();
  const { buildReport, dismissReport, restartPeriod } = useMealPlan();

  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = periodId ? await buildReport(periodId) : null;
      if (!cancelled) {
        setReport(r);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodId, buildReport]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!report) {
    return (
      <Screen>
        <View style={styles.center}>
          <AppText variant="body">{`That plan couldn't be found.`}</AppText>
          <Button label="Back" onPress={() => router.back()} variant="ghost" />
        </View>
      </Screen>
    );
  }

  const verdict = VERDICT_COPY[report.verdict];
  const verdictColor =
    report.verdict === "excellent"
      ? colors.success
      : report.verdict === "good"
        ? colors.primary
        : report.verdict === "mixed"
          ? colors.warning
          : colors.textSecondary;

  const close = async () => {
    await dismissReport(report.periodId);
    router.back();
  };

  return (
    <Screen scroll contentStyle={styles.body}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      {/* --- Verdict ------------------------------------------------------ */}
      <View style={styles.hero}>
        <View style={[styles.verdictChip, { backgroundColor: `${verdictColor}1A` }]}>
          <Ionicons name={verdict.icon as never} size={16} color={verdictColor} />
          <AppText variant="caption" weight="800" style={{ color: verdictColor }}>
            {verdict.label.toUpperCase()}
          </AppText>
        </View>
        <AppText variant="displayLg" weight="800" align="center">
          {Math.round(report.adherenceRate * 100)}%
        </AppText>
        <AppText variant="caption" color="secondary" weight="700" uppercase>
          Meals logged
        </AppText>
        <AppText variant="body" align="center" style={styles.headline}>
          {report.headline}
        </AppText>
        <AppText variant="caption" color="secondary" align="center">
          {fmt(report.startDate)} – {fmt(report.endDate)} ·{" "}
          {formatDuration(periodLengthDays(report))}
        </AppText>
      </View>

      {/* --- Headline numbers --------------------------------------------- */}
      <View style={styles.statGrid}>
        <StatBox label="Eaten" value={`${report.mealsConsumed}`} sub={`of ${report.mealsPlanned}`} />
        <StatBox label="Skipped" value={`${report.mealsSkipped}`} sub="meals" />
        <StatBox label="Full days" value={`${report.perfectDays}`} sub={`of ${report.daysWithPlan}`} />
        <StatBox label="Best run" value={`${report.bestStreakDays}`} sub="days" />
      </View>

      {/* --- Day grid ------------------------------------------------------ */}
      <Card padding="lg">
        <AppText variant="body" weight="700">
          Day by day
        </AppText>
        <AppText variant="caption" color="secondary" style={{ marginTop: 2 }}>
          Each square is a day. Filled = every meal logged.
        </AppText>
        <View style={styles.dayGrid}>
          {report.days.map((day) => {
            const ratio = day.planned > 0 ? day.consumed / day.planned : 0;
            const bg = day.empty
              ? "transparent"
              : ratio === 1
                ? colors.success
                : ratio > 0
                  ? `${colors.warning}CC`
                  : `${colors.error}55`;
            return (
              <View
                key={day.date}
                style={[
                  styles.daySquare,
                  {
                    backgroundColor: bg,
                    borderColor: day.empty ? colors.border : "transparent",
                    borderWidth: day.empty ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              />
            );
          })}
        </View>
        {report.totalDays > report.daysWithPlan ? (
          <AppText variant="caption" color="secondary" style={{ marginTop: Spacing.sm }}>
            {`Outlined squares are days with no plan — they aren't counted against you.`}
          </AppText>
        ) : null}
      </Card>

      {/* --- What happened -------------------------------------------------- */}
      {report.highlights.length > 0 ? (
        <Card padding="lg">
          <AppText variant="body" weight="700" style={{ marginBottom: Spacing.sm }}>
            What stood out
          </AppText>
          {report.highlights.map((line, i) => (
            <View key={i} style={styles.bullet}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <AppText variant="body" style={styles.bulletText}>
                {line}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* --- Per-slot ------------------------------------------------------- */}
      {report.perSlot.length > 0 ? (
        <Card padding="lg">
          <AppText variant="body" weight="700" style={{ marginBottom: Spacing.md }}>
            By meal
          </AppText>
          {report.perSlot.map((slot) => (
            <View key={slot.slot} style={styles.slotRow}>
              <AppText variant="body" style={styles.slotName}>
                {cap(slot.slot)}
              </AppText>
              <View style={[styles.bar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(slot.rate * 100)}%`,
                      backgroundColor:
                        slot.rate >= 0.8
                          ? colors.success
                          : slot.rate >= 0.5
                            ? colors.warning
                            : colors.error,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" weight="700" style={styles.slotPct}>
                {Math.round(slot.rate * 100)}%
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* --- Nutrition ------------------------------------------------------ */}
      <Card padding="lg">
        <AppText variant="body" weight="700" style={{ marginBottom: Spacing.md }}>
          Average day
        </AppText>
        <MacroRow label="Calories" actual={report.avgConsumed.calories} target={report.targets.calories} unit="" />
        <MacroRow label="Protein" actual={report.avgConsumed.proteinG} target={report.targets.proteinG} unit="g" />
        <MacroRow label="Carbs" actual={report.avgConsumed.carbsG} target={report.targets.carbsG} unit="g" />
        <MacroRow label="Fat" actual={report.avgConsumed.fatG} target={report.targets.fatG} unit="g" />
        {report.avgConsumed.calories === null ? (
          <AppText variant="caption" color="secondary" style={{ marginTop: Spacing.sm }}>
            No macro data was recorded for this period.
          </AppText>
        ) : null}
      </Card>

      {/* --- Body ----------------------------------------------------------- */}
      {report.weight.deltaKg !== null ? (
        <Card padding="lg">
          <AppText variant="body" weight="700">
            Weight
          </AppText>
          <View style={styles.weightRow}>
            <AppText variant="display" weight="800">
              {report.weight.deltaKg > 0 ? "+" : ""}
              {report.weight.deltaKg} kg
            </AppText>
            <AppText variant="caption" color="secondary">
              {report.weight.startKg} → {report.weight.endKg} kg
              {report.weight.perWeekKg !== null
                ? ` · ${report.weight.perWeekKg > 0 ? "+" : ""}${report.weight.perWeekKg} kg/week`
                : ""}
            </AppText>
          </View>
        </Card>
      ) : null}

      {/* --- Meals worth keeping / dropping --------------------------------- */}
      {report.mostSkipped.length > 0 || report.mostEaten.length > 0 ? (
        <Card padding="lg">
          {report.mostEaten.length > 0 ? (
            <>
              <AppText variant="body" weight="700">
                Meals that worked
              </AppText>
              {report.mostEaten.slice(0, 3).map((m) => (
                <AppText key={m.name} variant="caption" color="secondary" style={styles.tally}>
                  {m.name} · {m.times}×
                </AppText>
              ))}
            </>
          ) : null}
          {report.mostSkipped.length > 0 ? (
            <>
              <Divider style={{ marginVertical: Spacing.md }} />
              <AppText variant="body" weight="700">
                Meals you kept skipping
              </AppText>
              {report.mostSkipped.slice(0, 3).map((m) => (
                <AppText key={m.name} variant="caption" color="secondary" style={styles.tally}>
                  {m.name} · skipped {m.times}×
                </AppText>
              ))}
            </>
          ) : null}
        </Card>
      ) : null}

      {/* --- What next ------------------------------------------------------ */}
      <View style={styles.actions}>
        <AppText variant="body" weight="700" align="center">
          What next?
        </AppText>
        <Button
          label="Run it again"
          icon="refresh"
          fullWidth
          loading={acting}
          onPress={async () => {
            setActing(true);
            try {
              await restartPeriod(report.periodId);
              router.replace("/(tabs)/diet");
            } finally {
              setActing(false);
            }
          }}
        />
        <Button
          label="Choose another plan"
          icon="swap-horizontal"
          variant="tonal"
          fullWidth
          onPress={async () => {
            await dismissReport(report.periodId);
            router.replace("/(tabs)/diet");
          }}
        />
        <Button
          label="Plan my own menu"
          icon="create-outline"
          variant="ghost"
          fullWidth
          onPress={async () => {
            await dismissReport(report.periodId);
            router.replace("/diet/plan-menu");
          }}
        />
      </View>
    </Screen>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card padding="lg" style={styles.statBox}>
      <AppText variant="caption" color="secondary" weight="700" uppercase>
        {label}
      </AppText>
      <AppText variant="title" weight="800">
        {value}
      </AppText>
      <AppText variant="caption" color="secondary">
        {sub}
      </AppText>
    </Card>
  );
}

function MacroRow({
  label,
  actual,
  target,
  unit,
}: {
  label: string;
  actual: number | null;
  target: number | null;
  unit: string;
}) {
  return (
    <View style={styles.macroRow}>
      <AppText variant="body">{label}</AppText>
      <View style={styles.macroValues}>
        <AppText variant="body" weight="700">
          {actual === null ? "—" : `${Math.round(actual)}${unit}`}
        </AppText>
        {target !== null ? (
          <AppText variant="caption" color="secondary">
            target {Math.round(target)}
            {unit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const fmt = (d: string) =>
  parseLocalDate(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },
  header: { flexDirection: "row", justifyContent: "flex-start" },
  hero: { alignItems: "center", gap: 4 },
  verdictChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
  },
  headline: { marginTop: Spacing.md, lineHeight: 23 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  statBox: { flexGrow: 1, flexBasis: "45%", gap: 2 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: Spacing.md },
  daySquare: { width: 18, height: 18, borderRadius: 4 },
  bullet: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, lineHeight: 22 },
  slotRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.sm },
  slotName: { width: 84 },
  bar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  slotPct: { width: 40, textAlign: "right" },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  macroValues: { alignItems: "flex-end" },
  weightRow: { marginTop: Spacing.sm, gap: 2 },
  tally: { marginTop: 4 },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
});
