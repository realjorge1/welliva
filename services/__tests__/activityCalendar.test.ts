/**
 * ACTIVITY CALENDAR tests.
 *
 * The calendar achievements ("active in twelve different months", "come back
 * after a week away") are the only ones in the catalogue whose metric isn't a
 * running total someone else already keeps — this function IS the metric. So
 * the cases below are scenarios rather than unit poking: a fortnight off and a
 * return, a week that hasn't finished yet, the same day arriving from three
 * different logs.
 *
 * The rule under test: every number it returns must be countable by hand from
 * the dates it was handed, and none of them may go DOWN while the week runs.
 */
import { describe, expect, it } from "vitest";

import { deriveActivityCalendar } from "../AchievementService";

/** N consecutive days from a start date, inclusive. */
function run(start: string, days: number): string[] {
  const t0 = Date.parse(start + "T00:00:00Z");
  return Array.from({ length: days }, (_, i) =>
    new Date(t0 + i * 86400000).toISOString().slice(0, 10),
  );
}

describe("deriveActivityCalendar", () => {
  it("is all zeros with nothing logged", () => {
    expect(deriveActivityCalendar([], "2026-08-29")).toEqual({
      activeMonths: 0,
      activeWeeks: 0,
      consistentWeeks: 0,
      comebacks: 0,
    });
  });

  it("counts a day once however many logs it arrives from", () => {
    // The caller hands it the union of workouts, weigh-ins and diet rows — one
    // busy day is one day.
    const cal = deriveActivityCalendar(
      ["2026-08-03", "2026-08-03", "2026-08-03"],
      "2026-08-29",
    );
    expect(cal.activeWeeks).toBe(1);
    expect(cal.activeMonths).toBe(1);
  });

  it("counts distinct months, not spans", () => {
    const cal = deriveActivityCalendar(
      ["2026-01-31", "2026-02-01", "2026-06-14"],
      "2026-08-29",
    );
    expect(cal.activeMonths).toBe(3);
  });

  it("splits weeks on Monday, so a weekend is one week and not two", () => {
    // Sat 2026-08-01 + Sun 2026-08-02 are the same week; Mon 2026-08-03 starts
    // the next one.
    const cal = deriveActivityCalendar(
      ["2026-08-01", "2026-08-02", "2026-08-03"],
      "2026-08-29",
    );
    expect(cal.activeWeeks).toBe(2);
  });

  describe("consistent weeks", () => {
    it("needs four days in a finished week", () => {
      // Mon–Wed of the week of 2026-08-03: three days, not enough.
      expect(
        deriveActivityCalendar(run("2026-08-03", 3), "2026-08-29")
          .consistentWeeks,
      ).toBe(0);
      expect(
        deriveActivityCalendar(run("2026-08-03", 4), "2026-08-29")
          .consistentWeeks,
      ).toBe(1);
    });

    it("does not count the week still in progress", () => {
      // Four days logged this week — but the week hasn't finished, so it isn't
      // a record yet. Counting it would tick up mid-week and back down on
      // Monday.
      const thisWeek = run("2026-08-24", 4); // Mon–Thu, today is the Saturday
      expect(
        deriveActivityCalendar(thisWeek, "2026-08-29").consistentWeeks,
      ).toBe(0);
      // Once the week is behind us, it counts.
      expect(
        deriveActivityCalendar(thisWeek, "2026-09-01").consistentWeeks,
      ).toBe(1);
    });

    it("counts every qualifying week across a long history", () => {
      const dates = [
        ...run("2026-06-01", 5), // 5 days, Mon-start week → counts
        ...run("2026-06-08", 2), // 2 days → doesn't
        ...run("2026-06-15", 4), // 4 days → counts
      ];
      expect(deriveActivityCalendar(dates, "2026-08-29").consistentWeeks).toBe(2);
    });
  });

  describe("comebacks", () => {
    it("stays at zero for an unbroken run", () => {
      expect(deriveActivityCalendar(run("2026-06-01", 30), "2026-08-29").comebacks)
        .toBe(0);
    });

    it("ignores a gap shorter than a week", () => {
      // Away Tue–Sun (6 days between logged days), back on Monday.
      const cal = deriveActivityCalendar(
        ["2026-06-01", "2026-06-07"],
        "2026-08-29",
      );
      expect(cal.comebacks).toBe(0);
    });

    it("counts the return after a week or more away", () => {
      const cal = deriveActivityCalendar(
        ["2026-06-01", "2026-06-08"],
        "2026-08-29",
      );
      expect(cal.comebacks).toBe(1);
    });

    it("counts each separate return, not the days lost", () => {
      const cal = deriveActivityCalendar(
        [
          ...run("2026-01-05", 3),
          ...run("2026-02-16", 3), // back after ~6 weeks
          ...run("2026-05-04", 3), // back again after ~10 weeks
        ],
        "2026-08-29",
      );
      expect(cal.comebacks).toBe(2);
    });

    it("cannot be earned by being away — only by coming back", () => {
      // One logged day and then silence: the gap is open, nothing returned.
      const cal = deriveActivityCalendar(["2026-01-05"], "2026-08-29");
      expect(cal.comebacks).toBe(0);
    });
  });

  it("does not care what order the dates arrive in", () => {
    const dates = [...run("2026-06-01", 4), ...run("2026-07-20", 4)];
    const shuffled = [...dates].reverse();
    expect(deriveActivityCalendar(shuffled, "2026-08-29")).toEqual(
      deriveActivityCalendar(dates, "2026-08-29"),
    );
  });
});
