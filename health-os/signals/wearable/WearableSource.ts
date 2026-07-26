/**
 * health-os/signals/wearable/WearableSource.ts
 *
 * The wearable adapter: reads sleep / HRV / resting-HR / steps from the platform health
 * store behind a `WearableProvider` seam, caches the latest `WearableSnapshot`, and is
 * consent-gated on the "wearable" category. Reads are LOCAL-ONLY — wearable metrics never
 * leave the device; only the derived recovery score is ever surfaced.
 *
 * The concrete provider (Apple HealthKit via `react-native-health`, Android Health
 * Connect) is the EAS-build cutover — the biggest native lift in the roadmap. Until it's
 * registered the source reports `unavailable` and degrades to a safe no-op, while a
 * `manual` path (logging last night's sleep) still feeds the recovery fold so P4 delivers
 * value before the native work lands.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.2 + §7 (P4).
 */
import { toLocalDateString } from "../../platform/clock";
import { store as defaultStore } from "../../platform/storage/AsyncStorageAdapter";
import { K } from "../../platform/storage/keys";
import type { KeyValueStore } from "../../platform/storage/KeyValueStore";
import { consent as defaultConsent, type ConsentRepository } from "../../privacy";
import type { SignalPermission, SignalStatus } from "../types";
import type { WearableSnapshot } from "./wearable";

/** The platform-health seam. A real HealthKit / Health Connect provider implements this. */
export interface WearableProvider {
  getStatus(): Promise<SignalStatus>;
  requestAccess(): Promise<SignalStatus>;
  /** Read today's (last night's) metrics, or null if none/unavailable. */
  readToday(now: Date): Promise<WearableSnapshot | null>;
}

/** Default provider until the native one is registered: always unavailable. */
export const nullWearableProvider: WearableProvider = {
  getStatus: async () => ({ permission: "unavailable" as SignalPermission, ready: false }),
  requestAccess: async () => ({ permission: "unavailable" as SignalPermission, ready: false }),
  readToday: async () => null,
};

export class WearableSource {
  constructor(
    private readonly store: KeyValueStore = defaultStore,
    private readonly consent: ConsentRepository = defaultConsent,
    /** Swap in a HealthKit/Health Connect provider in the dev build; null = unavailable. */
    private readonly provider: WearableProvider = nullWearableProvider,
  ) {}

  getStatus(): Promise<SignalStatus> {
    return this.provider.getStatus();
  }

  async requestAccess(): Promise<SignalStatus> {
    await this.consent.grant("wearable");
    return this.provider.requestAccess();
  }

  /** The latest cached snapshot (no native read). */
  async lastKnown(): Promise<WearableSnapshot | null> {
    return this.store.get<WearableSnapshot | null>(K.SIGNALS_WEARABLE, null);
  }

  /**
   * Today's metrics. Serves a same-day cache without a native read; otherwise reads from
   * the provider (consent + permission gated) and caches. Never throws into the UI.
   */
  async getToday(opts: { now?: Date; refresh?: boolean } = {}): Promise<WearableSnapshot | null> {
    const now = opts.now ?? new Date();
    const today = toLocalDateString(now);
    const cached = await this.lastKnown();
    if (!opts.refresh && cached && cached.date === today) return cached;

    if (!(await this.consent.isGranted("wearable"))) return cached;
    try {
      const status = await this.provider.getStatus();
      if (!status.ready) return cached;
      const snap = await this.provider.readToday(now);
      if (snap) await this.store.set(K.SIGNALS_WEARABLE, snap);
      return snap ?? cached;
    } catch {
      return cached;
    }
  }

  /**
   * Manually record metrics the user enters (last night's sleep, a known HRV), so the
   * recovery fold works before the native provider lands. Merges over any same-day cache.
   */
  async ingest(
    metrics: Partial<Omit<WearableSnapshot, "date" | "source" | "fetchedAt">>,
    now: Date = new Date(),
  ): Promise<WearableSnapshot> {
    const today = toLocalDateString(now);
    const cached = await this.lastKnown();
    const base = cached && cached.date === today ? cached : { date: today, source: "manual" as const };
    const snap: WearableSnapshot = {
      ...base,
      ...metrics,
      date: today,
      source: "manual",
      fetchedAt: now.toISOString(),
    };
    await this.store.set(K.SIGNALS_WEARABLE, snap);
    return snap;
  }

  /** Wipe the cached wearable snapshot (part of "forget everything"). */
  async clear(): Promise<void> {
    await this.store.remove(K.SIGNALS_WEARABLE);
  }
}

/** The default, app-wide wearable source (provider registered in the dev build). */
export const wearableSource = new WearableSource();
