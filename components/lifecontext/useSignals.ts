/**
 * useSignals — bridge hook for the external senses (calendar, weather and the
 * platform health store) on the "What's coming up" screen. Thin wiring over
 * health-os/signals/*; every action degrades gracefully when a module or
 * permission is absent (Expo Go, web, denied, or a build without the native
 * health packages).
 *
 * THE WEARABLE ROW IS HONEST ABOUT BEING OFF. Apple Health / Health Connect
 * report `unavailable` until their native packages are installed and an EAS
 * build is taken (docs/companion/health-native-cutover.md), so the row says so
 * plainly rather than offering a Connect button that silently does nothing. The
 * manual sleep path still feeds the recovery fold in the meantime, which is why
 * an absent wearable is a degraded experience rather than a missing one.
 */
import {
  calendarSource,
  consent,
  wearableSource,
  weatherSource,
  weatherWorkoutHint,
  type SignalStatus,
  type WearableSnapshot,
  type WeatherSnapshot,
  type WorkoutWeatherHint,
} from "@/health-os";
import { useCallback, useEffect, useState } from "react";

const UNKNOWN: SignalStatus = { permission: "undetermined", ready: false };

export interface UseSignals {
  calendar: SignalStatus;
  connectingCalendar: boolean;
  /** Request access + sync; resolves to #proposed (null if unavailable/denied). */
  connectCalendar: () => Promise<number | null>;
  weather: WeatherSnapshot | null;
  weatherHint: WorkoutWeatherHint | null;
  weatherStatus: SignalStatus;
  loadingWeather: boolean;
  enableWeather: () => Promise<void>;
  /** Apple Health / Health Connect. `unavailable` until the native cutover. */
  wearable: SignalStatus;
  /** Last night's metrics, from the health store or entered by hand. */
  wearableSnapshot: WearableSnapshot | null;
  connectingWearable: boolean;
  /** Grants consent, asks the OS, then reads once. Resolves to what it read. */
  connectWearable: () => Promise<WearableSnapshot | null>;
}

export function useSignals(): UseSignals {
  const [calendar, setCalendar] = useState<SignalStatus>(UNKNOWN);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<SignalStatus>(UNKNOWN);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [wearable, setWearable] = useState<SignalStatus>(UNKNOWN);
  const [wearableSnapshot, setWearableSnapshot] = useState<WearableSnapshot | null>(null);
  const [connectingWearable, setConnectingWearable] = useState(false);

  useEffect(() => {
    void (async () => {
      const [calStatus, wxStatus, lastWeather, wearStatus, lastWearable] =
        await Promise.all([
          calendarSource.getStatus(),
          weatherSource.getStatus(),
          weatherSource.lastKnown(),
          wearableSource.getStatus(),
          // Cached only — no native read on mount. A health-store query on every
          // screen open would be a permission prompt nobody asked for.
          wearableSource.lastKnown(),
        ]);
      setCalendar(calStatus);
      setWeatherStatus(wxStatus);
      setWeather(lastWeather);
      setWearable(wearStatus);
      setWearableSnapshot(lastWearable);
      // If weather was already permitted, refresh it quietly.
      if (wxStatus.ready) {
        const fresh = await weatherSource.getToday();
        if (fresh) setWeather(fresh);
      }
    })();
  }, []);

  const connectCalendar = useCallback(async (): Promise<number | null> => {
    setConnectingCalendar(true);
    try {
      // App-level consent first, then the OS permission prompt (connecting = consenting).
      await consent.grant("calendar");
      const status = await calendarSource.requestAccess();
      setCalendar(status);
      if (!status.ready) return null;
      const { proposed } = await calendarSource.syncToLifeContext({ days: 180 });
      return proposed;
    } finally {
      setConnectingCalendar(false);
    }
  }, []);

  const enableWeather = useCallback(async () => {
    setLoadingWeather(true);
    try {
      await consent.grant("location_weather");
      const status = await weatherSource.requestAccess();
      setWeatherStatus(status);
      if (!status.ready) return;
      const snap = await weatherSource.getToday({ refresh: true });
      if (snap) setWeather(snap);
    } finally {
      setLoadingWeather(false);
    }
  }, []);

  /**
   * Connect the platform health store.
   *
   * `WearableSource.requestAccess` records the app-level consent before it asks
   * the OS — the same order the calendar uses, and for the same reason: tapping
   * Connect IS the consent, and a granted system permission with no consent
   * record behind it is a gap the Trust screen could not explain.
   */
  const connectWearable = useCallback(async (): Promise<WearableSnapshot | null> => {
    setConnectingWearable(true);
    try {
      const status = await wearableSource.requestAccess();
      setWearable(status);
      if (!status.ready) return null;
      const snap = await wearableSource.getToday({ refresh: true });
      setWearableSnapshot(snap);
      return snap;
    } finally {
      setConnectingWearable(false);
    }
  }, []);

  return {
    calendar,
    connectingCalendar,
    connectCalendar,
    wearable,
    wearableSnapshot,
    connectingWearable,
    connectWearable,
    weather,
    weatherHint: weather ? weatherWorkoutHint(weather) : null,
    weatherStatus,
    loadingWeather,
    enableWeather,
  };
}
