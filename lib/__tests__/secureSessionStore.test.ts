import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for expo-secure-store. `vi.hoisted` runs before the mocked
 * import is evaluated, so `store` is defined by the time the factory closes over
 * it — and the tests can inspect the same map to assert the on-disk layout.
 */
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => (store.has(k) ? store.get(k)! : null),
  setItemAsync: async (k: string, v: string) => {
    store.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    store.delete(k);
  },
}));

import {
  CHUNK_MARKER,
  CHUNK_SIZE,
  ChunkedSecureStore,
} from "../secureSessionStore";

const KEY = "sb-session";

beforeEach(() => {
  store.clear();
});

describe("ChunkedSecureStore", () => {
  it("round-trips a small value as a single, verbatim key (no manifest)", async () => {
    await ChunkedSecureStore.setItem(KEY, "hello");
    // Stored raw under the key — legacy/back-compat readable.
    expect(store.get(KEY)).toBe("hello");
    expect(store.has(`${KEY}.0`)).toBe(false);
    expect(await ChunkedSecureStore.getItem(KEY)).toBe("hello");
  });

  it("reads a legacy single value written before chunking existed", async () => {
    store.set(KEY, "legacy-plain-session");
    expect(await ChunkedSecureStore.getItem(KEY)).toBe("legacy-plain-session");
  });

  it("splits an over-limit value and reassembles it byte-identical", async () => {
    // 2.5 chunks worth of data → 3 chunks + a manifest.
    const big = "x".repeat(CHUNK_SIZE * 2 + 500);
    await ChunkedSecureStore.setItem(KEY, big);

    expect(store.get(KEY)).toBe(`${CHUNK_MARKER}3`);
    expect(store.get(`${KEY}.0`)!.length).toBe(CHUNK_SIZE);
    expect(store.get(`${KEY}.1`)!.length).toBe(CHUNK_SIZE);
    expect(store.get(`${KEY}.2`)!.length).toBe(500);
    expect(await ChunkedSecureStore.getItem(KEY)).toBe(big);
  });

  it("stores exactly CHUNK_SIZE bytes as a single key (boundary is inclusive)", async () => {
    const exact = "y".repeat(CHUNK_SIZE);
    await ChunkedSecureStore.setItem(KEY, exact);
    expect(store.get(KEY)).toBe(exact); // not chunked
    expect(await ChunkedSecureStore.getItem(KEY)).toBe(exact);
  });

  it("overwriting a chunked value with a small one leaves no stale .N tails", async () => {
    await ChunkedSecureStore.setItem(KEY, "z".repeat(CHUNK_SIZE * 3));
    expect(store.has(`${KEY}.2`)).toBe(true);

    await ChunkedSecureStore.setItem(KEY, "small");
    expect(store.get(KEY)).toBe("small");
    expect(store.has(`${KEY}.0`)).toBe(false);
    expect(store.has(`${KEY}.1`)).toBe(false);
    expect(store.has(`${KEY}.2`)).toBe(false);
    expect(await ChunkedSecureStore.getItem(KEY)).toBe("small");
  });

  it("re-chunking a shorter large value drops the now-orphaned tail chunk", async () => {
    await ChunkedSecureStore.setItem(KEY, "a".repeat(CHUNK_SIZE * 3)); // 3 chunks
    await ChunkedSecureStore.setItem(KEY, "b".repeat(CHUNK_SIZE * 2)); // 2 chunks
    expect(store.get(KEY)).toBe(`${CHUNK_MARKER}2`);
    expect(store.has(`${KEY}.2`)).toBe(false); // orphan cleared
    expect(await ChunkedSecureStore.getItem(KEY)).toBe("b".repeat(CHUNK_SIZE * 2));
  });

  it("remove clears the manifest and every chunk", async () => {
    await ChunkedSecureStore.setItem(KEY, "q".repeat(CHUNK_SIZE * 2 + 10));
    await ChunkedSecureStore.removeItem(KEY);
    expect(store.size).toBe(0);
    expect(await ChunkedSecureStore.getItem(KEY)).toBeNull();
  });

  it("a torn read (a missing chunk) resolves to null rather than a corrupt value", async () => {
    await ChunkedSecureStore.setItem(KEY, "w".repeat(CHUNK_SIZE * 2 + 10));
    store.delete(`${KEY}.1`); // simulate a partially-lost write
    expect(await ChunkedSecureStore.getItem(KEY)).toBeNull();
  });

  it("getItem returns null for an absent key", async () => {
    expect(await ChunkedSecureStore.getItem("nope")).toBeNull();
  });
});
