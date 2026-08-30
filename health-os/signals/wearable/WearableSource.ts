/**
 * health-os/signals/wearable/WearableSource.ts
 *
 * The wearable adapter: reads sleep / HRV / resting-HR / steps from the platform health
 * store behind a `WearableProvider` seam, caches the latest `WearableSnapshot`, and is
 * consent-gated on the "wearable" category. Reads are LOCAL-ONLY — wearable metrics never
 * leave the device; only the derived recovery score is ever surfaced.
 *
 * The concrete providers now EXIST (./providers: Apple HealthKit via
 * `react-native-health`, Android Health Connect via `react-native-health-connect`) and are
 * registered below, so this source is no longer wired to a permanent `unavailable`. What
 * remains of the cutover is installing those two packages and taking an EAS build:
 * neither is a dependency yet, so both providers currently fail their own guarded require
 * and degrade to the same safe no-op as before. Nothing is enabled by default, and the
 * `manual` path (logging last night's sleep) still feeds the recovery fold either way.
 * See docs/companion/health-native-cutover.md.
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

/** The floor every provider degrades to: no module, no permission, no data. */
export const nullWearableProvider: WearableProvider = {
  getStatus: async () => ({ permission: "unavailable" as SignalPermission, ready: false }),
  requestAccess: async () => ({ permission: "unavailable" as SignalPermission, ready: false }),
  readToday: async () => null,
};

/**
 * The platform provider, resolved on FIRST USE rather than at import.
 *
 * Two reasons, both structural rather than stylistic:
 *
 *  1. IT BREAKS A CYCLE. `./providers` imports `nullWearableProvider` from this
 *     module as a value, so importing it here at module scope would close a
 *     require loop and one of the two would see a half-initialised module.
 *     Deferring the require to the first call means this file is fully
 *     evaluated before `./providers` ever loads.
 *
 *  2. IT KEEPS COLD START CLEAN. Nothing about HealthKit or Health Connect
 *     should run because a module graph happened to include this file. The
 *     first actual status check is early enough.
 */
let resolvedProvider: WearableProvider | null = null;

function platformProvider(): WearableProvider {
  if (resolvedProvider) return resolvedProvider;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveWearableProvider } = require("./providers") as {
      resolveWearableProvider: () => WearableProvider;
    };
    resolvedProvider = resolveWearableProvider();
  } catch {
    resolvedProvider = nullWearableProvider;
  }
  return resolvedProvider;
}

/** Delegates every call to whichever provider this platform resolved to. */
export const lazyPlatformProvider: WearableProvider = {
  getStatus: () => platformProvider().getStatus(),
  requestAccess: () => platformProvider().requestAccess(),
  readToday: (now) => platformProvider().readToday(now),
};

export class WearableSource {
  constructor(
    private readonly store: KeyValueStore = defaultStore,
    private readonly consent: ConsentRepository = defaultConsent,
    /**
     * Defaults to the platform's own health store. Tests and the manual path
     * inject their own; `nullWearableProvider` is still the explicit no-op.
     */
    private readonly provider: WearableProvider = lazyPlatformProvider,
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

/** The default, app-wide wearable source, on this platform's health store. */
export const wearableSource = new WearableSource();
