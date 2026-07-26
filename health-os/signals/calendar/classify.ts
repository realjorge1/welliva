/**
 * health-os/signals/calendar/classify.ts
 *
 * PURE calendar → Life Context translation (no native imports, no I/O). Turns a
 * normalized device-calendar event into a Life Context PROPOSAL — never a silent
 * commit. The adapter (CalendarSource) reads the OS calendar and hands raw events
 * here; the result is `add()`-ed idempotently (deterministic `cal:<id>`), so a
 * re-sync never duplicates. See docs/companion/00-proactive-companion-blueprint.md §3.2.
 */
import type { LifeEventInput } from "../../lifecontext";
import type { LifeEventKind } from "../../lifecontext/lifecontext.types";

/** A device-calendar event normalized to LOCAL `YYYY-MM-DD` dates (the adapter's job). */
export interface RawCalendarEvent {
  id: string;
  title: string;
  /** Local `YYYY-MM-DD`. */
  startDate: string;
  /** Local `YYYY-MM-DD`, inclusive last day (the adapter de-exclusives all-day ends). */
  endDate: string;
  allDay: boolean;
  location?: string;
  notes?: string;
}

/** Confidence stamped on inferred (calendar-sourced) entries — below user-entered 1.0. */
export const CALENDAR_CONFIDENCE = 0.7;

const RULES: [RegExp, LifeEventKind][] = [
  [/\b(flight|flying|airport|fly to|trip to|travel|abroad|hotel|layover|boarding)\b/i, "travel"],
  [/\b(vacation|holiday|getaway|honeymoon|pto|time off|annual leave|staycation)\b/i, "vacation"],
  [/\bwedding\b/i, "wedding"],
  [/\b(exam|final|midterm|finals|test week|board exam)\b/i, "exam_period"],
  [/\b(surgery|operation|procedure|biopsy|anaesthe|anesthe)\b/i, "surgery"],
  [/\b(marathon|half[- ]?marathon|\d+\s?k\b|race day|triathlon|tournament|championship|match day)\b/i, "competition"],
  [/\b(deadline|due date|submission|launch|go[- ]?live|release|ship date)\b/i, "deadline"],
  [/\b(moving day|move out|relocat|new apartment|new house|closing day)\b/i, "relocation"],
  [/\b(anniversary)\b/i, "anniversary"],
];

/** Best-effort kind from free text, or null if nothing matches. */
export function classifyKind(text: string): LifeEventKind | null {
  for (const [re, kind] of RULES) if (re.test(text)) return kind;
  return null;
}

/**
 * Propose a Life Context entry for a calendar event, or null to skip it.
 *
 * Rules that keep the proposals high-signal (we do NOT mirror every meeting):
 *  - skip anything that has already started (`start < today`);
 *  - if a keyword classifies it, propose that kind;
 *  - else, only a MULTI-DAY all-day block proposes (it's almost certainly a trip);
 *  - ordinary single timed meetings are ignored.
 */
export function proposeFromCalendarEvent(
  raw: RawCalendarEvent,
  today: string,
): LifeEventInput | null {
  const title = raw.title?.trim();
  if (!title) return null;
  if (raw.startDate < today) return null; // only the future

  const multiDay = raw.allDay && raw.endDate > raw.startDate;
  let kind = classifyKind(`${title} ${raw.location ?? ""}`);
  if (!kind) {
    if (!multiDay) return null; // ordinary meeting → skip
    kind = "travel"; // a multi-day all-day block reads as a trip
  }

  const hasRange = raw.endDate > raw.startDate;
  return {
    id: `cal:${raw.id}`,
    kind,
    title,
    window: hasRange ? { start: raw.startDate, end: raw.endDate } : { start: raw.startDate },
    source: "calendar",
    confidence: CALENDAR_CONFIDENCE,
    ...(raw.location ? { note: raw.location } : {}),
  };
}

/** Map a batch of calendar events to de-duplicated proposals (skips the noise). */
export function proposeFromCalendar(
  events: RawCalendarEvent[],
  today: string,
): LifeEventInput[] {
  const out = new Map<string, LifeEventInput>();
  for (const ev of events) {
    const p = proposeFromCalendarEvent(ev, today);
    if (p && p.id && !out.has(p.id)) out.set(p.id, p);
  }
  return [...out.values()];
}
