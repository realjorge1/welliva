/**
 * DAILY COMMITMENT — the read side of the streak.
 *
 * The owner asked (2026-10-15) for "daily commitment like Duolingo — something
 * to make users want to come back". welliva already counted a streak, but the
 * count could not be trusted, which under the no-cosmetic-counters rule is the
 * same as not having one:
 *
 *   · A BROKEN STREAK KEPT SHOWING ITS OLD NUMBER. `currentStreak` only ever
 *     changed when the next activity was recorded, so a five-day run abandoned a
 *     week ago still read "5" on Home until the day you came back — and then
 *     dropped to 1. The live value is now derived: alive only while the last
 *     kept day is today or yesterday.
 *   · THE WEEK STRIP REMEMBERED LAST WEEK. `weekActivity` was reset only on a
 *     Monday the app happened to be opened, so skip opening it on a Monday and
 *     last week's ticks sat in this week's row. The week is now read off a
 *     ledger of the actual dates (`days`), never a mutable array of seven flags.
 *
 * A DAY IS KEPT when you log something real for yourself — a meal or a food, a
 * workout, a weigh-in, a check-in, a habit, or your whole water goal. One is
 * enough. That is the Duolingo shape (one lesson keeps the streak) and it is
 * deliberately small: the commitment is to show up every day, not to have a
 * perfect one.
 *
 * Pure: no React, no storage. StreakService owns the writes.
 */

/** The fields the commitment is read from — a subset of StreakData. */
export interface StreakLike {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalActiveDays: number;
  /** Every kept date, ascending, YYYY-MM-DD. Absent on data written before 2026-10-15. */
  days?: string[];
}

export interface CommitmentDay {
  date: string;
  /** "Mo" … "Su". */
  label: string;
  kept: boolean;
  isToday: boolean;
  /** Later this week — can't have been kept or missed yet. */
  isFuture: boolean;
}

export interface CommitmentState {
  /** The run as of today: alive while today or yesterday was kept, else 0. */
  streak: number;
  /** Today already counts. */
  keptToday: boolean;
  /** A run is alive but today hasn't been kept yet — it ends at midnight. */
  atRisk: boolean;
  /** Longest run ever. */
  best: number;
  /** Every day ever kept. */
  totalDays: number;
  /** Monday → Sunday of the current week. */
  week: CommitmentDay[];
}

/** How many kept dates the ledger holds. A year and a bit; the week only needs 7. */
export const KEPT_DAYS_CAP = 400;

const WEEK_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Calendar-day arithmetic on YYYY-MM-DD. Done in UTC so a DST change can
 * never make a "day" 23 or 25 hours long and skip or repeat a date.
 */
export function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1) + delta * 86_400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay() + 6) % 7;
}

/**
 * The run as it stands TODAY. The stored count is only true on the day it was
 * written and the day after; past that, the run has ended, whatever the
 * stored number says.
 */
export function liveStreak(
  data: Pick<StreakLike, "currentStreak" | "lastActiveDate">,
  today: string,
): number {
  if (!data.lastActiveDate || data.currentStreak <= 0) return 0;
  if (data.lastActiveDate === today) return data.currentStreak;
  if (data.lastActiveDate === shiftDay(today, -1)) return data.currentStreak;
  return 0;
}

/**
 * Add a kept date to the ledger: deduped, ascending, capped from the old end.
 * Returns a new array — the stored one is never mutated in place.
 */
export function withKeptDay(days: readonly string[] | undefined, date: string): string[] {
  const set = new Set(days ?? []);
  set.add(date);
  const out = [...set].sort();
  return out.length > KEPT_DAYS_CAP ? out.slice(out.length - KEPT_DAYS_CAP) : out;
}

/**
 * Was this date kept?
 *
 * The ledger answers for anything recorded since it existed. For older data
 * the current RUN is reconstructed: a run of N ending on its last kept day
 * means each of those N days was kept — exact, not a guess — so a returning
 * user's week strip is right from the first open, without a migration.
 */
function keptSet(data: StreakLike, horizon: string): Set<string> {
  const kept = new Set(data.days ?? []);
  if (data.lastActiveDate && data.currentStreak > 0) {
    // Only as far back as anyone will look (the start of this week).
    for (let i = 0; i < data.currentStreak; i++) {
      const d = shiftDay(data.lastActiveDate, -i);
      if (d < horizon) break;
      kept.add(d);
    }
  }
  return kept;
}

/** Everything a commitment surface shows, read off the record for `today`. */
export function readCommitment(data: StreakLike, today: string): CommitmentState {
  const streak = liveStreak(data, today);
  const keptToday = data.lastActiveDate === today;
  const monday = shiftDay(today, -weekdayIndex(today));
  const kept = keptSet(data, monday);

  const week: CommitmentDay[] = WEEK_LABELS.map((label, i) => {
    const date = shiftDay(monday, i);
    return {
      date,
      label,
      kept: kept.has(date),
      isToday: date === today,
      isFuture: date > today,
    };
  });

  return {
    streak,
    keptToday,
    atRisk: streak > 0 && !keptToday,
    best: Math.max(data.longestStreak, streak),
    totalDays: data.totalActiveDays,
    week,
  };
}

/* ── What the moment says ───────────────────────────────────────────────── */

/** Runs that get their own words. */
const MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];

const FIRST_DAY = [
  "Day one. The hardest one to start.",
  "Lit. Now come back tomorrow and keep it that way.",
  "One day in. Tomorrow makes it a streak.",
  "Every long run starts exactly like this.",
  "You showed up today. That's the whole commitment.",
  "The first flame is yours. Tomorrow, make it two.",
];

const COMEBACK = [
  "Welcome back. Day one, again — that's how it's done.",
  "You came back. That counts for more than the gap.",
  "Lit again. The streak starts over; you don't.",
  "Back on it. One day at a time from here.",
  "Fresh flame. The old one taught you how.",
];

const EARLY = [
  "Come back tomorrow to keep it lit.",
  "Another day kept. Same time tomorrow?",
  "It's starting to look like a habit.",
  "Small days add up. This one did.",
  "Kept. Tomorrow's flame is already waiting.",
  "Showing up is the hard part, and you did it.",
];

const BUILDING = [
  "This is what consistency looks like.",
  "Another day on the board. Keep the run going.",
  "You keep turning up. It's working.",
  "Days like this are the whole plan.",
  "The flame's getting harder to put out.",
  "Steady. Tomorrow, the same again.",
];

const MILESTONE_LINES: Record<number, string> = {
  7: "A full week. That's a habit taking hold.",
  14: "Two weeks without missing a day.",
  21: "Three weeks. This is just what you do now.",
  30: "A whole month, every single day.",
  50: "Fifty days. Very few people get here.",
  75: "Seventy-five days of showing up.",
  100: "One hundred days. Remarkable.",
  150: "A hundred and fifty days, kept one at a time.",
  200: "Two hundred days. You've built something.",
  250: "Two hundred and fifty days. Unbroken.",
  300: "Three hundred days of keeping your word.",
  365: "A full year. Every day of it.",
  500: "Five hundred days.",
  730: "Two years, every day.",
  1000: "A thousand days.",
};

/** A small stable hash, so the same day always says the same thing. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The line under the count on the day a streak moves. Deterministic by date —
 * never `Math.random()` at render, which would re-roll the sentence every time
 * the screen redraws.
 */
export function commitmentLine(streak: number, totalDays: number, today: string): string {
  if (MILESTONE_LINES[streak]) return MILESTONE_LINES[streak];
  const pool =
    streak <= 1 ? (totalDays > 1 ? COMEBACK : FIRST_DAY) : streak < 7 ? EARLY : BUILDING;
  return pool[hash(`${today}:${streak}`) % pool.length];
}

/** True when this run length is one the celebration should mark as a milestone. */
export function isMilestone(streak: number): boolean {
  return MILESTONES.includes(streak);
}

/** The quiet line Home shows under the week, for where today stands. */
export function commitmentStatus(state: CommitmentState): string {
  if (state.keptToday) {
    return `Today's kept. Come back tomorrow for day ${state.streak + 1}.`;
  }
  if (state.atRisk) {
    return `Your ${state.streak}-day streak needs today — log a meal, a workout or a check-in.`;
  }
  return "Log a meal, a workout or a check-in to light today's flame.";
}
