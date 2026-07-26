/**
 * useSignals — bridge hook for the external senses (calendar + weather) on the
 * "What's coming up" screen. Thin wiring over health-os/signals/*; every action
 * degrades gracefully when a module/permission is absent (Expo Go, web, denied).
 */
import {
  calendarSource,
  consent,
  weatherSource,
  weatherWorkoutHint,
  type SignalStatus,
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
}

export function useSignals(): UseSignals {
  const [calendar, setCalendar] = useState<SignalStatus>(UNKNOWN);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<SignalStatus>(UNKNOWN);
  const [loadingWeather, setLoadingWeather] = useState(false);

  useEffect(() => {
    void (async () => {
      const [calStatus, wxStatus, lastWeather] = await Promise.all([
        calendarSource.getStatus(),
        weatherSource.getStatus(),
        weatherSource.lastKnown(),
      ]);
      setCalendar(calStatus);
      setWeatherStatus(wxStatus);
      setWeather(lastWeather);
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

  return {
    calendar,
    connectingCalendar,
    connectCalendar,
    weather,
    weatherHint: weather ? weatherWorkoutHint(weather) : null,
    weatherStatus,
    loadingWeather,
    enableWeather,
  };
}
