/**
 * FITNESS HOME — the training dashboard.
 *
 * The daily launchpad: an explainable "today" recommendation (plan session,
 * library workout or rest), continue-where-you-left-off, recovery status,
 * weekly rhythm, and doorways into the Explore / Progress / Calendar /
 * Settings screens of the fitness module.
 *
 * THE PLAN EXPLAINS ITSELF. Today's session lists each move with the reason it
 * is there and, when its dose moved, why. "How this week was built" lists the
 * inputs that shaped the week; the week rail says why each day trains what it
 * does and lets the user choose their own workouts for any day. There is no
 * "Regenerate": the plan is built from the user's data (services/training), so
 * a reroll would rebuild the same week — what changes it is changing the data.
 *
 * Pro adds the daily layer: on an amber or red recovery day today's session is
 * shown as its lighter version, every change listed, with the full session one
 * tap away. The guided-session launch contract (exerciseIds/sets/reps/rest) is
 * the same one library workouts use.
 */

import {
  AmbientCanvas,
  AppText,
  BatteryGauge,
  Button,
  Card,
  IconBadge,
  ListGroup,
  ListRow,
  NAV_CLEARANCE,
  Pill,
  Reveal,
  SectionHeader,
  useColors,
  useElasticScroll,
} from "@/components/ui";
import { ActivityRings, type ActivityRingMetric } from "@/components/charts";
import { GozlinButton, useReadinessSignals } from "@/components/gozlin";
import { ScreenTopBar, useDeck } from "@/components/navigation";
import { SyncStatusPill } from "@/components/sync/SyncStatusPill";
import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile, useSystem, useWorkout } from "@/contexts/AppContext";
import { useAllows, useBilling } from "@/contexts/BillingContext";
import { ArtTile } from "@/fitness/components/ArtTile";
import { recoveryCopy } from "@/fitness/components/recoveryCopy";
import { PlanReasons } from "@/fitness/components/PlanReasons";
import { WeekPlanRail } from "@/fitness/components/WeekPlanRail";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import type { WorkoutPlanMode } from "@/fitness/types";
import {
  recommendToday,
  type RecommendationInput,
} from "@/fitness/services/RecommendationEngine";
import {
  getWorkout,
  workoutToPlayerParams,
} from "@/fitness/services/WorkoutCatalog";
import {
  weekStartOf,
  workoutStreakDays,
} from "@/fitness/services/ProgressService";
import {
  loadFitnessProfile,
  rememberRecommendation,
  saveFitnessProfile,
  updateFitnessProfile,
} from "@/fitness/services/FitnessProfileStore";
import type { SessionState } from "@/models/session";
import { PlannedExercise, WorkoutSession } from "@/models/workout";
import { computeRecovery } from "@/services/gozlin/GozlinRecoveryEngine";
import { SessionService } from "@/services/SessionService";
import { formatDose, lightenSession, resolveTrainingPrefs } from "@/services/training";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Weekly-rings config. Vivid, distinct hues that read on both light + dark cards
// (outer → inner). The active-minutes goal follows the WHO 150-min/week guide.
const RING_DAYS = "#FF2D74"; // rose — days trained
const RING_INTENSITY = "#FF9F1C"; // amber — session intensity
const RING_MINUTES = "#33C4E8"; // cyan — active minutes
const WEEKLY_MIN_GOAL = 150;

const sessionService = SessionService.getInstance();

// The time-of-day greeting that used to sit above "Fitness" is gone: greeting
// the user once, on Home, is a welcome; greeting them again on every screen they
// visit is noise. Home owns it now (constants/HomeGreetings).

/** The work itself. A plan from before warm-ups were real moves has no blocks: all work. */
function workBlock(s: WorkoutSession): PlannedExercise[] {
  return s.exercises.filter((e) => (e.block ?? "main") === "main");
}

function blockOf(s: WorkoutSession, block: "warmup" | "cooldown"): PlannedExercise[] {
  return s.exercises.filter((e) => e.block === block);
}

/** Warm-up and cool-down as one quiet line each: real moves, not the point of the day. */
function BlockLine({ label, items }: { label: string; items: PlannedExercise[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.blockLine}>
      <AppText variant="caption" color="tertiary" uppercase>
        {label}
      </AppText>
      <AppText variant="footnote" color="tertiary" numberOfLines={2}>
        {items.map((e) => e.name).join(" · ")}
      </AppText>
    </View>
  );
}

export default function ExerciseScreen() {
  const { colors } = useColors();
  const router = useRouter();

  const { workoutPlan, workoutLog, sessionHistory } = useWorkout();
  const { isOnboardingComplete, userBio } = useProfile();
  const { currentDate } = useSystem();
  const { profile, ready: profileReady } = useFitnessProfile();
  // Pro: today's planned session eased to the recovery score.
  const adaptiveTraining = useAllows("adaptive-training");
  const { openUpgrade } = useBilling();

  const [savedSession, setSavedSession] = useState<SessionState | null>(null);
  /** The date the user chose the full session over the lighter one. */
  const [fullOn, setFullOn] = useState<string | null>(null);

  /* ── the plan ─────────────────────────────────────────────────────── */

  // The one reading of the training days that the plan, the reminders and the
  // weekly target share (services/training/prefs).
  const trainingPrefs = useMemo(
    () => resolveTrainingPrefs(userBio, profile),
    [userBio, profile],
  );

  const todayDayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const todaySession: WorkoutSession | null = useMemo(() => {
    if (!workoutPlan) return null;
    return workoutPlan.sessions.find((s) => s.dayOfWeek === todayDayIndex) || null;
  }, [workoutPlan, todayDayIndex]);

  const todayCompleted = useMemo(
    () => workoutLog.some((l) => l.date === currentDate),
    [workoutLog, currentDate],
  );

  // The same wearable + check-in inputs Gozlin's twin reads, so this card and
  // the coach quote one readiness score for the same day.
  const { wearable, checkins } = useReadinessSignals(currentDate);

  // The battery recharges by the hour, so this card's clock has to move. A tab
  // screen stays mounted, and a time read once at mount would freeze the
  // battery where it was: re-read it on every visit, on every return to the
  // app, and every five minutes while the tab is open.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const tick = setInterval(() => setNow(Date.now()), 5 * 60_000);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") setNow(Date.now());
      });
      return () => {
        clearInterval(tick);
        sub.remove();
      };
    }, []),
  );

  const recovery = useMemo(
    () =>
      computeRecovery({
        workoutLog,
        todaySession,
        exerciseLevel: userBio?.exerciseLevel,
        wearable,
        checkins,
        now: new Date(now),
      }),
    [workoutLog, todaySession, userBio?.exerciseLevel, wearable, checkins, now],
  );

  // Pro on an amber or red day: the lighter version of today's session, with
  // every change listed. The full session stays one tap away.
  const lighter = useMemo(
    () =>
      adaptiveTraining && todaySession && userBio && recovery.level !== "green"
        ? lightenSession(
            todaySession,
            { level: recovery.level, score: recovery.score },
            EXERCISE_DATABASE,
            userBio,
          )
        : null,
    [adaptiveTraining, todaySession, userBio, recovery.level, recovery.score],
  );
  const eased = lighter !== null && fullOn !== currentDate;
  const shownSession = eased && lighter ? lighter.session : todaySession;

  const handleStartSession = useCallback(() => {
    if (!shownSession) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const exerciseIds = shownSession.exercises.map((e) => e.exerciseId).join(",");
    const sets = shownSession.exercises.map((e) => e.sets).join(",");
    const reps = shownSession.exercises.map((e) => e.reps).join(",");
    const rest = shownSession.exercises.map((e) => e.restSeconds).join(",");
    router.push({
      pathname: "/guided-session",
      params: {
        exerciseIds,
        sessionLabel: shownSession.dayLabel,
        workoutSessionId: shownSession.id,
        sets,
        reps,
        rest,
      },
    });
  }, [shownSession, router]);

  /* ── choosing ─────────────────────────────────────────────────────── */

  // The plan rebuilds itself from the profile (contexts/domain/useWorkoutState
  // listens), so these only ever write the user's choice.
  const setPlanMode = useCallback((mode: WorkoutPlanMode) => {
    Haptics.selectionAsync().catch(() => {});
    void updateFitnessProfile({ planMode: mode });
  }, []);
  const clearPick = useCallback((day: number) => {
    void loadFitnessProfile().then((p) =>
      updateFitnessProfile({
        chosenWorkouts: (p.chosenWorkouts ?? []).filter((c) => c.day !== day),
      }),
    );
  }, []);
  const pickForDay = useCallback(
    (day: number) => {
      router.push({ pathname: "/fitness/library", params: { pickDay: String(day) } } as never);
    },
    [router],
  );

  /* ── the day's recommendation ─────────────────────────────────────── */

  const recommendation = useMemo(() => {
    const input: RecommendationInput = {
      date: currentDate,
      dayIndex: todayDayIndex,
      bio: userBio,
      profile,
      plan: workoutPlan,
      todaySession,
      doneToday: todayCompleted,
      workoutLog,
      sessionHistory,
      recoveryLevel: recovery.level,
      adaptiveTraining,
    };
    return recommendToday(input);
  }, [
    currentDate,
    todayDayIndex,
    userBio,
    profile,
    workoutPlan,
    todaySession,
    todayCompleted,
    workoutLog,
    sessionHistory,
    recovery.level,
    adaptiveTraining,
  ]);

  const recommendedWorkout = useMemo(
    () => (recommendation.workoutId ? getWorkout(recommendation.workoutId) : null),
    [recommendation.workoutId],
  );

  // Adaptation memory: record what was recommended today and whether it
  // happened. Idempotent — writes only when the stored outcome differs.
  useEffect(() => {
    if (!profileReady) return;
    const workoutId =
      recommendation.kind === "plan_session"
        ? "plan"
        : recommendation.kind === "library_workout"
          ? recommendation.workoutId
          : null;
    if (!workoutId) return;
    const existing = profile.recommendationHistory.find(
      (m) => m.date === currentDate && m.workoutId === workoutId,
    );
    if (existing && existing.completed === todayCompleted) return;
    void loadFitnessProfile().then((p) =>
      saveFitnessProfile(
        rememberRecommendation(p, {
          date: currentDate,
          workoutId,
          completed: todayCompleted,
        }),
      ),
    );
  }, [profileReady, recommendation.kind, recommendation.workoutId, currentDate, todayCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume-a-session: surface an in-flight guided session (e.g. app restart).
  useEffect(() => {
    let mounted = true;
    void sessionService.loadSession().then((s) => {
      if (!mounted || !s) return;
      const isLive =
        s.phase !== "COMPLETE" &&
        s.phase !== "SUMMARY" &&
        s.exercises.length > 0 &&
        s.startedAt.slice(0, 10) === currentDate;
      setSavedSession(isLive ? s : null);
    });
    return () => {
      mounted = false;
    };
  }, [currentDate, workoutLog.length]);

  const handleResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: "/guided-session", params: { resume: "1" } });
  }, [router]);

  const handleDiscardSaved = useCallback(() => {
    void sessionService.clearSession();
    setSavedSession(null);
  }, []);

  /* ── weekly rhythm numbers ────────────────────────────────────────── */

  const weekStats = useMemo(() => {
    const start = weekStartOf(currentDate);
    const entries = workoutLog.filter((l) => l.date >= start && l.date <= currentDate);
    // Intensity = how fully sessions were finished this week (avg completion 0–1).
    const intensity =
      entries.length > 0
        ? entries.reduce((s, l) => s + (l.completionPercent || 0), 0) / entries.length / 100
        : 0;
    return {
      workouts: entries.length,
      minutes: entries.reduce((s, l) => s + (l.durationMinutes || 0), 0),
      intensity,
      streak: workoutStreakDays(workoutLog, currentDate),
      // The days the plan schedules — never a separate number of its own.
      target: trainingPrefs.days.length,
    };
  }, [workoutLog, currentDate, trainingPrefs.days.length]);

  // Three weekly rings (outer → inner): days trained, session intensity, active
  // minutes toward the WHO 150-min/week goal.
  const weekRings = useMemo<ActivityRingMetric[]>(() => {
    const daysFrac = weekStats.workouts / weekStats.target;
    const minsFrac = weekStats.minutes / WEEKLY_MIN_GOAL;
    return [
      { key: "days", label: "Days", color: RING_DAYS, fraction: daysFrac, valueText: `${weekStats.workouts}/${weekStats.target}` },
      { key: "intensity", label: "Intensity", color: RING_INTENSITY, fraction: weekStats.intensity, valueText: `${Math.round(weekStats.intensity * 100)}%` },
      { key: "minutes", label: "Active min", color: RING_MINUTES, fraction: minsFrac, valueText: `${weekStats.minutes}/${WEEKLY_MIN_GOAL}` },
    ];
  }, [weekStats]);

  // Centre readout — overall weekly completion (mean of the three clamped rings).
  const weekOverall = useMemo(() => {
    const mean =
      weekRings.reduce((s, r) => s + Math.min(1, Math.max(0, r.fraction)), 0) /
      (weekRings.length || 1);
    return Math.round(mean * 100);
  }, [weekRings]);

  /* ── render ───────────────────────────────────────────────────────── */

  // Fitness builds its own scaffold instead of using <Screen>, so it has to ask
  // for the elastic ends — AND report its scroll position to the Deck — the same
  // way Screen does for everyone else. Without the second half the rail simply
  // never folds here, which on one of the four rail destinations would read as
  // the fold being broken rather than as this screen opting out.
  const deck = useDeck();
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      deck.reportScroll(e.nativeEvent.contentOffset.y);
    },
    [deck],
  );
  const elastic = useElasticScroll({ onScroll });

  const recoveryTone =
    recovery.level === "green"
      ? colors.success
      : recovery.level === "amber"
        ? colors.warning
        : colors.error;
  const { label: recoveryLabel, note: recoveryNote } = recoveryCopy(recovery, now);

  let revealIndex = 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {/* Header */}
        <ScreenTopBar
          style={styles.header}
          title={
            <>
              <AppText variant="title">Fitness</AppText>
              {/* Only ever visible when something hasn't reached the cloud. */}
              <SyncStatusPill style={styles.syncPill} />
            </>
          }
          trailing={<GozlinButton />}
          right={
            weekStats.streak > 0 ? (
              <View
                style={[
                  styles.streakChip,
                  { backgroundColor: alpha(colors.calories, 0.14) },
                ]}
              >
                <Ionicons name="flame" size={14} color={colors.calories} />
                <AppText variant="callout" color="calories">
                  {weekStats.streak}
                </AppText>
              </View>
            ) : undefined
          }
        />

        {elastic.wrap(
        <ScrollView
          showsVerticalScrollIndicator={false}
          {...elastic.scrollProps}
          contentContainerStyle={styles.content}
        >
          {/* First-run setup invitation */}
          {profileReady && !profile.setupComplete && (
            <Reveal index={revealIndex++}>
              <Card
                style={styles.block}
                padding="lg"
                onPress={() => router.push("/fitness/setup" as never)}
              >
                <View style={styles.setupRow}>
                  <IconBadge name="sparkles" tone={colors.primary} size={44} />
                  <View style={styles.flex}>
                    <AppText variant="callout">Personalize your training</AppText>
                    <AppText variant="footnote" color="tertiary">
                      Two minutes of questions → smarter daily recommendations
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </Card>
            </Reveal>
          )}

          {/* Continue where you left off */}
          {savedSession && (
            <Reveal index={revealIndex++}>
              <Card style={styles.block} padding="lg">
                <View style={styles.setupRow}>
                  <IconBadge name="play-circle" tone={colors.calories} size={44} />
                  <View style={styles.flex}>
                    <AppText variant="callout" numberOfLines={1}>
                      Continue: {savedSession.sessionLabel}
                    </AppText>
                    <AppText variant="footnote" color="tertiary">
                      Exercise {savedSession.currentExerciseIndex + 1} of{" "}
                      {savedSession.exercises.length} · paused mid-session
                    </AppText>
                  </View>
                </View>
                <View style={styles.resumeButtons}>
                  <Button label="Resume" icon="play" size="sm" onPress={handleResume} style={styles.flex} />
                  <Button
                    label="Discard"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={handleDiscardSaved}
                  />
                </View>
              </Card>
            </Reveal>
          )}

          {/* Today — the recommendation hero */}
          <Reveal index={revealIndex++}>
            {recommendation.kind === "plan_session" && shownSession ? (
              <Card padding="xxl" style={styles.block}>
                <View style={styles.todayHead}>
                  <IconBadge
                    name={todayCompleted ? "checkmark-done-circle" : "barbell"}
                    tone={todayCompleted ? colors.success : colors.primary}
                    size={48}
                  />
                  <View style={styles.flex}>
                    <AppText variant="headline">
                      {todayCompleted ? "Workout complete" : eased ? "Today's workout, lighter" : "Today's workout"}
                    </AppText>
                    <AppText variant="subhead" color="secondary">
                      {shownSession.dayLabel} · {workBlock(shownSession).length} moves · {shownSession.totalDurationMinutes} min
                    </AppText>
                  </View>
                  {todayCompleted && <Pill label="Done" tone={colors.success} icon="checkmark" />}
                </View>

                {!todayCompleted && (
                  <>
                    {lighter && eased ? (
                      <View style={[styles.lighter, { backgroundColor: alpha(colors.warning, 0.1) }]}>
                        {lighter.changes.map((c, i) => (
                          <AppText
                            key={c}
                            variant="footnote"
                            color={i === 0 ? "primary" : "secondary"}
                            weight={i === 0 ? "600" : undefined}
                          >
                            {i === 0 ? c : `· ${c}`}
                          </AppText>
                        ))}
                        <Pressable
                          onPress={() => setFullOn(currentDate)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Do the full session instead"
                          style={styles.lighterToggle}
                        >
                          <AppText variant="footnote" color="brand" weight="600">
                            Do the full session instead
                          </AppText>
                        </Pressable>
                      </View>
                    ) : lighter ? (
                      <Pressable
                        onPress={() => setFullOn(null)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Use the lighter version for today"
                        style={styles.lighterToggle}
                      >
                        <AppText variant="footnote" color="brand" weight="600">
                          Use the lighter version for today
                        </AppText>
                      </Pressable>
                    ) : null}

                    <View style={styles.reasonList}>
                      {recommendation.reasons.map((r) => (
                        <View key={r} style={styles.reasonRow}>
                          <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                          <AppText variant="footnote" color="secondary" style={styles.flex}>
                            {r}
                          </AppText>
                        </View>
                      ))}
                    </View>

                    {!adaptiveTraining && recovery.level !== "green" && (
                      <Pressable
                        onPress={() => openUpgrade("adaptive-training")}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Pro eases today's session to your recovery. Opens the upgrade screen."
                        style={styles.lockRow}
                      >
                        <Ionicons name="lock-closed" size={13} color={colors.textTertiary} />
                        <AppText variant="footnote" color="tertiary" style={styles.flex}>
                          Pro eases today&apos;s session to your recovery
                        </AppText>
                      </Pressable>
                    )}

                    <Button label="Start workout" icon="play" onPress={handleStartSession} style={styles.startBtn} />
                  </>
                )}

                <View style={[styles.exerciseList, { borderTopColor: colors.divider }]}>
                  <BlockLine label="Warm-up" items={blockOf(shownSession, "warmup")} />
                  {workBlock(shownSession).map((ex, i) => (
                    <View key={ex.exerciseId + i} style={styles.exercisePreview}>
                      <View style={styles.exerciseTop}>
                        <View style={[styles.exDot, { backgroundColor: colors.primary }]} />
                        <AppText variant="body" numberOfLines={1} style={styles.flex}>
                          {ex.name}
                        </AppText>
                        <AppText variant="footnote" color="tertiary" style={styles.sets}>
                          {formatDose(ex)}
                        </AppText>
                      </View>
                      {ex.reason ? (
                        <AppText variant="footnote" color="tertiary" style={styles.exerciseWhy}>
                          {ex.reason}
                        </AppText>
                      ) : null}
                      {ex.doseReason ? (
                        <AppText variant="footnote" color="brand" style={styles.exerciseWhy}>
                          {ex.doseReason}
                        </AppText>
                      ) : null}
                    </View>
                  ))}
                  <BlockLine label="Cool-down" items={blockOf(shownSession, "cooldown")} />
                </View>
              </Card>
            ) : recommendation.kind === "library_workout" && recommendedWorkout ? (
              <Card
                padding="xl"
                style={styles.block}
                onPress={() => router.push(`/fitness/workout/${recommendedWorkout.id}` as never)}
              >
                <AppText variant="caption" color="tertiary" uppercase>
                  Recommended for today
                </AppText>
                <View style={styles.recRow}>
                  <ArtTile
                    icon={recommendedWorkout.art.icon}
                    hue={recommendedWorkout.art.hue}
                    pattern={recommendedWorkout.art.pattern}
                    size={72}
                  />
                  <View style={styles.flex}>
                    <AppText variant="headline" numberOfLines={1}>
                      {recommendedWorkout.name}
                    </AppText>
                    <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                      {recommendedWorkout.tagline}
                    </AppText>
                    <View style={styles.recMeta}>
                      <Pill label={`${recommendedWorkout.durationMinutes} min`} tone={colors.primary} size="sm" />
                      <Pill
                        label={recommendedWorkout.style.toUpperCase()}
                        tone={colors.textTertiary}
                        size="sm"
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.reasonList}>
                  {recommendation.reasons.map((r) => (
                    <View key={r} style={styles.reasonRow}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                      <AppText variant="footnote" color="secondary" style={styles.flex}>
                        {r}
                      </AppText>
                    </View>
                  ))}
                </View>
                <Button
                  label="Start workout"
                  icon="play"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    const params = workoutToPlayerParams(recommendedWorkout);
                    router.push({ pathname: "/guided-session", params });
                  }}
                  style={styles.startBtn}
                />
              </Card>
            ) : (
              <Card padding="xxl" style={styles.block}>
                <View style={styles.emptyInner}>
                  <IconBadge
                    name={
                      !isOnboardingComplete
                        ? "barbell-outline"
                        : todayCompleted
                          ? "checkmark-done-circle"
                          : "bed-outline"
                    }
                    tone={todayCompleted ? colors.success : colors.primary}
                    size={64}
                  />
                  <AppText variant="title" style={styles.emptyTitle}>
                    {recommendation.title}
                  </AppText>
                  <AppText variant="body" color="secondary" align="center" style={styles.emptySub}>
                    {!isOnboardingComplete
                      ? "Complete onboarding to generate your weekly plan."
                      : recommendation.insight}
                  </AppText>
                  {isOnboardingComplete && (
                    <Button
                      label="Browse workouts"
                      icon="search"
                      variant="tonal"
                      onPress={() => router.push("/fitness/library" as never)}
                    />
                  )}
                </View>
              </Card>
            )}
          </Reveal>

          {/* Quick navigation */}
          <Reveal index={revealIndex++}>
            <View style={styles.quickGrid}>
              {(
                [
                  { icon: "compass-outline", label: "Explore", route: "/fitness/library" },
                  { icon: "trending-up-outline", label: "Progress", route: "/fitness/progress" },
                  { icon: "calendar-outline", label: "Calendar", route: "/fitness/calendar" },
                  { icon: "options-outline", label: "Settings", route: "/fitness/settings" },
                ] as const
              ).map((q) => (
                <Card
                  key={q.label}
                  padding="md"
                  style={styles.quickTile}
                  onPress={() => router.push(q.route as never)}
                >
                  <View style={styles.quickInner}>
                    <View
                      style={[
                        styles.quickIcon,
                        { backgroundColor: alpha(colors.primary, 0.14) },
                      ]}
                    >
                      <Ionicons name={q.icon} size={18} color={colors.primary} />
                    </View>
                    <AppText variant="footnote" weight="600">
                      {q.label}
                    </AppText>
                  </View>
                </Card>
              ))}
            </View>
          </Reveal>

          {/* This week — CARD-LESS. The rings ARE the section: a border around
              them only boxed in the one thing on this page that should breathe.
              Title + goal line moved into the section header, so the legend
              under the rings is the only text left in the block. */}
          <Reveal index={revealIndex++}>
            <View style={styles.section}>
              <SectionHeader
                title="This week"
                subtitle={
                  weekStats.workouts >= weekStats.target
                    ? `Weekly goal complete · ${weekStats.minutes} min logged`
                    : `${weekStats.target - weekStats.workouts} more to close your rings · ${weekStats.minutes} min`
                }
                actionLabel="Progress"
                onAction={() => router.push("/fitness/progress" as never)}
                weight="700"
              />
              <ActivityRings
                metrics={weekRings}
                centerValue={`${weekOverall}%`}
                centerLabel="Complete"
                animKey={`${weekStats.workouts}-${weekStats.minutes}`}
              />
            </View>
          </Reveal>

          {/* Today's read — recovery + the coach line in ONE card. They were two
              near-empty cards stacked on each other answering the same question
              ("what should I do right now?"), which is what made the page read
              as a pile of boxes. */}
          <Reveal index={revealIndex++}>
            <Card style={styles.block} padding="lg">
              <View style={styles.coachRow}>
                <IconBadge name="bulb" tone={colors.gold} size={40} />
                <View style={styles.flex}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Coach read
                  </AppText>
                  <AppText variant="subhead" color="secondary" style={styles.coachText}>
                    {recommendation.insight}
                  </AppText>
                </View>
              </View>

              <View style={[styles.coachDivider, { backgroundColor: colors.divider }]} />

              <View style={styles.recoveryRow}>
                <View style={styles.flex}>
                  <AppText variant="caption" color="tertiary" uppercase>
                    Recovery
                  </AppText>
                  <View style={styles.recoveryScore}>
                    <AppText variant="title" color={recoveryTone} style={styles.recoveryNum}>
                      {recovery.score}
                    </AppText>
                    <AppText
                      variant="subhead"
                      color="secondary"
                      numberOfLines={1}
                      style={styles.flex}
                    >
                      {recoveryLabel}
                    </AppText>
                  </View>
                  {recoveryNote && (
                    <AppText variant="footnote" color="tertiary" numberOfLines={1}>
                      {recoveryNote}
                    </AppText>
                  )}
                </View>
                {/* A battery, not the progress bars Home uses: recovery drains
                    with training and refills with rest, which is the one
                    direction a progress meter can't show. */}
                <BatteryGauge
                  charge={recovery.score / 100}
                  tone={recoveryTone}
                  label={`Recovery ${recovery.score} of 100. ${recoveryLabel}`}
                />
              </View>
            </Card>
          </Reveal>

          {/* How this week was built — the plan's own reasons, card-less. It
              replaced a "Tailored to you 92%" card whose number was a constant. */}
          {workoutPlan?.reasons && workoutPlan.reasons.length > 0 && (
            <Reveal index={revealIndex++}>
              <View style={styles.section}>
                <PlanReasons
                  reasons={workoutPlan.reasons}
                  onEdit={() => router.push("/fitness/setup" as never)}
                />
              </View>
            </Reveal>
          )}

          {/* Week plan — CARD-LESS too: a bare schedule rail on the page where
              today is the only filled surface. Each day says why it trains what
              it does, and "Let me choose" puts the user's own picks on days. */}
          {workoutPlan && (
            <Reveal index={revealIndex++}>
              <View style={styles.section}>
                <WeekPlanRail
                  plan={workoutPlan}
                  todayIndex={todayDayIndex}
                  trainingDays={trainingPrefs.days}
                  mode={trainingPrefs.mode}
                  onMode={setPlanMode}
                  onPick={pickForDay}
                  onClearPick={clearPick}
                  onEditDays={() => router.push("/fitness/setup" as never)}
                />
              </View>
            </Reveal>
          )}

          {/* Recent — the shared row language (inset hairlines, one badge size)
              instead of a hand-rolled stack. */}
          {workoutLog.length > 0 && (
            <Reveal index={revealIndex++}>
              <View style={styles.section}>
                <SectionHeader
                  title="Recent"
                  actionLabel="Calendar"
                  onAction={() => router.push("/fitness/calendar" as never)}
                  weight="700"
                />
                <ListGroup>
                  {workoutLog.slice(0, 5).map((log) => (
                    <ListRow
                      key={log.id}
                      icon="checkmark-circle"
                      tone={colors.success}
                      title={log.sessionLabel}
                      subtitle={log.date}
                      value={log.durationMinutes ? `${log.durationMinutes} min` : undefined}
                    />
                  ))}
                </ListGroup>
              </View>
            </Reveal>
          )}
        </ScrollView>,
        )}
      </SafeAreaView>

      {/* The Deck used to be docked here by hand, because this screen paints
          its own canvas rather than using `Screen`. It is mounted once in
          AppDrawer now, so there is nothing to dock — but `content` must keep
          reserving NAV_CLEARANCE, or the last card scrolls under the rail. */}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: Spacing.xl },
  /**
   * A CARD-LESS section. Content sits straight on the ambient canvas, so the
   * only thing separating it from its neighbours is air — hence the wider
   * bottom margin than a card's `block`.
   */
  section: { marginBottom: Spacing.xxxl },

  header: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  syncPill: { marginTop: Spacing.sm },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },

  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: NAV_CLEARANCE,
  },

  setupRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  resumeButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },

  // Today hero
  todayHead: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  startBtn: { marginTop: Spacing.lg },
  reasonList: { marginTop: Spacing.lg, gap: Spacing.xs },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  exerciseList: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  exercisePreview: { paddingVertical: Spacing.sm },
  exerciseTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  // Indented past the dot, so the reason reads as belonging to the move.
  exerciseWhy: { marginLeft: 8 + Spacing.sm, marginTop: 2 },
  exDot: { width: 8, height: 8, borderRadius: 4 },
  sets: { fontWeight: "600" },
  blockLine: { paddingVertical: Spacing.sm, gap: 2 },
  lighter: { marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.lg, gap: 2 },
  lighterToggle: { marginTop: Spacing.sm, alignSelf: "flex-start" },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.md },

  recRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  recMeta: { flexDirection: "row", gap: Spacing.sm, marginTop: 6 },

  emptyInner: { alignItems: "center" },
  emptyTitle: { marginTop: Spacing.lg },
  emptySub: { marginTop: Spacing.sm, marginBottom: Spacing.xl },

  // Quick nav
  quickGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  quickTile: { flex: 1 },
  quickInner: { alignItems: "center", gap: Spacing.sm },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Today's read (coach line + recovery)
  coachRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  coachText: { marginTop: 3 },
  coachDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.lg },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.lg,
  },
  recoveryScore: { flexDirection: "row", alignItems: "baseline", gap: Spacing.sm, marginTop: 2 },
  recoveryNum: { fontWeight: "800", fontVariant: ["tabular-nums"] },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:exercise" />;
}
