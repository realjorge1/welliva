/**
 * ChunkedSecureStore — a SecureStore-backed key/value store that transparently
 * splits large values across multiple entries.
 *
 * WHY (load-bearing on Android): `expo-secure-store` rejects/warns above ~2048
 * BYTES per value, and a Supabase session (access + refresh JWT + user metadata,
 * larger still for OAuth users) routinely exceeds that. An over-limit write
 * silently fails → the session never persists → `user` is null on next launch →
 * NONE of the cloud sync ever runs. To stay under the ceiling, large values are
 * split into `${key}.<i>` slots with a tiny manifest stored at `key` itself
 * (`${CHUNK_MARKER}<count>`). Plain (small / legacy) values are read and written
 * verbatim, so this is fully backward compatible with sessions stored before
 * chunking existed.
 *
 * This module is intentionally pure and native-only: it always talks to
 * SecureStore and never branches on platform or swallows errors. The web branch
 * (AsyncStorage) and the fail-soft try/catch live in `lib/supabase.ts`, which
 * composes this. Keeping this layer pure is what makes it unit-testable.
 */

import * as SecureStore from "expo-secure-store";

/** Manifest prefix written at `key` when a value is chunked: `${MARKER}<count>`. */
export const CHUNK_MARKER = "__sbchunks__:";
/** Bytes per chunk — headroom under SecureStore's ~2048 per-value limit. */
export const CHUNK_SIZE = 1800;

/** Drop any prior chunk set for `key` so none are orphaned by a re-write. */
async function clearChunks(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head && head.startsWith(CHUNK_MARKER)) {
    const n = parseInt(head.slice(CHUNK_MARKER.length), 10) || 0;
    for (let i = 0; i < n; i += 1) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export const ChunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith(CHUNK_MARKER)) return head; // plain / legacy value
    const n = parseInt(head.slice(CHUNK_MARKER.length), 10) || 0;
    let out = "";
    for (let i = 0; i < n; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null; // torn write — treat as no session
      out += part;
    }
    return out;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await clearChunks(key); // drop any prior chunk set so none are orphaned
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const n = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < n; i += 1) {
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${n}`);
  },

  removeItem: async (key: string): Promise<void> => {
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};
