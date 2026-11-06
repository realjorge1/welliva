/**
 * The cycle screen's reads from OUTSIDE the cycle log:
 *
 *   useCyclePatterns — lines her cycles up against her Mind check-ins (mood,
 *                      sleep) and her training log. This is the part a period
 *                      app can't do, because it doesn't hold those logs.
 *   useIronPicks     — iron-rich foods from her own food log, for the heavy days.
 *   useLateContext   — while a period is late: what was different this cycle,
 *                      from her sleep, training, eating, weight, mood, trips and
 *                      the days she marked as ill (services/cycle/late).
 *
 * All re-read on focus: the cycle screen can stay in the stack while she logs
 * a mood or a meal elsewhere, and a mount-only read would go stale (the trap
 * every (tabs) screen in this app has hit).
 */
import { useCycle, useCycleOptional } from "@/contexts/CycleContext";
import { useNutrition, useProfile, useWorkout } from "@/contexts/AppContext";
import { lifeContext, type LifeEvent } from "@/health-os";
import {
  addDays,
  allPatterns,
  ironFromLog,
  ironReference,
  lateContext,
  type CyclePattern,
  type IronPick,
  type LateContext,
  type LifeSpan,
  type MindPoint,
} from "@/services/cycle";
import { loadCheckins } from "@/services/gozlin/GozlinMemoryStore";
import { readEntryValence } from "@/services/gozlin/mind";
import { getFoodLogRange } from "@/services/nutrition/foodLogStore";
import { hasRecordedIntake } from "@/services/nutrition/recordedIntake";
import { loadRoughDays, type RoughDay } from "@/services/smart/roughDay";
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

  const logOnly = view.mode === "hormonal";
  return useMemo(
    () =>
      // On hormonal contraception the bleeds follow the method: there is no
      // cycle to line anything up against (services/cycle/view does the same).
      logOnly
        ? []
        : allPatterns({
            cycles: view.cycles,
            days: data.days,
            mind: mind ?? undefined,
            workouts: workoutLog.map((w) => ({ date: w.date })),
            weight: view.weightPattern,
          }),
    [logOnly, view.cycles, view.weightPattern, data.days, mind, workoutLog],
  );
}

/**
 * Trips and illness, in the shape services/cycle/late reads: Life Context
 * entries she (or her calendar, with that consent) added, and the rough days
 * she marked "Ill" or "Travelling". A dismissed entry never happened.
 */
function toLifeSpans(events: readonly LifeEvent[], rough: readonly RoughDay[]): LifeSpan[] {
  const out: LifeSpan[] = [];
  for (const e of events) {
    if (e.status === "dismissed") continue;
    const kind =
      e.kind === "travel" || e.kind === "vacation" ? "travel" : e.kind === "illness_recovery" ? "ill" : null;
    if (kind) out.push({ kind, start: e.window.start, end: e.window.end ?? e.window.start, title: e.title });
  }
  for (const r of rough) {
    if (r.deleted) continue;
    if (r.reason === "ill") out.push({ kind: "ill", start: r.date, end: r.date });
    else if (r.reason === "travelling") out.push({ kind: "travel", start: r.date, end: r.date });
  }
  return out;
}

/**
 * "Why am I late?", from this cycle. Null unless a period is late, and it reads
 * nothing until it is — the late section is the only place that needs these logs.
 */
export function useLateContext(): LateContext | null {
  // Optional: the coach's screen calls this too, and must never throw over it.
  const cycle = useCycleOptional();
  const view = cycle?.view;
  const today = cycle?.today;
  const { workoutLog } = useWorkout();
  const { dietHistory } = useNutrition();
  const { bodyLogs } = useProfile();
  const late = (view?.status.lateBy ?? 0) > 0;
  const [mind, setMind] = useState<MindPoint[]>([]);
  const [events, setEvents] = useState<LifeSpan[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!late) return;
      let alive = true;
      void Promise.all([
        loadCheckins().catch(() => []),
        lifeContext.list({ includeResolved: true }).catch(() => [] as LifeEvent[]),
        loadRoughDays().catch(() => [] as RoughDay[]),
      ]).then(([checkins, life, rough]) => {
        if (!alive) return;
        setMind(toMindPoints(checkins));
        setEvents(toLifeSpans(life, rough));
      });
      return () => {
        alive = false;
      };
    }, [late]),
  );

  return useMemo(
    () =>
      late && view && today
        ? lateContext({
            mode: view.mode,
            status: view.status,
            cycles: view.cycles,
            today,
            signals: {
              mind,
              workouts: workoutLog.map((w) => ({ date: w.date, minutes: w.durationMinutes ?? null })),
              // Recorded days only: a closed day with nothing logged is unknown, not 0 kcal.
              intake: dietHistory
                .filter(hasRecordedIntake)
                .map((e) => ({ date: e.date, kcal: e.consumedCalories ?? 0 })),
              weighIns: bodyLogs.map((b) => ({ date: b.date, kg: b.weightKg })),
              events,
            },
          })
        : null,
    [late, view, today, mind, workoutLog, dietHistory, bodyLogs, events],
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
