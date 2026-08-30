/**
 * health-os/signals/wearable/providers — picking the right health store.
 *
 * One function, and it is the whole registration: `resolveWearableProvider()`
 * returns HealthKit on iOS, Health Connect on Android, and the null provider
 * anywhere else. `WearableSource`'s default constructor argument calls it, so
 * the app-wide `wearableSource` is wired to the real adapter rather than to a
 * permanent `unavailable` — which is what F-04 of the 30 Aug audit was about.
 *
 * ── WHAT THIS DOES AND DOESN'T CHANGE TODAY ─────────────────────────────────
 * Neither `react-native-health` nor `react-native-health-connect` is a
 * dependency of this repo yet, so both providers currently fail their internal
 * require and report `unavailable`. Behaviour today is therefore IDENTICAL to
 * the null provider — nothing is enabled, nothing can regress, no new
 * permission is requested, and no store-review surface changes.
 *
 * What changed is where the remaining work is. It used to be "write a HealthKit
 * adapter"; it is now "install two packages and rebuild", with the mapping —
 * the part with the real bugs in it, like sleep-sample overlap and HealthKit's
 * seconds-valued HRV — already written and under test. The runbook is
 * docs/companion/health-native-cutover.md.
 *
 * ── WHY THE PLATFORM CHECK IS ALSO GUARDED ──────────────────────────────────
 * `health-os/` imports no React Native anywhere — that is what keeps it
 * testable under plain Node, and the whole layer's test suite depends on it. So
 * `Platform` is required lazily here too. Off-device the require fails, we
 * report no platform, and the null provider is returned: a test importing this
 * module gets a working, inert provider rather than a crash.
 */

import { nullWearableProvider, type WearableProvider } from "../WearableSource";
import { AppleHealthProvider } from "./appleHealth";
import { HealthConnectProvider } from "./healthConnect";

export { AppleHealthProvider, snapshotFromHealthKit } from "./appleHealth";
export {
  HealthConnectProvider,
  sleepIntervalsFromSessions,
  snapshotFromHealthConnect,
} from "./healthConnect";

/** The running platform, or null when React Native isn't there at all. */
function platformOS(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native");
    return typeof Platform?.OS === "string" ? Platform.OS : null;
  } catch {
    return null;
  }
}

/**
 * The provider for this platform.
 *
 * Memoized: both providers hold init state, and handing out a fresh instance
 * per call would re-run HealthKit's init on every read.
 */
let cached: WearableProvider | null = null;

export function resolveWearableProvider(): WearableProvider {
  if (cached) return cached;
  switch (platformOS()) {
    case "ios":
      cached = new AppleHealthProvider();
      break;
    case "android":
      cached = new HealthConnectProvider();
      break;
    default:
      // Web, and every test runner. Nothing to read from.
      cached = nullWearableProvider;
  }
  return cached;
}

/** Test seam — drops the memo so a suite can re-resolve. */
export function resetWearableProvider(): void {
  cached = null;
}
