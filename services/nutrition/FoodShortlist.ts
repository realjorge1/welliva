/**
 * FoodShortlist — the handful of foods this user actually eats.
 *
 * The Foods catalog is 205 items in a fixed alphabetical-within-group order,
 * which is the right shape for browsing and the wrong shape for logging. People
 * eat on repeat: the same eggs, the same rice, the same bread. Scrolling past
 * forty fruits to find eggs every morning is what separates a reference table
 * from a tool, so the two lists that matter get pinned above the catalog.
 *
 * FAVOURITES are explicit — the user starred them, and they stay until unstarred.
 * RECENTS are earned — logging a food moves it to the front. Both store only
 * catalog ids, never copies of the food, so a catalog update is picked up
 * automatically and a food that disappears from the catalog resolves to nothing
 * rather than to stale macros.
 */

import { KEYS, readJSON, writeJSON } from "../OfflineStorage";

/** How many recents we keep. Beyond this it stops being a shortcut. */
export const RECENTS_LIMIT = 12;

/** Favourites are user-curated, so the cap is generous — a guard, not a policy. */
export const FAVORITES_LIMIT = 60;

export interface Shortlist {
  favorites: string[];
  recents: string[];
}

export async function loadShortlist(): Promise<Shortlist> {
  const [favorites, recents] = await Promise.all([
    readJSON<string[]>(KEYS.FOOD_FAVORITES, []),
    readJSON<string[]>(KEYS.FOOD_RECENTS, []),
  ]);
  return {
    favorites: Array.isArray(favorites) ? favorites : [],
    recents: Array.isArray(recents) ? recents : [],
  };
}

/**
 * Star or unstar a food. Returns the new favourites list so the caller can set
 * state from the result rather than re-reading storage.
 */
export async function toggleFavorite(
  foodId: string,
  current: string[],
): Promise<string[]> {
  const next = current.includes(foodId)
    ? current.filter((id) => id !== foodId)
    : [foodId, ...current].slice(0, FAVORITES_LIMIT);
  await writeJSON(KEYS.FOOD_FAVORITES, next);
  return next;
}

/**
 * Move a food to the front of recents. Deduplicates rather than appending, so
 * logging eggs three days running leaves one entry at the top instead of three.
 */
export async function recordRecent(
  foodId: string,
  current: string[],
): Promise<string[]> {
  const next = [foodId, ...current.filter((id) => id !== foodId)].slice(
    0,
    RECENTS_LIMIT,
  );
  await writeJSON(KEYS.FOOD_RECENTS, next);
  return next;
}

/**
 * Resolve a list of ids against the catalog, preserving the ids' order and
 * silently dropping anything the catalog no longer has. Order matters: these
 * lists are ranked (most recent / most recently starred first), and sorting
 * them any other way throws away the only signal they carry.
 */
export function resolveIds<T extends { id: string }>(
  ids: string[],
  catalog: T[],
): T[] {
  if (ids.length === 0) return [];
  const byId = new Map(catalog.map((f) => [f.id, f]));
  return ids.map((id) => byId.get(id)).filter((f): f is T => f !== undefined);
}
