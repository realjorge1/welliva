/**
 * BILLING CONTEXT — the React face of the entitlement store.
 *
 * WHERE THIS SITS AND WHY
 *
 * Above AppProvider, below SupabaseAuthProvider. It needs the user id (so
 * purchases attach to the account, not the device), and AppProvider's children
 * need to be able to gate on Pro — so it belongs between them.
 *
 * It owns no truth of its own. services/billing/entitlement.ts is the source;
 * this subscribes and re-renders. That split is what lets PlanSync and the
 * Gozlin transports — which have no React in scope — read the same answer.
 *
 * WHAT IT WIRES UP
 *  1. Hydrate the cached entitlement before first paint (offline Pro users).
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
  allowPro,
  configureBilling,
  getEntitlement,
  getProPackages,
  hydrateEntitlement,
  identifyUser,
  installEntitlementListener,
  isBillingAvailable,
  isGatingActive,
  purchasePro,
  refreshEntitlement,
  restorePurchases,
  signOutBilling,
  subscribe,
  type Entitlement,
  type ProPackage,
  type PurchaseOutcome,
} from "@/services/billing";
import { setSyncPushGate } from "@/services/sync/SyncEngine";

interface BillingContextType {
  /**
   * The real entitlement — "is this user actually paying?"
   *
   * Use this for anything that REPORTS subscription status: the paywall, the
   * Settings row, a "thanks for subscribing" note. Do NOT branch feature locks
   * on it; use {@link BillingContextType.hasProAccess} for that, or a free user
   * in a build with no store keys gets locked out of a paywall that cannot sell
   * them anything.
   */
  isPro: boolean;
  /** Full snapshot — `source` tells you whether it's confirmed or cached. */
  entitlement: Entitlement;
  /**
   * May this user use Pro features right now? THE flag every feature lock reads.
   *
   * Differs from `isPro` in exactly one way, and it is the way that matters: it
   * honours the fail-open rule in services/billing/gating.ts. When no RevenueCat
   * key is configured — Expo Go, web, any build predating the store accounts —
   * gating is off and this is `true` for everyone, because a purchase is
   * impossible there and locking would only break development to protect revenue
   * that cannot be collected. Paths that cost real money are additionally
   * enforced server-side (docs/monetization/setup.md Part 6).
   */
  hasProAccess: boolean;
  /**
   * Whether the paid tier is enforced at all in this session. UI that offers to
   * upgrade should hide itself when this is false — there is nothing to sell.
   */
  gatingActive: boolean;
  /** True until the cached entitlement has been read from disk. */
  isHydrating: boolean;
  /** False in Expo Go, on web, or without a RevenueCat key. */
  isAvailable: boolean;

  /** Packages for the paywall. Loaded on demand by `loadPackages`. */
  packages: ProPackage[];
  isLoadingPackages: boolean;
  loadPackages: () => Promise<void>;

  purchase: (pkg: ProPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<{ ok: boolean; isPro: boolean; message?: string }>;
  refresh: () => Promise<void>;

  /**
   * Open the paywall. Pass a `source` so you can see in analytics which lock
   * actually drives upgrades — the whole point of having several.
   */
  openPaywall: (source?: string) => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [entitlement, setEntitlementState] = useState<Entitlement>(getEntitlement);
  const [isHydrating, setIsHydrating] = useState(true);
  const [packages, setPackages] = useState<ProPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  const configuredFor = useRef<string | null | undefined>(undefined);

  // 1 ── Mirror the module store into React state.
  useEffect(() => subscribe(setEntitlementState), []);

  // 1b ── Teach the sync engine who may upload. Cloud backup + multi-device sync
  //       is a paid feature; the engine can't import billing directly (it is
  //       unit-tested without a react-native runtime), so the predicate is
  //       injected. `allowPro` reads live module state, so this closure stays
  //       correct for the life of the app and needs no dependencies — an
  //       upgrade takes effect on the very next write.
  useEffect(() => {
    setSyncPushGate(allowPro);
    return () => setSyncPushGate(null);
  }, []);

  // 2 ── Hydrate the cache before anything else, so a paying user who opens the
  //      app offline is Pro on the first frame instead of flashing the free tier.
  useEffect(() => {
    let alive = true;
    void hydrateEntitlement().finally(() => {
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

  const loadPackages = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      setPackages(await getProPackages());
    } finally {
      setIsLoadingPackages(false);
    }
  }, []);

  const purchase = useCallback(async (pkg: ProPackage) => {
    return purchasePro(pkg);
  }, []);

  const restore = useCallback(async () => restorePurchases(), []);
  const refresh = useCallback(async () => refreshEntitlement(), []);

  const openPaywall = useCallback(
    (source?: string) => {
      router.push({ pathname: "/paywall", params: source ? { source } : {} } as never);
    },
    [router],
  );

  const value = useMemo<BillingContextType>(
    () => ({
      isPro: entitlement.isPro,
      // Recomputed from the same `entitlement` snapshot the dev override flows
      // through (see entitlement.ts `emit()`), so flipping Settings → Developer
      // re-renders this exactly like it re-renders `isPro`.
      hasProAccess: allowPro(),
      gatingActive: isGatingActive(),
      entitlement,
      isHydrating,
      isAvailable: isBillingAvailable(),
      packages,
      isLoadingPackages,
      loadPackages,
      purchase,
      restore,
      refresh,
      openPaywall,
    }),
    [
      entitlement,
      isHydrating,
      packages,
      isLoadingPackages,
      loadPackages,
      purchase,
      restore,
      refresh,
      openPaywall,
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
 * Narrow convenience for the common case — `const isPro = useIsPro()`.
 * Still re-renders with the provider, but reads better at call sites that only
 * need the flag.
 *
 * Reports the real subscription state. Feature locks should almost always use
 * {@link useProAccess} instead — see the note on `hasProAccess`.
 */
export function useIsPro(): boolean {
  return useBilling().isPro;
}

/**
 * THE hook feature locks should call: "may this render/run as Pro right now?"
 * Honours the fail-open rule, unlike `useIsPro`.
 */
export function useProAccess(): boolean {
  return useBilling().hasProAccess;
}
