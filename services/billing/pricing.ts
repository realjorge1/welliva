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
 * PRICING HISTORY, AND THE OPEN RISK AT $2.99 PRO
 *
 * Pro launched at $3.50, moved to $6.99 because its cost of goods scales with
 * use — every Pro turn spends real Haiku inference, and at $3.50 against a
 * 100/day ceiling the tier lost money on anyone past roughly ten turns a day —
 * then came back down to $2.99, where it now stands as the single paid tier
 * after Plus was merged into it.
 *
 * The annual plan is priced BACKWARDS FROM THE CLAIM: the storefront says "save
 * $10 a year", so the price is whatever makes that sentence exactly true.
 * 12 × $2.99 = $35.88, so annual = $35.88 − $10.00 = **$25.88**. It was $25.99,
 * which saved $9.89 — near enough to round to ten in conversation, and not near
 * enough to print. A round number in the pitch has to be a round number in the
 * arithmetic, or the badge is a rounding error the customer can catch with a
 * calculator, and both stores treat a misstated saving as a misstated price.
 *
 * That is 28% — a shade under "two months free", and a normal, defensible
 * discount rather than a lever. It is worth taking and worth badging; it is not
 * steep enough to make the monthly plan a decoy, so the storefront still has to
 * sell Pro on what it does rather than on the size of the annual saving.
 *
 * ⚠️ IF THE MONTHLY PRICE EVER MOVES, THE ANNUAL ONE MUST MOVE WITH IT or the
 * $10 stops being true. services/__tests__/pricing.test.ts asserts the saving is
 * exactly 10.00 and will fail rather than let the two drift apart quietly.
 *
 * ⚠️ WHAT THAT LEAVES LOAD-BEARING: `coachMessagesPerDay: 100` and
 * `photoScansPerDay: 30` on `PRO_TIER` (tiers.ts) are the ONLY things between a
 * heavy user and a loss on the subscription, and both are client constants.
 *
 * Size the ceiling against the ANNUAL plan, not the monthly one — an annual
 * subscriber pays $25.88 a year, about $2.16 a month, and 100 Haiku turns a day
 * has to fit inside that. Those limits MUST be enforced server-side
 * (docs/monetization/setup.md Part 6): a client-only ceiling gives inference
 * away at a loss with no backstop, and one abusing account costs more than
 * several honest ones bring in.
 */
export const LIST_PRICES: Record<Exclude<Tier, "free">, Record<"monthly" | "annual", number>> = {
  pro: { monthly: 2.99, annual: 25.88 }, // save exactly $10.00/yr — 28%
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
