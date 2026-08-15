/**
 * CATALOG LOADER — offline-first remote catalogs (Phase D.4).
 *
 * The big generated catalogs (the clinical diet library + whole-foods dictionary)
 * used to ship inside the app bundle — ~1 MB baked into the native binary. They
 * now live as JSON in Supabase Storage and are fetched + cached on device, so the
 * binary (and the initial web bundle) no longer carries them. A small bundled
 * SEED keeps the diet/food features working on a first launch that happens to be
 * offline, until the real catalog is downloaded and cached.
 *
 * Resolution order (per catalog):
 *   1. on-device cache  — instant, fully offline; a fresh copy is refreshed in
 *      the background when the bundled manifest version has moved on,
 *   2. network (Supabase Storage) — on a cold cache,
 *   3. bundled seed — offline first launch / any failure.
 *
 * The supabase client is imported lazily (only when we actually hit the network)
 * so merely importing a catalog never constructs it — keeps this decoupled and
 * unit-testable without a configured backend.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const BUCKET = "catalogs";
const MANIFEST_FILE = "manifest.json";
const CACHE_PREFIX = "catalog:cache:"; // + name  → JSON array
const VERSION_PREFIX = "catalog:version:"; // + name → version string

export type CatalogSource = "cache" | "network" | "seed";

export interface CatalogResult<T> {
  items: T[];
  source: CatalogSource;
}

/**
 * Blob → text, across runtimes.
 *
 * Web (and Node) Blobs have `.text()`. React Native's Blob polyfill does NOT —
 * it carries a native blob id plus `size`/`type`/`slice()` and nothing else, so
 * calling `.text()` on a downloaded catalog threw "data.text is not a function"
 * on device and every catalog silently fell back to its bundled seed. FileReader
 * is the reader RN actually implements.
 */
async function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  if (typeof FileReader === "undefined") throw new Error("no Blob reader available");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsText(blob);
  });
}

/** Lazily download + parse a JSON file from the catalogs bucket. */
async function downloadJson<T>(file: string): Promise<T | null> {
  try {
    const { supabase } = await import("../../lib/supabase");
    const bucket = supabase.storage.from(BUCKET);

    // FAST PATH — `catalogs` is a public bucket (migration 20260724130000), so a
    // plain GET on the object URL needs no auth and, crucially, keeps the body a
    // string: `res.json()` never materialises a Blob. That skips shuttling ~1 MB
    // across the RN bridge and sidesteps the platform Blob differences entirely.
    try {
      const { publicUrl } = bucket.getPublicUrl(file).data;
      const res = await fetch(publicUrl);
      if (res.ok) return (await res.json()) as T;
    } catch {
      // fall through to the storage API
    }

    // FALLBACK — the storage API. Also the only path should the bucket ever go
    // private, since it signs the request with the user's token.
    const { data, error } = await bucket.download(file);
    if (error || !data) return null;
    return JSON.parse(await blobToText(data)) as T;
  } catch (e) {
    console.warn(`CatalogLoader: download ${file} failed:`, e);
    return null;
  }
}

/** The published version string for `name`, or null when offline/unavailable. */
async function fetchRemoteVersion(name: string): Promise<string | null> {
  const manifest = await downloadJson<Record<string, string>>(MANIFEST_FILE);
  return manifest?.[name] ?? null;
}

async function readCache<T>(name: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

async function writeCache<T>(name: string, items: T[], version: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + name, JSON.stringify(items));
    if (version) await AsyncStorage.setItem(VERSION_PREFIX + name, version);
  } catch (e) {
    console.warn(`CatalogLoader: cache write ${name} failed:`, e);
  }
}

/** Best-effort refresh: re-download only when the published version has moved. */
async function refreshInBackground<T>(name: string, file: string): Promise<void> {
  try {
    const remoteVersion = await fetchRemoteVersion(name);
    if (!remoteVersion) return; // offline — keep the cache
    const cachedVersion = await AsyncStorage.getItem(VERSION_PREFIX + name);
    if (remoteVersion === cachedVersion) return; // already current
    const items = await downloadJson<T[]>(file);
    if (items && items.length) await writeCache(name, items, remoteVersion);
  } catch {
    // best-effort — a failed refresh must never surface
  }
}

/**
 * Load a catalog, offline-first. Returns immediately from cache when present
 * (and refreshes in the background), otherwise fetches from Storage, otherwise
 * falls back to the bundled seed.
 */
export async function loadCatalog<T>(
  name: string,
  file: string,
  seed: T[],
): Promise<CatalogResult<T>> {
  // 1. Cache — instant + offline. Refresh in the background if a newer version exists.
  const cached = await readCache<T>(name);
  if (cached && cached.length) {
    void refreshInBackground<T>(name, file);
    return { items: cached, source: "cache" };
  }

  // 2. Network — cold cache.
  const remoteVersion = await fetchRemoteVersion(name);
  const items = await downloadJson<T[]>(file);
  if (items && items.length) {
    await writeCache(name, items, remoteVersion);
    return { items, source: "network" };
  }

  // 3. Bundled seed — offline first launch / any failure.
  return { items: seed, source: "seed" };
}
