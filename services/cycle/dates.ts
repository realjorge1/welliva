/**
 * services/cycle/dates.ts — calendar-day arithmetic for the cycle tracker.
 *
 * Every date in the cycle module is a LOCAL calendar day written "YYYY-MM-DD",
 * the same shape OfflineStorage's `todayDate()` produces. Nothing here ever
 * holds a time of day: a period starts on a day, not at an instant.
 *
 * WHY UTC DAY NUMBERS. The arithmetic runs on whole UTC days, never on local
 * timestamps. A local-midnight Date moves by an hour across a daylight-saving
 * change, so "days between" computed from local times comes out as 27.96 on
 * the wrong weekend and a cycle silently loses a day when it is floored. A
 * calendar day mapped to `Date.UTC(y, m, d)` has no clock to drift.
 *
 * Formatting is by hand rather than through Intl, for the reason
 * services/gozlin/agent/context.ts gives: Hermes' Intl support depends on the
 * build, and a date line that renders differently per device is not worth it.
 */

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");

/** True for a real calendar day in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = ISO.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Whole days since 1970-01-01 for a calendar day. NaN for a malformed string. */
export function dayNumber(iso: string): number {
  const m = ISO.exec(iso);
  if (!m) return NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/** The calendar day `n` whole days after 1970-01-01. */
export function fromDayNumber(n: number): string {
  const dt = new Date(n * DAY_MS);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** `iso` moved by `n` days (negative moves back). */
export function addDays(iso: string, n: number): string {
  return fromDayNumber(dayNumber(iso) + n);
}

/** Whole days from `from` to `to` — positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** 0 = Sunday … 6 = Saturday, for the calendar day itself. */
export function weekdayOf(iso: string): number {
  return new Date(dayNumber(iso) * DAY_MS).getUTCDay();
}

/** "28 Oct", or "Tue 28 Oct" with `weekday`. Day-first, as the app writes dates. */
export function formatDay(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const day = `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
  const withYear = opts.year ? `${day} ${m[1]}` : day;
  return opts.weekday ? `${WEEKDAYS[weekdayOf(iso)]} ${withYear}` : withYear;
}

/**
 * A span of days, written the short way: "28 Oct" for one day, "28–31 Oct"
 * inside a month, "28 Oct – 1 Nov" across two.
 */
export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from);
  const a = ISO.exec(from);
  const b = ISO.exec(to);
  if (!a || !b) return `${from} – ${to}`;
  if (a[1] === b[1] && a[2] === b[2]) {
    return `${Number(a[3])}–${Number(b[3])} ${MONTHS[Number(a[2]) - 1]}`;
  }
  return `${formatDay(from)} – ${formatDay(to)}`;
}

/** "October 2026". `month` is 1-based. */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1] ?? ""} ${year}`;
}

/** The first day of the month containing `iso`. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** How many days the month has. `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "today", "tomorrow", "in 3 days", "yesterday", "3 days ago". */
export function relativeDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
