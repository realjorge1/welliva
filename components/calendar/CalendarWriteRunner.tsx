/**
 * CalendarWriteRunner — keeps welliva's calendar on this phone in step (services/calendar).
 *
 * Renders nothing. Re-writes the workouts when the stored week, the training hour
 * or the switch changes, and both scopes whenever the app comes back to the
 * foreground (a day may have turned, a plan may have been rebuilt). The cycle
 * also re-writes itself from CycleContext the moment its prediction moves.
 * Each sync is a no-op while its switch is off — after clearing what it wrote.
 */
import { useAuth } from "@/components/SupabaseAuthProvider";
import { useWorkout } from "@/contexts/AppContext";
import { useFitnessProfile } from "@/fitness/hooks/useFitnessProfile";
import {
  onCalendarPrefsChange,
  syncCycleCalendar,
  syncWorkoutCalendar,
} from "@/services/calendar/sync";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

/** A burst of plan edits settles before the calendar is touched. */
const SETTLE_MS = 1500;

export function CalendarWriteRunner(): null {
  const { user } = useAuth();
  const signedIn = !!user;
  const { workoutPlan } = useWorkout();
  const { profile, ready } = useFitnessProfile();
  const planRef = useRef(workoutPlan);
  planRef.current = workoutPlan;

  // Bumped by a switch flip or a return to the foreground.
  const [nudge, setNudge] = useState(0);
  useEffect(() => onCalendarPrefsChange(() => setNudge((n) => n + 1)), []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNudge((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // Only what the calendar shows: a re-render with the same week writes nothing.
  const planKey = useMemo(() => {
    if (!workoutPlan) return "none";
    const days = workoutPlan.sessions
      .map((s) => `${s.dayOfWeek}:${s.isRestDay ? 0 : 1}:${s.focus}:${s.totalDurationMinutes}`)
      .join(",");
    return `${workoutPlan.weekStart}|${days}`;
  }, [workoutPlan]);
  const hour = profile.reminders?.hour ?? 17;

  useEffect(() => {
    if (!signedIn || !ready) return;
    const t = setTimeout(() => void syncWorkoutCalendar(planRef.current), SETTLE_MS);
    return () => clearTimeout(t);
  }, [signedIn, ready, planKey, hour, nudge]);

  useEffect(() => {
    if (!signedIn || nudge === 0) return;
    const t = setTimeout(() => void syncCycleCalendar(), SETTLE_MS + 500);
    return () => clearTimeout(t);
  }, [signedIn, nudge]);

  return null;
}
