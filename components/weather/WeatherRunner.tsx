/**
 * WeatherRunner — keeps today's forecast fresh while the app is in use
 * (services/weather/today). Renders nothing.
 *
 * Reads the cached forecast at start, then refreshes on start and on every
 * return to the foreground. The source is consent-gated and cached for 2 hours,
 * so with weather switched off this does nothing, and with it on it reaches the
 * network at most every couple of hours.
 */
import { loadTodayWeather, refreshTodayWeather } from "@/services/weather/today";
import { useEffect } from "react";
import { AppState } from "react-native";

export function WeatherRunner(): null {
  useEffect(() => {
    let alive = true;
    void loadTodayWeather().then(() => {
      if (alive) void refreshTodayWeather();
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshTodayWeather();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return null;
}
