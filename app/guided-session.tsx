/**
 * GUIDED SESSION — the live workout player.
 *
 * TIME IS THE UNIT OF WORK. Every set is boxed to a clock — a hold carries its
 * own, a rep set gets one derived from its prescription — and reps are text the
 * athlete reads ("aim for 10–15"), never a counter they tap. Nobody can hold a
 * phone through a set of squats, so the player never asks them to: the only
 * touch a set needs is the one that ends it.
 *
 *   INTRO (the prescription — pre-filled, tap a row to adjust)
 *     → COUNTDOWN (a smooth 3-2-1-GO over a figure already in position)
 *       → ACTIVE_SET (the box counts down; past zero it counts UP in gold)
 *         ⇄ REST / TRANSITION (the only place controls live — including the
 *            pre-filled reps stepper that confirms the set just banked)
 *           → COMPLETE (celebration, then one question) → summary
 *
 * THE FIGURE IS THE SCREEN. The demonstration used to be hidden behind a "How
 * to" button; it is now the hero of every live phase, standing inside the
 * instrument ring. The ring is the frame, not the star: one arc per set, the
 * live one filling, gold overtime hand on the outside (see SessionRing).
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
import { Flame } from "@/components/celebration/Flame";
import { Ease, enterFade, enterHero, enterRise, exitFade } from "@/components/motion";
import {
  AmbientCanvas,
  AppText,
  Button,
  IconBadge,
  Sheet,
  Stepper,
  useColors,
} from "@/components/ui";
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { Gradients, Motion, Palette, Radius, Spacing, alpha, type ThemeColors } from "@/constants/theme";
import { useWorkout } from "@/contexts/AppContext";
import {
  resolveFigureMotion,
  type FigureMotion,
} from "@/fitness/animation/movementProfiles";
import {
  ExerciseFigure,
  FigureStill,
  primaryView,
  secondaryView,
  stillFrame,
  useFigureClock,
} from "@/fitness/components/ExerciseFigure";
import { ExerciseGuideSheet } from "@/fitness/components/ExerciseGuideSheet";
import { RestingFace } from "@/fitness/components/RestingFace";
import { SessionRing } from "@/fitness/components/SessionRing";
import { rememberSessionEffort } from "@/fitness/services/FitnessProfileStore";
import { workoutFromSessionId } from "@/fitness/services/WorkoutCatalog";
import {
  SessionEffort,
  SessionExerciseInfo,
  SessionState,
  resolveWorkSeconds,
} from "@/models/session";
import type { PlannedExercise } from "@/models/workout";
import { getCountdownLine } from "@/services/CoachEngine";
import { SessionService } from "@/services/SessionService";
import * as Haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const service = SessionService.getInstance();

/** Triumphant gold ramp for overtime, the final push and completion. */
const GOLD_GRADIENT = ["#FFE39A", "#F5C451", "#E39B2E"] as const;
/** Ink on the gold slab — white on that gold is mush. */
const GOLD_INK = "#2A1D01";

/** The 3-2-1-GO the player runs itself, so it never rides the 1Hz session tick. */
const COUNT_FROM = 3;
const GO_HOLD_MS = 450;

/** How long the stage stays fully lit with nobody touching it. */
const IDLE_DIM_MS = 20000;
/** How dark the chrome goes in glance mode — a hint of shape, nothing more. */
const DIM_OPACITY = 0.11;

/** How much real time a single catch-up may replay, so a long background gap
 *  can never freeze the JS thread replaying an hour of ticks. */
const MAX_CATCH_UP_TICKS = 900;

/** The "How to" glow: two seconds lit, four seconds dark, forever. A beat that
 *  keeps running without ever nagging. */
const GLOW_MS = 1000;
const GLOW_REST_MS = 4000;

/** Anything above the stage: the header row plus the exercise segments. */
const HEADER_ZONE = 68;
/** The primary slab's face — its height ABOVE the bottom inset it runs on under. */
const SLAB_HEIGHT = 60;
/** The dock: the four-slot icon row, then the slab on the floor —
 *  8 top pad + 62 row (42 disc, 5 gap, 15 label) + 12 gap + 60 slab face.
 *  (The slab's inset share is already in `insets.bottom`.) Re-sum it whenever
 *  the dock changes: the hero is sized from what this leaves. */
const DOCK_ZONE = 142;
/**
 * The live stage handles the bottom inset itself — the slab runs on under the
 * gesture bar to the very bottom of the glass — so the safe area only pads the
 * other three sides while it's up.
 */
const LIVE_EDGES = ["top", "left", "right"] as const;

/**
 * The stage's fixed zones, in two sizes.
 *
 * They are what stops anything on this screen from ever moving — a crossfading
 * caption or a rolling clock can't nudge the figure by a pixel — but they also
 * eat the height the figure needs, so a short phone gets the compact set and
 * the hero is then sized from whatever is genuinely left over.
 */
function stageMetrics(compact: boolean) {
  return {
    caption: compact ? 76 : 88,
    readout: compact ? 78 : 98,
    hint: compact ? 56 : 64,
    clockFont: compact ? 44 : 62,
    clockLine: compact ? 50 : 70,
    // REST INVERTS THE HIERARCHY. During work the clock is the headline and the
    // word under it is a label; during rest the WORD is the headline and the
    // clock is the detail — because "rest" is the instruction and the seconds
    // are only how long it lasts. Same zone, opposite emphasis.
    restWordFont: compact ? 26 : 32,
    restWordLine: compact ? 30 : 37,
    restFont: compact ? 24 : 30,
    restLine: compact ? 28 : 35,
  };
}

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

/** "3 × 10–15" for reps, "3 × 45s" for a hold — always the LIVE prescription. */
function prescriptionText(ex: SessionExerciseInfo): string {
  return ex.exerciseType === "timed"
    ? `${ex.sets} × ${resolveWorkSeconds(ex)}s`
    : `${ex.sets} × ${ex.reps}`;
}

/** Rough wall-clock length of the whole session, for the prescription header. */
function estimateSessionSeconds(exercises: SessionExerciseInfo[]): number {
  return exercises.reduce((sum, e) => {
    const work = resolveWorkSeconds(e) * e.sets;
    const rest = e.restSeconds * Math.max(0, e.sets - 1);
    return sum + work + rest + e.transitionSeconds;
  }, 0);
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

/** Air between the second angle's panel and the ring's outer edge. */
const AUX_RING_CLEARANCE = 8;
/** Height the FRONT / SIDE caption adds under the panel. */
const AUX_LABEL_HEIGHT = 15;
/** Below this it stops being a demonstration and becomes a smudge. */
const AUX_MIN_SIZE = 54;

/**
 * How big the second camera angle can be drawn in a stage corner.
 *
 * THIS USED TO BE A YES/NO GATE, and on most phones the answer was no. It
 * asked for one and a half panel-widths of clear gutter beside the ring, which
 * a 390pt-wide screen doesn't have — so the second angle simply never rendered,
 * silently, on the exact devices it was written for. Nothing was wrong with the
 * panel; it was never mounted.
 *
 * A ring is a CIRCLE, so the corners of the square it sits in are free even
 * when the gutter beside it is not. This measures the real diagonal to the
 * corner the panel occupies and returns the largest size that still clears the
 * graduation band, shrinking rather than disappearing. It always returns
 * something drawable — the panel is never conditionally absent again.
 */
function secondAngleSize(
  stageWidth: number,
  heroRoom: number,
  heroSize: number,
  /** Panel width as a fraction of its height — 0.94 front, 0.78 side. */
  aspect: number,
): number {
  const cx = stageWidth / 2;
  const cy = Math.max(0, (heroRoom - heroSize) / 2) + heroSize / 2;
  const r = heroSize / 2 + AUX_RING_CLEARANCE;
  for (let s = Math.round(heroSize * 0.42); s > AUX_MIN_SIZE; s -= 2) {
    const dx = cx - s * aspect;
    const dy = cy - (s + AUX_LABEL_HEIGHT);
    if (dx * dx + dy * dy >= r * r) return s;
  }
  return AUX_MIN_SIZE;
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
): SessionExerciseInfo[] {
  const ids = idsStr.split(",").map((s) => s.trim());
  const setsArr = setsStr ? setsStr.split(",").map((s) => parseInt(s.trim(), 10)) : [];
  const repsArr = repsStr ? repsStr.split(",").map((s) => s.trim()) : [];
  // Plan sessions prescribe their own rests (short for fat loss, long for
  // strength); a library run passes none and keeps each move's default.
  const restArr = restStr ? restStr.split(",").map((s) => parseInt(s.trim(), 10)) : [];

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
          restSeconds: restArr[i] || dbEntry.restSeconds,
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
        if (restArr[i]) info.restSeconds = restArr[i];
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
    /** Rest seconds per exercise, comma-joined like sets/reps. Optional. */
    rest?: string;
    /** "1" → restore the persisted in-progress session instead of starting fresh. */
    resume?: string;
  }>();
  const router = useRouter();
  const { colors } = useColors();
  const { workoutPlan } = useWorkout();
  const { width, height } = useWindowDimensions();

  // The screen stays lit for the whole session: the demonstration figure is the
  // interface, and a sleeping screen would take it away exactly when someone
  // has put the phone on the floor and needs it most. Glance mode below is what
  // saves the battery instead.
  useKeepAwake("welliva-session");

  // The instrument takes the height nothing else claimed. Sizing it off a
  // fraction of the viewport is what lets a hero overlap the clock on a short
  // phone, so it is measured against the real zones instead — width still caps
  // it, and it never grows past the point where the figure stops gaining.
  const insets = useSafeAreaInsets();
  const metrics = stageMetrics(height < 720);
  const heroRoom =
    height -
    insets.top -
    insets.bottom -
    HEADER_ZONE -
    DOCK_ZONE -
    metrics.caption -
    metrics.readout -
    metrics.hint;
  // The ring gives back a sliver of that room so the second camera angle has a
  // corner to live in that is genuinely OUTSIDE the circle — a small panel laid
  // over the graduation band would read as a mistake.
  const heroSize = Math.max(150, Math.min(width - 52, heroRoom * 0.8, 300));
  // The figure is as BIG as the ring lets it be, not a fixed fraction of it: its
  // panel is generous and the figure is fitted INSIDE a circle a little under
  // the band's inner edge (ExerciseFigure's `fit`), so a compact pose — a stand,
  // a squat — fills the ring and a wide one — a jumping jack — shrinks just
  // enough to clear it. The sliver of air left is what stops the two reading as
  // one crowded object.
  const figureSize = Math.round(heroSize * 0.8);
  const figureFit = heroSize * 0.36;
  // The sleeping face has no silhouette to fit; it keeps its own size.
  const restSize = Math.round(heroSize * 0.62);
  const countScrim = Math.round(heroSize * 0.7);
  const stageWidth = width - Spacing.screen * 2;

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
    () => buildExerciseList(params.exerciseIds || "", planLookup, params.sets, params.reps, params.rest),
    [params.exerciseIds, params.sets, params.reps, params.rest, planLookup],
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
   * is on stage throughout now, so this sheet is the DEEP reference (steps,
   * muscle map, both camera angles) rather than the only way to see the move.
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
   * There used to be no way to END a session except from inside the pause
   * screen, which is why the flow felt like it could run forever: pause,
   * continue, rest, continue, with nothing that said "I'm finished". Every
   * exit now goes through ONE sheet with both answers spelled out — the ✕ in
   * the header opens it, and so does the pause screen. */
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
   * fades out and the stage keeps only what you can read from the floor: the
   * figure, the clock, the ring. The next touch anywhere wakes it and does
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

  const currentEx = state?.exercises[state.currentExerciseIndex];

  /* ── The demonstration ────────────────────────────────────────────────
   * During a transition the move on stage is the one COMING, so the athlete
   * sees what they're about to do while they walk to it. */
  const figureExercise = state
    ? state.phase === "TRANSITION"
      ? state.exercises[state.currentExerciseIndex + 1]
      : currentEx
    : undefined;
  const exerciseMotion = figureExercise
    ? resolveFigureMotion(figureExercise.exerciseId, figureExercise.category)
    : "neutral";
  /** REST is the one phase with nothing to demonstrate — the face takes over. */
  const resting = phase === "REST";
  /**
   * THE FIGURE STOPS WHEN THE ATHLETE DOES.
   *
   * A round ends and the player walks to the next exercise — and the figure
   * used to keep grinding out reps of a move nobody is doing. Rest already had
   * its answer (the sleeping face); a transition had none, so the stage looked
   * like it hadn't noticed the set was over.
   *
   * TRANSITION now shows the same body AT EASE: an idle stand-and-breathe in
   * place of the movement, on its own slow clock. The exercise itself starts
   * moving again the moment the next round does.
   */
  const idling = phase === "TRANSITION";
  const figureMotion: FigureMotion = idling ? "idle" : exerciseMotion;
  /**
   * ONE clock for both panels. Two ExerciseFigures each running their own loop
   * drift apart the moment either remounts, and two copies of the same body out
   * of step is worse than showing one angle.
   */
  const figureClock = useFigureClock(figureMotion, !isPaused && !resting);
  // The camera angles stay chosen by the EXERCISE, not by the idle pose, so
  // the stage doesn't swing its cameras around during the walk between moves.
  const mainAngle = primaryView(exerciseMotion);
  const auxAngle = secondaryView(exerciseMotion);
  const auxCorner = auxCornerFor(figureExercise?.exerciseId ?? "");
  // The corner panel is ALWAYS filled. When there is a second honest camera it
  // shows that; when there isn't (see `aux` below) it shows the key position of
  // the movement instead, which is the still the rest of the app identifies the
  // exercise by.
  const auxView = auxAngle ?? mainAngle;
  const auxSize = secondAngleSize(stageWidth, heroRoom, heroSize, auxView === "side" ? 0.78 : 0.94);
  const auxLabel = auxAngle ?? (stillFrame(exerciseMotion) === 0 ? "top" : "bottom");

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
  const guideTarget = figureExercise;
  const isTimed = currentEx?.exerciseType === "timed";

  /* ── The clock ────────────────────────────────────────────────────── */

  const workSeconds = currentEx ? resolveWorkSeconds(currentEx) : 0;
  const restTotal = isTransition
    ? nextExercise?.transitionSeconds ?? 30
    : currentEx?.restSeconds ?? 60;
  const timer = state.timerValue;
  const remaining = Math.max(0, workSeconds - timer);
  const overtime = phase === "ACTIVE_SET" ? Math.max(0, timer - workSeconds) : 0;

  // The last five seconds of the box run hot, and so does every second past it.
  const hot = phase === "ACTIVE_SET" && (overtime > 0 || (remaining > 0 && remaining <= 5));

  /* ── What the instrument is showing right now ─────────────────────── */

  let ringProgress = 0;
  let ringLinear = false;
  let ringDuration = 520;
  let ringGradient: readonly [string, string, ...string[]] = colors.brandGradient;
  const ringSegments = isResting ? 1 : currentEx?.sets ?? 1;
  const ringCurrent = isResting ? 1 : state.currentSet;

  if (phase === "ACTIVE_SET") {
    ringProgress = workSeconds > 0 ? Math.min(1, timer / workSeconds) : 0;
    ringLinear = true;
    ringDuration = 1000;
    ringGradient = hot ? GOLD_GRADIENT : colors.brandGradient;
  } else if (isResting) {
    ringProgress = restTotal > 0 ? Math.max(0, Math.min(1, timer / restTotal)) : 0;
    ringLinear = true;
    ringDuration = 1000;
    ringGradient = isTransition ? colors.brandGradient : Gradients.water;
  }

  const ringPulse = isResting || hot || phase === "COUNTDOWN";

  /* ── Caption / hint / dock, per phase ──────────────────────────────── */

  const caption =
    phase === "COUNTDOWN"
      ? { eyebrow: "Get ready", title: currentEx?.name ?? "" }
      : phase === "ACTIVE_SET"
        ? { eyebrow: `Exercise ${exerciseProgress}`, title: currentEx?.name ?? "" }
        : isTransition
          ? { eyebrow: "Up next", title: nextExercise?.name ?? "" }
          : { eyebrow: "Recover", title: currentEx?.name ?? "" };

  // One cue per set, walked through the exercise's list — a written coach that
  // says something new each round instead of repeating line one four times.
  const coachCue =
    currentEx?.coachCues?.length
      ? currentEx.coachCues[(state.currentSet - 1) % currentEx.coachCues.length]
      : getCountdownLine(countdown).text;

  /** How much of the rest has gone — the slab's fuse. */
  const restElapsed = restTotal > 0 ? Math.max(0, Math.min(1, 1 - timer / restTotal)) : 0;

  const primary: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: SlabTone;
    progress?: number;
    onPress: () => void;
  } =
    phase === "COUNTDOWN"
      ? { label: "Start now", icon: "flash", tone: "tonal", onPress: handleBeginFirstSet }
      : phase === "ACTIVE_SET"
        ? {
            label: `Done ${lapWord.toLowerCase()}`,
            icon: "checkmark",
            // Gold the moment the box is spent: the set is waiting on this tap.
            tone: overtime > 0 ? "gold" : "brand",
            onPress: handleCompleteSet,
          }
        : isTransition
          ? { label: "Start next", icon: "flash", tone: "brand", progress: restElapsed, onPress: handleSkipRest }
          : { label: "Skip rest", icon: "play-forward", tone: "water", progress: restElapsed, onPress: handleSkipRest };

  // Slot two of the dock carries whatever this phase actually needs there —
  // never a dead button.
  const contextAction = isResting
    ? { icon: "add" as const, label: "+20s", onPress: handleAddRest, disabled: false }
    : {
        icon: "help-circle" as const,
        label: "How to",
        onPress: () => guideTarget && setGuideFor(guideTarget),
        disabled: !guideTarget,
      };

  /** Reps banked for the set that just finished — the rest screen's stepper. */
  const bankedReps = isResting ? service.lastSetReps(state) : null;

  return (
    <View style={styles.flex}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={isLivePhase && !isPaused ? LIVE_EDGES : undefined}>
        {isLivePhase && (
          <Reanimated.View style={chromeStyle} pointerEvents={dimmed ? "none" : "auto"}>
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
          </Reanimated.View>
        )}

        <View style={styles.main}>
          {phase === "INTRO" && (
            <PrescriptionView
              label={state.sessionLabel}
              exercises={state.exercises}
              lapWord={lapWord}
              colors={colors}
              onStart={handleStart}
              onBack={handleLeave}
              onAdjust={setPrescribeIndex}
            />
          )}

          {isLivePhase && isPaused && (
            <PauseView
              elapsed={formatTime(state.elapsedSeconds)}
              exerciseName={currentEx?.name ?? ""}
              exerciseProgress={exerciseProgress}
              colors={colors}
              onResume={handleTogglePause}
              onEnd={handleLeave}
            />
          )}

          {isLivePhase && !isPaused && (
            <View style={styles.stage}>
              {/* ── Caption ─────────────────────────────────────────── */}
              <Reanimated.View style={[styles.captionZone, { height: metrics.caption }, chromeStyle]}>
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
                  {currentEx && !isTransition ? (
                    <SetPips
                      total={currentEx.sets}
                      current={state.currentSet}
                      lapWord={lapWord}
                      accent={diffColor}
                      colors={colors}
                    />
                  ) : (
                    <AppText variant="footnote" color="tertiary">
                      {nextExercise ? prescriptionText(nextExercise) : ""}
                    </AppText>
                  )}
                </Reanimated.View>
              </Reanimated.View>

              {/* ── Hero: the demonstration, framed by the instrument ── */}
              <View style={styles.heroZone}>
                <SessionRing
                  progress={ringProgress}
                  segments={ringSegments}
                  currentSegment={ringCurrent}
                  size={heroSize}
                  gradient={ringGradient}
                  overtimeSeconds={overtime}
                  pulse={ringPulse}
                  beat={hot}
                  linear={ringLinear}
                  duration={ringDuration}
                >
                  {resting ? (
                    <RestingFace size={restSize} playing />
                  ) : (
                    figureExercise && (
                      <ExerciseFigure
                        key={`${figureExercise.exerciseId}-main-${idling ? "idle" : "work"}`}
                        motion={figureMotion}
                        views={[mainAngle]}
                        size={figureSize}
                        fit={figureFit}
                        // At ease the body reads as standing by, not as the
                        // demonstration — same figure, one step back. (Faded,
                        // not re-coloured: the character wears its own kit.)
                        color={colors.text}
                        opacity={idling ? 0.55 : 1}
                        bare
                        clock={figureClock}
                      />
                    )
                  )}
                  {phase === "COUNTDOWN" && (
                    <View style={[StyleSheet.absoluteFill, styles.centerAll]} pointerEvents="none">
                      <View
                        style={[
                          styles.countScrim,
                          {
                            width: countScrim,
                            height: countScrim,
                            borderRadius: countScrim / 2,
                            backgroundColor: alpha(colors.background, 0.62),
                          },
                        ]}
                      />
                      <Reanimated.Text
                        key={countdown}
                        entering={enterHero()}
                        style={[
                          styles.bigNumber,
                          {
                            color: countdown <= 0 ? colors.primary : colors.text,
                            fontSize: Math.round(heroSize * (countdown <= 0 ? 0.24 : 0.32)),
                            lineHeight: Math.round(heroSize * (countdown <= 0 ? 0.28 : 0.36)),
                          },
                        ]}
                      >
                        {countdown <= 0 ? "GO" : countdown}
                      </Reanimated.Text>
                    </View>
                  )}
                </SessionRing>

                {/* The second panel — small, unframed, in a stage corner the
                    ring's circle leaves empty. Sized to fit rather than gated on
                    fitting: see secondAngleSize.

                    IT IS NEVER EMPTY. It used to hold the other camera angle and
                    nothing else, so when the catalogue stopped claiming a front
                    view for floor and all-fours work — the rig cannot foreshorten,
                    and a "front" plank drew a person standing up — the panel
                    silently vanished for every push-up, plank, bridge and crawl,
                    which is most of a session. A movement with one honest camera
                    still has two positions worth seeing, so it shows the one the
                    live figure passes through too fast to study, frozen: the
                    lockout of a push-up, the bottom of a squat. Captioned with
                    which it is, so the small panel is never mistaken for the
                    exercise itself. */}
                {!resting && figureExercise && (
                  <View
                    style={[styles.auxFigure, auxCorner === "left" ? { left: 0 } : { right: 0 }]}
                    pointerEvents="none"
                  >
                    {auxAngle ? (
                      <ExerciseFigure
                        key={`${figureExercise.exerciseId}-aux-${idling ? "idle" : "work"}`}
                        motion={figureMotion}
                        views={[auxAngle]}
                        size={auxSize}
                        color={colors.text}
                        opacity={idling ? 0.4 : 0.82}
                        bare
                        clock={figureClock}
                      />
                    ) : (
                      <View style={{ opacity: idling ? 0.4 : 0.82 }}>
                        <FigureStill
                          motion={exerciseMotion}
                          view={auxView}
                          size={auxSize}
                          at={stillFrame(exerciseMotion)}
                          color={colors.text}
                        />
                      </View>
                    )}
                    <AppText variant="caption" color="tertiary" uppercase align="center">
                      {auxLabel}
                    </AppText>
                  </View>
                )}
              </View>

              {/* ── Readout: the clock, big enough to read from the floor ── */}
              <View style={[styles.readoutZone, { height: metrics.readout }]}>
                <Reanimated.View key={`read-${phase}`} entering={enterFade()} style={styles.zoneFill}>
                  <StageReadout
                    phase={phase}
                    remaining={remaining}
                    overtime={overtime}
                    restLeft={timer}
                    isTimed={!!isTimed}
                    prescription={currentEx?.reps ?? ""}
                    lapWord={lapWord}
                    nextName={nextExercise?.name}
                    metrics={metrics}
                    colors={colors}
                  />
                </Reanimated.View>
              </View>

              {/* ── Hint / the rest screen's one input ─────────────────── */}
              <Reanimated.View
                style={[styles.hintZone, { height: metrics.hint }, chromeStyle]}
                pointerEvents={dimmed ? "none" : "auto"}
              >
                {isResting && bankedReps !== null ? (
                  <RepConfirm
                    reps={bankedReps}
                    lapWord={lapWord}
                    colors={colors}
                    onAdjust={handleAdjustReps}
                  />
                ) : (
                  <Reanimated.View
                    key={`hint-${phase}-${overtime > 0 ? "over" : "in"}`}
                    entering={enterFade()}
                    style={styles.zoneFill}
                  >
                    <HintPill
                      phase={phase}
                      overtime={overtime > 0}
                      isTimed={!!isTimed}
                      cue={coachCue}
                      colors={colors}
                    />
                  </Reanimated.View>
                )}
              </Reanimated.View>

              {/* ── Dock: same shape in every phase ─────────────────── */}
              <Reanimated.View
                style={[styles.dock, chromeStyle]}
                pointerEvents={dimmed ? "none" : "auto"}
              >
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
                    attention={phase === "ACTIVE_SET" && !dimmed}
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
                {/* The one big action, on the floor of the screen and the
                    full width of it — the same slab in every phase, so the
                    target never moves; only its colour and words change. */}
                <SessionSlab
                  label={primary.label}
                  icon={primary.icon}
                  tone={primary.tone}
                  progress={primary.progress}
                  onPress={primary.onPress}
                  bottomInset={insets.bottom}
                  colors={colors}
                />
              </Reanimated.View>
            </View>
          )}

          {phase === "COMPLETE" && (
            <CompletionView state={state} colors={colors} size={heroSize} onFinish={handleFinish} />
          )}
        </View>
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
        elapsed={formatTime(state.elapsedSeconds)}
        exerciseProgress={exerciseProgress}
        colors={colors}
        onClose={() => setShowExit(false)}
        onEnd={handleEndSession}
        onLeave={handleLeaveForNow}
      />

      {/* "This session" — the whole workout at a glance */}
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
      {/* Not a bare ✕. An unlabelled cross could mean end, leave, or cancel,
          and which one it meant was exactly what nobody could tell. */}
      <Pressable
        onPress={onLeave}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="End or leave this workout"
        style={({ pressed }) => [
          styles.endBtn,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="close" size={15} color={colors.text} />
        <AppText variant="caption" weight="700">
          End
        </AppText>
      </Pressable>
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
      <View style={styles.topRight}>
        <HeaderButton icon="list" label="This session" onPress={onDrills} colors={colors} />
      </View>
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

/**
 * The clock under the figure — the one number on this screen, sized to be read
 * from a phone lying on the floor. Counts the box DOWN, then counts UP in gold
 * once the box is spent, because a set that runs long is not a failure state.
 *
 * Deliberately NOT a `RollingNumber`. An odometer is right for a value that
 * changes now and then; on a 1Hz clock whose digits turn over at different
 * rates it is a stutter once a second, and the seconds column is never still
 * long enough for the roll to finish cleanly. Plain tabular numerals don't
 * move at all — the ring carries the motion, which is what it's for.
 */
function StageReadout({
  phase,
  remaining,
  overtime,
  restLeft,
  isTimed,
  prescription,
  lapWord,
  nextName,
  metrics,
  colors,
}: {
  phase: string | undefined;
  remaining: number;
  overtime: number;
  restLeft: number;
  isTimed: boolean;
  prescription: string;
  lapWord: string;
  nextName?: string;
  metrics: ReturnType<typeof stageMetrics>;
  colors: ThemeColors;
}) {
  if (phase === "COUNTDOWN") {
    return (
      <AppText variant="subhead" color="secondary">
        {isTimed ? `Hold for ${prescription}` : `Aim for ${prescription} reps`}
      </AppText>
    );
  }

  if (phase === "ACTIVE_SET") {
    const over = overtime > 0;
    return (
      <View style={styles.centerAll}>
        <Text
          style={[
            styles.clockNumber,
            {
              color: over ? colors.gold : colors.text,
              fontSize: metrics.clockFont - (over ? 6 : 0),
              lineHeight: metrics.clockLine - (over ? 6 : 0),
            },
          ]}
          allowFontScaling={false}
        >
          {over ? `+${formatTime(overtime)}` : formatTime(remaining)}
        </Text>
        <AppText variant="footnote" color="tertiary">
          {isTimed ? "hold the position" : `aim for ${prescription} reps`}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.centerAll}>
      <Text
        style={[
          styles.restWord,
          {
            color: colors.text,
            fontSize: metrics.restWordFont,
            lineHeight: metrics.restWordLine,
          },
        ]}
        allowFontScaling={false}
      >
        {phase === "TRANSITION" ? "NEXT UP" : "REST"}
      </Text>
      <Text
        style={[
          styles.restNumber,
          {
            color: colors.textSecondary,
            fontSize: metrics.restFont,
            lineHeight: metrics.restLine,
          },
        ]}
        allowFontScaling={false}
      >
        {formatTime(restLeft)}
      </Text>
      <AppText variant="footnote" color="tertiary" numberOfLines={1}>
        {phase === "TRANSITION" ? nextName ?? "" : `next ${lapWord.toLowerCase()} coming up`}
      </AppText>
    </View>
  );
}

/**
 * The rest screen's one input: the reps that were just banked, pre-filled from
 * the prescription. Doing nothing accepts it — which is the point.
 */
function RepConfirm({
  reps,
  lapWord,
  colors,
  onAdjust,
}: {
  reps: number;
  lapWord: string;
  colors: ThemeColors;
  onAdjust: (delta: number) => void;
}) {
  return (
    <Reanimated.View
      entering={enterRise()}
      style={[
        styles.repConfirm,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
    >
      <View style={styles.flex}>
        <AppText variant="footnote" weight="600">
          {lapWord} logged
        </AppText>
        <AppText variant="caption" color="tertiary">
          Adjust it only if that wasn&apos;t right
        </AppText>
      </View>
      <Stepper
        value={`${reps}`}
        label="Reps completed"
        onDecrement={() => onAdjust(-1)}
        onIncrement={() => onAdjust(1)}
        canDecrement={reps > 0}
        valueWidth={34}
      />
    </Reanimated.View>
  );
}

function HintPill({
  phase,
  overtime,
  isTimed,
  cue,
  colors,
}: {
  phase: string | undefined;
  overtime: boolean;
  isTimed: boolean;
  cue: string;
  colors: ThemeColors;
}) {
  if (phase === "ACTIVE_SET" && overtime) {
    return (
      <View
        style={[
          styles.hintPill,
          { backgroundColor: alpha(Palette.warning, 0.12), borderColor: alpha(Palette.warning, 0.4) },
        ]}
      >
        <Ionicons name="flame" size={15} color={Palette.warning} />
        <AppText variant="caption" uppercase style={styles.bonusText}>
          Overtime — finish when you&apos;re ready
        </AppText>
      </View>
    );
  }

  if (phase === "REST" || phase === "TRANSITION") {
    return (
      <View style={[styles.hintPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Ionicons name="leaf-outline" size={15} color={colors.water} />
        <AppText variant="caption" color="secondary" uppercase>
          {isTimed ? "Hold banked · breathe" : "Breathe · shake it out"}
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

/** What the slab is for — which decides its colour. */
type SlabTone = "brand" | "gold" | "water" | "tonal";

/**
 * THE SESSION'S ONE BIG BUTTON — "Done set", "Skip rest", "Start next".
 *
 * Owner, 2026-10-16: the compact button centred over the dock was "awful" —
 * make it much better, and spread it to the edges of the screen. So it is a
 * SLAB: the full width of the phone and flush with the bottom of the glass (it
 * runs on under the gesture bar / home indicator, its label sitting above it).
 * Square, as the owner asked on 2026-10-03 ("pointed edges, not a curved
 * edge") — and a slab that meets three edges of the screen has no corners to
 * round anyway.
 *
 *   · One flat colour per phase, the ring's language: brand while you work,
 *     GOLD the moment the box runs into overtime (the set is waiting for this
 *     tap), water at rest.
 *   · One stroke of light along its top edge — the shine the flame, the badges
 *     and the ring carry. At rest that stroke is a FUSE: it burns across the
 *     slab as the rest elapses, so "Skip rest" shows how much there is left to
 *     skip without putting another number on screen.
 *   · A bold uppercase label with its icon — a game's CONTINUE, not a form's
 *     Submit.
 *   · It presses: the face darkens and the label sinks a point and a half.
 */
function SessionSlab({
  label,
  icon,
  tone,
  progress,
  onPress,
  bottomInset,
  colors,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SlabTone;
  /** 0–1 of the rest elapsed — the fuse along the top edge. Omit outside rest. */
  progress?: number;
  onPress: () => void;
  /** The slab runs on under the bottom inset; the face stays above it. */
  bottomInset: number;
  colors: ThemeColors;
}) {
  const reduced = useReducedMotion();
  const fill =
    tone === "gold"
      ? GOLD_GRADIENT[1]
      : tone === "water"
        ? Gradients.water[1]
        : tone === "tonal"
          ? colors.surfaceMuted
          : colors.primary;
  const ink =
    tone === "gold"
      ? GOLD_INK
      : tone === "water"
        ? "#FFFFFF"
        : tone === "tonal"
          ? colors.text
          : colors.onPrimary;

  // The fuse glides between the 1Hz ticks, like the ring does.
  const fuse = useSharedValue(progress ?? 0);
  useEffect(() => {
    const to = progress ?? 0;
    // Backwards means a new rest has begun: jump there, don't rewind the fuse.
    if (reduced || to < fuse.value) {
      cancelAnimation(fuse);
      fuse.value = to;
      return;
    }
    fuse.value = withTiming(to, { duration: 1000, easing: Easing.linear });
  }, [progress, reduced, fuse]);
  const fuseStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fuse.value }] }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.slab, { backgroundColor: fill, paddingBottom: bottomInset }]}
    >
      {({ pressed }) => (
        <>
          {progress != null ? (
            <>
              <View style={[styles.slabEdge, styles.slabFuseTrack]} />
              <Reanimated.View style={[styles.slabEdge, styles.slabFuse, fuseStyle]} />
            </>
          ) : (
            <View style={[styles.slabEdge, styles.slabShine]} />
          )}
          {pressed ? <View style={[StyleSheet.absoluteFill, styles.slabPressed]} /> : null}
          <View style={[styles.slabFace, pressed && styles.slabFaceDown]}>
            <Ionicons name={icon} size={22} color={ink} />
            <AppText
              variant="headline"
              weight="800"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={[styles.slabLabel, { color: ink }]}
            >
              {label}
            </AppText>
          </View>
        </>
      )}
    </Pressable>
  );
}

/**
 * A dock slot. With `attention`, its disc glows brand colour for two seconds,
 * then sits dark for four — the "How to" is the only way to reach the deep
 * reference mid-set, so it has to say so, and then stop saying it.
 *
 * It is a TINT that comes and goes, not a fade toward invisible (which reads as
 * disabled), not a bloom outside the disc, and not a size change — the dock is
 * a row of fixed targets and nothing in it may move.
 */
function DockButton({
  icon,
  label,
  onPress,
  colors,
  disabled = false,
  attention = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  disabled?: boolean;
  attention?: boolean;
}) {
  const reduced = useReducedMotion();
  const beat = useSharedValue(0);
  const live = attention && !disabled && !reduced;

  useEffect(() => {
    if (!live) {
      cancelAnimation(beat);
      beat.value = withTiming(0, { duration: 240 });
      return;
    }
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: GLOW_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: GLOW_MS, easing: Easing.inOut(Easing.quad) }),
        // Hold dark. The pause is the point — a light that never rests stops
        // being a signal and becomes wallpaper.
        withDelay(GLOW_REST_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(beat);
  }, [live, beat]);

  // Premixed here, on the JS side: alpha() cannot be called inside a worklet.
  const idleFill = colors.surfaceMuted;
  const liveFill = alpha(colors.primary, 0.24);
  const idleEdge = colors.border;
  const liveEdge = alpha(colors.primary, 0.9);
  const discStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(beat.value, [0, 1], [idleFill, liveFill]),
    borderColor: interpolateColor(beat.value, [0, 1], [idleEdge, liveEdge]),
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label || icon}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.dockBtn, pressed && styles.pressed]}
    >
      <Reanimated.View style={[styles.dockIcon, discStyle, disabled && styles.dockDisabled]}>
        <Ionicons
          name={icon}
          size={18}
          color={disabled ? colors.textTertiary : colors.text}
        />
      </Reanimated.View>
      <AppText variant="caption" color="tertiary" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/* ───────────────────────────── Prescription ────────────────────────────── */

/**
 * What the session is going to ask of you, already filled in. Nobody is made to
 * dial in numbers before every workout — the plan brought them — but every row
 * opens if the day calls for something different.
 */
function PrescriptionView({
  label,
  exercises,
  lapWord,
  colors,
  onStart,
  onBack,
  onAdjust,
}: {
  label: string;
  exercises: SessionExerciseInfo[];
  lapWord: string;
  colors: ThemeColors;
  onStart: () => void;
  onBack: () => void;
  onAdjust: (index: number) => void;
}) {
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const minutes = Math.max(1, Math.round(estimateSessionSeconds(exercises) / 60));

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
          Your session
        </AppText>
        <AppText variant="display" style={styles.introTitle}>
          {label}
        </AppText>
        <View style={styles.introMeta}>
          <IntroChip icon="time-outline" text={`about ${minutes} min`} colors={colors} />
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
          <Ionicons name="options-outline" size={14} color={colors.primary} />
          <AppText variant="footnote" color="secondary">
            Tap any exercise to adjust it
          </AppText>
        </View>

        <View style={styles.introList}>
          {exercises.map((ex, i) => (
            <Pressable
              key={`${ex.exerciseId}-${i}`}
              onPress={() => onAdjust(i)}
              accessibilityRole="button"
              accessibilityLabel={`Adjust ${ex.name}`}
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
                <AppText variant="caption" color="tertiary">
                  {prescriptionText(ex)} · {resolveWorkSeconds(ex)}s work · {ex.restSeconds}s rest
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
        <Button label="End session" icon="checkmark-done" variant="tonal" onPress={onEnd} />
      </View>
    </View>
  );
}

/* ─────────────────────────────── Completion ────────────────────────────── */

const EFFORT_OPTIONS: {
  key: SessionEffort;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { key: "easy", icon: "leaf-outline", label: "Easy" },
  { key: "right", icon: "checkmark-circle-outline", label: "Just right" },
  // Not a flame: the flame is the app's celebration now (it is the hero of this
  // very screen), and a second one under it would read as "hard = good".
  { key: "hard", icon: "pulse-outline", label: "Hard" },
];

/**
 * THE FLAME CATCHES — and that is the whole celebration (owner, 2026-10-15:
 * the gold medallion and the confetti read as noisy and amateur). It sprouts
 * out of the floor, settles and flickers; the words arrive once it has landed.
 * Then ONE question, already answered. Tapping a different card is the only
 * reason to touch it; Continue takes the pre-filled answer.
 *
 * THE ANSWER SITS ON THE FLOOR (owner, 2026-10-15). The screen used to be one
 * centred stack, so on a tall phone Continue floated mid-screen over a band of
 * empty black. Now the celebration is centred in the room ABOVE the answer, and
 * the question, its three cards and Continue are pinned to the bottom edge, in
 * the thumb's reach.
 *
 * The answer block is laid out from the first frame and revealed IN PLACE after
 * the 1.5s beat. Mounting it late, as before, would shrink the hero's room the
 * moment it arrived and jolt the medallion upward mid-celebration.
 */
function CompletionView({
  state,
  colors,
  size,
  onFinish,
}: {
  state: SessionState;
  colors: ThemeColors;
  size: number;
  onFinish: (effort: SessionEffort) => void;
}) {
  const doneCount = state.results.filter((r) => !r.skipped).length;
  const totalReps = state.results.reduce((sum, r) => sum + r.totalReps, 0);
  // Width of the drawing; it stands 1.25× as tall. Half the hero room keeps it
  // the clear focus on a tall phone without crowding the TECNO's short stage.
  const flameSize = Math.round(Math.min(168, size * 0.52));
  const [effort, setEffort] = useState<SessionEffort>("right");
  const [asking, setAsking] = useState(false);
  const reveal = useSharedValue(0);

  // Let the celebration land before anything asks for an answer.
  useEffect(() => {
    const id = setTimeout(() => setAsking(true), 1500);
    return () => clearTimeout(id);
  }, []);

  // The entrance the block used to mount with (enterRise: a 25pt drop on the
  // slow decelerate), played where the block already stands.
  useEffect(() => {
    if (!asking) return;
    reveal.value = withTiming(1, { duration: Motion.duration.slow, easing: Ease.decelerate });
  }, [asking, reveal]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * -25 }],
  }));

  return (
    <View style={styles.complete}>
      <View style={styles.completeStage}>
        <View style={styles.completeHero}>
          <Flame size={flameSize} entrance="ignite" />
          {/* The words wait for the flame to land — one thing at a time. */}
          <Reanimated.View entering={enterRise(4)} style={styles.completeHero}>
            <Text style={[styles.completeHeadline, { color: colors.text }]}>Session complete</Text>
            <AppText variant="subhead" color="secondary" align="center">
              {doneCount} exercise{doneCount === 1 ? "" : "s"}
              {totalReps > 0 ? ` · ${totalReps} reps` : ""} · {formatTime(state.elapsedSeconds)}
            </AppText>
          </Reanimated.View>
        </View>
      </View>

      <Reanimated.View
        style={[styles.effortBlock, revealStyle]}
        // Invisible until asked: not tappable, and not read out either.
        pointerEvents={asking ? "auto" : "none"}
        accessibilityElementsHidden={!asking}
        importantForAccessibility={asking ? "auto" : "no-hide-descendants"}
      >
        <AppText variant="callout" align="center">
          How did that feel?
        </AppText>
        <View style={styles.effortRow}>
          {EFFORT_OPTIONS.map((opt) => {
            const active = opt.key === effort;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setEffort(opt.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={opt.label}
                style={({ pressed }) => [
                  styles.effortTile,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? alpha(colors.primary, 0.12)
                      : alpha(colors.primary, 0),
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={active ? colors.primary : colors.textTertiary}
                />
                <AppText variant="footnote" color={active ? "brand" : "tertiary"}>
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <Button label="Continue" icon="arrow-forward" size="lg" onPress={() => onFinish(effort)} />
      </Reanimated.View>
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
  exerciseProgress,
  colors,
  onClose,
  onEnd,
  onLeave,
}: {
  visible: boolean;
  elapsed: string;
  exerciseProgress: string;
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
            <AppText variant="caption" color="tertiary">
              {elapsed} in · exercise {exerciseProgress}
            </AppText>
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
                  {prescriptionText(ex)}
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
  // The End pill and the drill button are balanced so the title stays centred.
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: 66,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  topRight: { width: 66, alignItems: "flex-end" },
  clockRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },

  segments: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screen,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  segment: { flex: 1, height: 4, borderRadius: 2 },

  main: { flex: 1 },

  // Fixed zones. Three of them have a hard height and hold their content
  // absolutely, so a crossfading caption, clock or hint can never nudge the
  // figure or the dock by a single pixel.
  // No bottom padding: the dock's slab sits flush on the floor of the glass.
  stage: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
  },
  captionZone: {},
  readoutZone: {},
  hintZone: { justifyContent: "center" },
  zoneFill: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 3 },
  heroZone: { flex: 1, alignItems: "center", justifyContent: "center" },
  auxFigure: { position: "absolute", top: 0 },
  countScrim: { position: "absolute" },

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
  clockNumber: {
    fontWeight: "800",
    letterSpacing: -2,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  /** The headline of the rest screen — heavier than the clock beneath it. */
  restWord: { fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  restNumber: {
    // Deliberately lighter than `clockNumber` and than the word above it: on
    // this screen the seconds are the detail, not the instruction.
    fontWeight: "500",
    letterSpacing: -0.5,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

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
  repConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },

  dock: { gap: Spacing.md, paddingTop: Spacing.sm },
  dockRow: { flexDirection: "row", alignItems: "flex-start" },
  dockRowHidden: { opacity: 0 },
  dockBtn: { flex: 1, alignItems: "center", gap: 5 },
  dockIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dockDisabled: { opacity: 0.4 },

  // The primary slab: out through the stage's side padding to the glass.
  slab: { marginHorizontal: -Spacing.screen, overflow: "hidden" },
  slabFace: {
    height: SLAB_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  slabFaceDown: { transform: [{ translateY: 1.5 }] },
  slabLabel: { fontSize: 17, lineHeight: 22, letterSpacing: 1.4, textTransform: "uppercase" },
  slabEdge: { position: "absolute", left: 0, right: 0, top: 0, height: 3 },
  slabShine: { height: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  slabFuseTrack: { backgroundColor: "rgba(255,255,255,0.18)" },
  slabFuse: { backgroundColor: "rgba(255,255,255,0.8)", transformOrigin: "0% 50%" },
  slabPressed: { backgroundColor: "rgba(0,0,0,0.14)" },

  // Prescription
  intro: { flex: 1 },
  introTopBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  introScroll: { paddingHorizontal: Spacing.screen, paddingBottom: Spacing.xl },
  introTitle: { marginTop: Spacing.xs, marginBottom: Spacing.lg },
  introMeta: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.xl },
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
  complete: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  /** Everything above the answer. The hero centres in it, on any phone. */
  completeStage: { flex: 1, justifyContent: "center" },
  completeHero: { alignItems: "center" },
  completeHeadline: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  effortBlock: { gap: Spacing.md },
  effortRow: { flexDirection: "row", gap: Spacing.sm },
  effortTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
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
