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
  heatTopUpMl,
  parseForecast,
  trainingHourHint,
  weatherAt,
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

  it("keeps ONE copy of the same event carried by several calendars (different ids)", () => {
    // Found on a phone: one public holiday, three calendars, three entries.
    const holiday = { title: "Eid El-Fitr Holiday", startDate: "2026-07-10", endDate: "2026-07-10", allDay: true };
    const out = proposeFromCalendar(
      [
        cal({ id: "h1", ...holiday }),
        cal({ id: "h2", ...holiday, title: "eid el-fitr  holiday" }),
        cal({ id: "h3", ...holiday }),
      ],
      TODAY,
    );
    expect(out.map((p) => p.id)).toEqual(["cal:h1"]);
  });

  it("files an event from a public-holiday calendar as a holiday, never a vacation", () => {
    const p = proposeFromCalendarEvent(
      cal({ title: "Eid El-Fitr Holiday", allDay: true, holidayCalendar: true }),
      TODAY,
    );
    expect(p!.kind).toBe("holiday");
    // Without the calendar's word for it, the title's "holiday" still reads as time off.
    expect(proposeFromCalendarEvent(cal({ title: "Holiday in Spain" }), TODAY)!.kind).toBe("vacation");
    // Every other day of a holiday calendar stays out — no flood of "a holiday's near".
    expect(
      proposeFromCalendarEvent(cal({ title: "Christmas Eve", allDay: true, holidayCalendar: true }), TODAY),
    ).toBeNull();
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

  it("asks for the hourly forecast and parses it by the place's own date and hour", () => {
    expect(buildForecastUrl(6.52, 3.38)).toContain("hourly=temperature_2m,precipitation_probability,weather_code");
    const w = parseForecast(
      {
        current: { temperature_2m: 30, weather_code: 51 },
        daily: { weather_code: [51], temperature_2m_max: [31], temperature_2m_min: [26], precipitation_probability_max: [98] },
        hourly: {
          time: ["2026-11-15T16:00", "2026-11-15T17:00", "2026-11-15T18:00", "bad"],
          temperature_2m: [30.6, 29.8, 28.2, 1],
          precipitation_probability: [40, 85, 20, 0],
          weather_code: [3, 61, 2, 0],
        },
      },
      new Date(),
    );
    expect(w.hours).toHaveLength(3);
    expect(weatherAt(w, "2026-11-15", 17)).toEqual({ date: "2026-11-15", hour: 17, tempC: 30, precipChance: 85, code: 61 });
    expect(weatherAt(w, "2026-11-16", 17)).toBeNull();
  });

  it("speaks about the training hour only when it changes something", () => {
    const hours = (o: { tempC?: number; precipChance?: number; code?: number }) =>
      snap({ hours: [{ date: "2026-11-15", hour: 17, tempC: 26, precipChance: 10, code: 1, ...o }] });
    expect(trainingHourHint(hours({}), "2026-11-15", 17)).toBeNull(); // a fine hour: silence
    expect(trainingHourHint(hours({ precipChance: 85 }), "2026-11-15", 17)?.line).toBe(
      "Rain likely around 5 PM (85%) — this one works indoors.",
    );
    expect(trainingHourHint(hours({ code: 95 }), "2026-11-15", 17)?.indoor).toBe(true);
    expect(trainingHourHint(hours({ tempC: 34 }), "2026-11-15", 17)?.line).toMatch(/^34° around 5 PM/);
    // Not in the forecast (an old snapshot without hours, another day): nothing.
    expect(trainingHourHint(snap({}), "2026-11-15", 17)).toBeNull();
    expect(trainingHourHint(hours({ precipChance: 90 }), "2026-11-16", 17)).toBeNull();
  });

  it("tops water up in small steps for heat, never below 30°", () => {
    expect([29, 30, 32, 33, 35, 36, 40].map(heatTopUpMl)).toEqual([0, 250, 250, 500, 500, 750, 750]);
    expect(heatTopUpMl(undefined)).toBe(0);
    expect(heatTopUpMl(Number.NaN)).toBe(0);
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
