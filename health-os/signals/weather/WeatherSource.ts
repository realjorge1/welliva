/**
 * health-os/signals/weather/WeatherSource.ts
 *
 * The weather adapter: location (expo-location, lazy + guarded) → Open-Meteo fetch →
 * cached `WeatherSnapshot`. Offline-first: a fresh-enough cached snapshot is served
 * without touching the network or GPS, and any failure (no permission, no module, no
 * signal) falls back to the last known snapshot (or null) — never throws into the UI.
 *
 * Privacy: coordinates are coarsened to ~1 km (openmeteo.ts `coarsen`) before the only
 * outbound call, and Open-Meteo is keyless (no account, no tracking id).
 *
 * ⚠️ Requires a dev/prod build to grant location permission reliably (not Expo Go).
 * See docs/companion/00-proactive-companion-blueprint.md §3.2 + §7.
 */
import { store as defaultStore } from "../../platform/storage/AsyncStorageAdapter";
import { K } from "../../platform/storage/keys";
import type { KeyValueStore } from "../../platform/storage/KeyValueStore";
import { consent as defaultConsent, type ConsentRepository } from "../../privacy";
import type { SignalPermission, SignalStatus } from "../types";
import {
  buildForecastUrl,
  coarsen,
  parseForecast,
  type WeatherSnapshot,
} from "./openmeteo";

type ExpoLocation = typeof import("expo-location");

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const FRESH_MS = 2 * 60 * 60 * 1000; // 2 hours

interface WeatherCache {
  snapshot: WeatherSnapshot;
  coordKey: string;
}

function mapPermission(status: string | undefined): SignalPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

function toStatus(p: SignalPermission): SignalStatus {
  return { permission: p, ready: p === "granted" };
}

export class WeatherSource {
  constructor(
    private readonly store: KeyValueStore = defaultStore,
    /** Injectable for tests; defaults to global fetch. */
    private readonly fetchImpl: FetchLike = (url) =>
      (globalThis.fetch as unknown as FetchLike)(url),
    /** Consent gate — the GPS + network fetch is a no-op unless "location_weather" is granted. */
    private readonly consent: ConsentRepository = defaultConsent,
  ) {}

  private async mod(): Promise<ExpoLocation | null> {
    try {
      return await import("expo-location");
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<SignalStatus> {
    const Location = await this.mod();
    if (!Location) return toStatus("unavailable");
    try {
      const res = await Location.getForegroundPermissionsAsync();
      return toStatus(mapPermission(res.status));
    } catch {
      return toStatus("unavailable");
    }
  }

  async requestAccess(): Promise<SignalStatus> {
    const Location = await this.mod();
    if (!Location) return toStatus("unavailable");
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      return toStatus(mapPermission(res.status));
    } catch {
      return toStatus("unavailable");
    }
  }

  private cache(): Promise<WeatherCache | null> {
    return this.store.get<WeatherCache | null>(K.SIGNALS_WEATHER, null);
  }

  private isFresh(snapshot: WeatherSnapshot, now: Date): boolean {
    const age = now.getTime() - Date.parse(snapshot.fetchedAt);
    return age >= 0 && age < FRESH_MS;
  }

  /**
   * Today's weather. Serves a fresh cache without GPS/network; otherwise locates +
   * fetches. Returns the last-known snapshot (or null) on any failure.
   */
  async getToday(
    opts: { refresh?: boolean; now?: Date } = {},
  ): Promise<WeatherSnapshot | null> {
    const now = opts.now ?? new Date();
    const cached = await this.cache();
    if (!opts.refresh && cached && this.isFresh(cached.snapshot, now)) {
      return cached.snapshot;
    }

    // Consent gate (defense in depth): no GPS/network without the granted category.
    if (!(await this.consent.isGranted("location_weather"))) {
      return cached?.snapshot ?? null;
    }

    const Location = await this.mod();
    if (!Location) return cached?.snapshot ?? null;

    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (mapPermission(perm.status) !== "granted") return cached?.snapshot ?? null;

      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({}));
      if (!pos) return cached?.snapshot ?? null;

      const { latitude, longitude } = pos.coords;
      const res = await this.fetchImpl(buildForecastUrl(latitude, longitude));
      if (!res.ok) return cached?.snapshot ?? null;
      const snapshot = parseForecast(await res.json(), now);

      const coordKey = `${coarsen(latitude)},${coarsen(longitude)}`;
      await this.store.set<WeatherCache>(K.SIGNALS_WEATHER, { snapshot, coordKey });
      return snapshot;
    } catch {
      return cached?.snapshot ?? null;
    }
  }

  /** The last cached snapshot, if any (no network/GPS). */
  async lastKnown(): Promise<WeatherSnapshot | null> {
    return (await this.cache())?.snapshot ?? null;
  }
}

/** The default, app-wide weather source. */
export const weatherSource = new WeatherSource();
