/**
 * WHICH SIGN-IN METHODS ARE DRAWN — the project AND the product must both say yes.
 *
 * socialProviders.test.ts covers the first half (what the project has on). This
 * covers the join: an offer can never resurrect a provider the project refuses,
 * and a provider the project has on can never appear once we have pulled it.
 */
import { describe, expect, it } from "vitest";

import { visibleProviders, type SignInMethods } from "../auth/signInMethods";

const allOn = { google: true, facebook: true, apple: true };
const offer = (over: Partial<SignInMethods>): SignInMethods => ({
  google: true,
  facebook: true,
  apple: true,
  email: true,
  ...over,
});

describe("visibleProviders", () => {
  it("hides a provider we have pulled even when the project has it on", () => {
    expect(visibleProviders(allOn, offer({ apple: false }))).toEqual({
      google: true,
      facebook: true,
      apple: false,
    });
  });

  it("never shows an offered provider the project would refuse", () => {
    expect(
      visibleProviders({ google: true, facebook: false, apple: false }, offer({})),
    ).toEqual({ google: true, facebook: false, apple: false });
  });

  it("offers Google and Facebook only, by default", () => {
    expect(visibleProviders(allOn)).toEqual({ google: true, facebook: true, apple: false });
  });
});
