/**
 * The notifications that are NOT finished from the lock screen, and why.
 *
 *   · COACHING — what Gozlin sends on its own: the morning briefing and the
 *     occasional timely nudge, inside quiet hours and a daily limit. The same
 *     switch as the Trust screen (one consent, two doors), so the two can never
 *     disagree.
 *   · WORKOUTS — training-day reminders live with the rest of the fitness
 *     settings. A session is sets, weights and minutes; a lock-screen button
 *     would be guessing at all three, so a workout reminder opens the app — and
 *     the card says so rather than leaving a gap to wonder about.
 */
import { useNotificationSettings } from "@/components/notifications/useNotifications";
import { AppText, Card, IconBadge, Stepper, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { formatTime } from "@/services/notifications/mealReminders";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import type { FitnessReminderSummary } from "./useNotificationCenter";

/** "22:00" → "10:00 PM". Falls back to the raw value if it doesn't parse. */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? formatTime(h, m) : hhmm;
}

export function CoachingCard({ blocked }: { blocked: boolean }) {
  const { colors } = useColors();
  const notif = useNotificationSettings();
  const on = !!notif.prefs?.enabled;
  const budget = notif.prefs?.dailyBudget ?? 3;
  const unavailable = notif.status?.permission === "unavailable";

  return (
    <Card padding="lg">
      <View style={styles.head}>
        <IconBadge name="sparkles" tone={on ? colors.gold : colors.textTertiary} size={42} />
        <View style={styles.flex}>
          <AppText variant="bodyLg" weight="700">
            Coaching from Gozlin
          </AppText>
          <AppText variant="footnote" color="tertiary" style={styles.status}>
            {on
              ? `A morning briefing and timely nudges · at most ${budget} a day`
              : "Off — Gozlin only speaks when you open it"}
          </AppText>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => void (v ? notif.enable() : notif.disable())}
          disabled={notif.loading || unavailable || (blocked && !on)}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Coaching notifications"
        />
      </View>

      {on && notif.prefs ? (
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <Ionicons name="moon-outline" size={16} color={colors.textTertiary} />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              Quiet hours
            </AppText>
            <AppText variant="footnote" weight="600">
              {clock(notif.prefs.quietStart)} – {clock(notif.prefs.quietEnd)}
            </AppText>
          </View>
          <View style={styles.controlRow}>
            <Ionicons name="options-outline" size={16} color={colors.textTertiary} />
            <AppText variant="footnote" color="secondary" style={styles.flex}>
              Most in a day
            </AppText>
            <Stepper
              label="Most coaching notifications in a day"
              value={String(budget)}
              onDecrement={() => void notif.setDailyBudget(Math.max(1, budget - 1))}
              onIncrement={() => void notif.setDailyBudget(Math.min(6, budget + 1))}
              canDecrement={budget > 1}
              canIncrement={budget < 6}
            />
          </View>
          <AppText variant="caption" color="tertiary" style={styles.note}>
            Reminders you set yourself are never held back by these — they arrive
            when you asked.
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WorkoutsCard({ fitness }: { fitness: FitnessReminderSummary }) {
  const { colors } = useColors();
  const p = fitness.prefs;
  const parts: string[] = [];
  if (p?.workouts) {
    const days = fitness.days.length
      ? fitness.days.map((d) => DAY_SHORT[d] ?? "").filter(Boolean).join(", ")
      : "no training days set";
    parts.push(`Training days (${days}) at ${formatTime(p.hour ?? 17, 0)}`);
  }
  if (p?.hydration) parts.push("midday hydration check");
  if (p?.stretch) parts.push("evening stretch");
  if (p?.weeklySummary) parts.push("Sunday week in review");
  const status = parts.length
    ? parts.join(" · ")
    : "Off — training-day reminders, hydration and stretch nudges";

  return (
    <Card padding="lg">
      <Pressable
        onPress={() => router.push("/fitness/settings" as never)}
        accessibilityRole="button"
        accessibilityLabel="Workout reminders"
        accessibilityHint="Opens fitness settings"
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <IconBadge
          name="barbell"
          tone={parts.length ? colors.primary : colors.textTertiary}
          size={42}
        />
        <View style={styles.flex}>
          <AppText variant="bodyLg" weight="700">
            Workouts
          </AppText>
          <AppText variant="footnote" color="tertiary" style={styles.status}>
            {status}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </Pressable>
      <View style={styles.why}>
        <Ionicons name="information-circle-outline" size={15} color={colors.textTertiary} />
        <AppText variant="caption" color="tertiary" style={styles.flex}>
          A session has sets, weights and a duration — a lock-screen button would
          only be guessing at them, so workout reminders open the app. The
          hydration check does carry the glass button.
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  head: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  status: { marginTop: 2, lineHeight: 17 },
  controls: { marginTop: Spacing.lg, gap: Spacing.md },
  controlRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  note: { lineHeight: 17 },
  why: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
