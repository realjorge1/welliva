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
import { strayBleedDays } from "./doctorChecks";
import { periodDayMap, resolveEnd, splitEpisodes } from "./episodes";
import { givenWindow, projectAhead } from "./predict";
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

  const ep = splitEpisodes(input.episodes).periods.find((e) => e.start === start);
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
    // the circle has stretched past it, so the window she was given shows,
    // behind her (./predict givenWindow).
    const given = givenWindow(p);
    arcs.push(
      status.lateBy > 0
        ? clip("predicted", dayOf(given.earliest), dayOf(given.latest))
        : clip("predicted", dayOf(p.earliest), Math.max(dayOf(p.likely) - 1, dayOf(p.earliest))),
    );
    // Late with no test or temperature behind it: this cycle's ovulation is
    // unconfirmed, so no window and no ovulation day are drawn.
    if (input.showFertile && p.fertileKnown) {
      arcs.push(clip("fertile", dayOf(p.fertileStart), dayOf(p.fertileEnd)));
      const o = dayOf(p.ovulation);
      ovulation = o >= 1 && o <= length ? o : null;
    }
  }
  // A clear, stretchy day today is a fertile day on the dial too (./view fertileNow).
  if (input.showFertile && view.fertileNow) arcs.push(clip("fertile", status.cycleDay, status.cycleDay));

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
  /** One of the window's likeliest days — more likely fertile than not. Drawn stronger. */
  fertileCore: boolean;
  ovulation: boolean;
  /** She noted something about the day. */
  hasLog: boolean;
  /** She noted clear, stretchy discharge — marked only with the fertile window on. */
  stretchy: boolean;
  /**
   * Bleeding between periods: a flow logged outside a period, or a day of a
   * stray episode (./episodes splitEpisodes). Drawn lighter than a period —
   * it is bleeding, not the start of a cycle.
   */
  between: boolean;
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
  const logged = periodDayMap(splitEpisodes(input.episodes).periods, today, view.typicalBleed);
  const strayDays = strayBleedDays(input.episodes);
  const predicted = new Set<string>();
  const fertile = new Set<string>();
  const core = new Set<string>();
  const ovulation = new Set<string>();
  const p = view.prediction;
  const addRange = (set: Set<string>, from: string, to: string) => {
    for (let d = from; d <= to; d = addDays(d, 1)) set.add(d);
  };
  if (view.status.predicting && p) {
    // This cycle's window, then each cycle further ahead a cycle of spread
    // wider (./predict projectAhead): the likeliest days stay strongest.
    // Once she is late nothing is projected past this cycle — a second cycle
    // counted from a date she has already passed would be a stale guess — and
    // this cycle's window shows only if a test or her temperature dated it.
    const cyclesAhead = p.overdue ? 1 : CALENDAR_CYCLES_AHEAD;
    for (let k = 0; k < cyclesAhead; k += 1) {
      const ahead = k === 0 ? null : projectAhead(p, k);
      const likely = ahead ? ahead.period.likely : p.likely;
      for (let i = 0; i < p.periodLength; i += 1) {
        const d = addDays(likely, i);
        if (d > today) predicted.add(d);
      }
      if (input.showFertile && (ahead || p.fertileKnown)) {
        const span = ahead ? ahead.fertile : { start: p.fertileStart, end: p.fertileEnd, core: p.fertileCore };
        addRange(fertile, span.start, span.end);
        if (span.core) addRange(core, span.core.start, span.core.end);
        ovulation.add(ahead ? ahead.ovulation : p.ovulation);
      }
    }
  }
  return (date: string): DayPaint => {
    const l = logged.get(date);
    // A clear, stretchy day she logged is a fertile day, whatever the estimate
    // said (the cautious direction); it moves no date.
    const stretchy = input.showFertile && input.days[date]?.discharge === "clear_stretchy";
    return {
      period: l ?? (predicted.has(date) ? "predicted" : null),
      fertile: !l && (fertile.has(date) || stretchy),
      fertileCore: !l && (core.has(date) || stretchy),
      ovulation: !l && ovulation.has(date),
      hasLog: !isEmptyDayLog(input.days[date]),
      stretchy,
      between: !l && (strayDays.has(date) || !!input.days[date]?.flow),
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
