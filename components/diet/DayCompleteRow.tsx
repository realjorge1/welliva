/**
 * DAY COMPLETE ROW — "That's everything for today."
 *
 * A day with one snack logged used to be averaged as if she ate one snack.
 * Now a day counts once she says it's complete, or once it's inferred whole
 * (3 meals ticked, or 70% of her calories — services/nutrition/dayStatus).
 * This is the "she says so" half: one quiet action under the meals, shown once
 * something is logged, plus the same question for yesterday while it can still
 * be logged. No notification (the reminder budget is spoken for).
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Button, useColors } from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { explicitFor } from "@/services/nutrition/dayStatus";

export interface DayCompleteRowProps {
  today: string;
  /** Something is logged today (a tick or a food). */
  hasIntake: boolean;
  /** Yesterday, when it is still in the log window and reads as partial. */
  yesterday?: string | null;
  onMark: (date: string, complete: boolean) => Promise<void>;
}

export function DayCompleteRow({ today, hasIntake, yesterday, onMark }: DayCompleteRowProps) {
  const { colors } = useColors();
  const [todayFlag, setTodayFlag] = useState<boolean | null>(null);
  const [yesterdayDone, setYesterdayDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void explicitFor(today).then((f) => {
      if (alive) setTodayFlag(f);
    });
    return () => {
      alive = false;
    };
  }, [today]);

  if (!hasIntake && !yesterday) return null;

  const mark = async (date: string, complete: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await onMark(date, complete);
      if (date === today) setTodayFlag(complete);
      else setYesterdayDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {hasIntake ? (
        todayFlag === true ? (
          <View style={[styles.done, { borderColor: alpha(colors.success, 0.35) }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              Today is marked complete, so it counts in your averages.
            </AppText>
            <Button label="Undo" variant="ghost" size="sm" onPress={() => void mark(today, false)} disabled={busy} />
          </View>
        ) : (
          <Button
            label="That's everything for today"
            icon="checkmark-done"
            variant="ghost"
            size="sm"
            onPress={() => void mark(today, true)}
            disabled={busy}
          />
        )
      ) : null}
      {yesterday && !yesterdayDone ? (
        <View style={styles.yesterday}>
          <AppText variant="footnote" color="secondary" style={styles.flex}>
            Yesterday looks only partly logged. Was that everything?
          </AppText>
          <Button
            label="Yes, that was all"
            variant="tonal"
            size="sm"
            onPress={() => void mark(yesterday, true)}
            disabled={busy}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  flex: { flex: 1 },
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  yesterday: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
});
