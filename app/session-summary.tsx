/**
 * SESSION SUMMARY — the record of a finished workout: what it added up to,
 * what it worked, what the coach makes of it, and every move as a split.
 *
 * The player's completion screen is the moment (DONE, the flame, one
 * question); this is the page you can read afterwards — the reference's
 * "splits" to its "complete". It wears the app's instrument surface (black
 * cards, thin white edges, mono readings) like Home and Diet, and counts the
 * way a person would: reps from rep sets, held time from holds — never a
 * plank's seconds added into "reps" (see fitness/components/sessionTotals).
 *
 * Logging, the coach sign-off, the muscle map and the training nudge are
 * unchanged; only the surface and the stats were rebuilt (2026-11-01).
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { HOME_ORANGE, INSTRUMENT_CARD, EDGE_WHITE } from "@/components/home/surface";
import { TrainingNudgeSheet } from "@/components/onboarding/TrainingNudgeSheet";
import {
  AmbientCanvas,
  AppText,
  Button,
  IconBadge,
  Mono,
  MuscleMap,
  Reveal,
  useColors,
} from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Spacing, alpha } from "@/constants/theme";
import { useProfile, useWorkout } from "@/contexts/AppContext";
import { PrimaryPill } from "@/fitness/components/SessionControls";
import { BLOCK_LABEL } from "@/fitness/components/sessionBlocks";
import { formatClock, sessionTotals } from "@/fitness/components/sessionTotals";
import { everySetDone } from "@/fitness/services/WorkoutCatalog";
import {
  SessionSummaryData,
  isTimedReps,
  type ExerciseSessionResult,
  type SessionBlock,
} from "@/models/session";
import { WorkoutLogEntry } from "@/models/workout";
import { getSummarySignoff } from "@/services/CoachEngine";
import * as Haptics from "@/utils/haptics";
import { isTrainingNudgeSnoozed } from "@/utils/trainingNudge";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const DB_BY_ID = new Map(EXERCISE_DATABASE.map((e) => [e.id, e]));

/** A hold, by the library's own word, else by its prescription ("45 sec"). */
function isTimedResult(r: Pick<ExerciseSessionResult, "exerciseId" | "targetReps">): boolean {
  const db = DB_BY_ID.get(r.exerciseId);
  return db ? db.exerciseType === "timed" : isTimedReps(r.targetReps);
}

/** "TODAY", or the day the session was finished on. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TODAY";
  if (new Date().toDateString() === d.toDateString()) return "TODAY";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}

/** One move's split: what was done, in the face it is counted in. */
function splitLine(r: ExerciseSessionResult, timed: boolean): string {
  if (r.skipped) return "SKIPPED";
  const sets = r.setsCompleted.filter((s) => !s.skipped);
  if (sets.length === 0) return "NOT STARTED";
  if (timed) {
    const held = sets.reduce((sum, s) => sum + Math.max(0, s.durationSeconds), 0);
    return `${sets.length} × HOLD · ${formatClock(held)}`;
  }
  const reps = sets.reduce((sum, s) => sum + Math.max(0, s.repsCompleted), 0);
  return `${sets.length} ${sets.length === 1 ? "SET" : "SETS"} · ${reps} REPS`;
}

export default function SessionSummaryScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
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
        DB_BY_ID.get(r.exerciseId)?.targetMuscles.forEach((m) => names.add(m));
      });
    return [...names];
  }, [summary]);

  const totals = useMemo(
    () =>
      summary
        ? sessionTotals(
            summary.exerciseResults,
            (id) => {
              const r = summary.exerciseResults.find((x) => x.exerciseId === id);
              return r ? isTimedResult(r) : false;
            },
            { setsTotal: summary.totalSets, movesTotal: summary.totalExercises },
          )
        : null,
    [summary],
  );

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  // Each session run must be logged exactly once — the ref guards against
  // re-fires from re-renders or context callback identity changes.
  const loggedRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!summary || loggedRunRef.current === summary.sessionRunId) return;
    loggedRunRef.current = summary.sessionRunId;

    /**
     * A SESSION WITH NO WORK IN IT IS NOT A WORKOUT.
     *
     * Opening the player and ending it immediately used to write a full log
     * entry: zero sets, zero exercises, zero minutes. That entry then counted
     * as a training day EVERYWHERE — the day streak, "3 workouts this week",
     * the biggest-week record, the consistency heatmap, the Progress rings.
     * Every one of those cards says it counts sessions, so every one of them
     * was overstating by however many times the user had opened the player and
     * changed their mind.
     *
     * One completed set is the bar, not one completed exercise: stopping after
     * a single set is a short workout, and the log has always been right to
     * keep it (see services/__tests__/sessionCompletion.test.ts). Zero is the
     * only case this excludes.
     *
     * The SUMMARY still renders, and the per-exercise record below is still
     * kept — bailing out is real information about the session, and Gozlin's
     * adaptive layer reads it. What doesn't happen is a workout being counted.
     */
    const didWork = summary.setsCompleted > 0 || summary.exercisesCompleted > 0;

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
      // What "finished" means everywhere (Explore's check): every set, no skips.
      allSetsDone: everySetDone(summary),
    };
    if (didWork) logWorkout(logEntry);
    // Persist the full per-exercise summary so Gozlin's Adaptive Workout
    // Intelligence can read reps/skips over time (progress vs avoidance). This
    // one is kept even for an abandoned run — see above.
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

  if (!summary || !totals) {
    return (
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.centered]}>
          <IconBadge name="alert-circle" tone={colors.warning} size={64} />
          <AppText variant="body" color="secondary">
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
  const headline = pct >= 80 ? "Great workout" : pct >= 50 ? "Good effort" : "Keep going";
  const signoff = getSummarySignoff(pct, summary.totalExercises - summary.exercisesCompleted);
  const minutes = Math.max(1, Math.round(summary.durationSeconds / 60));

  // The reference's stat block: a mono name over a figure and its unit, two to
  // a row. Reps and held time only appear when the session had any.
  const stats: { label: string; value: string; unit?: string; tone?: string }[] = [
    { label: "Time", value: formatClock(summary.durationSeconds) },
    { label: "Energy", value: `~${summary.caloriesBurned}`, unit: "KCAL", tone: HOME_ORANGE },
    { label: "Sets", value: `${totals.setsDone}`, unit: `/${totals.setsTotal}` },
    { label: "Moves", value: `${totals.movesDone}`, unit: `/${totals.movesTotal}` },
  ];
  if (totals.reps > 0) stats.push({ label: "Reps", value: `${totals.reps}` });
  if (totals.heldSeconds > 0) stats.push({ label: "Held", value: formatClock(totals.heldSeconds) });

  // The splits, in the session's blocks when it had more than one.
  const results = summary.exerciseResults;
  const blocks = new Set(results.map((r) => r.block ?? "main"));
  const blocked = blocks.size > 1;

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg }]}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.replace("/(tabs)/exercise")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close and go to Fitness"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: colors.surfaceElevated },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
            <View style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
              <Mono size={11} tracking={0.6} color={colors.text}>
                {`${pct}% DONE`}
              </Mono>
            </View>
          </View>

          <Reveal index={0}>
            <Mono size={11} tracking={0.6} color={colors.textTertiary}>
              {`${dayLabel(summary.completedAt)} · ${minutes} MIN`}
            </Mono>
            <AppText variant="display" style={styles.headline}>
              {headline}
            </AppText>
            <AppText variant="subhead" color="secondary" numberOfLines={1}>
              {summary.sessionLabel}
            </AppText>
          </Reveal>

          {/* What it added up to */}
          <Reveal index={1} style={styles.block}>
            <View style={INSTRUMENT_CARD}>
              <CardHead label="Activity" />
              <View style={styles.grid}>
                {stats.map((s, i) => (
                  <View
                    key={s.label}
                    style={[
                      styles.stat,
                      i >= 2 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                    accessible
                    accessibilityLabel={`${s.label} ${s.value}${s.unit ? ` ${s.unit}` : ""}`}
                  >
                    <Mono size={10} tracking={0.6} color={colors.textTertiary}>
                      {s.label.toUpperCase()}
                    </Mono>
                    <View style={styles.statRow}>
                      <AppText variant="title" weight="500" color={s.tone ?? "primary"} style={styles.statValue}>
                        {s.value}
                      </AppText>
                      {s.unit ? (
                        <Mono size={11} color={colors.textTertiary}>
                          {s.unit}
                        </Mono>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          {/* Coach sign-off */}
          <Reveal index={2} style={styles.block}>
            <View style={INSTRUMENT_CARD}>
              <CardHead label="Your coach" />
              <AppText variant="bodyLg" color="secondary" style={styles.coachMsg}>
                {signoff.message}
              </AppText>
            </View>
          </Reveal>

          {/* Body map — what today's work actually hit */}
          {workedMuscles.length > 0 && (
            <Reveal index={3} style={styles.block}>
              <View style={INSTRUMENT_CARD}>
                <CardHead label="Muscles worked" />
                <View style={styles.muscles}>
                  <MuscleMap muscles={workedMuscles} height={156} labels />
                </View>
              </View>
            </Reveal>
          )}

          {/* Every move, as a split */}
          <Reveal index={4} style={styles.block}>
            <View style={[INSTRUMENT_CARD, styles.splitsCard]}>
              <View style={styles.splitsHead}>
                <CardHead label="Splits" />
              </View>
              {results.map((r, i) => {
                const block: SessionBlock = r.block ?? "main";
                const opensBlock = blocked && (i === 0 || (results[i - 1].block ?? "main") !== block);
                const done = !r.skipped && r.setsCompleted.length > 0;
                return (
                  <React.Fragment key={`${r.exerciseId}-${i}`}>
                    {opensBlock ? (
                      <Mono size={10} tracking={0.6} color={colors.textTertiary} style={styles.splitBlock}>
                        {BLOCK_LABEL[block].toUpperCase()}
                      </Mono>
                    ) : null}
                    <View
                      style={[
                        styles.split,
                        (i > 0 && !opensBlock) && {
                          borderTopColor: colors.divider,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <Mono size={11} color={colors.textTertiary} style={styles.splitIndex}>
                        {String(i + 1).padStart(2, "0")}
                      </Mono>
                      <View style={styles.flex}>
                        <AppText variant="callout" color={done ? "primary" : "tertiary"} numberOfLines={1}>
                          {r.exerciseName}
                        </AppText>
                        <Mono size={10} tracking={0.4} color={colors.textTertiary} numberOfLines={1}>
                          {splitLine(r, isTimedResult(r))}
                        </Mono>
                      </View>
                      {done ? (
                        <Mono size={12} color={colors.textSecondary} style={styles.splitTime}>
                          {formatClock(r.totalTimeSeconds)}
                        </Mono>
                      ) : null}
                      <View
                        style={[
                          styles.splitMark,
                          { backgroundColor: done ? alpha(colors.success, 0.16) : alpha(colors.textTertiary, 0.14) },
                        ]}
                      >
                        <Ionicons
                          name={done ? "checkmark" : "remove"}
                          size={13}
                          color={done ? colors.success : colors.textTertiary}
                        />
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </Reveal>

          {/* Actions */}
          <Reveal index={5} style={styles.actions}>
            <PrimaryPill
              label="Back to Fitness"
              icon="barbell"
              tone="brand"
              onPress={() => router.replace("/(tabs)/exercise")}
            />
            <Button
              label="Go to Home"
              icon="home-outline"
              variant="tonal"
              onPress={() => router.replace("/(tabs)")}
            />
          </Reveal>
        </ScrollView>
      </SafeAreaView>

      <TrainingNudgeSheet visible={showNudge} onClose={() => setShowNudge(false)} />
    </View>
  );
}

/** A card's name: the orange square and a mono label — Home's tile header, in mono. */
function CardHead({ label }: { label: string }) {
  const { colors } = useColors();
  return (
    <View style={styles.cardHead}>
      <View style={styles.square} />
      <Mono size={11} tracking={0.6} color={colors.textSecondary}>
        {label.toUpperCase()}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", gap: Spacing.lg, padding: Spacing.huge },
  scroll: { paddingHorizontal: Spacing.screen },
  pressed: { transform: [{ scale: 0.96 }] },

  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  // A reading, not a button: filled, never outlined.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: Spacing.md,
    borderRadius: 15,
  },
  headline: { marginTop: 2 },
  block: { marginTop: Spacing.lg },

  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 20 },
  square: { width: 8, height: 8, borderRadius: 2, backgroundColor: HOME_ORANGE },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: Spacing.sm },
  stat: { width: "50%", paddingVertical: Spacing.md, gap: 2 },
  statRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  statValue: { fontVariant: ["tabular-nums"] },

  coachMsg: { lineHeight: 24, marginTop: Spacing.sm },
  muscles: { marginTop: Spacing.md },

  splitsCard: { paddingHorizontal: 0, paddingBottom: Spacing.sm },
  splitsHead: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs },
  splitBlock: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  split: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  splitIndex: { width: 20 },
  splitTime: { fontVariant: ["tabular-nums"] },
  splitMark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  actions: { gap: Spacing.sm, marginTop: Spacing.xl },
});

/**
 * Route-level boundary. This screen is the last thing a workout touches, so a
 * throw here reads to the athlete as "the app crashed during my session" — it
 * shows a recoverable error screen instead.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="session-summary" />;
}
