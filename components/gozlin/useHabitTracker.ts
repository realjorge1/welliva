/**
 * useHabitTracker — the habit tracker, as something the coach can talk about.
 *
 * One bridge from HabitsContext (live habits + retired ones) to the pure
 * GozlinTrackerHabits engine, so every surface reads the SAME facts: the chat,
 * the Home carousel and the per-screen moment cards can never disagree about
 * how long someone's streak is or when they stopped doing something.
 *
 * `useRetiredBeat` is the rare one. It answers "is there a habit this person
 * used to keep that is worth mentioning today?" and the honest answer is almost
 * always no — the engine holds a retired habit quiet for a fortnight, drops it
 * entirely after three months, ignores the ones that never really took, and
 * then only speaks on a sampled day. Screens can call it freely; it costs a
 * hash and it usually returns null.
 */
import { useSystem } from "@/contexts/AppContext";
import { useHabits } from "@/contexts/HabitsContext";
import {
  buildHabitTrackerBrief,
  pickRetiredBeat,
  type HabitTrackerBrief,
  type RetiredBeat,
} from "@/services/gozlin";
import { useMemo } from "react";

export function useHabitTrackerBrief(): HabitTrackerBrief {
  const { views, retired } = useHabits();
  const { currentDate } = useSystem();

  return useMemo(
    () => buildHabitTrackerBrief({ views, retired, today: currentDate }),
    [views, retired, currentDate],
  );
}

/** Today's retired-habit beat, or null — which is the usual answer. */
export function useRetiredBeat(): RetiredBeat | null {
  const brief = useHabitTrackerBrief();
  const { currentDate } = useSystem();

  return useMemo(
    () => pickRetiredBeat(brief, currentDate),
    [brief, currentDate],
  );
}
