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
import { cycleHeadline, dialModel } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { CycleDial } from "./CycleDial";
import { useCyclePalette } from "./cycleTheme";

export function CycleHomeCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const { view, today, settings, data } = cycle;
  const s = view.status;

  const model = useMemo(
    () => dialModel({ episodes: data.periods, view, today, showFertile: settings.showFertileWindow }),
    [data.periods, view, today, settings.showFertileWindow],
  );

  if (!cycle.ready || !settings.enabled || view.mode === "pregnancy") return null;

  // The ring already shows the day, so the eyebrow names the card instead of
  // repeating the number; during a period the title says which day of it.
  const headline = cycleHeadline(view, settings.showFertileWindow);
  const copy = {
    eyebrow: "Your cycle",
    title: s.inPeriod && s.periodDay !== null && !s.periodStale ? `Period, day ${s.periodDay}` : headline.title,
    detail: headline.detail,
  };
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
      accessibilityLabel={`Your cycle. ${copy.title}. ${copy.detail}`}
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

      {canStart || canEnd ? (
        <Pressable
          onPress={() => void (canEnd ? cycle.endPeriod() : cycle.startPeriod())}
          accessibilityRole="button"
          accessibilityLabel={canEnd ? "Log that your period ended today" : "Log that your period started today"}
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
        <Button label="Not now" size="sm" variant="ghost" onPress={() => void cycle.dismissOffer()} />
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
