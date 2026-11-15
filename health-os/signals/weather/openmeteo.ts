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
  /**
   * Hour by hour for today and tomorrow, in the place's own time (2026-11-15:
   * "rain at 5 PM, when you train" needs the hour, not the day's maximum).
   * Absent on snapshots cached before then.
   */
  hours?: WeatherHour[];
}

/** One hour of the forecast. */
export interface WeatherHour {
  /** Local `YYYY-MM-DD` of the place. */
  date: string;
  /** 0–23, local to the place. */
  hour: number;
  tempC: number;
  /** 0–100. */
  precipChance: number;
  code: number;
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
    `&hourly=temperature_2m,precipitation_probability,weather_code` +
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
  hourly?: {
    /** Local "YYYY-MM-DDTHH:MM" (timezone=auto). */
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
}

/** The hourly block, kept only where every field is a number. */
function parseHours(h: OpenMeteoResponse["hourly"]): WeatherHour[] | undefined {
  if (!h?.time?.length) return undefined;
  const out: WeatherHour[] = [];
  h.time.forEach((t, i) => {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})/.exec(t);
    const temp = h.temperature_2m?.[i];
    const code = h.weather_code?.[i];
    if (!m || typeof temp !== "number" || typeof code !== "number") return;
    const p = h.precipitation_probability?.[i];
    out.push({
      date: m[1],
      hour: Number(m[2]),
      tempC: Math.round(temp),
      precipChance: typeof p === "number" ? Math.round(p) : 0,
      code,
    });
  });
  return out.length ? out : undefined;
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
    ...(parseHours(r.hourly) ? { hours: parseHours(r.hourly) } : {}),
  };
}

/** The forecast for one local hour, or null when the snapshot doesn't reach it. */
export function weatherAt(w: WeatherSnapshot | null, date: string, hour: number): WeatherHour | null {
  return w?.hours?.find((h) => h.date === date && h.hour === hour) ?? null;
}

function clock(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * The weather at the hour she trains, said only when it changes something:
 * storms, likely rain, heat or frost. A fine hour says nothing — no message for
 * the sake of a message. Null without the hour in the forecast.
 */
export function trainingHourHint(
  w: WeatherSnapshot | null,
  date: string,
  hour: number,
): { indoor: boolean; line: string } | null {
  const h = weatherAt(w, date, hour);
  if (!h) return null;
  const at = clock(hour);
  if (h.code >= 95) return { indoor: true, line: `Storms likely around ${at} — train indoors today.` };
  if (h.precipChance >= 60) {
    return { indoor: true, line: `Rain likely around ${at} (${h.precipChance}%) — this one works indoors.` };
  }
  if (h.tempC >= 33) return { indoor: true, line: `${h.tempC}° around ${at} — go early or stay indoors, and drink more.` };
  if (h.tempC <= 0) return { indoor: false, line: `${h.tempC}° around ${at} — warm up longer than usual.` };
  return null;
}

/**
 * Extra water for a hot day, from the day's high. Small steps on purpose — it
 * tops the goal up, it doesn't double it — and nothing below 30°.
 */
export function heatTopUpMl(highC: number | null | undefined): number {
  if (typeof highC !== "number" || !Number.isFinite(highC)) return 0;
  if (highC >= 36) return 750;
  if (highC >= 33) return 500;
  if (highC >= 30) return 250;
  return 0;
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
