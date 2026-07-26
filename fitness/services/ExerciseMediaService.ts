/**
 * EXERCISE MEDIA — resolves a local EXERCISE_DATABASE movement to its
 * ExerciseDB demonstration GIF.
 *
 * Design constraints (mirrors the module's offline-first rules):
 *   • Zero-config = zero network. Without EXPO_PUBLIC_EXERCISEDB_* env the
 *     resolver returns null immediately and the UI renders without a demo —
 *     the app keeps working exactly as before the media layer existed.
 *   • Resolution is by name search against the ExerciseDB API, cached in
 *     AsyncStorage (positive + negative) so each exercise costs at most one
 *     lookup per TTL window; the GIF bytes themselves are cached by expo-image.
 *   • Pure helpers (normalize / match) are exported for the vitest suite.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@welliva_exercise_media_v1";
/** Re-resolve after a day — ExerciseDB GIF URLs can rotate. */
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
/** Retry misses/errors sooner. */
const NEGATIVE_TTL_MS = 60 * 60 * 1000;

/**
 * Per-exercise search-term overrides (local exercise id → ExerciseDB search
 * term) for movements whose Welliva name doesn't fuzzy-match ExerciseDB's
 * catalog. Tests enforce that every key is a real EXERCISE_DATABASE id.
 */
export const SEARCH_OVERRIDES: Record<string, string> = {};

export interface MediaCandidate {
  name: string;
  gifUrl: string;
}

interface CacheEntry {
  url: string | null;
  at: number;
}

export function getMediaConfig(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.EXPO_PUBLIC_EXERCISEDB_API_URL?.trim();
  const apiKey = process.env.EXPO_PUBLIC_EXERCISEDB_API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey };
}

export function isExerciseMediaConfigured(): boolean {
  return getMediaConfig() !== null;
}

/** Short words the generic plural rule below can't safely handle. */
const SMALL_WORD_FIXES: Record<string, string> = { ups: "up" };

/**
 * Normalize an exercise name into an ExerciseDB search term: lowercase,
 * punctuation → spaces, parenthetical qualifiers dropped, and simple plural
 * "s" stripped per word ("Push-ups (wide)" → "push up").
 */
export function normalizeSearchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SMALL_WORD_FIXES[w] ?? (w.length > 3 && !w.endsWith("ss") ? w.replace(/s$/, "") : w))
    .join(" ");
}

/**
 * Pick the most trustworthy candidate for a search term. Exact normalized
 * match wins; then the shortest name starting with the term; then the shortest
 * containing it. Anything less related returns null — a missing demo beats a
 * wrong demo.
 */
export function pickBestMatch(
  term: string,
  candidates: readonly MediaCandidate[],
): MediaCandidate | null {
  const q = normalizeSearchName(term);
  if (!q) return null;
  const scored = candidates
    .filter((c) => typeof c.gifUrl === "string" && c.gifUrl.length > 0)
    .map((c) => ({ c, n: normalizeSearchName(c.name) }));

  const exact = scored.find((s) => s.n === q);
  if (exact) return exact.c;

  const byLength = (a: { n: string }, b: { n: string }) => a.n.length - b.n.length;
  const prefixed = scored.filter((s) => s.n.startsWith(q)).sort(byLength);
  if (prefixed.length > 0) return prefixed[0].c;

  const containing = scored.filter((s) => s.n.includes(q)).sort(byLength);
  if (containing.length > 0) return containing[0].c;

  return null;
}

/* ── Cache (in-memory map hydrated once from AsyncStorage) ── */

let cache: Map<string, CacheEntry> | null = null;
let hydrating: Promise<Map<string, CacheEntry>> | null = null;

async function getCache(): Promise<Map<string, CacheEntry>> {
  if (cache) return cache;
  if (!hydrating) {
    hydrating = AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        cache = new Map(Object.entries(raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {}));
        return cache;
      })
      .catch(() => {
        cache = new Map();
        return cache;
      });
  }
  return hydrating;
}

async function persistCache(map: Map<string, CacheEntry>): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // Cache persistence is best-effort; in-memory copy still serves the session.
  }
}

/** Test hook: drop the in-memory cache so a fresh hydration occurs. */
export function __resetMediaCacheForTests(): void {
  cache = null;
  hydrating = null;
}

/* ── Resolution ── */

async function searchExerciseDb(term: string): Promise<MediaCandidate[]> {
  const config = getMediaConfig();
  if (!config) return [];
  const url = `${config.apiUrl}/exercises/name/${encodeURIComponent(term)}?limit=20`;
  const host = config.apiUrl.replace(/^https?:\/\//, "").split("/")[0];
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": config.apiKey,
      "X-RapidAPI-Host": host,
    },
  });
  if (!res.ok) throw new Error(`ExerciseDB ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) return [];
  return body.filter(
    (e): e is MediaCandidate =>
      !!e && typeof (e as MediaCandidate).name === "string" && typeof (e as MediaCandidate).gifUrl === "string",
  );
}

/**
 * Resolve the demo GIF URL for a local exercise. Returns null when media is
 * unconfigured, the exercise has no confident match, or the network failed
 * (cached stale value is served if present). Never throws.
 */
export async function resolveDemoUrl(
  exerciseId: string,
  exerciseName: string,
): Promise<string | null> {
  if (!isExerciseMediaConfigured()) return null;

  const map = await getCache();
  const hit = map.get(exerciseId);
  const now = Date.now();
  if (hit) {
    const ttl = hit.url ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    if (now - hit.at < ttl) return hit.url;
  }

  const term = SEARCH_OVERRIDES[exerciseId] ?? normalizeSearchName(exerciseName);
  try {
    const candidates = await searchExerciseDb(term);
    const best = pickBestMatch(term, candidates);
    map.set(exerciseId, { url: best?.gifUrl ?? null, at: now });
    void persistCache(map);
    return best?.gifUrl ?? null;
  } catch {
    // Offline / API error: serve the stale hit if we ever had one.
    return hit?.url ?? null;
  }
}
