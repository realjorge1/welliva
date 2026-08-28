/**
 * GUIDED SESSION — the live workout player.
 *
 * ONE instrument, ONE stage, ONE dock. The old player rebuilt the whole screen
 * for every phase, which is what made the flow feel like it kept starting over;
 * this one keeps a single persistent SessionCore on stage and changes only what
 * it says. Phases flow through it:
 *
 *   INTRO ("about this session")
 *     → COUNTDOWN (a smooth 3-2-1-GO the player owns itself, not the 1Hz tick)
 *       → ACTIVE_SET (reps / seconds)  ⇄  REST / TRANSITION
 *         → COMPLETE (celebration) → summary
 *
 * The stage is four fixed-height zones — caption, hero, hint, dock — so nothing
 * ever reflows as the phase changes and no control moves under a thumb that was
 * already reaching for it. The dock keeps the same shape in every phase: one
 * primary action, then Previous · context · Pause · Skip.
 *
 * SessionService owns the state machine, persistence and results; it is pure,
 * and every side effect (saving, leaving) lives in an effect here rather than
 * inside a setState updater. Sessions are never endless: a rep set eases into
 * rest once its target is reached (with a visible, cancellable grace window),
 * a timed set finishes on the clock. Fully offline; an in-progress session
 * persists so it can be resumed from the last position.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { Confetti } from "@/components/Confetti";
import { RollingNumber, enterFade, enterHero, exitFade } from "@/components/motion";
import { AmbientCanvas, AppText, Button, IconBadge, Sheet, useColors } from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Gradients, Palette, Radius, Spacing, alpha, type ThemeColors } from "@/constants/theme";
import { useWorkout } from "@/contexts/AppContext";
import { ExerciseGuideSheet } from "@/fitness/components/ExerciseGuideSheet";
import { SessionCore } from "@/fitness/components/SessionCore";
import { workoutFromSessionId } from "@/fitness/services/WorkoutCatalog";
import {
  SessionExerciseInfo,
  SessionState,
  parseTargetReps,
} from "@/models/session";
import type { PlannedExercise } from "@/models/workout";
import { getCountdownLine } from "@/services/CoachEngine";
import { SessionService } from "@/services/SessionService";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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

/** Triumphant gold ramp for the completion core + "target reached" state. */
const GOLD_GRADIENT = ["#FFE39A", "#F5C451", "#E39B2E"] as const;

/** How long a rep set lingers after hitting target before easing into rest. */
const GRACE_MS = 3000;
/** The 3-2-1-GO the player runs itself, so it never rides the 1Hz session tick. */
const COUNT_FROM = 3;
const GO_HOLD_MS = 450;

/** Fixed stage zones — the reason nothing on this screen ever moves. */
const CAPTION_ZONE = 96;
const HINT_ZONE = 58;

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

type SetPhase = "counting" | "grace" | "extended";

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

  // The hero core sizes to the viewport — bounded by BOTH axes so the caption /
  // core / hint / dock stack never collides on shorter screens.
  const coreSize = Math.min(width - 112, height * 0.3, 300);

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

  // Latest state, readable inside effects and callbacks that run side effects
  // without threading it through — no stale closures, and no side effects
  // smuggled into a setState updater.
  const stateRef = useRef<SessionState | null>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const phase = state?.phase;
  const isPaused = state?.isPaused ?? false;

  // Library workouts speak in "rounds" for interval styles, "sets" for lifting.
  const lapWord = useMemo(() => {
    const lib = workoutFromSessionId(state?.workoutSessionId ?? "");
    return lib && ["hiit", "cardio", "power", "endurance"].includes(lib.style)
      ? "Round"
      : "Set";
  }, [state?.workoutSessionId]);

  const [showDrills, setShowDrills] = useState(false);
  /**
   * Which exercise the how-to is open on, or null when it's closed. Holding the
   * exercise itself (rather than a boolean plus "whatever is current") is what
   * lets the guide be opened from the intro list and the drill list — the
   * how-to should never be something you can only reach mid-set.
   */
  const [guideFor, setGuideFor] = useState<SessionExerciseInfo | null>(null);
  const closeGuide = useCallback(() => setGuideFor(null), []);

  /** Open the how-to from the drill list without stacking sheet on sheet. */
  const openGuideFromDrills = useCallback((ex: SessionExerciseInfo) => {
    setShowDrills(false);
    setGuideFor(ex);
  }, []);

  /* ── Tick loop ────────────────────────────────────────────────────────
   * COUNTDOWN is deliberately excluded: the player runs its own smooth 3-2-1
   * below, and the workout clock only starts once the first set opens. */
  useEffect(() => {
    if (
      !phase ||
      phase === "INTRO" ||
      phase === "COUNTDOWN" ||
      phase === "COMPLETE" ||
      phase === "SUMMARY"
    ) {
      return;
    }
    const id = setInterval(() => {
      setState((prev) => (prev && !prev.isPaused ? service.tick(prev) : prev));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  /* ── Persistence ──────────────────────────────────────────────────────
   * Checkpointed rather than written on every tick: each phase/set change and
   * every ten seconds of training. Kept out of the reducer so React never runs
   * a disk write twice for one state transition. */
  const checkpoint = state
    ? `${state.phase}|${state.currentExerciseIndex}|${state.currentSet}|${Math.floor(state.elapsedSeconds / 10)}`
    : "";
  useEffect(() => {
    const s = stateRef.current;
    if (!s || s.phase === "INTRO" || s.phase === "COMPLETE" || s.phase === "SUMMARY") return;
    void service.saveSession(s);
  }, [checkpoint]);

  useEffect(() => {
    if (phase !== "COMPLETE") return;
    const s = stateRef.current;
    if (!s) return;
    const summary = service.buildSummary(s);
    void service.saveSummary(summary);
    void service.clearSession();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Let the celebration land before the summary takes over.
    const timer = setTimeout(() => {
      router.replace({
        pathname: "/session-summary",
        params: { data: JSON.stringify(summary) },
      });
    }, 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** Mutate state through the service. Pure — persistence is the effect above. */
  const applyAction = useCallback((fn: (s: SessionState) => SessionState) => {
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    applyAction((s) => service.startSession(s));
  }, [applyAction]);

  const handleBeginFirstSet = useCallback(() => {
    applyAction((s) => service.beginFirstSet(s));
  }, [applyAction]);

  const handleAddRep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    applyAction((s) => service.addRep(s));
  }, [applyAction]);

  const handleUndoRep = useCallback(() => {
    applyAction((s) => service.removeRep(s));
  }, [applyAction]);

  const handleCompleteSet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    applyAction((s) => service.completeSet(s));
  }, [applyAction]);

  const handleSkipRest = useCallback(() => {
    applyAction((s) => service.skipRest(s));
  }, [applyAction]);

  const handleAddRest = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    applyAction((s) => service.addRestTime(s, 20));
  }, [applyAction]);

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
        onPress: () => applyAction((s) => service.stopSession(s)),
      },
    ]);
  }, [applyAction]);

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

  /* ── The player's own countdown ───────────────────────────────────────
   * Anchored to wall-clock time so the digits land on the second even if the
   * JS thread hiccups, and paired with a core that charges continuously rather
   * than stepping three times. */
  const [countdown, setCountdown] = useState(COUNT_FROM);
  useEffect(() => {
    if (phase !== "COUNTDOWN" || isPaused) return;
    const startedAt = Date.now();
    setCountdown(COUNT_FROM);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= COUNT_FROM; i++) {
      timers.push(
        setTimeout(
          () => setCountdown(COUNT_FROM - i),
          Math.max(0, startedAt + i * 1000 - Date.now()),
        ),
      );
    }
    timers.push(setTimeout(handleBeginFirstSet, COUNT_FROM * 1000 + GO_HOLD_MS));
    return () => timers.forEach(clearTimeout);
  }, [phase, isPaused, handleBeginFirstSet]);

  /* ── Rep-set lifecycle ────────────────────────────────────────────────
   * Count toward the recommended reps → on hitting them the set eases into
   * rest through a VISIBLE grace window the athlete can cancel by carrying on. */
  const [setPhase, setSetPhase] = useState<SetPhase>("counting");
  const [graceLeft, setGraceLeft] = useState(0);

  useEffect(() => {
    setSetPhase("counting");
  }, [state?.currentExerciseIndex, state?.currentSet, phase]);

  const currentEx = state?.exercises[state.currentExerciseIndex];
  const isTimed = currentEx?.exerciseType === "timed";
  const targetReps = currentEx && !isTimed ? parseTargetReps(currentEx.reps) : 0;
  const targetSec = currentEx && isTimed ? parseTargetReps(currentEx.reps) : 0;
  const reps = state?.currentReps ?? 0;
  const reachedTarget =
    phase === "ACTIVE_SET" && !isTimed && targetReps > 0 && reps >= targetReps;

  useEffect(() => {
    if (setPhase === "counting" && reachedTarget) {
      setSetPhase("grace");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [reachedTarget, setPhase]);

  useEffect(() => {
    if (setPhase !== "grace") return;
    setGraceLeft(Math.round(GRACE_MS / 1000));
    const iv = setInterval(() => setGraceLeft((v) => Math.max(0, v - 1)), 1000);
    const done = setTimeout(handleCompleteSet, GRACE_MS);
    return () => {
      clearInterval(iv);
      clearTimeout(done);
    };
  }, [setPhase, handleCompleteSet]);

  /** Tapping the core during grace means "I'm doing more" → stay in the set. */
  const tapRep = useCallback(() => {
    setSetPhase((p) => (p === "grace" ? "extended" : p));
    handleAddRep();
  }, [handleAddRep]);

  const keepGoing = useCallback(() => setSetPhase("extended"), []);

  // While a resumed session is being restored, hold a quiet placeholder.
  if (!state) {
    return (
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.centerAll]}>
          <IconBadge name="hourglass-outline" tone={colors.primary} size={64} />
          <AppText variant="headline">Restoring your session…</AppText>
        </SafeAreaView>
      </View>
    );
  }

  // A session with nothing in it can't be played — say so instead of counting
  // reps of nothing.
  if (state.exercises.length === 0) {
    return (
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.centerAll]}>
          <IconBadge name="alert-circle-outline" tone={colors.warning} size={64} />
          <AppText variant="headline">Nothing to train here</AppText>
          <AppText variant="body" color="secondary" align="center">
            This session came through without any exercises.
          </AppText>
          <View style={styles.emptyAction}>
            <Button label="Back to Fitness" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const exerciseProgress = `${state.currentExerciseIndex + 1} / ${state.exercises.length}`;
  const diffColor = currentEx ? getDifficultyColor(currentEx.difficulty) : colors.primary;
  const overallPct = Math.round(
    (state.currentExerciseIndex / Math.max(1, state.exercises.length)) * 100,
  );

  const isLivePhase =
    phase === "COUNTDOWN" ||
    phase === "ACTIVE_SET" ||
    phase === "REST" ||
    phase === "TRANSITION";
  const isResting = phase === "REST" || phase === "TRANSITION";
  const isTransition = phase === "TRANSITION";
  const nextExercise = state.exercises[state.currentExerciseIndex + 1];
  /** Which move the caption's info affordance and the dock's "How to" open. */
  const guideTarget = isTransition ? nextExercise : currentEx;

  /* ── What the one instrument is showing right now ─────────────────── */

  const restTotal = isTransition
    ? nextExercise?.transitionSeconds ?? 30
    : currentEx?.restSeconds ?? 60;
  const timer = state.timerValue;

  // The final five seconds of a timed hold run hot, as does a rep set that has
  // already hit its target.
  const hot =
    phase === "ACTIVE_SET" &&
    (isTimed
      ? targetSec > 0 && targetSec - timer <= 5 && targetSec - timer >= 0 && timer > 0
      : setPhase !== "counting");

  let coreProgress = 0;
  let coreLinear = false;
  let coreDuration = 520;
  let coreGradient: readonly [string, string, ...string[]] = colors.brandGradient;

  if (phase === "COUNTDOWN") {
    // Charges up as the count runs down. The target is always one step AHEAD
    // of the digit on screen, so the cell glides continuously across the three
    // seconds and lands exactly full on GO instead of trailing a second behind.
    coreProgress = Math.min(1, (COUNT_FROM - countdown + 1) / COUNT_FROM);
    coreLinear = true;
    coreDuration = 1000;
  } else if (phase === "ACTIVE_SET") {
    coreProgress = isTimed
      ? targetSec > 0
        ? Math.min(1, timer / targetSec)
        : 0
      : targetReps > 0
        ? Math.min(1, reps / targetReps)
        : 0;
    coreLinear = isTimed;
    coreDuration = isTimed ? 1000 : 420;
    coreGradient = hot ? GOLD_GRADIENT : colors.brandGradient;
  } else if (isResting) {
    coreProgress = restTotal > 0 ? Math.max(0, Math.min(1, timer / restTotal)) : 0;
    coreLinear = true;
    coreDuration = 1000;
    coreGradient = isTransition ? colors.brandGradient : Gradients.water;
  }

  const corePulse = isResting || hot || phase === "COUNTDOWN";

  /* ── Caption / readout / hint / dock, per phase ────────────────────── */

  const caption =
    phase === "COUNTDOWN"
      ? { eyebrow: "Get ready", title: currentEx?.name ?? "", sub: "" }
      : phase === "ACTIVE_SET"
        ? { eyebrow: `Exercise ${exerciseProgress}`, title: currentEx?.name ?? "", sub: "" }
        : isTransition
          ? { eyebrow: "Up next", title: nextExercise?.name ?? "", sub: nextExercise ? `${nextExercise.sets} ${lapWord.toLowerCase()}${nextExercise.sets === 1 ? "" : "s"} × ${nextExercise.reps}` : "" }
          : {
              eyebrow: "Recover",
              title: currentEx?.name ?? "",
              sub: `Next · ${lapWord} ${state.currentSet + 1} of ${currentEx?.sets ?? 0}`,
            };

  const coachCue = currentEx?.coachCues?.[0] ?? getCountdownLine(countdown).text;

  const primary =
    phase === "COUNTDOWN"
      ? { label: "Start now", icon: "flash" as const, variant: "tonal" as const, onPress: handleBeginFirstSet }
      : phase === "ACTIVE_SET"
        ? { label: `Done ${lapWord.toLowerCase()}`, icon: "checkmark" as const, variant: "primary" as const, onPress: handleCompleteSet }
        : isTransition
          ? { label: "Start now", icon: "flash" as const, variant: "primary" as const, onPress: handleSkipRest }
          : { label: "Skip rest", icon: "play-forward" as const, variant: "primary" as const, onPress: handleSkipRest };

  // Slot two of the dock carries whatever this phase actually needs there —
  // never a dead button.
  const contextAction = isResting
    ? { icon: "add" as const, label: "+20s", onPress: handleAddRest, disabled: false }
    : phase === "ACTIVE_SET" && !isTimed
      ? { icon: "arrow-undo" as const, label: "Undo rep", onPress: handleUndoRep, disabled: reps === 0 }
      : { icon: "help-circle" as const, label: "How to", onPress: () => guideTarget && setGuideFor(guideTarget), disabled: !guideTarget };

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex}>
        {isLivePhase && (
          <>
            <SessionHeader
              label={state.sessionLabel}
              elapsed={formatTime(state.elapsedSeconds)}
              overallPct={overallPct}
              colors={colors}
              onLeave={handleLeave}
              onDrills={() => setShowDrills(true)}
            />
            <ProgressSegments
              count={state.exercises.length}
              currentIndex={state.currentExerciseIndex}
              colors={colors}
            />
          </>
        )}

        <View style={styles.main}>
          {phase === "INTRO" && (
            <IntroView
              label={state.sessionLabel}
              exercises={state.exercises}
              lapWord={lapWord}
              colors={colors}
              onStart={handleStart}
              onBack={handleLeave}
              onShowGuide={setGuideFor}
            />
          )}

          {isLivePhase && isPaused && (
            <PauseView
              elapsed={formatTime(state.elapsedSeconds)}
              exerciseName={currentEx?.name ?? ""}
              exerciseProgress={exerciseProgress}
              colors={colors}
              onResume={handleTogglePause}
              onEnd={handleEnd}
            />
          )}

          {isLivePhase && !isPaused && (
            <View style={styles.stage}>
              {/* ── Caption ─────────────────────────────────────────── */}
              <View style={styles.captionZone}>
                <Reanimated.View
                  key={`cap-${phase}-${state.currentExerciseIndex}`}
                  entering={enterFade()}
                  exiting={exitFade()}
                  style={styles.zoneFill}
                >
                  <AppText variant="caption" color="tertiary" uppercase>
                    {caption.eyebrow}
                  </AppText>
                  <Pressable
                    onPress={() => guideTarget && setGuideFor(guideTarget)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`How to perform ${caption.title}`}
                    style={styles.titleRow}
                  >
                    <AppText
                      variant="title"
                      align="center"
                      numberOfLines={1}
                      style={styles.titleText}
                    >
                      {caption.title}
                    </AppText>
                    <Ionicons name="information-circle" size={18} color={colors.primary} />
                  </Pressable>
                  {phase === "ACTIVE_SET" && currentEx ? (
                    <SetPips
                      total={currentEx.sets}
                      current={state.currentSet}
                      lapWord={lapWord}
                      accent={diffColor}
                      colors={colors}
                    />
                  ) : (
                    <AppText variant="footnote" color="tertiary">
                      {caption.sub}
                    </AppText>
                  )}
                </Reanimated.View>
              </View>

              {/* ── Hero: one persistent instrument ─────────────────── */}
              <View style={styles.heroZone}>
                <Pressable
                  onPress={tapRep}
                  disabled={phase !== "ACTIVE_SET" || isTimed}
                  accessibilityRole="button"
                  accessibilityLabel="Count a rep"
                  style={({ pressed }) => [
                    styles.heroTap,
                    pressed && phase === "ACTIVE_SET" && !isTimed && styles.heroPressed,
                  ]}
                >
                  <View style={{ width: coreSize, height: coreSize }}>
                    <SessionCore
                      progress={coreProgress}
                      size={coreSize}
                      gradient={coreGradient}
                      pulse={corePulse}
                      linear={coreLinear}
                      duration={coreDuration}
                    />
                    <View style={[StyleSheet.absoluteFill, styles.centerAll]} pointerEvents="none">
                      <Reanimated.View
                        key={`read-${phase}`}
                        entering={enterFade()}
                        style={styles.centerAll}
                      >
                        <CoreReadout
                          phase={phase}
                          countdown={countdown}
                          reps={reps}
                          timer={timer}
                          isTimed={!!isTimed}
                          target={currentEx?.reps ?? ""}
                          size={coreSize}
                          hot={hot}
                          colors={colors}
                        />
                      </Reanimated.View>
                    </View>
                  </View>
                </Pressable>
              </View>

              {/* ── Hint ────────────────────────────────────────────── */}
              <View style={styles.hintZone}>
                {phase === "ACTIVE_SET" && setPhase === "grace" ? (
                  <GraceBar
                    secondsLeft={graceLeft}
                    lapWord={lapWord}
                    colors={colors}
                    onKeepGoing={keepGoing}
                  />
                ) : (
                  <Reanimated.View
                    key={`hint-${phase}-${setPhase}`}
                    entering={enterFade()}
                    style={styles.zoneFill}
                  >
                    <HintPill
                      phase={phase}
                      setPhase={setPhase}
                      isTimed={!!isTimed}
                      cue={coachCue}
                      colors={colors}
                    />
                  </Reanimated.View>
                )}
              </View>

              {/* ── Dock: same shape in every phase ─────────────────── */}
              <View style={styles.dock}>
                <Button
                  label={primary.label}
                  icon={primary.icon}
                  variant={primary.variant}
                  size="lg"
                  onPress={primary.onPress}
                />
                <View
                  style={[styles.dockRow, phase === "COUNTDOWN" && styles.dockRowHidden]}
                  pointerEvents={phase === "COUNTDOWN" ? "none" : "auto"}
                >
                  <DockButton
                    icon="play-back"
                    label="Previous"
                    onPress={handlePrev}
                    colors={colors}
                  />
                  <DockButton
                    icon={contextAction.icon}
                    label={contextAction.label}
                    onPress={contextAction.onPress}
                    disabled={contextAction.disabled}
                    colors={colors}
                  />
                  <DockButton
                    icon="pause"
                    label="Pause"
                    onPress={handleTogglePause}
                    colors={colors}
                  />
                  <DockButton
                    icon="play-forward"
                    label="Skip"
                    onPress={handleSkipExercise}
                    colors={colors}
                  />
                </View>
              </View>
            </View>
          )}

          {phase === "COMPLETE" && (
            <CompletionView state={state} colors={colors} size={coreSize} />
          )}
        </View>
      </SafeAreaView>

      {/* "This session" — the whole workout at a glance */}
      <DrillSheet
        visible={showDrills}
        onClose={() => setShowDrills(false)}
        state={state}
        colors={colors}
        onShowGuide={openGuideFromDrills}
      />

      {/* How-to guide — demo, steps, muscle map; everything instructional lives
          here so the live set screen stays a single-focus counter. */}
      <ExerciseGuideSheet
        visible={guideFor !== null}
        onClose={closeGuide}
        exercise={guideFor ?? undefined}
      />
    </View>
  );
}

/* ─────────────────────────────── Header ────────────────────────────────── */

function SessionHeader({
  label,
  elapsed,
  overallPct,
  colors,
  onLeave,
  onDrills,
}: {
  label: string;
  elapsed: string;
  overallPct: number;
  colors: ThemeColors;
  onLeave: () => void;
  onDrills: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <HeaderButton icon="close" label="Leave workout" onPress={onLeave} colors={colors} />
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

/* ──────────────────────────── Stage furniture ──────────────────────────── */

function SetPips({
  total,
  current,
  lapWord,
  accent,
  colors,
}: {
  total: number;
  current: number;
  lapWord: string;
  accent: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.setPips}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.setPip,
            i === current - 1 && styles.setPipNow,
            {
              backgroundColor:
                i < current - 1 ? colors.primary : i === current - 1 ? accent : colors.border,
            },
          ]}
        />
      ))}
      <AppText variant="footnote" color="secondary" style={styles.setLabel}>
        {lapWord} {current} of {total}
      </AppText>
    </View>
  );
}

/** The number in the middle of the core — the only thing that ever changes size. */
function CoreReadout({
  phase,
  countdown,
  reps,
  timer,
  isTimed,
  target,
  size,
  hot,
  colors,
}: {
  phase: string | undefined;
  countdown: number;
  reps: number;
  timer: number;
  isTimed: boolean;
  target: string;
  size: number;
  hot: boolean;
  colors: ThemeColors;
}) {
  if (phase === "COUNTDOWN") {
    const isGo = countdown <= 0;
    return (
      <Reanimated.Text
        key={countdown}
        entering={enterHero()}
        style={[
          styles.bigNumber,
          {
            color: isGo ? colors.primary : colors.text,
            fontSize: Math.round(size * (isGo ? 0.26 : 0.34)),
            lineHeight: Math.round(size * (isGo ? 0.3 : 0.38)),
          },
        ]}
      >
        {isGo ? "GO" : countdown}
      </Reanimated.Text>
    );
  }

  if (phase === "ACTIVE_SET") {
    return (
      <View style={styles.centerAll}>
        <RollingNumber
          value={isTimed ? formatTime(timer) : reps}
          color={hot ? Palette.warning : colors.text}
          textStyle={[
            styles.readoutNumber,
            isTimed
              ? { fontSize: Math.round(size * 0.2), lineHeight: Math.round(size * 0.23) }
              : { fontSize: Math.round(size * 0.3), lineHeight: Math.round(size * 0.34) },
          ]}
        />
        <AppText variant="footnote" color="tertiary">
          {isTimed ? `of ${target}` : `of ${target} reps`}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.centerAll}>
      <AppText variant="caption" color="tertiary" uppercase>
        {phase === "TRANSITION" ? "Starts in" : "Rest"}
      </AppText>
      <RollingNumber
        value={formatTime(timer)}
        direction="down"
        color={colors.text}
        textStyle={[
          styles.readoutNumber,
          { fontSize: Math.round(size * 0.22), lineHeight: Math.round(size * 0.26) },
        ]}
      />
    </View>
  );
}

function HintPill({
  phase,
  setPhase,
  isTimed,
  cue,
  colors,
}: {
  phase: string | undefined;
  setPhase: SetPhase;
  isTimed: boolean;
  cue: string;
  colors: ThemeColors;
}) {
  if (phase === "ACTIVE_SET") {
    if (isTimed) {
      return (
        <View style={[styles.hintPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Ionicons name="timer-outline" size={15} color={colors.primary} />
          <AppText variant="caption" color="brand" uppercase>
            Hold the position
          </AppText>
        </View>
      );
    }
    if (setPhase === "extended") {
      return (
        <View style={[styles.hintPill, { backgroundColor: alpha(Palette.warning, 0.12), borderColor: alpha(Palette.warning, 0.4) }]}>
          <Ionicons name="flame" size={15} color={Palette.warning} />
          <AppText variant="caption" uppercase style={styles.bonusText}>
            Bonus reps — nice
          </AppText>
        </View>
      );
    }
    return (
      <View style={[styles.hintPill, { backgroundColor: alpha(colors.primary, 0.12), borderColor: alpha(colors.primary, 0.35) }]}>
        <Ionicons name="hand-left" size={15} color={colors.primary} />
        <AppText variant="caption" color="brand" uppercase>
          Tap the circle to count a rep
        </AppText>
      </View>
    );
  }

  if (phase === "REST" || phase === "TRANSITION") {
    return (
      <View style={[styles.hintPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Ionicons name="leaf-outline" size={15} color={colors.water} />
        <AppText variant="caption" color="secondary" uppercase>
          Breathe · shake it out
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.tipBar, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name="bulb-outline" size={15} color={colors.primary} />
      <AppText variant="footnote" color="secondary" style={styles.flex} numberOfLines={2}>
        {cue}
      </AppText>
    </View>
  );
}

/** The set is done unless the athlete says otherwise — shown, not guessed at. */
function GraceBar({
  secondsLeft,
  lapWord,
  colors,
  onKeepGoing,
}: {
  secondsLeft: number;
  lapWord: string;
  colors: ThemeColors;
  onKeepGoing: () => void;
}) {
  return (
    <View style={[styles.graceBar, { backgroundColor: alpha(Palette.warning, 0.14), borderColor: alpha(Palette.warning, 0.4) }]}>
      <Ionicons name="checkmark-circle" size={16} color={Palette.warning} />
      <AppText variant="footnote" style={styles.flex}>
        {lapWord} target hit · resting in {secondsLeft}s
      </AppText>
      <Pressable
        onPress={onKeepGoing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Keep going — stay in this set"
      >
        <AppText variant="caption" color="brand" uppercase>
          Keep going
        </AppText>
      </Pressable>
    </View>
  );
}

function DockButton({
  icon,
  label,
  onPress,
  colors,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label || icon}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.dockBtn, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.dockIcon,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          disabled && styles.dockDisabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={disabled ? colors.textTertiary : colors.text}
        />
      </View>
      <AppText variant="caption" color="tertiary" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
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
  onShowGuide,
}: {
  label: string;
  exercises: SessionExerciseInfo[];
  lapWord: string;
  colors: ThemeColors;
  onStart: () => void;
  onBack: () => void;
  onShowGuide: (ex: SessionExerciseInfo) => void;
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

        <View style={styles.introHint}>
          <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
          <AppText variant="footnote" color="secondary">
            Tap any exercise to see how it&apos;s done
          </AppText>
        </View>

        <View style={styles.introList}>
          {exercises.map((ex, i) => (
            <Pressable
              key={`${ex.exerciseId}-${i}`}
              onPress={() => onShowGuide(ex)}
              accessibilityRole="button"
              accessibilityLabel={`How to perform ${ex.name}`}
              style={({ pressed }) => [
                styles.introRow,
                i < exercises.length - 1 && {
                  borderBottomColor: colors.divider,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && { backgroundColor: alpha(colors.primary, 0.08) },
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
              <Ionicons name="information-circle" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.introFooter}>
        <Button label="Begin" icon="play" size="lg" onPress={onStart} />
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
        <Button label="Resume" icon="play" size="lg" onPress={onResume} />
        <Button label="End session" variant="ghost" onPress={onEnd} />
      </View>
    </View>
  );
}

/* ─────────────────────────────── Completion ────────────────────────────── */

/** The core floods gold and locks at full around a checkmark while confetti
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
  const coreSize = Math.round(size * 0.84);

  return (
    <View style={styles.complete}>
      <Reanimated.View entering={enterHero()} style={styles.completeHero}>
        <View style={{ width: coreSize, height: coreSize }}>
          <SessionCore progress={1} size={coreSize} gradient={GOLD_GRADIENT} pulse duration={900} />
          <View style={[StyleSheet.absoluteFill, styles.centerAll]} pointerEvents="none">
            <Ionicons name="checkmark-sharp" size={Math.round(coreSize * 0.34)} color={colors.gold} />
          </View>
        </View>
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

/* ─────────────────────────── Drill list sheet ─────────────────────────── */

function DrillSheet({
  visible,
  onClose,
  state,
  colors,
  onShowGuide,
}: {
  visible: boolean;
  onClose: () => void;
  state: SessionState;
  colors: ThemeColors;
  onShowGuide: (ex: SessionExerciseInfo) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.78}
      header={
        <View style={styles.drillHead}>
          <View style={styles.flex}>
            <AppText variant="headline">This session</AppText>
            <AppText variant="caption" color="tertiary">
              Tap an exercise for its how-to
            </AppText>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      }
    >
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
            <Pressable
              key={`${ex.exerciseId}-${i}`}
              onPress={() => onShowGuide(ex)}
              accessibilityRole="button"
              accessibilityLabel={`How to perform ${ex.name}`}
              style={({ pressed }) => [
                styles.drillRow,
                { borderBottomColor: colors.divider },
                isCurrent && { backgroundColor: alpha(colors.primary, 0.08), borderRadius: Radius.sm },
                pressed && { opacity: 0.6 },
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
              <Ionicons name="information-circle" size={18} color={colors.primary} />
            </Pressable>
          );
        })}
        <View style={styles.drillFooterPad} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerAll: { alignItems: "center", justifyContent: "center" },
  emptyAction: { alignSelf: "stretch", paddingHorizontal: Spacing.screen, marginTop: Spacing.lg },

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

  main: { flex: 1 },

  // Four fixed zones. Two of them have a hard height and hold their content
  // absolutely, so a crossfading caption or hint can never nudge the core or
  // the dock by a single pixel.
  stage: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.lg,
  },
  captionZone: { height: CAPTION_ZONE },
  hintZone: { height: HINT_ZONE, justifyContent: "center" },
  zoneFill: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 3 },
  heroZone: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroTap: { padding: Spacing.lg, borderRadius: 999 },
  heroPressed: { transform: [{ scale: 0.975 }] },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: Spacing.md,
  },
  // Long exercise names truncate rather than shoving the info affordance off
  // the edge of the caption.
  titleText: { flexShrink: 1 },

  setPips: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  setPip: { width: 10, height: 10, borderRadius: 5 },
  setPipNow: { width: 20 },
  setLabel: { marginLeft: 6, fontWeight: "600" },

  bigNumber: { fontWeight: "800", letterSpacing: -2, textAlign: "center" },
  readoutNumber: { fontWeight: "800", letterSpacing: -1, textAlign: "center" },

  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  bonusText: { color: Palette.warning, fontWeight: "700" },
  tipBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    alignSelf: "stretch",
  },
  graceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },

  dock: { gap: Spacing.md, paddingTop: Spacing.sm },
  dockRow: { flexDirection: "row", alignItems: "flex-start" },
  dockRowHidden: { opacity: 0 },
  dockBtn: { flex: 1, alignItems: "center", gap: 5 },
  dockIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dockDisabled: { opacity: 0.4 },

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
  introHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
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

  // Drill list
  drillHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  drillList: { flexGrow: 0, paddingHorizontal: Spacing.sm },
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

/**
 * Route-level boundary. A throw anywhere in the player now lands on a
 * recoverable error screen that NAMES the failure, instead of taking the whole
 * app down with it — and instead of leaving "it crashed" as the only clue.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} onRetry={retry} surface="guided-session" />;
}
