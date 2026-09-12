/**
 * AUTH REDIRECT PARSING — the shapes Supabase actually sends back.
 *
 * The URLs in these tests are not invented. Each one is a real `Location`
 * header taken from this project's auth endpoints (with tokens shortened), and
 * the fragment cases are the bug this module was written to close: the previous
 * implementation used `Linking.parse`, which reads `?query` and silently drops
 * `#fragment`, so an expired confirmation link produced a sign-in screen with
 * no message on it.
 */
import { describe, expect, it } from "vitest";

import { parseAuthRedirect, redirectParams } from "../auth/authRedirect";

describe("parseAuthRedirect", () => {
  it("reads the PKCE code from the query string", () => {
    expect(parseAuthRedirect("welliva://auth-callback?code=abc123")).toEqual({
      kind: "code",
      code: "abc123",
    });
  });

  it("reads an error from the QUERY — the OAuth callback's shape", () => {
    // Observed: GET /auth/v1/callback?error=x&state=bogus
    const url =
      "welliva://auth-callback?error=invalid_request&error_code=bad_oauth_state" +
      "&error_description=OAuth+state+parameter+is+invalid";
    expect(parseAuthRedirect(url)).toEqual({
      kind: "error",
      message: "OAuth state parameter is invalid",
      code: "bad_oauth_state",
    });
  });

  it("reads an error from the FRAGMENT — the email link's shape", () => {
    // Observed: GET /auth/v1/verify?token=…&type=signup&redirect_to=…
    // This is the case Linking.parse dropped entirely.
    const url =
      "welliva://auth-callback#error=access_denied&error_code=otp_expired" +
      "&error_description=Email+link+is+invalid+or+has+expired&sb=";
    expect(parseAuthRedirect(url)).toEqual({
      kind: "error",
      message: "Email link is invalid or has expired",
      code: "otp_expired",
    });
  });

  it("decodes + as a space, so the message is a sentence", () => {
    const url = "welliva://auth-callback#error_description=Email+link+is+invalid";
    const result = parseAuthRedirect(url);
    expect(result).toMatchObject({ kind: "error", message: "Email link is invalid" });
  });

  it("decodes percent escapes", () => {
    const url = "welliva://auth-callback?error_description=Couldn%27t%20verify%20it";
    expect(parseAuthRedirect(url)).toMatchObject({
      message: "Couldn't verify it",
    });
  });

  it("survives a malformed escape instead of throwing", () => {
    const url = "welliva://auth-callback?error_description=100%broken";
    expect(parseAuthRedirect(url)).toMatchObject({ kind: "error" });
  });

  it("reads implicit tokens from the fragment", () => {
    const url =
      "welliva://auth-callback#access_token=ey.aaa&refresh_token=rrr" +
      "&expires_in=3600&token_type=bearer";
    expect(parseAuthRedirect(url)).toEqual({
      kind: "tokens",
      accessToken: "ey.aaa",
      refreshToken: "rrr",
    });
  });

  it("needs BOTH tokens — half a session is not a session", () => {
    expect(parseAuthRedirect("welliva://auth-callback#access_token=ey.aaa")).toEqual({
      kind: "none",
    });
  });

  it("prefers a code over an error, so a success is never shown as a failure", () => {
    const url = "welliva://auth-callback?code=abc123&error=whatever";
    expect(parseAuthRedirect(url)).toEqual({ kind: "code", code: "abc123" });
  });

  it("falls back to the error slug when there is no description", () => {
    expect(parseAuthRedirect("welliva://auth-callback#error=access_denied")).toEqual({
      kind: "error",
      message: "access_denied",
      code: "access_denied",
    });
  });

  it("treats a plain deep link, an empty URL and null as nothing to do", () => {
    expect(parseAuthRedirect("welliva://auth-callback")).toEqual({ kind: "none" });
    expect(parseAuthRedirect("welliva://logs")).toEqual({ kind: "none" });
    expect(parseAuthRedirect("")).toEqual({ kind: "none" });
    expect(parseAuthRedirect(null)).toEqual({ kind: "none" });
    expect(parseAuthRedirect(undefined)).toEqual({ kind: "none" });
  });

  it("handles the Expo Go redirect shape, which has a path AND a query", () => {
    const url = "exp://127.0.0.1:8081/--/auth-callback?code=abc123";
    expect(parseAuthRedirect(url)).toEqual({ kind: "code", code: "abc123" });
  });
});

describe("redirectParams", () => {
  it("merges query and fragment, query winning a tie", () => {
    const url = "welliva://auth-callback?error=from_query#error=from_fragment&extra=1";
    expect(redirectParams(url)).toEqual({ error: "from_query", extra: "1" });
  });

  it("keeps a valueless key rather than dropping the pair", () => {
    expect(redirectParams("welliva://auth-callback#sb=&code=x")).toEqual({
      sb: "",
      code: "x",
    });
  });
});
