/**
 * AUTH WRAPPER — required-account routing
 *
 * The app requires a signed-in account. This wrapper enforces the flow:
 *   not signed in            → /sign-in (the only reachable screens are auth)
 *   signed in, profile not
 *     yet reconciled          → wait (don't route yet — see below)
 *   signed in, not onboarded  → /onboarding
 *   signed in, onboarded      → /(tabs)
 *
 * The "wait for reconcile" step matters: a returning user signing in on a fresh
 * device has no local bio yet, so without waiting we'd flash onboarding before
 * their cloud profile arrives. `isProfileReconciled` flips true once the
 * login-time pull+reconcile finishes (AppContext), and only then do we decide
 * onboarding-vs-tabs.
 */

import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from './SupabaseAuthProvider';
import { useProfile, useSystem } from '../contexts/AppContext';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading: authLoading } = useAuth();
  const { isOnboardingComplete } = useProfile();
  const { isLoading, isProfileReconciled } = useSystem();
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ preview?: string }>();

  useEffect(() => {
    // Still booting local storage or restoring the auth session — decide nothing.
    if (isLoading || authLoading) return;

    const inOnboarding = segments[0] === ('onboarding' as any);
    const inAuthScreen =
      segments[0] === 'sign-in' ||
      segments[0] === 'sign-up' ||
      segments[0] === ('verify-email' as any);
    // Preview mode (?preview=1): an already-onboarded user is intentionally
    // replaying onboarding to test it — don't bounce them back to the tabs.
    const isOnboardingPreview = inOnboarding && params.preview === '1';

    // 1) Not signed in — auth screens are the only allowed destination.
    if (!isSignedIn) {
      if (!inAuthScreen) router.replace('/sign-in' as any);
      return;
    }

    // 2) Signed in but the cloud profile hasn't reconciled yet — wait, so a
    //    returning user on a new device isn't flashed onboarding before their
    //    saved profile is pulled down.
    if (!isProfileReconciled) return;

    // 3) Signed in + reconciled — route on onboarding status.
    if (!isOnboardingComplete && !inOnboarding) {
      router.replace('/onboarding' as any);
    } else if (
      isOnboardingComplete &&
      ((inOnboarding && !isOnboardingPreview) || inAuthScreen)
    ) {
      router.replace('/(tabs)');
    }
  }, [
    isSignedIn,
    authLoading,
    isOnboardingComplete,
    isProfileReconciled,
    isLoading,
    segments,
    params.preview,
    router,
  ]);

  return <>{children}</>;
}
