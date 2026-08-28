/**
 * DATA EPOCH — the counter that makes "Reset data" actually reset.
 *
 * THE BUG THIS EXISTS FOR. `purgeAppData()` empties AsyncStorage, and that used
 * to be the whole of the reset: the screen then called `router.replace("/")`
 * and called it done. But navigation doesn't remount providers — AppProvider,
 * MealPlanProvider and HabitsProvider all sit ABOVE the navigator and load
 * their state exactly once, on mount. So after a "reset" every byte was still
 * in memory: the user landed on Home with their bio, goals, plan and logs
 * intact, was never sent to onboarding as the confirmation promised, and the
 * next ordinary write (a glass of water) re-persisted the whole lot back to the
 * disk we had just wiped.
 *
 * THE FIX. app/_layout.tsx already re-keys the provider subtree on the account
 * id, precisely so one user's in-memory state can't leak into another's
 * session. A wipe wants the same thing for the same reason, so it folds into
 * the same key: bump this counter and React unmounts and rebuilds every
 * provider, which re-reads storage — now empty — from scratch. No dependency on
 * expo-updates (not installed), no manual "reset every useState" list that the
 * next piece of state would silently fall off.
 *
 * `useSyncExternalStore` rather than a context, because the one consumer is the
 * root layout itself — a provider above the providers would be circular.
 */
import { useSyncExternalStore } from "react";

let epoch = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return epoch;
}

/**
 * Discard every provider's in-memory state and rebuild it from storage.
 *
 * Call AFTER the data is gone, never before: the remount re-reads storage
 * immediately, so bumping first would just reload the data you were about to
 * delete.
 */
export function bumpDataEpoch(): void {
  epoch += 1;
  for (const listener of listeners) listener();
}

/** The current epoch, as a value that re-renders its reader when it changes. */
export function useDataEpoch(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
