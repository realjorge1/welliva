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
 * The single entitlement identifier the app checks. Must match the identifier
 * created in RevenueCat → Entitlements. One entitlement covering every paid
 * product means adding a lifetime tier or a promo later needs no app change.
 */
export const PRO_ENTITLEMENT = "pro";

/** The offering to display. `default` is the one marked current in RevenueCat. */
export const DEFAULT_OFFERING = "default";

/** Where "Manage subscription" sends the user. Required by both stores. */
export const MANAGE_SUBSCRIPTION_URL = Platform.select({
  android: "https://play.google.com/store/account/subscriptions",
  ios: "https://apps.apple.com/account/subscriptions",
  default: "https://play.google.com/store/account/subscriptions",
})!;
