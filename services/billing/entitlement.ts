/**
 * ENTITLEMENT STORE — "is this user Pro?", answerable synchronously.
 *
 * WHY THIS EXISTS AS A PLAIN MODULE AND NOT A REACT CONTEXT
 *
 * The things that most need to ask the question aren't components. PlanSync,
 * RemoteGozlinProvider and GozlinFoodAnalyst are pure async services with no
 * React in scope — the same design note at the top of PlanSync.ts. Threading an
 * `isPro` argument down through every one of them would put a billing concern
 * into signatures that have nothing to do with billing, and would have to be
 * re-plumbed every time a new AI path appears.
 *
 * So the truth lives here, in module scope: BillingContext writes it, and
 * anything at all can read it with a synchronous call. The React context is a
 * thin subscriber on top for rendering.
 *
 * OFFLINE IS THE CASE THIS FILE IS REALLY ABOUT
 *
 * RevenueCat needs the network to confirm an entitlement. A paying user who
 * opens the app on a plane must not be silently downgraded — that is the single
 * most infuriating subscription bug there is. So the last known entitlement is
 * persisted with its expiry, hydrated before the SDK has answered, and honoured
 * until the expiry actually passes. We trust the cache and let the network
 * correct it, never the other way round.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Cached entitlement snapshot. Persisted so it survives a cold offline start. */
export interface Entitlement {
  /** Whether the `pro` entitlement was active as of `checkedAt`. */
  isPro: boolean;
  /**
   * ISO expiry of the current period, when known. `null` for a lifetime grant
   * or when the store didn't report one — both mean "no expiry to enforce".
   */
  expiresAt: string | null;
  /** ISO timestamp of the last successful read from RevenueCat. */
  checkedAt: string | null;
  /**
   * How we know. `store` = confirmed with RevenueCat this session.
   * `cache` = restored from disk, not yet reconfirmed.
   * `unknown` = never resolved (billing off, or first launch offline).
   */
  source: "store" | "cache" | "unknown";
}

const STORAGE_KEY = "@welliva_entitlement";
const DEV_OVERRIDE_KEY = "@welliva_entitlement_dev";

export const FREE: Entitlement = {
  isPro: false,
  expiresAt: null,
  checkedAt: null,
  source: "unknown",
};

let current: Entitlement = FREE;

/**
 * DEV-ONLY tier switch. `null` = no override, use the real entitlement.
 *
 * Every lock in the app has to be exercisable before the RevenueCat account
 * exists — otherwise the paywall and the gated screens are written blind and
 * first get tested during store review, which is the worst possible time. This
 * lets Settings → Developer flip the whole app between tiers instantly.
 *
 * Stripped in release: the setter no-ops and the getter is never consulted when
 * `__DEV__` is false, so a production bundle cannot be talked into granting Pro.
 */
let devOverride: boolean | null = null;

type Listener = (e: Entitlement) => void;
const listeners = new Set<Listener>();

/** True when a cached entitlement is still inside its paid period. */
function stillValid(e: Entitlement): boolean {
  if (!e.isPro) return false;
  if (!e.expiresAt) return true; // lifetime / no expiry reported
  return new Date(e.expiresAt).getTime() > Date.now();
}

/**
 * The current entitlement. Synchronous, safe to call from anywhere, and always
 * returns something — `FREE` before hydration.
 */
export function getEntitlement(): Entitlement {
  if (__DEV__ && devOverride !== null) {
    // Report the override through the same shape the UI already reads, so
    // flipping the dev switch re-renders every gated screen. Without this the
    // React tree and `isPro()` would disagree — components would show the free
    // tier while services behaved as Pro.
    return { ...current, isPro: devOverride, expiresAt: null, source: "unknown" };
  }
  return current;
}

/**
 * The one question the rest of the app asks. Expiry is re-checked on every call
 * so a subscription that lapses while the app sits open stops granting access
 * without needing a network round-trip to notice.
 */
export function isPro(): boolean {
  if (__DEV__ && devOverride !== null) return devOverride;
  return stillValid(current);
}

/**
 * Force the tier in development. Pass `null` to go back to the real entitlement.
 * No-ops in release builds.
 */
export async function setDevProOverride(value: boolean | null): Promise<void> {
  if (!__DEV__) return;
  devOverride = value;
  emit();
  try {
    if (value === null) await AsyncStorage.removeItem(DEV_OVERRIDE_KEY);
    else await AsyncStorage.setItem(DEV_OVERRIDE_KEY, value ? "pro" : "free");
  } catch {
    /* best-effort — the in-memory override still applies this session */
  }
}

/** The active dev override, or `null` when the real entitlement is in force. */
export function getDevProOverride(): boolean | null {
  return __DEV__ ? devOverride : null;
}

/**
 * Gate for anything that costs money to serve — the Haiku-backed endpoints.
 *
 * Deliberately fails OPEN when billing is not configured: a build with no
 * RevenueCat key (Expo Go, web, a dev build made before the account existed)
 * behaves exactly as the app did before billing was introduced. Locking those
 * builds out would break every developer's machine to guard revenue that cannot
 * be collected there anyway.
 */
export function canUseAI(isBillingConfigured: boolean): boolean {
  return !isBillingConfigured || isPro();
}

/** Subscribe to changes. Returns an unsubscribe fn. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  // Emit through getEntitlement() so subscribers see the dev override too —
  // `current` alone would leak the real tier past the switch.
  const snapshot = getEntitlement();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (e) {
      console.warn("[billing] entitlement listener threw:", e);
    }
  });
}

/**
 * Record a fresh entitlement from RevenueCat and persist it.
 * Best-effort persistence: a storage failure must not lose the in-memory truth.
 */
export async function setEntitlement(
  next: Omit<Entitlement, "source" | "checkedAt">,
): Promise<void> {
  current = {
    ...next,
    checkedAt: new Date().toISOString(),
    source: "store",
  };
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn("[billing] failed to persist entitlement:", e);
  }
}

/**
 * Load the last known entitlement from disk. Call once at startup, before the
 * SDK has had a chance to answer, so the first render of a paying user is
 * already Pro rather than flashing the free tier.
 *
 * An expired cache is dropped rather than trusted.
 */
export async function hydrateEntitlement(): Promise<Entitlement> {
  if (__DEV__) {
    // Restore the dev tier switch first, so a reload doesn't silently drop you
    // back to the real tier mid-way through testing a lock.
    try {
      const flag = await AsyncStorage.getItem(DEV_OVERRIDE_KEY);
      if (flag === "pro") devOverride = true;
      else if (flag === "free") devOverride = false;
    } catch {
      /* best-effort */
    }
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Entitlement;
      current = stillValid(parsed)
        ? { ...parsed, source: "cache" }
        : { ...FREE, checkedAt: parsed.checkedAt };
    }
  } catch (e) {
    console.warn("[billing] failed to hydrate entitlement:", e);
  }
  // Emit unconditionally: subscribers built their initial state before hydration
  // ran, so they need the answer even when there was nothing cached to read (a
  // dev override with no stored entitlement is exactly that case).
  emit();
  return getEntitlement();
}

/**
 * Clear on sign-out, so the next account on this device never inherits the
 * previous one's access. Called from BillingContext alongside Purchases.logOut().
 */
export async function clearEntitlement(): Promise<void> {
  current = FREE;
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
