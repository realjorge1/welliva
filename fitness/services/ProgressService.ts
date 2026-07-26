/**
 * PROGRESS SERVICE — pure derivations over the app's workout history.
 *
 * Consumes the SSOT collections from AppContext (workoutLog, sessionHistory)
 * and produces the numbers behind the Progress screen and dashboard tiles.
 * No storage, no side effects — fully unit-testable.
 */

import type { SessionSummaryData } from "@/models/session";
import type { WorkoutLogEntry } from "@/models/workout";
import type { PersonalBests, ProgressSnapshot, WeekActivity } from "../types";

/* ─────────────────────────── date helpers ─────────────────────────── */

function parseYmd(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: string): string {
  const d = parseYmd(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Mon
  d.setDate(d.getDate() - dow);
  return toYmd(d);
}

function addDays(date: string, delta: number): string {
  const d = parseYmd(date);
  d.setDate(d.getDate() + delta);
  return toYmd(d);
}

/* ─────────────────────────── core metrics ─────────────────────────── */

/** Consecutive days trained, ending today or yesterday (grace day). */
export function workoutStreakDays(log: WorkoutLogEntry[], today: string): number {
  const trained = new Set(log.map((l) => l.date));
  let cursor = trained.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (trained.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive trained days anywhere in the log. */
export function longestStreakDays(log: WorkoutLogEntry[]): number {
  const days = [...new Set(log.map((l) => l.date))].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/** Last `weeks` weeks of activity (oldest first), including empty weeks. */
export function weeklyHistory(
  log: WorkoutLogEntry[],
  today: string,
  weeks: number = 8,
): WeekActivity[] {
  const thisWeek = weekStartOf(today);
  const out: WeekActivity[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const entries = log.filter((l) => l.date >= start && l.date < end);
    out.push({
      weekStart: start,
      workouts: entries.length,
      minutes: entries.reduce((s, l) => s + (l.durationMinutes || 0), 0),
    });
  }
  return out;
}

export function personalBests(
  log: WorkoutLogEntry[],
  sessionHistory: SessionSummaryData[],
  today: string,
): PersonalBests {
  let longestSessionMin = 0;
  for (const l of log) longestSessionMin = Math.max(longestSessionMin, l.durationMinutes || 0);

  let mostRepsInSession = 0;
  for (const s of sessionHistory) mostRepsInSession = Math.max(mostRepsInSession, s.totalReps || 0);

  const byWeek = new Map<string, number>();
  for (const l of log) {
    const wk = weekStartOf(l.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
  }
  let bestWeekWorkouts = 0;
  for (const count of byWeek.values()) bestWeekWorkouts = Math.max(bestWeekWorkouts, count);

  return {
    longestSessionMin,
    mostRepsInSession,
    bestWeekWorkouts,
    longestStreakDays: longestStreakDays(log),
  };
}

/** The full snapshot the Progress screen renders. */
export function buildProgressSnapshot(input: {
  workoutLog: WorkoutLogEntry[];
  sessionHistory: SessionSummaryData[];
  today: string; // YYYY-MM-DD
  /** Days per week the user plans to train (fitness profile). */
  weeklyTargetDays: number;
}): ProgressSnapshot {
  const { workoutLog, sessionHistory, today } = input;

  const thisWeekStart = weekStartOf(today);
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  const thisWeek = workoutLog.filter((l) => l.date >= thisWeekStart && l.date <= today);
  const thisMonth = workoutLog.filter((l) => l.date.startsWith(monthPrefix));

  const totalMinutes = workoutLog.reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const totalCalories = sessionHistory.reduce((s, h) => s + (h.caloriesBurned || 0), 0);

  const target = Math.max(1, input.weeklyTargetDays);

  return {
    totalWorkouts: workoutLog.length,
    totalMinutes,
    totalCalories,
    thisWeekWorkouts: thisWeek.length,
    thisWeekMinutes: thisWeek.reduce((s, l) => s + (l.durationMinutes || 0), 0),
    thisMonthMinutes: thisMonth.reduce((s, l) => s + (l.durationMinutes || 0), 0),
    currentStreakDays: workoutStreakDays(workoutLog, today),
    weeklyHistory: weeklyHistory(workoutLog, today),
    personalBests: personalBests(workoutLog, sessionHistory, today),
    weeklyGoalProgress: Math.min(1, thisWeek.length / target),
  };
}
