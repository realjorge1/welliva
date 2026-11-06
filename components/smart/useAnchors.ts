/**
 * Tying a habit to something they already do — the screen half
 * (services/smart/anchor is the rule).
 *
 *   · useAnchorChoices    the steady things a habit could hang on, steadiest first
 *   · useAnchorChain      the "Next: vitamins?" chip, once the anchor is logged
 */
import { useNutrition, useWorkout } from "@/contexts/AppContext";
import { useHabits, type HabitView } from "@/contexts/HabitsContext";
import { isDueToday } from "@/services/HabitService";
import { todayDate } from "@/services/OfflineStorage";
import {
  ANCHOR_CHAIN_PRIORITY,
  anchorLoggedAt,
  answerSmart,
  chainDue,
  findAnchors,
  type AnchorFound,
  type SmartCandidate,
  type SmartSurface,
} from "@/services/smart";
import { useCallback, useEffect, useMemo } from "react";
import { useRoutineSources } from "./useReminderMoves";
import { useSmartMoment } from "./useSmartMoment";

/** Every steady anchor for a habit, steadiest first. Empty until it can say. */
export function useAnchorChoices(excludeHabitId?: string): AnchorFound[] {
  const { views } = useHabits();
  const { sources, ready } = useRoutineSources();
  return useMemo(
    () =>
      ready
        ? findAnchors(
            sources,
            views.map((v) => v.habit),
            todayDate(),
            excludeHabitId,
          )
        : [],
    [ready, sources, views, excludeHabitId],
  );
}

interface ChainMoment extends SmartCandidate {
  view: HabitView;
}

export function useAnchorChain(surface: Extract<SmartSurface, "home" | "diet">) {
  const { views, toggleToday, paused } = useHabits();
  const { consumedNutrition } = useNutrition();
  const { workoutLog } = useWorkout();
  const { sources, ready, reload } = useRoutineSources();

  // The anchor being logged is the whole trigger, and it happens on this very
  // screen, so re-read the records whenever one of the things it could be moves.
  const today = todayDate();
  const doneToday = views.filter((v) => v.done.has(today)).length;
  useEffect(() => {
    reload();
  }, [reload, consumedNutrition.calories, consumedNutrition.waterMl, workoutLog.length, doneToday]);

  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  const candidates = useMemo<ChainMoment[]>(() => {
    if (!ready) return [];
    const out: ChainMoment[] = [];
    for (const view of views) {
      const anchor = view.habit.anchor;
      if (!anchor) continue;
      const due = isDueToday(view.habit, view.done, today, paused);
      const loggedAtMinute = anchorLoggedAt(anchor, sources, today);
      if (chainDue({ habit: view.habit, done: view.done, due, loggedAtMinute, nowMinute, today })) {
        out.push({
          id: `anchor-chain:${view.habit.id}:${today}`,
          feature: "anchor",
          priority: ANCHOR_CHAIN_PRIORITY,
          // The direct answer to what they just did, not an unprompted voice.
          exempt: true,
          view,
        });
      }
    }
    return out;
  }, [ready, views, sources, today, paused, nowMinute]);

  const moment = useSmartMoment(surface, candidates);

  const done = useCallback(
    async (m: ChainMoment) => {
      await toggleToday(m.view.habit.id);
      void answerSmart({ id: m.id, feature: "anchor", answer: "accepted" });
    },
    [toggleToday],
  );
  const dismiss = useCallback((m: ChainMoment) => {
    void answerSmart({ id: m.id, feature: "anchor", answer: "dismissed", coolDownDays: 1 });
  }, []);

  return { moment, done, dismiss };
}
