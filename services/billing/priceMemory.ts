/**
 * PRICE MEMORY — the last prices the store quoted, kept on this device.
 *
 * The storefront's prices come from the network twice over: RevenueCat for the
 * packages, Google Play for the amounts. Either can be slow or unreachable, and
 * until one answers the price tag has nothing to print. Remembering the last
 * real quote means it opens already filled, in the reader's own currency,
 * instead of blank or in US dollars, and the live answer replaces it when it
 * lands.
 *
 * REMEMBERED PRICES ARE SHOWN, NEVER SOLD. They come back `purchasable: false`
 * with no package: a purchase always needs a live offering, and a price seen
 * yesterday is a good description of today's but not a quote to charge against.
 *
 * Device-local (services/sync/syncKeys.ts): the currency is this phone's Play
 * account's, and the whole thing regenerates on the next successful load.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PlanOption } from "./Billing";

export const PRICE_MEMORY_KEY = "@welliva_store_prices";

type Remembered = Omit<PlanOption, "purchasable" | "raw">;

function isRemembered(x: unknown): x is Remembered {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    p.tier === "pro" &&
    (p.period === "monthly" || p.period === "annual") &&
    typeof p.id === "string" &&
    typeof p.priceString === "string" &&
    typeof p.priceAmount === "number" &&
    typeof p.currency === "string"
  );
}

/** Keep a live quote for next time. Only ever called with prices the store just gave. */
export async function rememberPrices(plans: PlanOption[]): Promise<void> {
  const keep: Remembered[] = plans
    .filter((p) => p.period === "monthly" || p.period === "annual")
    .map(({ purchasable: _purchasable, raw: _raw, ...rest }) => rest);
  if (keep.length === 0) return;
  try {
    await AsyncStorage.setItem(PRICE_MEMORY_KEY, JSON.stringify(keep));
  } catch {
    // A cache that can't be written costs one blank tag next time, nothing more.
  }
}

/** The last quote, as display-only plans. Empty when there is none. */
export async function recallPrices(): Promise<PlanOption[]> {
  try {
    const raw = await AsyncStorage.getItem(PRICE_MEMORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRemembered).map((p) => ({
      ...p,
      pricePerMonthString: p.pricePerMonthString ?? null,
      trialDays: p.trialDays ?? null,
      title: p.title ?? "Pro",
      purchasable: false,
      raw: null,
    }));
  } catch {
    return [];
  }
}
