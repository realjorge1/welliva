/**
 * THE STOREFRONT MUST DESCRIBE THE GATES THAT ACTUALLY EXIST.
 *
 * Plan copy is the one part of this codebase where being wrong is a refund
 * request rather than a bug report. A card is a promise, and there are exactly
 * two ways to break it:
 *
 *  · PROMISE SOMETHING NOTHING WITHHOLDS — a Pro line for a capability every
 *    free user already has. Nobody notices until someone pays for it.
 *  · WITHHOLD SOMETHING NOTHING PROMISES — a lock that fires and sends the user
 *    to a screen with no line on it about what they just hit.
 *
 * Both are invisible in review, because the copy reads fine on its own and the
 * gate compiles fine on its own; they only disagree when you put them side by
 * side, which is what this file does. `PlanLine.feature` exists so this pairing
 * is mechanical rather than a careful reading of prose.
 *
 * It also pins the free tier's ZERO allowances. Free having no AI at all is a
 * pricing decision that a well-meaning edit could silently undo — a `3` typed
 * back into tiers.ts would restore the old behaviour with no test failing
 * anywhere else, and give away paid inference to every free user.
 */
import { describe, expect, it } from "vitest";

import {
  bestAnnualSaving,
  FREE_PRICE,
  PLAN_CARD_ORDER,
  PLAN_IDENTITY,
  formatLike,
  freePriceView,
  priceView,
} from "@/components/billing/planCopy";
import type { PlanOption } from "@/services/billing/Billing";
import { annualSaving, LIST_PRICES } from "@/services/billing/pricing";
import {
  FEATURE_MIN_TIER,
  FREE_TIER,
  PRO_TIER,
  type FeatureId,
} from "@/services/billing/tiers";

describe("the free tier's boundary", () => {
  it("gives away no inference at all", () => {
    // The whole shape of the current storefront: Free is the tracking app, Pro
    // is Gozlin. Every number here is a door that is shut, not a small ration.
    expect(FREE_TIER.coachMessagesPerDay).toBe(0);
    expect(FREE_TIER.deepDivesLifetime).toBe(0);
    expect(FREE_TIER.photoScansPerDay).toBe(0);
  });

  it("gives away no habits the user picks, and keeps the ones that pick themselves", () => {
    // 0 MANUAL slots. The three seeded linked habits (food, water, workouts)
    // are not manual and are never counted — see TierLimits.habits. If this
    // ever counts linked habits, a free user's habit screen empties out.
    expect(FREE_TIER.habits).toBe(0);
  });

  it("still gives away the whole tracking app", () => {
    // The free tier is not allowed to become a demo. History is the one thing
    // Free is metered on rather than locked out of, and it must stay a real
    // window: a chart is the payoff for logging, and logging is the retention.
    // The floor is a week because Diet's shortest chart range is one week and
    // that card has no always-free carve-out — any less and it locks whole.
    // (10 since 2026-09-26, the owner's call; was 30.)
    expect(FREE_TIER.historyDays).toBeGreaterThanOrEqual(7);
  });

  it("leaves Pro's fair-use ceilings well clear of the free tier", () => {
    expect(PRO_TIER.coachMessagesPerDay).toBeGreaterThan(FREE_TIER.coachMessagesPerDay);
    expect(PRO_TIER.photoScansPerDay).toBeGreaterThan(FREE_TIER.photoScansPerDay);
    expect(PRO_TIER.deepDivesLifetime).toBeNull();
    expect(PRO_TIER.habits).toBeNull();
    expect(PRO_TIER.historyDays).toBeNull();
  });
});

describe("one line per lock", () => {
  const proLines = PLAN_IDENTITY.pro.highlights;
  /** Everything sellable. `generic` is the unattributed ask, not a feature. */
  const sellable = (Object.keys(FEATURE_MIN_TIER) as FeatureId[]).filter(
    (f) => f !== "generic",
  );

  it("sells every gated feature exactly once", () => {
    const sold = proLines.map((l) => l.feature).filter((f): f is FeatureId => Boolean(f));
    expect([...sold].sort()).toEqual([...sellable].sort());
  });

  it("never claims a line for something Free already has", () => {
    for (const line of proLines) {
      expect(line.feature, `Pro line has no feature id: "${line.text}"`).toBeTruthy();
      expect(FEATURE_MIN_TIER[line.feature!], `"${line.text}" sells an ungated feature`).toBe(
        "pro",
      );
    }
  });

  it("keeps Free's lines free of lock ids", () => {
    // A Free line describes something no gate withholds. Attaching a FeatureId
    // to one would mean the same capability appears on both cards.
    for (const line of PLAN_IDENTITY.free.highlights) {
      expect(line.feature, `Free line claims a lock: "${line.text}"`).toBeUndefined();
    }
  });

  it("gives every line its own glyph, so the list reads as a list", () => {
    for (const tier of PLAN_CARD_ORDER) {
      for (const line of PLAN_IDENTITY[tier].highlights) {
        expect(line.icon, `no icon on "${line.text}"`).toBeTruthy();
        expect(line.text.length, `empty line on ${tier}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("what the cards refuse to print", () => {
  const everyLine = PLAN_CARD_ORDER.flatMap((t) =>
    PLAN_IDENTITY[t].highlights.map((l) => l.text),
  );

  it("never renders a zero allowance as a feature", () => {
    // Free's limits are all 0 now. A card that interpolated them would read
    // "0 coach messages a day" — the sentence a metered card writes when its
    // limit is zeroed, which lands as a broken feature rather than as a price.
    // Each card states what it IS; the difference is Pro's list.
    for (const text of everyLine) {
      expect(text, `states a zero quantity: "${text}"`).not.toMatch(/\b0 \w/);
    }
  });

  it("does not sell Pro's fair-use ceiling as a quantity", () => {
    // `coachMessagesPerDay: 100` is a backstop against scripted abuse, not a
    // feature — see PRO_TIER. Printing it prices a conversation by the message
    // and invites "what happens at 101?". The cap stays; the number stays off
    // the card.
    const coachLine = PLAN_IDENTITY.pro.highlights.find((l) => l.feature === "coach-limit");
    expect(coachLine).toBeTruthy();
    expect(coachLine!.text).not.toMatch(/\d/);
    expect(coachLine!.text).toMatch(/gozlin/i);
  });

  it("neither card carries a list of what it does not do", () => {
    // Both cards describe themselves. A "Not included" block on Free was tried
    // and removed: it made the free tier read as a disclaimer, and it was a
    // second place for the boundary to be stated and to drift out of step with
    // FEATURE_MIN_TIER.
    for (const tier of PLAN_CARD_ORDER) {
      expect(PLAN_IDENTITY[tier]).not.toHaveProperty("limits");
    }
  });
});

describe("the annual saving, as money", () => {
  /** No live store: `priceView` falls back to the published list prices. */
  const annual = priceView("pro", "annual", []);
  const monthly = priceView("pro", "monthly", []);

  it("states the amount, not just a percentage", () => {
    // The whole point of `saveAmount`. "SAVE 28%" asks the reader to work out
    // 28% of a price they have not read yet; "$10.00" is the answer.
    const truth = annualSaving(LIST_PRICES.pro.monthly, LIST_PRICES.pro.annual)!;
    // Whole-cents trimmed: a saving on a tag is "$10", not "$10.00".
    expect(annual.saveAmount).toBe("$10");
    expect(truth.amount).toBeCloseTo(10.0, 2);
    expect(annual.savePercent).toBe(truth.percent);
  });

  it("says what actually leaves the account, and when", () => {
    // Quoting a year's price as a monthly one without this is the dishonest
    // version of a per-month annual card.
    expect(annual.headline).toBe("$2.16");
    expect(annual.unit).toBe("per month");
    expect(annual.billedTotal).toBe("$25.88");
    expect(annual.detail).toMatch(/\$25\.88/);
    expect(annual.detail).toMatch(/year/i);
  });

  it("strikes through the monthly price it is beating", () => {
    expect(annual.strikethrough).toBe("$2.99");
  });

  it("claims no saving on the monthly plan", () => {
    expect(monthly.saveAmount).toBeNull();
    expect(monthly.savePercent).toBeNull();
    expect(monthly.strikethrough).toBeNull();
    expect(monthly.billedTotal).toBeNull();
  });

  it("gives the Annual tile the amount for its tag", () => {
    const best = bestAnnualSaving(["pro"], []);
    expect(best).not.toBeNull();
    expect(best!.amount).toBe("$10");
    expect(best!.percent).toBe(28);
  });

  it("promises nothing on the free card", () => {
    expect(FREE_PRICE.saveAmount).toBeNull();
    expect(FREE_PRICE.perMonthAmount).toBe(0);
    expect(FREE_PRICE.billedLabel).toBeNull();
    expect(FREE_PRICE.compareTotal).toBeNull();
  });
});

describe("the price tag's ledger", () => {
  const annual = priceView("pro", "annual", []);
  const monthly = priceView("pro", "monthly", []);

  it("shows the saving as the two numbers it is the difference of", () => {
    // $35.88 struck beside $25.88 — the reader can check the $10 themselves.
    expect(annual.billedLabel).toBe("Billed yearly");
    expect(annual.compareTotal).toBe("$35.88");
    expect(annual.billedTotal).toBe("$25.88");
  });

  it("inks the percentage only behind the amount it qualifies", () => {
    // The Annual tile's tag carries $10; the receipt may carry 28%, never alone.
    expect(annual.saveAmount).not.toBeNull();
    expect(annual.footnote.lead).toBe(`${annual.savePercent}% off`);
    expect(annual.footnote.rest).toMatch(/cancel any time/i);
  });

  it("offers nothing to compare on the monthly ledger", () => {
    expect(monthly.billedLabel).toBe("Billed monthly");
    expect(monthly.compareTotal).toBeNull();
    expect(monthly.footnote.lead).toBeNull();
    expect(monthly.detail).toMatch(/\$2\.99/);
  });
});

/** A store plan as RevenueCat hands it over — only the fields pricing reads. */
function storePlan(period: "monthly" | "annual", priceString: string, priceAmount: number, currency: string): PlanOption {
  return {
    id: `pro:${period}`,
    tier: "pro",
    period,
    priceString,
    priceAmount,
    currency,
    title: "Pro",
    // The SDK's own per-month string, spelled differently from priceString —
    // exactly what a Nigerian Play account returned. It must NOT reach the tag.
    pricePerMonthString: period === "annual" ? "NGN1,025.00" : null,
    trialDays: null,
    purchasable: true,
    raw: null,
  };
}

describe("prices in the reader's own currency", () => {
  // What Google Play returned for a Nigerian account on 2026-09-27.
  const naira = [
    storePlan("monthly", "₦1,450.00", 1450, "NGN"),
    storePlan("annual", "₦12,300.00", 12300, "NGN"),
  ];

  it("writes every figure it computes the way the store writes its own", () => {
    // Before: "NGN1,025.00" and "SAVE NGN5,100" beside the store's "₦1,450.00".
    const annual = priceView("pro", "annual", naira);
    expect(annual.headline).toBe("₦1,025.00");
    expect(annual.saveAmount).toBe("₦5,100");
    expect(annual.compareTotal).toBe("₦17,400.00");
    expect(annual.billedTotal).toBe("₦12,300.00");
    expect(annual.strikethrough).toBe("₦1,450.00");
    for (const text of [annual.headline, annual.saveAmount, annual.compareTotal]) {
      expect(text).not.toMatch(/NGN|USD|\$/);
    }
  });

  it("prices the free card in the same currency", () => {
    expect(freePriceView(naira).headline).toBe("₦0");
    // No store answer: the published list currency, like every other fallback.
    expect(freePriceView([]).headline).toBe(FREE_PRICE.headline);
  });
});

describe("formatLike", () => {
  it("borrows the mark, its side, and the separators", () => {
    expect(formatLike("₦12,300.00", 17400)).toBe("₦17,400.00");
    expect(formatLike("12,30 €", 1234.5)).toBe("1.234,50 €");
    expect(formatLike("1\u00a0234,56\u00a0€", 17400)).toBe("17\u00a0400,00\u00a0€");
    expect(formatLike("R$ 12,90", 154.8)).toBe("R$ 154,80");
    expect(formatLike("¥300", 3600)).toBe("¥3,600");
  });

  it("reads three digits after a separator as grouping, not cents", () => {
    expect(formatLike("₦12,300", 17400)).toBe("₦17,400");
  });

  it("trims round cents only when asked — a tag's saving, never a price", () => {
    expect(formatLike("₦12,300.00", 5100.000000001, true)).toBe("₦5,100");
    expect(formatLike("₦12,300.00", 5100)).toBe("₦5,100.00");
    expect(formatLike("$25.88", 10.000000000000004, true)).toBe("$10");
    expect(formatLike("$25.88", 9.89, true)).toBe("$9.89");
  });

  it("gives up rather than guess when the template has no figure", () => {
    expect(formatLike("Free", 10)).toBeNull();
  });
});
