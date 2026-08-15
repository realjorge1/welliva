/**
 * AUTH GATE — the two invariants, checked over the whole state space.
 *
 * This is the test that replaces "cold-start on a throttled device and step
 * through the recording frame by frame". A screen recording proves one path;
 * this proves all 288 of them, and it runs on every commit.
 *
 * The two properties that matter, and what breaking each looks like to a user:
 *
 *   NO LEAK    — a route the user isn't allowed on is ALWAYS covered. Breaking
 *                this is the original bug: a signed-out user seeing the Home
 *                screen, with real numbers on it, before being bounced.
 *   NO DEADEND — a cover is only ever up because we're navigating or because
 *                we're waiting on something that resolves. Breaking this is a
 *                permanently blank screen — the white screen of death reached
 *                from the opposite direction.
 *
 * The visual check on a device is still worth doing once. It is no longer the
 * only thing standing between this logic and a regression.
 */
import { describe, expect, it } from "vitest";

import {
  resolveAuthGate,
  routeFromSegments,
  type AuthGateInput,
  type GateRoute,
  type LegalStatus,
} from "../auth/authGate";

const ROUTES: GateRoute[] = [
  "auth",
  "legalDoc",
  "consentGate",
  "onboarding",
  "onboardingPreview",
  "app",
];
const LEGAL: LegalStatus[] = ["loading", "required", "accepted"];

/** Every reachable combination — 2×2×2×3×6 = 144, ×2 for booting = 288. */
function* stateSpace(): Generator<AuthGateInput> {
  for (const booting of [false, true])
    for (const isSignedIn of [false, true])
      for (const isProfileReconciled of [false, true])
        for (const legalStatus of LEGAL)
          for (const isOnboardingComplete of [false, true])
            for (const route of ROUTES)
              yield {
                booting,
                isSignedIn,
                isProfileReconciled,
                legalStatus,
                isOnboardingComplete,
                route,
              };
}

const ALL = [...stateSpace()];
const describeState = (s: AuthGateInput) =>
  `${s.booting ? "booting " : ""}${s.isSignedIn ? "signed-in" : "signed-out"}` +
  `/${s.isProfileReconciled ? "reconciled" : "reconciling"}` +
  `/legal:${s.legalStatus}/${s.isOnboardingComplete ? "onboarded" : "new"} @ ${s.route}`;

/** Routes a user in this state is genuinely entitled to see. */
function permitted(s: AuthGateInput): GateRoute[] {
  if (s.booting) return ["auth", "legalDoc"];
  if (!s.isSignedIn) return ["auth", "legalDoc"];
  if (!s.isProfileReconciled) return ["auth", "legalDoc"];
  if (s.legalStatus === "loading") return ["legalDoc"];
  if (s.legalStatus === "required") return ["consentGate", "legalDoc"];
  if (!s.isOnboardingComplete) return ["onboarding", "onboardingPreview", "legalDoc"];
  return ["app", "legalDoc", "onboardingPreview"];
}

describe("the state space is actually covered", () => {
  it("enumerates every combination", () => {
    expect(ALL).toHaveLength(288);
  });
});

describe("INVARIANT: no protected route is ever left uncovered", () => {
  it("covers every route the user isn't entitled to, in every state", () => {
    const leaks: string[] = [];
    for (const s of ALL) {
      const allowed = permitted(s).includes(s.route);
      const { cover } = resolveAuthGate(s);
      if (!allowed && !cover) leaks.push(describeState(s));
    }
    expect(leaks).toEqual([]);
  });

  it("never covers a route the user IS entitled to", () => {
    // The opposite failure: a cover over a legitimate screen is a dead app.
    const overreach: string[] = [];
    for (const s of ALL) {
      const allowed = permitted(s).includes(s.route);
      const { cover } = resolveAuthGate(s);
      if (allowed && cover) overreach.push(describeState(s));
    }
    expect(overreach).toEqual([]);
  });
});

describe("INVARIANT: a cover always has a way out", () => {
  it("is never up without either a redirect or something to wait for", () => {
    const deadEnds: string[] = [];
    for (const s of ALL) {
      const { cover, redirectTo, waiting } = resolveAuthGate(s);
      if (cover && !redirectTo && !waiting) deadEnds.push(describeState(s));
    }
    expect(deadEnds).toEqual([]);
  });

  it("never redirects without covering first", () => {
    // A redirect with no cover IS the flash — the frame the user sees content
    // they shouldn't, on the way out of it.
    const flashes: string[] = [];
    for (const s of ALL) {
      const { cover, redirectTo } = resolveAuthGate(s);
      if (redirectTo && !cover) flashes.push(describeState(s));
    }
    expect(flashes).toEqual([]);
  });

  it("never redirects to a route it would immediately bounce off again", () => {
    // Guards against a redirect loop: sign-in → onboarding → sign-in → …
    const loops: string[] = [];
    const ROUTE_OF: Record<string, GateRoute> = {
      "/sign-in": "auth",
      "/legal/consent": "consentGate",
      "/onboarding": "onboarding",
      "/(tabs)": "app",
    };
    for (const s of ALL) {
      const { redirectTo } = resolveAuthGate(s);
      if (!redirectTo) continue;
      const landed = resolveAuthGate({ ...s, route: ROUTE_OF[redirectTo] });
      if (landed.redirectTo && landed.redirectTo !== redirectTo) {
        loops.push(`${describeState(s)} → ${redirectTo} → ${landed.redirectTo}`);
      }
    }
    expect(loops).toEqual([]);
  });
});

/* ───────────────────────── the specific journeys ───────────────────────────*/

const base: AuthGateInput = {
  booting: false,
  isSignedIn: true,
  isProfileReconciled: true,
  legalStatus: "accepted",
  isOnboardingComplete: true,
  route: "app",
};

describe("cold start, signed out", () => {
  it("covers the restored Home route and sends them to sign-in", () => {
    // THE ORIGINAL BUG. Expo Router restores `(tabs)/index` on a cold start, so
    // without a render-time cover the Home screen painted before the bounce.
    const gate = resolveAuthGate({
      ...base,
      booting: true,
      isSignedIn: false,
      route: "app",
    });
    expect(gate.cover).toBe(true);

    // …and once booting finishes, the redirect fires — still covered.
    const settled = resolveAuthGate({ ...base, isSignedIn: false, route: "app" });
    expect(settled).toEqual({
      cover: true,
      redirectTo: "/sign-in",
      waiting: false,
    });
  });

  it("leaves the sign-in screen itself alone", () => {
    const gate = resolveAuthGate({ ...base, isSignedIn: false, route: "auth" });
    expect(gate).toEqual({ cover: false, redirectTo: null, waiting: false });
  });

  it("lets a signed-out user read the legal documents", () => {
    // App Store review does exactly this, from the sign-in screen.
    for (const booting of [true, false]) {
      const gate = resolveAuthGate({
        ...base,
        booting,
        isSignedIn: false,
        route: "legalDoc",
      });
      expect(gate.cover).toBe(false);
    }
  });
});

describe("returning user on a fresh device", () => {
  it("waits rather than flashing onboarding before the cloud profile lands", () => {
    // The reason `isProfileReconciled` exists: local bio is empty on a new
    // device, so deciding early shows onboarding to someone already onboarded.
    const gate = resolveAuthGate({
      ...base,
      isProfileReconciled: false,
      isOnboardingComplete: false,
      route: "app",
    });
    expect(gate).toEqual({ cover: true, redirectTo: null, waiting: true });
  });

  it("routes to the tabs once the profile arrives", () => {
    const gate = resolveAuthGate({ ...base, route: "app" });
    expect(gate).toEqual({ cover: false, redirectTo: null, waiting: false });
  });
});

describe("the legal gate", () => {
  it("is a hard stop — no tabs, no onboarding, no deep link", () => {
    for (const route of ["app", "onboarding", "onboardingPreview"] as GateRoute[]) {
      const gate = resolveAuthGate({ ...base, legalStatus: "required", route });
      expect(gate.cover, route).toBe(true);
      expect(gate.redirectTo, route).toBe("/legal/consent");
    }
  });

  it("still lets the documents through — including from the gate itself", () => {
    const gate = resolveAuthGate({
      ...base,
      legalStatus: "required",
      route: "legalDoc",
    });
    expect(gate.cover).toBe(false);
  });

  it("holds everything while the acceptance record is still being read", () => {
    const gate = resolveAuthGate({ ...base, legalStatus: "loading", route: "app" });
    expect(gate).toEqual({ cover: true, redirectTo: null, waiting: true });
  });

  it("sits BEFORE onboarding, which is where the medical questions are", () => {
    // Onboarding collects pregnancy, conditions and medications — the policy has
    // to be accepted before the first of those questions is asked.
    const gate = resolveAuthGate({
      ...base,
      legalStatus: "required",
      isOnboardingComplete: false,
      route: "onboarding",
    });
    expect(gate.redirectTo).toBe("/legal/consent");
  });
});

describe("onboarding", () => {
  it("sends a new account there and lets it stay", () => {
    expect(
      resolveAuthGate({ ...base, isOnboardingComplete: false, route: "app" }).redirectTo,
    ).toBe("/onboarding");
    expect(
      resolveAuthGate({ ...base, isOnboardingComplete: false, route: "onboarding" }),
    ).toEqual({ cover: false, redirectTo: null, waiting: false });
  });

  it("bounces a finished user off it, but NOT out of a deliberate preview", () => {
    expect(resolveAuthGate({ ...base, route: "onboarding" }).redirectTo).toBe("/(tabs)");
    expect(resolveAuthGate({ ...base, route: "onboardingPreview" })).toEqual({
      cover: false,
      redirectTo: null,
      waiting: false,
    });
  });

  it("doesn't yank someone back from a disclaimer opened mid-flow", () => {
    // The document's own back button returns them to onboarding.
    const gate = resolveAuthGate({
      ...base,
      isOnboardingComplete: false,
      route: "legalDoc",
    });
    expect(gate).toEqual({ cover: false, redirectTo: null, waiting: false });
  });

  it("moves them to the tabs the moment onboarding completes", () => {
    const gate = resolveAuthGate({ ...base, route: "onboarding" });
    expect(gate.cover).toBe(true);
    expect(gate.redirectTo).toBe("/(tabs)");
  });
});

describe("routeFromSegments", () => {
  it("maps the router's shape onto the gate's vocabulary", () => {
    expect(routeFromSegments(["sign-in"], false)).toBe("auth");
    expect(routeFromSegments(["sign-up"], false)).toBe("auth");
    expect(routeFromSegments(["verify-email"], false)).toBe("auth");
    expect(routeFromSegments(["legal", "consent"], false)).toBe("consentGate");
    expect(routeFromSegments(["legal", "privacy"], false)).toBe("legalDoc");
    expect(routeFromSegments(["onboarding"], false)).toBe("onboarding");
    expect(routeFromSegments(["onboarding"], true)).toBe("onboardingPreview");
    expect(routeFromSegments(["(tabs)"], false)).toBe("app");
  });

  it("treats anything unrecognised as protected", () => {
    // A new screen added without touching this file must default to GUARDED,
    // never to public. Getting this backwards leaks the next feature.
    expect(routeFromSegments([], false)).toBe("app");
    expect(routeFromSegments(["some-future-screen"], false)).toBe("app");
    expect(routeFromSegments(["settings"], false)).toBe("app");
  });
});
