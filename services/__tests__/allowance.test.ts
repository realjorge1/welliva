import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  checkAllowance,
  getAllowanceUsed,
  resetAllowances,
  spendAllowance,
} from "@/services/billing/allowance";
import { deepDiveLifetimeLimit, FREE_TIER } from "@/services/billing/tiers";

/**
 * The LIFETIME allowance store (services/billing/allowance.ts).
 *
 * Three properties are worth a test, because getting any of them wrong is
 * invisible in the UI and expensive in production:
 *
 *  1. It does not reset. The daily meter next door discards its counts on a
 *     date change; if this store ever inherits that behaviour, every free user
 *     gets unlimited deep dives at midnight.
 *  2. `null` means unlimited, and unlimited spends nothing — a Plus user must
 *     never accumulate a count that would strand them if they downgraded.
 *  3. Checking is free. `checkAllowance` must never consume, or merely opening
 *     a sheet would cost a use.
 */
describe("lifetime allowances", () => {
  beforeEach(async () => {
    await resetAllowances();
  });

  it("gives the free tier exactly three deep dives, then closes", async () => {
    const limit = deepDiveLifetimeLimit("free");
    expect(limit).toBe(3);
    expect(FREE_TIER.deepDivesLifetime).toBe(3);

    for (let i = 1; i <= 3; i++) {
      expect((await checkAllowance("deepDive", limit)).allowed).toBe(true);
      await spendAllowance("deepDive", limit);
    }

    const after = await checkAllowance("deepDive", limit);
    expect(after.allowed).toBe(false);
    expect(after.used).toBe(3);
    expect(after.remaining).toBe(0);
  });

  it("does not reset — there is no rollover to inherit", async () => {
    await spendAllowance("deepDive", 3);
    await spendAllowance("deepDive", 3);

    // The daily meter keys its record on the local date and throws the counts
    // away when that changes. Nothing in this record may be date-shaped.
    const raw = await AsyncStorage.getItem("@welliva_allowance");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ counts: { deepDive: 2 } });
    expect(raw).not.toMatch(/\d{4}-\d{2}-\d{2}/);

    expect(await getAllowanceUsed("deepDive")).toBe(2);
  });

  it("treats a null limit as unlimited and counts nothing", async () => {
    expect(deepDiveLifetimeLimit("plus")).toBeNull();
    expect(deepDiveLifetimeLimit("pro")).toBeNull();

    const state = await spendAllowance("deepDive", null);
    expect(state.allowed).toBe(true);
    expect(state.remaining).toBe(Number.POSITIVE_INFINITY);
    // Nothing was recorded: a Plus user carries no count into a downgrade.
    expect(await getAllowanceUsed("deepDive")).toBe(0);
  });

  it("checking never spends", async () => {
    await checkAllowance("deepDive", 3);
    await checkAllowance("deepDive", 3);
    await checkAllowance("deepDive", 3);
    await checkAllowance("deepDive", 3);
    expect(await getAllowanceUsed("deepDive")).toBe(0);
  });

  it("wipes on reset, so the next account on this device starts fresh", async () => {
    await spendAllowance("deepDive", 3);
    await resetAllowances();
    expect(await getAllowanceUsed("deepDive")).toBe(0);
    expect((await checkAllowance("deepDive", 3)).allowed).toBe(true);
  });
});
