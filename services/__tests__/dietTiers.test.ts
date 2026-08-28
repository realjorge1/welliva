/**
 * THE DIET CATALOG IS FREE — pinned as a test, because it used not to be.
 *
 * Every diet, and every recommendation built on one, is available on every tier.
 * That is a product decision (services/billing/tiers.ts, "The diet catalog is
 * FREE"), and the failure mode it replaced was invisible at runtime and
 * expensive in public: a hand-written id list in the billing layer silently
 * paywalling a plan someone opened the app to find.
 *
 * So this file guards two things:
 *
 *   • NO TIER BOUNDARY MAY NAME DIETS AGAIN. `FEATURE_MIN_TIER` is the only
 *     place a lock can be declared; a diet-shaped key reappearing there is the
 *     one way this decision gets quietly undone.
 *   • THE CONDITION-MODE LABEL STILL DESCRIBES REAL DIETS. It survived the lock
 *     as catalog metadata (constants/DietDatabase.ts) and can still drift from
 *     the catalog it labels.
 */
import { describe, expect, it } from "vitest";

import {
  CONDITION_DIET_IDS,
  DIET_DATABASE,
  isConditionDiet,
  missingConditionDietIds,
} from "../../constants/DietDatabase";
import { FEATURE_MIN_TIER, tierAllowsFeature } from "../billing/tiers";

const ALL_IDS = DIET_DATABASE.map((d) => d.id);

describe("no tier gates the diet catalog", () => {
  it("declares no diet-shaped feature lock", () => {
    // "clinical-diets" was the key that locked 18 of 28 diets to Plus. Nothing
    // in the feature boundary may describe diets again — if a future lock needs
    // one, it should have to argue with the section this test cites.
    const keys = Object.keys(FEATURE_MIN_TIER);
    expect(keys).not.toContain("clinical-diets");
    for (const key of keys) {
      expect(key).not.toMatch(/diet/i);
    }
  });

  it("keeps only the locks we actually mean to sell", () => {
    // Every declared feature that a free account cannot use, stated. Diets are
    // absent from this set by construction; the assertion is that the remaining
    // locks are the ones we mean to sell — depth and generated intelligence.
    const lockedForFree = Object.keys(FEATURE_MIN_TIER).filter(
      (f) => !tierAllowsFeature("free", f as keyof typeof FEATURE_MIN_TIER),
    );
    expect(lockedForFree.sort()).toEqual([
      "ai-plans",
      "coach-limit",
      "deep-dive",
      "generic",
      "habits",
      "history",
      "insights",
      "photo-log",
      "sync",
    ]);
  });
});

describe("the catalog as a whole", () => {
  it("is 28 diets, every one of them free", () => {
    expect(ALL_IDS.length).toBe(28);
  });

  it("has no duplicate ids", () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
  });
});

describe("the Condition mode label", () => {
  it("only names protocols that exist in the catalog", () => {
    expect(missingConditionDietIds(ALL_IDS)).toEqual([]);
  });

  it("excludes goal-shaped plans — a goal is not a diagnosis", () => {
    // The distinction the label rests on. If one of these ever qualifies as a
    // condition protocol it should be argued for, not slipped in.
    for (const id of ["bodybuilding", "athlete-endurance", "weight-gain", "wellness-detox"]) {
      expect(isConditionDiet(id)).toBe(false);
    }
  });

  it("labels 13 of the 28 diets", () => {
    // Pinned so a plan changing sides is a red build with a diff to review,
    // not a silent edit to a list nobody reads.
    expect(CONDITION_DIET_IDS.length).toBe(13);
    expect(ALL_IDS.filter(isConditionDiet).length).toBe(CONDITION_DIET_IDS.length);
  });
});
