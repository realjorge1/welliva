/**
 * BILLING CONTEXT — the React face of the entitlement store.
 *
 * WHERE THIS SITS AND WHY
 *
 * Above AppProvider, below SupabaseAuthProvider. It needs the user id (so
 * purchases attach to the account, not the device), and AppProvider's children
 * need to be able to gate on a tier — so it belongs between them.
 *
 * It owns no truth of its own. services/billing/entitlement.ts is the source;
 * this subscribes and re-renders. That split is what lets PlanSync and the
 * Gozlin transports — which have no React in scope — read the same answer.
 *
 * WHAT IT WIRES UP
 *  1. Hydrate the cached entitlement before first paint (offline paid users).
 *  2. Configure the SDK once auth resolves.
 *  3. logIn / logOut as the account changes.
 *  4. Listen for store-side changes (renewal, cancellation, refund).
 *  5. Re-check on foreground — catches a subscription bought or cancelled in
 *     the Play app while Welliva was backgrounded.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/components/SupabaseAuthProvider";
import {
  allows,
  configureBilling,
  effectiveTier,
  getEntitlement,
  getPlanOptions,
  hasPaidAccess,
  hydrateEntitlement,
  hydrateTrial,
  identifyUser,
  installEntitlementListener,
  isBillingAvailable,
  isGatingActive,
  purchasePlan,
  refreshEntitlement,
  restorePurchases,
  activeTrial,
  signOutBilling,
  maybeStartInsightTrial,
  subscribe,
  subscribeTrial,
  trialHoursLeft,
  type Entitlement,
  type FeatureId,
  type PlanOption,
  type PurchaseOutcome,
  type Tier,
} from "@/services/billing";
import { setTrialClaimer } from "@/services/billing";
import { setSyncPushGate } from "@/services/sync/SyncEngine";
import { WellivaApi } from "@/services/api";

interface BillingContextType {
  /**
   * THE tier to gate on: the user's real tier, or `pro` where gating is off
   * (Expo Go, web, any build with no RevenueCat key — see gating.ts).
   *
   * Use it for graded limits — history windows, habit slots, daily caps. For a
   * binary lock use {@link BillingContextType.allows}, which knows which tier
   * each feature actually needs.
   */
  tier: Tier;
  /**
   * The real entitlement — "is this user actually paying, and for what?"
   *
   * Use these for anything that REPORTS subscription status: the upgrade
   * screen's current-plan card, a renewal date, a "thanks for subscribing" note.
   * Do NOT branch feature locks on them, or a free user in a build with no store
   * keys gets locked out of a storefront that cannot sell them anything.
   */
  isPro: boolean;
  isPlus: boolean;
  isSubscriber: boolean;
  /** Full snapshot — `source` tells you whether it's confirmed or cached. */
  entitlement: Entitlement;
  /** May this user use `feature` right now? The check every lock makes. */
  allows: (feature: FeatureId) => boolean;
  /** On any paid tier (or gating off). For upsell banners, not feature locks. */
  hasPaidAccess: boolean;
  /**
   * Whether the paid tiers are enforced at all in this session. UI that offers
   * to upgrade should hide itself when this is false — there is nothing to sell.
   */
  gatingActive: boolean;
  /** True until the cached entitlement has been read from disk. */
  isHydrating: boolean;

  /**
   * Whether a 48-hour insight trial is running right now.
   *
   * Distinct from `isSubscriber`, which stays FALSE throughout: nobody is paying
   * and nothing renews. UI that reports subscription status must not claim
   * otherwise, and UI that sells should still sell — a trial is the strongest
   * possible moment to ask, not a reason to go quiet.
   */
  isTrialing: boolean;
  /** Whole hours left in the trial window. 0 when none is running. */
  trialHoursLeft: number;
  /**
   * Open the trial window if this user has earned one. Called from the surface
   * that first has a real insight to show; a no-op every other time.
   * Returns true only on the call that actually started it.
   */
  startInsightTrial: () => Promise<boolean>;
  /** False in Expo Go, on web, or without a RevenueCat key. */
  isAvailable: boolean;

  /** Plus/Pro × monthly/annual, for the upgrade screen. Loaded by `loadPlans`. */
  plans: PlanOption[];
  isLoadingPlans: boolean;
  loadPlans: () => Promise<void>;

  purchase: (plan: PlanOption) => Promise<PurchaseOutcome>;
  restore: () => Promise<{ ok: boolean; tier: Tier; message?: string }>;
  refresh: () => Promise<void>;

  /**
   * Open the upgrade screen. Pass the lock that sent the user, so the screen can
   * lead with the right tier and the right sentence — and so you can see in
   * analytics which lock actually drives upgrades, the whole point of having
   * several.
   */
  openUpgrade: (source?: FeatureId) => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [entitlement, setEntitlementState] = useState<Entitlement>(getEntitlement);
  const [isHydrating, setIsHydrating] = useState(true);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  const configuredFor = useRef<string | null | undefined>(undefined);

  // 1 ── Mirror the module store into React state.
  useEffect(() => subscribe(setEntitlementState), []);

  // 1a ── The insight trial changes what `effectiveTier()` answers without
  //       touching the entitlement, so it needs its own nudge or the React tree
  //       would keep rendering the pre-trial tier until something else changed.
  const [trialTick, setTrialTick] = useState(0);
  useEffect(() => subscribeTrial(() => setTrialTick((n) => n + 1)), []);

  // 1b ── Teach the sync engine who may upload. Cloud backup + multi-device sync
  //       is a paid feature (Plus and up); the engine can't import billing
  //       directly (it is unit-tested without a react-native runtime), so the
  //       predicate is injected. It reads live module state on every call, so
  //       this closure stays correct for the life of the app and needs no
  //       dependencies — an upgrade takes effect on the very next write.
  useEffect(() => {
    setSyncPushGate(() => allows("sync"));
    return () => setSyncPushGate(null);
  }, []);

  // 1c ── Teach the trial store how to reach the backend. Injected rather than
  //       imported so services/billing stays testable without a React Native
  //       runtime (WellivaApi pulls in expo/fetch and the Supabase client).
  //       Until /v1/billing/trial/claim is deployed this throws a 404 on every
  //       call and the trial store falls back to a local grant — which is the
  //       behaviour that shipped, so nothing regresses while we wait.
  useEffect(() => {
    setTrialClaimer(async () => {
      const res = await WellivaApi.claimInsightTrial();
      return res?.expiresAt ? res : null;
    });
    return () => setTrialClaimer(null);
  }, []);

  // 2 ── Hydrate the cache before anything else, so a paying user who opens the
  //      app offline is on their tier on the first frame instead of flashing free.
  useEffect(() => {
    let alive = true;
    // Both, together: a user mid-trial who cold-starts offline must be on Pro on
    // the first frame for the same reason a paying user must be on their tier —
    // a flash of the locked experience reads as the app taking something away.
    void Promise.all([hydrateEntitlement(), hydrateTrial()]).finally(() => {
      if (alive) setIsHydrating(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 3 ── Configure once auth has resolved, then track account changes.
  //      Keyed on user id: a token refresh must not reconfigure the SDK.
  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (configuredFor.current === uid) return;

    const first = configuredFor.current === undefined;
    configuredFor.current = uid;

    void (async () => {
      if (first) {
        await configureBilling(uid);
        return;
      }
      // Account switched after configure — transfer or detach.
      if (uid) await identifyUser(uid);
      else await signOutBilling();
    })();
  }, [user?.id, authLoading]);

  // 4 ── Store-side changes (renewals, cancellations, refunds).
  useEffect(() => {
    if (authLoading) return;
    return installEntitlementListener();
  }, [authLoading]);

  // 5 ── Re-check on foreground. Someone can subscribe or cancel in the Play
  //      app without ever returning here through a purchase flow.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") void refreshEntitlement();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  const loadPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    try {
      setPlans(await getPlanOptions());
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  const purchase = useCallback(async (plan: PlanOption) => purchasePlan(plan), []);

  /**
   * Grant the insight trial, if it is owed.
   *
   * Reads subscription state through the live module functions rather than the
   * rendered snapshot, so a caller firing this during the same commit that
   * resolves an entitlement cannot hand a paying user a trial by racing it.
   */
  const startInsightTrial = useCallback(
    () =>
      maybeStartInsightTrial({
        isSubscriber: hasPaidAccess(),
        gatingActive: isGatingActive(),
      }),
    [],
  );

  const restore = useCallback(async () => restorePurchases(), []);
  const refresh = useCallback(async () => refreshEntitlement(), []);

  const openUpgrade = useCallback(
    (source?: FeatureId) => {
      router.navigate({
        pathname: "/upgrade",
        params: source ? { source } : {},
      } as never);
    },
    [router],
  );

  const value = useMemo<BillingContextType>(
    () => ({
      // All recomputed from the same `entitlement` snapshot the dev override
      // flows through (see entitlement.ts `emit()`), so flipping the developer
      // tier switch re-renders every gated screen.
      tier: effectiveTier(),
      isPro: entitlement.tier === "pro",
      isPlus: entitlement.tier === "plus",
      isSubscriber: entitlement.tier !== "free",
      allows,
      hasPaidAccess: hasPaidAccess(),
      gatingActive: isGatingActive(),
      entitlement,
      isHydrating,
      isTrialing: activeTrial() !== null,
      trialHoursLeft: trialHoursLeft(),
      startInsightTrial,
      isAvailable: isBillingAvailable(),
      plans,
      isLoadingPlans,
      loadPlans,
      purchase,
      restore,
      refresh,
      openUpgrade,
    }),
    [
      entitlement,
      // The tick itself is the dependency: trial start/expiry changes what
      // effectiveTier() returns without changing `entitlement`.
      trialTick,
      startInsightTrial,
      isHydrating,
      plans,
      isLoadingPlans,
      loadPlans,
      purchase,
      restore,
      refresh,
      openUpgrade,
    ],
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingContextType {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within a BillingProvider");
  return ctx;
}

/**
 * Narrow convenience for the common case — `const tier = useTier()`.
 * Still re-renders with the provider, but reads better at call sites that only
 * need the tier to compute a limit.
 */
export function useTier(): Tier {
  return useBilling().tier;
}

/** "May I show this?" for a single feature, without destructuring the context. */
export function useAllows(feature: FeatureId): boolean {
  return useBilling().allows(feature);
}
