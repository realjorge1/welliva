/**
 * PLAN COPY — how the two tiers describe themselves on the storefront, and how
 * a price becomes the two lines a person actually reads.
 *
 * The numbers are NOT written here. Every quantity on a plan card is read from
 * services/billing/tiers.ts and every amount from the live store (or, where no
 * store exists, the list prices in services/billing/pricing.ts). A card is a
 * promise: if the copy says 100 messages and the gate allows 25, the user is
 * right to call it a lie. Prose is authored; quantities are derived.
 *
 * WHY FREE IS A CARD AND NOT A FOOTNOTE
 *
 * The picker shows Free and Pro as two cards of the same shape, because that is
 * the actual choice — staying is a choice too. A storefront that hides the tier
 * you're on reads as a trap. It also throws away the argument for paying: the
 * two cards side by side are the whole pitch, one being the tracking app and the
 * other being Gozlin.
 *
 * EACH CARD CARRIES ITS OWN DIFFERENCE — THERE IS NO COMPARISON TABLE
 *
 * A multi-column table asked the reader to hold a row label on the left and a
 * cell on the right in their head at the same time, scan sideways, and work out
 * for themselves which column changed. It also said everything twice over: a
 * feature every tier has burned a full row to print the same check mark again.
 *
 * So the difference lives on the card instead. `highlights` is not a feature
 * dump — it is strictly WHAT THIS TIER ADDS TO THE ONE BELOW IT, which is the
 * only question a picker has to answer. Free lists what costs nothing; Pro
 * lists what Free does not have. Anything shared is carried by the "Everything
 * in Free" line at the foot of the card, once, instead of by a row of identical
 * ticks.
 *
 * PRO'S LIST IS LONG, AND IT HAS A RULE
 *
 * THERE IS ONE LINE PER LOCK. Every Pro entry below carries the `FeatureId` it
 * sells, every `FeatureId` except `generic` appears exactly once, and
 * `services/__tests__/planCopy.test.ts` fails the build if that stops being
 * true. A lock that sends someone here and finds nothing on the card about what
 * they just hit is the worst version of this screen; a line that promises
 * something no lock actually withholds is the second worst, and it is the one
 * that happens by accident when copy is edited without the gate.
 *
 * Within that, order by how much people pay for the line, not by code order.
 *
 * NEITHER CARD LISTS WHAT IT DOESN'T DO
 *
 * The free card briefly carried a second "Not included" list, on the reasoning
 * that a zero AI allowance can't sell itself the way "3 a day" above "100 a day"
 * once did. It is gone, and the reason it is gone is the same principle the
 * comparison table lost to: each card states what it IS, and the difference
 * between them is carried by the Pro card's own list.
 *
 * A tier that spends half its card apologising undersells itself. Free IS the
 * whole tracking app — diets, fitness, logs, habits that tick themselves,
 * Memory, streaks — and reading Pro's list is how you learn what it doesn't
 * have. That is one place to maintain instead of two that can contradict each
 * other, and it keeps the free card a description rather than a disclaimer.
 *
 * The rule that survives from the old comparison table: a line that states a
 * quantity INTERPOLATES it from services/billing/tiers.ts. If the copy says 100
 * messages and the gate allows 25, the user is right to call it a lie.
 */
import type { Ionicons } from "@expo/vector-icons";

/*
 * IMPORTED FROM THE LEAF MODULES, NOT FROM `@/services/billing`.
 *
 * The barrel re-exports `config.ts`, which imports `react-native` for
 * `Platform`, which drags the whole native module graph in behind it. This file
 * is pure data and prose — it has no runtime dependency on the store, the SDK
 * or the device — and going through the barrel was the only thing making it
 * untestable outside a React Native runtime. `services/billing/pricing.ts` and
 * `tiers.ts` import nothing at runtime, so reaching for them directly keeps the
 * storefront's copy checkable in plain Node (components/__tests__/planCopy.test.ts).
 *
 * `Billing` is TYPE-ONLY and must stay that way: it loads react-native-purchases.
 */
import type { BillingPeriod, PlanOption } from "@/services/billing/Billing";
import {
  annualSaving,
  formatMoney,
  LIST_CURRENCY,
  LIST_PRICES,
  perMonthOfAnnual,
} from "@/services/billing/pricing";
/*
 * `PRO_TIER` is deliberately NOT imported any more. Both lines that used to
 * interpolate one of its numbers — 100 coach messages a day, 30 photo scans a
 * day — now describe the capability instead of counting it, because both of
 * those figures are fair-use ceilings against scripted abuse rather than the
 * shape of the product. Quantities are still derived wherever a card states
 * one (see `historySpan`); the rule is unchanged, there is simply less to state.
 */
import {
  type FeatureId,
  historyWindowDays,
  TIER_NAME,
  type Tier,
} from "@/services/billing/tiers";

export type PaidTier = Exclude<Tier, "free">;

/**
 * Card order, top to bottom. PRO FIRST.
 *
 * It was Free first, "so the ladder reads upward" — a rule from three tiers.
 * With one paid card holding the only price tag and the only buy button, Free
 * first put the whole tracking-app card (a phone-height list) between the hero
 * and the one price anyone opened this screen to read. Pro now follows the hero
 * that pitches it; Free follows as the plan you keep either way.
 */
export const PLAN_CARD_ORDER: readonly Tier[] = ["pro", "free"] as const;

/**
 * One line on a plan card.
 *
 * `feature` is what makes the one-line-per-lock rule checkable instead of
 * aspirational: a Pro line names the `FeatureId` it sells, so the test can pair
 * the storefront against FEATURE_MIN_TIER and fail when they drift. Free lines
 * describe things no gate withholds, so they carry no id.
 */
export interface PlanLine {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** The lock this line sells. Required on Pro, absent on Free. */
  feature?: FeatureId;
}

export interface PlanIdentity {
  /** Short name, as it appears on the card. */
  name: string;
  /** The one line that says what this tier IS. */
  tagline: string;
  /**
   * WHAT THIS TIER ADDS TO THE ONE BELOW IT — not everything it includes.
   *
   * Free lists what costs nothing. Pro lists only what Free lacks; the card's
   * own "Everything in Free" foot line carries the rest. Repeating an inherited
   * feature here is the bug this replaced a comparison table to avoid.
   *
   * Ordered by how much people actually pay for the line. Quantities are
   * interpolated from the tier limits, never typed out.
   */
  highlights: PlanLine[];
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
    /* Not "the basics" and not "a taste". Free is the entire tracking app, and
       saying so is what makes the Pro card an addition rather than a ransom.
       It deliberately does NOT end "no card, no trial, no expiry" — that is
       FREE_PRICE.detail, which renders two lines below this one. */
    tagline: "The whole tracking app — diets, fitness, logs and Memory.",
    highlights: [
      {
        text: "Every diet in the catalog — choose one, schedule it, track it",
        icon: "restaurant-outline",
      },
      {
        text: "Fitness in full: the activity library, your schedule and guided sessions",
        icon: "barbell-outline",
      },
      {
        text: "Unlimited food, water, weight and workout logs",
        icon: "water-outline",
      },
      {
        /* The three seeded LINKED habits, named individually. "3 habits" is a
           quota; "food, water and workouts" is a description of what they'll
           actually open the tab and see, and it is the honest version — those
           three tick themselves off logs and never count against anything. */
        text: "Three habits that track themselves: food, water and workouts",
        icon: "repeat-outline",
      },
      {
        text: "Memory — everything welliva has worked out about you, in your words",
        icon: "book-outline",
      },
      {
        text: `${historySpan("free")} of charts and trends`,
        icon: "stats-chart-outline",
      },
      {
        text: "Streaks, achievements, reminders and data export — always",
        icon: "trophy-outline",
      },
    ],
    icon: "leaf-outline",
  },
  pro: {
    name: "Pro",
    /* One idea, not eight. Pro is Gozlin; everything below is that sentence
       itemised. */
    tagline: "Gozlin, unlocked — a coach that reads your data and answers back.",
    highlights: [
      {
        /* NO NUMBER HERE, deliberately. Pro's `coachMessagesPerDay` is a
           fair-use ceiling against scripted abuse, not a feature — see the note
           on PRO_TIER. Printing it turns "talk to your coach" into "you get
           100 of something", which invites the reader to wonder what happens at
           101 and to price a conversation by the message. The cap still exists
           and is still enforced; it just isn't the pitch. */
        text: "Gozlin chat — talk it through with a coach that has read your logs",
        icon: "chatbubbles-outline",
        feature: "coach-limit",
      },
      {
        text: "Coaching you can open: insights, correlations and nudges before you need them",
        icon: "bulb-outline",
        feature: "insights",
      },
      {
        /* Worded to match the poster in components/gozlin/DeepDiveReader, which
           is where someone who tapped this and hit the lock has just been.
           Deliberately NOT in quotation marks: the affordance in the thread is
           labelled "Details", so quoting a phrase no button actually carries
           would send them hunting for a control that doesn't exist. */
        text: "The research behind any answer — evidence, effect sizes and caveats",
        icon: "library-outline",
        feature: "deep-dive",
      },
      {
        text: "Diet and workout plans written for your body, not picked for it",
        icon: "sparkles-outline",
        feature: "ai-plans",
      },
      {
        text: "Suggested-for-you and custom habits — unlimited, with full heatmaps",
        icon: "repeat-outline",
        feature: "habits",
      },
      {
        text: "The Foods catalog — search anything you eat, log it at a real portion",
        icon: "search-outline",
        feature: "foods",
      },
      {
        /* No count, for the same reason the chat line carries none: 30/day is
           a fair-use ceiling, not the shape of the feature. */
        text: "Log a meal from a photo — portions read, not guessed",
        icon: "camera-outline",
        feature: "photo-log",
      },
      {
        text: `Charts with no cutoff — ${historySpan("pro")}, not ${historySpan("free")}`,
        icon: "trending-up-outline",
        feature: "history",
      },
      {
        text: "Cloud backup, on every device you sign in on",
        icon: "cloud-done-outline",
        feature: "sync",
      },
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
  /**
   * The whole price as one sentence — what is charged, how often, and that it
   * can be stopped. The tag renders the same facts as a ledger; this is what a
   * screen reader hears in its place.
   */
  detail: string;
  /** The ledger row's label — "Billed yearly". Null on the free card. */
  billedLabel: string | null;
  /**
   * Twelve months of the monthly plan, formatted — "$35.88". Struck through
   * beside `billedTotal` on the tag, so the saving is visible as the two
   * numbers it is the difference of. Annual only, and only with a saving.
   */
  compareTotal: string | null;
  /**
   * The quiet line at the foot of the tag. `lead` is the part worth inking
   * (the discount); `rest` carries on in the muted weight after it.
   */
  footnote: { lead: string | null; rest: string };
  /**
   * THE SAVING, AS MONEY, ALREADY FORMATTED — "$10.00". Null when there is
   * nothing honest to claim (monthly selected, or a gap under 5%).
   *
   * This is a separate field rather than a phrase inside `detail` because the
   * saving is the single strongest number on the storefront and it was being
   * whispered: "…billed yearly · save $10.00" put it fourth in a grey footnote,
   * behind a figure it has nothing to do with. The tag hangs it on the Annual
   * tile (components/billing/PriceTag.tsx), which it can only do if the amount
   * arrives as a value instead of pre-baked prose.
   *
   * Formatted here, in the currency the LIVE PLAN came back in, because the
   * screen has no business knowing which currency a price was quoted in.
   */
  saveAmount: string | null;
  /** Whole-percent annual saving, when there's one worth claiming. */
  savePercent: number | null;
  /** What actually leaves the account, formatted — "$25.88". Annual only. */
  billedTotal: string | null;
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
  billedLabel: null,
  compareTotal: null,
  footnote: { lead: null, rest: "No card, no trial, no expiry" },
  saveAmount: null,
  savePercent: null,
  billedTotal: null,
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

/*
 * ─── AMOUNTS WE WORK OUT OURSELVES, WRITTEN THE WAY THE STORE WRITES ITS OWN ───
 *
 * The store hands over finished strings for the two prices it charges, and
 * those are always right: "₦1,450.00", "₦12,300.00". Three figures on the tag
 * are ours — the annual plan per month, the saving, and twelve months of the
 * monthly plan — and each used to go through a different formatter:
 *
 *  · RevenueCat's `pricePerMonthString` printed "NGN1,025.00";
 *  · `Intl.NumberFormat` under Hermes printed "NGN5,100";
 *  · beside the store's own "₦1,450.00".
 *
 * One card, one currency, two spellings of it — and "NGN" reads as a foreign
 * price to the person it's supposed to be local for. So every figure we compute
 * now borrows the store's own string as a TEMPLATE: its currency mark, which
 * side of the number it sits on, its separators and its decimal places. Whatever
 * the store writes for this user, our numbers are written the same way.
 */

/**
 * `amount`, formatted like `template` (a store price string).
 *
 * `trimWholeCents` drops ".00" from a round amount — for a saving on a tag,
 * where "SAVE ₦5,100" is the number and ".00" is noise. Prices are never
 * trimmed: they must match the store's own strings beside them.
 *
 * Null when the template has no ASCII figure to learn from.
 */
export function formatLike(
  template: string,
  amount: number,
  trimWholeCents = false,
): string | null {
  const m = /^(\D*?)(\d(?:[\d.,'\s]*\d)?)(\D*)$/.exec(template.trim());
  if (!m) return null;
  const [, lead, figure, trail] = m;

  // A separator followed by one or two digits at the end is the decimal point;
  // three digits after it ("12,300") means it was grouping all along.
  const cents = /[.,](\d{1,2})$/.exec(figure);
  const decimalMark = cents ? figure[figure.length - cents[1].length - 1] : ".";
  const places = cents ? cents[1].length : 0;
  const integerPart = cents ? figure.slice(0, figure.length - cents[1].length - 1) : figure;
  // The template's own grouping mark if it has one; otherwise the conventional
  // partner of its decimal mark.
  const groupMark = /\D/.exec(integerPart)?.[0] ?? (decimalMark === "," ? "." : ",");

  const round = trimWholeCents && Math.abs(amount - Math.round(amount)) < 0.005;
  const [whole, fraction] = amount.toFixed(round ? 0 : places).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupMark);
  return `${lead}${fraction ? `${grouped}${decimalMark}${fraction}` : grouped}${trail}`;
}

/**
 * The formatter for every figure on a tier's tag. The template is whichever of
 * the tier's store strings has the most digits — the annual price usually shows
 * a grouping mark ("12,300") that the monthly one ("950") never needed.
 */
function moneyFor(tier: PaidTier, plans: PlanOption[]) {
  const template =
    plans
      .filter((p) => p.tier === tier)
      .map((p) => p.priceString)
      .sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length)[0] ?? null;
  const currency = plans.find((p) => p.tier === tier)?.currency ?? LIST_CURRENCY;
  return (amount: number, trimWholeCents = false): string => {
    const store = template ? formatLike(template, amount, trimWholeCents) : null;
    if (store) return store;
    const round = trimWholeCents && Math.abs(amount - Math.round(amount)) < 0.005;
    return formatMoney(round ? Math.round(amount) : amount, currency);
  };
}

/**
 * Turn a tier + period into the price block on its card.
 *
 * Annual is always quoted per month with the monthly price struck through beside
 * it, and the real yearly charge spelled out underneath. That's the only
 * presentation that lets someone compare the two periods at a glance without
 * doing arithmetic, while still stating plainly what will leave their account —
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
  const money = moneyFor(tier, plans);

  if (wanted === "monthly") {
    return {
      headline: monthly.amount.text,
      unit: "per month",
      strikethrough: null,
      detail: `${monthly.amount.text} billed every month · cancel any time`,
      billedLabel: "Billed monthly",
      compareTotal: null,
      footnote: { lead: null, rest: "Cancel any time" },
      saveAmount: null,
      savePercent: null,
      billedTotal: null,
      perMonthAmount: monthly.amount.value,
      estimated: monthly.plan === null,
    };
  }

  const saving = annualSaving(monthly.amount.value, annual.amount.value);
  const perMonth = perMonthOfAnnual(annual.amount.value);

  return {
    // Computed, not the SDK's `pricePerMonthString`: that one spells the
    // currency its own way ("NGN1,025.00" beside the store's "₦12,300.00").
    headline: money(perMonth),
    unit: "per month",
    strikethrough: saving ? monthly.amount.text : null,
    // The one fact the big per-month figure doesn't state: the amount that
    // actually leaves the account, and when.
    detail: `${annual.amount.text} billed once a year · cancel any time`,
    billedLabel: "Billed yearly",
    compareTotal: saving ? money(monthly.amount.value * 12) : null,
    footnote: saving
      ? { lead: `${saving.percent}% off`, rest: "paying month to month · cancel any time" }
      : { lead: null, rest: "Cancel any time" },
    saveAmount: saving ? money(saving.amount, true) : null,
    savePercent: saving?.percent ?? null,
    billedTotal: annual.amount.text,
    perMonthAmount: perMonth,
    estimated: annual.plan === null,
  };
}

/**
 * The free card's price in the reader's own currency — "₦0", not "$0", once the
 * store has said which currency that is. Before it has, the published list
 * currency, same as every other fallback on this screen.
 */
export function freePriceView(plans: PlanOption[]): PriceView {
  if (plans.length === 0) return FREE_PRICE;
  return { ...FREE_PRICE, headline: moneyFor(plans[0].tier, plans)(0, true) };
}

/**
 * The best annual saving on offer, for the tag on the Annual tile.
 *
 * Returns the MONEY as well as the percent. A "SAVE 28%" badge asks the reader
 * to work out what 28% of a price they haven't read yet comes to; "SAVE $10.00"
 * is the answer, and it is the number people actually weigh. The percent rides
 * along for the cases where it flatters the offer more than the amount does —
 * which, on a $2.99 subscription, it usually does not.
 */
export interface BestSaving {
  /** Formatted money — "$10.00". */
  amount: string;
  percent: number;
}

export function bestAnnualSaving(
  tiers: readonly PaidTier[],
  plans: PlanOption[],
): BestSaving | null {
  let best: BestSaving | null = null;
  let bestValue = 0;
  for (const t of tiers) {
    const view = priceView(t, "annual", plans);
    if (view.saveAmount === null || view.savePercent === null) continue;
    // Compare on the per-month gap rather than parsing the formatted string —
    // a localised amount is not a number, and never will be.
    const monthly = amountFor(t, "monthly", plans).amount.value;
    const gap = monthly - view.perMonthAmount;
    if (gap > bestValue) {
      bestValue = gap;
      best = { amount: view.saveAmount, percent: view.savePercent };
    }
  }
  return best;
}

/**
 * The one-line argument under the Pro button.
 *
 * This used to be a function. `proUpsell()` computed the live price gap between
 * Plus and Pro and printed "only 70¢ a month more than Plus" — an argument that
 * only exists when there is a cheaper paid tier to be measured against. With one
 * paid tier the comparison has no second term, so the note goes back to naming
 * what the money actually buys.
 *
 * It names Gozlin rather than a feature deliberately: the nine lines above it
 * are all one thing, and a reader who has just scanned them needs the sentence
 * that ties them together, not a tenth feature. Reasoning against this body,
 * these logs and these conditions is also the only claim on this screen that a
 * competitor cannot match by shipping a feature.
 */
export const PRO_VALUE_NOTE = "Everything above is one thing: Gozlin, thinking about your data";

/*
 * THE "YOU'VE LOGGED N DAYS" LINE IS GONE (owner's call, 2026-09-26). It sat
 * above the plans as a bordered card counting the reader's logged days against
 * the free window. Removed outright along with `countLoggedDays` and
 * `historyReachLine`, which nothing else used.
 */

/**
 * Shown under the cards so free users know what never gets taken away.
 *
 * It matters more now than it did when Free had a coach allowance: a tier whose
 * AI is switched off entirely needs to be told, in the last thing on the page,
 * that the app they already use is not what is being held hostage.
 */
export const ALWAYS_FREE_NOTE =
  "Logging food, water, weight and workouts is always free — along with every diet in the catalog, your fitness schedule, your Memory, your streaks, achievements, reminders and data export. Cancelling Pro never touches any of it.";

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
