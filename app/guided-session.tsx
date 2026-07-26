/**
 * GUIDED SESSION — the live workout player.
 *
 * A deliberately simple, single-focus flow. Every phase is its OWN full screen;
 * nothing is ever layered on top of anything else:
 *
 *   INTRO ("about this session")
 *     → COUNTDOWN (3-2-1-GO + a form tip)
 *       → ACTIVE_SET (reps / sets counter)  ⇄  REST / TRANSITION
 *         → COMPLETE (celebration) → summary
 *
 * The SessionService owns the state machine, timers and persistence. Sessions
 * are never endless: each exercise runs to its recommended sets, and each set
 * to its recommended reps — a rep set auto-finishes when the target is reached
 * (with a short "keep going" grace so the athlete can add reps if they want).
 * Timed sets auto-finish when the clock runs out. Music/voice are intentionally
 * absent here — the module keeps that code, but the player no longer calls it.
 *
 * Header (all live phases): back · "this session" drill list · running clock ·
 * pause. Pause is a screen of its own, not an overlay. Fully offline; an
 * in-progress session persists so it can be resumed from the last position.
 */

import { AmbientCanvas, AppText, Button, IconBadge, useColors } from "@/components/ui";
import { RollingNumber, enterHero, enterPhase, exitPhase } from "@/components/motion";
import { Confetti } from "@/components/Confetti";
import { getCountdownLine } from "@/services/CoachEngine";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Gradients, Palette, Radius, Spacing, alpha, type ThemeColors } from "@/constants/theme";
import {
  SessionExerciseInfo,
  SessionState,
  parseTargetReps,
} from "@/models/session";
import { SessionService } from "@/services/SessionService";
import { useWorkout } from "@/contexts/AppContext";
import { TrainingGauge } from "@/fitness/components/TrainingGauge";
import { ExerciseGuideSheet } from "@/fitness/components/ExerciseGuideSheet";
import { workoutFromSessionId } from "@/fitness/services/WorkoutCatalog";
import type { PlannedExercise } from "@/models/workout";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Reanimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const service = SessionService.getInstance();

/** Triumphant gold ramp for the completion dial + "target reached" state. */
const GOLD_GRADIENT = ["#FFE39A", "#F5C451", "#E39B2E"] as const;

/** How long a rep set lingers after hitting target before easing into rest. */
const GRACE_MS = 2200;

function getDifficultyColor(d: string): string {
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

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PATTERN_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  push: "arrow-up",
  pull: "arrow-down",
  squat: "body",
  hinge: "barbell",
  core: "fitness",
  cardio: "heart",
  flexibility: "leaf",
  legs: "body",
};

function getPatternIcon(pattern: string): keyof typeof Ionicons.glyphMap {
  return PATTERN_ICON[pattern] || "barbell";
}

/**
 * Build a session entry from an AI-generated plan exercise. AI exercises aren't
 * in EXERCISE_DATABASE, so they carry their OWN how-to (setup / steps / cues) —
 * this keeps them out of the "dropped" bin and lets the session teach them.
 */
function plannedToSessionInfo(pe: PlannedExercise): SessionExerciseInfo {
  const timed = /sec|min/i.test(pe.reps);
  return {
    exerciseId: pe.exerciseId,
    name: pe.name,
    category: pe.category,
    difficulty: pe.difficulty,
    exerciseType: timed ? "timed" : "reps",
    sets: pe.sets,
    reps: pe.reps,
    restSeconds: pe.restSeconds,
    transitionSeconds: 30,
    setupPosition: pe.setupPosition ?? "",
    instructions: pe.steps ?? [],
    coachCues: pe.coachCues ?? [],
    icon: PATTERN_ICON[pe.movementPattern] ?? "barbell",
  };
}

function buildExerciseList(
  idsStr: string,
  planLookup: Map<string, PlannedExercise>,
  setsStr?: string,
  repsStr?: string,
): SessionExerciseInfo[] {
  const ids = idsStr.split(",").map((s) => s.trim());
  const setsArr = setsStr ? setsStr.split(",").map((s) => parseInt(s.trim(), 10)) : [];
  const repsArr = repsStr ? repsStr.split(",").map((s) => s.trim()) : [];

  return ids
    .map((id, i) => {
      const dbEntry = EXERCISE_DATABASE.find((e) => e.id === id);
      if (dbEntry) {
        return {
          exerciseId: dbEntry.id,
          name: dbEntry.name,
          category: dbEntry.category,
          difficulty: dbEntry.difficulty,
          exerciseType: dbEntry.exerciseType,
          sets: setsArr[i] || dbEntry.defaultSets,
          reps: repsArr[i] || dbEntry.defaultReps,
          restSeconds: dbEntry.restSeconds,
          transitionSeconds: 30,
          setupPosition: dbEntry.setupPosition,
          instructions: dbEntry.instructions,
          coachCues: dbEntry.coachCues,
          icon: dbEntry.icon,
        } as SessionExerciseInfo;
      }
      // Not in the local DB → an AI-generated exercise. Resolve it from the
      // current workout plan so it isn't dropped and keeps its how-to.
      const planned = planLookup.get(id);
      if (planned) {
        const info = plannedToSessionInfo(planned);
        if (setsArr[i]) info.sets = setsArr[i];
        if (repsArr[i]) info.reps = repsArr[i];
        return info;
      }
      return null;
    })
    .filter(Boolean) as SessionExerciseInfo[];
}

export default function GuidedSessionScreen() {
  const params = useLocalSearchParams<{
    exerciseIds: string;
    sessionLabel?: string;
    workoutSessionId?: string;
    sets?: string;
    reps?: string;
    /** "1" → restore the persisted in-progress session instead of starting fresh. */
    resume?: string;
  }>();
  const router = useRouter();
  const { colors } = useColors();
  const { workoutPlan } = useWorkout();
  const { width, height } = useWindowDimensions();

  // The hero dial sizes to the viewport — bounded by BOTH axes so the
  // header / dial / controls stack never collides on shorter screens.
  const gaugeSize = Math.min(width - 120, height * 0.34, 300);

  // Map every plan exercise by id so AI-generated moves (not in the local DB)
  // resolve with their how-to.
  const planLookup = useMemo(() => {
    const map = new Map<string, PlannedExercise>();
    workoutPlan?.sessions.forEach((s) =>
      s.exercises.forEach((e) => map.set(e.exerciseId, e)),
    );
    return map;
  }, [workoutPlan]);

  const exercises = useMemo(
    () => buildExerciseList(params.exerciseIds || "", planLookup, params.sets, params.reps),
    [params.exerciseIds, params.sets, params.reps, planLookup],
  );

  const isResume = params.resume === "1";

  // `null` only while a resumed session is being restored from storage —
  // fresh sessions initialize synchronously (starting on the INTRO screen).
  const [state, setState] = useState<SessionState | null>(() =>
    isResume
      ? null
      : service.createSession(
          params.workoutSessionId || "single",
          params.sessionLabel || "Exercise Session",
          exercises,
        ),
  );

  // Resume: restore the persisted in-progress session (crash/app-restart
  // recovery). Falls back to Fitness home if nothing restorable exists.
  useEffect(() => {
    if (!isResume) return;
    let mounted = true;
    void service.loadSession().then((saved) => {
      if (!mounted) return;
      if (saved && saved.phase !== "COMPLETE" && saved.exercises.length > 0) {
        // Come back paused so the athlete chooses when the clock restarts.
        setState({ ...saved, isPaused: true });
      } else {
        router.replace("/(tabs)/exercise");
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResume]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest state, readable inside callbacks that run side effects (leaving the
  // player) without threading it through — avoids stale closures and keeps
  // side effects out of setState updaters.
  const stateRef = useRef<SessionState | null>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Library workouts speak in "rounds" for interval styles, "sets" for lifting.
  const lapWord = useMemo(() => {
    const lib = workoutFromSessionId(state?.workoutSessionId ?? "");
    return lib && ["hiit", "cardio", "power", "endurance"].includes(lib.style)
      ? "Round"
      : "Set";
  }, [state?.workoutSessionId]);

  const [showDrills, setShowDrills] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Moving to a different exercise closes the guide — its content belonged to
  // the previous move.
  useEffect(() => {
    setShowGuide(false);
  }, [state?.currentExerciseIndex]);

  // ── Tick loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (
      !state ||
      state.phase === "INTRO" ||
      state.phase === "COMPLETE" ||
      state.phase === "SUMMARY"
    ) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || prev.isPaused) return prev;
        const next = service.tick(prev);
        if (next.elapsedSeconds % 10 === 0) {
          service.saveSession(next);
        }
        return next;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state) return;
    if (state.phase === "COMPLETE") {
      const summary = service.buildSummary(state);
      service.saveSummary(summary);
      service.clearSession();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Let the celebration land before the summary takes over.
      const timer = setTimeout(() => {
        router.replace({
          pathname: "/session-summary",
          params: { data: JSON.stringify(summary) },
        });
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Mutate state through the service and persist immediately (resume safety). */
  const applyAction = useCallback(
    (fn: (s: SessionState) => SessionState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        if (next !== prev && next.phase !== "COMPLETE" && next.phase !== "INTRO") {
          void service.saveSession(next);
        }
        return next;
      });
    },
    [],
  );

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    applyAction((s) => service.startSession(s));
  }, [applyAction]);

  const handleAddRep = useCallback(() => {
    setState((prev) => (prev ? service.addRep(prev) : prev));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleCompleteSet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    applyAction((s) => service.completeSet(s));
  }, [applyAction]);

  const handleSkipRest = useCallback(() => {
    setState((prev) => (prev ? service.skipRest(prev) : prev));
  }, []);

  const handleAddRest = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState((prev) => (prev ? service.addRestTime(prev, 20) : prev));
  }, []);

  const handleSkipExercise = useCallback(() => {
    applyAction((s) => service.skipExercise(s));
  }, [applyAction]);

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    applyAction((s) => service.goBack(s));
  }, [applyAction]);

  const handleTogglePause = useCallback(() => {
    applyAction((s) => service.togglePause(s));
  }, [applyAction]);

  /** End the workout now → tally what was done and roll into the summary. */
  const handleEnd = useCallback(() => {
    Alert.alert("End session?", "We'll tally what you've done so far.", [
      { text: "Keep training", style: "cancel" },
      {
        text: "End session",
        style: "destructive",
        onPress: () => setState((prev) => (prev ? service.stopSession(prev) : prev)),
      },
    ]);
  }, []);

  /** Leave the player but keep the session — it stays resumable from Fitness. */
  const handleLeave = useCallback(() => {
    const s = stateRef.current;
    // On the intro (never started) there's nothing to resume — just go back.
    if (!s || s.phase === "INTRO") {
      router.back();
      return;
    }
    Alert.alert("Leave workout?", "Your progress is saved — resume anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        onPress: () => {
          void service.saveSession({ ...s, isPaused: true });
          router.back();
        },
      },
    ]);
  }, [router]);

  // While a resumed session is being restored, hold a quiet placeholder.
  if (!state) {
    return (
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.resumeLoading]}>
          <IconBadge name="hourglass-outline" tone={colors.primary} size={64} />
          <AppText variant="headline">Restoring your session…</AppText>
        </SafeAreaView>
      </View>
    );
  }

  const currentEx = state.exercises[state.currentExerciseIndex];
  const exerciseProgress = `${state.currentExerciseIndex + 1} / ${state.exercises.length}`;
  const diffColor = currentEx ? getDifficultyColor(currentEx.difficulty) : colors.primary;
  const overallPct = Math.round(
    (state.currentExerciseIndex / Math.max(1, state.exercises.length)) * 100,
  );

  const isLivePhase =
    state.phase === "COUNTDOWN" ||
    state.phase === "ACTIVE_SET" ||
    state.phase === "REST" ||
    state.phase === "TRANSITION";

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex}>
        {/* Header + slim progress — only on live phases, never on intro/complete */}
        {isLivePhase && (
          <>
            <SessionHeader
              label={state.sessionLabel}
              elapsed={formatTime(state.elapsedSeconds)}
              overallPct={overallPct}
              isPaused={state.isPaused}
              colors={colors}
              onBack={handleLeave}
              onDrills={() => setShowDrills(true)}
              onTogglePause={handleTogglePause}
            />
            <ProgressSegments
              count={state.exercises.length}
              currentIndex={state.currentExerciseIndex}
              colors={colors}
            />
          </>
        )}

        {/* One phase on screen at a time — each fills the stage, nothing overlaps. */}
        <View style={styles.main}>
          {state.phase === "INTRO" && (
            <IntroView
              label={state.sessionLabel}
              exercises={state.exercises}
              lapWord={lapWord}
              colors={colors}
              onStart={handleStart}
              onBack={handleLeave}
            />
          )}

          {isLivePhase && state.isPaused && (
            <PauseView
              elapsed={formatTime(state.elapsedSeconds)}
              exerciseName={currentEx?.name ?? ""}
              exerciseProgress={exerciseProgress}
              colors={colors}
              onResume={handleTogglePause}
              onEnd={handleEnd}
            />
          )}

          {isLivePhase && !state.isPaused && (
            <Reanimated.View
              key={state.phase === "TRANSITION" ? "REST" : state.phase}
              entering={enterPhase()}
              exiting={exitPhase()}
              style={styles.phasePane}
            >
              {state.phase === "COUNTDOWN" && (
                <CountdownView
                  value={state.countdownValue}
                  exercise={currentEx}
                  tip={getCountdownLine(state.countdownValue).text}
                  colors={colors}
                  size={gaugeSize}
                />
              )}

              {state.phase === "ACTIVE_SET" && currentEx && (
                <ActiveSetView
                  key={`${state.currentExerciseIndex}-${state.currentSet}`}
                  exercise={currentEx}
                  setNumber={state.currentSet}
                  totalSets={currentEx.sets}
                  reps={state.currentReps}
                  timer={state.timerValue}
                  exerciseProgress={exerciseProgress}
                  diffColor={diffColor}
                  colors={colors}
                  lapWord={lapWord}
                  size={gaugeSize}
                  onAddRep={handleAddRep}
                  onCompleteSet={handleCompleteSet}
                  onSkipExercise={handleSkipExercise}
                  onPrev={handlePrev}
                  onShowGuide={() => setShowGuide(true)}
                />
              )}

              {(state.phase === "REST" || state.phase === "TRANSITION") && (
                <RestView
                  timeRemaining={state.timerValue}
                  totalSeconds={
                    state.phase === "TRANSITION"
                      ? state.exercises[state.currentExerciseIndex + 1]?.transitionSeconds ?? 30
                      : currentEx?.restSeconds ?? 60
                  }
                  isTransition={state.phase === "TRANSITION"}
                  nextExercise={
                    state.phase === "TRANSITION"
                      ? state.exercises[state.currentExerciseIndex + 1]
                      : undefined
                  }
                  nextSetNumber={state.phase === "REST" ? state.currentSet + 1 : 1}
                  totalSets={currentEx?.sets || 0}
                  lapWord={lapWord}
                  colors={colors}
                  size={gaugeSize}
                  onSkip={handleSkipRest}
                  onAddTime={handleAddRest}
                  onPrev={handlePrev}
                />
              )}
            </Reanimated.View>
          )}

          {state.phase === "COMPLETE" && (
            <CompletionView state={state} colors={colors} size={gaugeSize} />
          )}
        </View>
      </SafeAreaView>

      {/* "This session" — the whole workout at a glance */}
      <DrillListModal
        visible={showDrills}
        onClose={() => setShowDrills(false)}
        state={state}
        colors={colors}
      />

      {/* How-to guide — demo, steps, muscle map; everything instructional lives
          here so the live set screen stays a single-focus counter. */}
      <ExerciseGuideSheet
        visible={showGuide}
        onClose={() => setShowGuide(false)}
        exercise={currentEx}
      />
    </View>
  );
}

/* ─────────────────────────────── Header ────────────────────────────────── */

function SessionHeader({
  label,
  elapsed,
  overallPct,
  isPaused,
  colors,
  onBack,
  onDrills,
  onTogglePause,
}: {
  label: string;
  elapsed: string;
  overallPct: number;
  isPaused: boolean;
  colors: ThemeColors;
  onBack: () => void;
  onDrills: () => void;
  onTogglePause: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <HeaderButton icon="chevron-back" label="Leave workout" onPress={onBack} colors={colors} />
      <View style={styles.topCenter}>
        <AppText variant="callout" numberOfLines={1}>
          {label}
        </AppText>
        <View style={styles.clockRow}>
          <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
          <AppText variant="footnote" color="tertiary">
            {elapsed} · {overallPct}%
          </AppText>
        </View>
      </View>
      <HeaderButton icon="list" label="This session" onPress={onDrills} colors={colors} />
      <HeaderButton
        icon={isPaused ? "play" : "pause"}
        label={isPaused ? "Resume" : "Pause"}
        onPress={onTogglePause}
        colors={colors}
      />
    </View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.topBtn,
        { backgroundColor: colors.surfaceMuted },
        pressed && styles.pressed,
      ]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function ProgressSegments({
  count,
  currentIndex,
  colors,
}: {
  count: number;
  currentIndex: number;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.segments}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor:
                i < currentIndex
                  ? colors.primary
                  : i === currentIndex
                    ? alpha(colors.primary, 0.45)
                    : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ──────────────────────────────── Intro ────────────────────────────────── */

function IntroView({
  label,
  exercises,
  lapWord,
  colors,
  onStart,
  onBack,
}: {
  label: string;
  exercises: SessionExerciseInfo[];
  lapWord: string;
  colors: ThemeColors;
  onStart: () => void;
  onBack: () => void;
}) {
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);

  return (
    <View style={styles.intro}>
      <View style={styles.introTopBar}>
        <HeaderButton icon="chevron-back" label="Back" onPress={onBack} colors={colors} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.introScroll}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="caption" color="tertiary" uppercase>
          About this session
        </AppText>
        <AppText variant="display" style={styles.introTitle}>
          {label}
        </AppText>
        <View style={styles.introMeta}>
          <IntroChip
            icon="barbell-outline"
            text={`${exercises.length} exercise${exercises.length === 1 ? "" : "s"}`}
            colors={colors}
          />
          <IntroChip
            icon="layers-outline"
            text={`${totalSets} ${lapWord.toLowerCase()}${totalSets === 1 ? "" : "s"}`}
            colors={colors}
          />
        </View>

        <View style={styles.introList}>
          {exercises.map((ex, i) => (
            <View
              key={`${ex.exerciseId}-${i}`}
              style={[
                styles.introRow,
                i < exercises.length - 1 && {
                  borderBottomColor: colors.divider,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.introNum, { backgroundColor: alpha(colors.primary, 0.12) }]}>
                <AppText variant="footnote" color="brand" weight="700">
                  {i + 1}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="body" numberOfLines={1}>
                  {ex.name}
                </AppText>
              </View>
              <AppText variant="footnote" color="tertiary">
                {ex.sets} × {ex.reps}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.introFooter}>
        <Button label="Begin" icon="play" onPress={onStart} />
      </View>
    </View>
  );
}

function IntroChip({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.introChip, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <AppText variant="footnote" color="secondary">
        {text}
      </AppText>
    </View>
  );
}

/* ─────────────────────────────── Countdown ─────────────────────────────── */

function CountdownView({
  value,
  exercise,
  tip,
  colors,
  size,
}: {
  value: number;
  exercise?: SessionExerciseInfo;
  tip: string;
  colors: ThemeColors;
  size: number;
}) {
  const isGo = value === 0;
  // The dial charges to full on GO, so the countdown reads as building energy
  // rather than draining time.
  const progress = isGo ? 1 : (3 - value) / 3;
  // A rotating form cue for the move that's coming up.
  const cue = exercise?.coachCues?.[0];

  return (
    <View style={styles.phaseColumn}>
      <View style={styles.phaseTop}>
        <AppText variant="caption" color="tertiary" uppercase>
          Get ready
        </AppText>
      </View>

      <View style={styles.heroZone}>
        <TrainingGauge progress={progress} size={size} pulse>
          <Reanimated.Text
            key={value}
            entering={enterHero()}
            style={[
              styles.gaugeBigNumber,
              {
                color: colors.text,
                fontSize: Math.round(size * 0.34),
                lineHeight: Math.round(size * 0.36),
              },
            ]}
          >
            {isGo ? "GO" : value}
          </Reanimated.Text>
        </TrainingGauge>

        <View style={styles.firstUp}>
          <AppText variant="caption" color="tertiary" uppercase>
            First up
          </AppText>
          <AppText variant="title" align="center" numberOfLines={2}>
            {exercise?.name ?? ""}
          </AppText>
        </View>
      </View>

      <View style={styles.phaseBottom}>
        <View style={[styles.tipBar, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="bulb-outline" size={15} color={colors.primary} />
          <AppText variant="footnote" color="secondary" style={styles.flex} numberOfLines={2}>
            {cue || tip}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/* ────────────────────────────── Active set ─────────────────────────────── */

type SetPhase = "counting" | "grace" | "extended";

function ActiveSetView({
  exercise,
  setNumber,
  totalSets,
  reps,
  timer,
  exerciseProgress,
  diffColor,
  colors,
  lapWord,
  size,
  onAddRep,
  onCompleteSet,
  onSkipExercise,
  onPrev,
  onShowGuide,
}: {
  exercise: SessionExerciseInfo;
  setNumber: number;
  totalSets: number;
  reps: number;
  timer: number;
  exerciseProgress: string;
  diffColor: string;
  colors: ThemeColors;
  lapWord: string;
  size: number;
  onAddRep: () => void;
  onCompleteSet: () => void;
  onSkipExercise: () => void;
  onPrev: () => void;
  onShowGuide: () => void;
}) {
  const isTimed = exercise.exerciseType === "timed";
  const targetSec = isTimed ? parseTargetReps(exercise.reps) : 0;
  const targetReps = !isTimed ? parseTargetReps(exercise.reps) : 0;

  // Rep-set lifecycle: count toward the recommended reps → on hitting them the
  // set eases into rest (grace), unless the athlete chooses to keep going.
  const [setPhase, setSetPhase] = useState<SetPhase>("counting");
  const reachedTarget = !isTimed && targetReps > 0 && reps >= targetReps;

  // Enter the grace window the moment the target is first reached.
  useEffect(() => {
    if (setPhase === "counting" && reachedTarget) {
      setSetPhase("grace");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [reachedTarget, setPhase]);

  // Grace → auto-finish into rest after a short pause.
  useEffect(() => {
    if (setPhase !== "grace") return;
    const t = setTimeout(onCompleteSet, GRACE_MS);
    return () => clearTimeout(t);
  }, [setPhase, onCompleteSet]);

  const keepGoing = useCallback(() => setSetPhase("extended"), []);

  // Tapping the dial during grace means "I'm doing more" → stay in the set.
  const tapRep = useCallback(() => {
    if (setPhase === "grace") setSetPhase("extended");
    onAddRep();
  }, [setPhase, onAddRep]);

  const hot = isTimed
    ? targetSec > 0 && targetSec - timer <= 5 && targetSec - timer >= 0 && timer > 0
    : setPhase !== "counting";

  const progress = isTimed
    ? targetSec > 0
      ? Math.min(1, timer / targetSec)
      : 0
    : targetReps > 0
      ? Math.min(1, reps / targetReps)
      : 0;

  const gradient = hot ? GOLD_GRADIENT : colors.brandGradient;
  const numColor = hot ? Palette.warning : colors.text;

  const readout = (
    <View style={styles.readout} pointerEvents="none">
      <RollingNumber
        value={isTimed ? formatTime(timer) : reps}
        color={numColor}
        textStyle={[
          styles.readoutNumber,
          isTimed
            ? { fontSize: Math.round(size * 0.2), lineHeight: Math.round(size * 0.22) }
            : { fontSize: Math.round(size * 0.32), lineHeight: Math.round(size * 0.34) },
        ]}
      />
      <AppText variant="footnote" color="tertiary" style={styles.readoutSub}>
        {isTimed ? `of ${exercise.reps}` : `of ${exercise.reps} reps`}
      </AppText>
    </View>
  );

  const dial = (
    <TrainingGauge progress={progress} size={size} gradient={gradient} pulse={hot}>
      {readout}
    </TrainingGauge>
  );

  return (
    <View style={styles.phaseColumn}>
      {/* Header zone — name, set dots, recommended target */}
      <View style={styles.phaseTop}>
        <AppText variant="caption" color="tertiary" uppercase>
          Exercise {exerciseProgress}
        </AppText>
        <AppText variant="title" align="center" numberOfLines={1} style={styles.activeName}>
          {exercise.name}
        </AppText>
        <View style={styles.setDots}>
          {Array.from({ length: totalSets }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.setDot,
                {
                  backgroundColor:
                    i < setNumber - 1
                      ? colors.primary
                      : i === setNumber - 1
                        ? diffColor
                        : colors.border,
                },
              ]}
            />
          ))}
          <AppText variant="footnote" color="secondary" style={styles.setLabel}>
            {lapWord} {setNumber}/{totalSets}
          </AppText>
        </View>
      </View>

      {/* Hero zone — the counter; tap the dial to count reps */}
      <View style={styles.heroZone}>
        {isTimed ? (
          dial
        ) : (
          <Pressable
            onPress={tapRep}
            accessibilityRole="button"
            accessibilityLabel="Count a rep"
            style={({ pressed }) => (pressed ? styles.dialPressed : undefined)}
          >
            {dial}
          </Pressable>
        )}
        {isTimed ? (
          <AppText variant="caption" color="tertiary" uppercase>
            Hold the position
          </AppText>
        ) : setPhase === "counting" ? (
          <View style={[styles.tapHint, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="add-circle" size={14} color={colors.primary} />
            <AppText variant="caption" color="brand" uppercase>
              Tap dial to count
            </AppText>
          </View>
        ) : (
          <View style={[styles.tapHint, { borderColor: alpha(Palette.warning, 0.4), backgroundColor: alpha(Palette.warning, 0.12) }]}>
            <Ionicons name="checkmark-circle" size={14} color={Palette.warning} />
            <AppText variant="caption" uppercase style={{ color: Palette.warning, fontWeight: "700" }}>
              {setPhase === "grace" ? "Target reached · resting soon" : "Bonus reps — nice"}
            </AppText>
          </View>
        )}
      </View>

      {/* Footer zone — how-to, the finish action, and secondary controls */}
      <View style={styles.phaseBottom}>
        <View style={styles.metaRow}>
          <Pressable
            onPress={onShowGuide}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="How to perform this exercise"
            style={[styles.howToPill, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="help-circle-outline" size={15} color={colors.primary} />
            <AppText variant="caption" color="brand" uppercase>
              How to
            </AppText>
          </Pressable>
        </View>

        {setPhase === "grace" && !isTimed ? (
          <Button label="Keep going" icon="add" variant="tonal" onPress={keepGoing} />
        ) : (
          <Button label="Done set" icon="checkmark" onPress={onCompleteSet} />
        )}

        <View style={styles.secondaryRow}>
          <Button label="Previous" icon="play-skip-back" variant="ghost" size="sm" fullWidth={false} onPress={onPrev} />
          <Button label="Skip exercise" icon="play-skip-forward" variant="ghost" size="sm" fullWidth={false} onPress={onSkipExercise} />
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────────────── Rest ────────────────────────────────── */

function RestView({
  timeRemaining,
  totalSeconds,
  isTransition,
  nextExercise,
  nextSetNumber,
  totalSets,
  lapWord,
  colors,
  size,
  onSkip,
  onAddTime,
  onPrev,
}: {
  timeRemaining: number;
  totalSeconds: number;
  isTransition: boolean;
  nextExercise?: SessionExerciseInfo;
  nextSetNumber: number;
  totalSets: number;
  lapWord: string;
  colors: ThemeColors;
  size: number;
  onSkip: () => void;
  onAddTime: () => void;
  onPrev: () => void;
}) {
  // The dial drains as the clock winds down — recovery, visualized.
  const progress =
    totalSeconds > 0 ? Math.max(0, Math.min(1, timeRemaining / totalSeconds)) : 0;
  const gradient = isTransition ? colors.brandGradient : Gradients.water;

  return (
    <View style={styles.phaseColumn}>
      <View style={styles.phaseTop}>
        <AppText variant="caption" color="tertiary" uppercase>
          {isTransition ? "Up next" : "Recover"}
        </AppText>
      </View>

      <View style={styles.heroZone}>
        <TrainingGauge progress={progress} size={size} gradient={gradient} pulse>
          <View style={styles.readout} pointerEvents="none">
            <AppText variant="caption" color="tertiary" uppercase>
              {isTransition ? "Starts in" : "Rest"}
            </AppText>
            <RollingNumber
              value={formatTime(timeRemaining)}
              direction="down"
              color={colors.text}
              textStyle={[
                styles.readoutNumber,
                { fontSize: Math.round(size * 0.22), lineHeight: Math.round(size * 0.24) },
              ]}
            />
          </View>
        </TrainingGauge>

        <View style={styles.restNextInfo}>
          {isTransition && nextExercise ? (
            <>
              <AppText variant="headline" align="center" numberOfLines={1}>
                {nextExercise.name}
              </AppText>
              <AppText variant="footnote" color="tertiary" align="center">
                {nextExercise.sets} {lapWord.toLowerCase()}
                {nextExercise.sets === 1 ? "" : "s"} × {nextExercise.reps}
              </AppText>
            </>
          ) : (
            <AppText variant="body" color="secondary" align="center">
              Next · {lapWord} {nextSetNumber} of {totalSets}
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.phaseBottom}>
        <View style={styles.controls}>
          <Button label="Previous" icon="play-skip-back" variant="ghost" size="sm" fullWidth={false} onPress={onPrev} />
          <Button label="+20s" icon="add" variant="tonal" size="sm" fullWidth={false} onPress={onAddTime} />
          <Button label="Skip rest" icon="play-skip-forward" variant="ghost" size="sm" fullWidth={false} onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────────────── Pause ───────────────────────────────── */

function PauseView({
  elapsed,
  exerciseName,
  exerciseProgress,
  colors,
  onResume,
  onEnd,
}: {
  elapsed: string;
  exerciseName: string;
  exerciseProgress: string;
  colors: ThemeColors;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <View style={styles.pause}>
      <View style={styles.pauseHero}>
        <IconBadge name="pause" tone={colors.primary} size={72} />
        <AppText variant="display" style={styles.pauseTitle}>
          Paused
        </AppText>
        <AppText variant="subhead" color="secondary" align="center">
          {exerciseName ? `${exerciseName} · Exercise ${exerciseProgress}` : ""}
        </AppText>
        <AppText variant="footnote" color="tertiary" style={styles.pauseClock}>
          {elapsed} elapsed
        </AppText>
      </View>
      <View style={styles.pauseControls}>
        <Button label="Resume" icon="play" onPress={onResume} />
        <Button label="End session" variant="ghost" onPress={onEnd} />
      </View>
    </View>
  );
}

/* ─────────────────────────────── Completion ────────────────────────────── */

/** The dial floods gold and locks at full around a checkmark while confetti
 *  flies; one hero moment, then the summary takes over. */
function CompletionView({
  state,
  colors,
  size,
}: {
  state: SessionState;
  colors: ThemeColors;
  size: number;
}) {
  const doneCount = state.results.filter((r) => !r.skipped).length;
  const totalReps = state.results.reduce((sum, r) => sum + r.totalReps, 0);
  const dialSize = Math.round(size * 0.82);

  return (
    <View style={styles.complete}>
      <Reanimated.View entering={enterHero()} style={styles.completeHero}>
        <TrainingGauge progress={1} size={dialSize} gradient={GOLD_GRADIENT} pulse>
          <Ionicons name="checkmark-sharp" size={Math.round(dialSize * 0.42)} color={colors.gold} />
        </TrainingGauge>
        <Text style={[styles.completeHeadline, { color: colors.text }]}>Session complete</Text>
        <AppText variant="subhead" color="secondary" align="center">
          {doneCount} exercise{doneCount === 1 ? "" : "s"}
          {totalReps > 0 ? ` · ${totalReps} reps` : ""} · {formatTime(state.elapsedSeconds)}
        </AppText>
        <AppText variant="footnote" color="tertiary" style={styles.completeSub}>
          Tallying your numbers…
        </AppText>
      </Reanimated.View>
      <Confetti tierColor={colors.gold} intensity={0.9} />
    </View>
  );
}

/* ─────────────────────────── Drill list modal ─────────────────────────── */

function DrillListModal({
  visible,
  onClose,
  state,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  state: SessionState;
  colors: ThemeColors;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.drillScrim}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close drill list" />
        <View style={[styles.drillSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.drillHandleRow}>
            <View style={[styles.drillHandle, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.drillHead}>
            <AppText variant="headline" style={styles.flex}>
              This session
            </AppText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.drillList} showsVerticalScrollIndicator={false}>
            {state.exercises.map((ex, i) => {
            const result = state.results.find((r) => r.exerciseId === ex.exerciseId);
            const isCurrent =
              i === state.currentExerciseIndex &&
              state.phase !== "COMPLETE" &&
              state.phase !== "INTRO";
            const isDone = i < state.currentExerciseIndex || state.phase === "COMPLETE";
            const skipped = result?.skipped === true && isDone;
            return (
              <View
                key={`${ex.exerciseId}-${i}`}
                style={[
                  styles.drillRow,
                  { borderBottomColor: colors.divider },
                  isCurrent && { backgroundColor: alpha(colors.primary, 0.08), borderRadius: Radius.sm },
                ]}
              >
                <View
                  style={[
                    styles.drillStatus,
                    {
                      backgroundColor: skipped
                        ? alpha(colors.warning, 0.16)
                        : isDone
                          ? alpha(colors.success, 0.16)
                          : isCurrent
                            ? alpha(colors.primary, 0.16)
                            : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      skipped
                        ? "play-skip-forward"
                        : isDone
                          ? "checkmark"
                          : isCurrent
                            ? "play"
                            : getPatternIcon(ex.category)
                    }
                    size={15}
                    color={
                      skipped
                        ? colors.warning
                        : isDone
                          ? colors.success
                          : isCurrent
                            ? colors.primary
                            : colors.textTertiary
                    }
                  />
                </View>
                <View style={styles.flex}>
                  <AppText variant="body" numberOfLines={1}>
                    {ex.name}
                  </AppText>
                  <AppText variant="caption" color="tertiary">
                    {ex.sets} × {ex.reps}
                    {skipped ? " · skipped" : isCurrent ? " · now" : ""}
                  </AppText>
                </View>
              </View>
            );
          })}
            <View style={styles.drillFooterPad} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.85 },
  topCenter: { flex: 1, alignItems: "center" },
  clockRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },

  segments: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screen,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  segment: { flex: 1, height: 4, borderRadius: 2 },

  // Phase panes fill the stage so the crossfade overlaps cleanly (never a
  // split-height squish while one enters and one exits).
  main: { flex: 1 },
  phasePane: { ...StyleSheet.absoluteFillObject },

  // Shared phase scaffold — three fixed zones: pinned header, hero dial, pinned
  // footer. A single flex:1 hero in a space-between column guarantees the
  // header stays up top and the controls stay docked, so nothing ever overlaps.
  phaseColumn: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  phaseTop: { alignItems: "center", gap: 2 },
  phaseBottom: { gap: Spacing.md },
  heroZone: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },

  // Countdown
  gaugeBigNumber: { fontWeight: "800", letterSpacing: -2, textAlign: "center" },
  firstUp: { alignItems: "center", gap: Spacing.xs },
  tipBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },

  // Active
  activeName: { marginTop: 2 },
  setDots: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.xs },
  setDot: { width: 11, height: 11, borderRadius: 6 },
  setLabel: { marginLeft: 4, fontWeight: "600" },

  readout: { alignItems: "center" },
  readoutNumber: { fontWeight: "800", letterSpacing: -1, textAlign: "center" },
  readoutSub: { marginTop: 2 },

  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dialPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  howToPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  secondaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  controls: { flexDirection: "row", gap: Spacing.sm, alignItems: "center", justifyContent: "center" },

  // Rest
  restNextInfo: { alignItems: "center", gap: 2 },

  // Intro
  intro: { flex: 1 },
  introTopBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  introScroll: { paddingHorizontal: Spacing.screen, paddingBottom: Spacing.xl },
  introTitle: { marginTop: Spacing.xs, marginBottom: Spacing.lg },
  introMeta: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xl },
  introChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  introList: { gap: 0 },
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  introNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  introFooter: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },

  // Pause
  pause: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.lg,
  },
  pauseHero: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  pauseTitle: { marginTop: Spacing.md },
  pauseClock: { marginTop: Spacing.xs },
  pauseControls: { gap: Spacing.sm },

  // Complete
  complete: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  completeHero: { alignItems: "center" },
  completeHeadline: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  completeSub: { marginTop: Spacing.lg },

  resumeLoading: { justifyContent: "center", alignItems: "center", gap: Spacing.lg },

  // Drill list
  drillScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  drillSheet: {
    maxHeight: "72%",
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.screen,
  },
  drillHandleRow: { alignItems: "center", paddingTop: Spacing.sm },
  drillHandle: { width: 40, height: 4, borderRadius: 2 },
  drillHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  drillList: { flexGrow: 0 },
  drillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drillStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  drillFooterPad: { height: 32 },
});
