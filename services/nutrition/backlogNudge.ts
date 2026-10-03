/**
 * backlogNudge — how long the Diet screen may ask "Did you have these and
 * forget to log?".
 *
 * The question is a nudge, not a fixture. It used to stand at the top of the
 * Diet screen for the whole of the day after any unticked meal, on every visit
 * and every relaunch, and its close button was forgotten on the next launch —
 * so a user who had simply skipped a snack was asked about it all day.
 *
 * Now it gets one look:
 *  • at most five minutes on screen, counted from the moment it first appears;
 *  • leaving the Diet screen before then ends it as well;
 *  • either way it stays gone, and returns only when there is a NEW day to ask
 *    about — tomorrow, if today goes unlogged too.
 *
 * The History screen keeps its own copy of the question, so the nudge going
 * away never takes away the chance to back-log.
 *
 * The record is keyed by the day being asked ABOUT, not by today's date, which
 * is what makes "a new day to ask about" the one thing that reopens it. It is
 * device-local on purpose: a nudge seen on one phone says nothing of another.
 */
import { KEYS, readJSON, writeJSON } from "../OfflineStorage";

/** How long the nudge may stay on screen. */
export const NUDGE_WINDOW_MS = 5 * 60 * 1000;

export interface NudgeRecord {
  /** The unlogged day the nudge asks about (YYYY-MM-DD). */
  date: string;
  /** When it first went on screen (epoch ms). */
  shownAt: number;
  /** Ended for good: closed, timed out, or the user left the screen. */
  closed: boolean;
}

/** Has the nudge about `date` never been shown? */
export function nudgeUnseen(record: NudgeRecord | null, date: string): boolean {
  return !record || record.date !== date;
}

/** May the nudge about `date` be on screen at `now`? */
export function nudgeOpen(record: NudgeRecord | null, date: string, now: number): boolean {
  if (nudgeUnseen(record, date)) return true;
  return !record!.closed && now - record!.shownAt < NUDGE_WINDOW_MS;
}

/** How long the nudge about `date` has left on screen, in ms. */
export function nudgeRemaining(record: NudgeRecord | null, date: string, now: number): number {
  if (nudgeUnseen(record, date)) return NUDGE_WINDOW_MS;
  if (record!.closed) return 0;
  return Math.max(0, NUDGE_WINDOW_MS - (now - record!.shownAt));
}

export function readNudge(): Promise<NudgeRecord | null> {
  return readJSON<NudgeRecord | null>(KEYS.BACKLOG_NUDGE, null);
}

/** Start the clock on the nudge about `date` — once; a second call keeps the first time. */
export async function markNudgeShown(date: string, now: number = Date.now()): Promise<NudgeRecord> {
  const record = await readNudge();
  if (record && record.date === date) return record;
  const next: NudgeRecord = { date, shownAt: now, closed: false };
  await writeJSON(KEYS.BACKLOG_NUDGE, next);
  return next;
}

/** End the nudge about `date` for good. */
export async function closeNudge(date: string, now: number = Date.now()): Promise<NudgeRecord> {
  const record = await readNudge();
  const next: NudgeRecord = {
    date,
    shownAt: record && record.date === date ? record.shownAt : now,
    closed: true,
  };
  await writeJSON(KEYS.BACKLOG_NUDGE, next);
  return next;
}
