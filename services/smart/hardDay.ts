/**
 * services/smart/hardDay.ts
 *
 * PREPARE FOR THE HARD DAY — the weekday that keeps getting missed, offered a
 * way out before it comes:
 *
 *   "Thursdays are your toughest: you missed 4 of the last 5 planned workouts on
 *    a Thursday. Want a 15-minute Thursday?"  [Make Thursdays short]  [Keep as is]
 *
 * WHAT IT COUNTS. A workout planned for a date, against a workout logged on that
 * date. The plan document only ever holds the current week, so "planned last
 * Thursday" did not exist anywhere — hence {@link PlannedDays}, a small record
 * written forward from now on. A week nobody opened the app in has no record and
 * is simply not counted: unknown is not a miss. A rough day is not a miss either.
 *
 * NOT A PREDICTION. The learning engine's "at risk" model (health-os/learning)
 * is not used to decide when to offer: it only sees workouts from its one-time
 * backfill, so it has no recent evidence to speak from. These are plain counts,
 * and they are also exactly what the sentence says.
 *
 * "Make Thursdays short" lasts {@link SHORT_WEEKS} weeks, built by the training
 * engine (services/training `shortenSession`), then asks once, with the real
 * number. "Keep as is" holds the question back for {@link KEEP_DAYS} days.
 *
 * Pure rules, plus the two stored records.
 */
import type { GeneratedWorkoutPlan } from "../../models/workout";
import { shiftDay, weekdayIndex } from "../commitment";
import { readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";
import { daysFrom } from "./arbiter";
import type { SmartCandidate } from "./types";

export const PLANNED_DAYS_KEY = "@welliva_planned_days";
export const SHORT_WEEKDAYS_KEY = "@welliva_short_weekdays";

/** How far back it looks. Six weeks is six Thursdays: a pattern, not a bad week. */
export const HARD_WINDOW_DAYS = 42;

/** At least this many planned on that weekday in the window, or it's too early to say. */
export const HARD_MIN_PLANNED = 4;

/** The most recent planned sessions on the weekday that the claim is about. */
export const HARD_RECENT = 5;

/** Missed at least this many of them. */
export const HARD_MIN_MISSED = 3;

/** Other weekdays must be going well, or it's about everything and not that day. */
export const OTHER_DAYS_MIN_RATE = 0.6;

/** And there must be enough of them to say so. */
export const OTHER_DAYS_MIN_PLANNED = 3;

/** The short session's target, in minutes. */
export const SHORT_MINUTES = 15;

/** A short weekday lasts four weeks, then asks. */
export const SHORT_WEEKS = 4;

/** "Keep as is" holds the question back six weeks. */
export const KEEP_DAYS = 42;

/** Planned days kept: the window, and room for the short-weeks review. */
const PLANNED_KEEP_DAYS = 84;

/** Offered from this hour the evening before… */
export const EVE_FROM_HOUR = 17;
/** …and until this hour on the day itself. */
export const DAY_UNTIL_HOUR = 12;

export const HARD_DAY_PRIORITY = 60;

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** One date's plan, as it stood. */
export interface PlannedDay {
  /** A session was planned. False when a re-plan took it away again. */
  planned: boolean;
  sessionId?: string;
  /** UTC ISO — what a merge compares. */
  updatedAt: string;
}

export type PlannedDays = Record<string, PlannedDay>;

/** A weekday (0 = Monday) the user asked to keep short. */
export interface ShortWeekday {
  /** `short:<weekday>`. */
  id: string;
  weekday: number;
  /** First day it applies. */
  since: string;
  /** Last day it applies, inclusive. */
  until: string;
  /** UTC ISO. */
  updatedAt: string;
  /** Back to full. Kept so the change travels. */
  deleted?: boolean;
}

export interface HardWeekday {
  weekday: number;
  /** How many of the recent planned sessions the claim is about (4 or 5). */
  recent: number;
  missed: number;
}

export interface HardDayOffer extends SmartCandidate {
  feature: "hard-day";
  kind: "offer";
  weekday: number;
  recent: number;
  missed: number;
}

export interface ShortReview extends SmartCandidate {
  feature: "hard-day";
  kind: "review";
  weekday: number;
  /** Planned on that weekday while it was short. */
  planned: number;
  done: number;
  since: string;
}

export const weekdayName = (weekday: number): string => WEEKDAY_NAMES[weekday] ?? "";

// ── the planned-days record ─────────────────────────────────────────

/**
 * The record with this week's plan written in. Only today onward: a day already
 * gone can't be re-planned, and what stood for it stays as it stood. A day this
 * plan no longer trains on is written `planned: false`, so a re-plan on Tuesday
 * can't leave Thursday counted as planned.
 */
export function withPlanWeek(
  days: PlannedDays,
  plan: Pick<GeneratedWorkoutPlan, "weekStart" | "sessions">,
  today: string,
  now: Date,
): PlannedDays {
  const next: PlannedDays = {};
  const floor = shiftDay(today, -PLANNED_KEEP_DAYS);
  for (const [date, v] of Object.entries(days)) if (date >= floor) next[date] = v;

  const stamp = now.toISOString();
  for (let i = 0; i < 7; i++) {
    const date = shiftDay(plan.weekStart, i);
    if (date < today) continue;
    const session = plan.sessions.find((s) => s.dayOfWeek === i && !s.isRestDay);
    const prior = next[date];
    if (session) {
      if (prior?.planned && prior.sessionId === session.id) continue;
      next[date] = { planned: true, sessionId: session.id, updatedAt: stamp };
    } else if (prior?.planned) {
      next[date] = { planned: false, updatedAt: stamp };
    }
  }
  return next;
}

// ── the finding ─────────────────────────────────────────────────────

/**
 * The weekday that keeps getting missed, or null. Every count is over completed
 * days only (today isn't over), and a rough day counts for nothing either way.
 */
export function findHardWeekday(input: {
  planned: PlannedDays;
  workoutDates: ReadonlySet<string>;
  roughDates: ReadonlySet<string>;
  today: string;
}): HardWeekday | null {
  const { planned, workoutDates, roughDates, today } = input;
  const floor = shiftDay(today, -HARD_WINDOW_DAYS);
  const byWeekday: string[][] = [[], [], [], [], [], [], []];
  for (const [date, v] of Object.entries(planned)) {
    if (!v?.planned || date < floor || date >= today || roughDates.has(date)) continue;
    byWeekday[weekdayIndex(date)].push(date);
  }

  let best: HardWeekday | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    const dates = byWeekday[weekday].sort();
    if (dates.length < HARD_MIN_PLANNED) continue;
    const recent = dates.slice(-HARD_RECENT);
    const missed = recent.filter((d) => !workoutDates.has(d)).length;
    if (missed < HARD_MIN_MISSED) continue;

    const others = byWeekday.flatMap((list, i) => (i === weekday ? [] : list));
    if (others.length < OTHER_DAYS_MIN_PLANNED) continue;
    const done = others.filter((d) => workoutDates.has(d)).length;
    if (done / others.length < OTHER_DAYS_MIN_RATE) continue;

    if (!best || missed / recent.length > best.missed / best.recent) {
      best = { weekday, recent: recent.length, missed };
    }
  }
  return best;
}

/** Is it the time to offer: the evening before that weekday, or its morning? */
export function offerDue(weekday: number, today: string, hour: number): boolean {
  if (weekdayIndex(today) === weekday) return hour < DAY_UNTIL_HOUR;
  return weekdayIndex(shiftDay(today, 1)) === weekday && hour >= EVE_FROM_HOUR;
}

/** The short weekday in force on `date`, if any. */
export function activeShortDay(list: readonly ShortWeekday[], date: string): ShortWeekday | null {
  const weekday = weekdayIndex(date);
  return (
    list.find((s) => !s.deleted && s.weekday === weekday && s.since <= date && date <= s.until) ?? null
  );
}

/** A short run that has ended and hasn't been reviewed, with its real numbers. */
export function shortReviewDue(input: {
  shortDays: readonly ShortWeekday[];
  planned: PlannedDays;
  workoutDates: ReadonlySet<string>;
  roughDates: ReadonlySet<string>;
  today: string;
}): Omit<ShortReview, "id" | "feature" | "priority" | "kind"> | null {
  const { shortDays, planned, workoutDates, roughDates, today } = input;
  for (const s of shortDays) {
    if (s.deleted || s.until >= today) continue;
    const dates = Object.keys(planned).filter(
      (d) =>
        planned[d]?.planned &&
        d >= s.since &&
        d <= s.until &&
        weekdayIndex(d) === s.weekday &&
        !roughDates.has(d),
    );
    return {
      weekday: s.weekday,
      planned: dates.length,
      done: dates.filter((d) => workoutDates.has(d)).length,
      since: s.since,
    };
  }
  return null;
}

// ── the same question, for a habit ──────────────────────────────────

/** A habit missed this many of its last five on one weekday… */
export const HABIT_DAY_MIN_MISSED = 4;
export const HABIT_DAY_RECENT = 5;
/** …while it's done at least this often on its other days. */
export const HABIT_OTHER_DAYS_MIN_RATE = 0.6;
export const HABIT_DAY_PRIORITY = 30;

export interface HabitDayOffer extends SmartCandidate {
  feature: "hard-day";
  kind: "habit-day";
  habitId: string;
  habitName: string;
  weekday: number;
  missed: number;
  recent: number;
}

/**
 * A weekday-scheduled habit that keeps being missed on one of its days, while
 * the rest go fine: "Move it off Thursdays?". Quota habits have no missed days
 * to speak of, and a one-day habit has nowhere to move from. Rough days and
 * days before the habit existed aren't counted.
 */
export function habitDayOffer(input: {
  habit: { id: string; name: string; days: number[]; weeklyGoal?: number | null; createdAt: string; source: string };
  done: ReadonlySet<string>;
  paused: ReadonlySet<string>;
  today: string;
}): HabitDayOffer | null {
  const { habit, done, paused, today } = input;
  if (habit.source !== "manual" || habit.weeklyGoal != null || habit.days.length < 2) return null;

  const byDay = new Map<number, string[]>(habit.days.map((d) => [d, []]));
  for (let i = 1; i <= HARD_WINDOW_DAYS; i++) {
    const date = shiftDay(today, -i);
    if (date < habit.createdAt) break;
    if (paused.has(date) && !done.has(date)) continue;
    byDay.get(weekdayIndex(date))?.push(date); // newest first
  }

  for (const [weekday, dates] of byDay) {
    const recent = dates.slice(0, HABIT_DAY_RECENT);
    if (recent.length < HABIT_DAY_RECENT) continue;
    const missed = recent.filter((d) => !done.has(d)).length;
    if (missed < HABIT_DAY_MIN_MISSED) continue;
    const others = [...byDay.entries()].flatMap(([d, list]) => (d === weekday ? [] : list));
    if (others.length === 0) continue;
    if (others.filter((d) => done.has(d)).length / others.length < HABIT_OTHER_DAYS_MIN_RATE) continue;
    return {
      id: `hard-day-habit:${habit.id}:${weekday}`,
      feature: "hard-day",
      kind: "habit-day",
      priority: HABIT_DAY_PRIORITY,
      habitId: habit.id,
      habitName: habit.name,
      weekday,
      missed,
      recent: recent.length,
    };
  }
  return null;
}

export function habitDayCopy(offer: Pick<HabitDayOffer, "weekday" | "missed" | "recent">) {
  const day = weekdayName(offer.weekday);
  return {
    message: `You missed this on ${offer.missed} of the last ${offer.recent} ${day}s. Move it off ${day}s?`,
    source: `Counted from the days it was scheduled. Your other days are going well.`,
    accept: `Move it off ${day}s`,
    decline: "Keep it",
    done: `Off ${day}s`,
  };
}

// ── the words ───────────────────────────────────────────────────────

export function hardDayCopy(offer: Pick<HardDayOffer, "weekday" | "recent" | "missed">) {
  const day = weekdayName(offer.weekday);
  return {
    message: `${day}s are your toughest: you missed ${offer.missed} of the last ${offer.recent} planned workouts on a ${day}. Want a ${SHORT_MINUTES}-minute ${day}?`,
    source: `Your other training days are going well. This lasts ${SHORT_WEEKS} weeks, and the full session stays one tap away.`,
    accept: `Make ${day}s short`,
    decline: "Keep as is",
    done: `${day}s are ${SHORT_MINUTES} minutes for ${SHORT_WEEKS} weeks`,
  };
}

export function reviewCopy(review: Pick<ShortReview, "weekday" | "planned" | "done">) {
  const day = weekdayName(review.weekday);
  const went = review.planned > 0 && review.done * 2 >= review.planned;
  return {
    message: went
      ? `${day}s have gone better: ${review.done} of the last ${review.planned}. Keep them short?`
      : `Short ${day}s: ${review.done} of the last ${review.planned} done. Keep them short?`,
    source: `Counted from the ${day}s you had a workout planned, these last ${SHORT_WEEKS} weeks.`,
    accept: "Keep them short",
    decline: "Back to full",
  };
}

/** The headline and per-move note on a short day's session. */
export function shortSessionReason(weekday: number): { headline: string; dose: string } {
  const day = weekdayName(weekday);
  return { headline: `A short ${day}, as you asked`, dose: `Trimmed for your short ${day}s` };
}

// ── storage ─────────────────────────────────────────────────────────

export async function loadPlannedDays(): Promise<PlannedDays> {
  try {
    const raw = await readJSON<PlannedDays>(PLANNED_DAYS_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

let logged = false;

/**
 * Write the week's plan into the record, when it is this week's. Called
 * whenever the plan or the day changes. Never throws — the worst case is a day
 * that isn't counted.
 */
export async function recordPlanWeek(
  plan: Pick<GeneratedWorkoutPlan, "weekStart" | "sessions"> | null,
  now: Date = new Date(),
): Promise<void> {
  if (!plan?.weekStart) return;
  const today = toLocalDateString(now);
  const monday = shiftDay(today, -weekdayIndex(today));
  if (plan.weekStart !== monday) return;
  try {
    const before = await loadPlannedDays();
    const next = withPlanWeek(before, plan, today, now);
    if (JSON.stringify(next) !== JSON.stringify(before)) await writeJSON(PLANNED_DAYS_KEY, next);
  } catch (e) {
    if (!logged) {
      logged = true;
      console.log("[smart] could not record the planned days:", e instanceof Error ? e.message : String(e));
    }
  }
}

type Listener = (list: ShortWeekday[]) => void;
const listeners = new Set<Listener>();

export function subscribeShortWeekdays(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function loadShortWeekdays(): Promise<ShortWeekday[]> {
  try {
    const raw = await readJSON<unknown>(SHORT_WEEKDAYS_KEY, []);
    return Array.isArray(raw)
      ? raw.filter((s): s is ShortWeekday => !!s && typeof s.id === "string" && typeof s.since === "string")
      : [];
  } catch {
    return [];
  }
}

async function saveShort(next: ShortWeekday[]): Promise<void> {
  await writeJSON(SHORT_WEEKDAYS_KEY, next);
  for (const fn of [...listeners]) {
    try {
      fn(next);
    } catch {
      // one bad listener must not stop the others
    }
  }
}

/** Make a weekday short for the next {@link SHORT_WEEKS} weeks, starting now. */
export async function makeWeekdayShort(weekday: number, now: Date = new Date()): Promise<void> {
  const today = toLocalDateString(now);
  const list = await loadShortWeekdays();
  const id = `short:${weekday}`;
  const row: ShortWeekday = {
    id,
    weekday,
    since: today,
    until: shiftDay(today, SHORT_WEEKS * 7 - 1),
    updatedAt: now.toISOString(),
  };
  await saveShort([...list.filter((s) => s.id !== id), row]);
}

/** Back to the full session on that weekday (a tombstone, so it travels). */
export async function endWeekdayShort(weekday: number, now: Date = new Date()): Promise<void> {
  const list = await loadShortWeekdays();
  const id = `short:${weekday}`;
  const prior = list.find((s) => s.id === id);
  if (!prior) return;
  await saveShort([
    ...list.filter((s) => s.id !== id),
    { ...prior, deleted: true, updatedAt: now.toISOString() },
  ]);
}

/** Whole days until `until`, for a screen that wants to say how long is left. */
export function daysLeft(until: string, today: string): number {
  return Math.max(0, daysFrom(today, until));
}
