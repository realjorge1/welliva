/**
 * services/routine/clock.ts
 *
 * THE ROUTINE CLOCK — "when does this person usually do X?", answered from the
 * times things were actually logged, and from nothing else.
 *
 * Every smart moment that names a time of day reads it here: a reminder that
 * offers to move to when the habit really happens, a "your usual breakfast?"
 * that appears around breakfast, a new habit tied to one that already has a
 * time. So the rules that keep those sentences honest live in one place:
 *
 *   · SAME-DAY RECORDS ONLY. A meal back-logged this morning for last night is
 *     a record of when the user remembered, not when they ate. A sample counts
 *     only when it was logged on the day it is for.
 *   · ONE READING PER DAY. Five foods logged at breakfast are one breakfast.
 *   · A GATE, NOT A GUESS. Below {@link ROUTINE_MIN_COUNT} days in the window
 *     there is no reading at all — `null`, never a premature time.
 *   · MIDNIGHT IS NOT AN EDGE. A habit done at 23:50 one night and 00:10 the
 *     next is one routine around midnight, not two habits twelve hours apart.
 *     The day is read as a circle and cut at its widest empty stretch.
 *   · A BUTTON PRESS IS NOT A HABIT. A tick from a reminder's own lock-screen
 *     button within {@link REMINDER_ECHO_MINUTES} of it firing happened because
 *     the phone buzzed. It measures the reminder, so it is left out of the time
 *     and counted separately, as evidence the reminder works.
 *
 * Pure: no storage, no React. `today` is always passed in.
 */
import { shiftDay } from "../commitment";

/** Three weeks: long enough to see a routine, short enough to follow a change in it. */
export const ROUTINE_WINDOW_DAYS = 21;

/** Fewer than eight days in three weeks is a coincidence, not a routine. */
export const ROUTINE_MIN_COUNT = 8;

/** A routine whose middle half fits inside an hour is one you could set a watch by. */
export const CONSISTENT_SPREAD_MINUTES = 60;

/** A button pressed this soon after its reminder fired was answering the reminder. */
export const REMINDER_ECHO_MINUTES = 15;

const DAY_MINUTES = 1440;

export interface RoutineSample {
  /** Local YYYY-MM-DD the thing was logged FOR. */
  date: string;
  /** ISO time it was logged — local with an offset, or UTC ("Z"). */
  at: string;
  /** Pressed on a reminder's own button within REMINDER_ECHO_MINUTES of it firing. */
  echo?: boolean;
}

export interface RoutineReading {
  /** The usual time: minutes after local midnight, 0–1439. */
  medianMinute: number;
  /** Width of the middle half (the interquartile range), in minutes. */
  spreadMinutes: number;
  /** Days that set the time. Reminder echoes are not among them. */
  count: number;
  /** How many days back it looked, today included. */
  windowDays: number;
  /** Days answered straight from a reminder's button — evidence it works. */
  echoCount: number;
}

export interface RoutineOptions {
  windowDays?: number;
  minCount?: number;
}

/** Minutes after midnight, wrapped into 0–1439. */
export function wrapMinute(minute: number): number {
  return ((Math.round(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * The local date and minute of day an ISO time happened at.
 *
 * A time written WITH its offset ("…T21:40:00+01:00") already carries the wall
 * clock where it happened, so its digits are read as they are — the right
 * answer for "what time was it for them", even after a flight. A UTC time
 * ("…Z") has no wall clock of its own and is read in the phone's zone. Returns
 * null for anything that is not an ISO time.
 */
export function wallClockOf(at: string): { date: string; minute: number } | null {
  const m = ISO_RE.exec(typeof at === "string" ? at.trim() : "");
  if (!m) return null;
  const [, y, mo, d, h, mi, zone] = m;
  if (zone && zone !== "Z") {
    const hour = Number(h);
    const minute = Number(mi);
    if (hour > 23 || minute > 59) return null;
    return { date: `${y}-${mo}-${d}`, minute: hour * 60 + minute };
  }
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
    minute: t.getHours() * 60 + t.getMinutes(),
  };
}

/**
 * The median and interquartile range of times of day, read around the clock.
 *
 * The minutes are sorted onto a circle and the circle is cut at its widest
 * empty stretch; everything after the cut is laid out on one line (adding a
 * day where it wraps), so 23:50 and 00:10 sit twenty minutes apart. The usual
 * case, where nothing straddles midnight, cuts at midnight and changes nothing.
 */
export function circularSpread(minutes: readonly number[]): { median: number; iqr: number } {
  const m = minutes.map(wrapMinute).sort((a, b) => a - b);
  const n = m.length;
  if (n === 0) return { median: 0, iqr: 0 };

  let cut = n - 1;
  let widest = m[0] + DAY_MINUTES - m[n - 1];
  for (let i = 0; i < n - 1; i++) {
    const gap = m[i + 1] - m[i];
    if (gap > widest) {
      widest = gap;
      cut = i;
    }
  }
  const start = (cut + 1) % n;
  const line: number[] = [];
  for (let j = 0; j < n; j++) {
    const k = start + j;
    line.push(k < n ? m[k] : m[k - n] + DAY_MINUTES);
  }

  const quantile = (p: number): number => {
    const pos = (n - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return line[lo] + (line[hi] - line[lo]) * (pos - lo);
  };
  return {
    median: wrapMinute(quantile(0.5)),
    iqr: Math.round(quantile(0.75) - quantile(0.25)),
  };
}

/**
 * When this person usually does it, or null below the gate.
 *
 * Only samples inside the window that were logged on the day they are for are
 * read, one per day (the earliest). Echoes are counted but never set the time.
 */
export function readRoutine(
  samples: readonly RoutineSample[],
  today: string,
  options: RoutineOptions = {},
): RoutineReading | null {
  const windowDays = options.windowDays ?? ROUTINE_WINDOW_DAYS;
  const minCount = options.minCount ?? ROUTINE_MIN_COUNT;
  const from = shiftDay(today, -(windowDays - 1));

  const byDate = new Map<string, { minute: number; echo: boolean }>();
  for (const s of samples) {
    if (!s || typeof s.date !== "string" || s.date < from || s.date > today) continue;
    const wall = wallClockOf(s.at);
    // Logged on another day than the one it is for: a back-fill, not a time.
    if (!wall || wall.date !== s.date) continue;
    const prev = byDate.get(s.date);
    if (!prev || wall.minute < prev.minute) {
      byDate.set(s.date, { minute: wall.minute, echo: s.echo === true });
    }
  }

  const days = [...byDate.values()];
  const times = days.filter((d) => !d.echo).map((d) => d.minute);
  if (times.length < minCount) return null;

  const { median, iqr } = circularSpread(times);
  return {
    medianMinute: median,
    spreadMinutes: iqr,
    count: times.length,
    windowDays,
    echoCount: days.length - times.length,
  };
}

/** Steady enough to name a time for. */
export function isConsistent(
  reading: RoutineReading | null,
  maxSpread: number = CONSISTENT_SPREAD_MINUTES,
): reading is RoutineReading {
  return !!reading && reading.spreadMinutes <= maxSpread;
}

/** `minute` rounded to the nearest `step` minutes, wrapped into the day. */
export function roundToStep(minute: number, step = 5): number {
  return wrapMinute(Math.round(minute / step) * step);
}

/** Shortest distance between two times of day, around the clock. */
export function minutesApart(a: number, b: number): number {
  const d = Math.abs(wrapMinute(a) - wrapMinute(b));
  return Math.min(d, DAY_MINUTES - d);
}

/**
 * "9:40 PM" — the same face the reminder rows use
 * (services/notifications/mealReminders `formatTime`), so a sentence that names
 * a time and the row beside it never disagree about how it is written.
 */
export function clockLabel(minute: number): string {
  const m = wrapMinute(minute);
  const hour = Math.floor(m / 60);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
