/**
 * Backend warm-up — defeats Render's free-tier cold start.
 *
 * THE PROBLEM. The backend is deployed on a tier that spins down after
 * inactivity; waking it takes 30-50s. The API client's request timeout is 30s.
 * So the FIRST AI call of any session — the one that opens the coach — races a
 * wake-up it usually loses. Today that degrades to the deterministic on-device
 * engines, which is survivable. Once Gozlin's rework makes the remote coach the
 * product's differentiator, it means the flagship feature fails on first use,
 * every session.
 *
 * THE FIX (client half). Ping `/health` as soon as the app becomes active, so
 * the instance is already awake by the time the user opens chat. This is
 * fire-and-forget: it never blocks a screen, never surfaces an error, and never
 * retries in a loop. It also improves p50 latency on a paid always-on tier,
 * because it primes the connection.
 *
 * THE FIX (server half — NOT optional). Warming narrows the window; it does not
 * close it. A user who opens the app and taps straight into the coach can still
 * beat the wake-up. The durable answer is an always-on tier (~$7/mo) — see
 * docs/api/README.md §Operations. Do both.
 */
import { AppState, type AppStateStatus } from "react-native";
import { API_BASE_URL, isApiConfigured } from "./config";

/** How long a warm instance is assumed to stay warm. Render idles at ~15 min. */
const WARM_TTL_MS = 10 * 60 * 1000;

/** Ceiling for the ping itself — it must never outlive the wake it triggers. */
const PING_TIMEOUT_MS = 45_000;

let lastWarmedAt = 0;
let inFlight: Promise<boolean> | null = null;
let subscription: { remove(): void } | null = null;

/**
 * Ping `/health`. Resolves true when the backend answered, false otherwise —
 * never rejects, because no caller should have to guard a warm-up.
 *
 * Deduped two ways: a single in-flight promise, and a TTL so foregrounding the
 * app repeatedly doesn't hammer the endpoint.
 */
export function warmBackend(force = false): Promise<boolean> {
  if (!isApiConfigured) return Promise.resolve(false);
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastWarmedAt < WARM_TTL_MS) {
    return Promise.resolve(true);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  inFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      if (res.ok) {
        lastWarmedAt = Date.now();
        return true;
      }
      return false;
    } catch {
      // Offline, DNS failure, still-waking, no /health route yet — all the same
      // to us. The AI paths already fall back to the on-device engines.
      return false;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();

  return inFlight;
}

/** True when the backend was reached recently enough to still be awake. */
export function isBackendWarm(): boolean {
  return Date.now() - lastWarmedAt < WARM_TTL_MS;
}

/**
 * Start warming on every foreground transition (and once immediately). Returns
 * a teardown. Idempotent — calling twice does not double-subscribe.
 */
export function installBackendWarmup(): () => void {
  if (!isApiConfigured || subscription) return () => {};

  void warmBackend();

  const onChange = (state: AppStateStatus) => {
    if (state === "active") void warmBackend();
  };

  subscription = AppState.addEventListener("change", onChange);

  return () => {
    subscription?.remove();
    subscription = null;
  };
}

/** Test seam — clears the memoized warm state. */
export function __resetWarmupForTests(): void {
  lastWarmedAt = 0;
  inFlight = null;
  subscription?.remove();
  subscription = null;
}
