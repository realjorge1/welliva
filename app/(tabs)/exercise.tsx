/**
 * FITNESS HOME — the training dashboard.
 *
 * The daily launchpad: an explainable "today" recommendation (plan session,
 * library workout or rest), continue-where-you-left-off, recovery status,
 * weekly rhythm, and doorways into the Explore / Progress / Calendar /
 * Settings screens of the fitness module.
 *
 * Everything the previous tab did is preserved: the weekly plan view, the
 * tailored-match card, plan regeneration, recents, and the guided-session
 * launch contract (exerciseIds/sets/reps params) are unchanged. The exercise
 * browser moved to Explore → Exercises with identical behaviour.
 */

import {
  AmbientCanvas,
  AppText,
  AscendingMeter,
  Button,
  Card,
  IconBadge,
  ListGroup,
  ListRow,
  NAV_CLEARANCE,
  Pill,
  Reveal,
  Ring,
  SectionHeader,
  useColors,
  useElasticScroll,
} from "@/components/ui";
import { ActivityRings, type ActivityRingMetric } from "@/components/charts";
import { GozlinButton } from "@/components/gozlin";
import { ScreenTopBar } from "@/components/navigation";
import { SyncStatusPill } from "@/components/sync/SyncStatusPill";
import { CrashTrigger, ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { Radius, Spacing, alpha } from "@/constants/theme";
import { useProfile, useSystem, useWorkout } from "@/contexts/AppContext";
import { ArtTile } from "@/fitness/components/ArtTile";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
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
} from "@/fitness/services/FitnessProfileStore";
import type { SessionState } from "@/models/session";
import { WorkoutSession } from "@/models/workout";
import { computeRecovery } from "@/services/gozlin/GozlinRecoveryEngine";
import { SessionService } from "@/services/SessionService";
import { workoutPlanMatch } from "@/services/WorkoutGenerator";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function ExerciseScreen() {
  const { colors } = useColors();
  const router = useRouter();

  const { workoutPlan, workoutLog, sessionHistory, regenerateWorkoutPlan } = useWorkout();
  const { isOnboardingComplete, userBio } = useProfile();
  const { currentDate } = useSystem();
  const { profile, ready: profileReady } = useFitnessProfile();

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [savedSession, setSavedSession] = useState<SessionState | null>(null);

  /* ── preserved plan logic ─────────────────────────────────────────── */

  const planMatch = useMemo(
    () => (userBio ? workoutPlanMatch(userBio) : null),
    [userBio],
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

  const handleStartSession = useCallback(() => {
    if (!todaySession) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const exerciseIds = todaySession.exercises.map((e) => e.exerciseId).join(",");
    const sets = todaySession.exercises.map((e) => e.sets).join(",");
    const reps = todaySession.exercises.map((e) => e.reps).join(",");
    router.push({
      pathname: "/guided-session",
      params: {
        exerciseIds,
        sessionLabel: todaySession.dayLabel,
        workoutSessionId: todaySession.id,
        sets,
        reps,
      },
    });
  }, [todaySession, router]);

  const handleRegen = useCallback(async () => {
    setIsRegenerating(true);
    try {
      await regenerateWorkoutPlan();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      console.error("Regen failed:", e);
    } finally {
      setIsRegenerating(false);
    }
  }, [regenerateWorkoutPlan]);

  /* ── new intelligence layer ───────────────────────────────────────── */

  const recovery = useMemo(
    () => computeRecovery({ workoutLog, todaySession }),
    [workoutLog, todaySession],
  );

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
      target: profile.daysAvailable.length || 3,
    };
  }, [workoutLog, currentDate, profile.daysAvailable.length]);

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
  // for the elastic ends the same way Screen does.
  const elastic = useElasticScroll();

  const recoveryTone =
    recovery.level === "green"
      ? colors.success
      : recovery.level === "amber"
        ? colors.warning
        : colors.error;

  let revealIndex = 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      {/* Dev-only: open with ?crash=1 or ?crash=tab:exercise — see AppErrorBoundary. */}
      {__DEV__ && <CrashTrigger surface="tab:exercise" />}
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
            {recommendation.kind === "plan_session" && todaySession ? (
              <Card padding="xxl" style={styles.block}>
                <View style={styles.todayHead}>
                  <IconBadge
                    name={todayCompleted ? "checkmark-done-circle" : "barbell"}
                    tone={todayCompleted ? colors.success : colors.primary}
                    size={48}
                  />
                  <View style={styles.flex}>
                    <AppText variant="headline">
                      {todayCompleted ? "Workout complete" : "Today's workout"}
                    </AppText>
                    <AppText variant="subhead" color="secondary">
                      {todaySession.dayLabel} · {todaySession.exercises.length} exercises
                    </AppText>
                  </View>
                  {todayCompleted && <Pill label="Done" tone={colors.success} icon="checkmark" />}
                </View>

                {!todayCompleted && (
                  <>
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
                    <Button label="Start workout" icon="play" onPress={handleStartSession} style={styles.startBtn} />
                  </>
                )}

                <View style={[styles.exerciseList, { borderTopColor: colors.divider }]}>
                  {todaySession.exercises.map((ex, i) => (
                    <View key={ex.exerciseId + i} style={styles.exercisePreview}>
                      <View style={[styles.exDot, { backgroundColor: colors.primary }]} />
                      <AppText variant="body" numberOfLines={1} style={styles.flex}>
                        {ex.name}
                      </AppText>
                      <AppText variant="footnote" color="tertiary" style={styles.sets}>
                        {ex.sets}×{ex.reps}
                      </AppText>
                    </View>
                  ))}
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
                      {recovery.level === "green"
                        ? "Ready to train"
                        : recovery.level === "amber"
                          ? "Train moderately"
                          : "Prioritize recovery"}
                    </AppText>
                  </View>
                </View>
                <AscendingMeter progress={recovery.score / 100} tone={recoveryTone} height={30} />
              </View>
            </Card>
          </Reveal>

          {/* Tailored-to-you match (preserved) */}
          {workoutPlan && planMatch && (
            <Reveal index={revealIndex++}>
              <Card style={styles.block} padding="lg">
                <View style={styles.matchHead}>
                  <Ring progress={planMatch.percent / 100} size={62} strokeWidth={6}>
                    <AppText variant="callout" color="brand" style={styles.matchPctText}>
                      {planMatch.percent}%
                    </AppText>
                  </Ring>
                  <View style={styles.flex}>
                    <AppText variant="callout">Tailored to you</AppText>
                    <AppText variant="footnote" color="tertiary" style={styles.matchSub}>
                      {planMatch.notes.length > 0
                        ? planMatch.notes.join(" · ")
                        : "Matched to your level, goal and equipment"}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Reveal>
          )}

          {/* Week plan — CARD-LESS too (the second "this week" view): a bare
              schedule rail on the page where today is the only filled surface.
              Regeneration moved into the section header, so the block ends on
              the week itself instead of on a button. */}
          {workoutPlan && (
            <Reveal index={revealIndex++}>
              <View style={styles.section}>
                <SectionHeader
                  title="Week plan"
                  subtitle={`${workoutPlan.sessions.length} sessions · ${Math.max(
                    0,
                    7 - workoutPlan.sessions.length,
                  )} rest days`}
                  actionLabel={isRegenerating ? "Generating…" : "Regenerate"}
                  onAction={isRegenerating ? undefined : handleRegen}
                  weight="700"
                />
                {WEEK.map((day, i) => {
                  const session = workoutPlan.sessions.find((s) => s.dayOfWeek === i);
                  const isToday = i === todayDayIndex;
                  return (
                    <View
                      key={day}
                      style={[
                        styles.weekRow,
                        i < WEEK.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.divider,
                        },
                        isToday && {
                          backgroundColor: colors.primarySoft,
                          borderRadius: Radius.lg,
                          borderBottomWidth: 0,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        uppercase
                        color={isToday ? "brand" : "tertiary"}
                        style={styles.weekDay}
                      >
                        {day}
                      </AppText>
                      <View
                        style={[
                          styles.weekDot,
                          {
                            backgroundColor: session ? colors.primary : "transparent",
                            borderColor: session ? colors.primary : colors.borderStrong,
                          },
                        ]}
                      />
                      <AppText
                        variant="body"
                        color={session ? "primary" : "tertiary"}
                        style={styles.flex}
                        numberOfLines={1}
                      >
                        {session ? session.dayLabel : "Rest"}
                      </AppText>
                      {isToday && <Pill label="Today" tone={colors.primary} size="sm" />}
                    </View>
                  );
                })}
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
  exercisePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  exDot: { width: 8, height: 8, borderRadius: 4 },
  sets: { fontWeight: "600" },

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

  // Week rail (card-less)
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  weekDay: { width: 34, letterSpacing: 0.6, fontWeight: "700" },
  weekDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },

  // Tailored match
  matchHead: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  matchPctText: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  matchSub: { marginTop: 2 },
});

/**
 * LEVEL 3 — route-level boundary. Expo Router honours this named export, so a
 * throw inside this screen is contained here: the tab bar stays live and every
 * other tab stays usable. Only what this file couldn't render is lost.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="tab:exercise" />;
}
