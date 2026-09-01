/**
 * REMINDERS — "Tap to log", the screen where the user hands the app permission
 * to ask, and decides when.
 *
 * ── THE PRODUCT IDEA ────────────────────────────────────────────────────────
 * Logging a meal costs four taps and a context switch: unlock, find the app,
 * find the day, find the meal, tick it. That is not much, and it is enough to
 * lose. This screen turns it into one tap on a lock screen: at a time the USER
 * picked, a notification arrives naming today's meal, and a single button
 * records it — the app never has to open, and it is written the same way as if
 * it had (see services/notifications/mealActions).
 *
 * ── THREE RULES THIS SCREEN EXISTS TO ENFORCE ───────────────────────────────
 *
 *   1. THE APP NEVER PICKS A TIME. Every row starts OFF. The defaults in the
 *      time picker are suggestions inside the eating windows the rest of the
 *      app already uses; nothing is scheduled until a switch is turned on. An
 *      app that decides when you eat and then reminds you about it has the
 *      relationship backwards.
 *
 *   2. NOTHING IS SCHEDULED WITHOUT PERMISSION, AND PERMISSION IS EARNED
 *      FIRST. The OS prompt can be shown once and a refusal is close to
 *      permanent, so the live banner preview at the top is not decoration: it
 *      shows the exact notification, with its exact button, BEFORE the system
 *      dialog appears. People say yes to a thing they have seen.
 *
 *   3. WORKOUTS ARE NOT ON THIS SCREEN, AND THE SCREEN SAYS SO. A meal is a
 *      yes/no fact you can answer from a locked phone. A session is sets,
 *      weights, minutes and a completion percentage — a button that claimed to
 *      log one would be inventing all four. Stating the exclusion out loud is
 *      better than leaving a hole for someone to wonder about.
 *
 * The habits section is a directory, not a second control panel: a habit's
 * reminder belongs on the habit, and duplicating that editor here would give
 * the same setting two homes and eventually two answers.
 */
import { NotificationBannerPreview } from "@/components/notifications/NotificationBannerPreview";
import { useReminderPermission } from "@/components/notifications/useReminderPermission";
import {
  AppText,
  Button,
  Card,
  Divider,
  IconBadge,
  ListGroup,
  ListRow,
  Screen,
  SegmentedControl,
  useColors,
} from "@/components/ui";
import { Spacing, alpha } from "@/constants/theme";
import { useHabits } from "@/contexts/HabitsContext";
import { frequencyLabel } from "@/models/habit";
import {
  DEFAULT_SETTINGS,
  HORIZON_DAYS,
  MEAL_SLOTS,
  SLOT_LABEL,
  anyEnabled,
  formatTime,
  loadMealReminders,
  saveMealReminders,
  syncMealReminders,
  type MealReminderSettings,
} from "@/services/notifications/mealReminders";
import type { MealSlotKey } from "@/services/notifications/copy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

/**
 * The times a row can be set to.
 *
 * A coarse list, not a clock. A meal reminder does not need 8:47 — it needs to
 * land in the right part of the day, and a wheel picker for that is three
 * gestures where a chip is one. Each slot is offered a window that matches when
 * that meal is actually eaten, so no row can be set to a time the rest of the
 * app would not think the meal was due.
 */
const SLOT_TIMES: Record<MealSlotKey, readonly { hour: number; minute: number }[]> = {
  breakfast: [
    { hour: 6, minute: 30 },
    { hour: 7, minute: 30 },
    { hour: 8, minute: 30 },
    { hour: 9, minute: 30 },
  ],
  lunch: [
    { hour: 12, minute: 0 },
    { hour: 12, minute: 30 },
    { hour: 13, minute: 0 },
    { hour: 14, minute: 0 },
  ],
  dinner: [
    { hour: 18, minute: 0 },
    { hour: 19, minute: 0 },
    { hour: 19, minute: 30 },
    { hour: 20, minute: 30 },
  ],
  snack: [
    { hour: 10, minute: 30 },
    { hour: 15, minute: 30 },
    { hour: 16, minute: 30 },
    { hour: 21, minute: 0 },
  ],
};

const SLOT_ICON: Record<MealSlotKey, keyof typeof Ionicons.glyphMap> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
};

export default function RemindersScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const perm = useReminderPermission();
  const { views } = useHabits();

  const [settings, setSettings] = useState<MealReminderSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  /** How many notifications are actually in the OS queue right now. */
  const [scheduled, setScheduled] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadMealReminders().then((s) => {
      if (!alive) return;
      setSettings(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Persist, then re-lay the window.
   *
   * Both, always, and in that order. The stored settings are the truth; the OS
   * queue is a projection of them that is rebuilt from scratch every time. That
   * is what makes this screen safe to hammer — every toggle converges on the
   * same queue rather than adding to it.
   */
  const apply = useCallback(async (next: MealReminderSettings) => {
    setSettings(next);
    await saveMealReminders(next);
    setScheduled(await syncMealReminders(next));
  }, []);

  const toggleMaster = async (on: boolean) => {
    if (on && perm.status !== "granted") {
      const result = await perm.request();
      // A refusal must not leave the master switch reading "on" over a queue
      // the OS will never deliver from.
      if (result !== "granted") return;
    }
    await apply({ ...settings, enabled: on });
  };

  const toggleSlot = async (slot: MealSlotKey, on: boolean) => {
    const next: MealReminderSettings = {
      // Turning on a first slot turns the feature on with it. Making someone
      // flip two switches to receive one reminder is a puzzle, not a setting.
      enabled: on ? true : settings.enabled,
      slots: { ...settings.slots, [slot]: { ...settings.slots[slot], enabled: on } },
    };
    if (on && perm.status !== "granted") {
      const result = await perm.request();
      if (result !== "granted") return;
    }
    await apply(next);
  };

  const setTime = async (slot: MealSlotKey, hour: number, minute: number) => {
    await apply({
      ...settings,
      slots: { ...settings.slots, [slot]: { ...settings.slots[slot], hour, minute } },
    });
  };

  const live = anyEnabled(settings) && perm.status === "granted";
  const blocked = perm.status === "denied";
  const unavailable = perm.status === "unavailable";

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/(tabs)/settings" as never)
        }
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <View style={styles.flex}>
        <AppText variant="title">Tap to log</AppText>
        <AppText variant="footnote" color="tertiary">
          Finish a meal or a habit without opening the app
        </AppText>
      </View>
    </View>
  );

  return (
    <Screen header={header}>
      {/* What is actually being offered, shown rather than described. */}
      <Card padding="lg" style={styles.heroCard}>
        <AppText variant="title">Finish it from the lock screen</AppText>
        <AppText variant="subhead" color="secondary" style={styles.heroBlurb}>
          At the times you choose, Welliva asks about a meal you already have
          planned. One tap records it — no unlocking, no opening the app, no
          hunting for the right day.
        </AppText>
        <NotificationBannerPreview
          title="Lunch"
          body="Grilled chicken salad — had it? One tap and it's logged."
          actionLabel="Ate it"
          actionIcon="checkmark-circle-outline"
          style={styles.preview}
        />
      </Card>

      {/* Permission, stated plainly and never assumed. */}
      {blocked ? (
        <Card padding="lg" style={[styles.noticeCard, { borderColor: alpha(colors.warning, 0.4) }]}>
          <View style={styles.noticeRow}>
            <IconBadge name="notifications-off-outline" tone={colors.warning} size={38} />
            <View style={styles.flex}>
              <AppText variant="callout">Notifications are off</AppText>
              <AppText variant="footnote" color="tertiary">
                Your device has them turned off for Welliva, so nothing here can
                reach you until that changes.
              </AppText>
            </View>
          </View>
          <Button
            label="Open device settings"
            icon="open-outline"
            variant="tonal"
            onPress={perm.openSystemSettings}
            style={styles.noticeBtn}
          />
        </Card>
      ) : unavailable ? (
        <Card padding="lg" style={styles.noticeCard}>
          <AppText variant="footnote" color="tertiary">
            Reminders need the full app build. Everything else works as normal.
          </AppText>
        </Card>
      ) : null}

      {/* The master switch */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Meal reminders
      </AppText>
      <Card padding="lg">
        <View style={styles.masterRow}>
          <IconBadge
            name={live ? "notifications" : "notifications-outline"}
            tone={live ? colors.success : colors.textTertiary}
            size={40}
          />
          <View style={styles.flex}>
            <AppText variant="bodyLg" weight="600">
              Ask me about meals
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {live
                ? scheduled !== null
                  ? `${scheduled} reminder${scheduled === 1 ? "" : "s"} lined up for the next ${HORIZON_DAYS} days`
                  : "On — pick your times below"
                : "Off — nothing is scheduled"}
            </AppText>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(v) => void toggleMaster(v)}
            disabled={!loaded || blocked || unavailable}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Card>

      {/* One row per slot: a switch, and the time it fires. */}
      <Card padding="lg" style={styles.slotsCard}>
        {MEAL_SLOTS.map((slot, i) => {
          const r = settings.slots[slot];
          const times = SLOT_TIMES[slot];
          const selected = times.findIndex(
            (t) => t.hour === r.hour && t.minute === r.minute,
          );
          return (
            <View key={slot}>
              {i > 0 && <Divider spacing={0} />}
              <View style={styles.slotRow}>
                <IconBadge
                  name={SLOT_ICON[slot]}
                  tone={r.enabled ? colors.primary : colors.textTertiary}
                  size={38}
                />
                <View style={styles.flex}>
                  <AppText variant="bodyLg" weight="600">
                    {SLOT_LABEL[slot]}
                  </AppText>
                  <AppText variant="footnote" color="tertiary">
                    {r.enabled ? `Every day at ${formatTime(r.hour, r.minute)}` : "Not set"}
                  </AppText>
                </View>
                <Switch
                  value={r.enabled}
                  onValueChange={(v) => void toggleSlot(slot, v)}
                  disabled={!loaded || blocked || unavailable}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              {/* The times appear only once the row is on — a picker for a
                  reminder that isn't happening is a control with no effect. */}
              {r.enabled && (
                <SegmentedControl
                  options={times.map((t, idx) => ({
                    value: String(idx),
                    label: formatTime(t.hour, t.minute),
                  }))}
                  value={String(Math.max(0, selected))}
                  onChange={(v) => {
                    const t = times[Number(v)];
                    if (t) void setTime(slot, t.hour, t.minute);
                  }}
                  style={styles.times}
                />
              )}
            </View>
          );
        })}
      </Card>

      {/* Why workouts aren't here. Said out loud rather than left as a gap. */}
      <Card padding="lg" style={styles.excludeCard}>
        <View style={styles.noticeRow}>
          <Ionicons name="barbell-outline" size={18} color={colors.textTertiary} />
          <AppText variant="footnote" color="tertiary" style={styles.flex}>
            Workouts are never logged this way. A session has sets, weights and a
            duration — a button on a lock screen would only be guessing at them,
            so training still asks you to open the app.
          </AppText>
        </View>
      </Card>

      {/* Habits: a directory to the real editor, not a second copy of it. */}
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        Habit reminders
      </AppText>
      {views.filter((v) => v.habit.source === "manual").length > 0 ? (
        <>
          <ListGroup>
            {views
              .filter((v) => v.habit.source === "manual")
              .map((v) => (
                <ListRow
                  key={v.habit.id}
                  icon={v.habit.icon as never}
                  tone={v.habit.color}
                  title={v.habit.name}
                  subtitle={
                    v.habit.reminder
                      ? `${formatTime(v.habit.reminder.hour, v.habit.reminder.minute)} · ${frequencyLabel(v.habit.days, v.habit.weeklyGoal)}`
                      : "No reminder"
                  }
                  onPress={() => router.push(`/habit/new?id=${v.habit.id}` as never)}
                />
              ))}
          </ListGroup>
          <AppText variant="caption" color="tertiary" style={styles.footNote}>
            Habit reminders carry a &ldquo;Mark as Done&rdquo; button — same one
            tap, same no-need-to-open-the-app.
          </AppText>
        </>
      ) : (
        <Card padding="lg">
          <AppText variant="footnote" color="tertiary">
            Habits you create can carry their own reminder, set on the habit
            itself.
          </AppText>
          <Pressable
            onPress={() => router.push("/(tabs)/habits" as never)}
            accessibilityRole="button"
            accessibilityLabel="Go to Habits"
            style={styles.linkRow}
          >
            <AppText variant="footnote" color="brand" style={styles.link}>
              Go to Habits
            </AppText>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  heroCard: { marginTop: Spacing.sm },
  heroBlurb: { marginTop: Spacing.sm, lineHeight: 21 },
  preview: { marginTop: Spacing.lg },

  noticeCard: { marginTop: Spacing.lg, borderWidth: 1 },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  noticeBtn: { marginTop: Spacing.lg },

  sectionLabel: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },

  masterRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

  slotsCard: { marginTop: Spacing.sm },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  times: { marginBottom: Spacing.md },

  excludeCard: { marginTop: Spacing.lg },

  footNote: { marginTop: Spacing.sm, marginLeft: Spacing.xs },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  link: { fontWeight: "600" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 30, alignItems: "flex-start" },
});
