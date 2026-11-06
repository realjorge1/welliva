/**
 * RoughDaySheet — "Take it easy today?"
 *
 * One sheet, one decision. The reason is offered, never asked for; the streak
 * line says exactly what will happen to the streak BEFORE the tap — paused, or,
 * past the month's five, not paused — so nothing about it is a surprise later.
 */
import { AppText, Button, Chip, Sheet } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useGamification } from "@/contexts/AppContext";
import { todayDate } from "@/services/OfflineStorage";
import { ROUGH_REASONS, type RoughReason } from "@/services/smart/roughDay";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

export function RoughDaySheet({
  visible,
  onClose,
  onConfirm,
  canProtect,
  usedThisMonth,
  perMonth,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason?: RoughReason) => void;
  /** Would today pause the streak? */
  canProtect: boolean;
  usedThisMonth: number;
  perMonth: number;
}) {
  const [reason, setReason] = useState<RoughReason | undefined>(undefined);
  // A fresh sheet every time: yesterday's reason is not today's.
  useEffect(() => {
    if (visible) setReason(undefined);
  }, [visible]);

  // Say what will actually happen. Today already kept needs no pause at all.
  const { streakData } = useGamification();
  const keptToday = streakData.lastActiveDate === todayDate();
  const streakLine = keptToday
    ? "You've already kept today, so your streak is safe."
    : canProtect
      ? `Your streak is paused for today, not broken. ${usedThisMonth} of ${perMonth} rough days used this month.`
      : `You've used all ${perMonth} rough days that can pause your streak this month, so today won't pause it. Everything else still applies.`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.9}
      header={
        <View style={styles.header}>
          <AppText variant="title">Take it easy today?</AppText>
          <AppText variant="subhead" color="secondary" style={styles.lead}>
            For the rest of today: a gentle walk or rest instead of your workout, no calorie
            countdown, no reminders, and a quiet coach.
          </AppText>
        </View>
      }
    >
      {/* On a short phone with large text the middle scrolls; the answers stay put. */}
      <ScrollView style={styles.middle} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AppText variant="caption" color="tertiary" uppercase style={styles.label}>
          What&apos;s going on? (optional)
        </AppText>
        <View style={styles.chips}>
          {ROUGH_REASONS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              active={reason === r.value}
              onPress={() => setReason((cur) => (cur === r.value ? undefined : r.value))}
            />
          ))}
        </View>
        <AppText variant="footnote" color="secondary" style={styles.streak}>
          {streakLine}
        </AppText>
      </ScrollView>
      <View style={styles.answers}>
        <Button
          label="Make today gentle"
          onPress={() => onConfirm(reason)}
          accessibilityHint="Changes today only. You can take it back any time today."
        />
        <Button label="Not now" variant="ghost" onPress={onClose} style={styles.second} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },
  lead: { marginTop: Spacing.xs },
  middle: { flexGrow: 0 },
  body: { paddingHorizontal: Spacing.xl },
  answers: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  label: { marginBottom: Spacing.sm, letterSpacing: 0.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  streak: { marginTop: Spacing.lg, marginBottom: Spacing.lg },
  second: { marginTop: Spacing.sm },
});
