/**
 * services/routine/tickTimes.ts
 *
 * WHEN A HABIT WAS TICKED — the time of day the habit log never kept.
 *
 * `@welliva_habit_logs` stores dates only (models/habit `HabitLogs`). It syncs
 * as one blob and every streak, heatmap and widget reads its shape, so the time
 * is kept BESIDE it rather than inside it: one small record per habit per day,
 * read only by the routine clock (./clock).
 *
 * The rules:
 *
 *   · ONLY A SAME-DAY TICK HAS A TIME. Ticking yesterday's habit this morning
 *     says when it was remembered, not when it was done — so a tick whose day
 *     is not today records nothing.
 *   · HOW IT ARRIVED IS KEPT. A press on a reminder's own button carries the
 *     moment that reminder fired, so the clock can tell "did it because the
 *     phone buzzed" from "does it at this time".
 *   · AN UN-TICK LEAVES A TOMBSTONE. The record syncs and is merged entry by
 *     entry (services/sync/mergeStrategies); deleting the entry would let the
 *     other phone's copy merge it straight back. A removal is a newer write
 *     marked `deleted`, which wins the merge.
 *
 * Two writers (the tracker in React, the lock-screen button with no React at
 * all) go through one serialized read-modify-write, like the log itself.
 */
import { toISOWithOffset } from "../../health-os/platform/clock";
import { readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";
import { shiftDay } from "../commitment";

export const HABIT_TICK_TIMES_KEY = "@welliva_habit_tick_times";

/** The newest ticks kept per habit. The clock reads three weeks of them. */
export const TICKS_PER_HABIT = 60;

/** Records older than this are dropped, tombstones included. */
export const TICK_RETENTION_DAYS = 120;

export interface HabitTickTime {
  /** `habitId:date` — one record per habit per day, and the merge identity. */
  id: string;
  habitId: string;
  /** Local YYYY-MM-DD the tick was for. */
  date: string;
  /** When it was ticked: local ISO with its offset. */
  at: string;
  /** In the app, or from a reminder's own lock-screen button. */
  via: "app" | "notification";
  /** When the reminder carrying the button fired (notification ticks only). */
  firedAt?: string;
  /**
   * Last write to this record — what a merge compares, AS A STRING. So it is
   * UTC ("…Z"): two times with different offsets do not sort by their text.
   */
  updatedAt: string;
  /** Un-ticked. Kept so the removal outlives the copy on another phone. */
  deleted?: boolean;
}

export const tickId = (habitId: string, date: string): string => `${habitId}:${date}`;

function isTick(v: unknown): v is HabitTickTime {
  if (!v || typeof v !== "object") return false;
  const t = v as HabitTickTime;
  return (
    typeof t.id === "string" &&
    typeof t.habitId === "string" &&
    typeof t.date === "string" &&
    typeof t.updatedAt === "string"
  );
}

/** Newest-dated `TICKS_PER_HABIT` per habit, nothing past retention, oldest write first. */
function tidy(list: readonly HabitTickTime[], today: string): HabitTickTime[] {
  const floor = shiftDay(today, -TICK_RETENTION_DAYS);
  const perHabit = new Map<string, HabitTickTime[]>();
  for (const t of list) {
    if (t.date < floor) continue;
    const rows = perHabit.get(t.habitId) ?? [];
    rows.push(t);
    perHabit.set(t.habitId, rows);
  }
  const out: HabitTickTime[] = [];
  for (const rows of perHabit.values()) {
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    out.push(...rows.slice(0, TICKS_PER_HABIT));
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0));
}

/** The record with a tick written in (replacing that day's, live or tombstoned). */
export function withTick(
  list: readonly HabitTickTime[],
  tick: Omit<HabitTickTime, "id" | "updatedAt" | "deleted">,
  now: Date,
): HabitTickTime[] {
  const id = tickId(tick.habitId, tick.date);
  const row: HabitTickTime = { ...tick, id, updatedAt: now.toISOString() };
  return tidy([...list.filter((t) => t.id !== id), row], toLocalDateString(now));
}

/**
 * The record with that day's tick removed — as a tombstone, written even when
 * this phone never saw the tick, because the other phone may have.
 */
export function withoutTick(
  list: readonly HabitTickTime[],
  habitId: string,
  date: string,
  now: Date,
): HabitTickTime[] {
  const id = tickId(habitId, date);
  const prior = list.find((t) => t.id === id);
  const row: HabitTickTime = {
    id,
    habitId,
    date,
    at: prior?.at ?? toISOWithOffset(now),
    via: prior?.via ?? "app",
    updatedAt: now.toISOString(),
    deleted: true,
  };
  return tidy([...list.filter((t) => t.id !== id), row], toLocalDateString(now));
}

/** One habit's live ticks (tombstones left out), oldest day first. */
export function liveTicksFor(
  list: readonly HabitTickTime[],
  habitId: string,
): HabitTickTime[] {
  return list
    .filter((t) => t.habitId === habitId && !t.deleted)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ── storage ─────────────────────────────────────────────────────────

export async function loadTickTimes(): Promise<HabitTickTime[]> {
  const raw = await readJSON<unknown>(HABIT_TICK_TIMES_KEY, []);
  return Array.isArray(raw) ? raw.filter(isTick) : [];
}

let chain: Promise<unknown> = Promise.resolve();

function update(mutate: (list: HabitTickTime[]) => HabitTickTime[] | null): Promise<void> {
  const run = chain.then(async () => {
    const next = mutate(await loadTickTimes());
    if (next) await writeJSON(HABIT_TICK_TIMES_KEY, next);
  });
  chain = run.catch(() => undefined);
  return run;
}

/**
 * Record WHEN a habit was ticked. A tick for any day but today records nothing
 * (see the header). Never throws: the tick itself is already saved, and a
 * missing time only means the clock has one day less to read.
 */
export async function recordHabitTick(
  habitId: string,
  date: string,
  via: HabitTickTime["via"],
  options: { firedAt?: Date | null; now?: Date } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  if (date !== toLocalDateString(now)) return;
  try {
    await update((list) =>
      withTick(
        list,
        {
          habitId,
          date,
          at: toISOWithOffset(now),
          via,
          ...(via === "notification" && options.firedAt
            ? { firedAt: toISOWithOffset(options.firedAt) }
            : {}),
        },
        now,
      ),
    );
  } catch {
    // see above — the time is a courtesy to the clock, never part of the tick
  }
}

/** An un-tick: tombstone that day's time. Never throws. */
export async function clearHabitTick(
  habitId: string,
  date: string,
  now: Date = new Date(),
): Promise<void> {
  try {
    await update((list) => withoutTick(list, habitId, date, now));
  } catch {
    // the un-tick itself is already saved
  }
}
