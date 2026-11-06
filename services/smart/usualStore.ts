/**
 * services/smart/usualStore.ts
 *
 * "Not my usual any more" — the one thing about usuals that is stored. Usuals
 * themselves are read fresh from the food log every time (services/smart/usual);
 * this only remembers which ones the user turned away, and when.
 *
 * Synced and merged entry by entry (services/sync/mergeStrategies), so a usual
 * forgotten on the phone stays forgotten on the tablet. Nothing is ever deleted
 * from it — a forget IS the tombstone. A forgotten usual can still come back,
 * but only from meals logged after the forget (see `findUsuals`).
 *
 * Lean on purpose: the lock-screen handler reads it with no React and no food
 * catalogs loaded.
 */
import { readJSON, remove, writeJSON } from "../OfflineStorage";
import type { ForgottenUsual } from "./usual";

export const USUALS_FORGOTTEN_KEY = "@welliva_usuals_forgotten";

/** Forgets kept. Each is a few dozen bytes; this bounds a runaway, nothing more. */
const FORGOTTEN_CAP = 200;

type Listener = (list: ForgottenUsual[]) => void;
const listeners = new Set<Listener>();

export function subscribeForgottenUsuals(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function announce(list: ForgottenUsual[]): void {
  for (const fn of [...listeners]) {
    try {
      fn(list);
    } catch {
      // one bad listener must not stop the others
    }
  }
}

export async function loadForgottenUsuals(): Promise<ForgottenUsual[]> {
  try {
    const raw = await readJSON<unknown>(USUALS_FORGOTTEN_KEY, []);
    return Array.isArray(raw)
      ? raw.filter((f): f is ForgottenUsual => !!f && typeof f.id === "string" && typeof f.at === "string")
      : [];
  } catch {
    return [];
  }
}

/** Forget a usual from now on. */
export async function forgetUsual(id: string, now: Date = new Date()): Promise<void> {
  const list = await loadForgottenUsuals();
  const next = [{ id, at: now.toISOString() }, ...list.filter((f) => f.id !== id)].slice(0, FORGOTTEN_CAP);
  await writeJSON(USUALS_FORGOTTEN_KEY, next);
  announce(next);
}

/** "Clear memory": every usual may be offered again. A removed key syncs as a deletion. */
export async function clearForgottenUsuals(): Promise<void> {
  await remove(USUALS_FORGOTTEN_KEY);
  announce([]);
}
