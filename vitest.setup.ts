import { vi } from "vitest";

/**
 * Mock @react-native-async-storage/async-storage so the health-os module graph
 * (AsyncStorageAdapter → OfflineStorage → AsyncStorage) loads under Node. Tests
 * inject their own in-memory KeyValueStore, so this mock is never actually exercised
 * — it only prevents the native import from throwing at module-load time.
 */
vi.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: async (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: async (k: string) => {
        mem.delete(k);
      },
      getAllKeys: async () => [...mem.keys()],
      multiGet: async (keys: string[]) => keys.map((k) => [k, mem.get(k) ?? null]),
      multiSet: async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) mem.set(k, v);
      },
      multiRemove: async (keys: string[]) => {
        for (const k of keys) mem.delete(k);
      },
    },
  };
});
