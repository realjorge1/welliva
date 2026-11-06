/**
 * services/smart/goodDays.ts
 *
 * WHAT YOUR GOOD DAYS HAVE IN COMMON — "in 7 of your 10 best days, you trained
 * before noon. On your other days: 3 of 22."
 *
 * The one feature that holds a person's days up against each other, so it has
 * the strictest bar in the app:
 *
 *   · A DAY'S SCORE IS WHAT THEY SAID: the average of that day's Mind check-ins.
 *     A day without one is left out. A gap is not "neutral".
 *   · ONLY FINISHED DAYS. Today's habits aren't done yet, so today can't be read.
 *   · A ROUGH DAY ISN'T COUNTED. The app told them to take it easy, and it would
 *     be unfair to then report that they didn't train.
 *   · UNKNOWN IS NOT NO. Each behaviour reads yes, no or "can't be known" per day,
 *     and a day it can't be known is out of both its numbers. The card says so
 *     whenever that left days out.
 *   · A TIE CAN'T BE SPLIT HONESTLY. Days level with the cut-off are all best
 *     days; if that swallows over half the days, "best" means nothing and this
 *     stays silent.
 *   · BOTH NUMBERS, EXACT, ALWAYS, and always "A pattern, not a cause."
 *   · NOTHING PASSES, NOTHING SHOWN. Below the gate there is no finding at all.
 *
 * Pure: no storage, no React. `today` is always passed in.
 */
import type { DietHistoryEntry } from "../../models/diet";
import type { Habit } from "../../models/habit";
import type { WorkoutLogEntry } from "../../models/workout";
import type { WaterHistoryEntry } from "../OfflineStorage";
import { shiftDay, weekdayIndex } from "../commitment";
import { findingKey, type InsightEntry } from "../gozlin/InsightLedger";
import type { GozlinCheckin } from "../gozlin/gozlin.types";
import { readEntryValence } from "../gozlin/mind";
import type { IntakeLedger } from "../nutrition/IntakeLedger";
import type { LogStore } from "../nutrition/foodLogStore";
import { clockLabel, wallClockOf } from "../routine/clock";
import { mealSlotSamples } from "../routine/sources";
import { daysFrom } from "./arbiter";

/** How far back it looks. Two months: long enough to compare, recent enough to be true. */
export const GOOD_DAYS_WINDOW_DAYS = 60;

/** Fewer check-in days than three weeks' worth and it stays silent. */
export const GOOD_DAYS_MIN_SCORED = 21;

/** "Best days" are the top quarter of scored days. */
export const BEST_DAYS_SHARE = 0.25;

/** Fewer best days than this is an anecdote. */
export const BEST_DAYS_MIN = 6;

/** It must have happened on at least 60% of the best days it can be known for. */
export const MIN_BEST_RATE = 0.6;

/** And at a rate at least 25 percentage points lower on the other days. */
export const MIN_GAP = 0.25;

/** And on at least four best days, whatever the rate says. */
export const MIN_BEST_YES = 4;

/** Comparing against a handful of days compares against nothing. */
export const MIN_OTHER_DAYS = 6;

/** Shown at most, biggest gap first. */
export const MAX_FINDINGS = 3;

/** One new finding a week, however many pass. */
export const NEW_FINDING_EVERY_DAYS = 7;

export const NOON_MINUTE = 12 * 60;

/** "Logged dinner before 8 PM". */
export const DINNER_BEFORE_MINUTE = 20 * 60;

/** A dinner logged before mid-afternoon was ticked ahead: it says nothing about when. */
export const DINNER_EARLIEST_MINUTE = 15 * 60;

/** Slept this many hours or more. */
export const SLEEP_HOURS = 7;

/** At most weekly, so it outranks a daily "your usual?", which can be logged from Diet. */
export const GOOD_DAYS_PRIORITY = 52;

export const GOOD_DAYS_PREFIX = "good-days:";

/** Said wherever a finding is shown. */
export const PATTERN_NOT_CAUSE = "A pattern, not a cause.";

/** Averages of the same answers can differ in the last bit; that isn't a difference. */
const EPSILON = 1e-9;

export interface GoodDaysHabit extends Pick<Habit, "id" | "name" | "days" | "weeklyGoal" | "createdAt"> {
  done: ReadonlySet<string>;
}

export interface GoodDaysInput {
  today: string;
  checkins: readonly GozlinCheckin[];
  workouts: readonly WorkoutLogEntry[];
  waterHistory: readonly WaterHistoryEntry[];
  dietHistory: readonly DietHistoryEntry[];
  intake: IntakeLedger;
  foodLog: LogStore;
  /** The user's own active habits (not the ones derived from water, meals…). */
  habits: readonly GoodDaysHabit[];
  /** Days marked rough, protected or not. */
  roughDates?: ReadonlySet<string>;
  /** Findings they said aren't them. */
  dismissed?: ReadonlySet<string>;
}

export interface GoodDayFinding {
  /** Stable: what it is about, never its numbers. */
  id: string;
  /** "you trained before noon" */
  phrase: string;
  bestYes: number;
  bestKnown: number;
  otherYes: number;
  otherKnown: number;
  /** Rate on best days minus rate on other days, 0–1. */
  gap: number;
  /** Set only when days really were left out of the counts. */
  scope: string | null;
}

export interface GoodDaysReport {
  windowDays: number;
  /** Days with a check-in that were read. */
  scoredDays: number;
  bestDays: number;
  /** Biggest gap first, at most {@link MAX_FINDINGS}. Often empty. */
  findings: GoodDayFinding[];
}

/** Yes, no, or null when it can't be known that day. */
type DayReading = boolean | null;

interface Behaviour {
  id: string;
  phrase: string;
  /** What the card says if this behaviour couldn't be known on every day. */
  scope: string;
  read: (date: string) => DayReading;
}

/** Each finished day's average mood, over the window. */
export function scoreDays(
  checkins: readonly GozlinCheckin[],
  today: string,
  roughDates: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const floor = shiftDay(today, -GOOD_DAYS_WINDOW_DAYS);
  const sums = new Map<string, { sum: number; n: number }>();
  for (const c of checkins ?? []) {
    if (!c?.date || c.date < floor || c.date >= today || roughDates.has(c.date)) continue;
    const v = readEntryValence(c);
    if (v === null) continue;
    const prev = sums.get(c.date) ?? { sum: 0, n: 0 };
    sums.set(c.date, { sum: prev.sum + v, n: prev.n + 1 });
  }
  const out = new Map<string, number>();
  for (const [date, { sum, n }] of sums) out.set(date, sum / n);
  return out;
}

/** The top quarter and the rest, or null when "best" wouldn't mean anything. */
export function splitBestDays(
  scores: ReadonlyMap<string, number>,
): { best: string[]; others: string[] } | null {
  if (scores.size < GOOD_DAYS_MIN_SCORED) return null;
  const ranked = [...scores.values()].sort((a, b) => b - a);
  const wanted = Math.ceil(ranked.length * BEST_DAYS_SHARE);
  if (wanted < BEST_DAYS_MIN) return null;
  const cutoff = ranked[wanted - 1];
  const best: string[] = [];
  const others: string[] = [];
  for (const [date, score] of scores) (score >= cutoff - EPSILON ? best : others).push(date);
  if (best.length > ranked.length / 2) return null;
  return { best, others };
}

/** Did this session start before noon? Null when its time can't be trusted. */
function startedBeforeNoon(w: WorkoutLogEntry): DayReading {
  const wall = wallClockOf(w.completedAt);
  if (!wall || wall.date !== w.date) return null;
  const length = w.durationMinutes > 0 ? w.durationMinutes : 0;
  const start = wall.minute - length;
  // Below zero it began last night, which is not the morning.
  return start >= 0 && start < NOON_MINUTE;
}

function candidateBehaviours(input: GoodDaysInput): Behaviour[] {
  const { checkins, workouts, waterHistory, dietHistory, intake, foodLog, habits } = input;

  const sessions = new Map<string, WorkoutLogEntry[]>();
  for (const w of workouts ?? []) {
    if (!w?.date || w.completionPercent === 0) continue;
    sessions.set(w.date, [...(sessions.get(w.date) ?? []), w]);
  }

  const water = new Map((waterHistory ?? []).map((e) => [e.date, e]));
  const diet = new Map((dietHistory ?? []).map((e) => [e.date, e]));

  const dinners = new Map<string, number>();
  for (const s of mealSlotSamples(intake, foodLog, "dinner")) {
    const wall = wallClockOf(s.at);
    // Logged another day, or hours ahead: a record of the tick, not of the meal.
    if (!wall || wall.date !== s.date || wall.minute < DINNER_EARLIEST_MINUTE) continue;
    const prev = dinners.get(s.date);
    if (prev === undefined || wall.minute < prev) dinners.set(s.date, wall.minute);
  }

  const sleep = new Map<string, { hours: number; at: number }>();
  for (const c of checkins ?? []) {
    if (!c?.date || typeof c.sleepHours !== "number" || !(c.sleepHours > 0)) continue;
    const prev = sleep.get(c.date);
    if (!prev || c.createdAt >= prev.at) sleep.set(c.date, { hours: c.sleepHours, at: c.createdAt });
  }

  const out: Behaviour[] = [
    {
      id: "trained",
      phrase: "you trained",
      scope: "",
      read: (d) => sessions.has(d),
    },
    {
      id: "trained-before-noon",
      phrase: "you trained before noon",
      scope: "Leaving out sessions without a clear time.",
      read: (d) => {
        const list = sessions.get(d);
        if (!list) return false;
        const readings = list.map(startedBeforeNoon);
        if (readings.includes(true)) return true;
        return readings.includes(null) ? null : false;
      },
    },
    {
      id: "water-goal",
      phrase: "you reached your water goal",
      scope: "Only counting days you logged water.",
      read: (d) => {
        const e = water.get(d);
        // A row without that day's goal can't say whether it was reached.
        return e && e.goalMl && e.goalMl > 0 ? e.ml >= e.goalMl : null;
      },
    },
    {
      id: "all-meals",
      phrase: "you ticked all your planned meals",
      scope: "Only counting days you had a meal plan.",
      read: (d) => {
        const e = diet.get(d);
        return e && e.totalMeals > 0 ? e.mealsConsumed >= e.totalMeals : null;
      },
    },
    {
      id: "dinner-early",
      phrase: `you logged dinner before ${clockLabel(DINNER_BEFORE_MINUTE)}`,
      scope: "Only counting days you logged dinner.",
      read: (d) => {
        const minute = dinners.get(d);
        return minute === undefined ? null : minute < DINNER_BEFORE_MINUTE;
      },
    },
    {
      id: "sleep",
      phrase: `you slept ${SLEEP_HOURS} hours or more`,
      scope: "Only counting days you recorded your sleep.",
      read: (d) => {
        const s = sleep.get(d);
        return s ? s.hours >= SLEEP_HOURS : null;
      },
    },
  ];

  if (habits.length > 0) {
    const since = habits.map((h) => h.createdAt).sort()[0];
    out.push({
      id: "any-habit",
      phrase: "you did at least one habit",
      scope: "Only counting days since you added your first habit.",
      read: (d) => (d < since ? null : habits.some((h) => h.done.has(d))),
    });
  }
  for (const h of habits) {
    const byQuota = h.weeklyGoal != null;
    out.push({
      id: `habit:${h.id}`,
      phrase: `you did “${h.name}”`,
      scope: byQuota
        ? "Only counting days since you added this habit."
        : "Only counting days this habit was scheduled.",
      read: (d) => {
        if (d < h.createdAt) return null;
        // A day it wasn't asked for can't be held against it.
        if (!byQuota && !h.days.includes(weekdayIndex(d))) return null;
        return h.done.has(d);
      },
    });
  }
  return out;
}

function tally(days: readonly string[], read: (d: string) => DayReading): { yes: number; known: number } {
  let yes = 0;
  let known = 0;
  for (const d of days) {
    const r = read(d);
    if (r === null) continue;
    known++;
    if (r) yes++;
  }
  return { yes, known };
}

/** A finding already says the broader one: "before noon" says "trained". */
function saidByNarrower(f: GoodDayFinding, all: readonly GoodDayFinding[]): boolean {
  const key = f.id.slice(GOOD_DAYS_PREFIX.length);
  if (key === "trained") return all.some((o) => o.id === `${GOOD_DAYS_PREFIX}trained-before-noon`);
  if (key === "any-habit") return all.some((o) => o.id.startsWith(`${GOOD_DAYS_PREFIX}habit:`));
  return false;
}

/** The whole reading: null below the gate, and often no findings above it. */
export function readGoodDays(input: GoodDaysInput): GoodDaysReport | null {
  const scores = scoreDays(input.checkins, input.today, input.roughDates);
  const split = splitBestDays(scores);
  if (!split) return null;

  const passed: GoodDayFinding[] = [];
  for (const b of candidateBehaviours(input)) {
    const id = `${GOOD_DAYS_PREFIX}${b.id}`;
    if (input.dismissed?.has(id)) continue;
    const best = tally(split.best, b.read);
    const other = tally(split.others, b.read);
    if (best.yes < MIN_BEST_YES || other.known < MIN_OTHER_DAYS) continue;
    const bestRate = best.yes / best.known;
    const otherRate = other.yes / other.known;
    if (bestRate < MIN_BEST_RATE - EPSILON || bestRate - otherRate < MIN_GAP - EPSILON) continue;
    const allKnown = best.known + other.known === scores.size;
    passed.push({
      id,
      phrase: b.phrase,
      bestYes: best.yes,
      bestKnown: best.known,
      otherYes: other.yes,
      otherKnown: other.known,
      gap: bestRate - otherRate,
      scope: allKnown ? null : b.scope,
    });
  }

  const findings = passed
    .filter((f) => !saidByNarrower(f, passed))
    .sort((a, b) => b.gap - a.gap || b.bestYes - a.bestYes || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_FINDINGS);

  return {
    windowDays: GOOD_DAYS_WINDOW_DAYS,
    scoredDays: scores.size,
    bestDays: split.best.length,
    findings,
  };
}

/** The numbers, in a sentence: "In 7 of your 10 best days, you…. On your other days: 3 of 22." */
function countsSentence(f: GoodDayFinding): string {
  return (
    `in ${f.bestYes} of your ${f.bestKnown} best days, ${f.phrase}. ` +
    `On your other days: ${f.otherYes} of ${f.otherKnown}.`
  );
}

/** The whole line, as Memory lists it. */
export function goodDaySentence(f: GoodDayFinding): string {
  return `Your best days have something in common: ${countsSentence(f)}`;
}

const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The finding's heading in the sheet: "You trained before noon". */
export function goodDayHeading(f: GoodDayFinding): string {
  return capitalised(f.phrase);
}

/**
 * The finding as a Home insight card, and as the insight history keeps it. It
 * carries its own caveats, because a stored card is read again without the sheet.
 */
export function goodDayCard(f: GoodDayFinding) {
  return {
    id: f.id,
    type: "motivation" as const,
    tone: "positive" as const,
    icon: "sunny-outline",
    title: "Your best days have something in common",
    message: [capitalised(countsSentence(f)), f.scope, PATTERN_NOT_CAUSE].filter(Boolean).join(" "),
    priority: 8,
    identity: f.id,
  };
}

/** Which finding, if any, may arrive on Home today: one new one a week, never a repeat. */
export function nextGoodDay(
  findings: readonly GoodDayFinding[],
  ledger: readonly Pick<InsightEntry, "key" | "openedAt" | "card">[],
  today: string,
): GoodDayFinding | null {
  const openedThisWeek = ledger.some((e) => {
    if (!e.card.id.startsWith(GOOD_DAYS_PREFIX)) return false;
    const opened = wallClockOf(e.openedAt);
    return !!opened && daysFrom(opened.date, today) < NEW_FINDING_EVERY_DAYS;
  });
  if (openedThisWeek) return null;
  const seen = new Set(ledger.map((e) => e.key));
  return findings.find((f) => !seen.has(findingKey(f.id))) ?? null;
}
