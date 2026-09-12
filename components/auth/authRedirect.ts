/**
 * AUTH REDIRECT PARSING — what actually comes back on `welliva://auth-callback`.
 *
 * Every way into this app that isn't a password ends here: an OAuth round trip,
 * a sign-up confirmation link, a password-reset link. They all land on the same
 * deep link, and they do NOT all land in the same shape.
 *
 * ── WHY THIS IS NOT `Linking.parse` ─────────────────────────────────────────
 *
 * It used to be, and that was a silent bug. `Linking.parse` builds its
 * `queryParams` from `URL.searchParams` alone, so it reads `?a=1` and throws the
 * `#fragment` away. Supabase puts auth results in BOTH, depending on the flow —
 * these are real `Location` headers from this project:
 *
 *   OAuth failure   →  welliva://auth-callback?error=invalid_request&…   (query)
 *   Expired e-mail  →  welliva://auth-callback#error=access_denied&…     (FRAGMENT)
 *   Implicit tokens →  welliva://auth-callback#access_token=…            (FRAGMENT)
 *
 * So a user tapping a confirmation link that had expired re-opened the app to a
 * sign-in screen that said nothing at all, because the only part of the URL
 * carrying the reason was the part being discarded. Reading both is the fix.
 *
 * Pure and dependency-free on purpose: no expo-linking, no React, no `URL`.
 * `URL` is deliberately avoided — Hermes ships an incomplete polyfill whose
 * `searchParams` cannot be relied on, which is the same reason expo-linking
 * wraps its own use of it in a try/catch. Plain string work behaves identically
 * everywhere and makes the whole matrix testable in a Node process.
 */

/** What a redirect turned out to be. Exactly one of these, never a mix. */
export type AuthRedirect =
  /** PKCE: exchange this for a session. The normal success path. */
  | { kind: "code"; code: string }
  /** Implicit: a session arrived whole, set it directly. */
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  /** The provider or Supabase refused, and said why. */
  | { kind: "error"; message: string; code: string | null }
  /** Not an auth redirect, or an auth redirect carrying nothing. */
  | { kind: "none" };

/**
 * Decode one `application/x-www-form-urlencoded` pair list.
 *
 * `+` is a space here, not a plus — Supabase encodes error descriptions that
 * way ("Email+link+is+invalid+or+has+expired"), and skipping this step is the
 * difference between a sentence and a slug in front of the user.
 */
function decodePairs(input: string, into: Record<string, string>): void {
  if (!input) return;
  for (const pair of input.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? "" : pair.slice(eq + 1);
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      value = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch {
      // A malformed percent-escape must not take the whole redirect down with
      // it — keep the raw text, which is still more use than nothing.
      key = rawKey;
      value = rawValue;
    }
    // First writer wins, and the query is read first: a value that appears in
    // both halves resolves the same way every time.
    if (key && !(key in into)) into[key] = value;
  }
}

/**
 * Every parameter on a redirect URL, from the query string AND the fragment.
 *
 * Exported for the sake of tests and callers that want to look at something
 * this module doesn't model; `parseAuthRedirect` is what the app should use.
 */
export function redirectParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hash = url.indexOf("#");
  const head = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? "" : url.slice(hash + 1);

  const question = head.indexOf("?");
  decodePairs(question === -1 ? "" : head.slice(question + 1), params);
  decodePairs(fragment, params);
  return params;
}

/**
 * Classify an auth redirect.
 *
 * Order matters: a redirect carrying credentials is a success even if it also
 * carries some advisory `error` field, so the credential branches are checked
 * first. In practice the two never arrive together — the ordering is here so
 * that if they ever do, the user gets signed in rather than shown a warning.
 */
export function parseAuthRedirect(url: string | null | undefined): AuthRedirect {
  if (!url) return { kind: "none" };
  const params = redirectParams(url);

  if (params.code) return { kind: "code", code: params.code };

  if (params.access_token && params.refresh_token) {
    return {
      kind: "tokens",
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
    };
  }

  // `error_description` is the human sentence; `error` is the machine slug and
  // only stands in when there is no sentence. `error_code` is the stable
  // identifier the UI maps to its own wording (see auth/authErrors.ts).
  const message = params.error_description || params.error;
  if (message) {
    return {
      kind: "error",
      message,
      code: params.error_code || params.error || null,
    };
  }

  return { kind: "none" };
}
