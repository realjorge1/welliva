/**
 * The cycle screen's two reads from OUTSIDE the cycle log:
 *
 *   useCyclePatterns — lines her cycles up against her Mind check-ins (mood,
 *                      sleep) and her training log. This is the part a period
 *                      app can't do, because it doesn't hold those logs.
 *   useIronPicks     — iron-rich foods from her own food log, for the heavy days.
 *
 * Both re-read on focus: the cycle screen can stay in the stack while she logs
 * a mood or a meal elsewhere, and a mount-only read would go stale (the trap
 * every (tabs) screen in this app has hit).
 */
import { useCycle } from "@/contexts/CycleContext";
import { useProfile, useWorkout } from "@/contexts/AppContext";
import {
  addDays,
  allPatterns,
  ironFromLog,
  ironReference,
  type CyclePattern,
  type IronPick,
  type MindPoint,
} from "@/services/cycle";
import { loadCheckins } from "@/services/gozlin/GozlinMemoryStore";
import { readEntryValence } from "@/services/gozlin/mind";
import { getFoodLogRange } from "@/services/nutrition/foodLogStore";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

/** Mind entries collapse to one reading per day, as everywhere else that averages them. */
function toMindPoints(
  entries: { date: string; valence?: number; mood?: number; sleepHours?: number; kind?: string }[],
): MindPoint[] {
  const byDate = new Map<string, { v: number[]; sleep: number | null }>();
  for (const e of entries) {
    const row = byDate.get(e.date) ?? { v: [], sleep: null };
    const v = readEntryValence(e);
    if (v !== null) row.v.push(v);
    if ((e.kind ?? "daily") === "daily" && typeof e.sleepHours === "number") row.sleep = e.sleepHours;
    byDate.set(e.date, row);
  }
  return [...byDate.entries()].map(([date, r]) => ({
    date,
    valence: r.v.length ? r.v.reduce((s, x) => s + x, 0) / r.v.length : null,
    sleepHours: r.sleep,
  }));
}

export function useCyclePatterns(): CyclePattern[] {
  const { view, data } = useCycle();
  const { workoutLog } = useWorkout();
  const [mind, setMind] = useState<MindPoint[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadCheckins()
        .then((entries) => {
          if (alive) setMind(toMindPoints(entries));
        })
        .catch(() => {
          if (alive) setMind([]);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  return useMemo(
    () =>
      allPatterns({
        cycles: view.cycles,
        days: data.days,
        mind: mind ?? undefined,
        workouts: workoutLog.map((w) => ({ date: w.date })),
      }),
    [view.cycles, data.days, mind, workoutLog],
  );
}

/** How far back "foods you already eat" looks. */
const IRON_WINDOW_DAYS = 90;

export function useIronPicks(active: boolean): { picks: IronPick[]; fromLog: boolean } {
  const { today } = useCycle();
  const { userBio } = useProfile();
  const [fromLog, setFromLog] = useState<IronPick[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      let alive = true;
      const since = addDays(today, -IRON_WINDOW_DAYS);
      void getFoodLogRange(since, today)
        .then((entries) => {
          if (alive) setFromLog(ironFromLog(entries, since));
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [active, today]),
  );

  return useMemo(() => {
    if (fromLog.length >= 2) return { picks: fromLog, fromLog: true };
    return {
      picks: ironReference(userBio?.dietaryRestriction, userBio?.allergies ?? []),
      fromLog: false,
    };
  }, [fromLog, userBio?.dietaryRestriction, userBio?.allergies]);
}
