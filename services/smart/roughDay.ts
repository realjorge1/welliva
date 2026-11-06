/**
 * services/smart/roughDay.ts
 *
 * THE ROUGH-DAY BUTTON — one tap makes today gentle.
 *
 *   "Take it easy today?"   Ill · Exhausted · Bad news · Travelling · Something else
 *                           [Make today gentle]
 *
 * For the rest of TODAY: the workout becomes a choice between a gentle walk and
 * rest, the calories stop counting down, habits can't be missed, reminders and
 * the coach go quiet, and the daily streak is PAUSED — the day neither adds to
 * it nor breaks it (owner, 2026-11-03). Logging something real anyway keeps the
 * day the ordinary way: a kept day beats a rough day.
 *
 * The rules this file keeps:
 *
 *   · TODAY ONLY. A rough day cannot be back-dated, for the same reason only
 *     today can keep the streak.
 *   · A CAP ON THE PROTECTION. {@link ROUGH_DAYS_PER_MONTH} a calendar month
 *     pause the streak (owner: five). Past that the button still makes the day
 *     gentle — it just can't protect the streak, and says so before the tap.
 *   · THE REASON IS NEVER REQUIRED, and it never leaves this record: not in
 *     analytics, not in a notification.
 *   · NOTHING SILENT. "I'm OK actually" takes it back for the rest of the day,
 *     as a tombstone (`deleted`, newer stamp) so the other phone agrees.
 *
 * Other features read it through the small pure helpers below — the cycle
 * tracker's "why am I late?" and training readiness can ask {@link wasMarkedIll}.
 */
import { readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";

export const ROUGH_DAYS_KEY = "@welliva_rough_days";

/** Rough days a calendar month that pause the streak (owner, 2026-11-03: five). */
export const ROUGH_DAYS_PER_MONTH = 5;

/** How long a record is kept. A year of history is plenty for "how often". */
const ROUGH_DAYS_CAP = 400;

export type RoughReason = "ill" | "exhausted" | "bad-news" | "travelling" | "other";

export const ROUGH_REASONS: readonly { value: RoughReason; label: string }[] = [
  { value: "ill", label: "Ill" },
  { value: "exhausted", label: "Exhausted" },
  { value: "bad-news", label: "Bad news" },
  { value: "travelling", label: "Travelling" },
  { value: "other", label: "Something else" },
];

export interface RoughDay {
  /** Local YYYY-MM-DD — the identity; one per day. */
  date: string;
  reason?: RoughReason;
  /** Inside the month's cap: the streak is paused for this day. */
  protected: boolean;
  /** What they chose instead of the planned workout, if they chose. */
  workout?: "walk" | "rest";
  /** UTC ISO. */
  createdAt: string;
  /** UTC ISO of the last change — what a merge compares, as a string. */
  updatedAt: string;
  /** Taken back ("I'm OK actually"). Kept so the removal travels. */
  deleted?: boolean;
}

// ── pure reads ──────────────────────────────────────────────────────

export function liveRoughDays(list: readonly RoughDay[]): RoughDay[] {
  return list.filter((r) => !r.deleted);
}

/** The rough day on `date`, if one is standing. */
export function roughDayOn(list: readonly RoughDay[], date: string): RoughDay | null {
  return list.find((r) => r.date === date && !r.deleted) ?? null;
}

export function isRoughDay(list: readonly RoughDay[], date: string): boolean {
  return roughDayOn(list, date) !== null;
}

/**
 * Was `date` marked a rough day because they were ill? The one read other
 * features need (the cycle's "why am I late?", training readiness). A day
 * marked without a reason answers false — never assume.
 */
export function wasMarkedIll(list: readonly RoughDay[], date: string): boolean {
  return roughDayOn(list, date)?.reason === "ill";
}

/** Protected rough days in `today`'s calendar month. */
export function protectedThisMonth(list: readonly RoughDay[], today: string): number {
  const month = today.slice(0, 7);
  return liveRoughDays(list).filter((r) => r.protected && r.date.slice(0, 7) === month).length;
}

/** Can one more rough day this month pause the streak? */
export function canProtect(list: readonly RoughDay[], today: string): boolean {
  const existing = roughDayOn(list, today);
  if (existing?.protected) return true;
  return protectedThisMonth(list, today) < ROUGH_DAYS_PER_MONTH;
}

/** Days the streak treats as paused: protected rough days, standing. */
export function pausedDates(list: readonly RoughDay[]): string[] {
  return liveRoughDays(list)
    .filter((r) => r.protected)
    .map((r) => r.date)
    .sort();
}

// ── pure writes ─────────────────────────────────────────────────────

function sorted(list: RoughDay[]): RoughDay[] {
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-ROUGH_DAYS_CAP);
}

/** The record with `date` marked rough. Protection is decided here, by the cap. */
export function withRoughDay(
  list: readonly RoughDay[],
  input: { date: string; reason?: RoughReason; now: Date },
): RoughDay[] {
  const prior = list.find((r) => r.date === input.date);
  const stamp = input.now.toISOString();
  const row: RoughDay = {
    date: input.date,
    ...(input.reason ? { reason: input.reason } : {}),
    protected: canProtect(list, input.date),
    createdAt: prior && !prior.deleted ? prior.createdAt : stamp,
    updatedAt: stamp,
  };
  return sorted([...list.filter((r) => r.date !== input.date), row]);
}

/** The record with `date` taken back — a tombstone. */
export function withoutRoughDay(list: readonly RoughDay[], date: string, now: Date): RoughDay[] {
  const prior = list.find((r) => r.date === date);
  if (!prior || prior.deleted) return [...list];
  const row: RoughDay = { ...prior, deleted: true, updatedAt: now.toISOString() };
  return sorted([...list.filter((r) => r.date !== date), row]);
}

/** The record with today's workout choice set. */
export function withWorkoutChoice(
  list: readonly RoughDay[],
  date: string,
  choice: "walk" | "rest",
  now: Date,
): RoughDay[] {
  const prior = roughDayOn(list, date);
  if (!prior) return [...list];
  return sorted([
    ...list.filter((r) => r.date !== date),
    { ...prior, workout: choice, updatedAt: now.toISOString() },
  ]);
}

// ── storage ─────────────────────────────────────────────────────────

type Listener = (list: RoughDay[]) => void;
const listeners = new Set<Listener>();

export function subscribeRoughDays(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function isRough(v: unknown): v is RoughDay {
  const r = v as RoughDay;
  return !!r && typeof r.date === "string" && typeof r.updatedAt === "string";
}

export async function loadRoughDays(): Promise<RoughDay[]> {
  try {
    const raw = await readJSON<unknown>(ROUGH_DAYS_KEY, []);
    return Array.isArray(raw) ? raw.filter(isRough) : [];
  } catch {
    return [];
  }
}

let chain: Promise<unknown> = Promise.resolve();

function update(mutate: (list: RoughDay[]) => RoughDay[]): Promise<RoughDay[]> {
  const run = chain.then(async () => {
    const next = mutate(await loadRoughDays());
    await writeJSON(ROUGH_DAYS_KEY, next);
    for (const fn of [...listeners]) {
      try {
        fn(next);
      } catch {
        // one bad listener must not stop the others
      }
    }
    return next;
  });
  chain = run.catch(() => undefined);
  return run;
}

/** Mark TODAY rough. There is no other day it can be. */
export function markRoughDay(reason?: RoughReason, now: Date = new Date()): Promise<RoughDay[]> {
  return update((list) => withRoughDay(list, { date: toLocalDateString(now), reason, now }));
}

/** "I'm OK actually" — today back to normal. */
export function clearRoughDay(now: Date = new Date()): Promise<RoughDay[]> {
  return update((list) => withoutRoughDay(list, toLocalDateString(now), now));
}

/** Gentle walk or rest, for today's rough day. */
export function chooseRoughWorkout(choice: "walk" | "rest", now: Date = new Date()): Promise<RoughDay[]> {
  return update((list) => withWorkoutChoice(list, toLocalDateString(now), choice, now));
}

/** Is today a rough day? Read fresh — the headless and the live app agree. */
export async function roughToday(now: Date = new Date()): Promise<RoughDay | null> {
  return roughDayOn(await loadRoughDays(), toLocalDateString(now));
}
