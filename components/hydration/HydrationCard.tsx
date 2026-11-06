/**
 * HydrationCard — the hydration log, in the same language as the rest of Home.
 *
 * Top to bottom: the day's water as a dot-matrix figure beside a measuring
 * cylinder that fills as you drink; one-tap keys for the sizes people really
 * pour (and "Other" for the rest); and today's drinks as a log you can correct.
 *
 * WHAT MAKES IT A LOG. The classic card was a counter with three buttons: a glass
 * tapped twice by accident was a wrong number with no way back. Every glass is
 * now listed with its time (services/nutrition/waterPours, written in the same
 * step as the total), and a cross beside it takes that drink back out.
 *
 * NOTHING HERE MOVES UNLESS YOU DRINK. The classic card's wave and bubbles looped
 * forever, and on the low-end phones this app is tuned for an endless animation
 * keeps the whole window redrawing (docs: welliva-low-end-perf). This one animates
 * the level once, when it changes — a glass going in — and is otherwise still.
 * (The classic card itself was deleted on 2026-10-31; see ./index.tsx.)
 */
import { AppText, DotNumeral, Mono, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useNutrition, useProfile, useSystem } from "@/contexts/AppContext";
import { removeWaterPour } from "@/services/nutrition/waterStore";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { INSTRUMENT_BLACK, INSTRUMENT_WHITE } from "@/components/home/surface";
import { TileHeader } from "@/components/home/TileHeader";
import { CustomAmountSheet } from "./CustomAmountSheet";
import { DrinkLog } from "./DrinkLog";
import { HydrationGauge } from "./HydrationGauge";
import { GLASS_ML, QUICK_ML, hydrationStatus } from "./hydrationLogic";
import { useDrinkRows } from "./useDrinkRows";

const WATER_GOAL_FALLBACK = 2500;
/** Ink for text that sits on the water-blue key. */
const ON_WATER = "#04202F";
/** The figure's dots: full white, with the cells behind them barely there. */
const GHOST = alpha(INSTRUMENT_WHITE, 0.05);

export function HydrationCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  const { currentDate } = useSystem();
  const { consumedNutrition, addWater, syncLiveCounters } = useNutrition();
  const { userGoals, nutritionTargets } = useProfile();

  const goal = userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? WATER_GOAL_FALLBACK;
  const total = consumedNutrition?.waterMl || 0;
  const level = goal > 0 ? Math.min(total / goal, 1) : 0;
  const status = hydrationStatus(total, goal);

  const rows = useDrinkRows(total, currentDate);
  const [figureW, setFigureW] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const add = useCallback(
    (ml: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      addWater(ml);
    },
    [addWater],
  );

  const remove = useCallback(
    async (id: string) => {
      setRemovingId(id);
      try {
        // The store lowers the counter and drops the drink in one step; the
        // context then re-reads the counter so every screen agrees.
        await removeWaterPour(id);
        await syncLiveCounters();
      } catch (e) {
        console.error("[hydration] could not remove the drink:", e);
      } finally {
        setRemovingId(null);
      }
    },
    [syncLiveCounters],
  );

  const goalChip = (
    <View style={[styles.chip, { borderColor: alpha(colors.water, 0.4) }]}>
      <Mono size={11} tracking={0.6} color={colors.textSecondary}>
        GOAL {(goal / 1000).toFixed(1)} L
      </Mono>
    </View>
  );

  return (
    <View style={[styles.card, { borderColor: alpha(colors.water, 0.5) }, style]}>
      <TileHeader label="Hydration" tone={colors.water} right={goalChip} />

      <View
        style={styles.hero}
        accessible
        accessibilityLabel={`Hydration: ${total} of ${goal} millilitres. ${status.text}`}
      >
        <View style={styles.figureCol}>
          <View
            style={styles.figure}
            onLayout={(e) => setFigureW(Math.floor(e.nativeEvent.layout.width))}
          >
            {figureW > 0 ? (
              <DotNumeral
                value={total}
                pitch={7}
                maxWidth={figureW}
                color={INSTRUMENT_WHITE}
                ghostColor={GHOST}
              />
            ) : null}
          </View>

          <AppText variant="footnote" color="tertiary" style={styles.of}>
            of {goal.toLocaleString()} ml
          </AppText>

          <View style={styles.statusRow}>
            <Ionicons
              name={status.reached ? "checkmark-circle" : "water-outline"}
              size={16}
              color={status.reached ? colors.success : colors.water}
            />
            <AppText variant="subhead" color="secondary" numberOfLines={1} style={styles.statusText}>
              {status.text}
            </AppText>
          </View>
        </View>

        <HydrationGauge level={level} goalMl={goal} />
      </View>

      <View style={styles.keys}>
        {QUICK_ML.map((ml) => {
          const primary = ml === GLASS_ML;
          return (
            <Pressable
              key={ml}
              onPress={() => add(ml)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${ml} millilitres`}
              style={({ pressed }) => [
                styles.key,
                primary
                  ? { backgroundColor: colors.water, borderColor: colors.water }
                  : { borderColor: alpha(colors.water, 0.42) },
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="callout" weight="800" color={primary ? ON_WATER : colors.text}>
                +{ml}
              </AppText>
              <Mono size={11} color={primary ? alpha(ON_WATER, 0.7) : colors.textTertiary}>
                ml
              </Mono>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Add another amount"
          style={({ pressed }) => [
            styles.key,
            { borderColor: alpha(colors.water, 0.42) },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="options-outline" size={18} color={colors.text} />
          <Mono size={11} color={colors.textTertiary}>
            other
          </Mono>
        </Pressable>
      </View>

      <View style={[styles.rule, { backgroundColor: colors.divider }]} />

      <DrinkLog rows={rows} removingId={removingId} onRemove={(id) => void remove(id)} />

      <CustomAmountSheet visible={sheet} onClose={() => setSheet(false)} onAdd={add} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Black, drawn by its edge — the same instrument surface as the macro cards,
  // with a thin edge of water instead of orange.
  card: {
    marginHorizontal: Spacing.screen,
    backgroundColor: INSTRUMENT_BLACK,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    marginTop: Spacing.md,
  },
  figureCol: { flex: 1, minWidth: 0 },
  // Reserves the figure's full height before it is measured; a smaller figure
  // sits at the top of it.
  figure: { height: 7 * 7 },
  of: { marginTop: Spacing.sm },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xs },
  statusText: { flexShrink: 1 },
  keys: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  key: {
    flex: 1,
    minHeight: 54,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.lg },
});
