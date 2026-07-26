/**
 * useHabitReport — the Habit Awareness report, ready for any surface.
 *
 * Wraps the shared Twin bridge + AppContext history and folds in the on-device
 * check-ins, then builds the deterministic GozlinHabitReport (behavior scores,
 * learned patterns, predicted risks, rescues). Everything is evidence-backed and
 * offline — no LLM, no fabrication. Home uses it for the "habits" coach card and
 * the coach deep-dive; both read the exact same read-model, so there's no drift.
 */
import { useApp } from "@/contexts/AppContext";
import {
  buildHabitReport,
  loadCheckins,
  type GozlinCheckin,
  type GozlinHabitReport,
} from "@/services/gozlin";
import { useEffect, useMemo, useState } from "react";
import { useGozlinSnapshot } from "./useGozlinSnapshot";

export function useHabitReport(): GozlinHabitReport {
  const app = useApp();
  const { twin } = useGozlinSnapshot();
  const [checkins, setCheckins] = useState<GozlinCheckin[]>([]);

  useEffect(() => {
    let alive = true;
    void loadCheckins().then((c) => {
      if (alive) setCheckins(c);
    });
    return () => {
      alive = false;
    };
  }, [app.currentDate]);

  return useMemo(
    () =>
      buildHabitReport({
        twin,
        dietHistory: app.dietHistory,
        workoutLog: app.workoutLog,
        workoutPlan: app.workoutPlan,
        checkins,
        weeklyWorkoutTarget: app.userGoals?.weeklyWorkoutsTarget ?? 3,
      }),
    [
      twin,
      app.dietHistory,
      app.workoutLog,
      app.workoutPlan,
      app.userGoals?.weeklyWorkoutsTarget,
      checkins,
    ],
  );
}
