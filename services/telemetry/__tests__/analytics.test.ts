/**
 * The privacy guard, under test.
 *
 * `sanitize` is the last code that runs before anything could leave the device,
 * and the thing it is guarding against is not malice — it is a future developer
 * adding `{ weight }` to an event because it was convenient at the call site.
 * These tests encode the rule from services/telemetry/events.ts so that doing so
 * fails here rather than in someone's privacy policy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAnalyticsForTests, sanitize } from "../Analytics";
import { ALLOWED_PROP_KEYS, KNOWN_EVENTS, MAX_PROP_STRING } from "../events";

describe("sanitize", () => {
  beforeEach(() => {
    __resetAnalyticsForTests();
  });

  it("accepts a declared event with its declared props", () => {
    expect(sanitize("paywall_view", { source: "coach-limit" })).toEqual({
      event: "paywall_view",
      props: { source: "coach-limit" },
    });
  });

  it("accepts a declared event with no props", () => {
    expect(sanitize("activated", undefined)).toEqual({ event: "activated", props: {} });
  });

  it("DROPS an event that is not in the taxonomy", () => {
    // The types stop this at compile time; this is the runtime half, for anything
    // that arrives through a cast or off a persisted queue written by an older build.
    expect(sanitize("weight_logged", { kg: 81 })).toBeNull();
    expect(sanitize("", {})).toBeNull();
    expect(sanitize("CoachMessage", {})).toBeNull();
  });

  it("DROPS a prop key that is not on the allowlist", () => {
    const out = sanitize("food_logged", {
      source: "manual",
      kg: 81,
      calories: 2100,
      meal: "jollof rice",
      cycleDay: 14,
      mood: "low",
    });
    // The declared prop survives; every health value is gone.
    expect(out).toEqual({ event: "food_logged", props: { source: "manual" } });
  });

  it("DROPS objects and arrays, which is how a whole record gets in by accident", () => {
    const out = sanitize("food_logged", {
      // `source` is allowlisted, so this is the dangerous shape: a legal KEY
      // carrying an illegal VALUE.
      source: { name: "jollof rice", calories: 640 },
    });
    expect(out).toEqual({ event: "food_logged", props: {} });

    expect(sanitize("food_logged", { source: ["a", "b"] })).toEqual({
      event: "food_logged",
      props: {},
    });
  });

  it("DROPS a long string — every legitimate value is a short literal", () => {
    const ok = "x".repeat(MAX_PROP_STRING);
    const tooLong = "x".repeat(MAX_PROP_STRING + 1);

    expect(sanitize("food_logged", { source: ok })?.props).toEqual({ source: ok });
    // A free-text value (a chat message, a food name, a search) is long, so the
    // cap is a second line of defence behind the key allowlist.
    expect(sanitize("food_logged", { source: tooLong })?.props).toEqual({});
  });

  it("DROPS empty strings, null, undefined and non-finite numbers", () => {
    expect(sanitize("food_logged", { source: "" })?.props).toEqual({});
    expect(sanitize("food_logged", { source: null })?.props).toEqual({});
    expect(sanitize("food_logged", { source: undefined })?.props).toEqual({});
    expect(sanitize("onboarding_step", { step: Number.NaN })?.props).toEqual({});
    expect(sanitize("onboarding_step", { step: Infinity })?.props).toEqual({});
  });

  it("keeps booleans and finite numbers", () => {
    expect(sanitize("app_open", { cold: true })?.props).toEqual({ cold: true });
    expect(sanitize("app_open", { cold: false })?.props).toEqual({ cold: false });
  });

  it("drops a function, which would otherwise serialise to nothing useful", () => {
    expect(sanitize("food_logged", { source: () => "manual" })?.props).toEqual({});
  });
});

describe("the taxonomy itself", () => {
  it("has no duplicate event names", () => {
    expect(new Set(KNOWN_EVENTS).size).toBe(KNOWN_EVENTS.length);
  });

  it("allows no prop key that names a health value", () => {
    // Not exhaustive, and not meant to be: it is a tripwire on the shape of
    // mistake this file exists to prevent. Widening ALLOWED_PROP_KEYS with
    // anything body-shaped should fail a test, not pass a review.
    const forbidden = [
      "kg",
      "weight",
      "weightkg",
      "calories",
      "kcal",
      "protein",
      "carbs",
      "fat",
      "meal",
      "food",
      "name",
      "mood",
      "energy",
      "sleep",
      "cycleday",
      "period",
      "flow",
      "symptom",
      "symptoms",
      "medication",
      "condition",
      "message",
      "text",
      "query",
      "email",
      "age",
      "height",
    ];
    const offenders = ALLOWED_PROP_KEYS.filter((k) =>
      forbidden.includes(k.toLowerCase()),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps every allowed prop key short and lower-case-ish", () => {
    for (const key of ALLOWED_PROP_KEYS) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*$/);
    }
  });
});

describe("consent gating", () => {
  beforeEach(() => {
    vi.resetModules();
    __resetAnalyticsForTests();
  });

  it("queues nothing while product_analytics is denied", async () => {
    vi.doMock("@/health-os/privacy/ConsentRepository", () => ({
      consent: { isGranted: async () => false },
    }));
    const { track, __queueForTests, __resetAnalyticsForTests: reset } = await import(
      "../Analytics"
    );
    reset();

    track("app_open", { cold: true });
    // track() is fire-and-forget, so let its microtask chain settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(__queueForTests()).toEqual([]);
  });

  it("queues the event once product_analytics is granted", async () => {
    vi.doMock("@/health-os/privacy/ConsentRepository", () => ({
      consent: { isGranted: async () => true },
    }));
    const { track, __queueForTests, __resetAnalyticsForTests: reset } = await import(
      "../Analytics"
    );
    reset();

    track("app_open", { cold: true });
    await new Promise((r) => setTimeout(r, 0));

    const queued = __queueForTests();
    expect(queued).toHaveLength(1);
    expect(queued[0].event).toBe("app_open");
    expect(queued[0].props).toEqual({ cold: true });
    // No sink installed, so platform is honest about not knowing rather than
    // guessing — and nothing was sent.
    expect(queued[0].platform).toBe("unknown");
    expect(queued[0].user_id).toBeNull();
    expect(queued[0].install_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("a failing upload", () => {
  beforeEach(() => {
    vi.resetModules();
    // The app's bundler defines it; plain Node does not.
    vi.stubGlobal("__DEV__", true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("says why ONCE, as a log line — never a warning that raises the dev toast", async () => {
    vi.doMock("@/health-os/privacy/ConsentRepository", () => ({
      consent: { isGranted: async () => true },
    }));
    const analytics = await import("../Analytics");
    analytics.__resetAnalyticsForTests();
    const missing = "Could not find the table 'public.analytics_events' in the schema cache";
    let reason = missing;
    analytics.setAnalyticsSink({
      platform: "android",
      appVersion: null,
      sendEvents: async () => ({ ok: false, error: reason }),
      sendCrash: async () => ({ ok: false, error: reason }),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    analytics.track("app_open", { cold: true });
    await new Promise((r) => setTimeout(r, 0));
    await analytics.flush();
    await analytics.flush();
    await analytics.flush();

    // The toast sat over the workout player's controls, re-raised every flush.
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain(missing);
    // Nothing is lost by saying it quietly: the event waits for the table.
    expect(analytics.__queueForTests()).toHaveLength(1);

    // A new reason is news, and is said once too.
    reason = "Network request failed";
    await analytics.flush();
    await analytics.flush();
    expect(log).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();

    analytics.__resetAnalyticsForTests();
  });
});
