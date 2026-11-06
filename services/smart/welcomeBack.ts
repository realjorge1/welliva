/**
 * services/smart/welcomeBack.ts
 *
 * WELCOME BACK, WITHOUT GUILT — and the smaller "fresh start" moments.
 *
 * After a week or more with no kept day, the first open is one calm screen:
 *
 *   "Welcome back." + one warm line
 *   [Start fresh from today]   [Pick up where I left off]
 *
 * No count of the days away, no zeros, no red. "Coming back" means exactly
 * what the comeback achievement means by it — the same gap
 * (AchievementService `COMEBACK_GAP_DAYS`), so the app never disagrees with
 * itself about who has been away.
 *
 * START FRESH sets a FRESH START: for seven days the workouts ease in (the
 * training engine's own lighter path — the plan is never forked) and Home's
 * "Your week" leads with "Fresh start · day N" from today, instead of a row of
 * empty days. History stays whole everywhere else.
 *
 * FRESH-START MOMENTS are the gentle version for someone who is still here but
 * thinly: a Monday morning or the 1st of the month, when the last week held one
 * or two kept days (none at all is a welcome back instead). At most once a
 * fortnight, and never as a notification.
 *
 * Pure rules, plus the one stored thing: the fresh start itself.
 */
import { COMEBACK_GAP_DAYS } from "../AchievementService";
import { shiftDay, weekdayIndex, type StreakLike } from "../commitment";
import { readJSON, writeJSON } from "../OfflineStorage";
import { daysFrom } from "./arbiter";

export const FRESH_START_KEY = "@welliva_fresh_start";

/** A fresh start lasts a week: long enough to land, short enough to end. */
export const FRESH_START_DAYS = 7;

/** A fresh-start moment comes round at most once a fortnight. */
export const FRESH_MOMENT_GAP_DAYS = 14;

/** "Thin" is this many kept days or fewer in the last seven — but not none. */
export const THIN_WEEK_MAX_DAYS = 2;

/** Fresh-start moments are a morning thing; after noon the day is under way. */
export const FRESH_MOMENT_UNTIL_HOUR = 12;

export interface FreshStart {
  /** Day 1. */
  since: string;
  /** What offered it. */
  from: "welcome-back" | "monday" | "month";
  /** UTC ISO. */
  at: string;
}

/**
 * Is a welcome back due? Yes when someone with a history has gone at least the
 * comeback gap without keeping a day. Its id names the gap, so each return is
 * welcomed once — answering it, either way, is the end of it.
 */
export function welcomeBackDue(
  streak: Pick<StreakLike, "lastActiveDate" | "totalActiveDays">,
  today: string,
): { id: string; lastKept: string } | null {
  const last = streak.lastActiveDate;
  if (!last || streak.totalActiveDays <= 0 || last >= today) return null;
  if (daysFrom(last, today) < COMEBACK_GAP_DAYS) return null;
  return { id: `welcome-back:${last}`, lastKept: last };
}

/** Kept days in the seven days before today. */
export function keptLastWeek(days: readonly string[] | undefined, today: string): number {
  const from = shiftDay(today, -7);
  return (days ?? []).filter((d) => d >= from && d < today).length;
}

/**
 * Is a fresh-start moment due? A Monday or the 1st, in the morning, after a
 * thin week (one or two kept days), and not within a fortnight of the last
 * one offered. `lastOffered` is the latest day one was answered.
 */
export function freshMomentDue(input: {
  streak: Pick<StreakLike, "days" | "lastActiveDate" | "totalActiveDays">;
  today: string;
  hour: number;
  lastOffered: string | null;
}): { id: string; kind: "monday" | "month" } | null {
  const { streak, today, hour, lastOffered } = input;
  if (hour >= FRESH_MOMENT_UNTIL_HOUR) return null;
  const kind = today.endsWith("-01") ? "month" : weekdayIndex(today) === 0 ? "monday" : null;
  if (!kind) return null;
  if (welcomeBackDue(streak, today)) return null;
  const kept = keptLastWeek(streak.days, today);
  if (kept === 0 || kept > THIN_WEEK_MAX_DAYS) return null;
  if (lastOffered && daysFrom(lastOffered, today) < FRESH_MOMENT_GAP_DAYS) return null;
  return { id: `fresh-start:${today}`, kind };
}

/** Day 1–7 of a fresh start on `today`, or null when there isn't one running. */
export function freshStartDay(fresh: FreshStart | null, today: string): number | null {
  if (!fresh || fresh.since > today) return null;
  const n = daysFrom(fresh.since, today) + 1;
  return n <= FRESH_START_DAYS ? n : null;
}

const WELCOME_LINES = [
  "Good to see you. Today is a perfectly good day to start again.",
  "No catching up to do. We'll start from today.",
  "You're here, and that's the part that counts.",
  "Whatever the last stretch was, today's a clean page.",
  "Glad you're back. One small thing today is plenty.",
];

/** The warm line — deterministic by day, so it doesn't change on a redraw. */
export function welcomeLine(today: string): string {
  let h = 2166136261;
  for (let i = 0; i < today.length; i++) {
    h ^= today.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return WELCOME_LINES[(h >>> 0) % WELCOME_LINES.length];
}

export function freshMomentTitle(kind: "monday" | "month"): string {
  return kind === "month" ? "New month. Want a fresh start?" : "New week. Want a fresh start?";
}

// ── storage ─────────────────────────────────────────────────────────

export async function loadFreshStart(): Promise<FreshStart | null> {
  try {
    const raw = await readJSON<FreshStart | null>(FRESH_START_KEY, null);
    return raw && typeof raw.since === "string" ? raw : null;
  } catch {
    return null;
  }
}

type Listener = (fresh: FreshStart | null) => void;
const listeners = new Set<Listener>();

export function subscribeFreshStart(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Start fresh from `today`. */
export async function startFresh(
  today: string,
  from: FreshStart["from"],
  now: Date = new Date(),
): Promise<FreshStart> {
  const fresh: FreshStart = { since: today, from, at: now.toISOString() };
  await writeJSON(FRESH_START_KEY, fresh);
  for (const fn of [...listeners]) {
    try {
      fn(fresh);
    } catch {
      // one bad listener must not stop the others
    }
  }
  return fresh;
}
