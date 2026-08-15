/**
 * TIERS — what Free gets and what Pro unlocks. The single source of truth.
 *
 * Every gate in the app reads a constant from here instead of hardcoding a
 * number at the call site. The tier boundary is a pricing decision, not an
 * implementation detail: it will be tuned against conversion data after launch,
 * and when it moves it has to move in ONE place. The paywall copy, the catalog
 * filter and the enforcement check must never disagree about what "3 messages"
 * means — a user who is told 3 and cut off at 2 files a bug, and rightly.
 *
 * THE PRINCIPLE BEHIND THE LIST
 *
 * Free is a genuinely useful app, not a demo. Three things are deliberately
 * never gated:
 *
 *  • DATA ENTRY — food, water, weight, workouts. Paywalling logging kills the
 *    habit that makes the app worth paying for, and the accumulated log is the
 *    retention moat. Gate the depth of the analysis, never the input.
 *  • STREAKS, ACHIEVEMENTS, CELEBRATIONS and basic reminders. These drive the
 *    daily return that eventually converts; charging for them is self-defeating.
 *  • EXPORT and ACCOUNT DELETION. Legally required (see docs/legal), and gating
 *    them reads as hostile.
 *
 * What Pro sells is (a) things that cost real money per use — Haiku inference,
 * cloud storage — and (b) depth over data the user already owns.
 */

/* ─────────────────────────── The diet catalog lock ───────────────────────────
 * The most defensible lock in the app. Free gets the six mainstream diets that
 * every competitor also has — nobody pays for "keto". Pro gets the 22
 * condition-specific protocols (PCOS, renal, thyroid, diabetic, ulcer/GERD,
 * iron-deficiency, postpartum, liver, geriatric…), which is what someone
 * managing an actual condition will pay for and cannot get from a free tracker.
 *
 * Ids must match `DIET_DATABASE` in constants/DietDatabase.ts. A typo here
 * silently locks a diet we meant to give away, so `assertFreeDietIdsExist()`
 * below is called from the diet tests.
 */
export const FREE_DIET_IDS: readonly string[] = [
  "mediterranean",
  "low-carb",
  "high-protein",
  "vegetarian",
  "calorie-counting",
  "intermittent-fasting",
];

/* ────────────────────────────── Free-tier limits ────────────────────────────*/
export const FREE_TIER = {
  /**
   * AI coach turns per day. Only turns that actually reach the backend count —
   * the deterministic on-device coach is always free (see `services/gozlin`).
   * Three is enough to feel what Gozlin is; the fourth is where the value has
   * landed and the ask makes sense.
   */
  coachMessagesPerDay: 3,
  /**
   * How far back charts, reports and body-log trends read. The data is still
   * theirs and is never deleted — this bounds the QUERY, not the storage, and
   * it gets more compelling the longer they stay.
   */
  historyDays: 30,
  /**
   * MANUAL habit slots. HabitKit's exact model, and it converts.
   *
   * Manual only, and that is not a detail: every user is seeded with three
   * auto-tracked habits (water / meals / workout — see `seedDefaultHabits`)
   * that complete themselves from logged data. Counting those against the cap
   * would leave a brand-new free user with zero slots and no way to create a
   * single habit, and it would be gating logging feedback through the back
   * door. Linked habits are always free and always uncapped.
   */
  habits: 3,
  /** Photo meal scans per day. 0 = Pro-only (the headline paid feature). */
  photoScansPerDay: 0,
} as const;

/* ────────────────────────────── Pro-tier limits ─────────────────────────────*/
export const PRO_TIER = {
  /**
   * A fair-use ceiling on "unlimited". Not there to save money at the median —
   * a normal heavy user sends maybe 15 turns a day — but so a scripted abuser
   * cannot run up unbounded Haiku spend on a $12.99 subscription. At 100 turns
   * the worst case is roughly $21/mo of inference, which is still inside the
   * margin. Anyone who hits this is not a real user.
   *
   * MUST be mirrored server-side (docs/monetization/setup.md Part 6). A client
   * ceiling is a courtesy; a modified client ignores it.
   */
  coachMessagesPerDay: 100,
  /** Unbounded history. `null` means "no cutoff". */
  historyDays: null,
  /** Unlimited habits. */
  habits: null,
  photoScansPerDay: 30,
} as const;

/* ──────────────────────────────── Accessors ─────────────────────────────────
 * Prefer these over reading the constants directly: the isPro branch lives in
 * one place, so a gate can never accidentally apply a free limit to a Pro user.
 */

/** Coach turns allowed today. */
export function coachDailyLimit(isPro: boolean): number {
  return isPro ? PRO_TIER.coachMessagesPerDay : FREE_TIER.coachMessagesPerDay;
}

/** Photo meal scans allowed today. */
export function photoScanDailyLimit(isPro: boolean): number {
  return isPro ? PRO_TIER.photoScansPerDay : FREE_TIER.photoScansPerDay;
}

/** Manual habit slots, or `null` for unlimited. */
export function habitLimit(isPro: boolean): number | null {
  return isPro ? PRO_TIER.habits : FREE_TIER.habits;
}

/**
 * May another manual habit be created?
 *
 * `manualCount` must exclude auto-tracked (linked) habits — see the note on
 * `FREE_TIER.habits`. Callers get this right by filtering on
 * `habit.source === "manual"`; passing a total that includes the three seeded
 * linked habits would lock every free user out of the feature entirely.
 */
export function canCreateHabit(manualCount: number, isPro: boolean): boolean {
  const limit = habitLimit(isPro);
  return limit === null || manualCount < limit;
}

/** How many days back history may be read, or `null` for everything. */
export function historyWindowDays(isPro: boolean): number | null {
  return isPro ? PRO_TIER.historyDays : FREE_TIER.historyDays;
}

/**
 * Is this diet available on the free tier?
 *
 * Fails OPEN for an unknown id: a diet added to the database without being
 * classified here should be visible to everyone rather than silently vanishing
 * behind a paywall nobody wrote copy for. Locking is an explicit act.
 */
export function isDietFree(dietId: string, allClinicalIds?: readonly string[]): boolean {
  if (FREE_DIET_IDS.includes(dietId)) return true;
  if (allClinicalIds && !allClinicalIds.includes(dietId)) return true;
  return false;
}

/** Whether a diet requires Pro for this user. */
export function isDietLocked(dietId: string, isPro: boolean): boolean {
  return !isPro && !FREE_DIET_IDS.includes(dietId);
}

/**
 * Is a chart range wider than this tier's history window?
 *
 * Used to mark {@link TrendSeries.locked} tabs. The companion rule, which lives
 * at the call sites because only they know their own ranges: A CHART'S SHORTEST
 * RANGE IS ALWAYS FREE, even when it already exceeds the window. The training
 * chart's narrowest view is 8 weeks, so applying the cutoff blindly would lock
 * the whole card — and a card with every tab locked reads as broken, not as an
 * upsell. Free keeps a working chart; Pro sells seeing further back.
 */
export function isHistoryRangeLocked(rangeDays: number, isPro: boolean): boolean {
  const max = historyWindowDays(isPro);
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
export function clampHistoryDays(requested: number, isPro: boolean): number {
  const max = historyWindowDays(isPro);
  return max === null ? requested : Math.min(requested, max);
}

/**
 * The earliest date a free user's history may reach, as `YYYY-MM-DD`, or `null`
 * when unbounded. Callers pass their own "today" so this stays pure and testable
 * and agrees with AppContext's clock rather than the wall clock.
 */
export function historyCutoffDate(isPro: boolean, today: Date = new Date()): string | null {
  const days = historyWindowDays(isPro);
  if (days === null) return null;
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Guard for the test suite: every id in {@link FREE_DIET_IDS} must exist in the
 * diet database. Returns the ids that don't. Kept here (rather than in the test)
 * so the invariant sits next to the data it constrains.
 */
export function missingFreeDietIds(knownIds: readonly string[]): string[] {
  return FREE_DIET_IDS.filter((id) => !knownIds.includes(id));
}
