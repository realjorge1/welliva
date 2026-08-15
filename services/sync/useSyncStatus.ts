/**
 * useSyncStatus — "has my data actually reached the cloud?"
 *
 * The app is offline-first and, until now, offline-unaware: no connectivity
 * state, no pending indicator, and sync failures that ended their life as a
 * `console.warn`. A user had no way to learn their week of logs was sitting in
 * an outbox — which matters most exactly when it's true.
 *
 * This joins the two facts that answer the question: is there a network, and is
 * the outbox empty. Poll-based rather than event-based on purpose — the outbox
 * is written by services all over the app (some straight to AsyncStorage), so a
 * 4s tick is both simpler and more truthful than a subscription that can miss
 * a writer.
 */
import { useEffect, useState } from "react";
import * as Network from "expo-network";

import { allowPro } from "../billing/gating";
import { getLastSyncAt, pendingWriteCount } from "./SyncEngine";

export type SyncState = "synced" | "pending" | "offline" | "error" | "local";

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  /** ISO time this device last drained the queue completely. */
  lastSyncAt: string | null;
  online: boolean;
  /**
   * Cloud backup is off because this account is on the free tier — NOT because
   * anything failed. Without this the pill would read "All changes saved" (the
   * outbox is empty, since a free tier never queues), which implies a backup
   * that did not happen. Saying "saved on this device" is the honest version
   * and it is also the upsell.
   */
  cloudDisabled: boolean;
}

/** Slow enough to be invisible, fast enough that a log feels acknowledged. */
const POLL_MS = 4000;

/** Pending for longer than this with a live connection means something's stuck. */
const STUCK_AFTER_MS = 5 * 60 * 1000;

export function useSyncStatus(): SyncStatus {
  const net = Network.useNetworkState();
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  // Sampled on the same tick rather than through BillingContext, to keep this
  // hook usable outside the provider. A 4s lag after an upgrade is invisible.
  const [cloudDisabled, setCloudDisabled] = useState(() => !allowPro());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const [count, at] = await Promise.all([pendingWriteCount(), getLastSyncAt()]);
      if (!alive) return;
      setPendingCount(count);
      setLastSyncAt(at);
      setCloudDisabled(!allowPro());
      setPendingSince((prev) => (count > 0 ? (prev ?? Date.now()) : null));
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Optimistic on an unknown radio state — see networkProbe.ts for why.
  const online = net.isInternetReachable ?? net.isConnected ?? true;

  const stuck =
    online && pendingCount > 0 && pendingSince != null && Date.now() - pendingSince > STUCK_AFTER_MS;

  return {
    pendingCount,
    lastSyncAt,
    online,
    cloudDisabled,
    // `local` outranks every network state: with nothing queued to upload,
    // "offline" and "pending" are meaningless — there is no cloud in play.
    state: cloudDisabled
      ? "local"
      : !online
        ? "offline"
        : stuck
          ? "error"
          : pendingCount > 0
            ? "pending"
            : "synced",
  };
}

/** Human copy for a status, shared by the pill and the settings row. */
export function describeSyncStatus(status: SyncStatus): string {
  const changes = `${status.pendingCount} change${status.pendingCount === 1 ? "" : "s"}`;
  switch (status.state) {
    case "local":
      return "Saved on this device";
    case "offline":
      return status.pendingCount > 0 ? `Offline · ${changes} waiting` : "Offline";
    case "pending":
      return `Saving ${changes}…`;
    case "error":
      return `${changes} haven't synced`;
    case "synced":
      return "All changes saved";
  }
}
