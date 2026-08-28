/**
 * LIST PRICES — what Welliva charges, as published.
 *
 * READ THIS BEFORE USING ANY NUMBER IN HERE.
 *
 * The store is the authority on price. RevenueCat returns `priceString` already
 * localised, currency-converted and adjusted for the user's region, and that
 * string is what the upgrade screen shows whenever offerings have loaded. Both
 * stores reject a paywall that displays a price they aren't charging, and a
 * hardcoded "$2.99" is simply wrong for most of the world.
 *
 * So these constants exist for exactly one situation: a build where a purchase
 * is IMPOSSIBLE and no offering can ever load — Expo Go, web, a build with no
 * RevenueCat key. There the screen would otherwise show three price-shaped holes,
 * which makes the storefront impossible to design against and impossible to
 * demo. In that state the numbers below are shown, clearly labelled as USD list
 * prices, and every buy button is disabled.
 *
 * They must stay in step with the console (docs/monetization/setup.md §0.3).
 * They are display copy, never an input to a charge.
 */
import type { BillingPeriod } from "./Billing";
import type { Tier } from "./tiers";

/** The currency the list prices are quoted in. */
export const LIST_CURRENCY = "USD";

/**
 * Published prices per tier and period.
 *
 * The annual plans are deliberately steep discounts rather than the usual
 * "two months free": at these amounts the yearly commitment is what makes the
 * subscription worth servicing, and the saving is the honest reason to take it.
 *
 * WHY PRO IS $6.99 AND NOT $3.50
 *
 * Pro sells generated intelligence, and its cost of goods scales with use in a
 * way Plus’s does not: Plus unlocks depth over data the user already owns, which
 * costs cents a month to serve, while every Pro turn spends real Haiku
 * inference. At $3.50 against a 100/day ceiling the tier lost money on anyone
 * past roughly ten turns a day — precisely the engaged user it exists for, so
 * the better they liked it the more it cost us.
 *
 * Pricing the inference properly is what lets the caps stay generous instead of
 * being quietly cut later, and a cap cut after launch costs far more trust than
 * a higher price at launch.
 *
 * The consequence for the storefront: Pro is no longer “a dollar more than
 * Plus”, so its card cannot lean on the price gap. `proUpsell()` in
 * components/billing/planCopy.ts already returns null once that gap stops being
 * small, and the card argues the value instead — see `PRO_VALUE_NOTE` there.
 */
export const LIST_PRICES: Record<Exclude<Tier, "free">, Record<"monthly" | "annual", number>> = {
  plus: { monthly: 2.99, annual: 22.99 }, // save $12.89/yr — 36%
  pro: { monthly: 6.99, annual: 58.99 }, //  save $24.89/yr — 30%
};

/**
 * Format an amount for display.
 *
 * Whole amounts drop the decimals ($35, not $35.00) because a round price reads
 * as a round price; anything else keeps cents. `currency` is an ISO code from
 * the store; unknown codes degrade to a bare number rather than throwing, which
 * matters because `Intl` support varies across the JS engines this app runs on.
 */
export function formatMoney(amount: number, currency: string = LIST_CURRENCY): string {
  const whole = Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return whole ? `${amount}` : amount.toFixed(2);
  }
}

/** What an annual plan costs per month. Rounded up to the cent, never down. */
export function perMonthOfAnnual(annualAmount: number): number {
  return Math.ceil((annualAmount / 12) * 100) / 100;
}

export interface AnnualSaving {
  /** Money kept over a year by paying annually. */
  amount: number;
  /** The same, as a whole percentage. */
  percent: number;
}

/**
 * The saving of an annual plan against twelve months of the monthly one.
 *
 * Returns `null` when there is nothing worth claiming — a non-positive saving,
 * or one under 5%, where a "SAVE 3%" badge costs more trust than it earns.
 */
export function annualSaving(monthlyAmount: number, annualAmount: number): AnnualSaving | null {
  if (monthlyAmount <= 0 || annualAmount <= 0) return null;
  const yearOfMonthly = monthlyAmount * 12;
  const amount = yearOfMonthly - annualAmount;
  if (amount <= 0) return null;
  const percent = Math.round((amount / yearOfMonthly) * 100);
  return percent >= 5 ? { amount, percent } : null;
}

/** The list price for a tier at a period. Used only where the store can't answer. */
export function listPrice(tier: Exclude<Tier, "free">, period: BillingPeriod): number | null {
  if (period !== "monthly" && period !== "annual") return null;
  return LIST_PRICES[tier][period];
}
