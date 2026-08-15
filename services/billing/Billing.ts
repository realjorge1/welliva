/**
 * BILLING — the RevenueCat seam.
 *
 * Everything that knows the SDK exists lives in this file. The rest of the app
 * sees normalized shapes (`ProPackage`, `PurchaseOutcome`) and never imports
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
import { isBillingConfigured, PRO_ENTITLEMENT, REVENUECAT_KEY } from "./config";
import { clearEntitlement, setEntitlement } from "./entitlement";
import { resetUsage } from "./usage";

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

export interface ProPackage {
  /** RevenueCat package identifier, e.g. `$rc_monthly`. */
  id: string;
  kind: "monthly" | "annual" | "other";
  /** Localized, store-formatted price — always display this, never format it yourself. */
  priceString: string;
  priceAmount: number;
  currency: string;
  title: string;
  /** Free-trial length in days, when the offer carries one. */
  trialDays: number | null;
  /** Opaque handle passed back to `purchasePro`. */
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
  await Promise.all([clearEntitlement(), resetUsage()]);
  if (!p || !configured) return;
  try {
    await p.logOut();
  } catch (e) {
    // logOut throws if already anonymous — harmless.
    if (__DEV__) console.info("[billing] logOut:", e);
  }
}

// ── Reading state ───────────────────────────────────────────────────────────

/** Translate a RevenueCat CustomerInfo into our entitlement snapshot. */
async function applyCustomerInfo(info: RCCustomerInfo): Promise<void> {
  const active = info.entitlements.active[PRO_ENTITLEMENT];
  await setEntitlement({
    isPro: Boolean(active?.isActive),
    expiresAt: active?.expirationDate ?? null,
  });
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

function kindOf(pkg: RCPackage): ProPackage["kind"] {
  const t = String(pkg.packageType).toUpperCase();
  if (t === "MONTHLY") return "monthly";
  if (t === "ANNUAL") return "annual";
  return "other";
}

/**
 * The packages to show on the paywall, annual first (the one we want chosen).
 * Returns [] when billing is unavailable or the offering is empty — the paywall
 * renders an explanatory state rather than an empty list.
 */
export async function getProPackages(): Promise<ProPackage[]> {
  const p = loadSdk();
  if (!p || !configured) return [];
  try {
    const offerings = await p.getOfferings();
    const offering = offerings.current ?? Object.values(offerings.all)[0] ?? null;
    if (!offering) return [];

    return offering.availablePackages
      .map<ProPackage>((pkg) => ({
        id: pkg.identifier,
        kind: kindOf(pkg),
        priceString: pkg.product.priceString,
        priceAmount: pkg.product.price,
        currency: pkg.product.currencyCode,
        title: pkg.product.title,
        trialDays: trialDaysOf(pkg.product),
        raw: pkg,
      }))
      .sort((a, b) => (a.kind === "annual" ? -1 : b.kind === "annual" ? 1 : 0));
  } catch (e) {
    console.warn("[billing] getOfferings failed:", e);
    return [];
  }
}

// ── Transactions ────────────────────────────────────────────────────────────

/**
 * Buy a package. A user cancelling is a NORMAL outcome, not an error — the
 * caller must not show an error toast for it, which is why it has its own
 * status rather than being folded into the failure case.
 */
export async function purchasePro(pkg: ProPackage): Promise<PurchaseOutcome> {
  const p = loadSdk();
  if (!p || !configured) return { status: "error", message: "Billing is unavailable." };
  try {
    const { customerInfo } = await p.purchasePackage(pkg.raw as RCPackage);
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
 * review will reject an app without one — this backs the paywall's "Restore"
 * link. Returns whether Pro is active afterwards, so the UI can say so.
 */
export async function restorePurchases(): Promise<{ ok: boolean; isPro: boolean; message?: string }> {
  const p = loadSdk();
  if (!p || !configured) return { ok: false, isPro: false, message: "Billing is unavailable." };
  try {
    const info = await p.restorePurchases();
    await applyCustomerInfo(info);
    return { ok: true, isPro: Boolean(info.entitlements.active[PRO_ENTITLEMENT]?.isActive) };
  } catch (e) {
    const err = e as { message?: string };
    console.warn("[billing] restore failed:", e);
    return { ok: false, isPro: false, message: err?.message ?? "Could not restore purchases." };
  }
}
