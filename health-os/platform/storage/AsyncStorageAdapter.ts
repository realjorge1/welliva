/**
 * health-os/platform/storage/AsyncStorageAdapter.ts
 *
 * The current KeyValueStore adapter. Reuses Welliva's existing JSON serialization
 * (services/OfflineStorage) so there is one serialization path app-wide, and uses
 * AsyncStorage directly for the batch/list operations the port adds.
 *
 * A future SqliteAdapter / EncryptedAdapter implements the same port with no domain
 * changes (docs/architecture/02-data-and-schema.md §1, 09-privacy-and-consent.md §4).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { readJSON, remove, writeJSON } from "@/services/OfflineStorage";

import type { KeyValueStore } from "./KeyValueStore";

export class AsyncStorageAdapter implements KeyValueStore {
  get<T>(key: string, fallback: T): Promise<T> {
    return readJSON<T>(key, fallback);
  }

  set<T>(key: string, value: T): Promise<void> {
    return writeJSON<T>(key, value);
  }

  remove(key: string): Promise<void> {
    return remove(key);
  }

  async multiGet(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};
    const pairs = await AsyncStorage.multiGet(keys);
    const out: Record<string, unknown> = {};
    for (const [k, v] of pairs) {
      if (v == null) continue;
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v;
      }
    }
    return out;
  }

  async keys(prefix?: string): Promise<string[]> {
    const all = await AsyncStorage.getAllKeys();
    return prefix ? all.filter((k) => k.startsWith(prefix)) : [...all];
  }
}

/** The default, app-wide store instance. */
export const store: KeyValueStore = new AsyncStorageAdapter();
