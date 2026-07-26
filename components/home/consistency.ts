/**
 * consistency — turns the user's real logs into the heatmap matrix.
 *
 * Every day's intensity is a blend of that day's nutrition adherence
 * (meals consumed / planned) and whether a workout was completed. Today isn't in
 * history yet, so its live signals are folded in separately. Pure & deterministic
 * over the arrays it's given — no fabrication, no storage.
 */
import type { DietHistoryEntry } from "@/models/diet";
import type { WorkoutLogEntry } from "@/models/workout";
import { parseLocalDate, toLocalDateString } from "@/services/OfflineStorage";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface ConsistencyInput {
  dietHistory: DietHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  /** Today (YYYY-MM-DD, local). */
  today: string;
  /** Number of week-columns to render. */
  weeks: number;
  /** Live signals for today (not yet in history). */
  liveToday?: { dietAdh: number; workoutDone: boolean };
}

export interface Consistency {
  /** matrix[col][row] — col = week (oldest→current), row = weekday (0=Mon…6=Sun).
   *  Intensity 0–1, or -1 for future days that shouldn't render. */
  matrix: number[][];
  /** Days with any activity within the rendered window. */
  activeDays: number;
  /** Real (non-future) days in the window. */
  totalDays: number;
}

/** Monday-of-week for a date string (weeks are Monday-based, per Welliva). */
function mondayOf(dateStr: string): Date {
  const d = parseLocalDate(dateStr);
  const offset = (d.getDay() + 6) % 7; // 0 for Monday
  d.setDate(d.getDate() - offset);
  return d;
}

export function buildConsistency(input: ConsistencyInput): Consistency {
  const { dietHistory, workoutLog, today, weeks, liveToday } = input;

  // date → intensity, from history + logs.
  const intensity = new Map<string, number>();
  const adh = new Map<string, number>();
  for (const h of dietHistory) {
    if (h.totalMeals > 0) adh.set(h.date, clamp01(h.mealsConsumed / h.totalMeals));
  }
  const workout = new Map<string, number>();
  for (const l of workoutLog) {
    const v = clamp01((l.completionPercent ?? 100) / 100);
    workout.set(l.date, Math.max(workout.get(l.date) ?? 0, v));
  }
  const dates = new Set<string>([...adh.keys(), ...workout.keys()]);
  for (const d of dates) {
    intensity.set(d, clamp01(0.6 * (adh.get(d) ?? 0) + 0.4 * (workout.get(d) ?? 0)));
  }
  if (liveToday) {
    intensity.set(
      today,
      clamp01(0.6 * clamp01(liveToday.dietAdh) + 0.4 * (liveToday.workoutDone ? 1 : 0)),
    );
  }

  // Build columns: the last column is the current (Monday-based) week.
  const currentMonday = mondayOf(today);
  const matrix: number[][] = [];
  let activeDays = 0;
  let totalDays = 0;

  for (let c = 0; c < weeks; c++) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - (weeks - 1 - c) * 7);
    const column: number[] = [];
    for (let r = 0; r < 7; r++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + r);
      const key = toLocalDateString(day);
      if (key > today) {
        column.push(-1); // future — leave blank
        continue;
      }
      totalDays++;
      const v = intensity.get(key) ?? 0;
      if (v > 0) activeDays++;
      column.push(v);
    }
    matrix.push(column);
  }

  return { matrix, activeDays, totalDays };
}
