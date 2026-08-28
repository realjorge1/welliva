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
 * The two entitlement identifiers the app checks. Each must match an identifier
 * created in RevenueCat → Entitlements, and every product in a tier must be
 * attached to that tier's entitlement (the monthly AND the annual one).
 *
 * Two entitlements rather than one-with-metadata because the store is the only
 * thing that actually knows what someone bought: reading two booleans off
 * `customerInfo` needs no product-id table in the client, so adding a promo
 * price, a regional plan or a lifetime SKU later is a console change with no app
 * update. `PRO` outranks `PLUS` when both are somehow active (a mid-cycle
 * upgrade leaves both live until the old one lapses) — see `higherTier`.
 */
export const PRO_ENTITLEMENT = "pro";
export const PLUS_ENTITLEMENT = "plus";

/** The offering to display. `default` is the one marked current in RevenueCat. */
export const DEFAULT_OFFERING = "default";

/**
 * Offering identifiers, when the two tiers are modelled as two offerings.
 *
 * BOTH LAYOUTS ARE SUPPORTED, because RevenueCat allows either and the console
 * is not ours to constrain from here:
 *
 *  1. TWO OFFERINGS — `plus` and `pro`, each with its own monthly + annual
 *     package. Cleanest, and what docs/monetization/setup.md walks through.
 *  2. ONE OFFERING — the current one, holding all four packages, each package
 *     or product id naming its tier ("welliva_plus_annual", "$rc_pro_monthly").
 *
 * `Billing.ts` tries (1) and falls back to (2), classifying by the substrings
 * below. A package that names neither tier is treated as Pro: mislabelling the
 * *higher* plan as the lower one would sell full access at the lower price.
 */
export const TIER_OFFERINGS = { plus: "plus", pro: "pro" } as const;

/** Substrings that identify a tier inside a package or product identifier. */
export const TIER_ID_HINTS = { plus: "plus", pro: "pro" } as const;

/** Where "Manage subscription" sends the user. Required by both stores. */
export const MANAGE_SUBSCRIPTION_URL = Platform.select({
  android: "https://play.google.com/store/account/subscriptions",
  ios: "https://apps.apple.com/account/subscriptions",
  default: "https://play.google.com/store/account/subscriptions",
})!;
