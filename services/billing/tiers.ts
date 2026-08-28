/**
 * TIERS — what Free gets, what Plus adds, and what Pro unlocks. The one source
 * of truth for the whole product boundary.
 *
 * Every gate in the app reads a constant or an accessor from here instead of
 * hardcoding a number at the call site. The tier boundary is a pricing decision,
 * not an implementation detail: it will be tuned against conversion data after
 * launch, and when it moves it has to move in ONE place. The upgrade screen's
 * comparison table, the catalog filter and the enforcement check must never
 * disagree about what "3 messages" means — a user who is told 3 and cut off at 2
 * files a bug, and rightly.
 *
 * WHY THERE ARE TWO PAID TIERS
 *
 * The two things Welliva sells have completely different marginal costs. Depth
 * over data the user already owns — full history, unlimited habits, cloud
 * backup — costs cents a month to serve. Generated intelligence — a plan
 * written against your body, correlations across your logs, a coach with no
 * daily cap — costs real Haiku inference per use. Pricing both at one number
 * means either overcharging the person who just wants their own data back, or
 * losing money on the person who talks to Gozlin forty times a day.
 *
 * So: PLUS is the "all of your app, unlocked" tier. PRO is the "and Gozlin
 * thinks for you" tier. `FEATURE_MIN_TIER` below is where that split is
 * actually decided, and it is the only place it may be decided.
 *
 * THE PRINCIPLE BEHIND THE FREE TIER
 *
 * Free is a genuinely useful app, not a demo. Four things are deliberately
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
 *    section below for why this stopped being a paid boundary.
 */

/* ────────────────────────────────── Tiers ───────────────────────────────────*/

/** The three tiers, lowest to highest. `free` is what an unpaid account has. */
export type Tier = "free" | "plus" | "pro";

/** Lowest to highest. Iterate this rather than hardcoding the order anywhere. */
export const TIER_ORDER: readonly Tier[] = ["free", "plus", "pro"] as const;

const RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

/** Does `tier` include everything `min` includes? The one comparison to use. */
export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return RANK[tier] >= RANK[min];
}

/** The higher of two tiers. Used when the store reports both entitlements. */
export function higherTier(a: Tier, b: Tier): Tier {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Narrow an untrusted string (a stored cache, a route param) to a Tier. */
export function toTier(value: unknown): Tier {
  return value === "pro" || value === "plus" ? value : "free";
}

/** Full product name — "Welliva Plus". For headlines and store-facing copy. */
export const TIER_NAME: Record<Tier, string> = {
  free: "Welliva Free",
  plus: "Welliva Plus",
  pro: "Welliva Pro",
};

/** One word — "Plus". For pills, badges and anywhere the brand is already implied. */
export const TIER_SHORT_NAME: Record<Tier, string> = {
  free: "Free",
  plus: "Plus",
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
   */
  coachMessagesPerDay: number;
  /**
   * How far back charts, reports and body-log trends read. `null` = no cutoff.
   * The data is still theirs and is never deleted — this bounds the QUERY, not
   * the storage, and it gets more compelling the longer they stay.
   */
  historyDays: number | null;
  /**
   * MANUAL habit slots. `null` = unlimited. HabitKit's exact model, and it
   * converts.
   *
   * Manual only, and that is not a detail: every user is seeded with three
   * auto-tracked habits (water / meals / workout — see `seedDefaultHabits`)
   * that complete themselves from logged data. Counting those against the cap
   * would leave a brand-new free user with zero slots and no way to create a
   * single habit, and it would be gating logging feedback through the back
   * door. Linked habits are always free and always uncapped.
   */
  habits: number | null;
  /** Photo meal scans per day. 0 = not available on this tier. */
  photoScansPerDay: number;
  /**
   * DEEP DIVES — the research expansion behind a coach reply — allowed EVER,
   * not per day. `null` = unlimited.
   *
   * A lifetime figure because this is the one capability whose value is
   * obvious on first contact and impossible to describe: nobody upgrades for
   * "more detailed answers", and everybody understands it after reading one.
   * Free gets real uses, unannounced and uncounted (services/billing/
   * allowance.ts), and after that it is what it is — a Plus feature.
   */
  deepDivesLifetime: number | null;
}

export const FREE_TIER: TierLimits = {
  /** Three is enough to feel what Gozlin is; the fourth is where the value has
   *  landed and the ask makes sense. */
  coachMessagesPerDay: 3,
  historyDays: 30,
  habits: 3,
  photoScansPerDay: 0,
  /** Enough to see what a deep dive actually is, twice over. */
  deepDivesLifetime: 3,
};

export const PLUS_TIER: TierLimits = {
  /**
   * Generous enough that a normal daily user never notices it (the median
   * engaged user sends 4–6 turns), low enough that the heavy-inference user is
   * the one being asked to pay for Pro rather than the one being subsidised.
   */
  coachMessagesPerDay: 25,
  /** A full year back — every trend, every seasonal comparison. */
  historyDays: 365,
  habits: null,
  /** Enough to log every meal of a day by camera, with room to redo one. */
  photoScansPerDay: 5,
  deepDivesLifetime: null,
};

export const PRO_TIER: TierLimits = {
  /**
   * A fair-use ceiling on "unlimited". Not there to save money at the median —
   * a normal heavy user sends maybe 15 turns a day — but so a scripted abuser
   * cannot run up unbounded Haiku spend on one subscription. Anyone who hits
   * this is not a real user.
   *
   * MUST be mirrored server-side (docs/monetization/setup.md Part 6). A client
   * ceiling is a courtesy; a modified client ignores it.
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
  plus: PLUS_TIER,
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
  | "photo-log"
  | "deep-dive"
  | "generic";

export const FEATURE_MIN_TIER: Record<FeatureId, Tier> = {
  /* ── Plus: your own app, fully unlocked. Cheap to serve, high felt value. ──*/
  "coach-limit": "plus", // the cap rises at Plus, effectively lifts at Pro
  sync: "plus",
  history: "plus", // 30d → a year at Plus, everything at Pro
  habits: "plus",
  "photo-log": "plus", // 5 scans/day at Plus, 30 at Pro
  "deep-dive": "plus", // 3 lifetime on free, then Plus opens it for good

  /* ── Pro: generated intelligence. Every use of these costs inference. ──────*/
  "ai-plans": "pro",
  insights: "pro",

  /** The unattributed ask. Offers the entry paid tier. */
  generic: "plus",
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
 * one place, so a gate can never accidentally apply a free limit to a Plus user.
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
 * linked habits would lock every free user out of the feature entirely.
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
