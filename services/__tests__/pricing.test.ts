/**
 * The storefront makes an arithmetic promise: "save $12.89" and "−36%" have to
 * be what the two prices beside them actually work out to. Nobody recomputes a
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
    expect(LIST_PRICES.plus).toEqual({ monthly: 2.99, annual: 22.99 });
    expect(LIST_PRICES.pro).toEqual({ monthly: 6.99, annual: 58.99 });
  });

  it("prices Pro above Plus on both periods", () => {
    expect(LIST_PRICES.pro.monthly).toBeGreaterThan(LIST_PRICES.plus.monthly);
    expect(perMonthOfAnnual(LIST_PRICES.pro.annual)).toBeGreaterThan(
      perMonthOfAnnual(LIST_PRICES.plus.annual),
    );
  });

  it("has opened the tier gap past what a \"price gap\" line can carry", () => {
    // Pro used to sit $0.51/month above Plus and the card said so. At $6.99 it
    // does not, and proUpsell() must stand down rather than call a $4 gap
    // "only" — the card argues PRO_VALUE_NOTE instead. This test is what keeps
    // the two in step: if a future price change closes the gap again, it fails
    // and the copy decision gets revisited deliberately.
    for (const period of ["monthly", "annual"] as const) {
      const plus =
        period === "annual" ? perMonthOfAnnual(LIST_PRICES.plus.annual) : LIST_PRICES.plus.monthly;
      const pro =
        period === "annual" ? perMonthOfAnnual(LIST_PRICES.pro.annual) : LIST_PRICES.pro.monthly;
      expect(pro - plus).toBeGreaterThan(plus);
    }
  });
});

describe("annualSaving", () => {
  it("computes Plus at $12.89 a year, 36% off", () => {
    const saving = annualSaving(LIST_PRICES.plus.monthly, LIST_PRICES.plus.annual);
    expect(saving).not.toBeNull();
    expect(saving!.amount).toBeCloseTo(12.89, 2);
    expect(saving!.percent).toBe(36);
  });

  it("computes Pro at $24.89 a year, 30% off", () => {
    const saving = annualSaving(LIST_PRICES.pro.monthly, LIST_PRICES.pro.annual);
    expect(saving).not.toBeNull();
    expect(saving!.amount).toBeCloseTo(24.89, 2);
    expect(saving!.percent).toBe(30);
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
    expect(perMonthOfAnnual(22.99)).toBe(1.92); // 1.9158…
    expect(perMonthOfAnnual(58.99)).toBe(4.92); // 4.9158…
  });

  it("times twelve, never comes out under the yearly price", () => {
    for (const annual of [22.99, 58.99, 69.99, 49.99]) {
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
