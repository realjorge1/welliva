/**
 * services/cycle/upcoming.ts — your period meets your calendar.
 *
 * welliva knows when her next period is likely, and it knows about the Lagos
 * trip and the 10K, because she told it (Life Context) or her calendar did, with
 * that consent. A period app knows only the first half; a calendar only the
 * second. This puts them together, once, in plain words:
 *
 *   "Your next period will probably start during your Lagos trip (12–16 Dec).
 *    Worth packing for."
 *   "Your 10K is on 3 Dec, likely day 2 of your period. On your last 3 periods,
 *    day 2 was your heaviest day."
 *
 * THE WORDS FOLLOW THE WINDOW. "Will probably" only when the MOST LIKELY day is
 * inside the event; "might" when only the edge of the 80% window touches it. The
 * window and the confidence word sit underneath, so it is never surer than the
 * cycle screen. The second sentence appears only when HER OWN patterns say
 * something about that exact day — never a phase stereotype.
 *
 * Nothing here runs in the logging-only or paused modes, because `predict` has
 * returned nothing for them, and nothing runs once she's late: that window has
 * passed, and the late section has the floor.
 *
 * LEAN ON PURPOSE. ./reminderPlan reads this from the Android headless task, so
 * this module must never reach ./care or ./view (see ./reminders).
 */

import { confidenceWord } from "./copy";
import { addDays, daysBetween, formatDay, formatRange, isIsoDate } from "./dates";
import { heaviestDayPattern, type CyclePattern } from "./patterns";
import type { CycleRecord, CycleToday, Prediction } from "./predict";
import type { CycleDays } from "./types";

/** How far ahead it looks: the next predicted period, and the one after. */
export const UPCOMING_HORIZON_DAYS = 60;
/** The in-app heads-up appears this many days before the event. */
export const UPCOMING_HEADS_UP_DAYS = 3;
/** The one phone reminder fires this many days before a trip starts (owner's decision). */
export const TRIP_REMINDER_DAYS = 2;
/**
 * The period after next is less certain than the next: two cycles' spreads add
 * up, so its window is √2 wider than the next one's.
 */
export const SECOND_WINDOW_WIDEN = Math.SQRT2;
/** The widest window ./predict ever gives. */
const MAX_HALF_WIDTH = 10;

/** The life events it reads. Stable storage strings, from Life Context. */
export const MOMENT_KINDS = ["travel", "vacation", "holiday", "wedding", "competition", "exam_period"] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

/** One of these events, on her calendar. */
export interface LifeMoment {
  id: string;
  kind: MomentKind;
  /** Her own words: "Lagos trip", "10K". */
  title: string;
  start: string;
  /** Inclusive. Equal to `start` for a one-day event. */
  end: string;
}

/** The shape of a stored Life Context entry, as far as this module cares. */
export interface LifeEventLike {
  id?: unknown;
  kind?: unknown;
  title?: unknown;
  window?: { start?: unknown; end?: unknown } | null;
  source?: unknown;
  status?: unknown;
}

/**
 * The stored entries worth reading: still active, inside the horizon, of a kind
 * above, and hers. An entry from the calendar counts only while calendar consent
 * stands; one the app inferred never does. Anything malformed is dropped.
 */
export function momentsFrom(
  events: readonly LifeEventLike[],
  opts: { calendarAllowed: boolean; today: string },
): LifeMoment[] {
  const until = addDays(opts.today, UPCOMING_HORIZON_DAYS);
  const out: LifeMoment[] = [];
  for (const e of events) {
    if (!e || e.status !== "active") continue;
    if (!(e.source === "user" || (e.source === "calendar" && opts.calendarAllowed))) continue;
    if (!(MOMENT_KINDS as readonly unknown[]).includes(e.kind)) continue;
    if (typeof e.id !== "string" || typeof e.title !== "string" || !e.title.trim()) continue;
    const start = e.window?.start;
    if (!isIsoDate(start)) continue;
    const end = isIsoDate(e.window?.end) && (e.window?.end as string) >= start ? (e.window?.end as string) : start;
    if (end < opts.today || start > until) continue;
    out.push({ id: e.id, kind: e.kind as MomentKind, title: e.title.trim(), start, end });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1));
}

/* ───────────────────────────── the overlap ───────────────────────────── */

interface PeriodWindow {
  which: "next" | "after";
  earliest: string;
  likely: string;
  latest: string;
}

function windowsOf(p: Prediction): PeriodWindow[] {
  const half = Math.min(MAX_HALF_WIDTH, Math.round(p.halfWidth * SECOND_WINDOW_WIDEN));
  const likely = addDays(p.likely, p.cycleLength);
  return [
    { which: "next", earliest: p.earliest, likely: p.likely, latest: p.latest },
    { which: "after", earliest: addDays(likely, -half), likely, latest: addDays(likely, half) },
  ];
}

interface Overlap {
  window: PeriodWindow;
  certainty: "probable" | "possible";
  /** A one-day event that likely lands inside her bleed: which day of it. */
  periodDay: number | null;
}

/** Does a predicted period meet this event? The next one is tried first. */
function overlapOf(m: LifeMoment, p: Prediction): Overlap | null {
  for (const window of windowsOf(p)) {
    if (m.start === m.end) {
      const n = daysBetween(window.likely, m.start) + 1;
      if (n >= 1 && n <= p.periodLength) return { window, certainty: "probable", periodDay: n };
      if (m.start >= window.earliest && m.start <= window.latest) {
        return { window, certainty: "possible", periodDay: null };
      }
    } else {
      if (window.likely >= m.start && window.likely <= m.end) {
        return { window, certainty: "probable", periodDay: null };
      }
      if (window.earliest <= m.end && window.latest >= m.start) {
        return { window, certainty: "possible", periodDay: null };
      }
    }
  }
  return null;
}

const predictingNow = (p: Prediction | null, status: CycleToday): p is Prediction =>
  !!p && status.predicting && status.lateBy === 0;

/* ───────────────────────────── saying it ───────────────────────────── */

export interface ComingUp {
  /** The event's id. */
  id: string;
  kind: MomentKind;
  title: string;
  start: string;
  certainty: "probable" | "possible";
  /** A one-day event that likely lands inside her bleed: which day of it. */
  periodDay: number | null;
  /** "Your next period will probably start during your Lagos trip (12–16 Dec). Worth packing for." */
  text: string;
  /** "Predicted 13–17 Dec · Fairly sure" — the window it comes from, and how sure. */
  detail: string;
  /** For the coach, about her. */
  coach: string;
}

/** A closing line that fits the event. A race gets its own second sentence instead. */
function closing(kind: MomentKind): string {
  if (kind === "competition") return "";
  return kind === "travel" || kind === "vacation" ? " Worth packing for." : " Worth having what you need with you.";
}

/** What HER patterns say about that day of her period, if anything: heaviest flow, then cramps. */
function aboutThatDay(
  periodDay: number,
  timing: readonly CyclePattern[],
  cycles: readonly CycleRecord[],
  days: CycleDays,
): string | null {
  const heaviest = heaviestDayPattern(cycles, days);
  if (heaviest && heaviest.day === periodDay) return heaviest.line;
  const cramps = timing.find(
    (p) =>
      p.subject === "cramps" &&
      p.window?.anchor === "start" &&
      periodDay >= p.window.lo &&
      periodDay <= p.window.hi,
  );
  return cramps?.body ?? null;
}

/**
 * Every event a predicted period is likely to meet, soonest first. The cycle
 * screen shows the first; the coach reads a couple.
 */
export function comingUp(input: {
  prediction: Prediction | null;
  status: CycleToday;
  moments: readonly LifeMoment[];
  timing: readonly CyclePattern[];
  cycles: readonly CycleRecord[];
  days: CycleDays;
}): ComingUp[] {
  const { prediction: p, status } = input;
  if (!predictingNow(p, status)) return [];

  const out: ComingUp[] = [];
  for (const m of input.moments) {
    const hit = overlapOf(m, p);
    if (!hit) continue;
    const who = hit.window.which === "next" ? "Your next period" : "Your period after next";
    const her = hit.window.which === "next" ? "her next period" : "her period after next";
    const when = m.start === m.end ? formatDay(m.start) : formatRange(m.start, m.end);
    let text: string;
    let coach: string;
    if (hit.periodDay !== null) {
      const more = aboutThatDay(hit.periodDay, input.timing, input.cycles, input.days);
      text = `Your ${m.title} is on ${when}, likely day ${hit.periodDay} of your period.${more ? ` ${more}` : closing(m.kind)}`;
      coach = `her ${m.title} on ${when} is likely day ${hit.periodDay} of her period (an estimate)`;
    } else if (m.start === m.end) {
      text = `${who} might start around your ${m.title} (${when}).${closing(m.kind)}`;
      coach = `${her} might start around her ${m.title} (${when}; an estimate)`;
    } else {
      const will = hit.certainty === "probable" ? "will probably start" : "might start";
      text = `${who} ${will} during your ${m.title} (${when}).${closing(m.kind)}`;
      coach = `${her} ${will} during her ${m.title} (${when}; an estimate)`;
    }
    out.push({
      id: m.id,
      kind: m.kind,
      title: m.title,
      start: m.start,
      certainty: hit.certainty,
      periodDay: hit.periodDay,
      text,
      detail: `Predicted ${formatRange(hit.window.earliest, hit.window.latest)} · ${confidenceWord(p)}`,
      coach,
    });
  }
  return out;
}

/**
 * What her training pattern adds about a race, if anything. It needs the workout
 * log, so the cycle screen asks for it separately (the view reads only the cycle
 * documents). "Eases" only speaks for the first days, which is all it measured.
 */
export function trainingNote(item: ComingUp, patterns: readonly CyclePattern[]): string | null {
  if (item.kind !== "competition" || item.periodDay === null) return null;
  const habit = patterns.find((p) => p.kind === "training")?.trainingHabit;
  if (habit === "keeps") return "You usually keep training through it.";
  if (habit === "eases" && item.periodDay <= 3) return "You usually train less in those first days.";
  return null;
}

/**
 * The trip the one phone reminder is about: the soonest trip or holiday away that
 * a predicted period meets. Nothing else gets a notification.
 */
export function nextTripOverlap(input: {
  prediction: Prediction | null;
  status: CycleToday;
  moments: readonly LifeMoment[];
}): LifeMoment | null {
  const { prediction: p, status } = input;
  if (!predictingNow(p, status)) return null;
  for (const m of input.moments) {
    if ((m.kind === "travel" || m.kind === "vacation") && overlapOf(m, p)) return m;
  }
  return null;
}
