/**
 * THE WIRING TEST.
 *
 * services/api/__tests__/contracts.test.ts proves the guards are CORRECT. This
 * file proves they are CONNECTED — that `WellivaApi` actually runs them on a
 * real response before handing it to the app.
 *
 * The distinction is the whole point. The guards shipped first as a well-tested
 * module nothing imported: a smoke detector in a drawer. Every assertion below
 * would still have passed against that version of contracts.ts and failed
 * against that version of WellivaApi.ts, which is exactly the gap this closes.
 *
 * The client is importable here after all, contrary to the note in
 * contracts.test.ts — it needs Supabase, expo/fetch, the env-dependent config
 * and the warm-up ping mocked, and then it loads under Node fine. That matters
 * beyond convenience: it means the request path itself is testable, so the
 * checks below run through the SAME `post()` a user's tap goes through, rather
 * than through a re-implementation of it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── The native/env edges, mocked ────────────────────────────────────────────

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null }),
      refreshSession: async () => ({
        data: { session: { access_token: "refreshed-token" } },
        error: null,
      }),
    },
  },
}));

// Only the streaming coach path uses this; stubbed so the module graph loads.
vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));

// config.ts reads process.env and dereferences __DEV__, which doesn't exist
// under Node. Mocked rather than stubbed so the test states its own base URL.
vi.mock("../config", () => ({
  API_BASE_URL: "https://api.test",
  isApiConfigured: true,
}));

vi.mock("../warmup", () => ({ warmBackend: vi.fn(async () => {}) }));

import { ContractViolationError, WellivaApi } from "../WellivaApi";

/** Queue one JSON response for the next `fetch`. */
function respondWith(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

// ============================================================================
// THE PARSE-ONLY RULE, ENFORCED AT THE WIRE
// ============================================================================

describe("the parse-only endpoints reject nutrition figures", () => {
  /*
   * The load-bearing test in this file.
   *
   * `items: [{quantity, unit, food, calories}]` passes every shape check — the
   * three required fields are all present and correctly typed. It is rejected
   * ONLY because `calories` must be absent. If the guard were disconnected this
   * payload would sail through and put a model's invented number into a food
   * log labelled as if the device had resolved it.
   */
  it("throws when /v1/nutrition/parse smuggles calories into an item", async () => {
    respondWith({
      items: [{ quantity: 1, unit: "cup", food: "rice", calories: 340 }],
      model: "claude-haiku-4-5-20251001",
    });

    await expect(
      WellivaApi.parseFood({ system: "s", user: "a cup of rice" }),
    ).rejects.toBeInstanceOf(ContractViolationError);
  });

  it("accepts the same payload once the number is gone", async () => {
    respondWith({
      items: [{ quantity: 1, unit: "cup", food: "rice" }],
      model: "claude-haiku-4-5-20251001",
    });

    const res = await WellivaApi.parseFood({ system: "s", user: "a cup of rice" });
    expect(res.items).toEqual([{ quantity: 1, unit: "cup", food: "rice" }]);
  });

  it("throws when the vision endpoint returns nutrition", async () => {
    respondWith({
      items: [{ quantity: 1, unit: "bowl", food: "jollof rice", nutrients: { calories: 500 } }],
      model: "claude-haiku-4-5-20251001",
    });

    await expect(
      WellivaApi.describeMealPhoto({ imageBase64: "xx", mimeType: "image/jpeg" }),
    ).rejects.toBeInstanceOf(ContractViolationError);
  });
});

// ============================================================================
// NOTHING IS PROMOTED
// ============================================================================

describe("the lookup endpoint cannot claim an authority it can't produce", () => {
  it("throws on origin:usda with no fdcId", async () => {
    respondWith({
      results: [
        {
          name: "Oats, rolled, dry",
          serving: "100 g",
          servingGrams: 100,
          group: "Grains & Starches",
          nutrients: { calories: 389 },
          origin: "usda", // …but no fdcId: unverifiable, so refused outright.
        },
      ],
      resolvedBy: "usda",
    });

    await expect(WellivaApi.lookupFood({ query: "oats" })).rejects.toBeInstanceOf(
      ContractViolationError,
    );
  });

  it("accepts a measured result carrying its id", async () => {
    respondWith({
      results: [
        {
          name: "Oats, rolled, dry",
          serving: "100 g",
          servingGrams: 100,
          group: "Grains & Starches",
          nutrients: { calories: 389 },
          origin: "usda",
          fdcId: 169705,
        },
      ],
      resolvedBy: "usda",
    });

    const res = await WellivaApi.lookupFood({ query: "oats" });
    expect(res.results[0]?.fdcId).toBe(169705);
  });
});

// ============================================================================
// ORDINARY DRIFT
// ============================================================================

describe("a renamed or missing field fails at the boundary", () => {
  it("throws when the diet response drops source:\"ai\"", async () => {
    respondWith({
      schedule: { dietId: "balanced" },
      dailyNutritionEstimate: { calories: 2000, proteinG: 120, carbsG: 220, fatG: 70 },
      dietName: "Balanced",
      rationale: "",
      coachNote: "",
      model: "claude-haiku-4-5-20251001",
      // source omitted — PlanSync would otherwise show a local plan as AI-made.
    });

    await expect(
      WellivaApi.generateDiet({
        bio: {} as never,
        targets: {} as never,
        date: "2026-08-30",
      }),
    ).rejects.toBeInstanceOf(ContractViolationError);
  });

  it("names the endpoint and the keys it did get, but never the values", async () => {
    respondWith({ reply: 42, model: "claude-haiku-4-5-20251001" });

    const err = await WellivaApi.coachChat({ user: "hi" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContractViolationError);
    const violation = err as ContractViolationError;
    expect(violation.endpoint).toBe("/v1/coach/chat");
    expect(violation.receivedKeys).toEqual(["reply", "model"]);
    // The payload can carry a user's own words; the diagnostic must not.
    expect(violation.message).not.toContain("42");
  });

  it("throws when the trial claim's window is unparseable", async () => {
    // A NaN date would either grant Pro forever or revoke it instantly.
    respondWith({ expiresAt: "not-a-date", claimedAt: "not-a-date", alreadyClaimed: false });

    await expect(WellivaApi.claimInsightTrial()).rejects.toBeInstanceOf(ContractViolationError);
  });
});

// ============================================================================
// THE ERROR ENVELOPE
// ============================================================================

describe("error bodies", () => {
  it("surfaces the server's message when the envelope is intact", async () => {
    respondWith({ error: { message: "Rate limit exceeded", code: "rate_limited" } }, 429);

    await expect(WellivaApi.coachChat({ user: "hi" })).rejects.toThrow("Rate limit exceeded");
  });

  it("falls back to the status when the envelope is flattened", async () => {
    // `{message}` rather than `{error:{message}}` — the drift that would
    // otherwise silently replace every actionable error with a status code.
    respondWith({ message: "Rate limit exceeded" }, 429);

    await expect(WellivaApi.coachChat({ user: "hi" })).rejects.toThrow("API error 429");
  });

  it("is not a ContractViolationError — a 500 is not the server drifting", async () => {
    respondWith({ error: { message: "boom" } }, 500);

    const err = await WellivaApi.coachChat({ user: "hi" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ContractViolationError);
  });
});
