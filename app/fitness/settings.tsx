/**
 * FITNESS SETTINGS — music, voice, reminders, training prefs and data safety.
 *
 * Every preference the setup flow captures is editable here, plus the data
 * controls: export fitness data, reset recommendations, and reset the
 * module's preferences. Account-wide data deletion stays in the app's main
 * Privacy screen — this screen only governs what the fitness module owns.
 */

import { AppText, Button, Card, Screen, useColors } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useWorkout } from "@/contexts/AppContext";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import {
  cancelFitnessReminders,
  requestNotificationPermission,
  syncFitnessReminders,
} from "@/fitness/services/FitnessNotifications";
import {
  buildFitnessExport,
  clearFitnessProfile,
  loadFitnessProfile,
  resetRecommendationMemory,
} from "@/fitness/services/FitnessProfileStore";
import type { ReminderPrefs } from "@/fitness/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { Alert, Pressable, Share, StyleSheet, Switch, View } from "react-native";

const REMINDER_HOURS = [6, 7, 8, 12, 17, 18, 19, 20];

export default function FitnessSettingsScreen() {
  const { colors } = useColors();
  const { profile, update } = useFitnessProfile();
  const { workoutLog, sessionHistory } = useWorkout();

  const setReminders = useCallback(
    async (patch: Partial<ReminderPrefs>) => {
      const next = { ...profile.reminders, ...patch };
      const turningOn =
        (patch.workouts || patch.hydration || patch.stretch || patch.weeklySummary) === true;
      if (turningOn) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            "Notifications are off",
            "Enable notifications for Welliva in your device settings to receive reminders.",
          );
          return;
        }
      }
      await update({ reminders: next });
      await syncFitnessReminders(await loadFitnessProfile());
    },
    [profile.reminders, update],
  );

  const exportData = useCallback(async () => {
    const json = buildFitnessExport({ profile, workoutLog, sessionHistory });
    try {
      await Share.share({ message: json, title: "Welliva fitness data" });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }, [profile, workoutLog, sessionHistory]);

  const resetRecs = useCallback(() => {
    Alert.alert(
      "Reset recommendations?",
      "The coach forgets which suggestions you skipped and starts fresh. Your workout history is untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetRecommendationMemory();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ],
    );
  }, []);

  const resetProfile = useCallback(() => {
    Alert.alert(
      "Reset fitness preferences?",
      "Goals, styles, days and reminder settings return to defaults. Your workout history and achievements are untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await cancelFitnessReminders();
            await clearFitnessProfile();
            router.back();
          },
        },
      ],
    );
  }, []);

  const Row = ({
    icon,
    label,
    sub,
    right,
    onPress,
  }: {
    icon: string;
    label: string;
    sub?: string;
    right?: React.ReactNode;
    onPress?: () => void;
  }) => {
    const inner = (
      <View style={styles.row}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary} />
        <View style={styles.flex}>
          <AppText variant="callout">{label}</AppText>
          {sub ? (
            <AppText variant="footnote" color="tertiary">
              {sub}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    );
    return onPress ? (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {inner}
      </Pressable>
    ) : (
      inner
    );
  };

  return (
    <Screen
      header={
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <AppText variant="display">Fitness Settings</AppText>
        </View>
      }
    >
      {/* Training preferences */}
      <Card style={styles.block}>
        <AppText variant="headline" style={styles.sectionTitle}>
          Training
        </AppText>
        <Row
          icon="options-outline"
          label="Edit training preferences"
          sub={`${profile.daysAvailable.length} days/week · ~${profile.typicalDurationMin} min sessions`}
          right={<Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
          onPress={() => router.push("/fitness/setup" as never)}
        />
      </Card>

      {/* Reminders */}
      <Card style={styles.block}>
        <AppText variant="headline" style={styles.sectionTitle}>
          Reminders
        </AppText>
        <Row
          icon="barbell-outline"
          label="Training days"
          sub="On the days you chose in setup"
          right={
            <Switch
              value={profile.reminders.workouts}
              onValueChange={(v) => void setReminders({ workouts: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          }
        />
        {profile.reminders.workouts && (
          <View style={styles.hourRow}>
            {REMINDER_HOURS.map((h) => {
              const active = profile.reminders.hour === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => void setReminders({ hour: h })}
                  accessibilityRole="button"
                  accessibilityLabel={`Remind at ${h}:00`}
                  style={[
                    styles.hourChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <AppText variant="footnote" color={active ? colors.onPrimary : "secondary"}>
                    {String(h).padStart(2, "0")}:00
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
        <Row
          icon="water-outline"
          label="Hydration"
          sub="A midday glass-of-water nudge"
          right={
            <Switch
              value={profile.reminders.hydration}
              onValueChange={(v) => void setReminders({ hydration: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <Row
          icon="leaf-outline"
          label="Evening stretch"
          sub="Five mobility minutes before bed"
          right={
            <Switch
              value={profile.reminders.stretch}
              onValueChange={(v) => void setReminders({ stretch: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <Row
          icon="stats-chart-outline"
          label="Weekly summary"
          sub="Sunday evening week wrap-up"
          right={
            <Switch
              value={profile.reminders.weeklySummary}
              onValueChange={(v) => void setReminders({ weeklySummary: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          }
        />
      </Card>

      {/* Data safety */}
      <Card style={styles.block}>
        <AppText variant="headline" style={styles.sectionTitle}>
          Your data
        </AppText>
        <Row
          icon="download-outline"
          label="Export fitness data"
          sub="Profile, workout log and session history as JSON"
          right={<Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
          onPress={() => void exportData()}
        />
        <Row
          icon="refresh-outline"
          label="Reset recommendations"
          sub="Forget skipped-workout adaptation memory"
          right={<Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
          onPress={resetRecs}
        />
        <Row
          icon="trash-outline"
          label="Reset fitness preferences"
          sub="Return this module to first-run defaults"
          right={<Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
          onPress={resetProfile}
        />
        <AppText variant="caption" color="tertiary" style={styles.dataNote}>
          Workout history and achievements are managed with the rest of your account in
          Settings → Privacy.
        </AppText>
      </Card>

      <Button
        label="Done"
        variant="tonal"
        onPress={() => router.back()}
        style={styles.block}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  sectionTitle: { marginBottom: Spacing.sm },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },

  hourRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  hourChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  dataNote: { marginTop: Spacing.md },
});
