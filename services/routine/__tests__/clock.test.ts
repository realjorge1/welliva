/**
 * The routine clock — the gate, the same-day rule, midnight, and the button echo.
 *
 * Fixture times are written WITH an offset ("+00:00"), so the wall clock is the
 * digits in the string whatever zone the test runs in, and dates are built from
 * local parts — never toISOString(), which slides a date west of Greenwich.
 */
import { describe, expect, it } from "vitest";

import {
  circularSpread,
  clockLabel,
  isConsistent,
  minutesApart,
  readRoutine,
  roundToStep,
  wallClockOf,
  type RoutineSample,
} from "../clock";

const TODAY = "2026-11-21";

/** YYYY-MM-DD for TODAY minus `n` days, from local parts. */
function daysAgo(n: number): string {
  const d = new Date(2026, 10, 21);
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A sample at hh:mm wall clock on the day it is for. */
function at(date: string, hh: number, mm: number, echo = false): RoutineSample {
  const pad = (x: number) => String(x).padStart(2, "0");
  return { date, at: `${date}T${pad(hh)}:${pad(mm)}:00+00:00`, echo };
}

describe("wallClockOf", () => {
  it("reads an offset time by its own digits", () => {
    expect(wallClockOf("2026-11-03T21:40:00+01:00")).toEqual({ date: "2026-11-03", minute: 21 * 60 + 40 });
    expect(wallClockOf("2026-11-03T06:05:00.123-05:00")).toEqual({ date: "2026-11-03", minute: 365 });
  });

  it("reads a UTC time in the phone's own zone", () => {
    const iso = new Date(2026, 10, 3, 9, 15).toISOString();
    expect(wallClockOf(iso)).toEqual({ date: "2026-11-03", minute: 9 * 60 + 15 });
  });

  it("refuses what is not a time", () => {
    expect(wallClockOf("")).toBeNull();
    expect(wallClockOf("yesterday")).toBeNull();
    expect(wallClockOf("2026-11-03")).toBeNull();
  });
});

describe("circularSpread", () => {
  it("is the ordinary median and IQR when nothing straddles midnight", () => {
    const { median, iqr } = circularSpread([600, 610, 620, 630, 640]);
    expect(median).toBe(620);
    expect(iqr).toBe(20);
  });

  it("reads 23:50 and 00:10 as one routine around midnight", () => {
    const { median, iqr } = circularSpread([23 * 60 + 50, 10, 23 * 60 + 55, 5]);
    expect(minutesApart(median, 0)).toBeLessThanOrEqual(5);
    expect(iqr).toBeLessThanOrEqual(15);
  });
});

describe("readRoutine — the gate", () => {
  it("says nothing below eight days", () => {
    const samples = [0, 1, 2, 3, 4, 5, 6].map((n) => at(daysAgo(n), 21, 40));
    expect(readRoutine(samples, TODAY)).toBeNull();
  });

  it("names the usual time at eight", () => {
    const samples = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => at(daysAgo(n), 21, 30 + n));
    const r = readRoutine(samples, TODAY);
    expect(r).not.toBeNull();
    expect(r!.count).toBe(8);
    expect(r!.windowDays).toBe(21);
    expect(minutesApart(r!.medianMinute, 21 * 60 + 33)).toBeLessThanOrEqual(1);
    expect(isConsistent(r)).toBe(true);
  });

  it("only reads the window", () => {
    // Eight days, but three of them more than 21 days ago.
    const samples = [0, 1, 2, 3, 4, 21, 22, 30].map((n) => at(daysAgo(n), 8, 0));
    expect(readRoutine(samples, TODAY)).toBeNull();
  });

  it("counts a day once, at its earliest", () => {
    const samples = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((n) => [at(daysAgo(n), 8, 10), at(daysAgo(n), 8, 40)]);
    const r = readRoutine(samples, TODAY)!;
    expect(r.count).toBe(8);
    expect(r.medianMinute).toBe(8 * 60 + 10);
  });

  it("calls a scattered routine inconsistent", () => {
    const hours = [7, 9, 12, 15, 18, 20, 21, 23];
    const samples = hours.map((h, n) => at(daysAgo(n), h, 0));
    const r = readRoutine(samples, TODAY)!;
    expect(r).not.toBeNull();
    expect(isConsistent(r)).toBe(false);
  });
});

describe("readRoutine — back-fills are not times", () => {
  it("ignores a record logged on a different day than it is for", () => {
    const sameDay = [0, 1, 2, 3, 4, 5, 6].map((n) => at(daysAgo(n), 8, 0));
    // Logged the morning after, for the day before: a memory, not a time.
    const backfill: RoutineSample = { date: daysAgo(8), at: `${daysAgo(7)}T07:55:00+00:00` };
    expect(readRoutine([...sameDay, backfill], TODAY)).toBeNull();
  });
});

describe("readRoutine — midnight", () => {
  it("finds a routine that straddles midnight", () => {
    const samples = [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
      n % 2 === 0 ? at(daysAgo(n), 23, 50) : at(daysAgo(n), 0, 10),
    );
    const r = readRoutine(samples, TODAY)!;
    expect(r).not.toBeNull();
    expect(isConsistent(r)).toBe(true);
    expect(minutesApart(r.medianMinute, 0)).toBeLessThanOrEqual(10);
  });
});

describe("readRoutine — the reminder's own button", () => {
  it("leaves echoes out of the time and counts them separately", () => {
    const own = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => at(daysAgo(n), 21, 40));
    const echoes = [8, 9, 10].map((n) => at(daysAgo(n), 19, 2, true));
    const r = readRoutine([...own, ...echoes], TODAY)!;
    expect(r.count).toBe(8);
    expect(r.echoCount).toBe(3);
    expect(r.medianMinute).toBe(21 * 60 + 40);
  });

  it("does not let echoes pass the gate on their own", () => {
    const own = [0, 1, 2, 3].map((n) => at(daysAgo(n), 21, 40));
    const echoes = [4, 5, 6, 7, 8].map((n) => at(daysAgo(n), 19, 1, true));
    expect(readRoutine([...own, ...echoes], TODAY)).toBeNull();
  });
});

describe("helpers", () => {
  it("rounds to the nearest five, around the clock", () => {
    expect(roundToStep(21 * 60 + 32)).toBe(21 * 60 + 30);
    expect(roundToStep(21 * 60 + 33)).toBe(21 * 60 + 35);
    expect(roundToStep(23 * 60 + 58)).toBe(0);
  });

  it("measures the short way round", () => {
    expect(minutesApart(23 * 60 + 50, 10)).toBe(20);
    expect(minutesApart(19 * 60, 21 * 60 + 40)).toBe(160);
  });

  it("writes times the way the reminder rows do", () => {
    expect(clockLabel(21 * 60 + 30)).toBe("9:30 PM");
    expect(clockLabel(0)).toBe("12:00 AM");
    expect(clockLabel(12 * 60 + 5)).toBe("12:05 PM");
  });
});
