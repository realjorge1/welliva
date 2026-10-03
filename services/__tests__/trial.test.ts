/**
 * The Gozlin intro window gives away the app's only paid capability, for free,
 * automatically, to every install. Everything that stops it being given away
 * twice — or to the wrong person, or forever, or WIDER THAN INTENDED — lives in
 * one module, so it gets tested like the money path it is.
 *
 * The rules being locked here, in the order they cost most if broken:
 *   • it opens Gozlin and NOTHING ELSE — a window that lifted the whole tier
 *     would hand every new install unlimited history, cloud backup and the
 *     Foods catalog on day one
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
  maybeStartTrial,
  reconcileTrialWithServer,
  TRIAL_FEATURES,
  TRIAL_HOURS,
  trialGrants,
  trialHoursLeft,
} from "../billing/trial";
import { FEATURE_MIN_TIER, type FeatureId } from "../billing/tiers";

const GRANTABLE = { isSubscriber: false, gatingActive: true };

/** The representative AI feature — the conversation itself. */
const AI: FeatureId = "coach-limit";

beforeEach(async () => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  await clearTrial();
  await hydrateTrial();
});

describe("scope — it opens Gozlin, not the tier", () => {
  it("opens every AI feature while it runs", async () => {
    await maybeStartTrial(GRANTABLE);
    for (const f of ["coach-limit", "deep-dive", "ai-plans", "insights", "photo-log"] as const) {
      expect(trialGrants(f)).toBe(true);
    }
  });

  it("opens NOTHING that sells depth over the user's own data", async () => {
    await maybeStartTrial(GRANTABLE);
    // A first-launch user has no history to unlock, no second device to sync to
    // and nothing in the Foods catalog they could not log by hand. Giving these
    // away here would spend a paid feature at the moment it cannot impress.
    for (const f of ["habits", "foods", "sync", "history"] as const) {
      expect(trialGrants(f)).toBe(false);
    }
  });

  it("grants nothing at all when no window is open", () => {
    for (const f of Object.keys(FEATURE_MIN_TIER) as FeatureId[]) {
      expect(trialGrants(f)).toBe(false);
    }
  });

  /*
   * THE REGRESSION PIN. Adding a FeatureId must be a decision about this window,
   * not an accident — so the split is written out and compared, and a new id
   * fails here until someone puts it on one side or the other.
   */
  it("accounts for every gated feature, on one side of the line or the other", () => {
    // adaptive-training is outside: it spends no inference — it eases a
    // session the engine already built, on the phone.
    const OUTSIDE: readonly FeatureId[] = ["habits", "foods", "sync", "history", "adaptive-training", "generic"];
    const all = (Object.keys(FEATURE_MIN_TIER) as FeatureId[]).sort();
    expect([...TRIAL_FEATURES, ...OUTSIDE].sort()).toEqual(all);
  });

  it("only ever opens things that are actually locked", () => {
    // Granting a feature that is free anyway would be dead code pretending to
    // be generosity.
    for (const f of TRIAL_FEATURES) expect(FEATURE_MIN_TIER[f]).toBe("pro");
  });
});

describe("granting", () => {
  it("opens a window for a free user in a build that can sell", async () => {
    expect(await maybeStartTrial(GRANTABLE)).toBe(true);
    expect(trialGrants(AI)).toBe(true);
    expect(activeTrial()).not.toBeNull();
  });

  it("never opens a second one", async () => {
    expect(await maybeStartTrial(GRANTABLE)).toBe(true);
    expect(await maybeStartTrial(GRANTABLE)).toBe(false);
    expect(await maybeStartTrial(GRANTABLE)).toBe(false);
  });

  it("refuses someone who already pays", async () => {
    expect(await maybeStartTrial({ ...GRANTABLE, isSubscriber: true })).toBe(false);
    expect(trialGrants(AI)).toBe(false);
    // And crucially it is NOT burnt — they keep the window for if they lapse.
    expect(hasUsedTrial()).toBe(false);
  });

  it("refuses a build with billing switched off, rather than burning the grant", async () => {
    expect(await maybeStartTrial({ ...GRANTABLE, gatingActive: false })).toBe(false);
    expect(hasUsedTrial()).toBe(false);
    // Once the same user reaches a real store build, they still get their window.
    expect(await maybeStartTrial(GRANTABLE)).toBe(true);
  });
});

describe("expiry", () => {
  it("runs for exactly the advertised 30 hours", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await maybeStartTrial({ ...GRANTABLE, now });

    const justInside = new Date(now.getTime() + (TRIAL_HOURS - 1) * 3_600_000);
    const justOutside = new Date(now.getTime() + (TRIAL_HOURS + 1) * 3_600_000);

    expect(trialGrants(AI, justInside)).toBe(true);
    expect(trialGrants(AI, justOutside)).toBe(false);
    expect(activeTrial(justOutside)).toBeNull();
  });

  it("is 30 hours, because that is what the storefront says", () => {
    // The number is quoted to the user; it is not free to change quietly.
    expect(TRIAL_HOURS).toBe(30);
  });

  it("counts down in whole hours and floors at zero", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await maybeStartTrial({ ...GRANTABLE, now });

    expect(trialHoursLeft(now)).toBe(TRIAL_HOURS);
    expect(trialHoursLeft(new Date(now.getTime() + 24 * 3_600_000))).toBe(TRIAL_HOURS - 24);
    // Never negative, however long after it lapsed we ask.
    expect(trialHoursLeft(new Date(now.getTime() + 500 * 3_600_000))).toBe(0);
  });

  it("stays used after it expires, so it cannot restart", async () => {
    const now = new Date("2026-08-19T10:00:00Z");
    await maybeStartTrial({ ...GRANTABLE, now });
    const after = new Date(now.getTime() + (TRIAL_HOURS + 1) * 3_600_000);

    expect(trialGrants(AI, after)).toBe(false);
    expect(hasUsedTrial()).toBe(true);
    expect(await maybeStartTrial({ ...GRANTABLE, now: after })).toBe(false);
  });
});

describe("persistence", () => {
  it("survives a cold start mid-window", async () => {
    await maybeStartTrial(GRANTABLE);
    const before = activeTrial()!;

    await hydrateTrial(); // as if relaunched
    expect(activeTrial()?.expiresAt).toBe(before.expiresAt);
    expect(trialGrants(AI)).toBe(true);
  });

  it("is dropped on sign-out so the next account starts clean", async () => {
    await maybeStartTrial(GRANTABLE);
    await clearTrial();
    expect(trialGrants(AI)).toBe(false);
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

    expect(await maybeStartTrial(GRANTABLE)).toBe(true);
    // 6 hours, because the server said 6 — NOT the local TRIAL_HOURS default.
    expect(activeTrial()!.expiresAt).toBe(serverExpiry);
    expect(trialSource()).toBe("server");
    setTrialClaimer(null);
  });

  it("gets nothing when the account already used its window elsewhere", async () => {
    // The anti-farming path: a reinstall asks again and is told it is spent.
    const spent = new Date(Date.now() - 24 * 3_600_000).toISOString();
    setTrialClaimer(async () => ({
      expiresAt: spent,
      claimedAt: new Date(Date.now() - 72 * 3_600_000).toISOString(),
      alreadyClaimed: true,
    }));

    expect(await maybeStartTrial(GRANTABLE)).toBe(false);
    expect(trialGrants(AI)).toBe(false);
    // And it is recorded, so we never ask again on this device either.
    expect(hasUsedTrial()).toBe(true);
    setTrialClaimer(null);
  });

  it("does not celebrate a window it did not open", async () => {
    // Already claimed but still running: the user keeps the access and the
    // caller must not fire a "your window opened" moment a second time.
    const live = new Date(Date.now() + 12 * 3_600_000).toISOString();
    setTrialClaimer(async () => ({
      expiresAt: live,
      claimedAt: new Date(Date.now() - 36 * 3_600_000).toISOString(),
      alreadyClaimed: true,
    }));

    expect(await maybeStartTrial(GRANTABLE)).toBe(false);
    expect(trialGrants(AI)).toBe(true); // access is still granted
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
    expect(await maybeStartTrial({ ...GRANTABLE, now })).toBe(true);
    expect(trialGrants(AI, now)).toBe(true);
    // The full local window, exactly as before the server path existed.
    expect(trialHoursLeft(now)).toBe(TRIAL_HOURS);
    // Flagged as unbacked, so a coach 402 on an "open" screen is diagnosable.
    expect(trialSource()).toBe("local");
    setTrialClaimer(null);
  });

  it("grants locally when the claimer resolves null (signed out, offline)", async () => {
    setTrialClaimer(async () => null);
    expect(await maybeStartTrial(GRANTABLE)).toBe(true);
    expect(trialSource()).toBe("local");
    setTrialClaimer(null);
  });

  it("never asks the server for someone who already pays", async () => {
    let asked = false;
    setTrialClaimer(async () => {
      asked = true;
      return null;
    });
    expect(await maybeStartTrial({ ...GRANTABLE, isSubscriber: true })).toBe(false);
    expect(asked).toBe(false);
    setTrialClaimer(null);
  });
});

/**
 * Once there is an account, the SERVER's window wins. The backend now enforces
 * it on every coach turn, so a window granted on the phone before sign-in (the
 * claim needs a token, so first launch always falls back locally) must give
 * way to the account's own — or the screen says "open" while every turn is
 * refused.
 */
describe("reconciling with the server after sign-in", () => {
  const SERVER = {
    claimedAt: "2026-09-20T10:00:00.000Z",
    expiresAt: "2026-09-21T16:00:00.000Z",
    alreadyClaimed: true,
  };

  it("replaces a local window with the account's, even an expired one", async () => {
    setTrialClaimer(null);
    await maybeStartTrial(GRANTABLE); // signed out: granted locally
    expect(trialSource()).toBe("local");

    setTrialClaimer(async () => SERVER);
    await reconcileTrialWithServer(GRANTABLE);
    expect(trialSource()).toBe("server");
    expect(activeTrial(new Date("2026-09-27T12:00:00Z"))).toBeNull();
    setTrialClaimer(null);
  });

  it("leaves the local window alone when the server cannot answer", async () => {
    setTrialClaimer(null);
    await maybeStartTrial(GRANTABLE);
    setTrialClaimer(async () => {
      throw new Error("offline");
    });
    await reconcileTrialWithServer(GRANTABLE);
    expect(trialSource()).toBe("local");
    expect(activeTrial()).not.toBeNull();
    setTrialClaimer(null);
  });

  it("never asks on behalf of a paying customer", async () => {
    const claimer = vi.fn(async () => SERVER);
    setTrialClaimer(claimer);
    await reconcileTrialWithServer({ isSubscriber: true, gatingActive: true });
    expect(claimer).not.toHaveBeenCalled();
    setTrialClaimer(null);
  });
});
