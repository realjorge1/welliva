/**
 * The storefront's remembered prices. What matters: a quote survives to the
 * next visit in the reader's own currency, it comes back SHOW-ONLY (a price
 * seen yesterday is never something to charge against), and a corrupt entry
 * yields nothing rather than a broken tag.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import type { PlanOption } from "@/services/billing/Billing";
import { isDeviceLocalKey } from "@/services/sync/syncKeys";
import {
  PRICE_MEMORY_KEY,
  recallPrices,
  rememberPrices,
} from "@/services/billing/priceMemory";

function plan(period: "monthly" | "annual", priceString: string, priceAmount: number): PlanOption {
  return {
    id: `pro:${period}`,
    tier: "pro",
    period,
    priceString,
    priceAmount,
    currency: "NGN",
    title: "Pro",
    pricePerMonthString: null,
    trialDays: 7,
    purchasable: true,
    raw: { native: "package handle" },
  };
}

describe("price memory", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(PRICE_MEMORY_KEY);
  });

  it("brings the last quote back in the same currency, but show-only", async () => {
    await rememberPrices([plan("annual", "₦12,300.00", 12300), plan("monthly", "₦1,450.00", 1450)]);
    const recalled = await recallPrices();
    expect(recalled.map((p) => p.priceString)).toEqual(["₦12,300.00", "₦1,450.00"]);
    expect(recalled.every((p) => p.purchasable === false && p.raw === null)).toBe(true);
    expect(recalled[0].trialDays).toBe(7);
  });

  it("never stores the native package handle", async () => {
    await rememberPrices([plan("monthly", "₦1,450.00", 1450)]);
    expect(await AsyncStorage.getItem(PRICE_MEMORY_KEY)).not.toMatch(/package handle/);
  });

  it("recalls nothing from a missing or corrupt entry", async () => {
    expect(await recallPrices()).toEqual([]);
    await AsyncStorage.setItem(PRICE_MEMORY_KEY, "{not json");
    expect(await recallPrices()).toEqual([]);
    await AsyncStorage.setItem(PRICE_MEMORY_KEY, JSON.stringify([{ tier: "pro", period: "weekly" }]));
    expect(await recallPrices()).toEqual([]);
  });

  it("stays on this device — the currency is this phone's Play account's", () => {
    expect(isDeviceLocalKey(PRICE_MEMORY_KEY)).toBe(true);
  });
});
