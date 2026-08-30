/**
 * LOG WINDOW — the single authority on which dates a user may still log against.
 *
 * Extracted from ScheduleService so the two stores that a day's intake lives in
 * can both ask the same question without importing each other. FoodLogService
 * used to reach into ScheduleService for exactly this, which made the dependency
 * run backwards: the free-form log is not part of the schedule, and the schedule
 * has to be able to read the log when it closes a day (see processDayEnd). One
 * of those two edges had to go, and a date-window rule has no business living
 * inside either store.
 *
 * Nothing here touches storage. It is pure date arithmetic over LOCAL dates —
 * see services/OfflineStorage for why "today" is never computed from UTC.
 */

import { formatDate } from "../../models/diet";

/**
 * How many days back a user may still tick meals they forgot to log.
 *
 * One. Yesterday is recoverable ("did you eat these and forget to log?");
 * anything older is frozen. The limit is the point: a tracker you can edit
 * indefinitely stops measuring what you ate and starts measuring what you can
 * remember, and a week-old guess is worse than an honest gap. It also keeps the
 * end-of-period report meaningful, since history can't be rewritten after the
 * fact to flatter the result.
 */
export const BACKLOG_GRACE_DAYS = 1;

const dayMs = 86_400_000;

/** Local YYYY-MM-DD for today. Mirrors models/diet.formatDate. */
export function todayStr(): string {
  return formatDate(new Date());
}

/** Shift a local YYYY-MM-DD by N days without UTC drift. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);
  base.setDate(base.getDate() + days);
  return formatDate(base);
}

/** Whole days from `from` to `to`. */
export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / dayMs,
  );
}

export type LogPermission =
  /** Today — normal logging. */
  | "open"
  /** Within the grace window — allowed, and the UI should say it's a back-log. */
  | "backlog"
  /** Older than the grace window — permanently closed. */
  | "locked"
  /** In the future — nothing to log yet. */
  | "future";

/**
 * May the user change consumption for `date`? The single authority on the rule;
 * both the UI (to decide what to enable) and the mutations (to enforce it) ask
 * this, so the button state and the write guard can never disagree.
 */
export function logPermissionFor(
  date: string,
  today: string = todayStr(),
): LogPermission {
  const delta = diffDays(date, today);
  if (delta < 0) return "future";
  if (delta === 0) return "open";
  if (delta <= BACKLOG_GRACE_DAYS) return "backlog";
  return "locked";
}

/** Convenience predicate for call sites that only need yes/no. */
export function canLogForDate(date: string, today: string = todayStr()): boolean {
  const p = logPermissionFor(date, today);
  return p === "open" || p === "backlog";
}
