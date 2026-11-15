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
  /**
   * PAUSED days — protected rough days (services/smart/roughDay). A paused day
   * neither adds to the run nor breaks it (owner, 2026-11-03). Attached when
   * the record is loaded (StreakService), never stored on it: the rough days
   * are their own synced record.
   */
  paused?: readonly string[];
  /**
   * FROZEN days — missed days a streak freeze covered (see pendingFreezes).
   * Like a paused day a frozen day neither adds to the run nor breaks it, and
   * it is NEVER a kept day: "N days kept" does not grow. Stored on the record
   * and synced as a union, so two phones can't erase one.
   */
  frozen?: readonly string[];
}

/** One freeze is earned for every this-many days kept. */
export const FREEZE_EARN_EVERY_DAYS = 7;
/** The most freezes anyone holds at once; one earned beyond this is not banked. */
export const FREEZE_MAX = 2;
/** How many frozen dates the record keeps. */
export const FROZEN_DAYS_CAP = 100;

/** Days that carry a run without being kept: rough days and frozen days. */
function bridgingDays(data: Pick<StreakLike, "paused" | "frozen">): string[] {
  return [...(data.paused ?? []), ...(data.frozen ?? [])];
}

export interface CommitmentDay {
  date: string;
  /** "Mo" … "Su". */
  label: string;
  kept: boolean;
  /** A rough day that paused the streak (and wasn't kept anyway). */
  paused: boolean;
  /** A missed day a streak freeze covered. Never kept. */
  frozen: boolean;
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
  /** Today is a paused rough day: the run is safe whatever happens. */
  pausedToday: boolean;
  /** Longest run ever. */
  best: number;
  /** Every day ever kept. */
  totalDays: number;
  /** Freezes held right now (0 … FREEZE_MAX). */
  freezes: number;
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
  data: Pick<StreakLike, "currentStreak" | "lastActiveDate" | "paused" | "frozen">,
  today: string,
): number {
  if (!data.lastActiveDate || data.currentStreak <= 0) return 0;
  if (data.lastActiveDate === today) return data.currentStreak;
  return runReaches(data.lastActiveDate, today, bridgingDays(data)) ? data.currentStreak : 0;
}

/** A month and a bit: further back than any run of paused days can reach. */
const PAUSE_REACH = 62;

/**
 * Does a run whose last kept day is `lastKept` still reach `today`? Yes when
 * every day between them — from yesterday back — is paused, which includes
 * the ordinary case of `lastKept` being yesterday. Today itself is never
 * needed: it isn't over.
 */
export function runReaches(
  lastKept: string,
  today: string,
  paused?: readonly string[],
): boolean {
  if (!lastKept) return false;
  const skip = new Set(paused ?? []);
  let d = shiftDay(today, -1);
  for (let i = 0; i < PAUSE_REACH && d > lastKept; i++) {
    if (!skip.has(d)) return false;
    d = shiftDay(d, -1);
  }
  return d === lastKept;
}

/**
 * Freezes held, replayed from the ledgers in date order: every
 * FREEZE_EARN_EVERY_DAYS-th kept day earns one (none is banked past
 * FREEZE_MAX), every frozen day spends one. Derived, never stored, so the
 * number can't drift from the days behind it, and a synced union of kept and
 * frozen days gives every phone the same answer.
 *
 * The kept ledger is capped (KEPT_DAYS_CAP); past that, the oldest days drop
 * out of the replay. At a year of kept days the difference is at most one
 * freeze, and only ever for someone who already holds the maximum.
 */
export function freezeBalance(days?: readonly string[], frozen?: readonly string[]): number {
  const kept = new Set(days ?? []);
  const events = [
    ...[...kept].map((d) => ({ d, kept: true })),
    ...[...new Set(frozen ?? [])].filter((d) => !kept.has(d)).map((d) => ({ d, kept: false })),
  ].sort((a, b) => a.d.localeCompare(b.d) || (a.kept === b.kept ? 0 : a.kept ? -1 : 1));
  let count = 0;
  let balance = 0;
  for (const e of events) {
    if (e.kept) {
      count++;
      if (count % FREEZE_EARN_EVERY_DAYS === 0) balance = Math.min(FREEZE_MAX, balance + 1);
    } else {
      balance = Math.max(0, balance - 1);
    }
  }
  return balance;
}

/**
 * The missed days a freeze should cover now — or none.
 *
 * Walks from yesterday back to the last kept day. Every day in between that
 * is neither a rough day nor already frozen is MISSED. If there are no more
 * missed days than freezes held, each is frozen and the run carries on;
 * otherwise none is (spending freezes that can't save the run would only
 * waste them). A rough day the person marked is never frozen: it already
 * protects the run on its own. Today is never frozen — it isn't over.
 */
export function pendingFreezes(data: StreakLike, today: string): string[] {
  if (!data.lastActiveDate || data.currentStreak <= 0 || data.lastActiveDate >= today) return [];
  const bridge = new Set(bridgingDays(data));
  const missed: string[] = [];
  let d = shiftDay(today, -1);
  for (let i = 0; i < PAUSE_REACH && d > data.lastActiveDate; i++) {
    if (!bridge.has(d)) missed.push(d);
    d = shiftDay(d, -1);
  }
  if (d !== data.lastActiveDate || missed.length === 0) return [];
  return missed.length <= freezeBalance(data.days, data.frozen) ? missed.sort() : [];
}

/**
 * The freeze moment (components/celebration/FreezeMoment) plays once per phone
 * for frozen days this recent; an older one, arriving on a new phone through
 * sync, is history, not news.
 */
export const FREEZE_MOMENT_WINDOW_DAYS = 7;

/** Frozen days this phone hasn't shown yet, oldest first. `seen` = the last one shown. */
export function unseenFrozen(
  frozen: readonly string[] | undefined,
  seen: string | null,
  today: string,
): string[] {
  const floor = shiftDay(today, -FREEZE_MOMENT_WINDOW_DAYS);
  return [...new Set(frozen ?? [])].filter((d) => d < today && d >= floor && (!seen || d > seen)).sort();
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** The line under the streak while the moment plays — and after. */
export function freezeMomentLine(dates: readonly string[], today: string): string {
  if (dates.length >= 2) return "Two freezes held your streak";
  const d = dates[0] ?? shiftDay(today, -1);
  return d === shiftDay(today, -1) ? "A freeze held yesterday" : `A freeze held on ${WEEKDAY_NAMES[weekdayIndex(d)]}`;
}

/** Add frozen dates: deduped, ascending, capped from the old end. */
export function withFrozenDays(frozen: readonly string[] | undefined, dates: readonly string[]): string[] {
  const out = [...new Set([...(frozen ?? []), ...dates])].sort();
  return out.length > FROZEN_DAYS_CAP ? out.slice(out.length - FROZEN_DAYS_CAP) : out;
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
  const ledger = new Set(data.days ?? []);
  const kept = new Set(ledger);
  if (data.lastActiveDate && data.currentStreak > 0) {
    // Only as far back as anyone will look (the start of this week). A paused
    // or frozen day inside the run was not kept — step over it (unless the
    // ledger says it was: a kept day beats a rough day).
    const paused = new Set(bridgingDays(data));
    let d = data.lastActiveDate;
    let counted = 0;
    for (let guard = 0; counted < data.currentStreak && guard < data.currentStreak + PAUSE_REACH; guard++) {
      if (d < horizon) break;
      if (!paused.has(d) || ledger.has(d)) {
        kept.add(d);
        counted++;
      }
      d = shiftDay(d, -1);
    }
  }
  return kept;
}

/**
 * Which of `dates` were paused rough days — the quiet mark beside the flames.
 * A day that was kept anyway is kept, not paused.
 */
export function pausedOn(data: StreakLike, dates: readonly string[]): boolean[] {
  if (dates.length === 0) return [];
  const paused = new Set(data.paused ?? []);
  const kept = keptOn(data, dates);
  return dates.map((d, i) => paused.has(d) && !kept[i]);
}

/** Which of `dates` a streak freeze covered. A day that was kept is kept, not frozen. */
export function frozenOn(data: StreakLike, dates: readonly string[]): boolean[] {
  if (dates.length === 0) return [];
  const frozen = new Set(data.frozen ?? []);
  const kept = keptOn(data, dates);
  return dates.map((d, i) => frozen.has(d) && !kept[i]);
}

/**
 * Which of `dates` were kept — any dates, in any order, answered from the same
 * ledger (and the same reconstructed run) as the Monday-to-Sunday week. For a
 * surface whose days are not this calendar week: Home's "Your week" runs the
 * last seven days with today on the right.
 */
export function keptOn(data: StreakLike, dates: readonly string[]): boolean[] {
  if (dates.length === 0) return [];
  const earliest = dates.reduce((a, b) => (b < a ? b : a));
  const kept = keptSet(data, earliest);
  return dates.map((d) => kept.has(d));
}

/** Everything a commitment surface shows, read off the record for `today`. */
export function readCommitment(data: StreakLike, today: string): CommitmentState {
  const streak = liveStreak(data, today);
  const keptToday = data.lastActiveDate === today;
  const monday = shiftDay(today, -weekdayIndex(today));
  const kept = keptSet(data, monday);
  const paused = new Set(data.paused ?? []);
  const frozen = new Set(data.frozen ?? []);
  const pausedToday = paused.has(today) && !keptToday;

  const week: CommitmentDay[] = WEEK_LABELS.map((label, i) => {
    const date = shiftDay(monday, i);
    return {
      date,
      label,
      kept: kept.has(date),
      paused: paused.has(date) && !kept.has(date),
      frozen: frozen.has(date) && !kept.has(date) && !paused.has(date),
      isToday: date === today,
      isFuture: date > today,
    };
  });

  return {
    streak,
    keptToday,
    // A paused day can't end the run, so there is nothing at risk on it.
    atRisk: streak > 0 && !keptToday && !pausedToday,
    pausedToday,
    best: Math.max(data.longestStreak, streak),
    totalDays: data.totalActiveDays,
    freezes: freezeBalance(data.days, data.frozen),
    week,
  };
}

/**
 * The run once today counts — what something that is about to keep the day
 * lands on. A day already kept is already in the run; otherwise today extends
 * a live run by one, or starts a new one at 1.
 *
 * For a surface that shows the streak BEFORE its own action is saved: the
 * workout-complete chip reads the record while the session is still unbanked,
 * so on a day nothing else had kept it showed yesterday's run — and the next
 * workout that day showed one more, which reads exactly like "each session
 * counted as a day" (owner, 2026-11-01).
 */
export function streakWithToday(state: Pick<CommitmentState, "streak" | "keptToday">): number {
  return state.keptToday ? state.streak : state.streak + 1;
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
  if (state.pausedToday) {
    return state.streak > 0
      ? `A gentle day. Your ${state.streak}-day streak is paused, not broken.`
      : "A gentle day. Nothing to keep up today.";
  }
  if (state.atRisk) {
    return `Your ${state.streak}-day streak needs today — log a meal, a workout or a check-in.`;
  }
  return "Log a meal, a workout or a check-in to light today's flame.";
}
