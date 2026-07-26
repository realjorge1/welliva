/**
 * health-os/platform/storage/KeyValueStore.ts
 *
 * The storage PORT. Every repository talks to this interface, never to AsyncStorage
 * directly — so the substrate (AsyncStorage now; SQLite / encrypted later) can change
 * without touching any domain code (docs/architecture/01-domain-architecture.md §4,
 * 02-data-and-schema.md §1).
 */
export interface KeyValueStore {
  /** Read + parse JSON. Returns `fallback` on miss or parse error. */
  get<T>(key: string, fallback: T): Promise<T>;
  /** Serialize + write JSON. */
  set<T>(key: string, value: T): Promise<void>;
  /** Remove a key. */
  remove(key: string): Promise<void>;
  /** Batch read several keys → `{ key: parsedValue }` (missing keys omitted). */
  multiGet(keys: string[]): Promise<Record<string, unknown>>;
  /** All keys, optionally filtered by prefix. */
  keys(prefix?: string): Promise<string[]>;
}
