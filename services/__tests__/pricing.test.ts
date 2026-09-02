/**
 * The storefront makes an arithmetic promise: "save $10.00" and "28% off" have to
 * what the two prices beside them actually work out to. Nobody recomputes a
 * percentage by hand while reading a plan card, which is exactly why a wrong one
 * is so corrosive — and why it should fail here rather than in a screenshot.
 *
 * These tests pin the published prices too. Changing a price is fine; changing
 * it without noticing that the saving line moved with it is not.
 */
import { describe, expect, it } from "vitest";

import {
  annualSaving,
  formatMoney,
  LIST_PRICES,
  perMonthOfAnnual,
} from "../billing/pricing";

describe("published prices", () => {
  it("are the ones the store is configured with", () => {
    expect(LIST_PRICES.pro).toEqual({ monthly: 2.99, annual: 25.88 });
  });

  it("sells exactly one paid tier", () => {
    // Plus was merged into Pro. A second key reappearing here means someone
    // added a tier to the price list without going through tiers.ts, which is
    // how the storefront and the gates start disagreeing.
    expect(Object.keys(LIST_PRICES)).toEqual(["pro"]);
  });
});

describe("annualSaving", () => {
  it("computes Pro at exactly $10.00 a year, 28% off", () => {
    const saving = annualSaving(LIST_PRICES.pro.monthly, LIST_PRICES.pro.annual);
    expect(saving).not.toBeNull();
    expect(saving!.amount).toBeCloseTo(10.0, 2);
    expect(saving!.percent).toBe(28);
  });

  it("keeps the annual saving worth badging at all", () => {
    // `annualSaving` returns null under 5%, which would silently drop the
    // "SAVE 28%" pill and the struck-through monthly price off the plan card.
    // A reprice that narrows the gap should fail here rather than quietly
    // change what the storefront renders.
    expect(annualSaving(LIST_PRICES.pro.monthly, LIST_PRICES.pro.annual)).not.toBeNull();
  });

  it("claims nothing when the annual plan isn't actually cheaper", () => {
    expect(annualSaving(3, 36)).toBeNull();
    expect(annualSaving(3, 40)).toBeNull();
  });

  it("stays quiet under 5% rather than boasting about pennies", () => {
    // 12 × 3 = 36; a 4% saving is 34.56 — real, but not worth a badge.
    expect(annualSaving(3, 34.56)).toBeNull();
    expect(annualSaving(3, 32.4)).not.toBeNull(); // 10%
  });

  it("ignores nonsense input instead of dividing by zero", () => {
    expect(annualSaving(0, 22.99)).toBeNull();
    expect(annualSaving(2.99, 0)).toBeNull();
  });
});

describe("perMonthOfAnnual", () => {
  it("quotes the monthly equivalent to the cent, rounding UP", () => {
    // Never round a price down: the card must not imply a cheaper month than
    // twelve of them add up to.
    expect(perMonthOfAnnual(25.88)).toBe(2.16); // 2.1566…
    expect(perMonthOfAnnual(19.99)).toBe(1.67); // 1.6658…
  });

  it("times twelve, never comes out under the yearly price", () => {
    for (const annual of [25.88, 19.99, 26.99, 69.99, 49.99]) {
      expect(perMonthOfAnnual(annual) * 12).toBeGreaterThanOrEqual(annual);
    }
  });
});

describe("formatMoney", () => {
  it("drops decimals on whole amounts and keeps them otherwise", () => {
    expect(formatMoney(35)).toBe("$35");
    expect(formatMoney(2.99)).toBe("$2.99");
    expect(formatMoney(3.5)).toBe("$3.50");
    expect(formatMoney(12.889999999999997)).toBe("$12.89");
  });

  it("degrades to a bare number for a currency code it can't render", () => {
    expect(formatMoney(22.99, "NOT_A_CURRENCY")).toBe("22.99");
  });
});
