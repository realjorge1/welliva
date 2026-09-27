/**
 * "NOT NOW" — dismissals that expire on their own.
 *
 * The old Action Bar could not be told no. Ignore "Log your weight" and it sat
 * there, which is precisely the cosmetic nudge the rest of this app refuses to
 * ship. But the obvious fix — a permanent "seen it" flag — is worse: a weigh-in
 * you waved away in March must not be gone in April, and a lunch you were too
 * busy to log at 12:40 is a perfectly good prompt again tomorrow.
 *
 * So a dismissal is a LEASE, never a tombstone. Every one carries the moment it
 * lapses, and the ladder itself says when that is:
 *
 *   · a meal in its window   → the end of that window (`staleAfterMinute`).
 *     The narrowest lease in the app, and the reason this needs no memory that
 *     outlives the afternoon.
 *   · everything else        → local midnight. Tomorrow asks again, because
 *     tomorrow it is true again.
 *
 * WHY IT PERSISTS AT ALL. A lease that lived in memory would be spent by the
 * next cold start, and people background this app between every meal — "not
 * now" would have meant "until you lock your phone". Storage is one small
 * record, written on a dismissal and pruned whenever it is read.
 *
 * THE CLOCK COMES IN FROM OUTSIDE. `currentDate` is AppContext's day (the one
 * clock every write in this app already uses) and the expiry is computed from
 * it rather than from `Date.now()` at read time, so a lease cannot be extended
 * by a device that rolls over midnight while the app is open — see the day
 * rollover in the intake ledger for the same rule.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NextMove } from "./nextMove";

/**
 * The `@welliva_` prefix is load-bearing, not decoration: `purgeAppData` finds
 * app-owned keys by PREFIX SCAN, so a key outside the namespace survives a sign
 * out and hands the next account on this phone the last one's dismissals. It is
 * also listed in `DEVICE_LOCAL_KEYS`, which keeps it off the sync engine — see
 * services/sync/syncKeys.ts for why a lease has no business travelling.
 */
const STORAGE_KEY = "@welliva_deck_dismissed_v1";

/** id → epoch milliseconds at which the lease lapses. */
type LeaseMap = Record<string, number>;

/**
 * Local midnight of `date` ("YYYY-MM-DD") plus `minutes`.
 *
 * Built from the date string rather than from a timestamp so it lands on the
 * calendar day the user is living in, not on a UTC boundary — the same reason
 * `daysSinceWeighIn` counts off date strings.
 */
function atMinuteOfDay(date: string, minutes: number): number {
  const midnight = Date.parse(`${date}T00:00:00`);
  if (!Number.isFinite(midnight)) return Date.now();
  return midnight + minutes * 60_000;
}

/** When a lease on this move should lapse. */
export function leaseUntil(move: NextMove, date: string): number {
  return move.staleAfterMinute !== undefined
    ? atMinuteOfDay(date, move.staleAfterMinute)
    : // Local midnight tonight — the start of tomorrow, which is when every
      // non-meal prompt becomes honest again.
      atMinuteOfDay(date, 24 * 60);
}

/** Drop every lease that has lapsed. Returns a new map only when one had. */
function prune(leases: LeaseMap, now: number): LeaseMap | null {
  const live: LeaseMap = {};
  let dropped = false;
  for (const [id, until] of Object.entries(leases)) {
    if (until > now) live[id] = until;
    else dropped = true;
  }
  return dropped ? live : null;
}

export interface Dismissals {
  /** True while this move is under a live lease and must stay out of the dock. */
  isDismissed: (id: string) => boolean;
  /** Take a lease on this move. A move that says it is not dismissible is a no-op. */
  dismiss: (move: NextMove) => void;
  /** Hand one back early — the agenda's undo. */
  restore: (id: string) => void;
  /** Wipe the lot. The "Reset data" path, and the tests'. */
  clear: () => Promise<void>;
}

export function useDismissals(currentDate: string, minutesOfDay: number): Dismissals {
  const [leases, setLeases] = useState<LeaseMap>({});

  /**
   * The live map, readable from a callback without making every consumer of
   * `dismiss` depend on the current state — the dock re-renders on the minute
   * tick already and does not need a second reason.
   */
  const ref = useRef<LeaseMap>({});
  ref.current = leases;

  // Read once, pruning on the way in. A lease that lapsed while the app was
  // closed must never come back to life for one frame.
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw) as LeaseMap;
        setLeases(prune(parsed, Date.now()) ?? parsed);
      })
      .catch(() => {
        // A corrupt record is not worth a crash: an empty map simply means
        // every prompt is offered, which is the safe direction to fail in.
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Prune on the clock, not only on write. The dock re-derives every minute, so
   * a lunch lease that lapsed at 15:00 has the row back within the minute
   * rather than on the next launch.
   */
  useEffect(() => {
    const live = prune(ref.current, Date.now());
    if (!live) return;
    setLeases(live);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(live)).catch(() => {});
  }, [minutesOfDay, currentDate]);

  const write = useCallback((next: LeaseMap) => {
    setLeases(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const dismiss = useCallback(
    (move: NextMove) => {
      if (!move.dismissible) return;
      write({ ...ref.current, [move.id]: leaseUntil(move, currentDate) });
    },
    [currentDate, write],
  );

  const restore = useCallback(
    (id: string) => {
      if (!(id in ref.current)) return;
      const next = { ...ref.current };
      delete next[id];
      write(next);
    },
    [write],
  );

  const isDismissed = useCallback((id: string) => id in leases, [leases]);

  const clear = useCallback(async () => {
    setLeases({});
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  // Stable identity, so the Deck's agenda memo recomputes when a lease changes
  // and not on every render of a component that re-derives on the minute.
  return useMemo(
    () => ({ isDismissed, dismiss, restore, clear }),
    [isDismissed, dismiss, restore, clear],
  );
}
