/**
 * PLAN COPY — how the three tiers describe themselves on the storefront, and how
 * a price becomes the two lines a person actually reads.
 *
 * The numbers are NOT written here. Every quantity on a plan card is read from
 * services/billing/tiers.ts and every amount from the live store (or, where no
 * store exists, the list prices in services/billing/pricing.ts). A card is a
 * promise: if the copy says 25 messages and the gate allows 20, the user is
 * right to call it a lie. Prose is authored; quantities are derived.
 *
 * WHY FREE IS A CARD AND NOT A FOOTNOTE
 *
 * The picker shows Free, Plus and Pro as three cards of the same shape, because
 * that is the actual choice — staying is a choice too. A storefront that hides
 * the tier you're on reads as a trap, and it also throws away the strongest
 * argument for paying: "3 messages a day" sitting directly above "25 a day" is
 * what makes the ask land.
 *
 * EACH CARD CARRIES ITS OWN DIFFERENCE — THERE IS NO COMPARISON TABLE
 *
 * A three-column table asked the reader to hold a row label on the left and a
 * cell on the right in their head at the same time, scan sideways, and work out
 * for themselves which column changed. It also said everything three times: a
 * feature every tier has burned a full row to print the same check mark thrice.
 *
 * So the difference lives on the card instead. `highlights` is not a feature
 * dump — it is strictly WHAT THIS TIER ADDS TO THE ONE BELOW IT, which is the
 * only question a picker has to answer. Free lists what costs nothing; Plus
 * lists what Free does not have; Pro lists what Plus does not have. Anything
 * shared is carried by the "Everything in Free / Plus" line at the foot of the
 * card, once, instead of by a row of identical ticks.
 *
 * The rule that survives from the table: a line that states a quantity
 * INTERPOLATES it from services/billing/tiers.ts. If the copy says 25 messages
 * and the gate allows 20, the user is right to call it a lie.
 */
import type { Ionicons } from "@expo/vector-icons";

import {
  annualSaving,
  formatMoney,
  FREE_TIER,
  historyWindowDays,
  TIER_SHORT_NAME,
  LIST_CURRENCY,
  LIST_PRICES,
  perMonthOfAnnual,
  PLUS_TIER,
  PRO_TIER,
  TIER_NAME,
  type BillingPeriod,
  type PlanOption,
  type Tier,
} from "@/services/billing";

export type PaidTier = Exclude<Tier, "free">;

/** Card order, top to bottom. Cheapest first — the ladder reads upward. */
export const PLAN_CARD_ORDER: readonly Tier[] = ["free", "plus", "pro"] as const;

export interface PlanIdentity {
  /** Short name, as it appears on the card. */
  name: string;
  /** The one line that says what this tier IS. */
  tagline: string;
  /**
   * WHAT THIS TIER ADDS TO THE ONE BELOW IT — not everything it includes.
   *
   * Free lists what costs nothing. Plus lists only what Free lacks, Pro only
   * what Plus lacks; the card's own "Everything in Free / Plus" foot line
   * carries the rest. Repeating an inherited feature here is the bug this
   * replaced a comparison table to avoid.
   *
   * Ordered by how much people actually pay for the line. Quantities are
   * interpolated from the tier limits, never typed out.
   */
  highlights: string[];
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * A tier's history window in the unit that reads best at its own size: days
 * while it's short enough to count, months once it isn't, and plain words when
 * there is no cutoff at all.
 *
 * Derived rather than typed out, so re-tuning `historyDays` in tiers.ts moves
 * the storefront with it — including the case where a window is lifted
 * entirely, which a hardcoded "12 months" would silently keep under-selling.
 */
function historySpan(tier: Tier): string {
  const days = historyWindowDays(tier);
  if (days === null) return "every day you've ever logged";
  return days >= 60 ? `${Math.round(days / 30)} months` : `${days} days`;
}

export const PLAN_IDENTITY: Record<Tier, PlanIdentity> = {
  free: {
    name: "Free",
    tagline: "Everything you log, kept forever.",
    highlights: [
      "Every diet and recommendation in the catalog — the whole thing",
      `${FREE_TIER.coachMessagesPerDay} coach messages a day, ${FREE_TIER.habits} habits`,
      `${historySpan("free")} of charts and trends`,
      "Streaks, reminders and data export — always",
    ],
    icon: "leaf-outline",
  },
  plus: {
    name: "Plus",
    tagline: "Your whole app, unlocked.",
    highlights: [
      `${PLUS_TIER.coachMessagesPerDay} coach messages a day — up from ${FREE_TIER.coachMessagesPerDay} — and Gozlin remembers`,
      "Unlimited habits, with full heatmaps and streak history",
      `${historySpan("plus")} of charts and trends, not ${historySpan("free")}`,
      "Cloud backup and every device you sign in on",
      `Log a meal from a photo, ${PLUS_TIER.photoScansPerDay} a day`,
      "The research behind any answer — evidence, effect sizes, caveats",
    ],
    icon: "sparkles",
  },
  pro: {
    name: "Pro",
    tagline: "And Gozlin thinks with you.",
    highlights: [
      "Diet and workout plans generated for your body",
      "Insights, correlations and nudges before you need them",
      `Charts with no cutoff — ${historySpan("pro")}`,
      `${PRO_TIER.coachMessagesPerDay} coach messages a day, and ${PRO_TIER.photoScansPerDay} photo meal logs`,
    ],
    icon: "diamond",
  },
};

/* ────────────────────────────── Price rendering ─────────────────────────────*/

export interface PriceView {
  /** The big line — ALWAYS a per-month figure, so the two cards compare directly. */
  headline: string;
  /** What "per month" is qualified by. Empty on the free card. */
  unit: string;
  /** The monthly price, struck through, when the annual plan beats it. */
  strikethrough: string | null;
  /** The small line under the price: what is actually charged, and the saving. */
  detail: string;
  /** Whole-percent annual saving, when there's one worth claiming. */
  savePercent: number | null;
  /** The per-month amount as a number, for comparing tiers against each other. */
  perMonthAmount: number;
  /**
   * True when this came from the published list rather than the live store —
   * i.e. no purchase is possible here at all. The screen labels it.
   */
  estimated: boolean;
}

/** The free card's price. Not a purchase, but it has to sit in the same slot. */
export const FREE_PRICE: PriceView = {
  headline: formatMoney(0),
  unit: "forever",
  strikethrough: null,
  detail: "No card, no trial, no expiry",
  savePercent: null,
  perMonthAmount: 0,
  estimated: false,
};

interface Amount {
  value: number;
  text: string;
}

function amountFor(
  tier: PaidTier,
  period: "monthly" | "annual",
  plans: PlanOption[],
): { amount: Amount; plan: PlanOption | null } {
  const plan = plans.find((p) => p.tier === tier && p.period === period) ?? null;
  if (plan) return { amount: { value: plan.priceAmount, text: plan.priceString }, plan };
  const listed = LIST_PRICES[tier][period];
  return { amount: { value: listed, text: formatMoney(listed, LIST_CURRENCY) }, plan: null };
}

/**
 * Turn a tier + period into the price block on its card.
 *
 * Annual is always quoted per month with the monthly price struck through beside
 * it, and the real yearly charge spelled out underneath. That's the only
 * presentation that lets someone compare Plus and Pro at a glance without doing
 * arithmetic, while still stating plainly what will leave their account today —
 * quoting a year's price as if it were a monthly one is the dishonest version of
 * the same layout, and it is what makes people distrust an annual toggle.
 */
export function priceView(
  tier: PaidTier,
  period: BillingPeriod,
  plans: PlanOption[],
): PriceView {
  const wanted = period === "annual" ? "annual" : "monthly";
  const monthly = amountFor(tier, "monthly", plans);
  const annual = amountFor(tier, "annual", plans);
  const active = wanted === "annual" ? annual : monthly;
  const currency = active.plan?.currency ?? LIST_CURRENCY;

  if (wanted === "monthly") {
    return {
      headline: monthly.amount.text,
      unit: "per month",
      strikethrough: null,
      detail: "Billed monthly · cancel any time",
      savePercent: null,
      perMonthAmount: monthly.amount.value,
      estimated: monthly.plan === null,
    };
  }

  const saving = annualSaving(monthly.amount.value, annual.amount.value);
  const perMonth = perMonthOfAnnual(annual.amount.value);

  return {
    headline: annual.plan?.pricePerMonthString ?? formatMoney(perMonth, currency),
    unit: "per month",
    strikethrough: saving ? monthly.amount.text : null,
    detail: saving
      ? `${annual.amount.text} billed yearly · save ${formatMoney(saving.amount, currency)}`
      : `${annual.amount.text} billed yearly`,
    savePercent: saving?.percent ?? null,
    perMonthAmount: perMonth,
    estimated: annual.plan === null,
  };
}

/** The best annual saving on offer, for the period switch's own badge. */
export function bestAnnualSaving(tiers: readonly PaidTier[], plans: PlanOption[]): number | null {
  const percents = tiers
    .map((t) => priceView(t, "annual", plans).savePercent)
    .filter((p): p is number => p !== null);
  return percents.length > 0 ? Math.max(...percents) : null;
}

/**
 * The one-line argument under the Pro button, when Pro is close enough to Plus
 * that the price gap IS the argument.
 *
 * Kept because the gap is a console value, not a constant: a regional price, a
 * promo, or a future repricing can put the two tiers back within a rounding
 * error of each other, and when that happens the strongest thing the card can
 * say is the true subtraction. Until then it stands down.
 *
 * Real subtraction on real prices, and `null` the moment "only" would be a
 * stretch rather than a fact — Pro cheaper, or a gap wider than Plus’s own
 * price. At the current $6.99 / $2.99 it returns null and the card falls back to
 * {@link PRO_VALUE_NOTE}, which is the honest replacement: when a tier costs
 * meaningfully more, it has to justify itself on what it does, not on how little
 * more it costs.
 */
export function proUpsell(plans: PlanOption[], period: BillingPeriod): string | null {
  if (period !== "annual" && period !== "monthly") return null;
  const plus = priceView("plus", period, plans);
  const pro = priceView("pro", period, plans);
  const gap = pro.perMonthAmount - plus.perMonthAmount;
  if (gap <= 0 || gap > plus.perMonthAmount) return null;
  const currency = plans.find((p) => p.tier === "pro")?.currency ?? LIST_CURRENCY;
  return `Only ${formatMoney(Math.round(gap * 100) / 100, currency)} a month more than Plus`;
}

/**
 * The fallback argument under the Pro button, used whenever {@link proUpsell}
 * declines to quote a price gap.
 *
 * Names the one thing Plus genuinely cannot do — generate against your own body
 * rather than match you to something pre-written. That distinction is the whole
 * reason the two tiers exist (see the note at the top of services/billing/
 * tiers.ts), so it is what the more expensive card should say.
 */
export const PRO_VALUE_NOTE =
  "The only tier that writes your plan from your own data";

/* ──────────────────────────── The personal line ─────────────────────────────
 * One true sentence about THIS user, shown above the plans.
 *
 * "See your whole story" is a promise about a feature. "You've logged 87 days —
 * Free shows you the last 30" is a statement about something they already did,
 * and the 57 hidden days are theirs. That is the difference between advertising
 * a benefit and pointing at one, and it is the only line on the storefront that
 * cannot be written in advance.
 *
 * Both functions are pure and both refuse to overstate: the line is null unless
 * the user genuinely has more history than their tier will show them. A brand
 * new account gets no line at all rather than "you've logged 2 days", which
 * would be an argument against paying.
 */

/**
 * Distinct calendar days the user has logged ANYTHING on.
 *
 * Takes several date-carrying histories and unions them, because a day counts
 * as logged whether it was a meal, a weigh-in or a workout — counting only one
 * source would undersell the person who trains daily but tracks food loosely,
 * and undercounting here weakens the exact claim this number exists to make.
 * Malformed or empty dates are dropped rather than counted.
 */
export function countLoggedDays(
  ...sources: readonly (readonly { date?: string }[] | undefined)[]
): number {
  const days = new Set<string>();
  for (const source of sources) {
    for (const row of source ?? []) {
      const d = row?.date;
      if (typeof d === "string" && d.length >= 10) days.add(d.slice(0, 10));
    }
  }
  return days.size;
}

/**
 * The personal line for the storefront hero, or `null` when there isn't an
 * honest one to write.
 *
 * Null in all three cases where the sentence would be a lie or an own goal:
 * a tier with no cutoff at all (nothing is hidden), a user whose history still
 * fits inside their window (nothing is hidden YET — saying so invites them to
 * notice how little they have), and a zero count.
 */
export function historyReachLine(daysLogged: number, tier: Tier): string | null {
  const window = historyWindowDays(tier);
  if (window === null || daysLogged <= window) return null;
  const hidden = daysLogged - window;
  return (
    `You've logged ${daysLogged} days. ${TIER_SHORT_NAME[tier]} shows you the last ${window} — ` +
    `the other ${hidden} ${hidden === 1 ? "is" : "are"} still yours, just out of view.`
  );
}

/** Shown under the cards so free users know what never gets taken away. */
export const ALWAYS_FREE_NOTE =
  "Logging food, water, weight and workouts is always free — along with every diet in the catalog, your streaks, achievements, reminders and data export.";

/** "per month" / "per year", for a price line. */
export function periodLabel(period: BillingPeriod): string {
  return period === "annual" ? "per year" : period === "monthly" ? "per month" : "";
}

/** "Annual" / "Monthly", for a plan name. */
export function periodName(period: BillingPeriod): string {
  return period === "annual" ? "Annual" : period === "monthly" ? "Monthly" : "Plan";
}

/**
 * The auto-renewal sentence. Store policy requires the price, the period, that
 * it renews automatically, and how to stop it — with the buy button itself, not
 * buried in the terms document. Both stores reject paywalls that omit it.
 *
 * `includeTrial` exists because the store reports a product's introductory offer
 * whether or not THIS customer is eligible for it. Trials are new-customer only,
 * so promising one to someone already subscribed (a Plus member moving to Pro)
 * would be a straightforward lie about what they're about to be charged.
 */
export function renewalDisclosure(plan: PlanOption, includeTrial = true): string {
  const period = plan.period === "annual" ? "year" : plan.period === "monthly" ? "month" : "period";
  const trial =
    includeTrial && plan.trialDays
      ? `Your ${plan.trialDays}-day free trial converts to a paid subscription unless you cancel at least 24 hours before it ends. `
      : "";
  return (
    `${trial}${plan.priceString} per ${period}, renewing automatically until you cancel. ` +
    `Cancel any time in your store account settings — you keep ${TIER_NAME[plan.tier]} ` +
    `until the end of the period you've paid for.`
  );
}
