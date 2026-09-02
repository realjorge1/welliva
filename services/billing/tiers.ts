/**
 * TIERS — what Free gets and what Pro unlocks. The one source of truth for the
 * whole product boundary.
 *
 * Every gate in the app reads a constant or an accessor from here instead of
 * hardcoding a number at the call site. The tier boundary is a pricing decision,
 * not an implementation detail: it will be tuned against conversion data after
 * launch, and when it moves it has to move in ONE place. The upgrade screen's
 * comparison table, the catalog filter and the enforcement check must never
 * disagree about what "3 messages" means — a user who is told 3 and cut off at 2
 * files a bug, and rightly.
 *
 * WHY THERE IS ONE PAID TIER
 *
 * There used to be two. PLUS sold depth over data the user already owns — full
 * history, unlimited habits, cloud backup, which costs cents a month to serve —
 * and PRO added generated intelligence, which spends real Haiku inference on
 * every use. The split was defensible on cost of goods and indefensible on the
 * shelf: because Pro contained every Plus feature and beat every Plus limit, the
 * two tiers only ever differed by price, and the gap had narrowed to 70¢ a
 * month. At that distance nobody has a reason to buy the smaller one, so Plus
 * was a decision the storefront asked people to make and then punished them for
 * getting right.
 *
 * So there is now FREE and PRO, and `FEATURE_MIN_TIER` below is the single line
 * between them. The cost-of-goods argument that justified the split has not gone
 * away — it moved onto `coachMessagesPerDay` and `photoScansPerDay`, which are
 * now the only things keeping an inference-heavy user inside the price of one
 * subscription. See the note on PRO_TIER.
 *
 * THE PRINCIPLE BEHIND THE FREE TIER
 *
 * Free is a genuinely useful app, not a demo. Five things are deliberately
 * never gated:
 *
 *  • DATA ENTRY — food, water, weight, workouts. Paywalling logging kills the
 *    habit that makes the app worth paying for, and the accumulated log is the
 *    retention moat. Gate the depth of the analysis, never the input.
 *  • STREAKS, ACHIEVEMENTS, CELEBRATIONS and basic reminders. These drive the
 *    daily return that eventually converts; charging for them is self-defeating.
 *  • EXPORT and ACCOUNT DELETION. Legally required (see docs/legal), and gating
 *    them reads as hostile.
 *  • THE DIET CATALOG AND ITS RECOMMENDATIONS. Every diet, including the
 *    condition protocols and the regional and specialist plans — see the
 *    section below for why this stopped being a paid boundary. Choosing one,
 *    scheduling it and tracking against it are all free, and so is the whole
 *    fitness side: activities, schedules and guided sessions.
 *  • MEMORY. Everything Welliva has worked out about this person from their own
 *    logs stays readable on Free (`/knows`). It is their data being reflected
 *    back, not generated intelligence, and locking it would make the free tier
 *    feel like surveillance rather than a tool.
 *
 * WHERE THE LINE NOW SITS: ANYTHING THAT SPENDS INFERENCE IS PRO
 *
 * The boundary used to be a set of tastes — three coach messages, three habits,
 * three deep dives — on the theory that a small free allowance sells the paid
 * one. It did not survive contact with the cost of goods. Every one of those
 * tastes spends real Haiku inference on a user who has not paid and, at $2.99,
 * mostly never will; the free tier was subsidising the paid one rather than
 * feeding it.
 *
 * So the free allowance for AI is now ZERO, stated plainly rather than metered:
 * `coachMessagesPerDay: 0`, `deepDivesLifetime: 0`, `photoScansPerDay: 0`. Free
 * is the whole tracking app — diets, fitness, hydration, logs, Memory, streaks —
 * and PRO IS GOZLIN. That is a cleaner sentence than any allowance was, it is
 * far easier to sell, and it is the only shape in which the unit economics work
 * at this price.
 *
 * A ZERO IS A BINARY LOCK, AND THE COPY MUST READ AS ONE. "That's my 0 messages
 * for today" is what a metered cap says when its limit is zeroed, and it is
 * nonsense. Anywhere a limit is rendered, the zero case gets its own sentence —
 * see `limitReply` in components/gozlin/useGozlin.ts and the habits lock card.
 *
 * WHAT FREE STILL SEES OF GOZLIN, DELIBERATELY
 *
 * Insight and suggestion cards keep rendering on Home for a free user. They are
 * built by the deterministic on-device coach, they cost nothing to show, and
 * they are the honest advertisement for what opening one would give you. What
 * is withheld is the OPENING — the conversation, the deep dive, the plan. The
 * shelf stays full; the door is what costs money.
 */

/* ────────────────────────────────── Tiers ───────────────────────────────────*/

/** The two tiers, lowest to highest. `free` is what an unpaid account has. */
export type Tier = "free" | "pro";

/** Lowest to highest. Iterate this rather than hardcoding the order anywhere. */
export const TIER_ORDER: readonly Tier[] = ["free", "pro"] as const;

const RANK: Record<Tier, number> = { free: 0, pro: 1 };

/** Does `tier` include everything `min` includes? The one comparison to use. */
export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return RANK[tier] >= RANK[min];
}

/** The higher of two tiers. Used when the store reports both entitlements. */
export function higherTier(a: Tier, b: Tier): Tier {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Narrow an untrusted string (a stored cache, a route param) to a Tier.
 *
 * `"plus"` still resolves — to `pro`, never to free. Plus was a real tier with
 * real records behind it (a cached entitlement, a dev override, a RevenueCat
 * entitlement id that may still be attached to a product in the console), and
 * the one unacceptable outcome when a tier is retired is silently downgrading
 * somebody who paid. Upward is the only safe direction for an unknown paid
 * value, and Plus is a strict subset of Pro, so nothing is over-granted either.
 */
export function toTier(value: unknown): Tier {
  return value === "pro" || value === "plus" ? "pro" : "free";
}

/** Full product name — "Welliva Pro". For headlines and store-facing copy. */
export const TIER_NAME: Record<Tier, string> = {
  free: "Welliva Free",
  pro: "Welliva Pro",
};

/** One word — "Pro". For pills, badges and anywhere the brand is already implied. */
export const TIER_SHORT_NAME: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
};

/* ────────────────────────── The diet catalog is FREE ────────────────────────
 * Every diet in the catalog, and every recommendation built on it, is available
 * on every tier. There is no diet lock, and this file deliberately no longer
 * has the vocabulary to build one.
 *
 * WHY IT WAS REMOVED
 *
 * The catalog used to be split three ways: 10 mainstream plans given away, 13
 * condition protocols ("Condition mode") sold as the Plus identity, and 5
 * specialist/lifestyle plans (bodybuilding, athlete endurance, weight gain,
 * wellness detox, traditional African) sold alongside them. That split kept
 * losing the same argument with the free-tier principle above:
 *
 *  • A DIET IS NOT A FEATURE, IT IS THE ANSWER TO WHY THEY OPENED THE APP.
 *    Someone with PCOS, coeliac disease or renal impairment is not browsing —
 *    they came for the one plan their body needs. Meeting them with a padlock
 *    is how an app gets uninstalled before it ever earns the right to charge.
 *  • THE SPECIALIST SET COULD NOT BE DEFENDED AT ALL. "Traditional African" is
 *    the plan a whole region eats; charging for it made the catalog's reach
 *    read as a paid add-on rather than as the product being for everyone.
 *  • IT IS CONTENT WE ALREADY HAVE. Serving one more diet costs nothing per
 *    user, so the revenue it protected was never worth the top-of-funnel it
 *    taxed. What Welliva actually sells is DEPTH over the user's own data
 *    (history, backup, unlimited habits) and GENERATED INTELLIGENCE (plans
 *    written for this body, insights, uncapped coaching) — both below.
 *
 * The condition/specialist classification survives as catalog metadata, not as
 * a price boundary: CONDITION_DIET_IDS and isConditionDiet now live in
 * constants/DietDatabase.ts next to the diets they describe, and drive the
 * "Condition mode" label on a diet card. If a diet lock is ever proposed again,
 * argue the PRINCIPLE first — that is the argument this one lost.
 */

/* ───────────────────────────────── The limits ───────────────────────────────*/

export interface TierLimits {
  /**
   * AI coach turns per day. Only turns that actually reach the backend count —
   * the deterministic on-device coach is always free (see `services/gozlin`).
   *
   * `0` is a real value and means the conversation is a PAID FEATURE, not a
   * metered one. Free is zero: see the header. Any UI that prints this number
   * must branch on zero rather than interpolating it into a sentence about
   * having "used up" an allowance nobody ever had.
   */
  coachMessagesPerDay: number;
  /**
   * How far back charts, reports and body-log trends read. `null` = no cutoff.
   * The data is still theirs and is never deleted — this bounds the QUERY, not
   * the storage, and it gets more compelling the longer they stay.
   */
  historyDays: number | null;
  /**
   * MANUAL habit slots — the ones the user creates themselves, from "Suggested
   * for you" or from scratch. `null` = unlimited, `0` = Pro only.
   *
   * Manual only, and that is not a detail: every user is seeded with three
   * auto-tracked habits (water / meals / workout — see `seedDefaultHabits`)
   * that complete themselves from logged data. Those are LINKED habits, they
   * are always free and always uncapped, and they are what a free user's habit
   * screen actually is: food, water and workouts, ticking themselves off the
   * logs they were already keeping.
   *
   * Counting linked habits against the cap would leave a free user staring at
   * an empty screen and gating logging feedback through the back door, which is
   * why every call site filters on `source === "manual"` before asking.
   */
  habits: number | null;
  /** Photo meal scans per day. 0 = not available on this tier. */
  photoScansPerDay: number;
  /**
   * DEEP DIVES — the research expansion behind a coach reply ("the research
   * behind my answer") — allowed EVER, not per day. `null` = unlimited,
   * `0` = Pro only.
   *
   * A lifetime figure rather than a daily one because a dive is not a rhythm,
   * it is a thing you go and read. Free is now zero: a dive is a second Haiku
   * call on top of a reply a free user cannot send in the first place, so a
   * lifetime taste here would be an allowance attached to a door that is
   * already shut.
   */
  deepDivesLifetime: number | null;
}

export const FREE_TIER: TierLimits = {
  /**
   * ZERO. The conversation is the product Pro sells; see the header. Free still
   * sees Gozlin's insight and suggestion cards on Home — they cost nothing to
   * render and they are the argument for opening one.
   */
  coachMessagesPerDay: 0,
  historyDays: 30,
  /** Zero MANUAL habits. The three auto-tracked ones — food, water, workouts —
   *  are not manual and are never counted, so a free user keeps a working habit
   *  screen; "Suggested for you" and custom habits are what Pro adds. */
  habits: 0,
  photoScansPerDay: 0,
  deepDivesLifetime: 0,
};

export const PRO_TIER: TierLimits = {
  /**
   * A fair-use ceiling on "unlimited". Not there to save money at the median —
   * a normal heavy user sends maybe 15 turns a day — but so a scripted abuser
   * cannot run up unbounded Haiku spend on one subscription. Anyone who hits
   * this is not a real user.
   *
   * ⚠️ THIS NUMBER IS NOW THE WHOLE MARGIN. It was set when Pro sold at $6.99
   * and survived the drop to $2.99, which is where the single paid tier now
   * sits — and an annual subscriber pays about $2.17 a month. So the turns one
   * subscription can spend have to be worth less than that in Haiku for the
   * tier to make money. At 100/day they are not: a user who actually ran the
   * ceiling every day would cost multiples of the subscription. That is
   * tolerable only because almost nobody does, which makes this a bet on the
   * distribution rather than a limit that protects the business.
   *
   * MUST be mirrored server-side (docs/monetization/setup.md Part 6). A client
   * ceiling is a courtesy; a modified client ignores it. At the old price that
   * was a risk worth carrying for a release; at this one it is the difference
   * between a cheap tier and an unbounded one.
   */
  coachMessagesPerDay: 100,
  /** Unbounded history. `null` means "no cutoff". */
  historyDays: null,
  habits: null,
  photoScansPerDay: 30,
  deepDivesLifetime: null,
};

/** Limits by tier. The accessors below are the preferred way to read these. */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: FREE_TIER,
  pro: PRO_TIER,
};

/* ──────────────────────────── The feature boundary ──────────────────────────
 * Which tier a capability starts at. This is the whole product split, as data.
 *
 * The ids double as the paywall's `source` — the lock that sent the user to the
 * upgrade screen selects both the contextual headline (components/billing/
 * lockCopy.ts) and the tier the CTA offers. Keeping them one vocabulary means a
 * lock cannot advertise a tier that doesn't actually unlock it.
 */
export type FeatureId =
  | "coach-limit"
  | "ai-plans"
  | "sync"
  | "history"
  | "insights"
  | "habits"
  | "foods"
  | "photo-log"
  | "deep-dive"
  | "generic";

export const FEATURE_MIN_TIER: Record<FeatureId, Tier> = {
  /* ── Gozlin. Every one of these spends inference on a real question. ───────*/
  "coach-limit": "pro", // 0 on free — the conversation IS the paid feature
  "deep-dive": "pro", // "the research behind my answer"
  "ai-plans": "pro",
  insights: "pro",
  "photo-log": "pro", // none on free, 30/day on Pro

  /* ── Depth over data the user already owns. Cents a month to serve. ────────*/
  habits: "pro", // "Suggested for you" + custom; the linked three stay free
  foods: "pro", // the searchable whole-foods catalog
  sync: "pro",
  history: "pro", // 30 days → no cutoff at all

  /** The unattributed ask. There is only one thing to offer. */
  generic: "pro",
};

/** The tier a feature starts at. */
export function featureMinTier(feature: FeatureId): Tier {
  return FEATURE_MIN_TIER[feature];
}

/**
 * May a user on `tier` use `feature`? The one question a binary lock asks.
 *
 * Note this is the PURE form: it knows nothing about whether billing is
 * configured in this build. Feature code should call `allows()` in gating.ts,
 * which layers the fail-open rule on top.
 */
export function tierAllowsFeature(tier: Tier, feature: FeatureId): boolean {
  return tierAtLeast(tier, FEATURE_MIN_TIER[feature]);
}

/* ─────────────────────────────────  Accessors  ──────────────────────────────
 * Prefer these over reading the constants directly: the tier branch lives in
 * one place, so a gate can never accidentally apply a free limit to a Pro user.
 */

/** Coach turns allowed today. */
export function coachDailyLimit(tier: Tier): number {
  return TIER_LIMITS[tier].coachMessagesPerDay;
}

/** Photo meal scans allowed today. */
export function photoScanDailyLimit(tier: Tier): number {
  return TIER_LIMITS[tier].photoScansPerDay;
}

/**
 * Deep dives allowed for the LIFETIME of this install, or `null` for unlimited.
 *
 * Not a daily meter: see the note on TierLimits.deepDivesLifetime for why the
 * allowance never comes back, and services/billing/allowance.ts for why it is
 * never counted out loud.
 */
export function deepDiveLifetimeLimit(tier: Tier): number | null {
  return TIER_LIMITS[tier].deepDivesLifetime;
}

/** Manual habit slots, or `null` for unlimited. */
export function habitLimit(tier: Tier): number | null {
  return TIER_LIMITS[tier].habits;
}

/**
 * May another manual habit be created?
 *
 * `manualCount` must exclude auto-tracked (linked) habits — see the note on
 * `TierLimits.habits`. Callers get this right by filtering on
 * `habit.source === "manual"`; passing a total that includes the three seeded
 * linked habits would also hide those three from a free user, which is the one
 * thing their habit screen is made of.
 *
 * On Free the limit is 0, so this is now a flat "no" rather than a countdown.
 * UI that explains the refusal must say "Pro adds your own habits", never
 * "you've used all 0 of your free habits".
 */
export function canCreateHabit(manualCount: number, tier: Tier): boolean {
  const limit = habitLimit(tier);
  return limit === null || manualCount < limit;
}

/** How many days back history may be read, or `null` for everything. */
export function historyWindowDays(tier: Tier): number | null {
  return TIER_LIMITS[tier].historyDays;
}

/**
 * Is a chart range wider than this tier's history window?
 *
 * Used to mark {@link TrendSeries.locked} tabs. The companion rule, which lives
 * at the call sites because only they know their own ranges: A CHART'S SHORTEST
 * RANGE IS ALWAYS FREE, even when it already exceeds the window. The training
 * chart's narrowest view is 8 weeks, so applying the cutoff blindly would lock
 * the whole card — and a card with every tab locked reads as broken, not as an
 * upsell. Free keeps a working chart; the paid tiers sell seeing further back.
 */
export function isHistoryRangeLocked(rangeDays: number, tier: Tier): boolean {
  const max = historyWindowDays(tier);
  return max !== null && rangeDays > max;
}

/**
 * Clamp a requested chart/report window to what this tier may read.
 *
 * The trend builders in components/charts/series.ts all take an explicit `days`,
 * so bounding a chart is just narrowing that number — no query rewriting and no
 * change to what is stored. A free user asking for a 90-day weight trend gets
 * the last 30 plotted; upgrading re-renders the same chart with all 90.
 */
export function clampHistoryDays(requested: number, tier: Tier): number {
  const max = historyWindowDays(tier);
  return max === null ? requested : Math.min(requested, max);
}

/**
 * The earliest date a user's history may reach, as `YYYY-MM-DD`, or `null` when
 * unbounded. Callers pass their own "today" so this stays pure and testable and
 * agrees with AppContext's clock rather than the wall clock.
 */
export function historyCutoffDate(tier: Tier, today: Date = new Date()): string | null {
  const days = historyWindowDays(tier);
  if (days === null) return null;
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
