/**
 * GATING — the one question feature code asks: "may this proceed?"
 *
 * Composes the three things that decide it — is billing even configured in this
 * build, which tier is this user on, and have they spent today's allowance — so
 * no call site has to remember the interaction between them. Getting that wrong
 * in one place is how you end up locking out developers or giving away the
 * product.
 *
 * THE FAIL-OPEN RULE, AND WHY IT'S NOT A LOOPHOLE
 *
 * When no RevenueCat key is present, gating is OFF and everything is unlocked.
 * That covers Expo Go, web, and any build made before the store accounts existed
 * — environments where a purchase is impossible, so locking features would only
 * break development to protect revenue that cannot be collected there anyway.
 *
 * It is not a loophole because the key is what makes a *store* build a store
 * build: a shipped app has the key, and the paths that actually cost money are
 * additionally enforced server-side against the Supabase JWT
 * (docs/monetization/setup.md Part 6). Client gating shapes the experience;
 * the server protects the spend.
 *
 * THE ONE RULE FOR CALLERS
 *
 * THE INSIGHT TRIAL RIDES THE SAME PATH
 *
 * A live 48-hour trial (services/billing/trial.ts) raises `effectiveTier()` and
 * nothing else. Because every lock and every limit already reads that one
 * function, the trial needed no call-site changes at all — which is the whole
 * reason the fail-open rule was expressed as a value in the first place.
 *
 * Ask `allows(feature)` for a binary lock and `effectiveTier()` for a graded
 * limit. Never branch a lock on `isPro()` / `isSubscriber()` from entitlement.ts
 * — those report what someone PAID, which is the right answer for the upgrade
 * screen and the wrong answer for a lock in a build that cannot sell anything.
 */
import { isBillingConfigured } from "./config";
import { currentTier, getDevTierOverride } from "./entitlement";
import {
  coachDailyLimit,
  deepDiveLifetimeLimit,
  higherTier,
  photoScanDailyLimit,
  tierAllowsFeature,
  type FeatureId,
  type Tier,
} from "./tiers";
import { trialTier } from "./trial";
import { checkQuota, recordUsage, type QuotaState } from "./usage";
import { checkAllowance, spendAllowance } from "./allowance";

/**
 * Whether the paid tiers are enforced at all in this session.
 *
 * The dev-override branch is what makes the locks testable before RevenueCat
 * exists: flipping the developer switch to "Free" turns gating on even with no
 * key, so a developer can walk the real free-tier experience.
 */
export function isGatingActive(): boolean {
  if (__DEV__ && getDevTierOverride() !== null) return true;
  return isBillingConfigured;
}

/**
 * THE tier feature code should gate on: the user's real tier, or `pro` in a
 * build where gating is off. This is the fail-open rule expressed once, as a
 * value — every lock and every limit reads it instead of re-deriving it.
 */
export function effectiveTier(): Tier {
  if (!isGatingActive()) return "pro";

  const real = currentTier();

  // A dev override means someone is deliberately walking a tier's experience.
  // An insight trial silently lifting them to Pro would make the free tier
  // untestable for two days — precisely when the locks get written.
  if (__DEV__ && getDevTierOverride() !== null) return real;

  // The HIGHER of the two, never a replacement: a trial can lift a free user to
  // Pro, but must never demote a paying one, and a Plus subscriber who trials
  // Pro drops back to Plus — not to free — when the window closes.
  const trial = trialTier();
  return trial ? higherTier(real, trial) : real;
}

/** May this user use `feature` right now? The single check for binary locks. */
export function allows(feature: FeatureId): boolean {
  return tierAllowsFeature(effectiveTier(), feature);
}

/** True when `feature` must be withheld — the readable inverse of `allows`. */
export function needsUpgrade(feature: FeatureId = "generic"): boolean {
  return !allows(feature);
}

/**
 * True when the user is on any paid tier (or gating is off).
 *
 * For UI that is about the SUBSCRIPTION rather than a feature — "you're on a
 * plan", hiding an upsell banner. A feature lock wants `allows()`, which knows
 * which tier that particular feature actually needs.
 */
export function hasPaidAccess(): boolean {
  return effectiveTier() !== "free";
}

/**
 * The state of a metered allowance.
 *
 * `metered: false` means no cap applies at all (billing off in this build) — the
 * caller should skip every limit affordance rather than render "unlimited", which
 * would be a promise we haven't sold them.
 */
export interface MeteredState extends QuotaState {
  metered: boolean;
  /** The tier the limit was computed for — what the upgrade prompt should offer past. */
  tier: Tier;
}

const UNMETERED: Omit<MeteredState, "tier"> = {
  metered: false,
  allowed: true,
  used: 0,
  remaining: Number.POSITIVE_INFINITY,
  limit: Number.POSITIVE_INFINITY,
};

/**
 * May the user send another AI coach turn today?
 *
 * Call BEFORE the turn. The free cap is what creates the upgrade moment; the
 * Plus cap is a generous daily allowance and the Pro cap is a fair-use ceiling a
 * normal user will never reach (see tiers.ts).
 */
export async function checkCoachQuota(): Promise<MeteredState> {
  const tier = effectiveTier();
  if (!isGatingActive()) return { ...UNMETERED, tier };
  const state = await checkQuota("coach", coachDailyLimit(tier));
  return { ...state, metered: true, tier };
}

/**
 * Spend one coach turn. Call only AFTER the turn actually reached the backend —
 * a turn that failed on a dead network must not cost one of three.
 */
export async function spendCoachTurn(): Promise<MeteredState> {
  const tier = effectiveTier();
  if (!isGatingActive()) return { ...UNMETERED, tier };
  const state = await recordUsage("coach", coachDailyLimit(tier));
  return { ...state, metered: true, tier };
}

/** May the user scan another meal photo today? */
export async function checkPhotoScanQuota(): Promise<MeteredState> {
  const tier = effectiveTier();
  if (!isGatingActive()) return { ...UNMETERED, tier };
  const state = await checkQuota("photoScan", photoScanDailyLimit(tier));
  return { ...state, metered: true, tier };
}

/** Spend one photo scan, after a successful analysis. */
export async function spendPhotoScan(): Promise<MeteredState> {
  const tier = effectiveTier();
  if (!isGatingActive()) return { ...UNMETERED, tier };
  const state = await recordUsage("photoScan", photoScanDailyLimit(tier));
  return { ...state, metered: true, tier };
}

/**
 * May the user open another DEEP DIVE — the research expansion behind a coach
 * reply (components/gozlin/DeepDiveReader)?
 *
 * Two things make this gate different from the ones above, and both are
 * deliberate:
 *
 *  · IT IS A LIFETIME ALLOWANCE, not a daily one. Nothing resets at midnight.
 *  · IT IS SILENT. Nothing anywhere renders `remaining`. A free user opens deep
 *    dives until the day one asks them to upgrade — no counter, no warning at
 *    the second, no badge counting down. The taste is the pitch; a countdown
 *    would turn it into a chore and spend the surprise before the value lands.
 *
 * Re-opening a deep dive that has already been written costs nothing at all —
 * the text is cached on the message, and useGozlin never reaches this check for
 * one it already has.
 */
export async function checkDeepDive(): Promise<MeteredState> {
  const tier = effectiveTier();
  if (!isGatingActive()) return { ...UNMETERED, tier };
  const limit = deepDiveLifetimeLimit(tier);
  if (limit === null) return { ...UNMETERED, tier };
  const state = await checkAllowance("deepDive", limit);
  return { ...state, metered: true, tier };
}

/**
 * Spend one deep dive. Call only after the expansion actually arrived — a dive
 * that failed on a dead network must not cost one of a lifetime's three.
 */
export async function spendDeepDive(): Promise<MeteredState> {
  const tier = effectiveTier();
  if (!isGatingActive()) return { ...UNMETERED, tier };
  const limit = deepDiveLifetimeLimit(tier);
  if (limit === null) return { ...UNMETERED, tier };
  const state = await spendAllowance("deepDive", limit);
  return { ...state, metered: true, tier };
}
