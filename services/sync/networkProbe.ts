/**
 * NETWORK PROBE — the expo-network implementation of the connectivity contract.
 *
 * Split from connectivity.ts so the sync core keeps no native dependency (see
 * that file's header). This is the only module in services/sync that imports
 * expo-network; the app installs it once at startup.
 */
import * as Network from "expo-network";

import { setConnectivityProbe } from "./connectivity";

/**
 * True when a request has a realistic chance of completing.
 *
 * `isInternetReachable` is the honest signal — a phone on captive-portal wifi is
 * "connected" and can't reach anything. It's undefined on some platforms and
 * during the first tick, so fall back to `isConnected`, then to optimism: a
 * wrong "offline" stops syncing, a wrong "online" costs one failed fetch.
 */
async function probe(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return state.isInternetReachable ?? state.isConnected ?? true;
}

/** Call once, early. Idempotent. */
export function installNetworkProbe(): void {
  setConnectivityProbe(probe);
}
