/**
 * WEEK TABLE — Home's "Your week": seven days, a few rows, every cell a reading.
 *
 * WHAT EACH ROW COUNTS, AND WHERE IT IS READ FROM
 *
 *   Calories   kcal eaten that day — the closed days of `dietHistory`, and TODAY
 *              live (history only gains a row when a day closes).
 *   Workout    minutes trained — the workout log, summed per day.
 *   Water      litres drunk — the hydration archive, and TODAY live.
 *
 * A CELL IS A NUMBER OR IT IS EMPTY, NEVER A ZERO IT DID NOT READ. A day on
 * which nothing was logged is not a day on which nothing was eaten: a closed day
 * with no intake is stored as zeros, and printing them would put "0 kcal" on a
 * day the user simply did not log. So an unlogged day is a dash. The same rule
 * decides what counts as "logged" here as in the trend charts (they share
 * `buildMacroMatrix`), so the table and the charts cannot disagree.
 *
 * Pure: everything it needs comes in as an argument.
 */

import { buildMacroMatrix } from "@/components/charts/series";
import type { DietHistoryEntry } from "@/models/diet";
import type { WorkoutLogEntry } from "@/models/workout";
import { shiftDay, weekdayIndex } from "@/services/commitment";
import type { WaterHistoryEntry } from "@/services/OfflineStorage";

export const WEEK_DAYS = 7;

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type WeekRowKey = "calories" | "workout" | "water";

export interface WeekColumn {
  date: string;
  /** "MON". */
  label: string;
  dayOfMonth: number;
  isToday: boolean;
}

export interface WeekRow {
  key: WeekRowKey;
  label: string;
  unit: string;
  /** One per column, already formatted; null where nothing was logged. */
  cells: (string | null)[];
}

export interface WeekTable {
  /** The seven days ending today, oldest first — today is the last column. */
  columns: WeekColumn[];
  rows: WeekRow[];
  /** False when every cell is empty — the screen says so instead of drawing dashes. */
  hasData: boolean;
}

export interface WeekTableInput {
  today: string;
  dietHistory: readonly DietHistoryEntry[];
  workoutLog: readonly WorkoutLogEntry[];
  waterHistory: readonly WaterHistoryEntry[];
  /** Today, read live — it is not in the history yet. */
  live: { calories: number; waterMl: number };
}

export function buildWeekTable(input: WeekTableInput): WeekTable {
  const { today } = input;

  const dates: string[] = [];
  for (let i = WEEK_DAYS - 1; i >= 0; i--) dates.push(shiftDay(today, -i));

  const columns: WeekColumn[] = dates.map((date) => ({
    date,
    label: WEEKDAYS[weekdayIndex(date)],
    dayOfMonth: Number(date.slice(8, 10)),
    isToday: date === today,
  }));

  // Calories — closed days from the history, today from the live total.
  const eaten = new Map<string, number>();
  for (const row of buildMacroMatrix([...input.dietHistory], today, WEEK_DAYS)) {
    if (row.date !== today && row.calories != null && row.calories > 0) {
      eaten.set(row.date, row.calories);
    }
  }
  if (input.live.calories > 0) eaten.set(today, Math.round(input.live.calories));

  // Workout — minutes per day. A day with no session is a dash, not "0 min".
  const trained = new Map<string, number>();
  for (const l of input.workoutLog) {
    if (l.date < dates[0] || l.date > today) continue;
    trained.set(l.date, (trained.get(l.date) ?? 0) + (l.durationMinutes || 0));
  }

  // Water — archived days, and today live.
  const drunk = new Map<string, number>();
  for (const w of input.waterHistory) {
    if (w.date !== today && w.ml > 0) drunk.set(w.date, w.ml);
  }
  if (input.live.waterMl > 0) drunk.set(today, input.live.waterMl);

  const cell = (
    source: Map<string, number>,
    format: (v: number) => string,
  ): (string | null)[] =>
    dates.map((date) => {
      const v = source.get(date);
      return v == null ? null : format(v);
    });

  const rows: WeekRow[] = [
    {
      key: "calories",
      label: "Calories",
      unit: "kcal",
      cells: cell(eaten, (v) => String(Math.round(v))),
    },
    {
      key: "workout",
      label: "Workout",
      unit: "min",
      cells: cell(trained, (v) => String(Math.round(v))),
    },
    {
      key: "water",
      label: "Water",
      unit: "L",
      // Whole hundreds of ml first: `(2150 / 1000).toFixed(1)` is "2.1", because
      // 2.15 has no exact binary form, and a glass of water should round like one.
      cells: cell(drunk, (v) => (Math.round(v / 100) / 10).toFixed(1)),
    },
  ];

  return { columns, rows, hasData: rows.some((r) => r.cells.some((c) => c != null)) };
}
