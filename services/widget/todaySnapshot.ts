/**
 * THE WIDGET'S DAY — one small stored snapshot of today, which the app writes
 * and the home-screen widget reads.
 *
 * The widget renders in a headless task every half hour, often with the app
 * closed. That task must stay light (a sub-1 GB phone, no React tree, no food
 * catalogs), so it never reads the logs itself: the app gathers today's facts
 * when they change and stores them here, and the widget only combines this
 * snapshot with the CURRENT time (the word moves from "fresh" to "quiet", the
 * line grows to now).
 *
 * Honesty rules:
 *   - every bead is a real log at its real time; habits and weigh-ins store a
 *     day but no time, so they are stamped the first time the app sees them
 *     (exact when ticked in the app, a little late when ticked elsewhere);
 *   - the gold starts at the earliest moment that really keeps a day — the
 *     whole-water-goal pour, never the first glass;
 *   - a snapshot from yesterday never shows as today: the widget starts the new
 *     day empty, and carries over only that yesterday was kept.
 *
 * Device-local (services/sync/syncKeys DEVICE_LOCAL_KEYS): it is a cache of
 * this phone's widget, rebuilt from the synced logs at any time.
 */

import { readCommitment, shiftDay, type StreakLike } from "../commitment";
import { readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";
import type { Moment, MomentKind } from "./todayArt";
import type { DayFacts } from "./todayWords";

export const TODAY_WIDGET_KEY = "@welliva_widget_today";

/** Calories within this share of target count towards "nourished". */
const NOURISHED_BAND = 0.1;
/** Beads kept per kind; a day of forty glasses must not become forty beads. */
const MAX_MOMENTS_PER_KIND = 12;

export interface TodaySnapshot {
  v: 1;
  /** Local YYYY-MM-DD it describes. */
  date: string;
  moments: Moment[];
  kept: boolean;
  keptAtMin: number | null;
  keptYesterday: boolean;
  streak: number;
  daysAway: number | null;
  rough: boolean;
  freezeHeld: boolean;
  workoutDone: boolean;
  waterGoalMet: boolean;
  nourished: boolean;
  /** First-seen minute per undated moment ("habit:<id>", "weigh"). Today only. */
  seen: Record<string, number>;
  /** ISO time of the write. */
  writtenAt: string;
}

/** What the app hands in. Every list may hold other days; only today's count. */
export interface TodayInputs {
  now: Date;
  foodLogs: readonly { loggedAt: string }[];
  mealTicks: readonly { at: string }[];
  pours: readonly { at: string; ml: number }[];
  waterGoalMl: number;
  workouts: readonly { date: string; completedAt?: string }[];
  moods: readonly { date: string; createdAt?: number }[];
  /** Ids of the habits done today. */
  habitsDone: readonly string[];
  weighedToday: boolean;
  streak: StreakLike;
  rough: boolean;
  freezeHeld?: boolean;
  calories: { consumed: number; target: number } | null;
  protein: { consumed: number; target: number } | null;
  /** The last snapshot, for the first-seen stamps. */
  previous: TodaySnapshot | null;
}

function minuteOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** The local minute of an ISO time that falls on `date`, else null. */
function minuteOn(iso: string | undefined, date: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || toLocalDateString(d) !== date) return null;
  return minuteOf(d);
}

/** The minute the whole water goal was crossed today, or null. */
export function waterGoalMinute(
  pours: readonly { at: string; ml: number }[],
  goalMl: number,
  date: string,
): number | null {
  if (!(goalMl > 0)) return null;
  const today = pours
    .map((p) => ({ min: minuteOn(p.at, date), ml: Number(p.ml) || 0 }))
    .filter((p): p is { min: number; ml: number } => p.min != null)
    .sort((a, b) => a.min - b.min);
  let total = 0;
  for (const p of today) {
    total += p.ml;
    if (total >= goalMl) return p.min;
  }
  return null;
}

export function buildTodaySnapshot(inp: TodayInputs): TodaySnapshot {
  const date = toLocalDateString(inp.now);
  const nowMin = minuteOf(inp.now);
  const prevSeen = inp.previous?.date === date ? inp.previous.seen : {};
  const seen: Record<string, number> = {};
  const stamp = (key: string) => {
    seen[key] = prevSeen[key] ?? nowMin;
    return seen[key];
  };

  const moments: Moment[] = [];
  const add = (kind: MomentKind, min: number | null) => {
    if (min != null) moments.push({ min, kind });
  };
  for (const f of inp.foodLogs) add("food", minuteOn(f.loggedAt, date));
  for (const t of inp.mealTicks) add("food", minuteOn(t.at, date));
  for (const p of inp.pours) add("water", minuteOn(p.at, date));
  for (const w of inp.workouts) if (w.date === date) add("move", minuteOn(w.completedAt, date) ?? stamp(`move:${w.completedAt ?? ""}`));
  for (const m of inp.moods) {
    if (m.date !== date) continue;
    add("mood", typeof m.createdAt === "number" ? minuteOn(new Date(m.createdAt).toISOString(), date) : null);
  }
  for (const id of inp.habitsDone) add("habit", stamp(`habit:${id}`));
  if (inp.weighedToday) add("weigh", stamp("weigh"));

  // Keep the newest few of each kind, in time order.
  const byKind = new Map<MomentKind, Moment[]>();
  for (const m of moments.sort((a, b) => a.min - b.min)) {
    const list = byKind.get(m.kind) ?? [];
    list.push(m);
    byKind.set(m.kind, list);
  }
  const dayMoments = [...byKind.values()]
    .flatMap((l) => l.slice(-MAX_MOMENTS_PER_KIND))
    .sort((a, b) => a.min - b.min);

  const state = readCommitment(inp.streak, date);
  const kept = state.keptToday;
  const waterMin = waterGoalMinute(inp.pours, inp.waterGoalMl, date);
  let keptAtMin: number | null = null;
  if (kept) {
    // The earliest moment that really keeps a day: anything but water, or the
    // pour that met the whole water goal.
    const keeping = dayMoments.filter((m) => m.kind !== "water").map((m) => m.min);
    if (waterMin != null) keeping.push(waterMin);
    const previousKept = inp.previous?.date === date ? inp.previous.keptAtMin : null;
    keptAtMin = keeping.length ? Math.min(...keeping) : (previousKept ?? nowMin);
  }

  const yesterday = shiftDay(date, -1);
  const days = inp.streak.days ?? [];
  const keptYesterday = days.includes(yesterday) || inp.streak.lastActiveDate === yesterday;
  const before = [...days].filter((d) => d < date).sort();
  const last = before[before.length - 1] ?? (inp.streak.lastActiveDate && inp.streak.lastActiveDate < date ? inp.streak.lastActiveDate : null);
  const daysAway = last ? dayGap(last, date) : null;

  const cal = inp.calories;
  const pro = inp.protein;
  const nourished =
    !!cal && !!pro && cal.target > 0 && pro.target > 0 &&
    Math.abs(cal.consumed - cal.target) <= cal.target * NOURISHED_BAND &&
    pro.consumed >= pro.target;

  return {
    v: 1,
    date,
    moments: dayMoments,
    kept,
    keptAtMin,
    keptYesterday,
    streak: state.streak,
    daysAway,
    rough: inp.rough,
    freezeHeld: !!inp.freezeHeld,
    workoutDone: inp.workouts.some((w) => w.date === date),
    waterGoalMet: waterMin != null,
    nourished,
    seen,
    writtenAt: new Date(inp.now.getTime()).toISOString(),
  };
}

function dayGap(from: string, to: string): number {
  let n = 0;
  let d = from;
  while (d < to && n < 4000) {
    d = shiftDay(d, 1);
    n++;
  }
  return n;
}

/**
 * The facts the word and the line read, for THIS moment. A snapshot from
 * another day is never shown as today.
 */
export function factsFor(
  snap: TodaySnapshot | null,
  now: Date,
): { facts: DayFacts; moments: Moment[]; keptAtMin: number | null } {
  const date = toLocalDateString(now);
  const base: DayFacts = {
    date,
    weekday: now.getDay(),
    dayOfMonth: now.getDate(),
    minute: minuteOf(now),
    anyLogged: false,
    kept: false,
    keptAtMin: null,
    keptYesterday: false,
    streak: 0,
    daysAway: null,
    rough: false,
    freezeHeld: false,
    workoutDone: false,
    waterGoalMet: false,
    nourished: false,
    kinds: 0,
  };
  if (snap && snap.v === 1 && snap.date === date) {
    const moments = Array.isArray(snap.moments) ? snap.moments : [];
    return {
      facts: {
        ...base,
        anyLogged: moments.length > 0,
        kept: !!snap.kept,
        keptAtMin: snap.keptAtMin,
        keptYesterday: !!snap.keptYesterday,
        streak: Number(snap.streak) || 0,
        daysAway: snap.daysAway,
        rough: !!snap.rough,
        freezeHeld: !!snap.freezeHeld,
        workoutDone: !!snap.workoutDone,
        waterGoalMet: !!snap.waterGoalMet,
        nourished: !!snap.nourished,
        kinds: new Set(moments.map((m) => m.kind)).size,
      },
      moments,
      keptAtMin: snap.kept ? snap.keptAtMin : null,
    };
  }
  // Yesterday's snapshot on a new day: nothing logged yet today, and only the
  // fact that yesterday was kept carries over (the run is still alive).
  if (snap && snap.v === 1 && snap.date === shiftDay(date, -1) && snap.kept) {
    return {
      facts: { ...base, keptYesterday: true, streak: Number(snap.streak) || 0, daysAway: 1 },
      moments: [],
      keptAtMin: null,
    };
  }
  return { facts: base, moments: [], keptAtMin: null };
}

export async function readTodaySnapshot(): Promise<TodaySnapshot | null> {
  const s = await readJSON<TodaySnapshot | null>(TODAY_WIDGET_KEY, null);
  return s && typeof s === "object" && s.v === 1 ? s : null;
}

export async function writeTodaySnapshot(snap: TodaySnapshot): Promise<void> {
  await writeJSON(TODAY_WIDGET_KEY, snap);
}
