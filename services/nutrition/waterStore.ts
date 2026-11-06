/**
 * services/nutrition/waterStore.ts
 *
 * TODAY'S WATER, written from two places that must never overwrite each other.
 *
 * Water was a number held in React state and written back from it
 * (`setWaterMl(prev => { writeJSON(prev + ml) })`). That is fine while React is
 * the only writer. It stops being fine the moment a lock-screen "Drank a glass"
 * button writes the same number with no React tree involved: the next in-app tap
 * would compute from its stale `prev` and silently erase the glass logged from
 * the lock screen. So every write — in-app or not — goes through here as a
 * serialized READ-MODIFY-WRITE against storage, and React adopts the result.
 *
 * ── WHICH DAY A GLASS BELONGS TO ────────────────────────────────────────────
 * `WATER_TODAY` is not "today's water". It is the water of the app's LAST ACTIVE
 * DAY (`LAST_ACTIVE_DATE`), and it only becomes today's once the app has opened
 * today and archived yesterday's total. A lock-screen tap can arrive before that
 * — the first glass of the morning, pressed on a phone that hasn't opened the app
 * since last night. Adding it to `WATER_TODAY` then would hand it to yesterday,
 * because the rollover archives whatever that counter holds under the old date.
 *
 * So a glass is written to the counter ONLY when it is for the counter's day.
 * Anything else waits in a small device-local INBOX and is folded in by the app
 * once its day is current ({@link drainWaterInbox}): a glass for today lands on
 * the counter, a late press for a closed day lands on that day's history row.
 * Nothing is dropped, and nothing lands on the wrong day.
 */
import {
  KEYS,
  readJSON,
  readString,
  todayDate,
  writeJSON,
  type WaterHistoryEntry,
} from "../OfflineStorage";
import { markActivated, track } from "../telemetry";
import {
  appendPour,
  asPourLog,
  dropPour,
  newPourId,
  type Pour,
  type PourLog,
} from "./waterPours";

/** Glasses pressed on a day the counter wasn't holding yet. Device-local. */
export const WATER_INBOX_KEY = "@welliva_water_inbox";

/**
 * The drinks that built today's counter (services/nutrition/waterPours).
 * Device-local: the total syncs on its own, and a drink-by-drink list from one
 * phone cannot be merged into another's without inventing water.
 */
export const WATER_POURS_KEY = "@welliva_water_pours";

/** Same cap as the history archive (OfflineStorage). */
const WATER_HISTORY_MAX = 90;

export interface WaterInboxEntry {
  /** Local YYYY-MM-DD the glass was for. */
  date: string;
  ml: number;
  /** ISO time it was recorded. */
  at: string;
}

let chain: Promise<unknown> = Promise.resolve();

/** Run `fn` after every earlier water write has finished — one writer at a time. */
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

function sanitize(ml: number): number {
  return Number.isFinite(ml) && ml > 0 ? Math.round(ml) : 0;
}

/* ───────────────────────────── the drinks list ───────────────────────────────
 * Every write to the counter below also leaves a pour, inside the SAME serialized
 * step, so the list and the total cannot be written by two different paths that
 * disagree about what happened. The counter write comes first and is the one that
 * matters: a pour that fails to write is logged and dropped, never allowed to
 * undo or block a glass of water.
 */

type PourListener = (log: PourLog | null) => void;
const pourListeners = new Set<PourListener>();

/** Hear about every change to the list — the screen that shows it re-reads from this. */
export function subscribeWaterPours(fn: PourListener): () => void {
  pourListeners.add(fn);
  return () => {
    pourListeners.delete(fn);
  };
}

function announcePours(log: PourLog | null): void {
  for (const fn of pourListeners) {
    try {
      fn(log);
    } catch (e) {
      // One bad listener must not stop the others, or block the write.
      console.error("[water] pour listener failed:", e);
    }
  }
}

/** The day the counter is holding — the app's last active day, else today. */
async function counterDate(): Promise<string> {
  return (await readString(KEYS.LAST_ACTIVE_DATE, "")) || todayDate();
}

/** The stored list, or null when there is none (or it is unreadable). */
export async function readWaterPours(): Promise<PourLog | null> {
  return asPourLog(await readJSON<unknown>(WATER_POURS_KEY, null));
}

/**
 * When `date`'s first glass was logged on this phone, or null. Read at the
 * rollover, while the drink list still holds the closing day, and kept on that
 * day's history row (OfflineStorage.archiveWaterDay) for the routine clock.
 */
export async function firstDrinkOn(date: string): Promise<string | null> {
  try {
    const log = await readWaterPours();
    if (!log || log.date !== date || log.pours.length === 0) return null;
    return log.pours.reduce((first, p) => (Date.parse(p.at) < Date.parse(first) ? p.at : first), log.pours[0].at);
  } catch {
    return null;
  }
}

async function recordPour(date: string, ml: number, at: string = new Date().toISOString()) {
  try {
    const log = appendPour(await readWaterPours(), date, {
      id: newPourId(Date.now(), Math.random()),
      ml,
      at,
    });
    await writeJSON(WATER_POURS_KEY, log);
    announcePours(log);
  } catch (e) {
    console.error("[water] could not record the drink:", e);
  }
}

/** The counter's current value (the last active day's water). */
export async function readWaterToday(): Promise<number> {
  const v = await readJSON<number>(KEYS.WATER_TODAY, 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** The counter with the day it belongs to (`LAST_ACTIVE_DATE`, "" if unknown). */
export async function readWaterCounter(): Promise<{ date: string; ml: number }> {
  const [date, ml] = await Promise.all([
    readString(KEYS.LAST_ACTIVE_DATE, ""),
    readWaterToday(),
  ]);
  return { date: date ?? "", ml };
}

/**
 * Add to the counter. The in-app path: the app is open, so its day is current
 * and the counter IS today. Returns the values either side of the write so the
 * caller can react to crossing the goal.
 */
export function addWaterToday(ml: number): Promise<{ prev: number; next: number }> {
  return serialized(async () => {
    const prev = await readWaterToday();
    const next = prev + sanitize(ml);
    if (next !== prev) await writeJSON(KEYS.WATER_TODAY, next);
    // Only a write counts. A no-op add (a zero, or a sanitize that rejected the
    // amount) is not someone logging water, and counting it would inflate the
    // one number that is supposed to mean "this install started being used".
    if (next !== prev) {
      track("water_logged");
      void markActivated();
      await recordPour(await counterDate(), next - prev);
    }
    return { prev, next };
  });
}

export type WaterWriteResult =
  | { where: "counter"; prev: number; next: number }
  | { where: "inbox" };

/**
 * Record a glass FOR a given date, from outside the app (the lock screen).
 * Lands on the counter only when the counter is holding that date; otherwise it
 * waits in the inbox for {@link drainWaterInbox}.
 */
export function logWaterFor(date: string, ml: number): Promise<WaterWriteResult> {
  const amount = sanitize(ml);
  return serialized(async (): Promise<WaterWriteResult> => {
    const counterDay = await readString(KEYS.LAST_ACTIVE_DATE, "");
    if (counterDay && counterDay === date) {
      const prev = await readWaterToday();
      const next = prev + amount;
      await writeJSON(KEYS.WATER_TODAY, next);
      if (amount > 0) await recordPour(date, amount);
      return { where: "counter", prev, next };
    }
    const inbox = await readJSON<WaterInboxEntry[]>(WATER_INBOX_KEY, []);
    await writeJSON(WATER_INBOX_KEY, [
      ...(Array.isArray(inbox) ? inbox : []),
      { date, ml: amount, at: new Date().toISOString() },
    ]);
    return { where: "inbox" };
  });
}

/** Add `ml` to a closed day's history row (creating it if the day had none). */
async function addToHistoryDay(
  date: string,
  ml: number,
  goalMl?: number,
): Promise<void> {
  const history = await readJSON<WaterHistoryEntry[]>(KEYS.WATER_HISTORY, []);
  const list = Array.isArray(history) ? [...history] : [];
  const i = list.findIndex((e) => e.date === date);
  if (i >= 0) list[i] = { ...list[i], ml: list[i].ml + ml };
  else list.push(goalMl != null ? { date, ml, goalMl } : { date, ml });
  list.sort((a, b) => a.date.localeCompare(b.date));
  await writeJSON(KEYS.WATER_HISTORY, list.slice(-WATER_HISTORY_MAX));
}

export interface DrainResult {
  /** Counter value before/after — equal when nothing was for today. */
  prev: number;
  next: number;
  /** How many inbox entries were applied. */
  applied: number;
}

/**
 * Fold waiting glasses into the right place. Only runs once the app's day is
 * current (`LAST_ACTIVE_DATE === today`): before the rollover, "today" on the
 * counter still means yesterday, and folding then would repeat the exact bug the
 * inbox exists to prevent. Entries for a future date (clock skew) stay put.
 *
 * @param goalMl stamped on a history row this creates, like the archiver does
 */
export function drainWaterInbox(goalMl?: number, today = todayDate()): Promise<DrainResult> {
  return serialized(async (): Promise<DrainResult> => {
    const prev = await readWaterToday();
    const counterDay = await readString(KEYS.LAST_ACTIVE_DATE, "");
    if (counterDay !== today) return { prev, next: prev, applied: 0 };

    const inbox = await readJSON<WaterInboxEntry[]>(WATER_INBOX_KEY, []);
    if (!Array.isArray(inbox) || inbox.length === 0) {
      return { prev, next: prev, applied: 0 };
    }

    let next = prev;
    const keep: WaterInboxEntry[] = [];
    const pastByDate = new Map<string, number>();
    const todays: { ml: number; at: string }[] = [];
    for (const e of inbox) {
      const ml = sanitize(e?.ml);
      if (!e?.date || ml === 0) continue;
      if (e.date === today) {
        next += ml;
        todays.push({ ml, at: e.at });
      } else if (e.date < today) pastByDate.set(e.date, (pastByDate.get(e.date) ?? 0) + ml);
      else keep.push(e);
    }
    for (const [date, ml] of pastByDate) await addToHistoryDay(date, ml, goalMl);
    if (next !== prev) await writeJSON(KEYS.WATER_TODAY, next);
    await writeJSON(WATER_INBOX_KEY, keep);
    // The glasses that waited for the day to turn are today's drinks now, and
    // they keep the time they were PRESSED, not the time the app caught up.
    for (const t of todays) await recordPour(today, t.ml, t.at || undefined);
    return { prev, next, applied: inbox.length - keep.length };
  });
}

export interface RemovedPour {
  /** The counter either side of the write. */
  prev: number;
  next: number;
  /** The drink that was taken back out; null when there was no such drink. */
  removed: Pour | null;
}

/**
 * Take one drink back out of today's water — the fix for a tap that should not
 * have happened. It lowers the counter by exactly that drink's amount and removes
 * it from the list in one serialized step, so the two cannot be left disagreeing.
 *
 * It only ever touches the counter's OWN day: a drink that belongs to a list
 * from another day (the rollover has not caught up yet) is left alone, rather
 * than subtracting yesterday's glass from today's number. Never below zero.
 */
export function removeWaterPour(id: string): Promise<RemovedPour> {
  return serialized(async (): Promise<RemovedPour> => {
    const prev = await readWaterToday();
    const log = await readWaterPours();
    if (!log || log.date !== (await counterDate())) return { prev, next: prev, removed: null };

    const { log: after, removed } = dropPour(log, id);
    if (!removed || !after) return { prev, next: prev, removed: null };

    const next = Math.max(0, prev - removed.ml);
    await writeJSON(KEYS.WATER_TODAY, next);
    await writeJSON(WATER_POURS_KEY, after);
    announcePours(after);
    return { prev, next, removed };
  });
}
