/**
 * "THAT'S WATER, NOT FAT" — for everyone, straight after a weigh-in.
 *
 * The words and every gate are services/body/scaleJump. This only decides when
 * the sheet opens: after the weigh-in sheet has slid away (React Native won't
 * present a second Modal over a live one), only when the new reading has
 * reached state and is one of these moments, and never when the cycle tracker
 * has its own note about the same reading (components/cycle/WaterNote), which
 * knows more than this one does.
 *
 * Nothing is stored and nothing is counted: it is said once, about the reading
 * just made, and it is gone when they tap "Got it".
 */
import { AppText, Button, Sheet, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useNutrition, useProfile, useSystem, useWorkout } from "@/contexts/AppContext";
import { useCycleOptional } from "@/contexts/CycleContext";
import { useCycleHidden } from "@/contexts/CycleLockContext";
import { scaleJump, type ScaleDayIntake } from "@/services/body/scaleJump";
import { maintenanceTdee } from "@/services/NutritionService";
import { countsAsDay } from "@/services/nutrition/dayStatus";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

/** How long the weigh-in's own sheet takes to slide away (same beat as the cycle note). */
const AFTER_MODAL_MS = 600;
/** The new reading has reached state by now, or there is nothing to say about it. */
const GIVE_UP_MS = 2500;

/**
 * Armed by the weigh-in sheet when a weight is saved. If the reading is one of
 * these moments the note opens as the sheet closes; if not, nothing appears.
 */
export function ScaleNoteAfterWeighIn({ armed, onDone }: { armed: boolean; onDone: () => void }) {
  const { colors } = useColors();
  const { bodyLogs, userBio, nutritionTargets } = useProfile();
  const { dietHistory } = useNutrition();
  const { workoutLog } = useWorkout();
  const { currentDate } = useSystem();
  const intakeTarget = nutritionTargets?.calories ?? null;

  // The cycle tracker's own note about this reading wins (and it says nothing
  // while "Lock my cycle" is shut, so neither does this check of it).
  const cycle = useCycleOptional();
  const cycleHidden = useCycleHidden();
  const cycleSpeaks = !!(
    cycle?.settings.enabled &&
    !cycleHidden &&
    cycle.view.water &&
    cycle.view.water.date === cycle.today
  );

  const jump = useMemo(() => {
    if (!armed || !userBio) return null;
    // WHOLE days only (services/nutrition/dayStatus): "this jump is water, not
    // fat" needs to know what she ate, and a one-snack day doesn't say that.
    const intake: Record<string, ScaleDayIntake> = {};
    for (const e of dietHistory) {
      if (countsAsDay(e, intakeTarget)) intake[e.date] = { kcal: e.consumedCalories ?? 0, carbsG: e.consumedCarbsG ?? 0 };
    }
    return scaleJump({
      weighIns: (bodyLogs ?? []).map((b) => ({ date: b.date, kg: b.weightKg })),
      intake,
      maintenanceKcal: maintenanceTdee(userBio),
      workoutDates: workoutLog.map((w) => w.date),
      today: currentDate,
    });
  }, [armed, userBio, dietHistory, bodyLogs, workoutLog, currentDate, intakeTarget]);

  const [settled, setSettled] = useState(false);
  const open = armed && settled && !cycleSpeaks && !!jump;

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

  return (
    <Sheet
      visible={open}
      onClose={onDone}
      header={
        <View style={styles.head}>
          <Ionicons name="water-outline" size={18} color={colors.water} />
          <AppText variant="headline" style={styles.flex}>
            About that number
          </AppText>
        </View>
      }
    >
      <View style={styles.body}>
        <AppText variant="body">{jump?.text}</AppText>
        <Button label="Got it" variant="tonal" onPress={onDone} fullWidth style={styles.button} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  button: { marginTop: Spacing.lg },
});
