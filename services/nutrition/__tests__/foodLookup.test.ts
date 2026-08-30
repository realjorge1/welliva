/**
 * FOOD LOOKUP — the rung where numbers arrive from outside.
 *
 * Two properties are worth more than the rest of this file combined, and both
 * are about failing in the safe direction:
 *
 *  1. THE LOCAL-FIRST RULE. The remote ladder must not run when we already know
 *     the food. It costs money, takes seconds, and can return an unmeasured
 *     figure — so a single local hit has to shut it off completely.
 *
 *  2. NOTHING CAN BE PROMOTED TO "MEASURED". A malformed or hostile payload may
 *     make the app less confident than the truth; it must never make it more.
 *     A missing fdcId, a wrong origin string, a bad serving weight — every one
 *     of those has to land on a weaker rung, never a stronger one.
 *
 * The confidence RANKING is tested too, because it's what makes an estimate
 * propagate: a day containing one estimated food must report itself as
 * estimated, and that falls straight out of where "ai-estimated" sits.
 */
import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_LABEL,
  CONFIDENCE_NOTE,
  CONFIDENCE_RANK,
  describeSource,
  sumPanels,
  weakestConfidence,
  type NutrientConfidence,
} from "../../../models/nutrients";
import { lookupBarcode, shouldOfferLookup } from "../FoodLookupService";
import { addCustomFood } from "../CustomFoodService";

// ============================================================================
// THE LOCAL-FIRST RULE
// ============================================================================

describe("shouldOfferLookup", () => {
  const base = { query: "abacha", localHitCount: 0, apiConfigured: true };

  it("offers a lookup only when nothing local matched", () => {
    expect(shouldOfferLookup(base)).toBe(true);
  });

  it("never runs when the catalog or the user's own foods already have it", () => {
    expect(shouldOfferLookup({ ...base, localHitCount: 1 })).toBe(false);
    expect(shouldOfferLookup({ ...base, localHitCount: 50 })).toBe(false);
  });

  it("stays off when no backend is configured", () => {
    expect(shouldOfferLookup({ ...base, apiConfigured: false })).toBe(false);
  });

  it("ignores queries too short to mean anything", () => {
    expect(shouldOfferLookup({ ...base, query: "a" })).toBe(false);
    expect(shouldOfferLookup({ ...base, query: "  " })).toBe(false);
    expect(shouldOfferLookup({ ...base, query: "ab" })).toBe(true);
  });

  it("treats a local hit as decisive regardless of anything else", () => {
    // Belt and braces: whatever else is true, one local match ends it.
    for (const query of ["abacha", "rice", "a very long food name here"]) {
      expect(shouldOfferLookup({ query, localHitCount: 1, apiConfigured: true })).toBe(false);
    }
  });
});

// ============================================================================
// THE CONFIDENCE LADDER
// ============================================================================

describe("ai-estimated confidence rung", () => {
  it("ranks below every measured rung and above nothing at all", () => {
    expect(CONFIDENCE_RANK["ai-estimated"]).toBeGreaterThan(CONFIDENCE_RANK["macros-only"]);
    expect(CONFIDENCE_RANK["ai-estimated"]).toBeGreaterThan(CONFIDENCE_RANK.measured);
    expect(CONFIDENCE_RANK["ai-estimated"]).toBeGreaterThan(CONFIDENCE_RANK["recipe-estimated"]);
    expect(CONFIDENCE_RANK["ai-estimated"]).toBeLessThan(CONFIDENCE_RANK.unmatched);
  });

  it("gives every rung a distinct rank — a tie would make ordering arbitrary", () => {
    const ranks = Object.values(CONFIDENCE_RANK);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("drags a whole meal down to itself", () => {
    // The point of the rung: one estimated item labels the entire meal.
    expect(weakestConfidence(["measured", "ai-estimated"])).toBe("ai-estimated");
    expect(weakestConfidence(["measured", "measured"])).toBe("measured");
    // …but genuine ignorance still outranks a guess.
    expect(weakestConfidence(["ai-estimated", "unmatched"])).toBe("unmatched");
  });

  it("is labelled and explained, like every other rung", () => {
    const all: NutrientConfidence[] = [
      "measured",
      "portion-estimated",
      "recipe-estimated",
      "macros-only",
      "ai-estimated",
      "unmatched",
    ];
    for (const c of all) {
      expect(CONFIDENCE_LABEL[c], `${c} has no label`).toBeTruthy();
      expect(CONFIDENCE_NOTE[c], `${c} has no explanation`).toBeTruthy();
    }
    // The label has to say "AI" in plain words — this is the whole disclosure.
    expect(CONFIDENCE_LABEL["ai-estimated"].toLowerCase()).toContain("ai");
    expect(CONFIDENCE_NOTE["ai-estimated"].toLowerCase()).toContain("estimate");
  });

  it("attributes an AI source as unmeasured, naming the model", () => {
    const line = describeSource({
      kind: "ai-estimate",
      model: "claude-haiku-4-5",
      description: "typical home recipe",
    });
    expect(line.toLowerCase()).toContain("ai estimate");
    expect(line).toContain("claude-haiku-4-5");
    expect(line.toLowerCase()).toContain("not a measured source");
  });

  it("still sums panels normally — an estimate counts toward the day", () => {
    // The product decision: estimates DO count. They just carry their label.
    const { totals } = sumPanels([{ calories: 300 }, { calories: 240 }]);
    expect(totals.calories).toBe(540);
  });
});

// ============================================================================
// THE BARCODE LADDER
// ============================================================================

/**
 * The same local-first rule, on the shorter ladder.
 *
 * It matters MORE here than on the text ladder, for a reason the text one
 * doesn't have: a scanned food the user has corrected must not be silently
 * replaced by the community's version on the next weekly shop. A network call
 * that never happens cannot overwrite anything.
 */
describe("lookupBarcode — local first", () => {
  it("answers from the user's own foods without touching the network", async () => {
    await addCustomFood({
      name: "Corrected Oat Clusters",
      serving: "45 g",
      servingGrams: 45,
      group: "Your foods",
      nutrients: { calories: 171, protein: 3.6 },
      source: { kind: "branded", brand: "Northgate", description: "Declared label" },
      confidence: "measured",
      barcode: "5000112552126",
    });

    // No fetch is injected and none is reachable under Node here: if this
    // reached rung 2 the test would fail rather than quietly pass.
    const res = await lookupBarcode({ barcode: "5000112552126" });
    expect(res.status).toBe("local");
    if (res.status === "local") {
      expect(res.food.name).toBe("Corrected Oat Clusters");
    }
  });

  it("rejects an invalid code before any rung runs", async () => {
    expect((await lookupBarcode({ barcode: "1234567890" })).status).toBe("invalid");
  });

  it("accepts separators the way a printed package writes them", async () => {
    // Same stored food, typed by hand out of the aisle.
    const res = await lookupBarcode({ barcode: "5 000112 552126" });
    expect(res.status).toBe("local");
  });
});
