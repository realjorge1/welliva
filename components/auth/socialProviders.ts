/**
 * WHICH SOCIAL BUTTONS TO SHOW — asked of the server, not hard-coded.
 *
 * A social button is only real if the provider is enabled on the Supabase
 * project. Tapping one that isn't gets `{"code":400,"error_code":
 * "validation_failed","msg":"Unsupported provider: provider is not enabled"}` —
 * a dead button that looks exactly like a broken app.
 *
 * The obvious fix is a `const FACEBOOK_ENABLED` next to the button, and it is
 * the wrong one: it puts the truth in two places (a dashboard toggle and a
 * source file) and every mismatch is user-visible. Both failure directions are
 * bad — a flag left off hides a provider that works, a flag left on ships the
 * dead button.
 *
 * So we ask. `/auth/v1/settings` is a public, unauthenticated endpoint that
 * reports exactly which providers the project has switched on, and this module
 * fetches it once per app launch and caches the promise. Enabling Facebook in
 * the Supabase dashboard makes the button appear on next launch — no rebuild,
 * no release.
 *
 * Until the answer lands (and forever, if the request fails) the app shows
 * `DEFAULT_PROVIDERS`. That default is deliberately the conservative set: what
 * we are confident works today. A provider never appears on a guess.
 */
import { useEffect, useState } from "react";

export interface SocialProviders {
  google: boolean;
  facebook: boolean;
  apple: boolean;
}

/**
 * What to show before the server has answered, and if it never does. Google
 * only: it is the provider this project has had configured and tested. A failed
 * request must never be the reason a new button appears.
 */
export const DEFAULT_PROVIDERS: SocialProviders = {
  google: true,
  facebook: false,
  apple: false,
};

/** Narrow the settings payload to the three providers this app offers. */
export function providersFromSettings(payload: unknown): SocialProviders {
  const external = (payload as { external?: Record<string, unknown> } | null)?.external;
  if (!external || typeof external !== "object") return DEFAULT_PROVIDERS;
  return {
    google: external.google === true,
    facebook: external.facebook === true,
    apple: external.apple === true,
  };
}

/**
 * One in-flight request per app launch, shared by every screen that asks.
 *
 * Cached even when it fails: a project that can't be reached at sign-in time
 * will not become reachable by asking again on the next screen, and retrying
 * would just re-run the layout shift.
 */
let cached: Promise<SocialProviders> | null = null;

export function fetchSocialProviders(): Promise<SocialProviders> {
  if (cached) return cached;
  cached = (async () => {
    // Read at call time, not at module load. Expo inlines `EXPO_PUBLIC_*` at
    // build time wherever it appears, so this costs the app nothing — and it
    // keeps the module testable, which a captured module-scope constant is not.
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anonKey) return DEFAULT_PROVIDERS;
    try {
      const res = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anonKey },
      });
      if (!res.ok) return DEFAULT_PROVIDERS;
      return providersFromSettings(await res.json());
    } catch {
      // Offline at the sign-in screen. Show the known-good set; the email form
      // will report the network problem the moment they try to use it.
      return DEFAULT_PROVIDERS;
    }
  })();
  return cached;
}

/** Test seam — lets a suite start from a clean cache. */
export function resetSocialProvidersCache(): void {
  cached = null;
}

/** The hook the auth screens use. Starts conservative, widens once told. */
export function useSocialProviders(): SocialProviders {
  const [providers, setProviders] = useState<SocialProviders>(DEFAULT_PROVIDERS);

  useEffect(() => {
    let mounted = true;
    fetchSocialProviders().then((next) => {
      if (mounted) setProviders(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return providers;
}
