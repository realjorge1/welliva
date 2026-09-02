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
  priceView,
} from "@/components/billing/planCopy";
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
    expect(FREE_TIER.historyDays).toBeGreaterThanOrEqual(30);
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
    expect(annual.saveAmount).toBe("$10.00");
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

  it("gives the period switch the amount for its badge", () => {
    const best = bestAnnualSaving(["pro"], []);
    expect(best).not.toBeNull();
    expect(best!.amount).toBe("$10.00");
    expect(best!.percent).toBe(28);
  });

  it("promises nothing on the free card", () => {
    expect(FREE_PRICE.saveAmount).toBeNull();
    expect(FREE_PRICE.perMonthAmount).toBe(0);
  });
});
