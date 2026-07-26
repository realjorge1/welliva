/**
 * Exercise media layer — name normalization, match ranking, config gating,
 * caching, and override integrity against the exercise catalog.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import {
  __resetMediaCacheForTests,
  isExerciseMediaConfigured,
  normalizeSearchName,
  pickBestMatch,
  resolveDemoUrl,
  SEARCH_OVERRIDES,
} from "@/fitness/services/ExerciseMediaService";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("normalizeSearchName", () => {
  it("lowercases, strips punctuation and simple plurals", () => {
    expect(normalizeSearchName("Push-ups")).toBe("push up");
    expect(normalizeSearchName("Mountain Climbers")).toBe("mountain climber");
    expect(normalizeSearchName("Glute Bridges")).toBe("glute bridge");
  });

  it("drops parenthetical qualifiers", () => {
    expect(normalizeSearchName("Push-ups (wide grip)")).toBe("push up");
  });

  it("keeps words ending in double-s and short words", () => {
    expect(normalizeSearchName("Overhead Press")).toBe("overhead press");
    expect(normalizeSearchName("Wall Sit")).toBe("wall sit");
  });
});

describe("pickBestMatch", () => {
  const c = (name: string, gifUrl = `https://cdn.example/${name}.gif`) => ({ name, gifUrl });

  it("prefers an exact normalized match over prefixes", () => {
    const best = pickBestMatch("Push-ups", [c("push-up plank"), c("Push-Up"), c("archer push-up")]);
    expect(best?.name).toBe("Push-Up");
  });

  it("falls back to the shortest prefixed candidate", () => {
    const best = pickBestMatch("squat", [c("squat jump variation"), c("squat thrust")]);
    expect(best?.name).toBe("squat thrust");
  });

  it("falls back to the shortest containing candidate", () => {
    const best = pickBestMatch("lunge", [c("dumbbell reverse lunge step"), c("reverse lunge")]);
    expect(best?.name).toBe("reverse lunge");
  });

  it("returns null rather than an unrelated demo", () => {
    expect(pickBestMatch("burpees", [c("bench press"), c("plank")])).toBeNull();
  });

  it("ignores candidates without a gif url", () => {
    const best = pickBestMatch("plank", [{ name: "plank", gifUrl: "" }, c("side plank")]);
    expect(best?.name).toBe("side plank");
  });
});

describe("SEARCH_OVERRIDES", () => {
  it("only references real exercise ids", () => {
    const ids = new Set(EXERCISE_DATABASE.map((e) => e.id));
    for (const key of Object.keys(SEARCH_OVERRIDES)) {
      expect(ids.has(key), `override key ${key} is not an EXERCISE_DATABASE id`).toBe(true);
    }
  });
});

describe("resolveDemoUrl", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    __resetMediaCacheForTests();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is a no-op (null, zero network) when unconfigured", async () => {
    vi.stubEnv("EXPO_PUBLIC_EXERCISEDB_API_URL", "");
    vi.stubEnv("EXPO_PUBLIC_EXERCISEDB_API_KEY", "");
    expect(isExerciseMediaConfigured()).toBe(false);
    const url = await resolveDemoUrl("push_01", "Push-ups");
    expect(url).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves via name search and caches the result", async () => {
    vi.stubEnv("EXPO_PUBLIC_EXERCISEDB_API_URL", "https://exercisedb.example.com");
    vi.stubEnv("EXPO_PUBLIC_EXERCISEDB_API_KEY", "test-key");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ name: "push up", gifUrl: "https://cdn.example/pushup.gif" }],
    });

    const first = await resolveDemoUrl("push_01", "Push-ups");
    expect(first).toBe("https://cdn.example/pushup.gif");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Search term + auth headers hit the configured endpoint.
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("/exercises/name/push%20up");
    expect(init.headers["X-RapidAPI-Key"]).toBe("test-key");

    const second = await resolveDemoUrl("push_01", "Push-ups");
    expect(second).toBe("https://cdn.example/pushup.gif");
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from cache
  });

  it("returns null on network failure instead of throwing", async () => {
    vi.stubEnv("EXPO_PUBLIC_EXERCISEDB_API_URL", "https://exercisedb.example.com");
    vi.stubEnv("EXPO_PUBLIC_EXERCISEDB_API_KEY", "test-key");
    fetchMock.mockRejectedValue(new Error("offline"));
    const url = await resolveDemoUrl("core_99_never_cached", "Imaginary Move");
    expect(url).toBeNull();
  });
});
