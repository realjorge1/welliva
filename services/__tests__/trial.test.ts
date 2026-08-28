/**
 * The insight trial gives away the most expensive tier in the app, for free,
 * automatically. Everything that stops it being given away twice — or to the
 * wrong person, or forever — lives in one module, so it gets tested like the
 * money path it is.
 *
 * The rules being locked here, in the order they cost most if broken:
 *   • once, ever — a second window must never open
 *   • never to someone already paying
 *   • never in a build that cannot sell anything, or the one-time grant is burnt
 *     where it has no meaning and the user never gets it for real
 *   • it must actually expire
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      removeItem: async (k: string) => void mem.delete(k),
      __reset: () => mem.clear(),
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  activeTrial,
  setTrialClaimer,
  trialSource,
  clearTrial,
  hasUsedTrial,
  hydrateTrial,
  maybeStartInsightTrial,
  TRIAL_HOURS,
  trialHoursLeft,
  trialTier,
} from "../billing/trial";

const GRANTABLE = { isSubscriber: false, gatingActive: true };

beforeEach(async () => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  await clearTrial();
  await hydrateTrial();
});

describe("granting", () => {
  it("opens a window for a free user in a build that can sell", async () => {
    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(true);
    expect(trialTier()).toBe("pro");
    expect(activeTrial()).not.toBeNull();
  });

  it("never opens a second one", async () => {
    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(true);
    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(false);
    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(false);
  });

  it("refuses someone who already pays", async () => {
    expect(await maybeStartInsightTrial({ ...GRANTABLE, isSubscriber: true })).toBe(false);
    expect(trialTier()).toBeNull();
    // And crucially it is NOT burnt — they keep the trial for if they lapse.
    expect(hasUsedTrial()).toBe(false);
  });

  it("refuses a build with billing switched off, rather than burning the grant", async () => {
    expect(await maybeStartInsightTrial({ ...GRANTABLE, gatingActive: false })).toBe(false);
    expect(hasUsedTrial()).toBe(false);
    // Once the same user reaches a real store build, they still get their window.
    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(true);
  });
});

describe("expiry", () => {
  it("runs for exactly the advertised window", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await maybeStartInsightTrial({ ...GRANTABLE, now });

    const justInside = new Date(now.getTime() + (TRIAL_HOURS - 1) * 3_600_000);
    const justOutside = new Date(now.getTime() + (TRIAL_HOURS + 1) * 3_600_000);

    expect(trialTier(justInside)).toBe("pro");
    expect(trialTier(justOutside)).toBeNull();
    expect(activeTrial(justOutside)).toBeNull();
  });

  it("counts down in whole hours and floors at zero", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await maybeStartInsightTrial({ ...GRANTABLE, now });

    expect(trialHoursLeft(now)).toBe(TRIAL_HOURS);
    expect(trialHoursLeft(new Date(now.getTime() + 24 * 3_600_000))).toBe(24);
    // Never negative, however long after it lapsed we ask.
    expect(trialHoursLeft(new Date(now.getTime() + 500 * 3_600_000))).toBe(0);
  });

  it("stays used after it expires, so it cannot restart", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await maybeStartInsightTrial({ ...GRANTABLE, now });
    const after = new Date(now.getTime() + (TRIAL_HOURS + 1) * 3_600_000);

    expect(trialTier(after)).toBeNull();
    expect(hasUsedTrial()).toBe(true);
    expect(await maybeStartInsightTrial({ ...GRANTABLE, now: after })).toBe(false);
  });
});

describe("persistence", () => {
  it("survives a cold start mid-window", async () => {
    await maybeStartInsightTrial(GRANTABLE);
    const before = activeTrial()!;

    await hydrateTrial(); // as if relaunched
    expect(activeTrial()?.expiresAt).toBe(before.expiresAt);
    expect(trialTier()).toBe("pro");
  });

  it("is dropped on sign-out so the next account starts clean", async () => {
    await maybeStartInsightTrial(GRANTABLE);
    await clearTrial();
    expect(trialTier()).toBeNull();
    expect(hasUsedTrial()).toBe(false);
  });
});

describe("the server owns the answer when it can give one", () => {
  it("honours the window the backend returns, not one of its own", async () => {
    const serverExpiry = new Date(Date.now() + 6 * 3_600_000).toISOString();
    setTrialClaimer(async () => ({
      expiresAt: serverExpiry,
      claimedAt: new Date().toISOString(),
      alreadyClaimed: false,
    }));

    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(true);
    // 6 hours, because the server said 6 — NOT the local TRIAL_HOURS default.
    expect(activeTrial()!.expiresAt).toBe(serverExpiry);
    expect(trialSource()).toBe("server");
    setTrialClaimer(null);
  });

  it("gets nothing when the account already used its trial elsewhere", async () => {
    // The anti-farming path: a reinstall asks again and is told it is spent.
    const spent = new Date(Date.now() - 24 * 3_600_000).toISOString();
    setTrialClaimer(async () => ({
      expiresAt: spent,
      claimedAt: new Date(Date.now() - 72 * 3_600_000).toISOString(),
      alreadyClaimed: true,
    }));

    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(false);
    expect(trialTier()).toBeNull();
    // And it is recorded, so we never ask again on this device either.
    expect(hasUsedTrial()).toBe(true);
    setTrialClaimer(null);
  });

  it("does not celebrate a window it did not open", async () => {
    // Already claimed but still running: the user keeps the access and the
    // caller must not fire a "your trial started" moment a second time.
    const live = new Date(Date.now() + 12 * 3_600_000).toISOString();
    setTrialClaimer(async () => ({
      expiresAt: live,
      claimedAt: new Date(Date.now() - 36 * 3_600_000).toISOString(),
      alreadyClaimed: true,
    }));

    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(false);
    expect(trialTier()).toBe("pro"); // access is still granted
    setTrialClaimer(null);
  });
});

describe("falling back when the backend cannot answer", () => {
  it("grants locally when the endpoint 404s, and says so", async () => {
    // Exactly today: /v1/billing/trial/claim is not deployed.
    setTrialClaimer(async () => {
      throw new Error("API error 404");
    });

    const now = new Date("2026-08-19T10:00:00Z");
    expect(await maybeStartInsightTrial({ ...GRANTABLE, now })).toBe(true);
    expect(trialTier(now)).toBe("pro");
    // The full local window, exactly as before the server path existed.
    expect(trialHoursLeft(now)).toBe(TRIAL_HOURS);
    // Flagged as unbacked, so a coach 402 on a "Pro" screen is diagnosable.
    expect(trialSource()).toBe("local");
    setTrialClaimer(null);
  });

  it("grants locally when the claimer resolves null (signed out, offline)", async () => {
    setTrialClaimer(async () => null);
    expect(await maybeStartInsightTrial(GRANTABLE)).toBe(true);
    expect(trialSource()).toBe("local");
    setTrialClaimer(null);
  });

  it("never asks the server for someone who already pays", async () => {
    let asked = false;
    setTrialClaimer(async () => {
      asked = true;
      return null;
    });
    expect(await maybeStartInsightTrial({ ...GRANTABLE, isSubscriber: true })).toBe(false);
    expect(asked).toBe(false);
    setTrialClaimer(null);
  });
});
