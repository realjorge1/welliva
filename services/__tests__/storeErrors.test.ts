/**
 * A store failure is the one error a customer reads at the exact moment they
 * were about to pay, so the sentence matters as much as the classification.
 *
 * The rules being locked here:
 *   • a console problem is never dressed up as bad WiFi — that is the bug this
 *     module was written to end ("Check your connection" for an inactive plan)
 *   • a pending payment never says "nothing has been charged", because it has
 *   • the customer's sentence never leaks RevenueCat, a console or a code; the
 *     developer's detail always carries the store's underlying reason
 *   • nothing thrown into it makes it throw
 */
import { describe, expect, it } from "vitest";

import { describeStoreError, emptyOfferingProblem } from "@/services/billing/storeErrors";

/** The shape react-native-purchases rejects with. */
function rcError(code: string, readable: string, underlying = "") {
  return {
    code,
    message: `${readable} message`,
    readableErrorCode: readable,
    userInfo: { readableErrorCode: readable },
    underlyingErrorMessage: underlying,
    userCancelled: false,
  };
}

describe("describeStoreError", () => {
  it("classifies a configuration error as setup, not network", () => {
    const p = describeStoreError(
      rcError(
        "23",
        "CONFIGURATION_ERROR",
        "None of the products registered in the RevenueCat dashboard could be fetched from the Play Store.",
      ),
      "offerings",
    );
    expect(p.kind).toBe("setup");
    expect(p.message).not.toMatch(/connection/i);
    expect(p.detail).toContain("CONFIGURATION_ERROR");
    expect(p.detail).toContain("could be fetched from the Play Store");
  });

  it("classifies both network codes as network", () => {
    expect(describeStoreError(rcError("10", "NETWORK_ERROR"), "offerings").kind).toBe("network");
    expect(describeStoreError(rcError("35", "OFFLINE_CONNECTION_ERROR"), "purchase").kind).toBe(
      "network",
    );
  });

  it("treats invalid store credentials and unavailable products as setup", () => {
    expect(describeStoreError(rcError("11", "INVALID_CREDENTIALS_ERROR"), "purchase").kind).toBe("setup");
    expect(
      describeStoreError(rcError("5", "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR"), "purchase").kind,
    ).toBe("setup");
  });

  it("never tells someone with a pending payment that nothing was charged", () => {
    const p = describeStoreError(rcError("20", "PAYMENT_PENDING_ERROR"), "purchase");
    expect(p.kind).toBe("pending");
    expect(p.message).not.toMatch(/nothing has been charged/i);
    expect(p.message).toMatch(/pending/i);
  });

  it("sends an account that already owns Pro to Restore", () => {
    const p = describeStoreError(rcError("6", "PRODUCT_ALREADY_PURCHASED_ERROR"), "purchase");
    expect(p.kind).toBe("owned");
    expect(p.message).toMatch(/restore/i);
  });

  it("keeps vendor vocabulary out of every customer sentence", () => {
    for (const code of ["2", "3", "5", "6", "10", "11", "20", "23", "35", "999"]) {
      for (const stage of ["offerings", "purchase", "restore"] as const) {
        const { message } = describeStoreError(rcError(code, "SOME_ERROR"), stage);
        expect(message).not.toMatch(/revenuecat|console|dashboard|error code|_ERROR/i);
      }
    }
  });

  it("survives anything thrown at it", () => {
    for (const thrown of [undefined, null, "boom", 42, new Error("plain"), {}]) {
      const p = describeStoreError(thrown, "purchase");
      expect(p.kind).toBe("unknown");
      expect(p.message.length).toBeGreaterThan(0);
      expect(p.detail.length).toBeGreaterThan(0);
    }
    expect(describeStoreError("boom", "purchase").detail).toContain("boom");
  });

  it("says the store's repeated message once", () => {
    const p = describeStoreError(
      { code: "2", message: "Play is down", underlyingErrorMessage: "Play is down" },
      "offerings",
    );
    expect(p.detail).toBe("code 2 — Play is down");
  });
});

describe("emptyOfferingProblem", () => {
  it("is a setup problem carrying the given detail", () => {
    const p = emptyOfferingProblem("no annual package");
    expect(p.kind).toBe("setup");
    expect(p.detail).toBe("no annual package");
    expect(p.message).not.toMatch(/connection/i);
  });
});
