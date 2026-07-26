import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The loader lazily `import()`s lib/supabase, so we mock that module. `downloads`
 * maps a bucket file name → its JSON body (or null to simulate a miss / offline).
 * AsyncStorage is the in-memory mock from vitest.setup, used here as a real cache.
 */
const h = vi.hoisted(() => ({ downloads: {} as Record<string, string | null> }));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        download: async (file: string) => {
          const body = h.downloads[file];
          if (body == null) return { data: null, error: { message: "not found" } };
          return { data: { text: async () => body }, error: null };
        },
      }),
    },
  },
}));

import { loadCatalog } from "../CatalogLoader";

const NAME = "test_cat";
const FILE = "test_cat.json";
const SEED = [{ id: "seed-item" }];

beforeEach(async () => {
  h.downloads = {};
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys);
});

describe("loadCatalog", () => {
  it("fetches from the network on a cold cache and writes it back", async () => {
    h.downloads["manifest.json"] = JSON.stringify({ [NAME]: "v1" });
    h.downloads[FILE] = JSON.stringify([{ id: "a" }, { id: "b" }]);

    const res = await loadCatalog<{ id: string }>(NAME, FILE, SEED);
    expect(res.source).toBe("network");
    expect(res.items.map((i) => i.id)).toEqual(["a", "b"]);

    // Cached for next time (items + version from the manifest).
    expect(await AsyncStorage.getItem(`catalog:cache:${NAME}`)).toBe(
      JSON.stringify([{ id: "a" }, { id: "b" }]),
    );
    expect(await AsyncStorage.getItem(`catalog:version:${NAME}`)).toBe("v1");
  });

  it("returns the cache without hitting the file when one exists", async () => {
    await AsyncStorage.setItem(`catalog:cache:${NAME}`, JSON.stringify([{ id: "cached" }]));
    // No downloads configured → if it tried the network it'd fall to seed.
    const res = await loadCatalog<{ id: string }>(NAME, FILE, SEED);
    expect(res.source).toBe("cache");
    expect(res.items.map((i) => i.id)).toEqual(["cached"]);
  });

  it("falls back to the bundled seed when offline on a cold cache", async () => {
    const res = await loadCatalog<{ id: string }>(NAME, FILE, SEED);
    expect(res.source).toBe("seed");
    expect(res.items).toEqual(SEED);
  });

  it("falls back to seed when the file is empty/corrupt", async () => {
    h.downloads[FILE] = "[]"; // valid JSON, but no items
    const res = await loadCatalog<{ id: string }>(NAME, FILE, SEED);
    expect(res.source).toBe("seed");
  });
});
