/**
 * AUTH GATE — the routing decision, as one pure function.
 *
 * WHY IT LIVES HERE AND NOT INLINE. The render-time cover and the imperative
 * `router.replace` are two consumers of ONE decision, and they were written as
 * two hand-mirrored copies of it. That mirroring is a bug waiting to happen, and
 * both ways of getting it wrong are bad:
 *
 *   · cover WITHOUT a redirect that isn't waiting on anything → a permanently
 *     blank screen. The white screen of death, arrived at from the other side.
 *   · redirect WITHOUT a cover → the flash of protected content this whole fix
 *     exists to remove.
 *
 * So the decision is computed once, here, and both consumers read the same
 * object. The two invariants above are then not a matter of discipline — they're
 * properties this module is tested against, exhaustively, over every state.
 *
 * Pure and dependency-free on purpose: no React, no expo-router, no storage. It
 * takes a description of "who is this and where are they", and returns what
 * should happen. That is what makes it testable in a Node process.
 */

/** Where the user currently is, collapsed to the only distinctions that matter. */
export type GateRoute =
  /** sign-in / sign-up / verify-email. */
  | 'auth'
  /** A legal DOCUMENT (privacy / terms / disclaimer) — readable from anywhere. */
  | 'legalDoc'
  /** The consent gate itself. */
  | 'consentGate'
  | 'onboarding'
  /** Onboarding replayed deliberately by an already-onboarded user (?preview=1). */
  | 'onboardingPreview'
  /** Anything else: the tabs and every pushed screen. */
  | 'app';

export type LegalStatus = 'loading' | 'required' | 'accepted';

export type GateRedirect =
  | '/sign-in'
  | '/legal/consent'
  | '/onboarding'
  | '/(tabs)';

export interface AuthGateInput {
  /** Restoring the session or reading local storage — nothing is decidable yet. */
  booting: boolean;
  isSignedIn: boolean;
  /** Has the login-time cloud profile pull finished? Always resolves, even on failure. */
  isProfileReconciled: boolean;
  legalStatus: LegalStatus;
  isOnboardingComplete: boolean;
  route: GateRoute;
}

export interface AuthGateDecision {
  /** Hide what's on screen: this route isn't permitted, or isn't decidable yet. */
  cover: boolean;
  /** Where to send them. `null` when we're only waiting on async state. */
  redirectTo: GateRedirect | null;
  /** True when the cover is waiting on something, not on a navigation. */
  waiting: boolean;
}

/** Documents are public: signed in or out, mid-onboarding, or from the gate. */
const isPublic = (route: GateRoute) => route === 'auth' || route === 'legalDoc';

export function resolveAuthGate(input: AuthGateInput): AuthGateDecision {
  const { booting, isSignedIn, isProfileReconciled, legalStatus, route } = input;

  // Still booting. Cover anything that isn't public — THIS is the frame the old
  // effect-only version leaked Home through on a cold start.
  if (booting) {
    return { cover: !isPublic(route), redirectTo: null, waiting: true };
  }

  // 1) Not signed in — auth screens and the public documents only.
  if (!isSignedIn) {
    const allowed = isPublic(route);
    return {
      cover: !allowed,
      redirectTo: allowed ? null : '/sign-in',
      waiting: false,
    };
  }

  // 2) Signed in, cloud profile still landing. We genuinely cannot tell
  //    onboarding from tabs yet, so cover whatever expo-router restored rather
  //    than guess — guessing is what flashed onboarding at returning users.
  if (!isProfileReconciled) {
    return { cover: !isPublic(route), redirectTo: null, waiting: true };
  }

  // 3) The legal gate. Until this account accepts the current policies the app
  //    is closed: no onboarding, no tabs, no deep link. Reading the documents is
  //    the one thing allowed through — including from the gate itself.
  if (legalStatus === 'loading') {
    return { cover: route !== 'legalDoc', redirectTo: null, waiting: true };
  }
  if (legalStatus === 'required') {
    const allowed = route === 'consentGate' || route === 'legalDoc';
    return {
      cover: !allowed,
      redirectTo: allowed ? null : '/legal/consent',
      waiting: false,
    };
  }

  // 4) Accepted — onboarding status decides. `legalDoc` stays allowed so a
  //    mid-onboarding tap on "read the full disclaimer" isn't yanked back to the
  //    flow; the document's own back button returns there.
  if (!input.isOnboardingComplete) {
    const allowed =
      route === 'onboarding' || route === 'onboardingPreview' || route === 'legalDoc';
    return {
      cover: !allowed,
      redirectTo: allowed ? null : '/onboarding',
      waiting: false,
    };
  }

  // 5) Onboarded. Only the screens they've finished with are out of place —
  //    `onboardingPreview` is deliberate, so it is left alone.
  const misplaced =
    route === 'onboarding' || route === 'auth' || route === 'consentGate';
  return {
    cover: misplaced,
    redirectTo: misplaced ? '/(tabs)' : null,
    waiting: false,
  };
}

/**
 * Classify expo-router segments into a GateRoute. Split out so the mapping from
 * the router's shape is testable too — an unknown first segment is `app`, i.e.
 * protected, which is the safe default.
 */
export function routeFromSegments(
  segments: readonly string[],
  isPreview: boolean,
): GateRoute {
  const [first, second] = segments;
  if (first === 'sign-in' || first === 'sign-up' || first === 'verify-email') {
    return 'auth';
  }
  if (first === 'legal') return second === 'consent' ? 'consentGate' : 'legalDoc';
  if (first === 'onboarding') return isPreview ? 'onboardingPreview' : 'onboarding';
  // Unknown → PROTECTED. A screen added without touching this file must default
  // to guarded, never to public; getting that backwards leaks the next feature.
  return 'app';
}
