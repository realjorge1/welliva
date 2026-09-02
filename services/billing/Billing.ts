/**
 * BILLING — the RevenueCat seam.
 *
 * Everything that knows the SDK exists lives in this file. The rest of the app
 * sees normalized shapes (`PlanOption`, `PurchaseOutcome`) and never imports
 * `react-native-purchases` directly, so swapping providers — or running with no
 * provider at all — touches one module.
 *
 * THE SDK IS LOADED LAZILY, ON PURPOSE.
 *
 * `react-native-purchases` is a native module: absent in Expo Go, absent on
 * web, and absent from any build made before `npx expo install` was run. A
 * top-level import would take the bundle down in all three. So it is `require`d
 * inside a try/catch on first use, exactly like the null-provider seams in
 * health-os/multimodal/MealPhotoSource.ts. When it isn't there, every function
 * here degrades to a no-op and the app runs as pure free tier.
 *
 * A consequence worth knowing: `isBillingAvailable()` can be false even with a
 * valid key, when the native module is missing. Always branch on it rather than
 * on `isBillingConfigured` alone.
 *
 * SETUP: see docs/monetization/setup.md
 */
import {
  isBillingConfigured,
  LEGACY_PLUS_ENTITLEMENT,
  PRO_ENTITLEMENT,
  REVENUECAT_KEY,
  TIER_OFFERINGS,
} from "./config";
import { clearEntitlement, setEntitlement } from "./entitlement";
import { type Tier } from "./tiers";
import { clearTrial } from "./trial";
import { resetUsage } from "./usage";
import { resetAllowances } from "./allowance";

// ── Minimal structural types ────────────────────────────────────────────────
// Deliberately local rather than imported from `react-native-purchases`, so the
// rest of the app never speaks the vendor's types and swapping providers touches
// only this file. (Originally this also let the module typecheck before the
// package existed; it has been a real dependency since v10.7.1.)
//
// They are a strict SUBSET of the real types, and `assertSdkShape` at the bottom
// of this section makes the compiler prove it rather than leaving it to a
// comment — an SDK upgrade that changes any shape we read now fails typecheck
// instead of failing a purchase in production.

interface RCEntitlementInfo {
  identifier: string;
  isActive: boolean;
  expirationDate: string | null;
  willRenew: boolean;
  productIdentifier: string;
}
interface RCCustomerInfo {
  entitlements: { active: Record<string, RCEntitlementInfo> };
  originalAppUserId: string;
  managementURL: string | null;
}
interface RCProduct {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  price: number;
  currencyCode: string;
  /**
   * The store's own "per month" rendering of a longer plan (annual → ~$1.92).
   * Optional because it is absent on monthly products and on older SDKs; the
   * upgrade screen computes the same figure itself when it isn't there.
   */
  pricePerMonthString?: string | null;
  introPrice?: { periodNumberOfUnits: number; periodUnit: string; price: number } | null;
  defaultOption?: { freePhase?: { billingPeriod?: { unit?: string; value?: number } } | null } | null;
}
interface RCPackage {
  identifier: string;
  packageType: string;
  product: RCProduct;
}
interface RCOffering {
  identifier: string;
  availablePackages: RCPackage[];
}
interface RCPurchases {
  configure(opts: { apiKey: string; appUserID?: string | null }): void;
  setLogLevel(level: unknown): void;
  getCustomerInfo(): Promise<RCCustomerInfo>;
  getOfferings(): Promise<{ current: RCOffering | null; all: Record<string, RCOffering> }>;
  purchasePackage(pkg: RCPackage): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<RCCustomerInfo>;
  logIn(appUserID: string): Promise<{ customerInfo: RCCustomerInfo; created: boolean }>;
  logOut(): Promise<RCCustomerInfo>;
  addCustomerInfoUpdateListener(fn: (info: RCCustomerInfo) => void): void;
  removeCustomerInfoUpdateListener(fn: (info: RCCustomerInfo) => void): void;
  LOG_LEVEL?: Record<string, unknown>;
}

/**
 * Compile-time only: proves each local type above is satisfied by the real SDK.
 *
 * `import type` is fully erased, so this adds NOTHING to the bundle and does not
 * load the native module — the lazy `require` below remains the only runtime
 * reference, and Expo Go / web still degrade to free tier exactly as before.
 * The function is never called; declaring it is what runs the check.
 */
function assertSdkShape(
  info: import("react-native-purchases").CustomerInfo,
  pkg: import("react-native-purchases").PurchasesPackage,
  offering: import("react-native-purchases").PurchasesOffering,
): [RCCustomerInfo, RCPackage, RCOffering] {
  return [info, pkg, offering];
}
void assertSdkShape;

// ── Lazy module resolution ──────────────────────────────────────────────────

let sdk: RCPurchases | null | undefined; // undefined = not tried yet, null = absent

function loadSdk(): RCPurchases | null {
  if (sdk !== undefined) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-purchases");
    sdk = (mod.default ?? mod) as RCPurchases;
  } catch {
    if (__DEV__) {
      console.info(
        "[billing] react-native-purchases not available (Expo Go / web / not installed) — running free tier.",
      );
    }
    sdk = null;
  }
  return sdk;
}

let configured = false;

/** True when billing can actually run: key present AND native module present. */
export function isBillingAvailable(): boolean {
  return isBillingConfigured && loadSdk() !== null;
}

// ── Normalized shapes the UI consumes ───────────────────────────────────────

/** How often a plan bills. `other` covers weekly/lifetime/custom packages. */
export type BillingPeriod = "monthly" | "annual" | "other";

/**
 * One buyable plan: a tier at a billing period. Two of these make up the
 * storefront — Pro monthly and Pro annual.
 */
export interface PlanOption {
  /** Unique within the storefront: tier + package identifier. */
  id: string;
  /** Which tier buying this grants. */
  tier: Exclude<Tier, "free">;
  period: BillingPeriod;
  /** Localized, store-formatted price — always display this, never format it yourself. */
  priceString: string;
  priceAmount: number;
  currency: string;
  title: string;
  /**
   * Store-formatted per-month equivalent of an annual plan, when the SDK gives
   * one. `null` on monthly plans and on stores that don't report it — the
   * storefront falls back to dividing `priceAmount` itself.
   */
  pricePerMonthString: string | null;
  /** Free-trial length in days, when the offer carries one. */
  trialDays: number | null;
  /** Opaque handle passed back to `purchasePlan`. */
  raw: unknown;
}

export type PurchaseOutcome =
  | { status: "purchased" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Configure the SDK once per app launch.
 *
 * `appUserId` MUST be the Supabase user id. That identity match is what lets
 * the backend answer "is this JWT's owner paid?" without a second mapping
 * table, and it is what makes a subscription follow the account across devices
 * instead of being stranded on the phone that bought it.
 *
 * Passing `null` (signed out) leaves RevenueCat on an anonymous id; the later
 * `identifyUser` call on sign-in transfers that purchase onto the account.
 */
export async function configureBilling(appUserId: string | null): Promise<void> {
  const p = loadSdk();
  if (!p || !REVENUECAT_KEY || configured) return;

  try {
    if (__DEV__ && p.LOG_LEVEL) p.setLogLevel(p.LOG_LEVEL.DEBUG);
    p.configure({ apiKey: REVENUECAT_KEY, appUserID: appUserId });
    configured = true;
    await refreshEntitlement();
  } catch (e) {
    console.warn("[billing] configure failed:", e);
  }
}

/** Attach purchases to a Supabase account on sign-in. */
export async function identifyUser(userId: string): Promise<void> {
  const p = loadSdk();
  if (!p || !configured) return;
  try {
    const { customerInfo } = await p.logIn(userId);
    await applyCustomerInfo(customerInfo);
  } catch (e) {
    console.warn("[billing] logIn failed:", e);
  }
}

/** Detach on sign-out and drop the cached entitlement. */
export async function signOutBilling(): Promise<void> {
  const p = loadSdk();
  // Drop the entitlement AND the day's spent allowance together: the next
  // account to sign in on this device must start with its own three turns, not
  // inherit whatever the previous user had left.
  await Promise.all([clearEntitlement(), resetUsage(), resetAllowances(), clearTrial()]);
  if (!p || !configured) return;
  try {
    await p.logOut();
  } catch (e) {
    // logOut throws if already anonymous — harmless.
    if (__DEV__) console.info("[billing] logOut:", e);
  }
}

// ── Reading state ───────────────────────────────────────────────────────────

/**
 * Translate a RevenueCat CustomerInfo into our entitlement snapshot.
 *
 * BOTH entitlements are read and both grant Pro. Plus was merged into Pro, but
 * a subscription bought under the old identifier keeps reporting it until its
 * period ends — checking only `pro` would downgrade those customers to free on
 * their next launch. See LEGACY_PLUS_ENTITLEMENT in config.ts.
 *
 * When both are somehow active (someone who bought Pro mid-Plus-period), the
 * one that runs LONGER wins the expiry: it is the date access actually ends,
 * and quoting the earlier one would tell a paying user their plan lapses on a
 * day it doesn't.
 */
function tierOf(info: RCCustomerInfo): {
  tier: Tier;
  expiresAt: string | null;
  willRenew: boolean;
} {
  const active = info.entitlements.active;
  const granting = [active[PRO_ENTITLEMENT], active[LEGACY_PLUS_ENTITLEMENT]].filter(
    (e): e is RCEntitlementInfo => e?.isActive === true,
  );

  if (granting.length === 0) return { tier: "free", expiresAt: null, willRenew: false };

  // A null expiry is a lifetime grant — it outranks every date.
  const winner = granting.reduce((best, e) => {
    if (best.expirationDate === null) return best;
    if (e.expirationDate === null) return e;
    return new Date(e.expirationDate) > new Date(best.expirationDate) ? e : best;
  });

  return {
    tier: "pro",
    expiresAt: winner.expirationDate ?? null,
    // Absent on a lifetime grant; "will renew" is the honest default for an
    // active entitlement the store didn't flag as cancelled.
    willRenew: winner.willRenew !== false,
  };
}

async function applyCustomerInfo(info: RCCustomerInfo): Promise<void> {
  await setEntitlement(tierOf(info));
}

/**
 * Re-read entitlement from RevenueCat. Safe to call often — the SDK caches and
 * this is how the app recovers after a webhook-driven change (e.g. a refund).
 *
 * A network failure is deliberately swallowed: the persisted entitlement stays
 * authoritative, which is what keeps a paying user Pro while offline.
 */
export async function refreshEntitlement(): Promise<void> {
  const p = loadSdk();
  if (!p || !configured) return;
  try {
    await applyCustomerInfo(await p.getCustomerInfo());
  } catch (e) {
    if (__DEV__) console.info("[billing] refresh failed, keeping cache:", e);
  }
}

/**
 * Push updates from the store (renewals, cancellations, Play-side changes)
 * straight into the entitlement store. Returns an unsubscribe fn.
 */
export function installEntitlementListener(): () => void {
  const p = loadSdk();
  if (!p || !configured) return () => {};
  const handler = (info: RCCustomerInfo) => void applyCustomerInfo(info);
  p.addCustomerInfoUpdateListener(handler);
  return () => p.removeCustomerInfoUpdateListener(handler);
}

// ── Offerings ───────────────────────────────────────────────────────────────

function trialDaysOf(product: RCProduct): number | null {
  // iOS reports a free trial as introPrice with price 0.
  if (product.introPrice && product.introPrice.price === 0) {
    const { periodNumberOfUnits: n, periodUnit } = product.introPrice;
    const unit = String(periodUnit).toUpperCase();
    if (unit.startsWith("DAY")) return n;
    if (unit.startsWith("WEEK")) return n * 7;
    if (unit.startsWith("MONTH")) return n * 30;
    if (unit.startsWith("YEAR")) return n * 365;
  }
  // Android reports it as a free phase on the base plan's default offer.
  const free = product.defaultOption?.freePhase?.billingPeriod;
  if (free?.value) {
    const unit = String(free.unit ?? "").toUpperCase();
    if (unit.startsWith("DAY")) return free.value;
    if (unit.startsWith("WEEK")) return free.value * 7;
    if (unit.startsWith("MONTH")) return free.value * 30;
  }
  return null;
}

function periodOf(pkg: RCPackage): BillingPeriod {
  const t = String(pkg.packageType).toUpperCase();
  if (t === "MONTHLY") return "monthly";
  if (t === "ANNUAL") return "annual";
  return "other";
}

function toPlan(pkg: RCPackage): PlanOption {
  return {
    id: `pro:${pkg.identifier}`,
    tier: "pro",
    period: periodOf(pkg),
    priceString: pkg.product.priceString,
    priceAmount: pkg.product.price,
    currency: pkg.product.currencyCode,
    title: pkg.product.title,
    pricePerMonthString: pkg.product.pricePerMonthString ?? null,
    trialDays: trialDaysOf(pkg.product),
    raw: pkg,
  };
}

/** Annual before monthly — reading order on the storefront. */
const PERIOD_ORDER: Record<BillingPeriod, number> = { annual: 0, monthly: 1, other: 2 };

/**
 * Every plan the storefront can sell, in display order.
 *
 * Supports both console layouts (see `TIER_OFFERINGS` in config.ts): a named
 * `pro` offering if one exists, otherwise the current offering. Every package
 * either layout yields sells Pro. Returns [] when billing is unavailable or the
 * offering is empty — the upgrade screen renders an explanatory state rather
 * than an empty list.
 */
export async function getPlanOptions(): Promise<PlanOption[]> {
  const p = loadSdk();
  if (!p || !configured) return [];
  try {
    const offerings = await p.getOfferings();

    const offering =
      offerings.all[TIER_OFFERINGS.pro] ??
      offerings.current ??
      Object.values(offerings.all)[0] ??
      null;
    if (!offering) return [];

    return offering.availablePackages
      .map(toPlan)
      .sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]);
  } catch (e) {
    console.warn("[billing] getOfferings failed:", e);
    return [];
  }
}

// ── Transactions ────────────────────────────────────────────────────────────

/**
 * Buy a plan. A user cancelling is a NORMAL outcome, not an error — the caller
 * must not show an error toast for it, which is why it has its own status
 * rather than being folded into the failure case.
 *
 * Switching plans (monthly → annual, or off a legacy Plus subscription) is the
 * same call: both stores handle the proration and the old subscription
 * themselves, and RevenueCat reports the result through the entitlements we
 * re-read here.
 */
export async function purchasePlan(plan: PlanOption): Promise<PurchaseOutcome> {
  const p = loadSdk();
  if (!p || !configured) return { status: "error", message: "Billing is unavailable." };
  try {
    const { customerInfo } = await p.purchasePackage(plan.raw as RCPackage);
    await applyCustomerInfo(customerInfo);
    return { status: "purchased" };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { status: "cancelled" };
    console.warn("[billing] purchase failed:", e);
    return { status: "error", message: err?.message ?? "Purchase could not be completed." };
  }
}

/**
 * Restore purchases. Both stores REQUIRE a user-accessible restore path, and
 * review will reject an app without one — this backs the upgrade screen's
 * "Restore" link. Returns the tier that is active afterwards, so the UI can name
 * what it found instead of a bare "restored".
 */
export async function restorePurchases(): Promise<{
  ok: boolean;
  tier: Tier;
  message?: string;
}> {
  const p = loadSdk();
  if (!p || !configured) return { ok: false, tier: "free", message: "Billing is unavailable." };
  try {
    const info = await p.restorePurchases();
    await applyCustomerInfo(info);
    return { ok: true, tier: tierOf(info).tier };
  } catch (e) {
    const err = e as { message?: string };
    console.warn("[billing] restore failed:", e);
    return { ok: false, tier: "free", message: err?.message ?? "Could not restore purchases." };
  }
}
