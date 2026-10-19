/**
 * services/cycle/patterns.ts — what HER cycle shows, from her own logs.
 *
 * This is the part a period app can't do. Flo and Clue only see what you log in
 * them; welliva also holds her mood check-ins, her sleep and her training, so it
 * can line all of it up against her cycle:
 *
 *   timing   — when a symptom tends to arrive ("cramps on days 1–2", "headaches
 *              1–2 days before your period")
 *   mood     — whether her Mind check-ins run lower before her period
 *   sleep    — whether she sleeps less in the nights before it
 *   training — whether she trains less in the first days of her period, or
 *              keeps going through it
 *   trend    — cycles drifting steadily longer or shorter
 *
 * THE STANDARD (welliva-no-cosmetic-counters): every pattern states its exact
 * scope — "in 3 of your last 4 cycles" — counted over COMPLETED cycles only,
 * and the denominator is the cycles she actually logged in, never the ones she
 * didn't. A pattern needs at least two cycles behind it; one month is an
 * anecdote. Nothing here says why: a pattern is a timing, not a cause.
 */

import { addDays, daysBetween } from "./dates";
import { STATS_WINDOW, type CycleRecord } from "./predict";
import {
  isEmptyDayLog,
  SYMPTOMS,
  SYMPTOM_LABEL,
  type CycleDayLog,
  type CycleDays,
  type Symptom,
} from "./types";

export type PatternKind = "timing" | "mood" | "sleep" | "training" | "trend";

/**
 * Where a timing pattern sits. `start`: days of the period, 1 = its first day.
 * `next`: days before the next period, -1 = the day before. `lo` ≤ `hi`.
 */
export interface TimingWindow {
  anchor: "start" | "next";
  lo: number;
  hi: number;
}

export interface CyclePattern {
  id: string;
  kind: PatternKind;
  icon: string;
  title: string;
  body: string;
  /** "3 of your last 4 cycles" — the honest denominator. */
  scope: string;
  /** Timing patterns only. */
  subject?: Subject;
  window?: TimingWindow;
  /** Cycles that showed it, for ranking. */
  hits: number;
  observed: number;
}

/** Everything a timing pattern can be about. */
export type Subject = Symptom | "low_energy" | "low_mood";

export const SUBJECT_LABEL: Record<Subject, string> = {
  ...SYMPTOM_LABEL,
  headache: "Headaches",
  low_energy: "Low energy",
  low_mood: "Low moods",
};

const SUBJECT_ICON: Partial<Record<Subject, string>> = {
  cramps: "flash-outline",
  headache: "medkit-outline",
  low_energy: "battery-dead-outline",
  low_mood: "cloud-outline",
  cravings: "ice-cream-outline",
  bloating: "ellipse-outline",
};

function hits(subject: Subject, log: CycleDayLog | undefined): boolean {
  if (!log) return false;
  if (subject === "low_energy") return log.energy === "low";
  if (subject === "low_mood") {
    return log.mood === "low" || log.mood === "irritable" || log.mood === "anxious";
  }
  return !!log.symptoms?.includes(subject);
}

/** The completed cycles a pattern may be read from: the most recent six that count. */
export function patternCycles(cycles: readonly CycleRecord[]): CycleRecord[] {
  return cycles.filter((c) => c.status === "counted").slice(-STATS_WINDOW);
}

/** Did she log anything at all during this cycle? Unlogged cycles prove nothing. */
function loggedIn(c: CycleRecord, days: CycleDays): boolean {
  for (let i = 0; i < c.length; i += 1) {
    if (!isEmptyDayLog(days[addDays(c.start, i)])) return true;
  }
  return false;
}

export function describeWindow(w: TimingWindow): string {
  if (w.anchor === "start") {
    return w.lo === w.hi ? `on day ${w.lo} of your period` : `on days ${w.lo}–${w.hi} of your period`;
  }
  const near = -w.hi;
  const far = -w.lo;
  if (near === far) return near === 1 ? "the day before your period" : `${near} days before your period`;
  return `${near}–${far} days before your period`;
}

/**
 * The denominator, said exactly: "your last 3 cycles" only when she logged in
 * every one of them; otherwise it names the cycles she logged in, because the
 * unlogged ones were never evidence either way.
 */
function scopeLine(hitCount: number, observed: number, pool: number): string {
  return observed === pool
    ? `${hitCount} of your last ${observed} cycles`
    : `${hitCount} of the ${observed} recent cycles you logged in`;
}

/**
 * When `subject` tends to come, if it comes at a consistent time.
 *
 * Every window of one to three days, anchored to the period's start or to the
 * next period, is scored by how many logged cycles had the subject inside it.
 * The tightest window that holds it in at least 60% of those cycles — and at
 * least half of every logged occurrence, so "cramps all month" never reads as
 * "cramps on day 1" — is the pattern.
 */
export function timingPattern(
  subject: Subject,
  cycles: readonly CycleRecord[],
  days: CycleDays,
): CyclePattern | null {
  const pool = patternCycles(cycles);
  const observed = pool.filter((c) => loggedIn(c, days));
  if (observed.length < 2) return null;

  // Per cycle: the offsets (both anchors) on which the subject was logged.
  const perCycle = observed.map((c) => {
    const start = new Set<number>();
    const next = new Set<number>();
    let total = 0;
    for (let i = 0; i < c.length; i += 1) {
      const date = addDays(c.start, i);
      if (!hits(subject, days[date])) continue;
      total += 1;
      if (i < 7) start.add(i + 1);
      const before = daysBetween(c.nextStart, date); // negative
      if (before >= -7 && i >= 7) next.add(before);
    }
    return { start, next, total };
  });
  const totalDays = perCycle.reduce((s, c) => s + c.total, 0);
  if (totalDays === 0) return null;

  type Candidate = { w: TimingWindow; hits: number; inside: number; width: number };
  const candidates: Candidate[] = [];
  const consider = (w: TimingWindow) => {
    let hitCount = 0;
    let inside = 0;
    for (const c of perCycle) {
      const set = w.anchor === "start" ? c.start : c.next;
      let any = false;
      for (let o = w.lo; o <= w.hi; o += 1) {
        if (set.has(o)) {
          any = true;
          inside += 1;
        }
      }
      if (any) hitCount += 1;
    }
    candidates.push({ w, hits: hitCount, inside, width: w.hi - w.lo });
  };
  for (let width = 0; width <= 2; width += 1) {
    for (let lo = 1; lo + width <= 7; lo += 1) consider({ anchor: "start", lo, hi: lo + width });
    for (let hi = -1; hi - width >= -7; hi -= 1) consider({ anchor: "next", lo: hi - width, hi });
  }

  // Among the windows that catch it in the most cycles: the narrowest that holds
  // at least 80% of every logged occurrence ("days 1–2", not "day 1", when she
  // logs it on both), else the one that holds the most, narrowest first.
  const maxHits = Math.max(...candidates.map((c) => c.hits));
  const top = candidates
    .filter((c) => c.hits === maxHits)
    .sort((a, b) => a.width - b.width || b.inside - a.inside);
  const found =
    top.find((c) => c.inside >= 0.8 * totalDays) ??
    [...top].sort((a, b) => b.inside - a.inside || a.width - b.width)[0];
  if (!found) return null;
  if (found.hits < 2 || found.hits < 0.6 * observed.length) return null;
  if (found.inside < 0.5 * totalDays) return null;

  const label = SUBJECT_LABEL[subject];
  const where = describeWindow(found.w);
  const scope = scopeLine(found.hits, observed.length, pool.length);
  const verb =
    subject === "low_energy"
      ? `Your energy has dipped ${where}`
      : subject === "low_mood"
        ? `You've logged low moods ${where}`
        : `You've logged ${label.toLowerCase()} ${where}`;
  return {
    id: `timing:${subject}`,
    kind: "timing",
    icon: SUBJECT_ICON[subject] ?? "pulse-outline",
    title: subject === "low_energy" ? `Energy dips ${where}` : `${label} ${where}`,
    body: `${verb} in ${scope}.`,
    scope,
    subject,
    window: found.w,
    hits: found.hits,
    observed: observed.length,
  };
}

export const TIMING_SUBJECTS: readonly Subject[] = [...SYMPTOMS, "low_energy", "low_mood"];

/** Every timing pattern she has, strongest first. */
export function timingPatterns(cycles: readonly CycleRecord[], days: CycleDays): CyclePattern[] {
  return TIMING_SUBJECTS.map((s) => timingPattern(s, cycles, days))
    .filter((p): p is CyclePattern => p !== null)
    .sort((a, b) => b.hits / b.observed - a.hits / a.observed || b.hits - a.hits);
}

/* ───────────────────────── mood & sleep (from Mind) ───────────────────────── */

export interface MindPoint {
  date: string;
  /** −1 … +1, the Mind check-in's valence. */
  valence: number | null;
  sleepHours: number | null;
}

const BEFORE_WINDOW = 5;

interface Compare {
  diffs: number[];
}

/** Per cycle: the mean in the 5 days before the next period minus the mean of the rest. */
function compareBeforePeriod(
  cycles: readonly CycleRecord[],
  byDate: Map<string, number>,
  minBefore: number,
  minRest: number,
): Compare {
  const diffs: number[] = [];
  for (const c of patternCycles(cycles)) {
    const before: number[] = [];
    const rest: number[] = [];
    for (let i = 0; i < c.length; i += 1) {
      const date = addDays(c.start, i);
      const v = byDate.get(date);
      if (v === undefined) continue;
      if (daysBetween(date, c.nextStart) <= BEFORE_WINDOW) before.push(v);
      else rest.push(v);
    }
    if (before.length >= minBefore && rest.length >= minRest) {
      const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      diffs.push(mean(before) - mean(rest));
    }
  }
  return { diffs };
}

function consistent(diffs: number[], threshold: number): -1 | 1 | 0 {
  if (diffs.length < 2) return 0;
  const allDown = diffs.every((d) => d < 0);
  const allUp = diffs.every((d) => d > 0);
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  if (allDown && mean <= -threshold) return -1;
  if (allUp && mean >= threshold) return 1;
  return 0;
}

export function moodPattern(cycles: readonly CycleRecord[], mind: readonly MindPoint[]): CyclePattern | null {
  const byDate = new Map<string, number>();
  for (const p of mind) if (p.valence !== null && Number.isFinite(p.valence)) byDate.set(p.date, p.valence);
  const { diffs } = compareBeforePeriod(cycles, byDate, 2, 4);
  const dir = consistent(diffs, 0.2);
  if (!dir) return null;
  const n = diffs.length;
  const scope = `${n} of ${n} cycles with enough check-ins`;
  return {
    id: "mood",
    kind: "mood",
    icon: "happy-outline",
    title: dir < 0 ? "Mood dips before your period" : "Mood lifts before your period",
    body: `Your mood check-ins have run ${dir < 0 ? "lower" : "higher"} in the ${BEFORE_WINDOW} days before your period than the rest of your cycle (${scope}).`,
    scope,
    hits: n,
    observed: n,
  };
}

export function sleepPattern(cycles: readonly CycleRecord[], mind: readonly MindPoint[]): CyclePattern | null {
  const byDate = new Map<string, number>();
  for (const p of mind) {
    if (p.sleepHours !== null && Number.isFinite(p.sleepHours) && p.sleepHours > 0) {
      byDate.set(p.date, p.sleepHours);
    }
  }
  const { diffs } = compareBeforePeriod(cycles, byDate, 2, 4);
  const dir = consistent(diffs, 0.5);
  if (!dir) return null;
  const n = diffs.length;
  const mean = diffs.reduce((s, d) => s + d, 0) / n;
  const minutes = Math.round((Math.abs(mean) * 60) / 5) * 5;
  const scope = `${n} of ${n} cycles with sleep logged`;
  return {
    id: "sleep",
    kind: "sleep",
    icon: "moon-outline",
    title: dir < 0 ? "Less sleep before your period" : "More sleep before your period",
    body: `You've slept about ${minutes} minutes ${dir < 0 ? "less" : "more"} a night in the ${BEFORE_WINDOW} nights before your period (${scope}).`,
    scope,
    hits: n,
    observed: n,
  };
}

/* ───────────────────────────── training ───────────────────────────── */

export interface WorkoutPoint {
  date: string;
}

const EARLY_DAYS = 3;

export function trainingPattern(
  cycles: readonly CycleRecord[],
  workouts: readonly WorkoutPoint[],
): CyclePattern | null {
  const recent = patternCycles(cycles);
  if (recent.length < 2) return null;
  const trained = new Set(workouts.map((w) => w.date));
  let earlyDays = 0;
  let earlyTrained = 0;
  let otherDays = 0;
  let otherTrained = 0;
  for (const c of recent) {
    for (let i = 0; i < c.length; i += 1) {
      const date = addDays(c.start, i);
      if (i < EARLY_DAYS) {
        earlyDays += 1;
        if (trained.has(date)) earlyTrained += 1;
      } else {
        otherDays += 1;
        if (trained.has(date)) otherTrained += 1;
      }
    }
  }
  if (earlyTrained + otherTrained < 6 || otherDays === 0) return null;
  const otherRate = otherTrained / otherDays;
  const earlyRate = earlyTrained / earlyDays;
  const perWeek = Math.round(otherRate * 7);
  if (otherRate < 1 / 7) return null;
  const n = recent.length;
  const scope = `your last ${n} periods`;
  if (earlyRate <= otherRate * 0.5) {
    return {
      id: "training",
      kind: "training",
      icon: "barbell-outline",
      title: "You train less early in your period",
      body: `Across ${scope} you trained on ${earlyTrained} of the ${earlyDays} first three days, against about ${perWeek} days a week otherwise. Your plan eases off on any day you log cramps or a heavy flow.`,
      scope,
      hits: n,
      observed: n,
    };
  }
  if (earlyTrained >= 3 && earlyRate >= otherRate * 0.9) {
    return {
      id: "training",
      kind: "training",
      icon: "barbell-outline",
      title: "You keep training through your period",
      body: `Across ${scope} you trained on ${earlyTrained} of the ${earlyDays} first three days, the same rhythm as the rest of your cycle.`,
      scope,
      hits: n,
      observed: n,
    };
  }
  return null;
}

/* ───────────────────────────── trend ───────────────────────────── */

export function trendPattern(cycles: readonly CycleRecord[]): CyclePattern | null {
  const last = cycles.filter((c) => c.status === "counted").slice(-4).map((c) => c.length);
  if (last.length < 4) return null;
  const rising = last.every((l, i) => i === 0 || l > last[i - 1]);
  const falling = last.every((l, i) => i === 0 || l < last[i - 1]);
  if ((!rising && !falling) || Math.abs(last[3] - last[0]) < 4) return null;
  return {
    id: "trend",
    kind: "trend",
    icon: rising ? "trending-up-outline" : "trending-down-outline",
    title: rising ? "Your cycles are getting longer" : "Your cycles are getting shorter",
    body: `Your last 4 cycles have got steadily ${rising ? "longer" : "shorter"}: ${last.join(", ")} days. Worth keeping an eye on, and worth mentioning if it carries on.`,
    scope: "your last 4 cycles",
    hits: 4,
    observed: 4,
  };
}

/** Everything, strongest first: timing patterns, then the cross-domain reads, then the trend. */
export function allPatterns(input: {
  cycles: readonly CycleRecord[];
  days: CycleDays;
  mind?: readonly MindPoint[];
  workouts?: readonly WorkoutPoint[];
}): CyclePattern[] {
  const out: CyclePattern[] = [...timingPatterns(input.cycles, input.days).slice(0, 4)];
  if (input.mind) {
    const mood = moodPattern(input.cycles, input.mind);
    if (mood) out.push(mood);
    const sleep = sleepPattern(input.cycles, input.mind);
    if (sleep) out.push(sleep);
  }
  if (input.workouts) {
    const training = trainingPattern(input.cycles, input.workouts);
    if (training) out.push(training);
  }
  const trend = trendPattern(input.cycles);
  if (trend) out.push(trend);
  return out;
}
