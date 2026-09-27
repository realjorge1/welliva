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

/** Glasses pressed on a day the counter wasn't holding yet. Device-local. */
export const WATER_INBOX_KEY = "@welliva_water_inbox";

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
    for (const e of inbox) {
      const ml = sanitize(e?.ml);
      if (!e?.date || ml === 0) continue;
      if (e.date === today) next += ml;
      else if (e.date < today) pastByDate.set(e.date, (pastByDate.get(e.date) ?? 0) + ml);
      else keep.push(e);
    }
    for (const [date, ml] of pastByDate) await addToHistoryDay(date, ml, goalMl);
    if (next !== prev) await writeJSON(KEYS.WATER_TODAY, next);
    await writeJSON(WATER_INBOX_KEY, keep);
    return { prev, next, applied: inbox.length - keep.length };
  });
}
