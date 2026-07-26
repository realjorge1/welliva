/**
 * health-os/signals/weather/openmeteo.ts
 *
 * PURE weather core (no native imports). We use Open-Meteo: free, keyless, and
 * privacy-friendly — no account, and we round coordinates to ~1 km before they ever
 * leave the device. This file builds the request, parses the response, and turns it
 * into a coach-facing indoor/outdoor hint. The adapter (WeatherSource) owns location +
 * fetch + caching. See docs/companion/00-proactive-companion-blueprint.md §3.2.
 */

export type WeatherGroup =
  | "clear"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

export interface WeatherSnapshot {
  tempC: number;
  code: number;
  condition: string;
  /** Ionicons glyph for the condition. */
  icon: string;
  group: WeatherGroup;
  highC: number;
  lowC: number;
  /** Max precipitation probability today, 0–100. */
  precipChance: number;
  /** ISO timestamp the snapshot was fetched. */
  fetchedAt: string;
  /** Optional place label (reverse-geocoded by the adapter). */
  place?: string;
}

export interface WorkoutWeatherHint {
  indoor: boolean;
  reason: string;
}

/** WMO weather-code → human label + icon + group. */
export function describeWeatherCode(code: number): {
  label: string;
  icon: string;
  group: WeatherGroup;
} {
  if (code === 0) return { label: "Clear", icon: "sunny", group: "clear" };
  if (code === 1) return { label: "Mostly clear", icon: "partly-sunny", group: "clear" };
  if (code === 2) return { label: "Partly cloudy", icon: "partly-sunny", group: "cloud" };
  if (code === 3) return { label: "Overcast", icon: "cloud", group: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "cloud", group: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "rainy", group: "drizzle" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "rainy", group: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "snow", group: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", icon: "rainy", group: "rain" };
  if (code >= 85 && code <= 86) return { label: "Snow showers", icon: "snow", group: "snow" };
  if (code >= 95) return { label: "Thunderstorm", icon: "thunderstorm", group: "thunder" };
  return { label: "Unsettled", icon: "cloud", group: "cloud" };
}

/** Round to ~1 km so we never send precise coordinates over the wire. */
export function coarsen(coord: number): number {
  return Math.round(coord * 100) / 100;
}

/** Build the Open-Meteo forecast URL for a (coarsened) lat/lon. */
export function buildForecastUrl(lat: number, lon: number): string {
  const la = coarsen(lat);
  const lo = coarsen(lon);
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
    `&current=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=2`
  );
}

interface OpenMeteoResponse {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: {
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
}

/** Parse an Open-Meteo response into a snapshot. Throws on a malformed body. */
export function parseForecast(json: unknown, now: Date = new Date()): WeatherSnapshot {
  const r = json as OpenMeteoResponse;
  const code = r.current?.weather_code ?? r.daily?.weather_code?.[0];
  const temp = r.current?.temperature_2m;
  if (typeof code !== "number" || typeof temp !== "number") {
    throw new Error("Malformed weather response");
  }
  const d = describeWeatherCode(code);
  return {
    tempC: Math.round(temp),
    code,
    condition: d.label,
    icon: d.icon,
    group: d.group,
    highC: Math.round(r.daily?.temperature_2m_max?.[0] ?? temp),
    lowC: Math.round(r.daily?.temperature_2m_min?.[0] ?? temp),
    precipChance: Math.round(r.daily?.precipitation_probability_max?.[0] ?? 0),
    fetchedAt: now.toISOString(),
  };
}

/** The coach-facing read: should today's session move indoors, and why. */
export function weatherWorkoutHint(w: WeatherSnapshot): WorkoutWeatherHint {
  if (w.group === "thunder") {
    return { indoor: true, reason: "Thunderstorms around today — let's train indoors." };
  }
  if (w.group === "snow" || w.precipChance >= 60 || w.group === "rain") {
    const what = w.group === "snow" ? "snow" : "rain";
    return {
      indoor: true,
      reason: `High chance of ${what} (${w.precipChance}%) — an indoor session keeps your streak safe.`,
    };
  }
  if (w.highC >= 33) {
    return { indoor: true, reason: `It'll reach ${w.highC}°C — train indoors or early, and hydrate hard.` };
  }
  if (w.lowC <= -5) {
    return { indoor: true, reason: `Freezing out (${w.lowC}°C) — warm up well or move it indoors.` };
  }
  return {
    indoor: false,
    reason: `Good conditions (${w.condition}, ${w.tempC}°C) — a great day to train outside.`,
  };
}
