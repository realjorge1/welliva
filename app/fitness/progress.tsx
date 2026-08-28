/**
 * FITNESS PROGRESS — the training story in numbers.
 *
 * Weekly goal ring, streak, lifetime totals, 8-week consistency bars,
 * personal bests and the optional body-weight trend. All figures derive from
 * the app's SSOT collections via the pure ProgressService.
 */

import {
  TrendCard,
  buildSessionVolume,
  buildWeeklyMinutes,
  buildWeightTrend,
  type TrendSeries,
} from "@/components/charts";
import {
  AnimatedNumber,
  AppText,
  Card,
  IconBadge,
  ListGroup,
  ListRow,
  ProgressBar,
  Screen,
  SectionHeader,
  useColors,
} from "@/components/ui";
import { useAuth } from "@/components/SupabaseAuthProvider";
import { Ease } from "@/components/motion/motion";
import { useIntroReveal } from "@/components/motion/IntroReveal";
import { Gradients, Motion, Radius, Spacing, alpha } from "@/constants/theme";
import { useApp } from "@/contexts/AppContext";
import { useBilling } from "@/contexts/BillingContext";
import { isHistoryRangeLocked } from "@/services/billing";
import { ProgressPhotosCard } from "@/fitness/components/ProgressPhotos";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import { buildProgressSnapshot, weekStartOf } from "@/fitness/services/ProgressService";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** Height of the week chart's tallest bar. */
const BAR_H = 84;

interface DayActivity {
  date: string;
  letter: string;
  name: string;
  minutes: number;
  trained: boolean;
  isToday: boolean;
  future: boolean;
}

interface StatFigure {
  label: string;
  tone: string;
  value: number;
  unit?: string;
  format?: (n: number) => string;
}

/** 12480 → "12,480". Hand-rolled so it can't depend on Intl being present. */
const grouped = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * One day of the week chart: a sunken track that fills from the bottom with the
 * brand ramp, in proportion to the minutes trained. Bars grow in sequence on a
 * cold-start reveal (UI thread), so the week draws itself left to right.
 */
function DayBar({ day, index, peak }: { day: DayActivity; index: number; peak: number }) {
  const { colors, isDark } = useColors();
  const reduced = useReducedMotion();
  const intro = useIntroReveal();
  // A trained day never draws thinner than a visible stub, however short it was.
  const target = day.minutes > 0 ? Math.max(0.14, Math.min(1, day.minutes / peak)) : 0;

  const h = useSharedValue(reduced || !intro ? target : 0);
  useEffect(() => {
    h.value = reduced
      ? target
      : withDelay(
          index * 60,
          withTiming(target, { duration: Motion.duration.hero, easing: Ease.decelerate }),
        );
  }, [target, index, reduced, h]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));

  return (
    <View
      style={styles.dayCol}
      accessible
      accessibilityLabel={
        day.trained ? `${day.name}: ${day.minutes} minutes trained` : `${day.name}: rest`
      }
    >
      <View
        style={[
          styles.dayTrack,
          {
            backgroundColor: isDark ? alpha(colors.text, 0.07) : colors.surfaceSunken,
            opacity: day.future ? 0.55 : 1,
          },
        ]}
      >
        <Animated.View style={[styles.dayFill, fillStyle]}>
          <LinearGradient
            colors={[...colors.brandGradient]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <AppText variant="caption" color={day.isToday ? "brand" : "tertiary"}>
        {day.letter}
      </AppText>
      <View
        style={[
          styles.dayDot,
          day.isToday && { backgroundColor: colors.primary },
        ]}
      />
    </View>
  );
}

export default function FitnessProgressScreen() {
  const { colors } = useColors();
  const app = useApp();
  const { profile } = useFitnessProfile();
  // Progress photos are owner-scoped in Storage, so the gallery needs the uid.
  const { user } = useAuth();

  const snapshot = useMemo(
    () =>
      buildProgressSnapshot({
        workoutLog: app.workoutLog,
        sessionHistory: app.sessionHistory,
        today: app.currentDate,
        weeklyTargetDays: profile.daysAvailable.length || 3,
      }),
    [app.workoutLog, app.sessionHistory, app.currentDate, profile.daysAvailable.length],
  );

  const today = app.currentDate;
  const { tier, openUpgrade } = useBilling();
  const lockedBeyondFree = useCallback(
    (rangeDays: number) => isHistoryRangeLocked(rangeDays, tier),
    [tier],
  );

  // Scrubbable trend series — the training story you can drag through.
  // The shortest tab of each card is always free (see isHistoryRangeLocked);
  // the wider ones are what a paid tier buys.
  const minuteSeries = useMemo<TrendSeries[]>(
    () => [
      { key: "8W", label: "8 wk", points: buildWeeklyMinutes(app.workoutLog, today, 8) },
      {
        key: "16W",
        label: "16 wk",
        points: buildWeeklyMinutes(app.workoutLog, today, 16),
        locked: lockedBeyondFree(16 * 7),
      },
      {
        key: "6M",
        label: "6 mo",
        points: buildWeeklyMinutes(app.workoutLog, today, 26),
        locked: lockedBeyondFree(26 * 7),
      },
    ],
    [app.workoutLog, today, lockedBeyondFree],
  );

  // Session volume is counted in SESSIONS, not days — "last 25" is not a date
  // window, so the history cutoff doesn't apply and both tabs stay free.
  const volumeSeries = useMemo<TrendSeries[]>(
    () => [
      { key: "10", label: "Last 10", points: buildSessionVolume(app.sessionHistory, 10) },
      { key: "25", label: "Last 25", points: buildSessionVolume(app.sessionHistory, 25) },
    ],
    [app.sessionHistory],
  );

  const weightSeries = useMemo<TrendSeries[]>(
    () => [
      { key: "1M", label: "1 mo", points: buildWeightTrend(app.bodyLogs, today, 30) },
      {
        key: "3M",
        label: "3 mo",
        points: buildWeightTrend(app.bodyLogs, today, 90),
        locked: lockedBeyondFree(90),
      },
      {
        key: "1Y",
        label: "1 yr",
        points: buildWeightTrend(app.bodyLogs, today, 365),
        locked: lockedBeyondFree(365),
      },
    ],
    [app.bodyLogs, today, lockedBeyondFree],
  );

  const latestWeight = app.bodyLogs.length > 0 ? app.bodyLogs[app.bodyLogs.length - 1] : null;
  const firstWeight = app.bodyLogs.length > 1 ? app.bodyLogs[0] : null;
  const weightDelta =
    latestWeight && firstWeight ? latestWeight.weightKg - firstWeight.weightKg : null;

  const target = profile.daysAvailable.length || 3;

  // The four lifetime/period numbers, as a card-less spec sheet: a colour-keyed
  // label over one big tabular figure. No tiles, no badges — the numbers carry
  // themselves, which is what makes a stats block read as considered.
  const stats: StatFigure[] = [
    { label: "Total workouts", tone: colors.primary, value: snapshot.totalWorkouts },
    { label: "Calories burned", tone: colors.calories, value: snapshot.totalCalories, format: grouped },
    { label: "This week", tone: colors.water, value: snapshot.thisWeekMinutes, unit: "min" },
    { label: "This month", tone: colors.gold, value: snapshot.thisMonthMinutes, unit: "min" },
  ];

  const bests = [
    { icon: "hourglass-outline", tone: colors.primary, label: "Longest session", value: `${snapshot.personalBests.longestSessionMin} min` },
    { icon: "repeat-outline", tone: colors.protein, label: "Most reps in a session", value: `${snapshot.personalBests.mostRepsInSession}` },
    { icon: "podium-outline", tone: colors.gold, label: "Best week", value: `${snapshot.personalBests.bestWeekWorkouts} workouts` },
    { icon: "flame-outline", tone: colors.calories, label: "Longest streak", value: `${snapshot.personalBests.longestStreakDays} days` },
  ] as const;

  // Lifetime line under the title — the page should say what it's about before
  // any chart loads.
  const lifetime =
    snapshot.totalMinutes >= 60
      ? `${Math.round(snapshot.totalMinutes / 60)} h moved`
      : `${snapshot.totalMinutes} min moved`;
  const headerSub =
    snapshot.totalWorkouts > 0
      ? `${snapshot.totalWorkouts} session${snapshot.totalWorkouts === 1 ? "" : "s"} · ${lifetime}`
      : "Your first session starts the story";

  const remaining = Math.max(0, target - snapshot.thisWeekWorkouts);
  const goalPct = Math.round(snapshot.weeklyGoalProgress * 100);

  // The seven days of the current week, each with the minutes actually logged
  // on it — the shape of the week is the thing a "this week" hero should show,
  // and no single dial can say WHICH days you trained.
  const weekDays = useMemo<DayActivity[]>(() => {
    const start = weekStartOf(today);
    const base = new Date(`${start}T00:00:00`);
    return DAY_LETTERS.map((letter, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
      const logs = app.workoutLog.filter((l) => l.date === date);
      return {
        date,
        letter,
        name: DAY_NAMES[i],
        minutes: logs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
        trained: logs.length > 0,
        isToday: date === today,
        future: date > today,
      };
    });
  }, [app.workoutLog, today]);

  // Scale the bars against the week's own peak, with a floor so one short
  // session doesn't read as a full day.
  const weekPeak = Math.max(30, ...weekDays.map((d) => d.minutes));

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
          <View style={styles.flex}>
            <AppText variant="display">Progress</AppText>
            <AppText variant="footnote" color="tertiary" numberOfLines={1}>
              {headerSub}
            </AppText>
          </View>
        </View>
      }
    >
      {/* This week — the count you're chasing, next to the SHAPE of the week.
          (The old tachometer is gone: a fake instrument dial told you one number
          in the most decorative way possible. This says the same number in type,
          then spends the space on something a dial can't do — which days you
          actually trained, and how long.) */}
      <View style={styles.section}>
        <SectionHeader
          title="This week"
          subtitle={
            snapshot.thisWeekWorkouts >= target
              ? "Weekly goal complete — outstanding."
              : `${remaining} more ${remaining === 1 ? "workout" : "workouts"} to hit your goal`
          }
          weight="700"
        />

        <View style={styles.weekHero}>
          <View style={styles.weekFigure}>
            <View style={styles.weekCount}>
              <AnimatedNumber
                value={snapshot.thisWeekWorkouts}
                variant="displayLg"
                style={styles.weekBig}
              />
              <AppText variant="title" color="tertiary" style={styles.weekOf}>
                /{target}
              </AppText>
            </View>
            <AppText variant="caption" color="tertiary" uppercase>
              {snapshot.thisWeekWorkouts === 1 ? "workout" : "workouts"}
            </AppText>
            {snapshot.currentStreakDays > 0 && (
              <View
                style={[styles.streakChip, { backgroundColor: alpha(colors.calories, 0.14) }]}
              >
                <Ionicons name="flame" size={12} color={colors.calories} />
                <AppText variant="caption" color={colors.calories} numberOfLines={1}>
                  {snapshot.currentStreakDays}-day streak
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.weekChart}>
            {weekDays.map((d, i) => (
              <DayBar key={d.date} day={d} index={i} peak={weekPeak} />
            ))}
          </View>
        </View>

        <ProgressBar
          progress={snapshot.weeklyGoalProgress}
          gradient={colors.brandGradient}
          height={6}
          style={styles.weekTrack}
        />
        <View style={styles.weekFoot}>
          <AppText variant="footnote" color="tertiary">
            {snapshot.thisWeekMinutes} min active
          </AppText>
          <AppText variant="footnote" color="tertiary">
            {goalPct}% of weekly goal
          </AppText>
        </View>
      </View>

      {/* Key numbers — CARD-LESS spec sheet: dot-keyed labels over big tabular
          figures, two per row, a single hairline between the rows. */}
      <View style={styles.section}>
        {[stats.slice(0, 2), stats.slice(2, 4)].map((row, r) => (
          <React.Fragment key={r}>
            {r > 0 && <View style={[styles.figureRule, { backgroundColor: colors.divider }]} />}
            <View style={styles.figureRow}>
              {row.map((stat) => (
                <View key={stat.label} style={styles.figureCell}>
                  <View style={styles.figureHead}>
                    <View style={[styles.figureDot, { backgroundColor: stat.tone }]} />
                    <AppText variant="caption" color="tertiary" uppercase numberOfLines={1}>
                      {stat.label}
                    </AppText>
                  </View>
                  <View style={styles.figureValue}>
                    <AnimatedNumber
                      value={stat.value}
                      variant="title"
                      format={stat.format}
                      style={styles.figureNum}
                    />
                    {!!stat.unit && (
                      <AppText variant="footnote" color="tertiary">
                        {stat.unit}
                      </AppText>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Training load — scrub any week of active minutes */}
      <View style={styles.block}>
        <TrendCard
          title="Training load"
          icon="pulse"
          unit="min"
          gradient={colors.brandGradient}
          series={minuteSeries}
          initialRangeKey="8W"
          footnote="Active minutes per week — drag across to inspect any week."
          onLockedRangePress={() => openUpgrade("history")}
        />
      </View>

      {/* Personal bests — the records, in the app's standard row language. */}
      <View style={styles.section}>
        <SectionHeader title="Personal bests" subtitle="Your ceiling so far" weight="700" />
        <ListGroup>
          {bests.map((b) => (
            <ListRow key={b.label} icon={b.icon} tone={b.tone} title={b.label} value={b.value} />
          ))}
        </ListGroup>
      </View>

      {/* Session volume — reps completed per session */}
      <View style={styles.block}>
        <TrendCard
          title="Session volume"
          icon="repeat"
          unit="reps"
          gradient={Gradients.protein}
          series={volumeSeries}
          initialRangeKey="10"
          footnote="Total reps per session — your effort, session over session."
          emptyHint="Finish a few sessions and your volume trend appears here."
        />
      </View>

      {/* Body trend — a scrubbable weight line once there are enough weigh-ins */}
      {app.bodyLogs.length >= 2 ? (
        <View style={styles.block}>
          <TrendCard
            title="Body weight"
            icon="scale-outline"
            unit="kg"
            gradient={Gradients.water}
            series={weightSeries}
            initialRangeKey="3M"
            format={(v) => v.toFixed(1)}
            neutralDelta
            footnote="Every logged weigh-in. The trend beats any single number."
            onLockedRangePress={() => openUpgrade("history")}
          />
        </View>
      ) : latestWeight ? (
        <Card style={styles.block} padding="lg">
          <View style={styles.weightRow}>
            <IconBadge name="scale-outline" tone={colors.water} size={40} />
            <View style={styles.flex}>
              <AppText variant="callout">Body weight</AppText>
              <AppText variant="footnote" color="tertiary">
                Last logged {latestWeight.date}
              </AppText>
            </View>
            <View style={styles.weightNums}>
              <AppText variant="headline">{latestWeight.weightKg.toFixed(1)} kg</AppText>
              {weightDelta !== null && Math.abs(weightDelta) >= 0.1 && (
                <AppText
                  variant="footnote"
                  color={weightDelta < 0 ? "success" : "secondary"}
                >
                  {weightDelta > 0 ? "+" : ""}
                  {weightDelta.toFixed(1)} kg overall
                </AppText>
              )}
            </View>
          </View>
        </Card>
      ) : null}

      {/* Progress photos — the change the numbers can't show */}
      <ProgressPhotosCard userId={user?.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },
  /** A card-less section: content on the page, separated by air alone. */
  section: { marginBottom: Spacing.xxxl },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  // This-week hero
  weekHero: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xl,
    marginTop: Spacing.xs,
  },
  weekFigure: { alignItems: "flex-start", paddingBottom: 2 },
  weekCount: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  weekBig: { fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -1 },
  weekOf: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },
  weekChart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  dayCol: { flex: 1, alignItems: "center", gap: 6 },
  dayTrack: {
    width: "100%",
    maxWidth: 22,
    height: BAR_H,
    borderRadius: Radius.sm,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  dayFill: { width: "100%", overflow: "hidden" },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent" },
  weekTrack: { marginTop: Spacing.xl },
  weekFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },

  // Key numbers (card-less spec sheet)
  figureRow: { flexDirection: "row", alignItems: "flex-start" },
  figureCell: { flex: 1, gap: Spacing.xs, paddingVertical: Spacing.lg },
  figureHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  figureDot: { width: 7, height: 7, borderRadius: 4 },
  figureValue: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  figureNum: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  figureRule: { height: StyleSheet.hairlineWidth },

  weightRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  weightNums: { alignItems: "flex-end" },
});
