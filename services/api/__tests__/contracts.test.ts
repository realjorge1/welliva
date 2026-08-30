/**
 * THE `/v1` CONTRACT TEST.
 *
 * The backend is in another repository. Every AI feature in this app depends on
 * it, and until this file existed nothing here exercised a single one of its
 * shapes — so a rename on the server shipped green CI in both repos and surfaced
 * as `undefined` in front of a user. That was F-05 of the 30 Aug audit.
 *
 * This suite is the tripwire. It cannot reach the running server (and shouldn't:
 * a test that needs a deploy to pass isn't a test, it's a monitor). What it can
 * do is pin, precisely, what the client is entitled to assume — so that changing
 * either side without the other fails here rather than in someone's kitchen.
 *
 * Three kinds of assertion, in descending order of how much they matter:
 *
 *  1. THE PARSE-ONLY RULE. `/v1/nutrition/parse` and `/v1/log/photo` may not
 *     return nutrition figures. This is the doctrine the receipt is built on —
 *     a model may parse, but never number — and it is the one contract a shape
 *     check would MISS, because extra keys are structurally harmless. A payload
 *     with `calories: 340` satisfies every "has the fields I need" test ever
 *     written. So it is checked as an absence, recursively, per item.
 *
 *  2. NOTHING IS PROMOTED. `origin: "usda"` without an `fdcId` is a figure
 *     claiming an authority it cannot produce, and must be refused.
 *
 *  3. THE ROUTE TABLE MATCHES THE CLIENT. Checked against WellivaApi's actual
 *     source text, because the client can't be imported under Node — it pulls
 *     in Supabase and expo/fetch. Crude, and it works: a path edited in one
 *     place and not the other fails here.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CONTRACTS_VERIFIED,
  FORBIDDEN_NUTRITION_KEYS,
  V1_ENDPOINTS,
  carriesNutrition,
  isApiErrorBody,
  isCoachChatResponse,
  isCoachTurnFrame,
  isDietGenerateResponse,
  isFoodLookupResponse,
  isFoodLookupResult,
  isInsightTrialClaim,
  isMealPhotoResponse,
  isParseFoodResponse,
  isParsedFoodItem,
  isWorkoutGenerateResponse,
} from "../contracts";

// ============================================================================
// 1. THE PARSE-ONLY RULE
// ============================================================================

describe("a model may parse, but never number", () => {
  const PARSE_OK = {
    items: [
      { quantity: 2, unit: "slice", food: "bread" },
      { quantity: 1, unit: "whole", food: "boiled egg" },
    ],
    model: "claude-haiku-4-5-20251001",
  };

  it("accepts a well-formed parse", () => {
    expect(isParseFoodResponse(PARSE_OK)).toBe(true);
  });

  it("REJECTS a parse that carries calories", () => {
    // The regression this whole file exists to catch. Structurally this payload
    // is perfect — it just also contains an invented number.
    const withCalories = {
      ...PARSE_OK,
      items: [{ quantity: 2, unit: "slice", food: "bread", calories: 160 }],
    };
    expect(isParseFoodResponse(withCalories)).toBe(false);
  });

  it("REJECTS a photo response that carries macros", () => {
    expect(
      isMealPhotoResponse({
        items: [{ quantity: 1, unit: "plate", food: "jollof rice", protein: 12 }],
        model: "claude-haiku-4-5-20251001",
      }),
    ).toBe(false);
  });

  it("catches nutrition under a name the app doesn't itself use", () => {
    // The point is to detect a server that started sending figures under ANY
    // name, not to validate our own vocabulary.
    for (const key of ["kcal", "energy", "macros", "carbohydrates", "fats"]) {
      expect(carriesNutrition([{ food: "x", [key]: 1 }]), `${key} slipped through`).toBe(
        true,
      );
    }
  });

  it("catches nutrition nested below the top level", () => {
    // The violation that matters is per-item, not on the envelope.
    expect(carriesNutrition({ items: [{ detail: { nutrients: { calories: 90 } } }] })).toBe(
      true,
    );
  });

  it("does not flag a clean payload", () => {
    expect(carriesNutrition(PARSE_OK.items)).toBe(false);
  });

  it("terminates on a deeply nested payload", () => {
    // Depth-capped so a hostile body can't turn validation into a stack overflow.
    let deep: Record<string, unknown> = { food: "x" };
    for (let i = 0; i < 200; i++) deep = { nested: deep };
    expect(() => carriesNutrition(deep)).not.toThrow();
  });

  it("keeps the two parse-only endpoints marked as such", () => {
    expect(V1_ENDPOINTS.nutritionParse.parseOnly).toBe(true);
    expect(V1_ENDPOINTS.logPhoto.parseOnly).toBe(true);
    // The lookup endpoint IS allowed to return numbers — it has USDA behind it.
    expect(
      (V1_ENDPOINTS.nutritionLookup as { parseOnly?: boolean }).parseOnly,
    ).toBeUndefined();
  });

  it("has a forbidden list that covers the four macros plus energy", () => {
    for (const k of ["calories", "protein", "carbs", "fat"]) {
      expect(FORBIDDEN_NUTRITION_KEYS as readonly string[]).toContain(k);
    }
  });
});

describe("parsed food items", () => {
  it("needs a quantity, a unit and a food", () => {
    expect(isParsedFoodItem({ quantity: 1, unit: "cup", food: "rice" })).toBe(true);
    expect(isParsedFoodItem({ quantity: "1", unit: "cup", food: "rice" })).toBe(false);
    expect(isParsedFoodItem({ quantity: 1, unit: "cup", food: "" })).toBe(false);
    expect(isParsedFoodItem({ quantity: Number.NaN, unit: "cup", food: "rice" })).toBe(false);
    expect(isParsedFoodItem(null)).toBe(false);
  });

  it("allows an empty unit — 'one egg' has no unit to name", () => {
    expect(isParsedFoodItem({ quantity: 1, unit: "", food: "egg" })).toBe(true);
  });
});

describe("meal photo envelope", () => {
  const base = { items: [], model: "claude-haiku-4-5-20251001" };

  it("accepts an empty identification — an unreadable plate is a real answer", () => {
    expect(isMealPhotoResponse(base)).toBe(true);
  });

  it("constrains the slot to the app's own meal types", () => {
    expect(isMealPhotoResponse({ ...base, slot: "lunch" })).toBe(true);
    expect(isMealPhotoResponse({ ...base, slot: "brunch" })).toBe(false);
  });

  it("requires the model id, so a bad batch can be traced", () => {
    expect(isMealPhotoResponse({ items: [] })).toBe(false);
  });
});

// ============================================================================
// 2. NOTHING IS PROMOTED
// ============================================================================

describe("food lookup", () => {
  const MEASURED = {
    name: "Oats, rolled, dry",
    serving: "100 g",
    servingGrams: 100,
    group: "Grains & Starches",
    nutrients: { calories: 379, protein: 13.2 },
    origin: "usda",
    fdcId: 169705,
    dataset: "SR Legacy",
  };

  it("accepts a measured result with a verifiable id", () => {
    expect(isFoodLookupResult(MEASURED)).toBe(true);
  });

  it("REJECTS a usda result with no fdcId", () => {
    // "Measured" without an id is a figure claiming an authority it can't
    // produce. FoodLookupService independently refuses to promote it; here the
    // payload is refused outright so the server bug is visible rather than
    // quietly demoted.
    const { fdcId: _drop, ...noId } = MEASURED;
    expect(isFoodLookupResult(noId)).toBe(false);
  });

  it("rejects an origin the app doesn't know", () => {
    expect(isFoodLookupResult({ ...MEASURED, origin: "crowd" })).toBe(false);
  });

  it("rejects a dataset the app doesn't know", () => {
    expect(isFoodLookupResult({ ...MEASURED, dataset: "Homemade" })).toBe(false);
  });

  it("allows an estimate with no id, which is what an estimate is", () => {
    expect(
      isFoodLookupResult({
        name: "Abacha",
        serving: "1 plate",
        servingGrams: null,
        group: "Your foods",
        nutrients: { calories: 410 },
        origin: "ai-estimate",
        model: "claude-haiku-4-5-20251001",
      }),
    ).toBe(true);
  });

  it("requires servingGrams to be a number or explicitly null", () => {
    // Never absent: "we don't know the weight" has to be stated, because the
    // resolver treats a known weight as the difference between `measured` and
    // `portion-estimated`.
    const { servingGrams: _drop, ...missing } = MEASURED;
    expect(isFoodLookupResult(missing)).toBe(false);
    expect(isFoodLookupResult({ ...MEASURED, servingGrams: null })).toBe(true);
  });

  it("pins the resolvedBy union, including 'none'", () => {
    // "Neither rung had it" is a legitimate outcome the UI renders differently.
    expect(isFoodLookupResponse({ results: [], resolvedBy: "none" })).toBe(true);
    expect(isFoodLookupResponse({ results: [MEASURED], resolvedBy: "usda" })).toBe(true);
    expect(isFoodLookupResponse({ results: [], resolvedBy: "guess" })).toBe(false);
  });

  it("rejects the whole response when one result is malformed", () => {
    expect(
      isFoodLookupResponse({ results: [MEASURED, { name: "x" }], resolvedBy: "usda" }),
    ).toBe(false);
  });
});

// ============================================================================
// COACH
// ============================================================================

describe("coach", () => {
  it("accepts a chat reply", () => {
    expect(isCoachChatResponse({ reply: "Sure.", model: "claude-haiku-4-5-20251001" })).toBe(
      true,
    );
  });

  it("allows an empty reply string but not a missing model", () => {
    expect(isCoachChatResponse({ reply: "", model: "m" })).toBe(true);
    expect(isCoachChatResponse({ reply: "hi" })).toBe(false);
  });

  it("pins the three stream frame kinds", () => {
    expect(isCoachTurnFrame({ type: "delta", text: "You're " })).toBe(true);
    expect(isCoachTurnFrame({ type: "done", content: [], stop_reason: "end_turn" })).toBe(
      true,
    );
    expect(isCoachTurnFrame({ type: "done", content: [], stop_reason: null })).toBe(true);
    expect(isCoachTurnFrame({ type: "error", message: "rate limited" })).toBe(true);
    expect(isCoachTurnFrame({ type: "chunk", text: "x" })).toBe(false);
  });

  it("requires content on a done frame", () => {
    // The agent loop echoes the full content array back verbatim on its next
    // iteration. Without it, multi-turn tool use breaks in a way that looks
    // like the coach forgetting what it was doing.
    expect(isCoachTurnFrame({ type: "done", stop_reason: "end_turn" })).toBe(false);
  });
});

// ============================================================================
// GENERATION
// ============================================================================

describe("plan generation", () => {
  const DIET = {
    schedule: { breakfast: null, lunch: null, dinner: null },
    dailyNutritionEstimate: { calories: 2100, proteinG: 140, carbsG: 210, fatG: 70 },
    dietName: "Balanced",
    rationale: "…",
    coachNote: "…",
    model: "claude-haiku-4-5-20251001",
    source: "ai",
  };

  it("accepts a generated day", () => {
    expect(isDietGenerateResponse(DIET)).toBe(true);
  });

  it("requires all four macro fields in the estimate", () => {
    expect(
      isDietGenerateResponse({
        ...DIET,
        dailyNutritionEstimate: { calories: 2100, proteinG: 140, carbsG: 210 },
      }),
    ).toBe(false);
  });

  it("pins source: 'ai'", () => {
    // PlanSync uses it to tell a generated plan from a deterministic one; a
    // mislabelled plan is shown with an attribution it hasn't earned.
    expect(isDietGenerateResponse({ ...DIET, source: "local" })).toBe(false);
  });

  it("accepts a generated week", () => {
    expect(
      isWorkoutGenerateResponse({
        plan: { days: [] },
        rationale: "…",
        coachNote: "…",
        model: "claude-haiku-4-5-20251001",
        source: "ai",
      }),
    ).toBe(true);
  });
});

describe("insight trial claim", () => {
  it("requires both timestamps to be real dates", () => {
    // The app enforces this window locally. An unparseable expiry either grants
    // Pro forever or revokes it instantly, depending on which way the NaN falls.
    expect(
      isInsightTrialClaim({
        expiresAt: "2026-09-06T00:00:00.000Z",
        claimedAt: "2026-08-30T00:00:00.000Z",
        alreadyClaimed: false,
      }),
    ).toBe(true);
    expect(
      isInsightTrialClaim({
        expiresAt: "soon",
        claimedAt: "2026-08-30T00:00:00.000Z",
        alreadyClaimed: false,
      }),
    ).toBe(false);
  });
});

describe("error envelope", () => {
  it("pins the nested shape the client digs a message out of", () => {
    // A server that flattened this to { message } would break nothing visibly —
    // it would just replace every actionable error with a bare status code,
    // everywhere, and no other test would notice.
    expect(isApiErrorBody({ error: { message: "Rate limit exceeded" } })).toBe(true);
    expect(isApiErrorBody({ message: "Rate limit exceeded" })).toBe(false);
    expect(isApiErrorBody({ error: "Rate limit exceeded" })).toBe(false);
  });
});

// ============================================================================
// 3. THE ROUTE TABLE MATCHES THE CLIENT
// ============================================================================

describe("route table", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "WellivaApi.ts"),
    "utf8",
  );

  it("declares every path the client actually calls", () => {
    // WellivaApi can't be imported here — it pulls in Supabase and expo/fetch —
    // so the check is against its source text. Crude, and it catches the thing
    // that actually happens: a path edited in one place and not the other.
    const called = new Set(
      [...source.matchAll(/"(\/v1\/[a-z0-9/-]+)"/gi)].map((m) => m[1]),
    );
    const declared = new Set(Object.values(V1_ENDPOINTS).map((e) => e.path));

    for (const path of called) {
      expect(declared, `${path} is called by WellivaApi but not in V1_ENDPOINTS`).toContain(
        path,
      );
    }
    for (const path of declared) {
      expect(called, `${path} is in V1_ENDPOINTS but no longer called`).toContain(path);
    }
  });

  it("keeps every endpoint behind the bearer token", () => {
    // There is no anonymous /v1 route. Adding one would put an unmetered model
    // call behind no identity at all.
    for (const [name, endpoint] of Object.entries(V1_ENDPOINTS)) {
      expect(endpoint.auth, `${name} must require auth`).toBe("bearer");
      expect(endpoint.method).toBe("POST");
    }
  });

  it("matches the client's declared timeouts", () => {
    // A timeout change is a UX change: every caller degrades to an on-device
    // engine, so these ceilings decide how long someone stares at a spinner
    // before getting the deterministic answer instead.
    for (const endpoint of Object.values(V1_ENDPOINTS)) {
      const escaped = endpoint.path.replace(/\//g, "\\/");
      const call = new RegExp(`"${escaped}"[^;]*?(\\d{4,6})\\s*\\)`, "s");
      const match = source.match(call);
      if (!match) continue; // coachTurn passes its timeout via an options object
      expect(Number(match[1]), `${endpoint.path} timeout drifted`).toBe(endpoint.timeoutMs);
    }
  });
});

describe("the compile-time link", () => {
  it("holds", () => {
    // The real assertion is in tsc: `Exact<GuardedType<typeof guard>, Response>`
    // fails to compile if a guard drifts from the interface WellivaApi declares.
    // This just makes the guarantee visible in the test output.
    expect(CONTRACTS_VERIFIED).toBe(true);
  });
});
