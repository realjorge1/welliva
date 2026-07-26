/**
 * SUPABASE AUTH PROVIDER
 *
 * Real auth backed by Supabase (email/password live).
 * Social providers (Google/Apple/Facebook) are stubbed with a friendly
 * "coming soon" message until OAuth redirect URLs are configured — they
 * intentionally do NOT block launch.
 *
 * Every existing `useAuth()` / `useSupabaseAuth()` import keeps working.
 */

import type { Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { clearSignedUrlCache } from "../services/sync/StorageSync";
import { flush as flushSyncTelemetry } from "../services/sync/SyncTelemetry";
import { fullPushSweep, hasPendingWrites } from "../services/sync/SyncEngine";
import { purgeAppData } from "../services/sync/UserScope";

// Lets the web popup close itself after an OAuth redirect (no-op on native).
WebBrowser.maybeCompleteAuthSession();

/** The app's auth redirect target — welliva://auth-callback in a real build. */
const authRedirectUri = () =>
  makeRedirectUri({ scheme: "welliva", path: "auth-callback" });

/** Pull a `?code=…` out of a redirect URL and exchange it for a session. */
async function exchangeCodeFromUrl(url: string | null): Promise<void> {
  if (!url) return;
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code === "string") {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isSignedIn: boolean;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const NOT_CONFIGURED = "Social sign-in is coming soon — please use email for now.";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    });

    // Auth deep links: an email-confirmation tap or an OAuth cold-start returns
    // to welliva://auth-callback?code=… — exchange it for a session, after which
    // onAuthStateChange (above) fires SIGNED_IN and routing takes over.
    const onDeepLink = (url: string | null) =>
      exchangeCodeFromUrl(url).catch((e) => console.warn("Auth deep link:", e));
    Linking.getInitialURL().then(onDeepLink);
    const linkSub = Linking.addEventListener("url", ({ url }) => onDeepLink(url));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const social = async () => {
      throw new Error(NOT_CONFIGURED);
    };

    return {
      user,
      session,
      isLoading,
      isSignedIn: !!session,
      loading: isLoading,
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
      signInWithGoogle: async () => {
        const redirectTo = authRedirectUri();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Could not start Google sign-in.");
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== "success") return; // user dismissed the browser
        await exchangeCodeFromUrl(result.url);
      },
      signInWithApple: social,
      signInWithFacebook: social,
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
      refreshSession: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      },
    };
  }, [user, session, isLoading]);

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
