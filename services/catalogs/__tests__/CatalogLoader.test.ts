import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The loader lazily `import()`s lib/supabase, so we mock that module. `downloads`
 * maps a bucket file name → its JSON body (or null to simulate a miss / offline).
 * AsyncStorage is the in-memory mock from vitest.setup, used here as a real cache.
 *
 * The loader has two ways to reach the same bytes: a plain `fetch` of the public
 * object URL (fast path) and the storage API's `download()` (fallback). `publicOk`
 * turns the fast path off so the fallback is exercised, and `blobHasText` drops
 * `.text()` from the downloaded blob to reproduce React Native's Blob polyfill.
 */
const h = vi.hoisted(() => ({
  downloads: {} as Record<string, string | null>,
  publicOk: true,
  blobHasText: true,
}));

const PUBLIC_BASE = "https://test.supabase.co/storage/v1/object/public/catalogs/";

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (file: string) => ({ data: { publicUrl: PUBLIC_BASE + file } }),
        download: async (file: string) => {
          const body = h.downloads[file];
          if (body == null) return { data: null, error: { message: "not found" } };
          // `__body` stands in for RN's native blob id: the handle a FileReader
          // resolves. `.text()` only exists where the platform provides it.
          const blob: Record<string, unknown> = {
            size: body.length,
            type: "application/json",
            __body: body,
          };
          if (h.blobHasText) blob.text = async () => body;
          return { data: blob, error: null };
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
  h.publicOk = true;
  h.blobHasText = true;
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys);

  vi.stubGlobal("fetch", async (url: string) => {
    const body = h.publicOk ? h.downloads[url.replace(PUBLIC_BASE, "")] : null;
    if (body == null) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("falls back to the storage API when the public URL is unreachable", async () => {
    h.publicOk = false; // every public GET 404s → only download() can serve
    h.downloads["manifest.json"] = JSON.stringify({ [NAME]: "v1" });
    h.downloads[FILE] = JSON.stringify([{ id: "a" }]);

    const res = await loadCatalog<{ id: string }>(NAME, FILE, SEED);
    expect(res.source).toBe("network");
    expect(res.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("reads a React-Native blob (no .text()) via FileReader", async () => {
    h.publicOk = false; // force the download() path, where the blob shows up
    h.blobHasText = false; // RN's Blob polyfill: a handle, no .text()
    h.downloads["manifest.json"] = JSON.stringify({ [NAME]: "v1" });
    h.downloads[FILE] = JSON.stringify([{ id: "rn" }]);

    vi.stubGlobal(
      "FileReader",
      class {
        result: string | null = null;
        error: unknown = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsText(blob: { __body: string }) {
          this.result = blob.__body;
          queueMicrotask(() => this.onload?.());
        }
      },
    );

    const res = await loadCatalog<{ id: string }>(NAME, FILE, SEED);
    expect(res.source).toBe("network");
    expect(res.items.map((i) => i.id)).toEqual(["rn"]);
  });
});
