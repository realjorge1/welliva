/**
 * GUIDED SESSION — the live workout player.
 *
 * TIME IS THE UNIT OF WORK. Every set is boxed to a clock — a hold carries its
 * own, a rep set gets one derived from its prescription — and reps are text the
 * athlete reads ("aim for 10–15"), never a counter they tap. Nobody can hold a
 * phone through a set of squats, so the player never asks them to: the only
 * touch a set needs is the one that ends it.
 *
 *   INTRO (the plan, in its blocks — pre-filled, tap a row to adjust)
 *     → COUNTDOWN (3-2-1-GO in the card's clock, while the stage's floor lights
 *        up a third at a time under a figure holding its start position)
 *       → ACTIVE_SET (the box counts down; past zero it counts UP in orange)
 *         ⇄ REST / TRANSITION (the only place controls live — including the
 *            pre-filled reps stepper that confirms the set just banked)
 *           → COMPLETE (the flame on a lit floor, one question) → summary
 *
 * ONE SCREEN, FOUR PARTS, THE SAME IN EVERY PHASE — rebuilt 2026-11-01 on the
 * owner's reference (a swim tracker's live and complete screens), drawn in the
 * app's own instrument look:
 *
 *   ( ✕ End )                            ( ● LIVE · 12:35 )
 *   Squats ⓘ
 *   MAIN · 2 OF 5                ← where the move sits; mid-set, the coach's cue
 *   ┌─────────────────────── the stage ───────────────────────┐
 *   │  the figure on a floor of light panels — the set's time, │  SessionHero
 *   │  closing in on them as it runs out; the other camera in  │
 *   │  a corner                                                │
 *   └──────────────────────────────────────────────────────────┘
 *   ┌ ■ SET 2 OF 3                                    WORK ───┐
 *   │ 0:24 LEFT                                   10–15 REPS  │  SessionPanel
 *   │ ▪▪ ▪▪ ░░ ░░ … every set of the session, lit up to now   │  SessionChart
 *   └──────────────────────────────────────────────────────────┘
 *   [ ✓ DONE SET              ]  ( ? )     ( ‖ )               SessionControls
 *                                HOW TO    PAUSE
 *
 * Nothing moves when the phase changes. The four parts keep their places and
 * only what they say changes: the light turns water-blue for rest and the
 * sleeping face takes the figure's place; the pill turns "Skip rest" and its
 * neighbour "+20". Pause is the same screen, dimmed, with the rarer controls —
 * previous, skip, how-to — laid over the stage.
 *
 * NO NUMBER ON THE STAGE (owner, 2026-11-01: a count over the figure, or faint
 * behind it, is a terrible UI). Every number is in the card; the stage says the
 * same thing in light. A set switches the floor's panels off toward the
 * athlete, a rest switches them back on, and the launch lights them a third at
 * a time while the card counts 3-2-1 — then GO floods the floor and the figure
 * moves.
 *
 * THE FIGURE IS THE SCREEN. The demonstration is on stage in every live phase
 * and never behind a tap; the corner panel shows the other camera, or the
 * move's key position frozen when there is no honest second camera. The ring
 * that used to frame it is gone: the floor, the card and the strip say what it
 * said, without a dial in front of the body.
 *
 * The clock is anchored to WALL TIME, not to tick count — the screen is kept
 * awake and dims to a glance state after twenty seconds of stillness, and a
 * player that counted intervals would quietly lose minutes to a backgrounded
 * app. The interval below catches up on however much real time has passed.
 *
 * SessionService owns the state machine, persistence and results; it is pure,
 * and every side effect (saving, leaving) lives in an effect here rather than
 * inside a setState updater. Fully offline; an in-progress session persists so
 * it can be resumed from the last position.
 */

import { ScreenErrorFallback } from "@/components/AppErrorBoundary";
import { EDGE_WHITE, HOME_ORANGE } from "@/components/home/surface";
import { enterFade } from "@/components/motion";
import {
  AmbientCanvas,
  AppText,
  Button,
  IconBadge,
  Mono,
  Sheet,
  Stepper,
  useColors,
} from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Gradients, Radius, Spacing, alpha, type ThemeColors } from "@/constants/theme";
import { useGamification, useWorkout } from "@/contexts/AppContext";
import {
  resolveFigureMotion,
  type FigureMotion,
} from "@/fitness/animation/movementProfiles";
import {
  ExerciseFigure,
  FigureStill,
  primaryView,
  secondaryView,
  stillCaption,
  stillFrame,
  useFigureClock,
} from "@/fitness/components/ExerciseFigure";
import { ExerciseGuideSheet } from "@/fitness/components/ExerciseGuideSheet";
import { RestingFace } from "@/fitness/components/RestingFace";
import { SessionChart } from "@/fitness/components/SessionChart";
import { SessionComplete } from "@/fitness/components/SessionComplete";
import {
  SessionControls,
  type PrimaryAction,
  type RoundAction,
} from "@/fitness/components/SessionControls";
import { SessionHero, type HeroFloor, type Stage } from "@/fitness/components/SessionHero";
import { PanelTarget, SessionPanel } from "@/fitness/components/SessionPanel";
import { SessionPlan, prescriptionText } from "@/fitness/components/SessionPlan";
import {
  BLOCK_LABEL,
  blockOf,
  handoverSeconds,
  hasBlocks,
  parseBlocks,
  positionLabel,
} from "@/fitness/components/sessionBlocks";
import { chartColumns, chartTally, cursorOf } from "@/fitness/components/sessionChartLayout";
import { auxSize, figureBox } from "@/fitness/components/sessionScene";
import { formatClock } from "@/fitness/components/sessionTotals";
import { rememberSessionEffort } from "@/fitness/services/FitnessProfileStore";
import { workoutFromSessionId } from "@/fitness/services/WorkoutCatalog";
import {
  SessionEffort,
  SessionExerciseInfo,
  SessionState,
  resolveWorkSeconds,
} from "@/models/session";
import type { PlannedExercise } from "@/models/workout";
import { todayDate } from "@/services/OfflineStorage";
import { SessionService } from "@/services/SessionService";
import { readCommitment, streakWithToday } from "@/services/commitment";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Reanimated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const service = SessionService.getInstance();

/** The 3-2-1-GO the player runs itself, so it never rides the 1Hz session tick. */
const COUNT_FROM = 3;
const GO_HOLD_MS = 450;

/** How long the stage stays fully lit with nobody touching it. */
const IDLE_DIM_MS = 20000;
/** How dark the chrome goes in glance mode — a hint of shape, nothing more. */
const DIM_OPACITY = 0.11;
/**
 * How far the CONTROL ROW fades with it — less. At 0.11 nothing on the row could
 * be read, and the gold pill read as "a yellow button with no label" (owner,
 * 2026-11-02). At this level every name on the row stays readable at a glance,
 * the quiet pill included, while the stage and the card still carry the screen.
 */
const CONTROLS_DIM_OPACITY = 0.42;

/** How much real time a single catch-up may replay, so a long background gap
 *  can never freeze the JS thread replaying an hour of ticks. */
const MAX_CATCH_UP_TICKS = 900;

/** Rest's colour — the deep end of the water ramp: the stage's light and the pill. */
const WATER = Gradients.water[1];
/** The LIVE chip's recording light. */
const LIVE_DOT = "#FF5A4F";
/** The figure steps onto the stage rather than appearing on it. */
const FIGURE_IN = FadeIn.duration(360);

/** What the card reads in a phase — every number the player shows lives here. */
interface PanelReading {
  label: string;
  status: string;
  tone: string;
  value: string;
  unit: string;
  /** Only the launch's 3-2-1: each beat lands once. */
  valueKey?: number;
  valueTone?: string;
  valueLabel: string;
  aside: React.ReactNode;
}

/**
 * The safe area pads the top and sides; each view pads its own floor, so the
 * controls sit a deliberate distance off the glass on phones whose gesture bar
 * reports no inset at all.
 */
const LIVE_EDGES = ["top", "left", "right"] as const;

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
 * Which corner the second camera angle sits in.
 *
 * Hashed off the exercise id rather than drawn from `Math.random` on purpose:
 * it still varies across a session, but it can't flip mid-set on a re-render,
 * which is the one thing that would make it feel broken instead of incidental.
 */
function auxCornerFor(id: string): "left" | "right" {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? "left" : "right";
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
  restStr?: string,
  blocksStr?: string,
): SessionExerciseInfo[] {
  const ids = idsStr.split(",").map((s) => s.trim());
  const setsArr = setsStr ? setsStr.split(",").map((s) => parseInt(s.trim(), 10)) : [];
  const repsArr = repsStr ? repsStr.split(",").map((s) => s.trim()) : [];
  // Plan sessions prescribe their own rests (short for fat loss, long for
  // strength); a library run passes none and keeps each move's default.
  const restArr = restStr ? restStr.split(",").map((s) => parseInt(s.trim(), 10)) : [];
  // Warm-up / main / cool-down, when the launcher knows them.
  const blocks = parseBlocks(blocksStr);

  const list = ids
    .map((id, i) => {
      const block = blocks[i] ? { block: blocks[i] } : {};
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
          restSeconds: restArr[i] || dbEntry.restSeconds,
          transitionSeconds: 30,
          setupPosition: dbEntry.setupPosition,
          instructions: dbEntry.instructions,
          coachCues: dbEntry.coachCues,
          icon: dbEntry.icon,
          ...block,
        } as SessionExerciseInfo;
      }
      // Not in the local DB → an AI-generated exercise. Resolve it from the
      // current workout plan so it isn't dropped and keeps its how-to.
      const planned = planLookup.get(id);
      if (planned) {
        const info = { ...plannedToSessionInfo(planned), ...block };
        if (setsArr[i]) info.sets = setsArr[i];
        if (repsArr[i]) info.reps = repsArr[i];
        if (restArr[i]) info.restSeconds = restArr[i];
        return info;
      }
      return null;
    })
    .filter(Boolean) as SessionExerciseInfo[];

  // The hand-over into each move, read off the moves that SURVIVED the lookup:
  // a warm-up flows from move to move, main work and a new block get a full stop.
  const kept = list.map((e) => e.block);
  return list.map((e, i) => ({ ...e, transitionSeconds: handoverSeconds(kept, i) }));
}

export default function GuidedSessionScreen() {
  const params = useLocalSearchParams<{
    exerciseIds: string;
    sessionLabel?: string;
    workoutSessionId?: string;
    sets?: string;
    reps?: string;
    /** Rest seconds per exercise, comma-joined like sets/reps. Optional. */
    rest?: string;
    /** "warmup" | "main" | "cooldown" per exercise, comma-joined. Optional. */
    blocks?: string;
    /** "1" → restore the persisted in-progress session instead of starting fresh. */
    resume?: string;
  }>();
  const router = useRouter();
  const { colors } = useColors();
  const { workoutPlan } = useWorkout();
  const { streakData } = useGamification();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The screen stays lit for the whole session: the demonstration figure is the
  // interface, and a sleeping screen would take it away exactly when someone
  // has put the phone on the floor and needs it most. Glance mode below is what
  // saves the battery instead.
  useKeepAwake("welliva-session");

  /** A short phone (the TECNO class): the strip, the clock and the title step down a size. */
  const compact = height < 720;

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
    () =>
      buildExerciseList(
        params.exerciseIds || "",
        planLookup,
        params.sets,
        params.reps,
        params.rest,
        params.blocks,
      ),
    [params.exerciseIds, params.sets, params.reps, params.rest, params.blocks, planLookup],
  );

  const isResume = params.resume === "1";

  // `null` only while a resumed session is being restored from storage —
  // fresh sessions initialize synchronously (starting on the prescription).
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
   * Which exercise the how-to is open on, or null when it's closed. The figure
   * is on stage throughout, so this sheet is the DEEP reference (steps, muscle
   * map, both camera angles) rather than the only way to see the move.
   */
  const [guideFor, setGuideFor] = useState<SessionExerciseInfo | null>(null);
  const closeGuide = useCallback(() => setGuideFor(null), []);

  /** Open the how-to from a list without stacking sheet on sheet. */
  const openGuideFromDrills = useCallback((ex: SessionExerciseInfo) => {
    setShowDrills(false);
    setGuideFor(ex);
  }, []);

  /** Which exercise the prescription sheet is adjusting (index), or null. */
  const [prescribeIndex, setPrescribeIndex] = useState<number | null>(null);

  /* ── Tick loop, anchored to WALL TIME ─────────────────────────────────
   * The state machine still steps one pure second at a time, but how many
   * steps are owed is read off the clock rather than counted. A backgrounded
   * app, a throttled timer or a dimmed screen therefore costs no session time:
   * the next interval replays whatever really elapsed.
   *
   * COUNTDOWN is deliberately excluded — the player runs its own smooth 3-2-1
   * below, and the workout clock only starts once the first set opens. */
  const tickAnchor = useRef({ at: 0, applied: 0 });
  useEffect(() => {
    if (
      !phase ||
      phase === "INTRO" ||
      phase === "COUNTDOWN" ||
      phase === "COMPLETE" ||
      phase === "SUMMARY" ||
      isPaused
    ) {
      return;
    }
    tickAnchor.current = { at: Date.now(), applied: 0 };
    const id = setInterval(() => {
      const due = Math.floor((Date.now() - tickAnchor.current.at) / 1000);
      const owed = due - tickAnchor.current.applied;
      if (owed <= 0) return;
      tickAnchor.current.applied = due;
      const steps = Math.min(owed, MAX_CATCH_UP_TICKS);
      setState((prev) => {
        if (!prev || prev.isPaused) return prev;
        let next = prev;
        for (let i = 0; i < steps; i++) next = service.tick(next);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [phase, isPaused]);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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

  const handleCompleteSet = useCallback(() => {
    applyAction((s) => service.completeSet(s));
  }, [applyAction]);

  const handleSkipRest = useCallback(() => {
    applyAction((s) => service.skipRest(s));
  }, [applyAction]);

  const handleAddRest = useCallback(() => {
    applyAction((s) => service.addRestTime(s, 20));
  }, [applyAction]);

  const handleSkipExercise = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    applyAction((s) => service.skipExercise(s));
  }, [applyAction]);

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    applyAction((s) => service.goBack(s));
  }, [applyAction]);

  const handleTogglePause = useCallback(() => {
    applyAction((s) => service.togglePause(s));
  }, [applyAction]);

  const handleAdjustReps = useCallback(
    (delta: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      applyAction((s) => {
        const current = service.lastSetReps(s);
        return current === null ? s : service.adjustLastSetReps(s, current + delta);
      });
    },
    [applyAction],
  );

  const handlePrescribe = useCallback(
    (index: number, patch: Partial<SessionExerciseInfo>) => {
      applyAction((s) => service.updateExercise(s, index, patch));
    },
    [applyAction],
  );

  /* ── Getting out ──────────────────────────────────────────────────────
   * Every exit goes through ONE sheet with both answers spelled out — the End
   * pill in the header opens it, and so does the stop button while paused. */
  const [showExit, setShowExit] = useState(false);

  const handleLeave = useCallback(() => {
    const s = stateRef.current;
    // On the prescription (never started) there's nothing to end or resume.
    if (!s || s.phase === "INTRO") {
      router.back();
      return;
    }
    setShowExit(true);
  }, [router]);

  /** Finish here: tally everything done so far and roll into the summary. */
  const handleEndSession = useCallback(() => {
    setShowExit(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    applyAction((s) => service.stopSession(s));
  }, [applyAction]);

  /** Step away but keep the session — it stays resumable from Fitness. */
  const handleLeaveForNow = useCallback(() => {
    setShowExit(false);
    const s = stateRef.current;
    if (s) void service.saveSession({ ...s, isPaused: true });
    router.back();
  }, [router]);

  /**
   * The one question, answered → bank the session and hand over to the summary.
   *
   * Nothing is written until this point on purpose: bail out at the question
   * and the run stays a resumable in-progress session rather than a half-saved
   * record. `saveSummary` is idempotent by run id, so the summary screen's own
   * write is still safe.
   */
  const handleFinish = useCallback(
    (effort: SessionEffort) => {
      const s = stateRef.current;
      if (!s) return;
      const summary = service.buildSummary(s, 70, effort);
      void service.saveSummary(summary);
      void service.clearSession();
      void rememberSessionEffort({
        date: summary.date,
        workoutId: summary.workoutSessionId,
        effort,
      });
      const target = {
        pathname: "/session-summary" as const,
        params: { data: JSON.stringify(summary) },
      };
      // Clear the screens the player was launched FROM out from under the
      // summary. Without this, a back gesture off the summary lands on
      // whatever opened the session — typically the detail page of the very
      // exercise you just finished, sitting there with a Start button, which
      // reads as the session having looped back to the beginning.
      try {
        if (router.canDismiss()) {
          router.dismissAll();
          router.push(target);
          return;
        }
      } catch {
        // Nothing to dismiss, or a navigator without it — the replace below
        // still takes the player itself off the stack, as it always did.
      }
      router.replace(target);
    },
    [router],
  );

  /* ── The player's own countdown ───────────────────────────────────────
   * Anchored to wall-clock time so the digits land on the second even if the
   * JS thread hiccups, over a figure that is already in position. */
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

  /* ── Glance mode ──────────────────────────────────────────────────────
   * Twenty seconds into a set with nobody touching the screen, the chrome
   * fades out and the screen keeps what you can read from the floor: the stage
   * and the instrument card. The control row fades less (CONTROLS_DIM_OPACITY)
   * and its pill goes quiet — black face, named edge — so no button is ever left
   * showing without its name. The next touch anywhere wakes it and does
   * NOTHING else — so a blind tap can never skip an exercise. */
  const [dimmed, setDimmed] = useState(false);
  const [wakeNonce, setWakeNonce] = useState(0);
  const wake = useCallback(() => setWakeNonce((n) => n + 1), []);

  const sheetOpen = guideFor !== null || showDrills;
  useEffect(() => {
    // Reading the how-to is not idling — the timer only runs against a stage
    // nobody is looking at.
    if (phase !== "ACTIVE_SET" || isPaused || sheetOpen) {
      setDimmed(false);
      return;
    }
    setDimmed(false);
    const id = setTimeout(() => setDimmed(true), IDLE_DIM_MS);
    return () => clearTimeout(id);
  }, [phase, isPaused, sheetOpen, wakeNonce, state?.currentSet, state?.currentExerciseIndex]);

  const chrome = useSharedValue(1);
  useEffect(() => {
    chrome.value = withTiming(dimmed ? DIM_OPACITY : 1, { duration: dimmed ? 900 : 220 });
  }, [dimmed, chrome]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  // The control row rides the same fade, mapped onto its own floor.
  const controlsStyle = useAnimatedStyle(() => ({
    opacity:
      CONTROLS_DIM_OPACITY +
      ((chrome.value - DIM_OPACITY) / (1 - DIM_OPACITY)) * (1 - CONTROLS_DIM_OPACITY),
  }));

  const currentEx = state?.exercises[state.currentExerciseIndex];

  /* ── The demonstration ────────────────────────────────────────────────
   * During a transition the move on stage is the one COMING, so the athlete
   * sees what they're about to do while they walk to it. */
  const figureExercise = state
    ? state.phase === "TRANSITION"
      ? state.exercises[state.currentExerciseIndex + 1]
      : currentEx
    : undefined;
  // A plan's own exercise is not in the catalogue; its name still says what it
  // is, so the stage demonstrates THAT move rather than its category's stand-in.
  const exerciseMotion = figureExercise
    ? resolveFigureMotion(figureExercise.exerciseId, figureExercise.category, {
        name: figureExercise.name,
      })
    : "neutral";
  /** REST is the one phase with nothing to demonstrate — the face takes over. */
  const resting = phase === "REST";
  /**
   * THE FIGURE STOPS WHEN THE ATHLETE DOES. A transition shows the next move's
   * body AT EASE — an idle stand-and-breathe on its own slow clock — and the
   * exercise itself starts moving again the moment the next set does.
   */
  const idling = phase === "TRANSITION";
  const figureMotion: FigureMotion = idling ? "idle" : exerciseMotion;
  /**
   * ONE clock for both panels. Two ExerciseFigures each running their own loop
   * drift apart the moment either remounts, and two copies of the same body out
   * of step is worse than showing one angle.
   *
   * Through the launch's 3-2-1 the clock is held, so the body stands in its
   * start position — and moves on GO, with the athlete.
   */
  const figureClock = useFigureClock(
    figureMotion,
    !isPaused && !resting && phase !== "COUNTDOWN",
  );
  // The camera angles stay chosen by the EXERCISE, not by the idle pose, so
  // the stage doesn't swing its cameras around during the walk between moves.
  const mainAngle = primaryView(exerciseMotion);
  const auxAngle = secondaryView(exerciseMotion);
  const auxCorner = auxCornerFor(figureExercise?.exerciseId ?? "");
  // The corner panel is ALWAYS filled: the other honest camera when there is
  // one, otherwise the movement's key position frozen — the still the rest of
  // the app identifies the exercise by.
  const auxView = auxAngle ?? mainAngle;
  const auxLabel = auxAngle ?? stillCaption(exerciseMotion);

  /* ── The session strip ────────────────────────────────────────────────
   * Rebuilt only when the session moves: the set's clock feeds it while a set
   * is live (its column fills), and nothing else ticks it. */
  const sExercises = state?.exercises;
  const sResults = state?.results;
  const sIndex = state?.currentExerciseIndex ?? 0;
  const sSet = state?.currentSet ?? 1;
  const liveTimer = phase === "ACTIVE_SET" ? state?.timerValue ?? 0 : 0;
  const columns = useMemo(
    () =>
      sExercises && sResults && phase
        ? chartColumns({
            exercises: sExercises,
            results: sResults,
            phase,
            exerciseIndex: sIndex,
            set: sSet,
            timer: liveTimer,
          })
        : [],
    [sExercises, sResults, phase, sIndex, sSet, liveTimer],
  );
  const cursor = useMemo(
    () => (phase ? cursorOf({ phase, exerciseIndex: sIndex, set: sSet }) : null),
    [phase, sIndex, sSet],
  );

  // The completion chip: the run THIS session lands on. Either button on the
  // complete screen banks it, so a session with any work in it (the summary
  // screen's own rule for logging one) is about to keep today. Reading the
  // record as it stands put the chip a day behind on a day nothing else had
  // kept, and the next workout that day then read as having added a day.
  const didWork = sResults?.some((r) => r.setsCompleted.length > 0 || !r.skipped) ?? false;
  const streak = useMemo(() => {
    const now = readCommitment(streakData, todayDate());
    return didWork ? streakWithToday(now) : now.streak;
  }, [streakData, didWork]);

  /**
   * How long the current rest (or walk to the next move) is in all, for the
   * floor lighting back up. The engine only keeps what is LEFT, and "+20" makes
   * a rest longer than it began — so this is the most that was ever left, per rest.
   */
  const restSpan = useRef({ key: "", max: 1 });

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
  // seconds of nothing.
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

  const index = state.currentExerciseIndex;
  const isLivePhase =
    phase === "COUNTDOWN" ||
    phase === "ACTIVE_SET" ||
    phase === "REST" ||
    phase === "TRANSITION";
  const isResting = phase === "REST" || phase === "TRANSITION";
  const isTransition = phase === "TRANSITION";
  const nextExercise = state.exercises[index + 1];
  /** Which move the title's ⓘ, the "?" button and the paused how-to open. */
  const guideTarget = figureExercise;
  const openGuide = () => {
    if (guideTarget) setGuideFor(guideTarget);
  };
  const isTimed = currentEx?.exerciseType === "timed";
  const lap = lapWord.toUpperCase();

  /* ── The clock ────────────────────────────────────────────────────── */

  const workSeconds = currentEx ? resolveWorkSeconds(currentEx) : 0;
  const timer = state.timerValue;
  const remaining = Math.max(0, workSeconds - timer);
  const overtime = phase === "ACTIVE_SET" ? Math.max(0, timer - workSeconds) : 0;
  // The last five seconds of the box run hot, and so does every second past it.
  const hot = phase === "ACTIVE_SET" && (overtime > 0 || (remaining > 0 && remaining <= 5));

  /* ── The title: the move, and where it sits ───────────────────────── */

  const title = isTransition ? nextExercise?.name ?? "" : currentEx?.name ?? "";
  const where = isTransition
    ? `UP NEXT · ${positionLabel(state.exercises, index + 1)}`
    : positionLabel(state.exercises, index);
  const subtitle = isPaused ? `PAUSED · ${where}` : where;

  /* ── The stage: the body, and the time in light ───────────────────── */

  // A rest's whole length: what was left when it began, raised by any "+20".
  const restKey = `${phase}|${index}|${state.currentSet}`;
  if (isResting) {
    if (restSpan.current.key !== restKey) {
      restSpan.current = { key: restKey, max: Math.max(1, timer) };
    } else if (timer > restSpan.current.max) {
      restSpan.current.max = timer;
    }
  }
  const counting = phase === "COUNTDOWN" && countdown > 0;
  const light = phase === "REST" ? WATER : hot ? HOME_ORANGE : colors.primary;
  // The wall stays dark through the 3-2-1; GO switches it on.
  const glow = counting ? undefined : light;
  const floor: HeroFloor = {
    color: light,
    flood: phase === "COUNTDOWN" && !counting,
    lit:
      phase === "COUNTDOWN"
        ? counting
          ? (COUNT_FROM - countdown + 1) / COUNT_FROM
          : 1
        : phase === "ACTIVE_SET"
          ? workSeconds > 0
            ? remaining / workSeconds
            : 0
          : isResting
            ? 1 - timer / restSpan.current.max
            : 0,
  };

  const renderFigure = (stage: Stage) => {
    if (resting) {
      // The face has no silhouette to stand on the floor; it rests on the wall.
      const size = Math.round(Math.min(stage.floorY * 0.6, 168));
      return (
        <Reanimated.View
          key="rest"
          entering={FIGURE_IN}
          style={[styles.onStage, { top: Math.max(4, (stage.floorY - size) * 0.62) }]}
        >
          <RestingFace size={size} playing={!isPaused} />
        </Reanimated.View>
      );
    }
    if (!figureExercise) return null;
    const box = figureBox(stage);
    return (
      <Reanimated.View
        key={`${figureExercise.exerciseId}-${idling ? "idle" : "work"}`}
        entering={FIGURE_IN}
        style={[styles.onStage, { top: box.top }]}
      >
        <ExerciseFigure
          motion={figureMotion}
          views={[mainAngle]}
          size={box.size}
          // Only the pictogram look reads it; the character wears its own kit.
          color={colors.text}
          // At ease the body reads as standing by, not as the demonstration.
          opacity={idling ? 0.55 : 1}
          bare
          clock={figureClock}
        />
      </Reanimated.View>
    );
  };

  const renderAux =
    resting || !figureExercise
      ? undefined
      : (stage: Stage) => {
          const size = auxSize(stage);
          const dim = idling ? 0.4 : 0.82;
          return (
            <>
              {auxAngle ? (
                <ExerciseFigure
                  key={`${figureExercise.exerciseId}-aux-${idling ? "idle" : "work"}`}
                  motion={figureMotion}
                  views={[auxAngle]}
                  size={size}
                  color={colors.text}
                  opacity={dim}
                  bare
                  clock={figureClock}
                />
              ) : (
                <View style={{ opacity: dim }}>
                  <FigureStill
                    motion={exerciseMotion}
                    view={auxView}
                    size={size}
                    at={stillFrame(exerciseMotion)}
                    color={colors.text}
                  />
                </View>
              )}
              <Mono size={9} tracking={0.6} color={colors.textTertiary}>
                {auxLabel.toUpperCase()}
              </Mono>
            </>
          );
        };

  /* ── The line under the title ─────────────────────────────────────
   * Where the move sits — and while a set runs, the coach's cue for it instead:
   * one cue per set, walked through the exercise's list, so the written coach
   * says something new each round. The stage itself carries no words. */
  const coachCue = currentEx?.coachCues?.length
    ? currentEx.coachCues[(state.currentSet - 1) % currentEx.coachCues.length]
    : null;
  const lineCue =
    phase !== "ACTIVE_SET" || isPaused
      ? null
      : overtime > 0
        ? { icon: "flame" as const, text: "Overtime — finish when you're ready", tone: HOME_ORANGE }
        : coachCue
          ? { icon: "bulb-outline" as const, text: coachCue, tone: colors.primary }
          : null;

  // Paused: the rarer controls, laid over the stage they act on.
  const pauseOverlay = isPaused ? (
    <View style={styles.pauseRow}>
      <StageAction icon="play-back" label="Previous" onPress={handlePrev} colors={colors} />
      <StageAction icon="play-forward" label="Skip" onPress={handleSkipExercise} colors={colors} />
      <StageAction
        icon="help"
        label="How to"
        onPress={openGuide}
        disabled={!guideTarget}
        colors={colors}
      />
    </View>
  ) : undefined;

  /* ── The instrument card ──────────────────────────────────────────── */

  /** Reps banked for the set that just finished — the rest screen's stepper. */
  const bankedReps = isResting ? service.lastSetReps(state) : null;
  /** A hold's last banked seconds, for the rest screen of a timed move. */
  const lastHeld = (() => {
    if (!isResting || !isTimed || !currentEx) return null;
    const r = state.results.find((x) => x.exerciseId === currentEx.exerciseId && !x.skipped);
    const last = r?.setsCompleted[r.setsCompleted.length - 1];
    return last ? last.durationSeconds : null;
  })();

  const target = currentEx ? (
    <PanelTarget
      value={isTimed ? `${workSeconds}s` : currentEx.reps}
      label={isTimed ? "HOLD" : "TARGET REPS"}
    />
  ) : null;

  const restAside =
    bankedReps !== null ? (
      <View style={styles.stepperAside}>
        <Stepper
          value={`${bankedReps}`}
          label="Reps completed"
          onDecrement={() => handleAdjustReps(-1)}
          onIncrement={() => handleAdjustReps(1)}
          canDecrement={bankedReps > 0}
          valueWidth={30}
        />
        <Mono size={9} tracking={0.6} color={colors.textTertiary}>
          REPS LOGGED · TAP TO FIX
        </Mono>
      </View>
    ) : lastHeld !== null ? (
      <PanelTarget value={`${lastHeld}s`} label="HELD" />
    ) : isTransition && nextExercise ? (
      <PanelTarget value={prescriptionText(nextExercise)} label="NEXT" />
    ) : null;

  const setsOf = currentEx?.sets ?? 1;
  const panel: PanelReading =
    phase === "COUNTDOWN"
      ? {
          label: `${lap} ${state.currentSet} OF ${setsOf}`,
          status: "GET READY",
          tone: colors.primary,
          // The 3-2-1 counts in the clock's own place and lands on GO; the
          // set's clock takes over from there.
          value: counting ? String(countdown) : "GO",
          valueKey: countdown,
          unit: "",
          valueTone: counting ? undefined : colors.primary,
          valueLabel: counting ? `Starting in ${countdown}` : "Go",
          aside: target,
        }
      : phase === "ACTIVE_SET"
        ? overtime > 0
          ? {
              label: `${lap} ${state.currentSet} OF ${setsOf}`,
              status: "OVERTIME",
              tone: HOME_ORANGE,
              value: `+${formatClock(overtime)}`,
              unit: "OVER",
              valueTone: HOME_ORANGE,
              valueLabel: `${overtime} seconds over the box`,
              aside: target,
            }
          : {
              label: `${lap} ${state.currentSet} OF ${setsOf}`,
              status: "WORK",
              tone: colors.primary,
              value: formatClock(remaining),
              unit: "LEFT",
              // The last five seconds run hot here too, with the stage's light.
              valueTone: hot ? HOME_ORANGE : undefined,
              valueLabel: `${remaining} seconds left`,
              aside: target,
            }
        : {
            label: isTransition ? `ALL ${lap}S DONE` : `${lap} ${state.currentSet} LOGGED`,
            status: isTransition ? "UP NEXT" : "REST",
            tone: isTransition ? colors.primary : colors.water,
            value: formatClock(timer),
            unit: "REST",
            valueLabel: `${timer} seconds of rest left`,
            aside: restAside,
          };
  const panelStatus = isPaused ? "PAUSED" : panel.status;
  const panelTone = isPaused ? colors.textSecondary : panel.tone;
  const tally = chartTally(columns);

  /* ── The controls ─────────────────────────────────────────────────── */

  const howTo: RoundAction = {
    label: guideTarget ? `How to do ${guideTarget.name}` : "How to",
    caption: "HOW TO",
    icon: "help",
    onPress: openGuide,
    disabled: !guideTarget,
    // The "How to" glow, while a set runs and the screen is awake.
    attention: phase === "ACTIVE_SET" && !dimmed,
  };
  const pauseAction: RoundAction = {
    label: "Pause",
    caption: "PAUSE",
    icon: "pause",
    onPress: handleTogglePause,
  };
  const addRest: RoundAction = {
    label: "Add 20 seconds",
    caption: "MORE TIME",
    text: "+20",
    onPress: handleAddRest,
  };

  let primary: PrimaryAction;
  let actions: [RoundAction, RoundAction];
  if (isPaused) {
    primary = { label: "Resume", icon: "play", tone: "brand", onPress: handleTogglePause };
    actions = [
      {
        label: "Every move in this session",
        caption: "ALL MOVES",
        icon: "list",
        onPress: () => setShowDrills(true),
      },
      {
        label: "End or leave this workout",
        caption: "END",
        icon: "stop",
        danger: true,
        onPress: handleLeave,
      },
    ];
  } else if (phase === "COUNTDOWN") {
    primary = { label: "Start now", icon: "flash", tone: "tonal", onPress: handleBeginFirstSet };
    actions = [{ ...howTo, attention: false }, pauseAction];
  } else if (phase === "ACTIVE_SET") {
    primary = {
      label: `Done ${lapWord.toLowerCase()}`,
      icon: "checkmark",
      tone: "brand",
      onPress: handleCompleteSet,
    };
    actions = [howTo, pauseAction];
  } else if (isTransition) {
    primary = { label: "Start next", icon: "flash", tone: "brand", onPress: handleSkipRest };
    actions = [addRest, pauseAction];
  } else {
    primary = { label: "Skip rest", icon: "play-forward", tone: "water", onPress: handleSkipRest };
    actions = [addRest, pauseAction];
  }

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={LIVE_EDGES}>
        {phase === "INTRO" && (
          <SessionPlan
            label={state.sessionLabel}
            exercises={state.exercises}
            lapWord={lapWord}
            bottomInset={insets.bottom}
            onStart={handleStart}
            onBack={handleLeave}
            onAdjust={setPrescribeIndex}
          />
        )}

        {isLivePhase && (
          <View
            style={[
              styles.live,
              compact && styles.liveCompact,
              { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            ]}
          >
            <Reanimated.View style={chromeStyle} pointerEvents={dimmed ? "none" : "auto"}>
              <LiveTopBar
                elapsed={formatClock(state.elapsedSeconds)}
                paused={isPaused}
                compact={compact}
                colors={colors}
                onEnd={handleLeave}
              />
            </Reanimated.View>

            <Reanimated.View style={chromeStyle} pointerEvents={dimmed ? "none" : "auto"}>
              <Reanimated.View key={`title-${title}`} entering={enterFade()} style={styles.titleBlock}>
                <Pressable
                  onPress={openGuide}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`How to perform ${title}`}
                  style={styles.titleRow}
                >
                  <AppText
                    variant={compact ? "headline" : "title"}
                    numberOfLines={1}
                    style={styles.titleText}
                  >
                    {title}
                  </AppText>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
                </Pressable>
                {/* Both versions of this line are one Mono line tall, so the
                    stage under it never moves when a set starts. */}
                {lineCue ? (
                  <Reanimated.View key={lineCue.text} entering={enterFade()} style={styles.cueLine}>
                    <Ionicons name={lineCue.icon} size={12} color={lineCue.tone} />
                    <AppText
                      variant="footnote"
                      color={lineCue.tone === HOME_ORANGE ? HOME_ORANGE : "secondary"}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.2}
                      style={styles.cueText}
                    >
                      {lineCue.text}
                    </AppText>
                  </Reanimated.View>
                ) : (
                  <Mono size={11} tracking={0.6} color={colors.textTertiary} numberOfLines={1}>
                    {subtitle}
                  </Mono>
                )}
              </Reanimated.View>
            </Reanimated.View>

            <SessionHero
              style={styles.hero}
              glow={glow}
              floor={floor}
              veil={isPaused}
              renderFigure={renderFigure}
              renderAux={renderAux}
              auxSide={auxCorner}
              overlay={pauseOverlay}
            />

            <SessionPanel
              label={panel.label}
              status={panelStatus}
              tone={panelTone}
              value={panel.value}
              unit={panel.unit}
              valueKey={panel.valueKey}
              valueTone={panel.valueTone}
              valueLabel={panel.valueLabel}
              aside={panel.aside}
              compact={compact}
            >
              <Pressable
                onPress={() => setShowDrills(true)}
                accessibilityRole="button"
                accessibilityLabel={`${tally.done} of ${tally.total} sets done. Show every move in this session`}
              >
                <SessionChart columns={columns} cursor={cursor} stripHeight={compact ? 26 : 40} />
              </Pressable>
            </SessionPanel>

            <Reanimated.View style={controlsStyle} pointerEvents={dimmed ? "none" : "auto"}>
              <SessionControls primary={primary} actions={actions} quiet={dimmed} />
            </Reanimated.View>
          </View>
        )}

        {phase === "COMPLETE" && (
          <SessionComplete
            state={state}
            streak={streak}
            compact={compact}
            bottomInset={insets.bottom}
            onFinish={handleFinish}
          />
        )}
      </SafeAreaView>

      {/* Glance mode's wake layer: while the stage is dim the FIRST touch only
          brings the chrome back. Nothing underneath it can be hit blind. */}
      {dimmed && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={wake}
          accessibilityRole="button"
          accessibilityLabel="Wake the session controls"
        />
      )}

      {/* The only exit, and it names both ways out. */}
      <ExitSheet
        visible={showExit}
        elapsed={formatClock(state.elapsedSeconds)}
        where={where}
        colors={colors}
        onClose={() => setShowExit(false)}
        onEnd={handleEndSession}
        onLeave={handleLeaveForNow}
      />

      {/* "This session" — the whole workout at a glance, in its blocks. */}
      <DrillSheet
        visible={showDrills}
        onClose={() => setShowDrills(false)}
        state={state}
        colors={colors}
        onShowGuide={openGuideFromDrills}
      />

      {/* Adjust one exercise's prescription before the clock starts. */}
      <PrescribeSheet
        index={prescribeIndex}
        exercise={prescribeIndex === null ? undefined : state.exercises[prescribeIndex]}
        lapWord={lapWord}
        colors={colors}
        onClose={() => setPrescribeIndex(null)}
        onChange={handlePrescribe}
        onShowGuide={(ex) => {
          setPrescribeIndex(null);
          setGuideFor(ex);
        }}
      />

      {/* How-to — the deep reference: both angles, steps, muscle map. */}
      <ExerciseGuideSheet
        visible={guideFor !== null}
        onClose={closeGuide}
        exercise={guideFor ?? undefined}
      />
    </View>
  );
}

/* ─────────────────────────────── Header ────────────────────────────────── */

/**
 * The End pill and the LIVE chip.
 *
 * The left control is LABELLED, not a bare ✕: an unlabelled cross could mean
 * end, leave or cancel, and which one it meant was exactly what nobody could
 * tell. The chip is a reading, not a button — filled, never outlined.
 */
function LiveTopBar({
  elapsed,
  paused,
  compact,
  colors,
  onEnd,
}: {
  elapsed: string;
  paused: boolean;
  compact: boolean;
  colors: ThemeColors;
  onEnd: () => void;
}) {
  return (
    <View style={[styles.topBar, compact && styles.topBarCompact]}>
      <Pressable
        onPress={onEnd}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="End or leave this workout"
        style={({ pressed }) => [
          styles.endBtn,
          { backgroundColor: colors.surfaceElevated },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="close" size={15} color={colors.text} />
        <AppText variant="caption" weight="700">
          End
        </AppText>
      </Pressable>
      <View
        style={[styles.liveChip, { backgroundColor: colors.surfaceElevated }]}
        accessible
        accessibilityLabel={`${paused ? "Paused" : "Live"}, ${elapsed} elapsed`}
      >
        <View style={[styles.liveDot, { backgroundColor: paused ? colors.textTertiary : LIVE_DOT }]} />
        <Mono size={11} tracking={0.6} color={colors.text}>
          {`${paused ? "PAUSED" : "LIVE"} · ${elapsed}`}
        </Mono>
      </View>
    </View>
  );
}

/** A round control laid over the paused stage, with its name under it. */
function StageAction({
  icon,
  label,
  onPress,
  disabled = false,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stageAction, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.stageDisc, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <Mono size={10} tracking={0.6} color={colors.textSecondary}>
        {label.toUpperCase()}
      </Mono>
    </Pressable>
  );
}

/* ───────────────────────────── Prescription ────────────────────────────── */

/** Sets, how long a set runs, and how long you get back. Nothing else. */
function PrescribeSheet({
  index,
  exercise,
  lapWord,
  colors,
  onClose,
  onChange,
  onShowGuide,
}: {
  index: number | null;
  exercise?: SessionExerciseInfo;
  lapWord: string;
  colors: ThemeColors;
  onClose: () => void;
  onChange: (index: number, patch: Partial<SessionExerciseInfo>) => void;
  onShowGuide: (ex: SessionExerciseInfo) => void;
}) {
  const visible = index !== null && !!exercise;
  const work = exercise ? resolveWorkSeconds(exercise) : 0;

  const bump = (patch: Partial<SessionExerciseInfo>) => {
    if (index === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange(index, patch);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={
        <View style={styles.drillHead}>
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={1}>
              {exercise?.name ?? ""}
            </AppText>
            <AppText variant="caption" color="tertiary">
              {exercise?.exerciseType === "timed"
                ? "A hold — the clock is the work"
                : `Reps are a target, the clock is the work`}
            </AppText>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      }
    >
      {exercise && (
        <View style={styles.prescribeBody}>
          <PrescribeRow
            label={`${lapWord}s`}
            hint={exercise.exerciseType === "timed" ? "How many holds" : "How many times through"}
            value={`${exercise.sets}`}
            colors={colors}
            canDecrement={exercise.sets > 1}
            canIncrement={exercise.sets < 8}
            onDecrement={() => bump({ sets: exercise.sets - 1 })}
            onIncrement={() => bump({ sets: exercise.sets + 1 })}
          />
          <PrescribeRow
            label={exercise.exerciseType === "timed" ? "Hold for" : "Work"}
            hint={
              exercise.exerciseType === "timed"
                ? "How long each hold lasts"
                : `Long enough for ${exercise.reps} reps`
            }
            value={`${work}s`}
            colors={colors}
            canDecrement={work > 15}
            canIncrement={work < 180}
            onDecrement={() => bump({ workSeconds: work - 5 })}
            onIncrement={() => bump({ workSeconds: work + 5 })}
          />
          <PrescribeRow
            label="Rest"
            hint={`Between each ${lapWord.toLowerCase()}`}
            value={`${exercise.restSeconds}s`}
            colors={colors}
            canDecrement={exercise.restSeconds > 15}
            canIncrement={exercise.restSeconds < 180}
            onDecrement={() => bump({ restSeconds: exercise.restSeconds - 5 })}
            onIncrement={() => bump({ restSeconds: exercise.restSeconds + 5 })}
          />
          <Button
            label="How it's done"
            icon="body-outline"
            variant="ghost"
            onPress={() => onShowGuide(exercise)}
          />
        </View>
      )}
    </Sheet>
  );
}

function PrescribeRow({
  label,
  hint,
  value,
  colors,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
}: {
  label: string;
  hint: string;
  value: string;
  colors: ThemeColors;
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={[styles.prescribeRow, { borderBottomColor: colors.divider }]}>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        <AppText variant="caption" color="tertiary">
          {hint}
        </AppText>
      </View>
      <Stepper
        value={value}
        label={label}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        canDecrement={canDecrement}
        canIncrement={canIncrement}
        valueWidth={46}
      />
    </View>
  );
}

/* ───────────────────────────── Leaving ────────────────────────────────── */

/**
 * "End session" and "Leave for now" are genuinely different things — one banks
 * the workout and opens the summary, the other keeps it in progress — and a
 * two-button alert could never make that clear. Both are spelled out here, with
 * the consequence written under each, because getting this wrong loses a
 * workout either way.
 */
function ExitSheet({
  visible,
  elapsed,
  where,
  colors,
  onClose,
  onEnd,
  onLeave,
}: {
  visible: boolean;
  elapsed: string;
  where: string;
  colors: ThemeColors;
  onClose: () => void;
  onEnd: () => void;
  onLeave: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={
        <View style={styles.drillHead}>
          <View style={styles.flex}>
            <AppText variant="headline">Finish up?</AppText>
            <Mono size={10} tracking={0.6} color={colors.textTertiary} numberOfLines={1}>
              {`${elapsed} IN · ${where}`}
            </Mono>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      }
    >
      <View style={styles.exitBody}>
        <Button label="End session" icon="checkmark-done" size="lg" onPress={onEnd} />
        <AppText variant="caption" color="tertiary" align="center">
          Banks everything you&apos;ve done and opens your summary.
        </AppText>

        <View style={styles.exitGap} />

        <Button label="Leave for now" icon="time-outline" variant="tonal" onPress={onLeave} />
        <AppText variant="caption" color="tertiary" align="center">
          Stays in progress — pick it up again from Fitness.
        </AppText>

        <Button label="Keep training" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
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
  // The list speaks in the session's blocks, like the plan screen and the strip.
  const blocked = hasBlocks(state.exercises);
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
          const block = blockOf(ex);
          const opensBlock = blocked && (i === 0 || blockOf(state.exercises[i - 1]) !== block);
          return (
            <React.Fragment key={`${ex.exerciseId}-${i}`}>
              {opensBlock ? (
                <Mono size={10} tracking={0.6} color={colors.textTertiary} style={styles.drillBlock}>
                  {BLOCK_LABEL[block].toUpperCase()}
                </Mono>
              ) : null}
              <Pressable
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
                    {prescriptionText(ex)}
                    {skipped ? " · skipped" : isCurrent ? " · now" : ""}
                  </AppText>
                </View>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
              </Pressable>
            </React.Fragment>
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
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.85 },
  disabled: { opacity: 0.4 },

  // The live screen: four parts in a column, the stage taking what is left.
  live: { flex: 1, paddingHorizontal: Spacing.screen, gap: Spacing.sm + 2 },
  // A short phone hands these points to the stage — they pay for the names
  // under the round buttons.
  liveCompact: { gap: Spacing.sm },

  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarCompact: { height: 44 },
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },

  titleBlock: { gap: 1, paddingHorizontal: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  // A long exercise name truncates rather than shoving the ⓘ off the edge.
  titleText: { flexShrink: 1 },

  // The stage gives way first: on the smallest screen at the largest text it
  // shrinks, and the controls under it never leave the glass.
  hero: { flex: 1, minHeight: 64 },
  onStage: { position: "absolute", left: 0, right: 0, alignItems: "center" },

  // The coach's cue, in the line under the title — set on the Mono line's height.
  cueLine: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  cueText: { flexShrink: 1, lineHeight: 15 },

  pauseRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xxl },
  stageAction: { alignItems: "center", gap: 6 },
  stageDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: EDGE_WHITE,
    alignItems: "center",
    justifyContent: "center",
  },

  stepperAside: { alignItems: "flex-end", gap: 3 },

  prescribeBody: { paddingHorizontal: Spacing.sm, gap: Spacing.xs, paddingBottom: Spacing.lg },
  exitBody: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.sm },
  exitGap: { height: Spacing.xs },
  prescribeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Drill list
  drillHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  drillList: { flexGrow: 0, paddingHorizontal: Spacing.sm },
  drillBlock: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.md, paddingBottom: 2 },
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
