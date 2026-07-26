/**
 * health-os/lifecontext/lifecontext.types.ts
 *
 * Life Context — the forward-time primitive that lets the companion ANTICIPATE.
 *
 * A LifeEvent is a future-dated, auto-expiring, user-controlled fact that should bend
 * coaching before it arrives and stop mattering once it passes (a wedding, a surgery,
 * an exam season, a trip, a medication course). It is deliberately NOT a long-term
 * Memory fact (those are durable and slow-changing) — it is temporally bounded and
 * forward-looking, with a lifecycle and an expiry.
 *
 * This file holds the types + PURE date helpers only (no storage, injectable `today`),
 * so they're trivially testable and reusable by later anticipation engines. See
 * docs/companion/00-proactive-companion-blueprint.md §3.1.
 */
import { parseLocalDate, toLocalDateString } from "../platform/clock";

export type LifeEventKind =
  | "wedding"
  | "pregnancy_due"
  | "surgery"
  | "medication_course"
  | "exam_period"
  | "travel"
  | "vacation"
  | "competition"
  | "deadline"
  | "relocation"
  | "illness_recovery"
  | "holiday"
  | "anniversary"
  | "other";

/** Active = still ahead/ongoing; the three terminal states differ only in WHY it ended. */
export type LifeEventStatus = "active" | "completed" | "expired" | "dismissed";

/** Where the entry came from. P0 is `user` only; calendar/inferred arrive with Signals (P3+). */
export type LifeEventSource = "user" | "calendar" | "inferred";

/** Local `YYYY-MM-DD` dates. `end` omitted = a point event (one day). */
export interface LifeWindow {
  start: string;
  end?: string;
}

export interface LifeEvent {
  /** ULID — unique AND time-sortable. */
  id: string;
  kind: LifeEventKind;
  title: string;
  window: LifeWindow;
  source: LifeEventSource;
  /** 1.0 for user-entered; <1 for inferred (Signals milestones). */
  confidence: number;
  status: LifeEventStatus;
  note?: string;
  /** Local-offset ISO. */
  createdAt: string;
  updatedAt: string;
  /** `YYYY-MM-DD` local: the day after which an active entry auto-expires (end + grace). */
  expiresAt: string;
  /** Local-offset ISO; set when it reaches a terminal status. */
  resolvedAt?: string;
}

/** Days of grace an entry lingers (visible as context) past its end before auto-expiry. */
export const EXPIRY_GRACE_DAYS = 1;

/** Default forward window the "What's coming up" view considers (a season ahead). */
export const DEFAULT_HORIZON_DAYS = 120;

/** Within this many days of the start, an upcoming event is "imminent". */
export const IMMINENT_DAYS = 7;

/** A human label per kind, for the picker + cards. */
export const KIND_META: Record<
  LifeEventKind,
  { label: string; icon: string; pointEvent: boolean }
> = {
  wedding: { label: "Wedding", icon: "heart", pointEvent: true },
  pregnancy_due: { label: "Due date", icon: "ellipse", pointEvent: true },
  surgery: { label: "Surgery", icon: "medkit", pointEvent: true },
  medication_course: { label: "Medication course", icon: "medical", pointEvent: false },
  exam_period: { label: "Exam season", icon: "school", pointEvent: false },
  travel: { label: "Travel", icon: "airplane", pointEvent: false },
  vacation: { label: "Vacation", icon: "sunny", pointEvent: false },
  competition: { label: "Race / event", icon: "trophy", pointEvent: true },
  deadline: { label: "Deadline", icon: "flag", pointEvent: true },
  relocation: { label: "Move", icon: "home", pointEvent: true },
  illness_recovery: { label: "Recovery", icon: "bandage", pointEvent: false },
  holiday: { label: "Holiday", icon: "gift", pointEvent: true },
  anniversary: { label: "Anniversary", icon: "ribbon", pointEvent: true },
  other: { label: "Something else", icon: "calendar", pointEvent: true },
};

// ── pure date helpers (injectable `today`, never call the clock here) ──

/** `YYYY-MM-DD` shifted by `n` whole days (local). */
export function addDays(date: string, n: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
}

/** Whole days from `today` to `date` (negative if `date` is in the past). */
export function daysBetween(today: string, date: string): number {
  const a = parseLocalDate(today).getTime();
  const b = parseLocalDate(date).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** A valid `YYYY-MM-DD` that round-trips (rejects "2026-02-31" etc.). */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return toLocalDateString(parseLocalDate(date)) === date;
}

/** The expiry day for a window: (end ?? start) + grace. */
export function computeExpiresAt(window: LifeWindow): string {
  const last = window.end ?? window.start;
  return addDays(last, EXPIRY_GRACE_DAYS);
}

export type LifePhase = "upcoming" | "imminent" | "active" | "past";

/** Where an event sits relative to `today`, for sorting + copy. */
export function phaseOf(event: LifeEvent, today: string): LifePhase {
  const start = daysBetween(today, event.window.start);
  const end = event.window.end ? daysBetween(today, event.window.end) : start;
  if (end < 0) return "past"; // window has fully passed
  if (start <= 0 && end >= 0) return "active"; // today is inside the window
  if (start <= IMMINENT_DAYS) return "imminent";
  return "upcoming";
}

/** True once `today` is past the grace expiry day. Drives the auto-expiry sweep. */
export function isExpired(event: LifeEvent, today: string): boolean {
  return daysBetween(today, event.expiresAt) < 0;
}

/** Days until the event's start (0 today, negative once begun/past). */
export function daysUntil(event: LifeEvent, today: string): number {
  return daysBetween(today, event.window.start);
}

/** A short countdown label ("in 12 days", "Today", "Started", "Tomorrow"). */
export function countdownLabel(event: LifeEvent, today: string): string {
  const n = daysUntil(event, today);
  if (n > 1) return `in ${n} days`;
  if (n === 1) return "tomorrow";
  if (n === 0) return "today";
  // started: if still within window, say so; else it's in the grace tail
  const phase = phaseOf(event, today);
  return phase === "active" ? "happening now" : "just passed";
}
