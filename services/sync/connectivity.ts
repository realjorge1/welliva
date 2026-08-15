/**
 * CONNECTIVITY — is there any point attempting a network call right now?
 *
 * Why a registry rather than importing expo-network here: SyncEngine is the one
 * module that must stay loadable in a plain Node test process (its suite runs
 * the real push/pull/merge logic against an in-memory table). A native module
 * import at its top would drag a native binding into that graph. Same shape as
 * OfflineStorage's `setWriteObserver`.
 *
 * The default is ONLINE. An app that hasn't installed a probe behaves exactly as
 * it did before this file existed — a missing probe can only ever cost a failed
 * fetch, never a skipped sync.
 */

type Probe = () => Promise<boolean>;

let probe: Probe | null = null;
/** Cached so a burst of queued keys doesn't hit the native module per key. */
let cached: { value: boolean; at: number } | null = null;
const CACHE_MS = 3000;

/** Install (or clear, with null) the connectivity probe. */
export function setConnectivityProbe(fn: Probe | null): void {
  probe = fn;
  cached = null;
}

/**
 * Best-effort connectivity check. Never throws, and answers `true` when it
 * genuinely can't tell — a false "offline" would silently stop syncing, which
 * is the failure this whole area is trying to end.
 */
export async function isOnline(): Promise<boolean> {
  if (!probe) return true;
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  try {
    const value = await probe();
    cached = { value, at: now };
    return value;
  } catch {
    return true;
  }
}

/** Drop the cache — call when the app foregrounds or the radio state changes. */
export function invalidateConnectivityCache(): void {
  cached = null;
}
