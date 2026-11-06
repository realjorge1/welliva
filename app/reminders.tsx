/**
 * NOTIFICATIONS — every notification welliva can send, in one place, and the
 * proof that they work.
 *
 * (The route is still `/reminders`: every existing link keeps working.)
 *
 * ── THE PRODUCT IDEA ────────────────────────────────────────────────────────
 * Logging costs four taps and a context switch: unlock, find the app, find the
 * day, find the thing, tick it. That is not much, and it is enough to lose. The
 * reminders on this screen turn it into one tap on a lock screen: at a time the
 * USER picked, a notification names the habit, the meal or the glass, and a
 * single button records it — the app never has to open, and the write lands in
 * the same stores (and the same streaks, rings and Gozlin memory) as a tap in
 * the app would. See services/notifications/pipeline.
 *
 * ── RULES THIS SCREEN EXISTS TO ENFORCE ─────────────────────────────────────
 *   1. THE APP NEVER PICKS A TIME. Everything starts off.
 *   2. PERMISSION IS EARNED FIRST. The OS prompt can be shown once; the hero
 *      shows the exact banner, button and all, before it appears.
 *   3. NOTHING IS CLAIMED THAT ISN'T TRUE. "Lined up" and "up next" are counted
 *      off the OS queue, not off settings; the lock-screen receipts show every
 *      press, including the ones that could not be counted.
 *   4. WORKOUTS ARE NEVER LOGGED FROM A BUTTON — and the screen says why.
 */
import {
  LockScreenJournalCard,
  UpNextCard,
} from "@/components/notifications/center/ActivityCards";
import { CoachingCard, WorkoutsCard } from "@/components/notifications/center/MoreCards";
import {
  OnTimeCard,
  useExactAlarmStatus,
} from "@/components/notifications/center/OnTimeCard";
import { PauseCard } from "@/components/notifications/center/PauseCard";
import {
  HabitRemindersCard,
  MealRemindersCard,
  WaterRemindersCard,
} from "@/components/notifications/center/ReminderCards";
import { StatusHero } from "@/components/notifications/center/StatusHero";
import { useNotificationCenter } from "@/components/notifications/center/useNotificationCenter";
import { GozlinToast, useToast } from "@/components/gozlin/GozlinToast";
import { ReminderMoveCard } from "@/components/smart/ReminderMoveCard";
import { useReceipts } from "@/components/smart/receipt";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReminderMoveActions, useReminderMoves } from "@/components/smart/useReminderMoves";
import { useSmartMoment } from "@/components/smart/useSmartMoment";
import type { MoveTarget } from "@/services/smart";
import { AppText, Reveal, Screen, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useHabits } from "@/contexts/HabitsContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useColors();
  const center = useNotificationCenter();
  const exact = useExactAlarmStatus();
  const { views } = useHabits();
  const { permission } = center;

  // Reminders that move themselves (services/smart): any habit, meal slot or
  // first water check-in whose time is far from when the thing actually
  // happens. At most one is offered, above the card it belongs to.
  const moves = useReminderMoves({
    meals: center.loaded ? center.meals : null,
    water: center.loaded ? center.water : null,
  });
  const offer = useSmartMoment("reminders", moves);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const show = useReceipts(toast);
  const { move, keep } = useReminderMoveActions({
    show,
    meals: center.meals,
    water: center.water,
    applyMeals: center.applyMeals,
    applyWater: center.applyWater,
  });
  const offerFor = (kind: MoveTarget["kind"]) =>
    offer && offer.target.kind === kind ? (
      <ReminderMoveCard move={offer} where="list" onMove={move} onKeep={keep} style={styles.offer} />
    ) : null;

  const blocked = permission.status === "denied" || permission.status === "unavailable";

  /**
   * Turning something on asks first — and a refusal leaves the switch off. A
   * switch reading "on" over a queue the OS will never deliver is the one
   * outcome this screen must not produce.
   */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permission.status === "granted") return true;
    const result = await permission.request();
    if (result === "granted") return true;
    if (result === "denied") {
      Alert.alert(
        "Notifications are off",
        "Turn on notifications for welliva in your device settings, then come back.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: permission.openSystemSettings },
        ],
      );
    }
    return false;
  }, [permission]);

  const mealPending = center.queue.filter((q) => q.kind === "meal").length;

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/(tabs)/settings" as never)
        }
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <View style={styles.flex}>
        <AppText variant="title">Notifications</AppText>
        <AppText variant="footnote" color="tertiary">
          Reminders you can finish without opening the app
        </AppText>
      </View>
    </View>
  );

  return (
    <>
    <Screen header={header}>
      <Reveal index={0}>
        <StatusHero center={center} exact={exact} />
        {/* Asked only when it would change something: Android, allowed, a
            reminder actually pending, and timing not yet exact. */}
        {permission.status === "granted" &&
        !center.paused &&
        exact === "inexact" &&
        center.queue.length > 0 ? (
          <OnTimeCard />
        ) : null}
        {/* One switch for all of it. Only offered once notifications are
            allowed — before that there is nothing to pause. */}
        {permission.status === "granted" ? (
          <PauseCard
            paused={center.paused}
            onChange={(v) => void center.setPaused(v)}
            disabled={!center.loaded}
          />
        ) : null}
      </Reveal>

      <Reveal index={1} stagger={45}>
        <Section
          label="Finish from the lock screen"
          hint="One tap on the notification logs it — streaks and rings update straight away"
        />
        {offerFor("habit")}
        <HabitRemindersCard views={views} blocked={blocked} />
        {offerFor("meal")}
        <MealRemindersCard
          settings={center.meals}
          pending={mealPending}
          blocked={blocked}
          paused={center.paused}
          loaded={center.loaded}
          ensurePermission={ensurePermission}
          apply={center.applyMeals}
        />
        {offerFor("water")}
        <WaterRemindersCard
          settings={center.water}
          blocked={blocked}
          paused={center.paused}
          loaded={center.loaded}
          ensurePermission={ensurePermission}
          apply={center.applyWater}
        />
      </Reveal>

      <Reveal index={2} stagger={45}>
        <Section label="Up next" hint="Read from this phone's notification queue" />
        <View style={styles.gap} />
        <UpNextCard queue={center.queue} />
      </Reveal>

      <Reveal index={3} stagger={45}>
        <Section label="From your lock screen" hint="Every press, and where it was logged" />
        <View style={styles.gap} />
        <LockScreenJournalCard journal={center.journal} />
      </Reveal>

      <Reveal index={4} stagger={45}>
        <Section label="Also from welliva" />
        <View style={styles.gap} />
        <CoachingCard blocked={blocked} paused={center.paused} />
        <View style={styles.gap} />
        <WorkoutsCard
          fitness={center.fitness}
          waterCheckIns={center.water.enabled && center.water.times.length > 0}
        />
      </Reveal>

      {permission.status === "granted" ? (
        <Pressable
          onPress={permission.openSystemSettings}
          accessibilityRole="button"
          accessibilityLabel="Open notification settings for welliva"
          style={styles.osLink}
        >
          <Ionicons name="settings-outline" size={14} color={colors.textTertiary} />
          <AppText variant="caption" color="tertiary" style={styles.flex}>
            {Platform.OS === "android"
              ? "Sound, vibration and pop-up style for “Reminders” and “Coaching from Gozlin” live in your phone's settings."
              : "Sounds, banners and lock-screen previews live in your iPhone's settings."}
          </AppText>
          <Ionicons name="open-outline" size={14} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </Screen>
    {/* Outside the scroll region, so it floats over the page, not its end. */}
    <GozlinToast controller={toast} topOffset={insets.top} />
    </>
  );
}

function Section({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color="tertiary" uppercase style={styles.sectionLabel}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" color="tertiary" style={styles.sectionHint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 30, alignItems: "flex-start" },
  section: { marginTop: Spacing.xxl, marginBottom: Spacing.xs, marginLeft: Spacing.xs },
  sectionLabel: { letterSpacing: 0.6 },
  sectionHint: { marginTop: 2 },
  gap: { height: Spacing.md },
  // The category cards space themselves from the top; so does the offer.
  offer: { marginTop: Spacing.md },
  osLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
    marginHorizontal: Spacing.xs,
  },
});
