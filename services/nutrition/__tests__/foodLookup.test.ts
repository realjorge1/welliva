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
import { shouldOfferLookup } from "../FoodLookupService";

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
