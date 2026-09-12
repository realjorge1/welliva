/**
 * SUPABASE AUTH PROVIDER
 *
 * Real auth backed by Supabase: email/password, plus any OAuth provider the
 * project has enabled (Google and Facebook are wired; Apple still needs native
 * Sign in with Apple and is stubbed).
 *
 * Every existing `useAuth()` / `useSupabaseAuth()` import keeps working.
 */

import type { Provider, Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { parseAuthRedirect } from "./auth/authRedirect";
import { deleteAccount as deleteAccountData } from "../services/account/AccountDeletion";
import { clearSignedUrlCache } from "../services/sync/StorageSync";
import { flush as flushSyncTelemetry } from "../services/sync/SyncTelemetry";
import { fullPushSweep, hasPendingWrites } from "../services/sync/SyncEngine";
import { purgeAppData } from "../services/sync/UserScope";

// Lets the web popup close itself after an OAuth redirect (no-op on native).
WebBrowser.maybeCompleteAuthSession();

/** The app's auth redirect target — welliva://auth-callback in a real build. */
const authRedirectUri = () =>
  makeRedirectUri({ scheme: "welliva", path: "auth-callback" });

/**
 * Exchange one auth code for a session, at most once.
 *
 * Auth codes are single-use, and on Android TWO paths see every one of them:
 * the `Linking` listener below (the redirect arrives as a deep link) and the
 * URL that `openAuthSessionAsync` resolves with. Left alone both exchange the
 * same code, and the second call fails with "code verifier should be
 * non-empty" — because the first exchange consumed the stored PKCE verifier
 * and deleted it. That is a sign-in that succeeds and reports failure in the
 * same breath.
 *
 * The map entry is created SYNCHRONOUSLY alongside the promise, so a second
 * caller arriving in the same tick joins the first exchange instead of racing
 * it, and both observe the same outcome. Entries are kept even when the
 * exchange fails: a code that failed is not worth retrying (a fresh tap mints a
 * new one), and the map only ever holds one entry per sign-in attempt.
 */
const codeExchanges = new Map<string, Promise<void>>();

function exchangeCodeOnce(code: string): Promise<void> {
  const inFlight = codeExchanges.get(code);
  if (inFlight) return inFlight;

  const exchange = (async () => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  })();
  codeExchanges.set(code, exchange);
  // Marks the CACHED copy as handled. Callers still receive `exchange` itself
  // and still see the rejection; this only stops the reference we hold in the
  // map from registering as an unhandled rejection.
  exchange.catch(() => {});
  return exchange;
}

/**
 * Adopt a session that arrived whole, at most once.
 *
 * Single-flighted for the same reason as the code path, and keyed on the
 * refresh token because that is the part that must not be spent twice: refresh
 * tokens rotate, so a duplicate `setSession` can retire the token the first
 * call just installed and sign the user straight back out.
 */
const tokenAdoptions = new Map<string, Promise<void>>();

function setSessionOnce(accessToken: string, refreshToken: string): Promise<void> {
  const inFlight = tokenAdoptions.get(refreshToken);
  if (inFlight) return inFlight;

  const adopt = (async () => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  })();
  tokenAdoptions.set(refreshToken, adopt);
  adopt.catch(() => {});
  return adopt;
}

/**
 * The last error that arrived ON a redirect rather than as a rejected call.
 *
 * These have no caller to reject: an expired confirmation link opens the app
 * cold, and on Android an OAuth redirect is often delivered to the `Linking`
 * listener rather than as `openAuthSessionAsync`'s resolved value. With nowhere
 * to put them, the app's response to "that link has expired" was to open the
 * sign-in screen and say nothing at all.
 *
 * So they are held here until someone takes responsibility for showing one.
 * Whoever consumes it clears it, which is what stops an OAuth failure being
 * displayed twice — once thrown from the sign-in call, once by the screen.
 */
let pendingRedirectError: string | null = null;
const redirectErrorListeners = new Set<(message: string) => void>();

function reportRedirectError(message: string): void {
  pendingRedirectError = message;
  redirectErrorListeners.forEach((notify) => notify(message));
}

function takeRedirectError(): string | null {
  const message = pendingRedirectError;
  pendingRedirectError = null;
  return message;
}

/**
 * Handle an auth redirect: turn whatever it carries into a session, or raise
 * the error it came back with.
 *
 * `parseAuthRedirect` reads the fragment as well as the query string, which is
 * the entire reason it exists — see components/auth/authRedirect.ts.
 */
async function handleAuthRedirect(url: string | null): Promise<void> {
  const redirect = parseAuthRedirect(url);
  switch (redirect.kind) {
    case "code":
      return exchangeCodeOnce(redirect.code);
    case "tokens":
      return setSessionOnce(redirect.accessToken, redirect.refreshToken);
    case "error":
      throw new Error(redirect.message);
    case "none":
      return;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isSignedIn: boolean;
  loading: boolean;
  /**
   * An auth failure that arrived on a deep link with no call to reject — an
   * expired confirmation link being the common one. The auth screens show it,
   * then call `clearRedirectError`.
   */
  redirectError: string | null;
  clearRedirectError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Irreversibly delete the account and every trace of it, then end the session.
   *
   * Separate from `signOut` rather than a flag on it, because the two want
   * OPPOSITE things from the sync layer: sign-out's first act is to push local
   * data up so nothing is stranded; deletion must never push, because it is
   * removing the very rows a sweep would write to. Sharing one function would
   * mean a boolean deciding whether the first thing it does is save your data
   * or destroy it — too easy to pass wrongly, and unrecoverable when it is.
   *
   * @param password required for password accounts; ignored for OAuth-only ones
   *        (see `accountHasPassword`). Taken HERE rather than verified by the
   *        caller beforehand so there is no window between "password checked"
   *        and "account deleted", and no way to reach the delete having skipped
   *        the check. Throws `ReauthenticationError` before touching anything.
   */
  deleteAccount: (password?: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

/**
 * Apple only. Sign in with Apple is a native capability — an entitlement, a
 * paid developer account and `expo-apple-authentication` — not a provider
 * toggle, so it cannot ride the same web flow as the others.
 */
const APPLE_NOT_CONFIGURED =
  "Sign in with Apple is coming soon — please use another way in for now.";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(
    // A redirect can be handled before this component mounts. Seed from the
    // holder so nothing that already arrived is dropped on the floor.
    () => pendingRedirectError,
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
      // A session arriving retires any complaint about how the last attempt
      // went: they are in, and an error line about an expired link would be
      // both stale and alarming.
      if (newSession) {
        takeRedirectError();
        setRedirectError(null);
      }
    });

    const onRedirectError = (message: string) => {
      if (mounted) setRedirectError(message);
    };
    redirectErrorListeners.add(onRedirectError);

    // Auth deep links: an email-confirmation tap or an OAuth cold-start returns
    // to welliva://auth-callback?code=… — exchange it for a session, after which
    // onAuthStateChange (above) fires SIGNED_IN and routing takes over. A
    // redirect carrying a failure instead has nobody to reject, so it goes to
    // the holder and the auth screens pick it up from there.
    const onDeepLink = (url: string | null) =>
      handleAuthRedirect(url).catch((e: unknown) => {
        console.warn("Auth deep link:", e);
        reportRedirectError(
          e instanceof Error ? e.message : String(e ?? "Sign-in failed."),
        );
      });
    Linking.getInitialURL().then(onDeepLink);
    const linkSub = Linking.addEventListener("url", ({ url }) => onDeepLink(url));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      redirectErrorListeners.delete(onRedirectError);
      linkSub.remove();
    };
  }, []);

  const clearRedirectError = useCallback(() => {
    takeRedirectError();
    setRedirectError(null);
  }, []);

  const value = useMemo<AuthContextType>(() => {
    /**
     * The shared OAuth round trip: open the provider in a browser, then take
     * whatever comes back.
     *
     * The awkward part is the return leg, and it is why this isn't four lines.
     * On Android the redirect is delivered to WHICHEVER of two paths wins a
     * race inside `openAuthSessionAsync` — its own resolved value, or the
     * `Linking` listener in the effect above. When the listener wins,
     * `openAuthSessionAsync` resolves `dismiss`, which is indistinguishable
     * from the user pressing back.
     *
     * Treating `dismiss` as a cancel outright (what this used to do) is safe
     * but silent: a genuinely failed sign-in looked exactly like a cancelled
     * one, and the user was returned to a sign-in screen with nothing on it. So
     * instead we wait a moment for the other path to finish and decide from the
     * result — a session means it worked, a reported error is thrown, and only
     * real silence is taken for a cancel.
     */
    const signInWithProvider = async (provider: Provider, label: string) => {
      // Anything left over from a previous attempt would otherwise be mistaken
      // for the outcome of this one.
      takeRedirectError();

      const redirectTo = authRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(`Could not start ${label} sign-in.`);

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success") {
        await handleAuthRedirect(result.url);
        return;
      }

      // Give the deep-link path up to ~4s to land. Long enough for a redirect
      // already in flight, short enough that a user who really did back out
      // isn't left holding a spinner.
      const deadline = Date.now() + 4000;
      for (;;) {
        const reported = takeRedirectError();
        if (reported) throw new Error(reported);
        const { data: current } = await supabase.auth.getSession();
        if (current.session) return;
        if (Date.now() >= deadline) return; // nothing came back: they cancelled
        await sleep(150);
      }
    };

    return {
      user,
      session,
      isLoading,
      isSignedIn: !!session,
      loading: isLoading,
      redirectError,
      clearRedirectError,
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      },
      signUpWithEmail: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authRedirectUri() },
        });
        if (error) throw error;
        // With email confirmations ON, signUp returns a user but NO session — the
        // caller sends them to the verify-email screen. With confirmations OFF it
        // returns a live session and the app routes straight into onboarding.
        return { needsEmailConfirmation: !data.session };
      },
      signInWithGoogle: () => signInWithProvider("google", "Google"),
      signInWithFacebook: () => signInWithProvider("facebook", "Facebook"),
      signInWithApple: async () => {
        throw new Error(APPLE_NOT_CONFIGURED);
      },
      signOut: async () => {
        const uid = user?.id ?? null;
        // Best-effort final sync BEFORE tearing down the session: sweep + push
        // everything changed (incl. the services that write AsyncStorage
        // directly) so a sign-out never strands unsynced local data.
        try {
          if (uid) await fullPushSweep(uid);
        } catch (e) {
          console.warn("signOut final sync:", e);
        }

        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Drop this account's cached signed storage URLs. They're per-user
        // credentials held in memory, and they outlive the session — without
        // this, signing in as someone else on the same device could still
        // resolve the previous user's avatar. Best-effort: a cleanup failure
        // must not leave the user stuck in a half-signed-out state.
        try {
          clearSignedUrlCache();
          await flushSyncTelemetry();
          // Wipe this device for the next account — but ONLY if everything made
          // it to the cloud. If a push is still pending (offline), keep the data
          // so the SAME user gets it back next sign-in; a DIFFERENT user is
          // covered by ensureDeviceOwnedBy at their login (finding #4).
          if (uid && !(await hasPendingWrites())) {
            await purgeAppData();
          }
        } catch (e) {
          console.warn("signOut cleanup:", e);
        }
      },
      deleteAccount: async (password?: string) => {
        if (!user) throw new Error("Not signed in.");

        // Re-authenticates (throwing ReauthenticationError before touching
        // anything), then deletes files, the auth row — cascading every table —
        // and this device. Throws if the account survived, in which case we
        // deliberately do NOT touch the session below, leaving the user signed
        // in and able to retry.
        await deleteAccountData(user, password);

        // The account is gone; the session is now a token for a user that does
        // not exist. Tear it down WITHOUT the sign-out path: `signOut` above
        // opens with fullPushSweep, which would try to re-upload the local data
        // we just erased into rows that no longer exist.
        //
        // Errors past this line are swallowed on purpose. The deletion has
        // already succeeded and cannot be undone, so surfacing "couldn't clear
        // the local session" as a failure would tell the user their account
        // still exists — the opposite of the truth. Worst case the stale token
        // is rejected on next use and onAuthStateChange signs them out anyway.
        try {
          clearSignedUrlCache();
          await flushSyncTelemetry();
          await supabase.auth.signOut();
        } catch (e) {
          console.warn("deleteAccount session teardown:", e);
        }

        // Belt and braces: if signOut failed above, onAuthStateChange never
        // fires and AuthWrapper would keep rendering the app for a deleted
        // account. Clearing state here guarantees the redirect to /sign-in.
        setSession(null);
        setUser(null);
      },
      refreshSession: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      },
    };
  }, [user, session, isLoading, redirectError, clearRedirectError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within a SupabaseAuthProvider");
  }
  return ctx;
}

// Alias for backwards compatibility
export const useSupabaseAuth = useAuth;

export { AuthContext };
