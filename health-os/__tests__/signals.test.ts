import { describe, expect, it } from "vitest";

import {
  classifyKind,
  proposeFromCalendar,
  proposeFromCalendarEvent,
  type RawCalendarEvent,
} from "../signals/calendar/classify";
import {
  buildForecastUrl,
  coarsen,
  describeWeatherCode,
  parseForecast,
  weatherWorkoutHint,
  type WeatherSnapshot,
} from "../signals/weather/openmeteo";
import { SignalsCoordinator } from "../signals/SignalsCoordinator";
import type { CalendarSource } from "../signals/calendar/CalendarSource";
import type { WeatherSource } from "../signals/weather/WeatherSource";
import { ConsentRepository } from "../privacy/ConsentRepository";
import { MemoryStore } from "./helpers/MemoryStore";

const TODAY = "2026-06-29";

function cal(overrides: Partial<RawCalendarEvent> = {}): RawCalendarEvent {
  return {
    id: "x1",
    title: "Event",
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    allDay: false,
    ...overrides,
  };
}

describe("calendar classify (pure)", () => {
  it("maps keywords to kinds", () => {
    expect(classifyKind("Flight to Lisbon")).toBe("travel");
    expect(classifyKind("Summer vacation")).toBe("vacation");
    expect(classifyKind("Anna's wedding")).toBe("wedding");
    expect(classifyKind("Final exams")).toBe("exam_period");
    expect(classifyKind("Knee surgery")).toBe("surgery");
    expect(classifyKind("Berlin Marathon")).toBe("competition");
    expect(classifyKind("Project deadline")).toBe("deadline");
    expect(classifyKind("Team standup")).toBeNull();
  });

  it("proposes a classified future event with a deterministic id", () => {
    const p = proposeFromCalendarEvent(cal({ id: "abc", title: "Flight to Rome" }), TODAY);
    expect(p).not.toBeNull();
    expect(p!.id).toBe("cal:abc");
    expect(p!.kind).toBe("travel");
    expect(p!.source).toBe("calendar");
    expect(p!.confidence).toBeLessThan(1);
    expect(p!.window).toEqual({ start: "2026-07-10" });
  });

  it("keeps a multi-day range and carries location as a note", () => {
    const p = proposeFromCalendarEvent(
      cal({ title: "Trip", startDate: "2026-08-01", endDate: "2026-08-07", allDay: true, location: "Tokyo" }),
      TODAY,
    );
    expect(p!.window).toEqual({ start: "2026-08-01", end: "2026-08-07" });
    expect(p!.note).toBe("Tokyo");
  });

  it("proposes an unclassified MULTI-DAY all-day block as travel", () => {
    const p = proposeFromCalendarEvent(
      cal({ title: "Out of office", startDate: "2026-09-01", endDate: "2026-09-05", allDay: true }),
      TODAY,
    );
    expect(p!.kind).toBe("travel");
  });

  it("skips ordinary single meetings and past events", () => {
    expect(proposeFromCalendarEvent(cal({ title: "Standup" }), TODAY)).toBeNull();
    expect(
      proposeFromCalendarEvent(cal({ title: "Flight", startDate: "2026-06-01", endDate: "2026-06-01" }), TODAY),
    ).toBeNull();
    expect(proposeFromCalendarEvent(cal({ title: "" }), TODAY)).toBeNull();
  });

  it("batch de-duplicates by id and drops the noise", () => {
    const events = [
      cal({ id: "a", title: "Flight to Rome" }),
      cal({ id: "a", title: "Flight to Rome" }), // dup
      cal({ id: "b", title: "Lunch" }), // noise
    ];
    const out = proposeFromCalendar(events, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("cal:a");
  });
});

describe("weather (pure)", () => {
  it("coarsens coordinates to ~1km and builds a keyless Open-Meteo url", () => {
    expect(coarsen(51.50735)).toBe(51.51);
    const url = buildForecastUrl(51.50735, -0.12776);
    expect(url).toContain("latitude=51.51");
    expect(url).toContain("longitude=-0.13");
    expect(url).not.toMatch(/api[_-]?key/i);
  });

  it("describes WMO codes", () => {
    expect(describeWeatherCode(0).group).toBe("clear");
    expect(describeWeatherCode(3).group).toBe("cloud");
    expect(describeWeatherCode(65).group).toBe("rain");
    expect(describeWeatherCode(75).group).toBe("snow");
    expect(describeWeatherCode(95).group).toBe("thunder");
  });

  it("parses an Open-Meteo response", () => {
    const json = {
      current: { temperature_2m: 18.4, weather_code: 61 },
      daily: {
        weather_code: [61],
        temperature_2m_max: [21.2],
        temperature_2m_min: [12.7],
        precipitation_probability_max: [80],
      },
    };
    const w = parseForecast(json, new Date("2026-06-29T08:00:00Z"));
    expect(w.tempC).toBe(18);
    expect(w.group).toBe("rain");
    expect(w.highC).toBe(21);
    expect(w.lowC).toBe(13);
    expect(w.precipChance).toBe(80);
  });

  it("throws on a malformed body", () => {
    expect(() => parseForecast({}, new Date())).toThrow();
  });

  function snap(o: Partial<WeatherSnapshot>): WeatherSnapshot {
    return {
      tempC: 20, code: 0, condition: "Clear", icon: "sunny", group: "clear",
      highC: 24, lowC: 14, precipChance: 5, fetchedAt: new Date().toISOString(), ...o,
    };
  }

  it("hints indoor for rain / storms / extreme temps, outdoor otherwise", () => {
    expect(weatherWorkoutHint(snap({ group: "thunder" })).indoor).toBe(true);
    expect(weatherWorkoutHint(snap({ group: "rain", precipChance: 70 })).indoor).toBe(true);
    expect(weatherWorkoutHint(snap({ group: "clear", highC: 36 })).indoor).toBe(true);
    expect(weatherWorkoutHint(snap({ group: "clear", lowC: -8 })).indoor).toBe(true);
    expect(weatherWorkoutHint(snap({ group: "clear", precipChance: 5 })).indoor).toBe(false);
  });
});

describe("SignalsCoordinator (consent + permission gated)", () => {
  function fakeCalendar(ready: boolean, calls: { sync: number }): CalendarSource {
    return {
      getStatus: async () => ({ permission: ready ? "granted" : "denied", ready }),
      syncToLifeContext: async () => {
        calls.sync++;
        return { proposed: 2 };
      },
    } as unknown as CalendarSource;
  }
  function fakeWeather(ready: boolean, calls: { fetch: number }): WeatherSource {
    return {
      getStatus: async () => ({ permission: ready ? "granted" : "denied", ready }),
      getToday: async () => {
        calls.fetch++;
        return { tempC: 20 } as WeatherSnapshot;
      },
      lastKnown: async () => null,
    } as unknown as WeatherSource;
  }

  it("runs neither sense when consent is denied (default)", async () => {
    const cal = { sync: 0 };
    const wx = { fetch: 0 };
    const consent = new ConsentRepository(new MemoryStore());
    const coord = new SignalsCoordinator(
      fakeCalendar(true, cal),
      fakeWeather(true, wx),
      consent,
    );
    const r = await coord.syncDue();
    expect(cal.sync).toBe(0);
    expect(wx.fetch).toBe(0);
    expect(r).toEqual({ calendarProposed: 0, weatherRefreshed: false });
  });

  it("runs a sense only when consent granted AND permission ready", async () => {
    const cal = { sync: 0 };
    const wx = { fetch: 0 };
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("calendar");
    await consent.grant("location_weather");
    // calendar permission ready, weather permission NOT ready
    const coord = new SignalsCoordinator(
      fakeCalendar(true, cal),
      fakeWeather(false, wx),
      consent,
    );
    const r = await coord.syncDue();
    expect(cal.sync).toBe(1);
    expect(wx.fetch).toBe(0); // consented but OS permission not ready
    expect(r.calendarProposed).toBe(2);
    expect(r.weatherRefreshed).toBe(false);
  });

  it("watching() reports connected state per sense", async () => {
    const consent = new ConsentRepository(new MemoryStore());
    await consent.grant("calendar");
    const coord = new SignalsCoordinator(
      fakeCalendar(true, { sync: 0 }),
      fakeWeather(false, { fetch: 0 }),
      consent,
    );
    const rows = await coord.watching();
    expect(rows.find((r) => r.id === "calendar")!.connected).toBe(true);
    expect(rows.find((r) => r.id === "weather")!.connected).toBe(false);
  });
});
