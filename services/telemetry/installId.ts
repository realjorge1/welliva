/**
 * THE ANONYMOUS INSTALL ID — the only identifier analytics uses before sign-in.
 *
 * WHY NOT THE USER ID. The activation funnel's widest leak is BEFORE anyone has
 * an account: a person opens the app, starts setup, and leaves. Keyed on user id,
 * every one of those people is invisible, and the funnel would measure only the
 * survivors. So events are keyed on a random id minted at first launch, and the
 * user id is attached later, when there is one.
 *
 * WHY NOT THE DEVICE ID OR THE ADVERTISING ID. The policy says we do not ask for
 * the advertising identifier, and a hardware id would make the "anonymous" claim
 * false — it follows the person across reinstalls and across apps. This id does
 * neither. It is a random value in our own AsyncStorage namespace: reinstalling
 * the app, deleting the account, or Settings → Reset mints a new one, and the old
 * events become permanently unattributable. That is the intended trade (we
 * slightly over-count installs) rather than a limitation.
 *
 * It is on the device-local denylist in services/sync/syncKeys, so it does NOT
 * follow the user to a second phone. Two devices read as two installs, which is
 * what "installs" should mean.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const INSTALL_ID_KEY = "@welliva_install_id";

let cached: string | null = null;

/**
 * A v4-shaped random id. Uses the platform CSPRNG when one is present and falls
 * back to Math.random otherwise.
 *
 * The fallback is deliberate and sufficient: this id buckets anonymous events.
 * It is never a secret, never a capability, and never checked for authenticity,
 * so the only property that matters is that two installs are unlikely to collide
 * — and Math.random clears that bar at our scale. It is NOT suitable for anything
 * else, which is why this helper is private to this module.
 */
function randomId(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;

  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set the version (4) and variant bits so the value is a well-formed UUID —
  // the column is `uuid`, and Postgres rejects anything else.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Read (or mint) this install's id. Memoized — called on every event.
 *
 * Fail-soft: if storage is unreadable we still return an id, it just won't
 * persist. A session's events then land under a one-off id, which is strictly
 * better than dropping them or crashing a logging path.
 */
export async function getInstallId(): Promise<string> {
  if (cached) return cached;

  try {
    const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (existing && existing.length >= 32) {
      cached = existing;
      return existing;
    }
  } catch {
    /* fall through to minting */
  }

  const fresh = randomId();
  cached = fresh;
  try {
    await AsyncStorage.setItem(INSTALL_ID_KEY, fresh);
  } catch {
    /* in-memory only for this session — see above */
  }
  return fresh;
}

/** Forget the id so the next read mints a new one (sign-out / data reset). */
export async function resetInstallId(): Promise<void> {
  cached = null;
  try {
    await AsyncStorage.removeItem(INSTALL_ID_KEY);
  } catch {
    /* fail-soft */
  }
}

/** Test seam — drops the memo without touching storage. */
export function __resetInstallIdCache(): void {
  cached = null;
}
