/**
 * GATING — the one question feature code asks: "may this proceed?"
 *
 * Composes the three things that decide it — is billing even configured in this
 * build, is this user Pro, and have they spent today's allowance — so no call
 * site has to remember the interaction between them. Getting that wrong in one
 * place is how you end up locking out developers or giving away the product.
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
 */
import { isBillingConfigured } from "./config";
import { getDevProOverride, isPro } from "./entitlement";
import { coachDailyLimit, photoScanDailyLimit } from "./tiers";
import { checkQuota, recordUsage, type QuotaState } from "./usage";

/**
 * Whether the paid tier is enforced at all in this session.
 *
 * The dev-override branch is what makes the locks testable before RevenueCat
 * exists: flipping the Settings switch to "Free" turns gating on even with no
 * key, so a developer can walk the real free-tier experience.
 */
export function isGatingActive(): boolean {
  if (__DEV__ && getDevProOverride() !== null) return true;
  return isBillingConfigured;
}

/**
 * True when a Pro-only capability must be withheld right now. The single check
 * for binary locks (a clinical diet, cloud sync, the insights panel).
 */
export function needsUpgrade(): boolean {
  return isGatingActive() && !isPro();
}

/** True when a Pro-only capability may run. The readable inverse. */
export function allowPro(): boolean {
  return !needsUpgrade();
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
  isPro: boolean;
}

const UNMETERED: Omit<MeteredState, "isPro"> = {
  metered: false,
  allowed: true,
  used: 0,
  remaining: Number.POSITIVE_INFINITY,
  limit: Number.POSITIVE_INFINITY,
};

/**
 * May the user send another AI coach turn today?
 *
 * Call BEFORE the turn. The free cap is what creates the upgrade moment; the Pro
 * cap is a fair-use ceiling that a normal user will never reach (see PRO_TIER).
 */
export async function checkCoachQuota(): Promise<MeteredState> {
  const pro = isPro();
  if (!isGatingActive()) return { ...UNMETERED, isPro: pro };
  const state = await checkQuota("coach", coachDailyLimit(pro));
  return { ...state, metered: true, isPro: pro };
}

/**
 * Spend one coach turn. Call only AFTER the turn actually reached the backend —
 * a turn that failed on a dead network must not cost one of three.
 */
export async function spendCoachTurn(): Promise<MeteredState> {
  const pro = isPro();
  if (!isGatingActive()) return { ...UNMETERED, isPro: pro };
  const state = await recordUsage("coach", coachDailyLimit(pro));
  return { ...state, metered: true, isPro: pro };
}

/** May the user scan another meal photo today? */
export async function checkPhotoScanQuota(): Promise<MeteredState> {
  const pro = isPro();
  if (!isGatingActive()) return { ...UNMETERED, isPro: pro };
  const state = await checkQuota("photoScan", photoScanDailyLimit(pro));
  return { ...state, metered: true, isPro: pro };
}

/** Spend one photo scan, after a successful analysis. */
export async function spendPhotoScan(): Promise<MeteredState> {
  const pro = isPro();
  if (!isGatingActive()) return { ...UNMETERED, isPro: pro };
  const state = await recordUsage("photoScan", photoScanDailyLimit(pro));
  return { ...state, metered: true, isPro: pro };
}
