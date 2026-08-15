/**
 * SESSION SUMMARY — post-workout review with completion ring, stat grid and
 * exercise breakdown. Rebuilt on the Welliva design system; logging + nav kept.
 */

import { AmbientCanvas, AppText, Button, Card, IconBadge, MuscleMap, Pill, Ring, useColors } from "@/components/ui";
import { TrainingNudgeSheet } from "@/components/onboarding/TrainingNudgeSheet";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Gradients, Palette, Spacing, alpha } from "@/constants/theme";
import { useProfile, useWorkout } from "@/contexts/AppContext";
import { getSummarySignoff } from "@/services/CoachEngine";
import { SessionSummaryData } from "@/models/session";
import { WorkoutLogEntry } from "@/models/workout";
import { isTrainingNudgeSnoozed } from "@/utils/trainingNudge";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${s}s`;
}

function difficultyColor(d: string): string {
  switch (d) {
    case "beginner":
      return Palette.positive;
    case "intermediate":
      return Palette.warning;
    case "advanced":
      return Palette.danger;
    default:
      return "#9E9E9E";
  }
}

export default function SessionSummaryScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const { colors } = useColors();
  const { logWorkout, recordSessionSummary, workoutLog } = useWorkout();
  const { userBio } = useProfile();

  const summary: SessionSummaryData | null = useMemo(() => {
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, [data]);

  // Aggregate the muscle groups actually trained (skipped exercises excluded)
  // for the body-map card. AI exercises absent from the local DB contribute
  // nothing — the card hides itself if the set is empty.
  const workedMuscles = useMemo(() => {
    const names = new Set<string>();
    summary?.exerciseResults
      .filter((r) => !r.skipped)
      .forEach((r) => {
        EXERCISE_DATABASE.find((e) => e.id === r.exerciseId)?.targetMuscles.forEach((m) =>
          names.add(m),
        );
      });
    return [...names];
  }, [summary]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [fadeAnim, slideAnim]);

  // Each session run must be logged exactly once — the ref guards against
  // re-fires from re-renders or context callback identity changes.
  const loggedRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!summary || loggedRunRef.current === summary.sessionRunId) return;
    loggedRunRef.current = summary.sessionRunId;
    const logEntry: WorkoutLogEntry = {
      id: summary.sessionRunId,
      date: summary.date,
      sessionId: summary.workoutSessionId,
      sessionLabel: summary.sessionLabel,
      exercisesCompleted: summary.exercisesCompleted,
      totalExercises: summary.totalExercises,
      completionPercent: summary.completionPercent,
      durationMinutes: Math.round(summary.durationSeconds / 60),
      completedAt: summary.completedAt,
    };
    logWorkout(logEntry);
    // Persist the full per-exercise summary so Gozlin's Adaptive Workout
    // Intelligence can read reps/skips over time (progress vs avoidance).
    recordSessionSummary(summary);
  }, [summary, logWorkout, recordSessionSummary]);

  // Smart training nudge: a user who skipped workouts at onboarding
  // (`trainingEnabled === false`) has now trained MORE THAN ONCE (≥1 prior
  // session on top of this one). Gently offer to turn it into a real plan —
  // once, and only if they haven't recently said "later". Checked a single time
  // per summary so it never re-fires as `workoutLog` updates.
  const [showNudge, setShowNudge] = useState(false);
  const nudgeCheckedRef = useRef(false);
  useEffect(() => {
    if (nudgeCheckedRef.current || !summary) return;
    if (userBio?.trainingEnabled !== false) return;
    if (workoutLog.length < 1) return;
    nudgeCheckedRef.current = true;
    isTrainingNudgeSnoozed().then((snoozed) => {
      if (!snoozed) setShowNudge(true);
    });
  }, [summary, userBio?.trainingEnabled, workoutLog.length]);

  if (!summary) {
    return (
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.centered]}>
          <IconBadge name="alert-circle" tone={colors.warning} size={64} />
          <AppText variant="body" color="secondary" style={styles.errorText}>
            No session data found.
          </AppText>
          <Button
            label="Back to Fitness"
            onPress={() => router.replace("/(tabs)/exercise")}
            fullWidth={false}
          />
        </SafeAreaView>
      </View>
    );
  }

  const pct = summary.completionPercent;
  const tone = pct >= 80 ? colors.success : pct >= 50 ? colors.warning : colors.error;
  const ringGradient = pct >= 80 ? colors.brandGradient : pct >= 50 ? Gradients.carbs : (["#F87171", "#EF4444"] as const);
  const headline = pct >= 80 ? "Great workout" : pct >= 50 ? "Good effort" : "Keep going";

  const signoff = getSummarySignoff(pct, summary.totalExercises - summary.exercisesCompleted);

  const stats = [
    { icon: "checkmark-circle", label: "Completion", value: `${pct}%`, tone },
    { icon: "time", label: "Duration", value: formatDuration(summary.durationSeconds), tone: colors.text },
    { icon: "flame", label: "Calories", value: `${summary.caloriesBurned}`, tone: colors.calories },
    { icon: "layers", label: "Sets", value: `${summary.setsCompleted}/${summary.totalSets}`, tone: colors.text },
    { icon: "repeat", label: "Total reps", value: `${summary.totalReps}`, tone: colors.text },
    { icon: "barbell", label: "Exercises", value: `${summary.exercisesCompleted}/${summary.totalExercises}`, tone: colors.text },
  ];

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Hero */}
            <View style={styles.hero}>
              <Ring progress={pct / 100} size={168} strokeWidth={15} gradient={ringGradient}>
                <AppText variant="displayLg" style={styles.ringPct}>
                  {pct}
                  <AppText variant="title" color="tertiary">
                    %
                  </AppText>
                </AppText>
                <AppText variant="caption" color="tertiary" uppercase>
                  complete
                </AppText>
              </Ring>
              <AppText variant="display" style={styles.headline}>
                {headline}
              </AppText>
              <AppText variant="subhead" color="secondary">
                {summary.sessionLabel}
              </AppText>
            </View>

            {/* Coach sign-off */}
            <Card style={styles.coachCard} padding="lg">
              <View style={styles.coachHead}>
                <IconBadge name="megaphone" tone={colors.primary} size={34} />
                <AppText variant="caption" color="tertiary" uppercase>
                  Your coach
                </AppText>
              </View>
              <AppText variant="bodyLg" color="secondary" style={styles.coachMsg}>
                {signoff.message}
              </AppText>
            </Card>

            {/* Body map — what today's work actually hit */}
            {workedMuscles.length > 0 && (
              <Card style={styles.musclesCard} padding="lg">
                <AppText variant="headline" style={styles.musclesTitle}>
                  Muscles worked
                </AppText>
                <MuscleMap muscles={workedMuscles} height={156} labels />
              </Card>
            )}

            {/* Stats grid */}
            <View style={styles.grid}>
              {stats.map((s) => (
                <Card key={s.label} style={styles.statCard} padding="md">
                  <IconBadge name={s.icon as any} tone={colors.primary} size={34} />
                  <AppText variant="headline" color={s.tone} style={styles.statValue}>
                    {s.value}
                  </AppText>
                  <AppText variant="caption" color="tertiary" uppercase align="center">
                    {s.label}
                  </AppText>
                </Card>
              ))}
            </View>

            {/* Breakdown */}
            <Card style={styles.breakdown}>
              <AppText variant="headline" style={styles.breakdownTitle}>
                Exercise breakdown
              </AppText>
              {summary.exerciseResults.map((ex, i) => (
                <View
                  key={`${ex.exerciseId}-${i}`}
                  style={[
                    styles.exRow,
                    i < summary.exerciseResults.length - 1 && {
                      borderBottomColor: colors.divider,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.exStatus,
                      { backgroundColor: ex.skipped ? alpha(colors.textTertiary, 0.16) : alpha(colors.success, 0.16) },
                    ]}
                  >
                    <Ionicons
                      name={ex.skipped ? "close" : "checkmark"}
                      size={16}
                      color={ex.skipped ? colors.textTertiary : colors.success}
                    />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="callout" color={ex.skipped ? "tertiary" : "primary"} numberOfLines={1}>
                      {ex.exerciseName}
                    </AppText>
                    <AppText variant="footnote" color="tertiary">
                      {ex.skipped ? "Skipped" : `${ex.setsCompleted.length} sets · ${ex.totalReps} reps`}
                    </AppText>
                  </View>
                  <Pill
                    label={ex.difficulty.charAt(0).toUpperCase() + ex.difficulty.slice(1)}
                    tone={difficultyColor(ex.difficulty)}
                    size="sm"
                  />
                </View>
              ))}
            </Card>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                label="Back to Fitness"
                icon="barbell"
                onPress={() => router.replace("/(tabs)/exercise")}
              />
              <Button
                label="Go to Home"
                icon="home-outline"
                variant="tonal"
                onPress={() => router.replace("/(tabs)")}
              />
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <TrainingNudgeSheet visible={showNudge} onClose={() => setShowNudge(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", gap: Spacing.lg, padding: Spacing.huge },
  errorText: {},
  scroll: { padding: Spacing.screen, paddingBottom: Spacing.huge },

  hero: { alignItems: "center", paddingVertical: Spacing.xl, gap: Spacing.sm },
  ringPct: { fontWeight: "800" },
  headline: { marginTop: Spacing.md },

  coachCard: { marginTop: Spacing.lg, gap: Spacing.sm },
  musclesCard: { marginTop: Spacing.lg },
  musclesTitle: { marginBottom: Spacing.md },
  coachHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  coachMsg: { lineHeight: 24 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.lg },
  statCard: { width: (width - Spacing.screen * 2 - Spacing.md * 2) / 3, alignItems: "center", gap: 4 },
  statValue: { marginTop: 4 },

  breakdown: { marginTop: Spacing.lg },
  breakdownTitle: { marginBottom: Spacing.md },
  exRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md },
  exStatus: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },

  actions: { gap: Spacing.md, marginTop: Spacing.xl },
});
