/**
 * useGozlinSnapshot — the shared AppContext → Twin bridge.
 *
 * One place that normalizes Welliva's live state into a GozlinSnapshotInput and
 * the Twin read-model. Both the full coach (useGozlin) and the lightweight
 * surface presence (useGozlinMoments) consume this, so there's a single source
 * of truth for "what does Gozlin currently know" — no drift between the chat and
 * the cards scattered across the app.
 *
 * It does NO storage / conversation loading (that's useGozlin's job); it's cheap
 * enough to call from any screen that wants a coach beat.
 */

import { useApp } from "@/contexts/AppContext";
import { wearableSource, type WearableSnapshot } from "@/health-os";
import type { WorkoutSession } from "@/models/workout";
import { buildTwin, type GozlinSnapshotInput, type GozlinTwin } from "@/services/gozlin";
import { useEffect, useMemo, useState } from "react";

export interface GozlinSnapshot {
  snapshot: GozlinSnapshotInput;
  twin: GozlinTwin;
}

export function useGozlinSnapshot(): GozlinSnapshot {
  const app = useApp();

  // Today's planned session — recomputed exactly as AppContext does internally
  // (it doesn't expose dayOfWeek), 0 = Mon … 6 = Sun.
  const todaySession = useMemo<WorkoutSession | null>(() => {
    if (!app.workoutPlan) return null;
    const d = new Date().getDay();
    const idx = d === 0 ? 6 : d - 1;
    return app.workoutPlan.sessions.find((s) => s.dayOfWeek === idx) ?? null;
  }, [app.workoutPlan]);

  const workoutDoneToday = useMemo(
    () => app.workoutLog.some((l) => l.date === app.currentDate),
    [app.workoutLog, app.currentDate],
  );

  // Real wearable metrics (cached, consent-gated upstream) make Recovery true, not a
  // proxy. Loaded async — the first render uses the proxy, then folds wearable in.
  const [wearable, setWearable] = useState<WearableSnapshot | null>(null);
  useEffect(() => {
    void wearableSource.lastKnown().then(setWearable);
  }, [app.currentDate]);

  const snapshot = useMemo<GozlinSnapshotInput>(
    () => ({
      bio: app.userBio,
      targets: app.nutritionTargets,
      consumed: app.consumedNutrition,
      waterGoalMl:
        app.userGoals?.dailyWaterMl ?? app.nutritionTargets?.waterMl ?? 2500,
      todayDiet: app.todayDiet,
      workoutSession: todaySession,
      workoutDoneToday,
      workoutPlan: app.workoutPlan,
      workoutLog: app.workoutLog,
      sessionHistory: app.sessionHistory,
      dietHistory: app.dietHistory,
      bodyLogs: app.bodyLogs,
      streak: app.streakData,
      goals: app.userGoals,
      wearable,
    }),
    [
      app.userBio,
      app.nutritionTargets,
      app.consumedNutrition,
      app.userGoals,
      app.todayDiet,
      todaySession,
      workoutDoneToday,
      app.workoutPlan,
      app.workoutLog,
      app.sessionHistory,
      app.dietHistory,
      app.bodyLogs,
      app.streakData,
      wearable,
    ],
  );

  const twin = useMemo(() => buildTwin(snapshot), [snapshot]);

  return { snapshot, twin };
}
