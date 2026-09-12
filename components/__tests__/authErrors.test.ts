/**
 * AUTH ERROR WORDING — the failures a user can actually hit, in their words.
 *
 * The codes and messages here are the ones this project's Supabase endpoints
 * return; the point of the suite is that the mapping keys off GoTrue's stable
 * `code` first and only falls back to prose, so a wording change upstream
 * cannot quietly turn a handled failure back into a raw string.
 */
import { describe, expect, it } from "vitest";

import {
  friendlyAuthError,
  isEmailNotConfirmed,
  isEmailRateLimited,
} from "../auth/authErrors";

/** The shape supabase-js actually throws. */
const authError = (code: string, message: string) => ({ code, message });

describe("friendlyAuthError", () => {
  it("explains the project email quota without jargon", () => {
    const text = friendlyAuthError(
      authError("over_email_send_rate_limit", "email rate limit exceeded"),
    );
    expect(text).toMatch(/too many emails/i);
    expect(text).not.toMatch(/rate limit exceeded/);
  });

  it("recognises the quota from the message alone, with no code", () => {
    expect(friendlyAuthError({ message: "email rate limit exceeded" })).toMatch(
      /too many emails/i,
    );
  });

  it("turns invalid credentials into one plain sentence", () => {
    expect(
      friendlyAuthError(authError("invalid_credentials", "Invalid login credentials")),
    ).toBe("Incorrect email or password.");
  });

  it("tells an unconfirmed user to tap the link", () => {
    expect(
      friendlyAuthError(authError("email_not_confirmed", "Email not confirmed")),
    ).toMatch(/confirm your email/i);
  });

  it("points an existing account at sign-in", () => {
    expect(
      friendlyAuthError(authError("user_already_exists", "User already registered")),
    ).toMatch(/already registered/i);
  });

  it("explains an expired link and what to do about it", () => {
    expect(
      friendlyAuthError(
        authError("otp_expired", "Email link is invalid or has expired"),
      ),
    ).toMatch(/expired/i);
  });

  it("does not offer a disabled provider as an explanation the user can act on", () => {
    expect(
      friendlyAuthError({
        code: "validation_failed",
        message: "Unsupported provider: provider is not enabled",
      }),
      // `validation_failed` is also the code for a bad address, so this asserts
      // the provider branch is checked first — otherwise someone who tapped
      // Facebook gets told to check their email address.
    ).toMatch(/isn't available yet/i);
  });

  it("names the network when the network is the problem", () => {
    expect(friendlyAuthError(new Error("Network request failed"))).toMatch(
      /connection/i,
    );
  });

  it("accepts a bare string", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe(
      "Incorrect email or password.",
    );
  });

  it("passes an unrecognised message through rather than inventing one", () => {
    expect(friendlyAuthError(new Error("Some novel failure"))).toBe(
      "Some novel failure",
    );
  });

  it("still says something when there is nothing to go on", () => {
    expect(friendlyAuthError(null)).toMatch(/went wrong/i);
    expect(friendlyAuthError(undefined)).toMatch(/went wrong/i);
    expect(friendlyAuthError({})).toMatch(/went wrong/i);
  });
});

describe("isEmailNotConfirmed", () => {
  it("matches on the code and on the message", () => {
    expect(isEmailNotConfirmed(authError("email_not_confirmed", "whatever"))).toBe(true);
    expect(isEmailNotConfirmed({ message: "Email not confirmed" })).toBe(true);
  });

  it("does not fire on a wrong password — that has nowhere else to go", () => {
    expect(
      isEmailNotConfirmed(authError("invalid_credentials", "Invalid login credentials")),
    ).toBe(false);
    expect(isEmailNotConfirmed(null)).toBe(false);
  });
});

describe("isEmailRateLimited", () => {
  it("matches the quota failure and nothing else", () => {
    expect(
      isEmailRateLimited(authError("over_email_send_rate_limit", "email rate limit exceeded")),
    ).toBe(true);
    expect(isEmailRateLimited(authError("over_request_rate_limit", "too many requests"))).toBe(
      false,
    );
  });
});
