/**
 * FITNESS LINE — the number and the curve behind Home's Fitness tile.
 *
 * WHAT IT COUNTS: active minutes in a ROLLING seven days, read straight off the
 * workout log. Each point of the curve is "the seven days ending that day", so
 * the figure at its right-hand end is exactly the number printed beside it.
 *
 * WHY ROLLING AND NOT "THIS WEEK". A calendar week is only partly over for most
 * of its length, so "this week vs last week" reads as a collapse every Monday
 * and a recovery by Sunday. Seven days against the seven days before them
 * compares like with like on every day of the week — the same rule the app
 * keeps everywhere else: a period you are still in is never set against one
 * that is finished.
 *
 * Pure: the log in, numbers out. No storage, no React.
 */

import type { WorkoutLogEntry } from "@/models/workout";
import { shiftDay } from "@/services/commitment";

/** The window every point sums. */
export const FITNESS_WINDOW_DAYS = 7;
/** How many days of that rolling figure the curve shows. */
export const FITNESS_HISTORY_DAYS = 28;

export interface FitnessLine {
  /** Active minutes in the seven days ending today. */
  minutes: number;
  /** The same figure for the seven days before those. */
  previous: number;
  /**
   * Change against `previous`, as a whole percent. Null when there is nothing
   * to compare against — a percentage of zero is not a number.
   */
  deltaPct: number | null;
  /** The rolling figure for each of the last `days` days, oldest → today. */
  series: number[];
}

export function buildFitnessLine(
  log: readonly WorkoutLogEntry[],
  today: string,
  days: number = FITNESS_HISTORY_DAYS,
): FitnessLine {
  const win = FITNESS_WINDOW_DAYS;
  const span = days + win - 1;

  const byDate = new Map<string, number>();
  for (const l of log) {
    byDate.set(l.date, (byDate.get(l.date) ?? 0) + (l.durationMinutes || 0));
  }

  // Minutes on each of the `span` days ending today, oldest first.
  const daily: number[] = [];
  for (let i = 0; i < span; i++) {
    daily.push(byDate.get(shiftDay(today, -(span - 1 - i))) ?? 0);
  }

  const series: number[] = [];
  for (let i = 0; i < days; i++) {
    let sum = 0;
    for (let k = 0; k < win; k++) sum += daily[i + k];
    series.push(sum);
  }

  const minutes = series[days - 1] ?? 0;
  const previous = days > win ? (series[days - 1 - win] ?? 0) : 0;
  const deltaPct = previous > 0 ? Math.round(((minutes - previous) / previous) * 100) : null;

  return { minutes, previous, deltaPct, series };
}
