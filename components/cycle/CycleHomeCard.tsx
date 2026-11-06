/**
 * The cycle on Home: a calm ring, where she is, what's next — and, on the days
 * it matters, the one tap that logs it.
 *
 * CycleHomeCard shows only while tracking is on (and not paused for pregnancy).
 * CycleOfferCard is the invitation the owner asked for: offered to women,
 * answered once. "Not now" means not again — Settings is always there.
 */
import { useCycle } from "@/contexts/CycleContext";
import { AppText, Button, Card, IconBadge, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { bleedWords, cycleHeadline, dialModel, glanceConfidence } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { CycleDial } from "./CycleDial";
import { useCyclePalette } from "./cycleTheme";
import { ReliefQuestion } from "./ReliefQuestion";

export function CycleHomeCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const { view, today, settings, data } = cycle;
  const s = view.status;

  const model = useMemo(
    () => dialModel({ episodes: data.periods, view, today, showFertile: view.showFertile }),
    [data.periods, view, today],
  );

  // A trip added elsewhere can change today's heads-up; Life Context has no signal.
  const { refreshMoments } = cycle;
  const tracking = settings.enabled;
  useFocusEffect(
    useCallback(() => {
      if (tracking) void refreshMoments();
    }, [tracking, refreshMoments]),
  );

  if (!cycle.ready || !settings.enabled || view.mode === "pregnancy") return null;

  // The ring already shows the day, so the eyebrow names the card instead of
  // repeating the number; during a period the title says which day of it.
  const headline = cycleHeadline(view, view.showFertile);
  const copy = {
    eyebrow: "Your cycle",
    title:
      s.inPeriod && s.periodDay !== null && !s.periodStale
        ? `${bleedWords(view.mode).label}, day ${s.periodDay}`
        : headline.title,
    detail: headline.detail,
  };
  // How sure the window in the title is — the cycle screen's confidence line,
  // in two words. Null whenever the card shows no window.
  const sure = glanceConfidence(view);
  const headsUp = view.headsUps[0]?.text ?? null;

  // The one tap that matters today: "It started" once the window is open (or
  // she's late), "It ended" while a period is running past its usual length.
  const canStart =
    !s.inPeriod && s.predicting && s.toEarliest !== null && (s.toEarliest <= 1 || s.lateBy > 0);
  const canEnd = s.inPeriod && s.periodOpen && !!s.expectedEnd && s.expectedEnd <= today;

  return (
    <Card
      style={style}
      padding="lg"
      // A tab switch, not a push: the cycle screen is a menu destination, and
      // pushing one from Home would hand it a back arrow where the hamburger
      // belongs.
      onPress={() => router.navigate("/cycle" as never)}
      accessibilityLabel={`Your cycle. ${copy.title}. ${copy.detail}${sure ? `. ${sure}` : ""}`}
      accessibilityHint="Opens your cycle"
    >
      <View style={styles.row}>
        <CycleDial
          model={model}
          size={78}
          strokeWidth={7}
          todayTone={s.inPeriod ? palette.period : colors.primary}
          animate="intro"
        >
          <AppText variant="headline" style={styles.dayNumber} maxFontSizeMultiplier={1.1}>
            {s.cycleDay ?? "–"}
          </AppText>
        </CycleDial>
        <View style={styles.text}>
          <AppText variant="caption" color="tertiary" uppercase>
            {copy.eyebrow}
          </AppText>
          <AppText variant="callout" numberOfLines={1} style={styles.title}>
            {copy.title}
          </AppText>
          <AppText variant="footnote" color="secondary" numberOfLines={2}>
            {copy.detail}
          </AppText>
          {sure ? (
            <View style={styles.sureRow}>
              <View style={[styles.sureDot, { backgroundColor: palette.period }]} />
              <AppText variant="caption" color="tertiary" numberOfLines={1}>
                {sure}
              </AppText>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>

      {headsUp ? (
        <View style={[styles.headsUp, { backgroundColor: palette.wash }]}>
          <Ionicons name="sparkles-outline" size={14} color={palette.period} />
          <AppText variant="footnote" color="secondary" style={styles.flex}>
            {headsUp}
          </AppText>
        </View>
      ) : null}

      {/* "Yesterday's cramps: what helped most?" — renders nothing unless
          today is the day after one, and keeps its "Noted" after the tap. */}
      <ReliefQuestion compact />

      {canStart || canEnd ? (
        <Pressable
          onPress={() => void (canEnd ? cycle.endPeriod() : cycle.startPeriod())}
          accessibilityRole="button"
          accessibilityLabel={`Log that your ${bleedWords(view.mode).noun} ${canEnd ? "ended" : "started"} today`}
          style={({ pressed }) => [
            styles.quick,
            { backgroundColor: alpha(palette.period, pressed ? 0.26 : 0.16) },
          ]}
        >
          <Ionicons name={canEnd ? "checkmark-circle-outline" : "water"} size={16} color={palette.period} />
          <AppText variant="footnote" weight="700" style={{ color: palette.period }}>
            {canEnd ? "It ended today" : "It started today"}
          </AppText>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function CycleOfferCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const palette = useCyclePalette();
  const cycle = useCycle();
  if (!cycle.offerable) return null;
  return (
    <Card style={style} padding="lg">
      <View style={styles.offerHead}>
        <IconBadge name="water" tone={palette.period} size={40} />
        <View style={styles.flex}>
          <AppText variant="callout">Track your cycle, privately</AppText>
          <AppText variant="footnote" color="secondary" style={styles.offerBody}>
            Predictions that learn your rhythm, a plan that eases off on hard days, and patterns only you can see.
          </AppText>
        </View>
      </View>
      <View style={styles.offerActions}>
        <Button
          label="Set it up"
          size="sm"
          onPress={() => router.push("/cycle/setup" as never)}
          style={styles.flex}
        />
        <Button
          label="Not now"
          size="sm"
          variant="ghost"
          fullWidth={false}
          onPress={() => void cycle.dismissOffer()}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  dayNumber: { fontWeight: "800" },
  text: { flex: 1, gap: 1 },
  title: { marginTop: 1 },
  flex: { flex: 1 },
  sureRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  sureDot: { width: 6, height: 6, borderRadius: 3 },
  headsUp: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  quick: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
  },
  offerHead: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  offerBody: { marginTop: 2 },
  offerActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg, alignItems: "center" },
});
