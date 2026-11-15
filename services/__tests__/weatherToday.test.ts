/**
 * services/weather/today — the heat top-up on the day's water goal.
 *
 * Owner, 2026-11-15: a hot day raises the water goal a little, with the reason
 * shown — on the phone only. The rule that keeps it honest: only TODAY's
 * forecast counts (yesterday's heat never raises today's goal), and with no
 * forecast at all (weather switched off) the goal is exactly what she set.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const W = vi.hoisted(() => ({ snap: null as unknown }));

vi.mock("@/health-os/signals/weather/WeatherSource", () => ({
  weatherSource: {
    lastKnown: async () => W.snap,
    getToday: async () => W.snap,
  },
}));

import { heatTopUpToday, loadTodayWeather, todaysWeather, withHeat } from "../weather/today";

function snapshot(highC: number, fetched: Date) {
  return {
    tempC: highC - 2, code: 1, condition: "Mostly clear", icon: "sunny", group: "clear",
    highC, lowC: 24, precipChance: 10, fetchedAt: fetched.toISOString(),
  };
}

const TODAY = "2026-11-15";
const NOON = new Date(2026, 10, 15, 12, 0, 0);

beforeEach(() => {
  W.snap = null;
});

describe("withHeat", () => {
  it("adds today's top-up for a hot day", async () => {
    W.snap = snapshot(33, NOON);
    await loadTodayWeather();
    expect(heatTopUpToday(TODAY)).toBe(500);
    expect(withHeat(2500, TODAY)).toBe(3000);
  });

  it("never lets another day's heat raise today's goal", async () => {
    W.snap = snapshot(36, new Date(2026, 10, 14, 12, 0, 0));
    await loadTodayWeather();
    expect(todaysWeather(TODAY)).toBeNull();
    expect(withHeat(2500, TODAY)).toBe(2500);
  });

  it("leaves the goal exactly as set with weather off (no forecast)", async () => {
    W.snap = null;
    await loadTodayWeather();
    expect(withHeat(2500, TODAY)).toBe(2500);
  });
});
