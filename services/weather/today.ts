/**
 * services/weather/today.ts — today's weather, readable anywhere in the app.
 *
 * Owner, 2026-11-15, "on the phone only": the forecast works, but nothing acted
 * on it. Now three things do, all on the phone, nothing new leaving it:
 *   · Fitness says when the weather at her training hour changes the plan;
 *   · a hot day tops the water goal up a little, with the reason shown;
 *   · Home carries a one-line weather note.
 *
 * The snapshot comes from the existing WeatherSource (consent-gated, coarse
 * location, cached 2 h) — refreshed on open and on every return to the
 * foreground by components/weather/WeatherRunner, so it no longer waits for the
 * Memory screen to be opened. With weather switched off there is no snapshot,
 * and everything here is a no-op: no top-up, no line.
 *
 * THE TOP-UP IS PART OF THE GOAL, EVERYWHERE. `withHeat(base)` is what every
 * surface that reads the day's water goal uses — Home, the Deck, the water
 * check-ins, the widget, the day's archive, the coach — so no card says a
 * different goal from the one counted (welliva-no-cosmetic-counters). The goal
 * she SETS (Settings) is never changed; the top-up is today's only.
 */
import { useEffect, useState } from "react";

import { weatherSource } from "@/health-os/signals/weather/WeatherSource";
import { heatTopUpMl, type WeatherSnapshot } from "@/health-os/signals/weather/openmeteo";
import { toLocalDateString, todayDate } from "@/services/OfflineStorage";

let current: WeatherSnapshot | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // one bad listener must not stop the others
    }
  }
}

function set(next: WeatherSnapshot | null): void {
  const changed =
    (current?.fetchedAt ?? null) !== (next?.fetchedAt ?? null) || (current === null) !== (next === null);
  current = next;
  loaded = true;
  if (changed) emit();
}

/** The local day a snapshot was fetched on. */
function fetchedOn(w: WeatherSnapshot): string | null {
  const d = new Date(w.fetchedAt);
  return Number.isNaN(d.getTime()) ? null : toLocalDateString(d);
}

/** Today's snapshot, or null when weather is off, unfetched, or from another day. */
export function todaysWeather(today: string = todayDate()): WeatherSnapshot | null {
  return current && fetchedOn(current) === today ? current : null;
}

/** Extra millilitres on today's water goal for the heat (0 without today's forecast). */
export function heatTopUpToday(today: string = todayDate()): number {
  return heatTopUpMl(todaysWeather(today)?.highC);
}

/** The day's water goal: what she set, plus today's heat top-up. */
export function withHeat(baseMl: number, today: string = todayDate()): number {
  return baseMl + heatTopUpToday(today);
}

/** Read the cached snapshot (no network, no GPS). Called once at start. */
export async function loadTodayWeather(): Promise<void> {
  try {
    set(await weatherSource.lastKnown());
  } catch {
    loaded = true;
  }
}

/** Refresh through the consent-gated source (cached for 2 hours). Never throws. */
export async function refreshTodayWeather(): Promise<void> {
  try {
    const snap = await weatherSource.getToday();
    if (snap) set(snap);
    else if (!loaded) await loadTodayWeather();
  } catch {
    // keep what we had
  }
}

export function onTodayWeather(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Today's weather and its water top-up, re-rendering when a fresh forecast lands. */
export function useTodayWeather(): { weather: WeatherSnapshot | null; topUpMl: number } {
  const [, bump] = useState(0);
  useEffect(() => onTodayWeather(() => bump((n) => n + 1)), []);
  const weather = todaysWeather();
  return { weather, topUpMl: heatTopUpMl(weather?.highC) };
}
