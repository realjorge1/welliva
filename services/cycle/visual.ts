/**
 * services/cycle/visual.ts — what the dial and the calendar draw, as data.
 *
 * Kept pure and apart from the components so the geometry is testable and the
 * drawing code only draws. Two rules from the owner's brief shape both:
 *   · predicted days are drawn LIGHTER than logged ones — a forecast must never
 *     look like a record;
 *   · the fertile window appears only when she has chosen to see it.
 */

import { addDays, daysBetween, daysInMonth, weekdayOf } from "./dates";
import { liveEpisodes, periodDayMap, resolveEnd } from "./episodes";
import { isEmptyDayLog, type CycleDays, type PeriodEpisode } from "./types";
import type { CycleView } from "./view";

/* ───────────────────────────── the dial ───────────────────────────── */

export type DialKind = "period" | "periodAhead" | "predicted" | "fertile";

/** A run of days on the dial, 1-based and inclusive, within [1, length]. */
export interface DialArc {
  kind: DialKind;
  from: number;
  to: number;
}

export interface DialModel {
  /** Days around the circle. */
  length: number;
  /** Today's day of the cycle, or null with nothing logged. */
  today: number | null;
  arcs: DialArc[];
  ovulation: number | null;
}

export function dialModel(input: {
  episodes: readonly PeriodEpisode[];
  view: CycleView;
  today: string;
  showFertile: boolean;
}): DialModel {
  const { view, today } = input;
  const status = view.status;
  const length = Math.max(1, status.ringDays);
  if (status.cycleDay === null) return { length, today: null, arcs: [], ovulation: null };

  const start = addDays(today, -(status.cycleDay - 1));
  const dayOf = (iso: string) => daysBetween(start, iso) + 1;
  const clip = (kind: DialKind, from: number, to: number): DialArc | null => {
    const a = Math.max(1, from);
    const b = Math.min(length, to);
    return a <= b ? { kind, from: a, to: b } : null;
  };
  const arcs: (DialArc | null)[] = [];

  const ep = liveEpisodes(input.episodes).find((e) => e.start === start);
  if (ep) {
    const resolved = resolveEnd(ep, today, view.typicalBleed);
    const lastDay = Math.min(dayOf(resolved.end), status.cycleDay);
    if (resolved.assumed && !ep.end) {
      // A period she never ended: only its first day is a record.
      arcs.push(clip("period", 1, 1), clip("periodAhead", 2, dayOf(resolved.end)));
    } else {
      arcs.push(clip("period", 1, lastDay));
    }
  }
  if (status.inPeriod && status.periodDay !== null && status.expectedEnd) {
    arcs.push(clip("periodAhead", status.periodDay + 1, dayOf(status.expectedEnd)));
  }

  const p = view.prediction;
  let ovulation: number | null = null;
  if (status.predicting && p) {
    // The run-up to the next period: from the window's first day to the day
    // before the likely start, which is the top of the circle. Once she's late
    // the circle has stretched past it, so the whole window shows, behind her.
    arcs.push(
      status.lateBy > 0
        ? clip("predicted", dayOf(p.earliest), dayOf(p.latest))
        : clip("predicted", dayOf(p.earliest), Math.max(dayOf(p.likely) - 1, dayOf(p.earliest))),
    );
    if (input.showFertile) {
      arcs.push(clip("fertile", dayOf(p.fertileStart), dayOf(p.fertileEnd)));
      const o = dayOf(p.ovulation);
      ovulation = o >= 1 && o <= length ? o : null;
    }
  }

  return {
    length,
    today: Math.min(status.cycleDay, length),
    arcs: arcs.filter((a): a is DialArc => a !== null),
    ovulation,
  };
}

/* ───────────────────────────── the calendar ───────────────────────────── */

export interface DayPaint {
  /** logged = she recorded it; assumed = the guessed tail of an unended period; predicted = a forecast. */
  period: "logged" | "assumed" | "predicted" | null;
  fertile: boolean;
  ovulation: boolean;
  /** She noted something about the day. */
  hasLog: boolean;
}

/** How many cycles ahead the calendar projects. Further than that is guesswork. */
export const CALENDAR_CYCLES_AHEAD = 3;

export function paintDays(input: {
  episodes: readonly PeriodEpisode[];
  days: CycleDays;
  view: CycleView;
  today: string;
  showFertile: boolean;
}): (date: string) => DayPaint {
  const { view, today } = input;
  const logged = periodDayMap(input.episodes, today, view.typicalBleed);
  const predicted = new Set<string>();
  const fertile = new Set<string>();
  const ovulation = new Set<string>();
  const p = view.prediction;
  if (view.status.predicting && p) {
    for (let k = 0; k < CALENDAR_CYCLES_AHEAD; k += 1) {
      const shift = k * p.cycleLength;
      for (let i = 0; i < p.periodLength; i += 1) {
        const d = addDays(p.likely, shift + i);
        if (d > today) predicted.add(d);
      }
      if (input.showFertile) {
        const span = daysBetween(p.fertileStart, p.fertileEnd);
        for (let i = 0; i <= span; i += 1) fertile.add(addDays(p.fertileStart, shift + i));
        ovulation.add(addDays(p.ovulation, shift));
      }
    }
  }
  return (date: string): DayPaint => {
    const l = logged.get(date);
    return {
      period: l ?? (predicted.has(date) ? "predicted" : null),
      fertile: !l && fertile.has(date),
      ovulation: !l && ovulation.has(date),
      hasLog: !isEmptyDayLog(input.days[date]),
    };
  };
}

export interface GridDay {
  date: string;
  inMonth: boolean;
}

/** A month as Monday-first weeks, padded with the neighbouring months' days. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lead = (weekdayOf(first) + 6) % 7; // Monday = 0
  const total = daysInMonth(year, month);
  const cells = Math.ceil((lead + total) / 7) * 7;
  const weeks: GridDay[][] = [];
  for (let i = 0; i < cells; i += 1) {
    const date = addDays(first, i - lead);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ date, inMonth: i >= lead && i < lead + total });
  }
  return weeks;
}

/** Move a {year, month} cursor by whole months. */
export function shiftMonthCursor(c: { year: number; month: number }, by: number): { year: number; month: number } {
  const index = c.year * 12 + (c.month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
