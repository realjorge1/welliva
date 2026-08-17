/**
 * HOME — the daily dashboard.
 * Hero nutrition ring, today's plan, a card-less streak strip, a redesigned
 * hydration hero and a coaching carousel — all on the Welliva design system.
 */

import WaterTracker from "@/components/WaterTracker";
import {
  AnimatedNumber,
  AppText,
  AscendingMeter,
  Card,
  IconBadge,
  Pill,
  ProgressBar,
  Reveal,
  Ring,
  Screen,
  SectionHeader,
  useColors,
} from "@/components/ui";
import { GozlinButton, useGozlinMoments, useHabitReport } from "@/components/gozlin";
import { ScreenTopBar } from "@/components/navigation";
import { SyncStatusPill } from "@/components/sync/SyncStatusPill";
import { CrashTrigger, ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { CoachDeepDive } from "@/components/home/CoachDeepDive";
import { buildCoachDeck, buildHabitCard, type CoachCard } from "@/components/home/coachDeck";
import { Gradients, Radius, Spacing, alpha } from "@/constants/theme";
import { useGamification, useNutrition, useProfile, useWorkout } from "@/contexts/AppContext";
import { calculateProgress } from "@/services/NutritionService";
import { todayDate } from "@/services/OfflineStorage";
import { getMotivationalMessage } from "@/services/StreakService";
import { nextHomeGreeting } from "@/constants/HomeGreetings";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

/** How far the coach carousel slides left to reveal the next card on hint. */
const COACH_PEEK = 54;

export default function HomeScreen() {
  const { colors } = useColors();
  const { width } = useWindowDimensions();
  const { nutritionTargets } = useProfile();
  const { consumedNutrition, todayDiet, coachInsights } = useNutrition();
  const { streakData } = useGamification();
  const { workoutPlan, workoutLog } = useWorkout();

  const { top: gozlinMoment } = useGozlinMoments("home");

  // Habit Awareness report powers the extra "habits" coach card + the deep-dive.
  const habitReport = useHabitReport();
  const habitCard = useMemo(() => buildHabitCard(habitReport), [habitReport]);

  // The full coach deck — distinct cards (adaptive insights + Gozlin's habit
  // card), capped at 4; more appear as the user logs more.
  const coachDeck = useMemo<CoachCard[]>(
    () => buildCoachDeck(coachInsights, habitCard),
    [coachInsights, habitCard],
  );

  // The tapped card that opens the coach deep-dive.
  const [selectedCard, setSelectedCard] = useState<CoachCard | null>(null);

  const motivation = useMemo(
    () => getMotivationalMessage(streakData),
    [streakData],
  );

  const todayWorkout = useMemo(() => {
    if (!workoutPlan) return null;
    const d = new Date().getDay();
    const dayIndex = d === 0 ? 6 : d - 1;
    return workoutPlan.sessions.find((s) => s.dayOfWeek === dayIndex) || null;
  }, [workoutPlan]);

  const todayWorkoutDone = useMemo(() => {
    const todayStr = todayDate();
    return workoutLog.some((l) => l.date === todayStr);
  }, [workoutLog]);

  // Rotating time-of-day greeting, picked fresh on each app open. A greeting
  // never repeats until the other 29 in its day-part bucket have been shown.
  const [headline, setHeadline] = useState("Welcome back");
  useEffect(() => {
    let active = true;
    nextHomeGreeting().then((g) => {
      if (active) setHeadline(g);
    });
    return () => {
      active = false;
    };
  }, []);

  // Coach carousel "peek" hint — when the section scrolls into view, the track
  // slides to reveal a neighbouring card, then snaps back with an elastic band.
  // It slides left to reveal the *next* card, unless the carousel is already at
  // its right end (where sliding left would only bare an empty wall) — there it
  // slides right instead, drawing the eye back to the *previous* card.
  const coachTranslate = useRef(new Animated.Value(0)).current;
  const coachArmed = useRef(true);
  const canHintCoach = coachDeck.length >= 2;

  // Live horizontal geometry of the carousel, so the hint knows which side
  // still has a hidden card to reveal.
  const coachScrollX = useRef(0);
  const coachViewportW = useRef(0);
  const coachContentW = useRef(0);

  const runCoachHint = useCallback(() => {
    const maxX = Math.max(0, coachContentW.current - coachViewportW.current);
    // At (or past) the right end, peek right to reveal the previous card;
    // otherwise peek left to reveal the next one.
    const atEnd = maxX > 1 && coachScrollX.current >= maxX - 4;
    const peek = atEnd ? COACH_PEEK : -COACH_PEEK;
    Animated.sequence([
      Animated.timing(coachTranslate, {
        toValue: peek,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Low friction → overshoots past rest and settles: the rubber-band snap.
      Animated.spring(coachTranslate, {
        toValue: 0,
        friction: 4.5,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [coachTranslate]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!canHintCoach) return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // The coach carousel is the last section, so "reached the bottom of the
      // scroll" is the moment it's fully in view — fire the peek hint there.
      const distanceToBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (coachArmed.current && distanceToBottom <= 24) {
        coachArmed.current = false;
        runCoachHint();
      } else if (!coachArmed.current && distanceToBottom > 140) {
        // Scrolled well back up from the bottom — re-arm so it replays next time.
        coachArmed.current = true;
      }
    },
    [canHintCoach, runCoachHint],
  );

  // Track where the carousel is parked so the peek always leans toward content.
  const onCoachScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      coachScrollX.current = e.nativeEvent.contentOffset.x;
    },
    [],
  );

  const calorieTarget = nutritionTargets?.calories || 2000;
  const caloriePct = nutritionTargets
    ? calculateProgress(consumedNutrition.calories, nutritionTargets.calories)
    : 0;
  const remaining = Math.max(
    0,
    Math.round(calorieTarget - consumedNutrition.calories),
  );

  const macros = [
    {
      key: "protein",
      label: "Protein",
      tone: colors.protein,
      current: consumedNutrition.proteinG,
      target: nutritionTargets?.proteinG || 50,
    },
    {
      key: "carbs",
      label: "Carbs",
      tone: colors.carbs,
      current: consumedNutrition.carbsG,
      target: nutritionTargets?.carbsG || 250,
    },
    {
      key: "fat",
      label: "Fat",
      tone: colors.fat,
      current: consumedNutrition.fatG,
      target: nutritionTargets?.fatG || 65,
    },
  ];

  // ── Today's plan progress (real — from the schedule + logs) ──
  const dietMeals = useMemo(() => {
    const s = todayDiet?.schedule;
    if (!s) return { consumed: 0, total: 0 };
    const meals = [s.breakfast, s.lunch, s.dinner, ...s.snacks].filter(
      (m): m is NonNullable<typeof m> => m != null,
    );
    return { consumed: meals.filter((m) => m.isConsumed).length, total: meals.length };
  }, [todayDiet]);
  const dietProgress = dietMeals.total > 0 ? dietMeals.consumed / dietMeals.total : 0;

  const workoutProgress = useMemo(() => {
    if (todayWorkout?.isRestDay) return 1; // recovery counts as a full day
    if (!todayWorkoutDone) return 0;
    const log = workoutLog.find((l) => l.date === todayDate());
    return Math.min(1, (log?.completionPercent ?? 100) / 100);
  }, [todayWorkout, todayWorkoutDone, workoutLog]);

  // Coach carousel: each card ~82% of the viewport so the next one peeks.
  const coachW = Math.round(width * 0.82);

  const header = (
    <Reveal index={0}>
      <ScreenTopBar
        style={styles.topBar}
        // Home is the ONLY screen with a greeting — everywhere else the top line
        // belongs to the menu button alone.
        greeting={headline}
        // The app name stands in for a screen name here: "Home" would be
        // redundant on the screen you land on.
        title={
          <>
            <AppText variant="subhead" color="brand" style={styles.brand} numberOfLines={1}>
              Welliva
            </AppText>
            {/* Only ever visible when something hasn't reached the cloud. */}
            <SyncStatusPill style={styles.syncPill} />
          </>
        }
        trailing={<GozlinButton prompt={gozlinMoment?.prompt} />}
      />
    </Reveal>
  );

  return (
    <>
      {/* Dev-only: open with ?crash=1 or ?crash=tab:home to verify this
          screen's ErrorBoundary catches without taking the app down. */}
      {__DEV__ && <CrashTrigger surface="tab:home" />}
      {/* `bottomInset`: Home floats nothing over its footer any more — the coach
          button moved into the top bar — so the default nav clearance was just a
          screen-height of dead space under the last card. This is the end of the
          content plus the device's own bottom inset, nothing more. */}
      <Screen gutter={false} header={header} onScroll={onScroll} bottomInset={Spacing.xxl}>
      {/* ── Hero: calories + macros ── */}
      <Reveal index={1}>
        <Card style={styles.gutter} padding="xxl">
          <View style={styles.heroRow}>
            <Ring
              progress={caloriePct / 100}
              size={140}
              strokeWidth={13}
              gradient={Gradients.calories}
            >
              <AnimatedNumber
                value={Math.round(consumedNutrition.calories)}
                variant="metric"
              />
              <AppText variant="caption" color="tertiary" uppercase>
                kcal eaten
              </AppText>
            </Ring>

            <View style={styles.heroInfo}>
              <AppText variant="caption" color="tertiary" uppercase>
                Daily target
              </AppText>
              <AppText
                variant="title"
                style={styles.heroTarget}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {calorieTarget.toLocaleString()}
                <AppText variant="headline" color="tertiary">
                  {" "}
                  kcal
                </AppText>
              </AppText>
              <View style={styles.remainingRow}>
                <IconBadge name="flame-outline" tone={colors.calories} size={30} />
                <View style={styles.flex}>
                  <AppText variant="headline" color="calories">
                    {remaining.toLocaleString()}
                  </AppText>
                  <AppText variant="footnote" color="tertiary">
                    remaining
                  </AppText>
                </View>
              </View>
              <Pill label={`${caloriePct}% of goal`} tone={colors.calories} size="sm" />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Macros */}
          <View style={styles.macroRow}>
            {macros.map((m) => {
              const pct = m.target > 0 ? m.current / m.target : 0;
              return (
                <View key={m.key} style={styles.macroCol}>
                  <View style={styles.macroHead}>
                    <View style={[styles.macroDot, { backgroundColor: m.tone }]} />
                    <AppText variant="footnote" color="secondary">
                      {m.label}
                    </AppText>
                  </View>
                  <AppText variant="headline">
                    {Math.round(m.current)}
                    <AppText variant="footnote" color="tertiary">
                      {" "}
                      / {m.target}g
                    </AppText>
                  </AppText>
                  <ProgressBar
                    progress={pct}
                    tone={m.tone}
                    height={6}
                    style={styles.macroBar}
                  />
                </View>
              );
            })}
          </View>
        </Card>
      </Reveal>

      {/* ── Today's plan (progress meters, real data) ── */}
      <Reveal index={2}>
        <Card style={styles.planCard} padding="lg">
          <View style={styles.planRow}>
            <PlanTile
              label="Workout"
              value={
                todayWorkoutDone
                  ? "Completed"
                  : todayWorkout?.isRestDay
                    ? "Rest day"
                    : todayWorkout
                      ? todayWorkout.focus
                      : "No plan"
              }
              caption={
                todayWorkoutDone
                  ? `${Math.round(workoutProgress * 100)}% complete`
                  : todayWorkout?.isRestDay
                    ? "Recovery counts"
                    : todayWorkout
                      ? `~${todayWorkout.totalDurationMinutes} min`
                      : "Set a plan"
              }
              icon={todayWorkout?.isRestDay ? "bed-outline" : "fitness"}
              tone={
                todayWorkoutDone || todayWorkout?.isRestDay
                  ? colors.success
                  : todayWorkout
                    ? colors.fat
                    : colors.warning
              }
              progress={workoutProgress}
            />
            <View style={[styles.planSep, { backgroundColor: colors.divider }]} />
            <PlanTile
              label="Diet"
              value={
                todayDiet?.hasScheduledDiet && todayDiet.schedule
                  ? todayDiet.schedule.dietName
                  : "Not set"
              }
              caption={
                todayDiet?.hasScheduledDiet
                  ? dietMeals.total > 0
                    ? `${dietMeals.consumed} of ${dietMeals.total} meals`
                    : "Meals ready"
                  : "Add today's meals"
              }
              icon={todayDiet?.hasScheduledDiet ? "restaurant" : "add-circle-outline"}
              tone={todayDiet?.hasScheduledDiet ? colors.protein : colors.warning}
              progress={dietProgress}
            />
          </View>
        </Card>
      </Reveal>

      {/* ── Streak (card-less strip) ── */}
      <Reveal index={3}>
        <View style={[styles.gutter, styles.streakBlock]}>
          <View style={styles.streakStrip}>
            <StreakStat
              icon="flame"
              tone={colors.calories}
              value={streakData.currentStreak}
              label="Day streak"
            />
            <View style={[styles.streakSep, { backgroundColor: colors.border }]} />
            <StreakStat
              icon="trophy"
              tone={colors.gold}
              value={streakData.longestStreak}
              label="Best streak"
            />
            <View style={[styles.streakSep, { backgroundColor: colors.border }]} />
            <StreakStat
              icon="calendar-clear"
              tone={colors.success}
              value={streakData.totalActiveDays}
              label="Active days"
            />
          </View>
          {!!motivation && (
            <AppText
              variant="footnote"
              color="tertiary"
              align="center"
              style={styles.streakMotivation}
              numberOfLines={1}
            >
              {motivation}
            </AppText>
          )}
        </View>
      </Reveal>

      {/* ── Hydration ── */}
      <Reveal index={4}>
        <View style={styles.section}>
          <View style={styles.gutter}>
            <SectionHeader title="Hydration" weight="700" />
          </View>
          <WaterTracker />
        </View>
      </Reveal>

      {/* ── Coach (card-less carousel — tap any card for the deep-dive) ── */}
      {coachDeck.length > 0 && (
        <Reveal index={5}>
          <View style={styles.section}>
            <View style={styles.gutter}>
              <SectionHeader title="Your coach" subtitle="Tap a card for the full picture" weight="700" />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={coachW + Spacing.md}
              snapToAlignment="start"
              contentContainerStyle={styles.coachScroll}
              scrollEventThrottle={32}
              onScroll={onCoachScroll}
              onLayout={(e) => {
                coachViewportW.current = e.nativeEvent.layout.width;
              }}
              onContentSizeChange={(w) => {
                coachContentW.current = w;
              }}
            >
              <Animated.View
                style={[styles.coachTrack, { transform: [{ translateX: coachTranslate }] }]}
              >
                {coachDeck.map((insight) => {
                  const tone =
                    insight.tone === "positive"
                      ? colors.success
                      : insight.tone === "warning"
                        ? colors.warning
                        : colors.primary;
                  return (
                    <CoachCardView
                      key={insight.id}
                      insight={insight}
                      tone={tone}
                      width={coachW}
                      onPress={() => setSelectedCard(insight)}
                    />
                  );
                })}
              </Animated.View>
            </ScrollView>
          </View>
        </Reveal>
      )}
      </Screen>

      <CoachDeepDive
        insight={selectedCard}
        report={habitReport}
        onClose={() => setSelectedCard(null)}
      />
    </>
  );
}

/* ── Local pieces ── */

function PlanTile({
  label,
  value,
  caption,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  progress: number;
}) {
  return (
    <View style={styles.planTile}>
      <View style={styles.planTileHead}>
        <IconBadge name={icon} tone={tone} size={38} />
        <AscendingMeter progress={progress} tone={tone} height={26} />
      </View>
      <AppText variant="caption" color="tertiary" uppercase style={styles.planLabel}>
        {label}
      </AppText>
      <AppText variant="callout" numberOfLines={1} style={styles.planValue}>
        {value}
      </AppText>
      <AppText variant="footnote" color="tertiary" numberOfLines={1} style={styles.planCaption}>
        {caption}
      </AppText>
    </View>
  );
}

function CoachCardView({
  insight,
  tone,
  width,
  onPress,
}: {
  insight: CoachCard;
  tone: string;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.coachCard,
        {
          width,
          backgroundColor: alpha(tone, 0.1),
          borderColor: alpha(tone, 0.22),
        },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.coachHead}>
        <IconBadge name={insight.icon as any} tone={tone} size={40} />
        {insight.isHabit ? (
          <Pill label="Gozlin" tone={colors.primary} size="sm" icon="sparkles" />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        )}
      </View>
      <AppText variant="callout" style={styles.coachTitle} numberOfLines={1}>
        {insight.title}
      </AppText>
      <AppText
        variant="subhead"
        color="secondary"
        style={styles.coachMsg}
        numberOfLines={2}
      >
        {insight.message}
      </AppText>
      <View style={styles.coachFoot}>
        <AppText variant="caption" style={{ color: tone }}>
          View details
        </AppText>
        <Ionicons name="arrow-forward" size={13} color={tone} />
      </View>
    </Pressable>
  );
}

function StreakStat({
  icon,
  tone,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.streakStat}>
      <View style={[styles.streakIcon, { backgroundColor: alpha(tone, 0.14) }]}>
        <Ionicons name={icon} size={17} color={tone} />
      </View>
      <AppText variant="display" style={styles.streakValue}>
        {value}
      </AppText>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { marginHorizontal: Spacing.screen },

  // Header
  topBar: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  brand: { fontWeight: "800", marginTop: 3, letterSpacing: 0.2 },
  syncPill: { marginTop: Spacing.sm },

  // Hero
  heroRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xl },
  heroInfo: { flex: 1, gap: Spacing.sm },
  heroTarget: { marginTop: -2 },
  remainingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  divider: { height: 1, marginVertical: Spacing.xl },
  macroRow: { flexDirection: "row", gap: Spacing.lg },
  macroCol: { flex: 1, gap: 6 },
  macroHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroBar: { marginTop: 2 },

  // Plan
  planCard: { marginHorizontal: Spacing.screen, marginTop: Spacing.xl },
  planRow: { flexDirection: "row", alignItems: "stretch", gap: Spacing.lg },
  planTile: { flex: 1 },
  planSep: { width: 1 },
  planTileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planLabel: { marginTop: Spacing.md },
  planValue: { marginTop: 3 },
  planCaption: { marginTop: 2 },

  // Streak strip
  streakBlock: { marginTop: Spacing.xxxl },
  streakStrip: { flexDirection: "row", alignItems: "center" },
  streakStat: { flex: 1, alignItems: "center", gap: 5 },
  streakIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  streakValue: { fontWeight: "800", marginTop: 2 },
  streakSep: { width: 1, height: 44, opacity: 0.9 },
  streakMotivation: { marginTop: Spacing.lg },

  // Sections
  section: { marginTop: Spacing.xxxl },

  // Coach carousel
  coachScroll: { paddingHorizontal: Spacing.screen },
  coachTrack: { flexDirection: "row", gap: Spacing.md },
  coachCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    minHeight: 150,
  },
  coachHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coachTitle: {},
  coachMsg: { flex: 1 },
  coachFoot: { flexDirection: "row", alignItems: "center", gap: 4 },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:home" />;
}
