/**
 * services/calendar/events.ts — what welliva writes into the phone's calendar. PURE.
 *
 * Owner, 2026-11-15: "Can the app be connected and make changes on calendar?" →
 * put my WORKOUTS in it, and the CYCLE too (for women who switch it on). Until
 * then welliva only READ the calendar (health-os/signals/calendar).
 *
 * Everything welliva writes goes into ONE calendar of its own, kept on this phone
 * and never attached to an account (./device). Each entry carries a tag line at
 * the top of its notes — `welliva:w:<date>`, `welliva:c:p1` — and that tag is its identity:
 * a sync updates the entry with the same tag, adds the missing ones and removes
 * the ones the plan no longer has. Only entries with OUR tag in OUR calendar are
 * ever touched; the person's own events are never read for writing, never moved.
 *
 * CYCLE ENTRIES FOLLOW THE CYCLE'S OWN "Discreet wording" switch (on by default):
 * then they are "Plan-ahead days" / "Window days" and never name the period or
 * fertility — a calendar is seen by more eyes and more apps than a lock screen.
 */
import type { GeneratedWorkoutPlan } from "@/models/workout";

export type CalendarScope = "workouts" | "cycle";

/** One entry welliva wants in its calendar. */
export interface CalendarEventSpec {
  /** `<scope code>:<what>` (see SCOPE_CODE) — the entry's identity across syncs. */
  key: string;
  scope: CalendarScope;
  title: string;
  /** Starts with the tag line; the rest is for the person. */
  notes: string;
  allDay: boolean;
  start: Date;
  /** Exclusive: an all-day entry ends at 00:00 the day after its last day. */
  end: Date;
}

/** An entry already in welliva's calendar, as read back. */
export interface ExistingEvent {
  id: string;
  title: string;
  notes: string;
  allDay: boolean;
  start: number;
  end: number;
}

export const TAG_PREFIX = "welliva:";

/**
 * Each scope's short code at the front of its keys. Opaque on purpose: the tag
 * line shows in the entry's notes, and a cycle tag reading "cycle:period" would
 * name the period under discreet wording (caught by the test, 2026-11-15).
 */
export const SCOPE_CODE: Record<CalendarScope, string> = { workouts: "w", cycle: "c" };

/** The first line of the notes: the tag. */
export function tagLine(key: string): string {
  return `${TAG_PREFIX}${key}`;
}

/** The key an existing entry was written with, or null when it isn't ours. */
export function keyOf(notes: string | null | undefined): string | null {
  const first = (notes ?? "").split("\n", 1)[0].trim();
  return first.startsWith(TAG_PREFIX) ? first.slice(TAG_PREFIX.length) : null;
}

function withTag(key: string, body: string): string {
  return `${tagLine(key)}\n\n${body}`;
}

/** Local midnight of a `YYYY-MM-DD`. */
export function dayStart(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/** `YYYY-MM-DD` of a local Date. */
export function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const d = dayStart(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/* ───────────────────────────────── workouts ───────────────────────────────── */

/** Shortest block a session gets, so a 0-minute plan entry is still visible. */
const MIN_SESSION_MINUTES = 15;

/**
 * Every training session of the stored week from today on, at the training hour.
 * Rest days write nothing; a past day is left alone (it already happened).
 */
export function workoutEventSpecs(
  plan: GeneratedWorkoutPlan | null,
  hour: number,
  today: string,
): CalendarEventSpec[] {
  if (!plan) return [];
  const h = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.trunc(hour))) : 17;
  const out: CalendarEventSpec[] = [];
  const seen = new Set<string>();
  for (const s of plan.sessions ?? []) {
    if (s.isRestDay || typeof s.dayOfWeek !== "number") continue;
    const date = addDays(plan.weekStart, s.dayOfWeek);
    if (date < today) continue;
    const key = `${SCOPE_CODE.workouts}:${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const minutes = Math.max(MIN_SESSION_MINUTES, Math.round(s.totalDurationMinutes || 0));
    const start = dayStart(date);
    start.setHours(h, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    const focus = (s.focus || s.dayLabel || "Training").trim();
    out.push({
      key,
      scope: "workouts",
      title: `Workout · ${focus}`,
      notes: withTag(
        key,
        `About ${minutes} min, from your welliva plan. It moves here when the plan changes — change it in welliva, not in the calendar.`,
      ),
      allDay: false,
      start,
      end,
    });
  }
  return out;
}

/* ─────────────────────────────────── cycle ────────────────────────────────── */

/** The parts of a cycle prediction the calendar needs (services/cycle/predict). */
export interface CyclePredictionLike {
  likely: string;
  earliest: string;
  latest: string;
  periodLength: number;
  cycleLength: number;
  fertileStart: string;
  fertileEnd: string;
}

/** How many coming periods go in: the next, and the one after as a rough mark. */
const PERIODS_AHEAD = 2;

/** An all-day block from `first` through `last` inclusive. */
function allDayBlock(first: string, last: string): { start: Date; end: Date } {
  return { start: dayStart(first), end: dayStart(addDays(last, 1)) };
}

/**
 * The likely period days of the next two cycles and, only when she shows it and
 * her mode allows it, the next fertile window. Nothing at all without a
 * prediction (paused, logging only, or not enough logged yet).
 */
export function cycleEventSpecs(input: {
  prediction: CyclePredictionLike | null;
  discreet: boolean;
  /** `showFertileWindow` AND the mode allows it (services/cycle/predict fertileWindowAllowed). */
  fertileWindow: boolean;
  today: string;
}): CalendarEventSpec[] {
  const p = input.prediction;
  if (!p) return [];
  const out: CalendarEventSpec[] = [];
  const length = Math.max(1, Math.round(p.periodLength || 5));
  const every = Math.max(15, Math.round(p.cycleLength || 28));

  for (let i = 0; i < PERIODS_AHEAD; i++) {
    const first = addDays(p.likely, i * every);
    const last = addDays(first, length - 1);
    if (last < input.today) continue;
    const key = `${SCOPE_CODE.cycle}:p${i + 1}`;
    const { start, end } = allDayBlock(first, last);
    out.push({
      key,
      scope: "cycle",
      title: input.discreet ? "Plan-ahead days" : i === 0 ? "Period likely" : "Period likely (rough)",
      notes: withTag(
        key,
        input.discreet
          ? "From welliva. Open the app for what they mean."
          : i === 0
            ? `Most likely from ${first}; anywhere from ${p.earliest} to ${p.latest} is usual for you. It re-tunes as you log.`
            : "A rough mark one cycle further on — it sharpens after the next period.",
      ),
      allDay: true,
      start,
      end,
    });
  }

  if (input.fertileWindow && p.fertileEnd >= input.today) {
    const key = `${SCOPE_CODE.cycle}:w1`;
    const { start, end } = allDayBlock(p.fertileStart, p.fertileEnd);
    out.push({
      key,
      scope: "cycle",
      title: input.discreet ? "Window days" : "Fertile window (estimate)",
      notes: withTag(
        key,
        input.discreet
          ? "From welliva. Open the app for what they mean."
          : "An estimate from your logs — never a form of contraception.",
      ),
      allDay: true,
      start,
      end,
    });
  }
  return out;
}

/* ─────────────────────────────────── the diff ─────────────────────────────── */

export interface CalendarChanges {
  create: CalendarEventSpec[];
  update: { id: string; spec: CalendarEventSpec }[];
  remove: string[];
}

function same(e: ExistingEvent, s: CalendarEventSpec): boolean {
  return (
    e.title === s.title &&
    e.notes === s.notes &&
    e.allDay === s.allDay &&
    e.start === s.start.getTime() &&
    e.end === s.end.getTime()
  );
}

/**
 * Bring one scope of welliva's calendar to `wanted`. Entries of OTHER scopes, and
 * anything without our tag, are left exactly as they are. A key found twice (an
 * interrupted earlier sync) keeps its first entry and loses the rest.
 */
export function planCalendarChanges(
  scope: CalendarScope,
  existing: readonly ExistingEvent[],
  wanted: readonly CalendarEventSpec[],
): CalendarChanges {
  const want = new Map(wanted.map((s) => [s.key, s]));
  const kept = new Set<string>();
  const changes: CalendarChanges = { create: [], update: [], remove: [] };
  for (const e of existing) {
    const key = keyOf(e.notes);
    if (!key || !key.startsWith(`${SCOPE_CODE[scope]}:`)) continue;
    const spec = want.get(key);
    if (!spec || kept.has(key)) {
      changes.remove.push(e.id);
      continue;
    }
    kept.add(key);
    if (!same(e, spec)) changes.update.push({ id: e.id, spec });
  }
  for (const s of wanted) if (!kept.has(s.key)) changes.create.push(s);
  return changes;
}
