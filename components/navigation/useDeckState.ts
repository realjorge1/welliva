/**
 * EVERYTHING THE DECK KNOWS, gathered once.
 *
 * It reads five context slices, and that is deliberate rather than sloppy: the
 * Deck's whole claim is that it knows the state of the day, and the day is
 * spread across diet, training, profile, the fitness module and the clock. The
 * slices are the same ones the host screens already subscribe to, so on Home,
 * Diet and Fitness this costs no additional re-render — see the AppContext
 * split.
 *
 * THE SPLIT IT MAKES. Out of one ladder come four different things, and the
 * distinction is the Deck's entire design:
 *
 *   · `live`    — already in flight. Gets the dock's top slot as a controller,
 *                 cannot be dismissed, and outranks everything the day merely
 *                 wants.
 *   · `cue`     — the one time-bound prompt this screen can act on. Small,
 *                 occasional, dismissible.
 *   · `agenda`  — every open prompt, for when the cue is pulled up. NOT
 *                 filtered by route, because a list that hides the row you are
 *                 standing on would report a count it cannot back.
 *   · `progress`— today's scheduled commitments, done against total. The Home
 *                 tab's ring and the agenda's header are the same two numbers.
 */

import { useOpenThread } from "@/components/gozlin";
import { useNutrition, useProfile, useSystem, useWorkout } from "@/contexts/AppContext";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import type { SessionState } from "@/models/session";
import type { WorkoutSession } from "@/models/workout";
import { SessionService } from "@/services/SessionService";
import { useEffect, useMemo, useState } from "react";
import { useDismissals, type Dismissals } from "./dismissals";
import {
  finishedDayMove,
  resolveAgenda,
  resolveDayProgress,
  type DayProgress,
  type MealSlot,
  type NextMove,
  type NextMoveInput,
} from "./nextMove";

const sessionService = SessionService.getInstance();

export interface DeckState {
  /** Already running. The dock's top tenant, and never dismissible. */
  live: NextMove | null;
  /** The one prompt this screen can act on, or null when the day is clear. */
  cue: NextMove | null;
  /** Every open prompt, route-unfiltered, dismissals applied. */
  agenda: NextMove[];
  /** How many of `agenda` are not the cue — the card's "N more". */
  more: number;
  /** The sentence a day with nothing open still owes. */
  finished: NextMove;
  /** Today's scheduled commitments, done against total. */
  progress: DayProgress;
  /** How many prompts are currently under a "not now" lease. */
  dismissedCount: number;
  dismissals: Dismissals;
  /** Today's planned session, for the quick-log row and the player launch. */
  todaySession: WorkoutSession | null;
  addWater: (ml: number) => void;
  waterMl: number;
  waterGoalMl: number;
}

export function useDeckState(
  currentHref: string | null,
  checkedInToday: boolean,
): DeckState {
  const { todayDiet, consumedNutrition, addWater } = useNutrition();
  const { userGoals, nutritionTargets, bodyLogs } = useProfile();
  const { workoutPlan, workoutLog } = useWorkout();
  const { currentDate } = useSystem();
  const { profile, ready: profileReady } = useFitnessProfile();

  /**
   * Re-derived on the minute rather than on render alone. Without this the
   * Deck would keep saying "Log breakfast" at two in the afternoon on a screen
   * left open — the one failure that would prove it does NOT know what time it
   * is. It is also what expires a dismissal lease within the minute it lapses.
   */
  const [minutesOfDay, setMinutesOfDay] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setMinutesOfDay(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const dismissals = useDismissals(currentDate, minutesOfDay);

  /**
   * A coach conversation left mid-exchange. Re-read on the same minute tick the
   * clock above runs on, and on every navigation — walking off the coach screen
   * is precisely when a thread becomes one you left.
   */
  const openConversation = useOpenThread(minutesOfDay);

  // A guided session abandoned mid-flight. Same liveness test the Fitness
  // screen's resume card uses — a stale or finished session is not resumable.
  const [savedSession, setSavedSession] = useState<SessionState | null>(null);
  useEffect(() => {
    let mounted = true;
    void sessionService.loadSession().then((s) => {
      if (!mounted) return;
      const isLive =
        !!s &&
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

  const todayDayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const todaySession: WorkoutSession | null = useMemo(
    () => workoutPlan?.sessions.find((s) => s.dayOfWeek === todayDayIndex) ?? null,
    [workoutPlan, todayDayIndex],
  );

  // Only ever used for the finished-day preview, so a rest day correctly yields
  // null and the caption falls back to "See your record".
  const tomorrowFocus = useMemo(() => {
    const next = (todayDayIndex + 1) % 7;
    const s = workoutPlan?.sessions.find((x) => x.dayOfWeek === next);
    return s && !s.isRestDay ? s.focus : null;
  }, [workoutPlan, todayDayIndex]);

  /**
   * The three timed slots, in slot order. Snacks are excluded on purpose — they
   * have no hour, so they can never be "due" and would only add noise, to the
   * cue and to the progress ring alike.
   */
  const meals = useMemo<MealSlot[]>(() => {
    const s = todayDiet?.schedule;
    if (!s) return [];
    const slots: [MealSlot["type"], typeof s.breakfast][] = [
      ["breakfast", s.breakfast],
      ["lunch", s.lunch],
      ["dinner", s.dinner],
    ];
    return slots
      .filter((entry): entry is [MealSlot["type"], NonNullable<(typeof entry)[1]>] =>
        entry[1] != null,
      )
      .map(([type, m]) => ({ type, name: m.name, consumed: m.isConsumed }));
  }, [todayDiet]);

  const waterGoalMl = userGoals?.dailyWaterMl ?? nutritionTargets?.waterMl ?? 2500;

  /**
   * Whole days since the most recent body log, or null if there has never been
   * one. Computed off the date strings rather than timestamps so it counts
   * calendar days the way the user does.
   */
  const daysSinceWeighIn = useMemo(() => {
    const latest = [...(bodyLogs ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (!latest?.date) return null;
    const ms = Date.parse(`${currentDate}T00:00:00`) - Date.parse(`${latest.date}T00:00:00`);
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.round(ms / 86_400_000));
  }, [bodyLogs, currentDate]);

  // Only meaningful with a plan: the generator emits training days ONLY, so a
  // missing session on a real plan means rest, not a hole in the schedule.
  const isRestDay = !!workoutPlan && (!todaySession || !!todaySession.isRestDay);

  const input = useMemo<NextMoveInput>(
    () => ({
      minutesOfDay,
      savedSession: savedSession
        ? {
            label: savedSession.sessionLabel,
            index: savedSession.currentExerciseIndex,
            total: savedSession.exercises.length,
          }
        : null,
      meals,
      hasScheduledDiet: !!todayDiet?.hasScheduledDiet,
      todaySession:
        todaySession && !todaySession.isRestDay
          ? { focus: todaySession.focus, minutes: todaySession.totalDurationMinutes }
          : null,
      hasPlan: !!workoutPlan,
      workoutDoneToday: workoutLog.some((l) => l.date === currentDate),
      isRestDay,
      // Until the stored profile has been read, assume setup is done: a dock
      // that flashes "Personalize training" for one frame on every cold start
      // and then swaps is worse than one that arrives a beat late.
      setupComplete: profileReady ? profile.setupComplete : true,
      checkedInToday,
      daysSinceWeighIn,
      openConversation,
      waterMl: consumedNutrition.waterMl,
      waterGoalMl,
      tomorrowFocus,
      currentHref,
    }),
    [
      currentHref,
      minutesOfDay,
      savedSession,
      meals,
      todayDiet?.hasScheduledDiet,
      todaySession,
      workoutPlan,
      workoutLog,
      currentDate,
      isRestDay,
      profileReady,
      profile.setupComplete,
      checkedInToday,
      daysSinceWeighIn,
      openConversation,
      consumedNutrition.waterMl,
      waterGoalMl,
      tomorrowFocus,
    ],
  );

  const { live, cue, agenda, more, dismissedCount } = useMemo(() => {
    const open = resolveAgenda(input);
    const liveMove = open.find((m) => m.live) ?? null;

    // Prompts are everything the day wants that has not been waved away. The
    // live tenant is excluded because it is not a prompt — it is a thing
    // already happening, and listing it as an open item to be picked would
    // double-count the one move the dock is already showing as a controller.
    const prompts = open.filter((m) => !m.live && !dismissals.isDismissed(m.id));

    // The cue alone is route-filtered: offering "go to Diet" while standing on
    // Diet is a button that does nothing, which is the one thing the old bar
    // was already careful about and the one thing the list must NOT be.
    const here = input.currentHref ?? null;
    const top =
      prompts.find(
        (m) => m.suppressOn === undefined || here === null || m.suppressOn !== here,
      ) ?? null;

    return {
      live: liveMove,
      cue: top,
      agenda: prompts,
      more: Math.max(0, prompts.length - (top ? 1 : 0)),
      dismissedCount: open.filter((m) => !m.live && dismissals.isDismissed(m.id)).length,
    };
  }, [input, dismissals]);

  return {
    live,
    cue,
    agenda,
    more,
    finished: useMemo(() => finishedDayMove(input), [input]),
    progress: useMemo(() => resolveDayProgress(input), [input]),
    dismissedCount,
    dismissals,
    todaySession,
    addWater,
    waterMl: consumedNutrition.waterMl,
    waterGoalMl,
  };
}
