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
 *   weight   — whether her weight rises before her period and settles after it
 *
 * THE STANDARD (welliva-no-cosmetic-counters): every pattern states its exact
 * scope — "in 3 of your last 4 cycles" — counted over COMPLETED cycles only,
 * and the denominator is the cycles she actually logged in, never the ones she
 * didn't. A pattern needs at least two cycles behind it; one month is an
 * anecdote. Nothing here says why: a pattern is a timing, not a cause.
 */

import { addDays, daysBetween, minDate } from "./dates";
import { median, STATS_WINDOW, type CycleRecord } from "./predict";
import {
  isEmptyDayLog,
  SYMPTOMS,
  SYMPTOM_LABEL,
  type CycleDayLog,
  type CycleDays,
  type Flow,
  type Symptom,
} from "./types";

export type PatternKind = "timing" | "mood" | "sleep" | "training" | "trend" | "weight";

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
  /** Training pattern only: does she keep going, or ease off, early in a period? */
  trainingHabit?: "keeps" | "eases";
  /** Weight pattern only: the typical rise, and the period day it has usually gone by. */
  riseKg?: number;
  settledByDay?: number | null;
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

/* ───────────────────────────── weight ───────────────────────────── */

export interface WeighInPoint {
  date: string;
  kg: number;
}

/** Her weight before anything premenstrual: cycle days 6 to 12, past the period. */
export const WEIGHT_BASE_FIRST_DAY = 6;
export const WEIGHT_BASE_LAST_DAY = 12;
/** In a short cycle the baseline stops this many days before the next start, clear of the rise. */
const WEIGHT_BASE_STOP_BEFORE = 8;
/** The rise is read from this many days before the next start... */
export const WEIGHT_PRE_DAYS = 5;
/** ...through this day of the period itself. */
export const WEIGHT_PRE_THROUGH_DAY = 2;
/** Weigh-ins needed in EACH of those two stretches, or the cycle is not evidence either way. */
export const WEIGHT_MIN_READINGS = 2;
/** A rise this size is more than day-to-day scale noise (the filter's own σ is 0.5 kg). */
export const WEIGHT_JUMP_KG = 0.5;
/** "Gone" = back within this of her baseline: a reading can't be asked to land exactly on it. */
const WEIGHT_SETTLED_KG = 0.3;
/** "Gone by day N" is read from this day of the period; before it she's still in the rise. */
const WEIGHT_SETTLE_FROM_DAY = 3;
/** ...and no later than this: past it, a lower reading is no longer about this period. */
const WEIGHT_SETTLE_LAST_DAY = 10;
/** Cycles that must show the rise, and that must know when it settled, before either is said. */
export const WEIGHT_MIN_CYCLES = 2;
/**
 * And the rise must show in at least half the cycles that could have shown it:
 * "most likely water" can't rest on 2 of 6. Stricter than the two-cycle floor
 * alone, for the same reason timing patterns ask for 60%.
 */
export const WEIGHT_MIN_SHARE = 0.5;

/** Cycle days 6–12 of the cycle running from `start` to `nextStart`. */
export function weightBaseSpan(start: string, nextStart: string): { from: string; to: string } {
  return {
    from: addDays(start, WEIGHT_BASE_FIRST_DAY - 1),
    to: minDate(addDays(start, WEIGHT_BASE_LAST_DAY - 1), addDays(nextStart, -WEIGHT_BASE_STOP_BEFORE)),
  };
}

/** The 5 days before `nextStart`, through day 2 of that period. */
export function weightPreSpan(nextStart: string): { from: string; to: string } {
  return { from: addDays(nextStart, -WEIGHT_PRE_DAYS), to: addDays(nextStart, WEIGHT_PRE_THROUGH_DAY - 1) };
}

/**
 * Does her weight rise before her period and settle after it? Completed cycles
 * only, and the denominator is the cycles with enough weigh-ins, never the ones
 * without.
 *
 * A SLOW GAIN IS NOT A MONTHLY RISE. Someone gaining 0.2 kg a week reads half a
 * kilo higher before every period from the trend alone, and telling her that is
 * "most likely water" would be false. So where the NEXT cycle's baseline is known,
 * each cycle is read against the line between the two baselines; only a bump that
 * sits above that line and comes back down to it counts. (The latest cycle has no
 * next baseline yet and is read against its own, which alone can't reach the
 * two-cycle gate.) A steady loss hiding a real rise is found the same way.
 */
export function weightPattern(
  cycles: readonly CycleRecord[],
  weighIns: readonly WeighInPoint[],
): CyclePattern | null {
  const kgOn = new Map<string, number>();
  for (const w of weighIns) if (Number.isFinite(w.kg) && w.kg > 0) kgOn.set(w.date, w.kg);
  const readings = (span: { from: string; to: string }) =>
    [...kgOn].filter(([d]) => d >= span.from && d <= span.to);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  let observed = 0;
  const rises: number[] = [];
  const settled: number[] = [];
  for (const c of patternCycles(cycles)) {
    const base = readings(weightBaseSpan(c.start, c.nextStart));
    const pre = readings(weightPreSpan(c.nextStart));
    if (base.length < WEIGHT_MIN_READINGS || pre.length < WEIGHT_MIN_READINGS) continue;
    observed += 1;

    // Her expected weight on a date: the baseline, carried along her trend if known.
    const kgOf = (rs: [string, number][]) => mean(rs.map(([, kg]) => kg));
    const dayOf = (rs: [string, number][]) => mean(rs.map(([d]) => daysBetween(c.start, d)));
    const baseKg = kgOf(base);
    const baseDay = dayOf(base);
    const next = readings(weightBaseSpan(c.nextStart, addDays(c.nextStart, c.length)));
    const perDay = next.length >= WEIGHT_MIN_READINGS ? (kgOf(next) - baseKg) / (dayOf(next) - baseDay) : 0;
    const expected = (date: string) => baseKg + perDay * (daysBetween(c.start, date) - baseDay);

    const rise = mean(pre.map(([d, kg]) => kg - expected(d)));
    if (rise < WEIGHT_JUMP_KG) continue;
    rises.push(rise);
    for (let day = WEIGHT_SETTLE_FROM_DAY; day <= WEIGHT_SETTLE_LAST_DAY; day += 1) {
      const date = addDays(c.nextStart, day - 1);
      const kg = kgOn.get(date);
      if (kg !== undefined && kg - expected(date) <= WEIGHT_SETTLED_KG) {
        settled.push(day);
        break;
      }
    }
  }
  const hitCount = rises.length;
  if (hitCount < WEIGHT_MIN_CYCLES || hitCount < WEIGHT_MIN_SHARE * observed) return null;

  const riseKg = Math.round(median(rises) * 10) / 10;
  const settledByDay = settled.length >= WEIGHT_MIN_CYCLES ? Math.ceil(median(settled)) : null;
  const scope = `${hitCount} of your last ${observed} cycles with enough weigh-ins`;
  return {
    id: "weight",
    kind: "weight",
    icon: "scale-outline",
    title: "Your weight rises before your period",
    body: `Your weight rises about ${riseKg} kg before your period${
      settledByDay ? ` and settles by day ${settledByDay}` : ""
    }, in ${scope}.`,
    scope,
    riseKg,
    settledByDay,
    hits: hitCount,
    observed,
  };
}

/* ───────────────────────────── the heaviest day ───────────────────────────── */

const FLOW_RANK: Record<Flow, number> = { spotting: 0, light: 1, medium: 2, heavy: 3 };
/** Only the first days of a cycle can be its bleed's heaviest. */
const HEAVIEST_WITHIN_DAYS = 7;

export interface HeaviestDay {
  /** 1 = the first day of her period. */
  day: number;
  hits: number;
  observed: number;
  /** "On your last 3 periods, day 2 was your heaviest day." */
  line: string;
}

/**
 * Which day of her period is usually heaviest, if one consistently is. A cycle
 * counts only when she logged flow on at least two of its days (one logged day
 * can't show which was heaviest), and a cycle with a tie for heaviest counts in
 * the denominator without voting for a day.
 */
export function heaviestDayPattern(cycles: readonly CycleRecord[], days: CycleDays): HeaviestDay | null {
  const pool = patternCycles(cycles);
  const votes = new Map<number, number>();
  let observed = 0;
  for (const c of pool) {
    const flows: { day: number; rank: number }[] = [];
    for (let i = 0; i < Math.min(c.length, HEAVIEST_WITHIN_DAYS); i += 1) {
      const flow = days[addDays(c.start, i)]?.flow;
      if (flow) flows.push({ day: i + 1, rank: FLOW_RANK[flow] });
    }
    if (flows.length < 2) continue;
    observed += 1;
    const top = Math.max(...flows.map((f) => f.rank));
    const peak = flows.filter((f) => f.rank === top);
    if (peak.length === 1) votes.set(peak[0].day, (votes.get(peak[0].day) ?? 0) + 1);
  }
  if (observed < 2) return null;

  let day = 0;
  let hitCount = 0;
  let tied = false;
  for (const [d, n] of votes) {
    if (n > hitCount) {
      day = d;
      hitCount = n;
      tied = false;
    } else if (n === hitCount) {
      tied = true;
    }
  }
  if (tied || hitCount < 2 || hitCount < 0.6 * observed) return null;

  const scope = observed === pool.length ? `your last ${observed} periods` : `the ${observed} recent periods you logged flow in`;
  return {
    day,
    hits: hitCount,
    observed,
    line:
      hitCount === observed
        ? `On ${scope}, day ${day} was your heaviest day.`
        : `On ${hitCount} of ${scope}, day ${day} was your heaviest day.`,
  };
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
      trainingHabit: "eases",
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
      trainingHabit: "keeps",
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
  /** Already read by the view (`weightPattern`), so both say the same thing. */
  weight?: CyclePattern | null;
}): CyclePattern[] {
  const out: CyclePattern[] = [...timingPatterns(input.cycles, input.days).slice(0, 4)];
  if (input.weight) out.push(input.weight);
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
