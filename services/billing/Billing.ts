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
import { Linking, Platform } from "react-native";
import {
  isBillingConfigured,
  LEGACY_PLUS_ENTITLEMENT,
  MANAGE_SUBSCRIPTION_URL,
  PLAY_SUBSCRIPTION_IDS,
  PRO_ENTITLEMENT,
  REVENUECAT_KEY,
  TIER_OFFERINGS,
} from "./config";
import { clearEntitlement, setEntitlement } from "./entitlement";
import {
  describeStoreError,
  emptyOfferingProblem,
  type StoreProblem,
  type StoreProblemKind,
} from "./storeErrors";
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
  /** ISO 8601 billing period — "P1M", "P1Y". Null on one-off products. */
  subscriptionPeriod?: string | null;
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
  setLogHandler?(handler: (level: string, message: string) => void): void;
  getCustomerInfo(): Promise<RCCustomerInfo>;
  getOfferings(): Promise<{ current: RCOffering | null; all: Record<string, RCOffering> }>;
  purchasePackage(pkg: RCPackage): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<RCCustomerInfo>;
  logIn(appUserID: string): Promise<{ customerInfo: RCCustomerInfo; created: boolean }>;
  logOut(): Promise<RCCustomerInfo>;
  /** Straight from Google Play — no RevenueCat server involved. */
  getProducts(productIdentifiers: string[]): Promise<RCProduct[]>;
  addCustomerInfoUpdateListener(fn: (info: RCCustomerInfo) => void): void;
  removeCustomerInfoUpdateListener(fn: (info: RCCustomerInfo) => void): void;
  /** Drop the SDK's cached CustomerInfo so the next read goes to RevenueCat. */
  invalidateCustomerInfoCache(): Promise<void>;
  /** iOS only: Apple's own manage-subscriptions sheet, inside the app. */
  showManageSubscriptions?(): Promise<void>;
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

/**
 * RevenueCat's hosted-paywall config: `ui_config` blobs the SDK prefetches from
 * config.revenuecat-static.com for its own paywall templates.
 *
 * This app never renders one — `/upgrade` is its own screen and
 * `react-native-purchases-ui` is not installed — and the SDK treats the data as
 * optional (`OfferingParser` passes a null UiConfig through and prices still
 * load from api.revenuecat.com + Play). So a failed download here costs
 * nothing, yet the default handler reports it through `console.error`, which
 * paints a red error over a working storefront. First seen 2026-09-26 as
 * `SSLHandshakeException` against that CDN on one phone's network.
 */
const PAYWALL_TEMPLATE_CONFIG = /remote config blob/i;

/**
 * The SDK's own log lines, routed to the console exactly as its default handler
 * does, except the hosted-paywall config above, which drops to `info` in dev
 * and is silent in release. Everything else keeps its level — a real store
 * error must stay loud.
 */
function routeSdkLog(level: string, message: string): void {
  const line = `[RevenueCat] ${message}`;
  if (PAYWALL_TEMPLATE_CONFIG.test(message)) {
    if (__DEV__) console.info(line);
    return;
  }
  switch (level) {
    case "ERROR":
      console.error(line);
      break;
    case "WARN":
      console.warn(line);
      break;
    case "INFO":
      console.info(line);
      break;
    default:
      console.debug(line);
  }
}

/** True when billing can actually run: key present AND native module present. */
export function isBillingAvailable(): boolean {
  return isBillingConfigured && loadSdk() !== null;
}

/**
 * True once `configureBilling` has actually configured the SDK.
 *
 * DELIBERATELY SEPARATE FROM `isBillingAvailable()`, which only reports that a
 * key and a native module exist. Everything below — `getPlanOptions`,
 * `purchasePlan`, `restorePurchases` — returns an empty or failed result while
 * this is false, and configure cannot run until auth has resolved and the
 * entitlement refresh has come back over the network.
 *
 * So a screen that fetches offerings must wait for THIS, not for availability:
 * fetching on availability alone races the configure and renders a storefront
 * that is empty forever, because nothing about availability changes afterwards
 * to trigger a retry. That is a user who wanted to pay and was shown nothing.
 */
export function isBillingReady(): boolean {
  return configured;
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
  /**
   * False for a price the storefront can SHOW but not sell: read straight from
   * Google Play because RevenueCat's servers couldn't be reached, or remembered
   * from the last visit. Buying needs an offering package (`raw`), because
   * RevenueCat has to be reachable to record the purchase.
   */
  purchasable: boolean;
  /** Opaque handle passed back to `purchasePlan`. Null when not purchasable. */
  raw: unknown;
}

export type PurchaseOutcome =
  | { status: "purchased" }
  | { status: "cancelled" }
  /**
   * The store accepted the payment but hasn't confirmed it (cash at a shop,
   * some cards, carrier billing). NOT an error: the entitlement listener flips
   * the tier by itself when Play confirms, whether or not this screen is open.
   */
  | { status: "pending"; message: string }
  | { status: "error"; kind: StoreProblemKind; message: string; detail: string };

/** What the storefront gets back: the plans, or the reason there are none. */
export interface Storefront {
  plans: PlanOption[];
  /** Why `plans` is empty (or missing a period) — null when all is well. */
  problem: StoreProblem | null;
}

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
/**
 * `onConfigured` fires the moment the SDK can answer — BEFORE the entitlement
 * refresh below, which is a network round trip. The storefront's price fetch
 * waits on readiness, and on a network where RevenueCat is slow or half
 * reachable that refresh can take tens of seconds; the SDK serves offerings
 * from its own cache meanwhile, so there is no reason to hold prices behind it.
 */
export async function configureBilling(
  appUserId: string | null,
  onConfigured?: () => void,
): Promise<void> {
  const p = loadSdk();
  if (!p || !REVENUECAT_KEY || configured) return;

  try {
    if (__DEV__ && p.LOG_LEVEL) p.setLogLevel(p.LOG_LEVEL.DEBUG);
    // Before configure: the SDK installs its default handler during configure
    // only when none has been set.
    p.setLogHandler?.(routeSdkLog);
    p.configure({ apiKey: REVENUECAT_KEY, appUserID: appUserId });
    configured = true;
    onConfigured?.();
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
 * `fresh` skips the SDK's cache and asks RevenueCat's servers. The cache is
 * minutes old at best, so without it a cancellation made a second ago — in the
 * app, or in the Play Store — would keep saying "Renews" until the cache
 * happened to expire.
 *
 * A network failure is deliberately swallowed: the persisted entitlement stays
 * authoritative, which is what keeps a paying user Pro while offline.
 */
export async function refreshEntitlement(opts: { fresh?: boolean } = {}): Promise<void> {
  const p = loadSdk();
  if (!p || !configured) return;
  try {
    if (opts.fresh) await p.invalidateCustomerInfoCache();
    await applyCustomerInfo(await p.getCustomerInfo());
  } catch (e) {
    if (__DEV__) console.info("[billing] refresh failed, keeping cache:", e);
  }
}

/**
 * Open the store's own subscription page — where an App Store subscription is
 * cancelled (Apple has no cancel API), and the fallback on Android when the
 * in-app cancel can't reach the server.
 *
 * On iOS this is Apple's sheet inside the app when the SDK can show it; the
 * account page otherwise.
 */
export async function openSubscriptionManagement(): Promise<void> {
  const p = loadSdk();
  if (Platform.OS === "ios" && p?.showManageSubscriptions && configured) {
    try {
      await p.showManageSubscriptions();
      return;
    } catch (e) {
      if (__DEV__) console.info("[billing] showManageSubscriptions failed:", e);
    }
  }
  await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
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
    purchasable: true,
    raw: pkg,
  };
}

/** "P1M" → monthly, "P1Y"/"P12M" → annual, anything else → other. */
function periodOfIso(iso: string | null | undefined): BillingPeriod {
  const t = String(iso ?? "").toUpperCase();
  if (t === "P1M") return "monthly";
  if (t === "P1Y" || t === "P12M") return "annual";
  return "other";
}

/**
 * Pro's prices read straight from Google Play, for when RevenueCat's servers
 * can't be reached.
 *
 * `getProducts` asks the Play Billing library on the device — it never touches
 * RevenueCat's API. That matters because the two fail separately: on
 * 2026-09-27 a Nigerian ISP could not reach RevenueCat's API at all (its DNS
 * pinned an unreachable CloudFront edge) while Play answered with naira prices
 * every time. Without this, that reader got a storefront with no prices on it.
 *
 * Shown, never sold: `purchasable: false`, no package.
 */
async function pricesFromPlay(p: RCPurchases): Promise<PlanOption[]> {
  try {
    const products = await p.getProducts([...PLAY_SUBSCRIPTION_IDS]);
    const plans: PlanOption[] = [];
    for (const product of products) {
      const period = periodOfIso(product.subscriptionPeriod);
      // One per period: a subscription with several base plans or offers comes
      // back as several products, and the storefront shows one price per tile.
      if (period === "other" || plans.some((x) => x.period === period)) continue;
      plans.push({
        id: `pro:play:${product.identifier}`,
        tier: "pro",
        period,
        priceString: product.priceString,
        priceAmount: product.price,
        currency: product.currencyCode,
        title: product.title,
        pricePerMonthString: product.pricePerMonthString ?? null,
        trialDays: trialDaysOf(product),
        purchasable: false,
        raw: null,
      });
    }
    return plans.sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]);
  } catch (e) {
    console.warn("[billing] Play price lookup failed:", e);
    return [];
  }
}

/** Annual before monthly — reading order on the storefront. */
const PERIOD_ORDER: Record<BillingPeriod, number> = { annual: 0, monthly: 1, other: 2 };

/**
 * Every plan the storefront can sell, in display order.
 *
 * Supports both console layouts (see `TIER_OFFERINGS` in config.ts): a named
 * `pro` offering if one exists, otherwise the current offering. Every package
 * either layout yields sells Pro.
 *
 * When there is nothing to sell it says WHY, in `problem`. An empty list on its
 * own used to render as "check your connection" whatever had happened, which
 * sent a console problem (an inactive base plan, a tester off the track) to the
 * WiFi settings. `problem` is null when billing is simply unavailable in this
 * build — the storefront has its own branch for that.
 */
export async function getPlanOptions(): Promise<Storefront> {
  const p = loadSdk();
  if (!p || !configured) return { plans: [], problem: null };
  try {
    const offerings = await p.getOfferings();

    const offering =
      offerings.all[TIER_OFFERINGS.pro] ??
      offerings.current ??
      Object.values(offerings.all)[0] ??
      null;
    if (!offering) {
      return {
        plans: await pricesFromPlay(p),
        problem: emptyOfferingProblem(
          `RevenueCat returned no offering — expected one named "${TIER_OFFERINGS.pro}" or a current one.`,
        ),
      };
    }

    const plans = offering.availablePackages
      .map(toPlan)
      .sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]);

    // The storefront sells exactly two periods. A missing one is a console
    // problem too (an inactive base plan, a custom package type), and it
    // leaves that half of the switch with a dead button — so it is reported
    // even though the other half can still sell.
    const missing = (["monthly", "annual"] as const).filter(
      (period) => !plans.some((plan) => plan.period === period),
    );
    if (missing.length === 0) return { plans, problem: null };
    return {
      plans,
      problem: emptyOfferingProblem(
        `Offering "${offering.identifier}" has no ${missing.join(" or ")} package Play could price ` +
          `(got: ${offering.availablePackages.map((x) => `${x.identifier}=${x.packageType}`).join(", ") || "nothing"}). ` +
          "Check the base plan is ACTIVE in Play Console and the package type is Monthly/Annual in RevenueCat.",
      ),
    };
  } catch (e) {
    console.warn("[billing] getOfferings failed:", e);
    // RevenueCat is unreachable or refused — Google Play may still answer.
    return { plans: await pricesFromPlay(p), problem: describeStoreError(e, "offerings") };
  }
}

// ── Transactions ────────────────────────────────────────────────────────────

/**
 * Buy a plan. A user cancelling is a NORMAL outcome, not an error — the caller
 * must not show an error toast for it, which is why it has its own status
 * rather than being folded into the failure case.
 *
 * THIS IS A NEW PURCHASE, NEVER A PLAN SWITCH. On Android a switch between two
 * subscription products (welliva_pro_monthly → welliva_pro_yearly) needs
 * `googleProductChangeInfo` naming the old product, or Play opens a SECOND
 * subscription beside the first and bills both. The storefront never offers
 * that path — a subscriber's Pro card is "Manage plan", which hands off to
 * Play — so this call deliberately takes no change info. Adding an in-app
 * monthly ↔ annual switch means adding it here first.
 */
export async function purchasePlan(plan: PlanOption): Promise<PurchaseOutcome> {
  const p = loadSdk();
  if (!p || !configured) {
    return {
      status: "error",
      kind: "unknown",
      message: "The store isn't connected yet. Nothing has been charged.",
      detail: "purchasePlan called before configureBilling finished.",
    };
  }
  try {
    if (!plan.purchasable || !plan.raw) {
      return {
        status: "error",
        kind: "network",
        message:
          "welliva's subscription service isn't answering right now, so this can't be bought yet. Nothing has been charged.",
        detail: "purchasePlan called with a price-only plan (no offering package).",
      };
    }
    const pkg = plan.raw as RCPackage;
    const { customerInfo } = await p.purchasePackage(pkg);
    await applyCustomerInfo(customerInfo);

    // The purchase resolved, so RevenueCat has already validated the receipt
    // and answered with the customer's entitlements. If Pro is not among them,
    // the product is not attached to the entitlement in the console — and
    // announcing "You're on Pro" here would be contradicted by every lock.
    if (tierOf(customerInfo).tier === "free") {
      return {
        status: "error",
        kind: "setup",
        message:
          "Your payment went through, but Pro didn't switch on. Tap Restore purchases to unlock it.",
        detail:
          `Bought ${pkg.product.identifier}, but no active "${PRO_ENTITLEMENT}" entitlement came back. ` +
          `Attach this product to the "${PRO_ENTITLEMENT}" entitlement in RevenueCat.`,
      };
    }
    return { status: "purchased" };
  } catch (e) {
    const err = e as { userCancelled?: boolean | null };
    if (err?.userCancelled) return { status: "cancelled" };
    const problem = describeStoreError(e, "purchase");
    if (problem.kind === "pending") return { status: "pending", message: problem.message };
    console.warn("[billing] purchase failed:", e);
    return { status: "error", ...problem };
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
  if (!p || !configured) {
    return { ok: false, tier: "free", message: "The store isn't connected yet. Try again in a moment." };
  }
  try {
    const info = await p.restorePurchases();
    await applyCustomerInfo(info);
    return { ok: true, tier: tierOf(info).tier };
  } catch (e) {
    console.warn("[billing] restore failed:", e);
    return { ok: false, tier: "free", message: describeStoreError(e, "restore").message };
  }
}
