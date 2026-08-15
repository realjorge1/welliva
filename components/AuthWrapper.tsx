/**
 * AUTH WRAPPER — required-account routing
 *
 * The app requires a signed-in account. This wrapper enforces the flow:
 *   not signed in            → /sign-in (auth + the legal documents are all
 *                              that's reachable)
 *   signed in, profile not
 *     yet reconciled          → wait (don't route yet — see below)
 *   signed in, legal not
 *     accepted                → /legal/consent (a hard stop — see below)
 *   signed in, not onboarded  → /onboarding
 *   signed in, onboarded      → /(tabs)
 *
 * The "wait for reconcile" step matters: a returning user signing in on a fresh
 * device has no local bio yet, so without waiting we'd flash onboarding before
 * their cloud profile arrives. `isProfileReconciled` flips true once the
 * login-time pull+reconcile finishes (AppContext), and only then do we decide
 * onboarding-vs-tabs.
 *
 * The legal gate sits BEFORE onboarding on purpose: onboarding's very first
 * screens collect pregnancy status, medical conditions, medications and
 * injuries, so the policy has to be accepted before a single one of those
 * questions is asked. The gate's own screen and the three documents are the
 * only routes an un-accepted user may reach.
 *
 * ── WHY THE GATE IS COMPUTED DURING RENDER ──────────────────────────────────
 *
 * The bug this closes: the routing decision used to live ONLY in an effect, and
 * effects run after paint. Expo Router's cold-start route is `(tabs)/index`, so
 * a signed-out user rendered the full Home screen — real data, real numbers —
 * for at least one frame before being bounced to sign-in.
 *
 * The textbook fix is `return <Redirect href="/sign-in" />` instead of children.
 * That is correct for a guard INSIDE a navigator, and wrong here: this wrapper
 * sits ABOVE the <Stack>. Returning something else unmounts the navigator, and
 * expo-router's <Redirect> drives `router.replace` from `useFocusEffect` — it
 * needs the very navigator we'd have just torn down. (It would also throw for
 * want of a navigation context.)
 *
 * So the decision moves to render time while the navigator stays mounted:
 * `gateClosed` is computed in the render body, and when it's true an opaque
 * cover ships in the SAME COMMIT as the children. There is no frame in which
 * protected content is visible, because the cover is never one paint behind.
 * The effect below keeps doing what only an effect can — the imperative
 * `router.replace` that actually moves the user.
 *
 * Belt and braces: the native splash screen (app/_layout.tsx) stays up until
 * fonts AND auth have resolved, so the cold-start window is covered natively
 * before this component even renders.
 */

import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from './SupabaseAuthProvider';
import { resolveAuthGate, routeFromSegments } from './auth/authGate';
import { useLegalGate } from './legal';
import { useColors } from './ui';
import { useProfile, useSystem } from '../contexts/AppContext';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading: authLoading } = useAuth();
  const { isOnboardingComplete } = useProfile();
  const { isLoading, isProfileReconciled } = useSystem();
  const { status: legalStatus } = useLegalGate();
  const { colors } = useColors();
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ preview?: string }>();

  // ── ONE decision, two consumers. The cover below and the redirect in the
  //    effect both read this same object, so they cannot drift apart into
  //    either failure mode: a cover with nowhere to go (a blank screen), or a
  //    redirect with no cover (the flash this fix exists to remove).
  //    See components/auth/authGate.ts — pure, and exhaustively tested.
  const booting = isLoading || authLoading;
  const route = routeFromSegments(
    segments as readonly string[],
    // Preview mode (?preview=1): an already-onboarded user is intentionally
    // replaying onboarding — don't bounce them back to the tabs.
    params.preview === '1',
  );
  const gate = resolveAuthGate({
    booting,
    isSignedIn,
    isProfileReconciled,
    legalStatus,
    isOnboardingComplete,
    route,
  });

  useEffect(() => {
    // The imperative half — the only part that genuinely needs an effect. The
    // decision itself was already made, during render.
    if (gate.redirectTo) router.replace(gate.redirectTo as never);
  }, [gate.redirectTo, router]);

  return (
    <View style={styles.flex}>
      {children}
      {gate.cover ? (
        /*
         * The cover. Opaque, full-bleed, and it swallows touches — a user can't
         * tap through to a screen they're not allowed on, even for the frame or
         * two the imperative replace takes to land.
         *
         * The spinner only appears once boot is done, so a normal cold start is
         * a still, calm surface rather than a flashed loader.
         */
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {!booting ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
