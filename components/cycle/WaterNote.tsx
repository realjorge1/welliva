/**
 * "THAT'S WATER, NOT FAT" — the words, and the two places they appear.
 *
 *   WaterCard          on the cycle screen, while the reading is recent
 *   WaterAfterWeighIn  straight after a weigh-in, where she is looking at the
 *                      number and wondering about it
 *
 * What it says, and whether it may say it at all, is services/cycle/water. This
 * file only shows it, and spends the one-time general note: the moment it is in
 * front of her it is marked, so it stays for the day and never comes back.
 */
import { AppText, Button, Sheet } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useCycleOptional } from "@/contexts/CycleContext";
import { CYCLE_LIBRARY, type WaterMoment } from "@/services/cycle";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useCyclePalette } from "./cycleTheme";

const PAGE = CYCLE_LIBRARY["scale-before-period"];

/** Spend the one-time note the moment it is actually shown. */
function useSpendNote(moment: WaterMoment | null | undefined, showing: boolean) {
  const cycle = useCycleOptional();
  const noteWaterSeen = cycle?.noteWaterSeen;
  const first = showing && moment?.kind === "first";
  useEffect(() => {
    if (first) void noteWaterSeen?.();
  }, [first, noteWaterSeen]);
}

function ReadMore({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => {
        onPress?.();
        router.push({ pathname: "/cycle/learn/[id]", params: { id: PAGE.id } } as never);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Read: ${PAGE.title}`}
      hitSlop={8}
      style={styles.link}
    >
      <AppText variant="footnote" color="brand" weight="700">
        Read: {PAGE.title}
      </AppText>
    </Pressable>
  );
}

export function WaterCard({ moment, style }: { moment: WaterMoment; style?: StyleProp<ViewStyle> }) {
  const palette = useCyclePalette();
  useSpendNote(moment, true);
  return (
    <View style={[styles.card, { backgroundColor: palette.wash }, style]}>
      <View style={styles.row}>
        <Ionicons name="water-outline" size={16} color={palette.period} style={styles.icon} />
        <AppText variant="subhead" style={styles.flex}>
          {moment.text}
        </AppText>
      </View>
      <ReadMore />
    </View>
  );
}

/**
 * How long the weigh-in's own sheet takes to slide away: React Native won't
 * present a second Modal over a live one (components/navigation/Deck says more).
 */
const AFTER_MODAL_MS = 600;
/** The new reading has reached the view by now, or it has nothing to say about it. */
const GIVE_UP_MS = 2500;

/**
 * Armed by the weigh-in sheet when she saves a weight. If that reading turns out
 * to be one of these moments, the note opens as the sheet closes; if not, nothing
 * has happened and nothing appears.
 */
export function WaterAfterWeighIn({ armed, onDone }: { armed: boolean; onDone: () => void }) {
  const palette = useCyclePalette();
  const cycle = useCycleOptional();
  const moment = cycle?.settings.enabled ? cycle.view.water : null;
  const [settled, setSettled] = useState(false);
  const open = armed && settled && !!moment && moment.date === cycle?.today;

  useEffect(() => {
    if (!armed) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), AFTER_MODAL_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (!armed || open) return;
    const t = setTimeout(onDone, GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [armed, open, onDone]);

  useSpendNote(moment, open);

  return (
    <Sheet
      visible={open}
      onClose={onDone}
      header={
        <View style={styles.sheetHead}>
          <Ionicons name="water-outline" size={18} color={palette.period} />
          <AppText variant="headline" style={styles.flex}>
            About that number
          </AppText>
        </View>
      }
    >
      <View style={styles.sheetBody}>
        <AppText variant="body">{moment?.text}</AppText>
        <ReadMore onPress={onDone} />
        <Button label="Got it" variant="tonal" onPress={onDone} fullWidth style={styles.sheetButton} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.xl },
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  icon: { marginTop: 2 },
  flex: { flex: 1 },
  link: { alignSelf: "flex-start", marginTop: Spacing.md, paddingVertical: 2 },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sheetBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  sheetButton: { marginTop: Spacing.lg },
});
