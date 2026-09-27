/**
 * OnTimeCard — the ask for Android's "Alarms & reminders" access, and nothing
 * more.
 *
 * Without it, Android may hold a reminder for several minutes while the phone
 * is idle; with it, each one fires on the minute (services/notifications/
 * exactAlarms). The ask follows the rest of this screen's rules:
 *
 *   · ONLY WHEN IT MATTERS — Android, notifications allowed, at least one
 *     reminder actually pending, and timing not already exact. Nobody is asked
 *     for a permission that would change nothing for them.
 *   · SAY WHAT IT'S FOR — the one line of consequence ("a 1:00 reminder can
 *     arrive at 1:09"), not the permission's name.
 *   · ONE TAP TO THE ONE PAGE — straight to welliva's own switch. When the user
 *     comes back with it on, the card goes, the hero says "On the minute", and
 *     the reminder runner re-lays every reminder as an exact alarm.
 */
import { AppText, Button, Card, IconBadge, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import {
  exactAlarmStatus,
  openExactAlarmSettings,
  type ExactAlarmStatus,
} from "@/services/notifications/exactAlarms";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";

/** The live exact-alarm status, re-read on focus and on return from Settings. */
export function useExactAlarmStatus(): ExactAlarmStatus {
  const [status, setStatus] = useState<ExactAlarmStatus>(() => exactAlarmStatus());

  useFocusEffect(
    useCallback(() => {
      setStatus(exactAlarmStatus());
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setStatus(exactAlarmStatus());
    });
    return () => sub.remove();
  }, []);

  return status;
}

export function OnTimeCard() {
  const { colors } = useColors();

  return (
    <Card padding="lg" style={styles.card}>
      <View style={styles.row}>
        <IconBadge name="alarm-outline" tone={colors.primary} size={42} />
        <View style={styles.flex}>
          <AppText variant="bodyLg" weight="700">
            Make reminders arrive on the minute
          </AppText>
          <AppText variant="footnote" color="secondary" style={styles.body}>
            Android can hold a reminder for a few minutes while your phone is
            idle, so a 1:00 reminder may land at 1:09. Turn on “Alarms &
            reminders” for welliva and each one arrives exactly when you set it.
          </AppText>
        </View>
      </View>
      <Button
        label="Allow on-time reminders"
        icon="alarm-outline"
        variant="tonal"
        onPress={() => void openExactAlarmSettings()}
        accessibilityHint="Opens the Alarms and reminders setting for welliva"
        style={styles.cta}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  flex: { flex: 1 },
  body: { marginTop: 4, lineHeight: 19 },
  cta: { marginTop: Spacing.lg },
});
