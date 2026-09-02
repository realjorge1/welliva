/**
 * BILLING CONFIG — is there a usable RevenueCat key?
 *
 * Mirrors services/api/config.ts exactly: an unset or malformed key means
 * "billing is OFF", never a crash. That is what keeps three environments alive
 * without special-casing anywhere else in the app:
 *
 *   • Expo Go / web — react-native-purchases is a native module and simply
 *     isn't there. Billing off, everyone is free tier, app fully usable.
 *   • A build made before the RevenueCat account existed.
 *   • A misconfigured CI build — degrades to free rather than a white screen
 *     on launch.
 *
 * The public SDK key ships in the bundle by design. It is the same trust model
 * as the Supabase anon key: entitlements are validated by RevenueCat against
 * Google/Apple servers, never by this client. The SECRET key (sk_…) must never
 * appear here — it belongs only on the backend.
 */
import { Platform } from "react-native";

const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();
const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();

/**
 * Public keys are prefixed by platform (`goog_`, `appl_`). Checking the prefix
 * catches the two mistakes that actually happen: pasting the iOS key into the
 * Android slot, and pasting a secret `sk_…` key into a client build.
 */
const rawKey = Platform.select({ android: androidKey, ios: iosKey, default: undefined });
const prefix = Platform.select({ android: "goog_", ios: "appl_", default: "" }) ?? "";

const looksValid = Boolean(rawKey) && rawKey!.startsWith(prefix);

if (__DEV__ && rawKey && !looksValid) {
  console.warn(
    `[billing] EXPO_PUBLIC_REVENUECAT_${Platform.OS.toUpperCase()}_KEY does not start ` +
      `with "${prefix}" — billing disabled. Check you copied the PUBLIC key for ` +
      `this platform from RevenueCat → Project settings → API keys.`,
  );
}

/** The key to configure the SDK with, or null when billing should stay off. */
export const REVENUECAT_KEY: string | null = looksValid ? rawKey! : null;

/**
 * True when a usable key is configured. Gates every billing path — when false
 * the app never loads the SDK, never shows a paywall, and treats everyone as
 * free tier.
 */
export const isBillingConfigured = REVENUECAT_KEY !== null;

/**
 * The entitlement identifier the app checks. Must match an identifier created in
 * RevenueCat → Entitlements, with every product attached to it (the monthly AND
 * the annual one).
 *
 * An entitlement rather than a product-id table because the store is the only
 * thing that actually knows what someone bought: reading one boolean off
 * `customerInfo` needs no mapping in the client, so adding a promo price, a
 * regional plan or a lifetime SKU later is a console change with no app update.
 */
export const PRO_ENTITLEMENT = "pro";

/**
 * The retired Plus entitlement, still read — and still granting Pro.
 *
 * Plus was merged into Pro, but the identifier may well still exist in the
 * console attached to live subscriptions, and RevenueCat keeps reporting it for
 * as long as those periods run. Dropping the check would downgrade a paying
 * customer to free on their next launch, which is the one billing bug that
 * costs a refund AND a review. Delete this only once the console shows no
 * active `plus` entitlements at all.
 */
export const LEGACY_PLUS_ENTITLEMENT = "plus";

/** The offering to display. `default` is the one marked current in RevenueCat. */
export const DEFAULT_OFFERING = "default";

/**
 * The offering holding Pro's packages, when the console models it as a named
 * offering rather than the current one.
 *
 * BOTH LAYOUTS ARE SUPPORTED, because RevenueCat allows either and the console
 * is not ours to constrain from here:
 *
 *  1. A NAMED `pro` OFFERING with its monthly + annual package. What
 *     docs/monetization/setup.md walks through.
 *  2. THE CURRENT OFFERING holding those packages directly.
 *
 * `Billing.ts` tries (1) and falls back to (2). Every package either layout
 * yields sells Pro — there is no longer a tier to classify a package into, so a
 * stray `plus`-named package left in the console simply sells Pro, which is the
 * safe direction: it honours a price the store may still be showing someone
 * rather than refusing a purchase.
 */
export const TIER_OFFERINGS = { pro: "pro" } as const;

/** Where "Manage subscription" sends the user. Required by both stores. */
export const MANAGE_SUBSCRIPTION_URL = Platform.select({
  android: "https://play.google.com/store/account/subscriptions",
  ios: "https://apps.apple.com/account/subscriptions",
  default: "https://play.google.com/store/account/subscriptions",
})!;
