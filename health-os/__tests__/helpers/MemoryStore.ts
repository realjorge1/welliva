import type { KeyValueStore } from "../../platform/storage/KeyValueStore";

/**
 * An in-memory KeyValueStore for tests. Stores JSON strings exactly like the real
 * AsyncStorage adapter (so `undefined` fields are dropped on round-trip, matching
 * production) and isolates references between reads and writes.
 */
export class MemoryStore implements KeyValueStore {
  private mem = new Map<string, string>();

  async get<T>(key: string, fallback: T): Promise<T> {
    const raw = this.mem.get(key);
    return raw === undefined ? fallback : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.mem.set(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.mem.delete(key);
  }

  async multiGet(keys: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const raw = this.mem.get(k);
      if (raw !== undefined) out[k] = JSON.parse(raw);
    }
    return out;
  }

  async keys(prefix?: string): Promise<string[]> {
    const all = [...this.mem.keys()];
    return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
  }

  /** Test helper: number of keys held. */
  size(): number {
    return this.mem.size;
  }
}
