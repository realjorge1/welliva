/**
 * CALENDAR SERVICE — month/week models for the fitness calendar.
 *
 * Merges the weekly plan (scheduled sessions repeat by weekday) with the
 * workout log (what actually happened) into paintable day cells:
 *
 *   completed — a workout was logged that day
 *   planned   — plan session scheduled, day is today/future
 *   missed    — plan session was scheduled, day passed, nothing logged
 *   rest      — no session scheduled (past or present)
 *   future    — unscheduled upcoming day
 *
 * Pure — no storage, no React.
 */

import type { GeneratedWorkoutPlan, WorkoutLogEntry } from "@/models/workout";
import type { CalendarDay, CalendarDayStatus, CalendarMonth } from "../types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 0 = Mon … 6 = Sun for a calendar date. */
function mondayIndex(y: number, m: number, d: number): number {
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export function buildCalendarMonth(input: {
  year: number;
  month: number; // 1–12
  today: string; // YYYY-MM-DD
  plan: GeneratedWorkoutPlan | null;
  workoutLog: WorkoutLogEntry[];
}): CalendarMonth {
  const { year, month, today, plan, workoutLog } = input;

  // Index logs by date once.
  const logsByDate = new Map<string, WorkoutLogEntry[]>();
  for (const l of workoutLog) {
    const list = logsByDate.get(l.date) ?? [];
    list.push(l);
    logsByDate.set(l.date, list);
  }

  // Weekly plan → which weekdays carry sessions.
  const sessionByWeekday = new Map<number, string>();
  if (plan) {
    for (const s of plan.sessions) {
      if (typeof s.dayOfWeek === "number") sessionByWeekday.set(s.dayOfWeek, s.dayLabel);
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = mondayIndex(year, month, 1);

  const cells: CalendarDay[] = [];

  // Leading pad (previous month) — rendered as blanks.
  for (let i = 0; i < firstDow; i++) {
    cells.push({
      date: "",
      dayOfMonth: 0,
      inMonth: false,
      isToday: false,
      status: "rest",
      completedLabels: [],
    });
  }

  let completedCount = 0;
  let plannedCount = 0;
  let missedCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = toYmd(year, month, d);
    const weekday = mondayIndex(year, month, d);
    const logs = logsByDate.get(date) ?? [];
    const plannedLabel = sessionByWeekday.get(weekday);
    const isPast = date < today;
    const isToday = date === today;

    let status: CalendarDayStatus;
    if (logs.length > 0) {
      status = "completed";
      completedCount += 1;
    } else if (plannedLabel && (isToday || !isPast)) {
      status = "planned";
      plannedCount += 1;
    } else if (plannedLabel && isPast) {
      status = "missed";
      missedCount += 1;
    } else if (isPast || isToday) {
      status = "rest";
    } else {
      status = "future";
    }

    cells.push({
      date,
      dayOfMonth: d,
      inMonth: true,
      isToday,
      status,
      completedLabels: logs.map((l) => l.sessionLabel),
      plannedLabel,
    });
  }

  // Trailing pad to complete the final week row.
  while (cells.length % 7 !== 0) {
    cells.push({
      date: "",
      dayOfMonth: 0,
      inMonth: false,
      isToday: false,
      status: "rest",
      completedLabels: [],
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    year,
    month,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    weeks,
    completedCount,
    plannedCount,
    missedCount,
  };
}

/** Step a (year, month) pair by ±1 month. */
export function shiftMonth(
  year: number,
  month: number,
  delta: 1 | -1,
): { year: number; month: number } {
  const m = month + delta;
  if (m < 1) return { year: year - 1, month: 12 };
  if (m > 12) return { year: year + 1, month: 1 };
  return { year, month: m };
}
