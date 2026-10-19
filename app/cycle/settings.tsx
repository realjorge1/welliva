/**
 * CYCLE SETTINGS — every choice the tracker makes on her behalf, and the way
 * out of each.
 *
 *   Predictions — the fertile window (off unless she wants it), and the usual
 *                 lengths her logs are taking over from.
 *   Reminders   — on or off, and whether the lock screen may say "period".
 *   Privacy     — the backup (on by default; switching it off deletes the
 *                 cloud copy, not just future uploads) and whether Gozlin may
 *                 see her cycle (off by default; consent `cycle_gozlin`).
 *   Your data   — a summary for her doctor, everything as CSV, turn off
 *                 (keeps the log), delete (erases it, here and in the backup).
 *
 * Every row says what is TRUE, not what was asked for: "Backed up" only when
 * this account's backup actually runs, "Reminders on" only with permission.
 */
import { useCyclePalette } from "@/components/cycle";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { useReminderPermission } from "@/components/notifications/useReminderPermission";
import {
  AppText,
  Card,
  ConfirmSheet,
  ListGroup,
  ListRow,
  Screen,
  Stepper,
  useColors,
} from "@/components/ui";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useCycle } from "@/contexts/CycleContext";
import { cycleCsv, doctorSummary } from "@/services/cycle";
import { useSyncStatus } from "@/services/sync/useSyncStatus";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Share, StyleSheet, Switch, View } from "react-native";

export default function CycleSettingsScreen() {
  const { colors } = useColors();
  const palette = useCyclePalette();
  const cycle = useCycle();
  const { settings, view, data, today } = cycle;
  const sync = useSyncStatus();
  const permission = useReminderPermission();
  const [confirm, setConfirm] = useState<"off" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTrack = { true: palette.period, false: alpha(colors.text, 0.18) };

  const remindersSubtitle = !settings.remindersOn
    ? "Off"
    : permission.status === "granted"
      ? "A heads-up before your period, a check-in after the likely day, and \"has it ended?\""
      : permission.status === "denied"
        ? "Notifications are off for welliva in your phone's settings. Tap to open them."
        : "Tap to let welliva send notifications.";

  const backupSubtitle = !settings.backupOn
    ? "Only on this phone. Switch on to include it in your backup."
    : sync.cloudDisabled
      ? "Your account isn't backed up on welliva Free, so it stays on this phone for now."
      : "Backed up and synced with your account. Switching off deletes the backup copy.";

  const share = (message: string) => void Share.share({ message }).catch(() => undefined);

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.iconBtn, { backgroundColor: alpha(colors.text, 0.07) }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.flex}>
        Cycle settings
      </AppText>
    </View>
  );

  return (
    <>
      <Screen header={header}>
        <Label text="Predictions" />
        <ListGroup>
          <ListRow
            icon="sparkles"
            tone={palette.fertile}
            title="Show fertile window"
            subtitle="An estimate from your cycle. Never use it as birth control."
            right={
              <Switch
                value={settings.showFertileWindow}
                onValueChange={(v) => void cycle.updateSettings({ showFertileWindow: v })}
                trackColor={switchTrack}
                accessibilityLabel="Show fertile window"
              />
            }
          />
        </ListGroup>

        <Card padding="lg" style={styles.lengths}>
          <AppText variant="callout">What you told me</AppText>
          <AppText variant="footnote" color="tertiary" style={styles.lengthsHint}>
            Used until your own logs take over
            {view.prediction && view.prediction.basedOn > 0
              ? `. They already have: ${view.prediction.basedOn} logged ${view.prediction.basedOn === 1 ? "cycle" : "cycles"}.`
              : "."}
          </AppText>
          <LengthRow
            label="Usual period"
            value={settings.usualPeriodDays}
            fallback={5}
            min={1}
            max={12}
            onChange={(v) => void cycle.updateSettings({ usualPeriodDays: v })}
          />
          <LengthRow
            label="Usual cycle"
            value={settings.usualCycleDays}
            fallback={28}
            min={18}
            max={60}
            onChange={(v) => void cycle.updateSettings({ usualCycleDays: v })}
          />
        </Card>

        <Label text="Reminders" />
        <ListGroup>
          <ListRow
            icon="notifications"
            tone={colors.primary}
            title="Reminders"
            subtitle={remindersSubtitle}
            onPress={
              settings.remindersOn && permission.status === "denied"
                ? permission.openSystemSettings
                : settings.remindersOn && permission.status === "undetermined"
                  ? () => void permission.request()
                  : undefined
            }
            right={
              <Switch
                value={settings.remindersOn}
                onValueChange={(v) => {
                  void cycle.updateSettings({ remindersOn: v });
                  if (v && permission.status === "undetermined") void permission.request();
                }}
                trackColor={switchTrack}
                accessibilityLabel="Cycle reminders"
              />
            }
          />
          <ListRow
            icon="eye-off"
            tone={colors.water}
            title="Discreet wording"
            subtitle={
              settings.discreet
                ? "Lock screens say \"A gentle heads-up\", never \"period\"."
                : "Reminders say what they're about."
            }
            right={
              <Switch
                value={settings.discreet}
                onValueChange={(v) => void cycle.updateSettings({ discreet: v })}
                trackColor={switchTrack}
                accessibilityLabel="Discreet wording"
              />
            }
          />
        </ListGroup>

        <Label text="Privacy" />
        <ListGroup>
          <ListRow
            icon="cloud-upload"
            tone={colors.success}
            title="Back up with your account"
            subtitle={backupSubtitle}
            right={
              <Switch
                value={settings.backupOn}
                disabled={busy}
                onValueChange={(v) => {
                  setBusy(true);
                  void cycle.setBackup(v).finally(() => setBusy(false));
                }}
                trackColor={switchTrack}
                accessibilityLabel="Back up your cycle log with your account"
              />
            }
          />
          <ListRow
            icon="chatbubble-ellipses"
            tone={colors.primary}
            title="Let Gozlin see your cycle"
            subtitle="When you chat, Gozlin gets your cycle day, when your next period is likely, and what you logged today. Nothing else. Gozlin is part of welliva Pro."
            right={
              <Switch
                value={cycle.shareWithGozlin}
                onValueChange={(v) => void cycle.setShareWithGozlin(v)}
                trackColor={switchTrack}
                accessibilityLabel="Let Gozlin see your cycle"
              />
            }
          />
        </ListGroup>
        <AppText variant="caption" color="tertiary" style={styles.footnote}>
          Your cycle log is never shared, sold or used for ads.
        </AppText>

        <Label text="Your data" />
        <ListGroup>
          <ListRow
            icon="document-text"
            tone={colors.primary}
            title="Share a summary for your doctor"
            subtitle="Lengths, ranges, the symptoms you log most, and any notes"
            onPress={() =>
              share(
                doctorSummary({ data, cycles: view.cycles, prediction: view.prediction, notes: view.allNotes, today }),
              )
            }
          />
          <ListRow
            icon="download"
            tone={colors.water}
            title="Export everything"
            subtitle="Every period and logged day, as CSV"
            onPress={() => share(cycleCsv(data))}
          />
          <ListRow
            icon="pause-circle"
            tone={colors.warning}
            title="Turn off cycle tracking"
            subtitle="Hides it everywhere. Your log is kept for if you come back."
            onPress={() => setConfirm("off")}
          />
          <ListRow
            icon="trash"
            tone={colors.error}
            title="Delete all cycle data"
            subtitle="From this phone and from your backup"
            destructive
            onPress={() => setConfirm("delete")}
          />
        </ListGroup>
      </Screen>

      <ConfirmSheet
        visible={confirm === "off"}
        title="Turn off cycle tracking?"
        body="The cycle card, reminders and cycle-based changes to your plan stop. Nothing is deleted."
        reassurance="Turn it back on from Settings any time and everything you logged is still here."
        confirmLabel="Turn off"
        icon="pause-circle-outline"
        onConfirm={() => {
          void cycle.turnOff().then(() => router.back());
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === "delete"}
        title="Delete your cycle log?"
        body="Every period, symptom and setting you've logged here is erased, on this phone and in your backup. This can't be undone."
        reassurance="The rest of welliva (your meals, workouts and habits) is untouched."
        confirmLabel="Delete cycle log"
        onConfirm={() => {
          void cycle.eraseAll().then(() => router.replace("/" as never));
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function Label({ text }: { text: string }) {
  return (
    <AppText variant="caption" color="tertiary" uppercase style={styles.label}>
      {text}
    </AppText>
  );
}

function LengthRow({
  label,
  value,
  fallback,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  fallback: number;
  min: number;
  max: number;
  onChange: (v: number | null) => void;
}) {
  const current = value ?? fallback;
  return (
    <View style={styles.lengthRow}>
      <AppText variant="subhead" style={styles.flex}>
        {label}
      </AppText>
      <Stepper
        label={label}
        value={value === null ? "Not sure" : `${value} days`}
        valueWidth={84}
        onDecrement={() => onChange(Math.max(min, current - 1))}
        onIncrement={() => onChange(Math.min(max, current + 1))}
        canDecrement={value === null || value > min}
        canIncrement={value === null || value < max}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  label: { marginTop: Spacing.xxl, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  lengths: { marginTop: Spacing.md },
  lengthsHint: { marginTop: 2, marginBottom: Spacing.sm },
  lengthRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  footnote: { marginTop: Spacing.sm, marginLeft: Spacing.xs },
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="cycle-settings" />;
}
