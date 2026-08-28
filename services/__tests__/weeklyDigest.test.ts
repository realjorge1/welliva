/**
 * The weekly digest is the one thing that ARRIVES because someone is paying, so
 * its failure modes are trust failures rather than crashes.
 *
 * Two properties carry the whole feature:
 *   • It must be silent when the week holds nothing. A padded digest built from
 *     two logged days proves to a subscriber that nothing is really being read,
 *     and that is worse than never sending one.
 *   • It must not flatter. A flat week has to say flat and a worse week has to
 *     say worse, or the good weeks stop meaning anything.
 */
import { describe, expect, it } from "vitest";

import { buildWeeklyDigest, summariseWeek } from "../WeeklyDigestService";

/** Mondays: 2026-08-10 (prior) and 2026-08-17 (the week read on 2026-08-24). */
const PRIOR = "2026-08-10";
const WEEK = "2026-08-17";

function days(start: string, n: number, extra: Record<string, number> = {}) {
  return Array.from({ length: n }, (_, i) => {
    const [y, m, d] = start.split("-").map(Number);
    const dt = new Date(y, m - 1, d + i);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")}`;
    return { date, ...extra };
  });
}

/** `forDate` sits in the week AFTER the one being summarised. */
const READ_ON = "2026-08-24";

describe("silence when there is nothing to say", () => {
  it("returns null for an empty week", () => {
    expect(
      buildWeeklyDigest({ forDate: READ_ON, dietHistory: [], workoutLog: [], bodyLogs: [] }),
    ).toBeNull();
  });

  it("returns null for two logged days and one workout", () => {
    expect(
      buildWeeklyDigest({
        forDate: READ_ON,
        dietHistory: days(WEEK, 2),
        workoutLog: days(WEEK, 1),
        bodyLogs: [],
      }),
    ).toBeNull();
  });

  it("speaks up once the week is real", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON,
      dietHistory: days(WEEK, 3),
      workoutLog: [],
      bodyLogs: [],
    });
    expect(digest).not.toBeNull();
    expect(digest!.weekStart).toBe(WEEK);
  });
});

describe("it reads the week that ended, not the one in progress", () => {
  it("summarises the previous Monday–Sunday", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON, // a Monday in the following week
      dietHistory: [...days(WEEK, 7), ...days(READ_ON, 3)],
      workoutLog: [],
      bodyLogs: [],
    })!;
    // 7 of 7 from the completed week; the 3 days of the current week are ignored.
    expect(digest.weekStart).toBe(WEEK);
    expect(digest.lines[0]).toContain("7 of 7");
  });
});

describe("it does not flatter", () => {
  it("says so when logging fell", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON,
      dietHistory: [...days(PRIOR, 7), ...days(WEEK, 4)],
      workoutLog: [],
      bodyLogs: [],
    })!;
    expect(digest.lines[0]).toContain("down from 7");
  });

  it("says so when training fell", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON,
      dietHistory: [...days(PRIOR, 5), ...days(WEEK, 5)],
      workoutLog: [...days(PRIOR, 4), ...days(WEEK, 1)],
      bodyLogs: [],
    })!;
    expect(digest.lines.join(" ")).toContain("fewer than last week");
  });

  it("calls a flat week flat", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON,
      dietHistory: [...days(PRIOR, 5), ...days(WEEK, 5)],
      workoutLog: [],
      bodyLogs: [
        { date: PRIOR, weightKg: 80 },
        { date: WEEK, weightKg: 80 },
      ],
    })!;
    expect(digest.lines[0]).toContain("same as the week before");
    expect(digest.lines.join(" ")).toContain("held flat");
  });

  it("reports a real weight move with its direction", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON,
      dietHistory: [...days(PRIOR, 5), ...days(WEEK, 5)],
      workoutLog: [],
      bodyLogs: [
        { date: PRIOR, weightKg: 80 },
        { date: WEEK, weightKg: 79.2 },
      ],
    })!;
    expect(digest.lines.join(" ")).toContain("down 0.8 kg");
  });
});

describe("shape", () => {
  it("never runs past three lines, and body is the lines joined", () => {
    const digest = buildWeeklyDigest({
      forDate: READ_ON,
      dietHistory: [
        ...days(PRIOR, 3),
        ...days(WEEK, 7, { consumedCalories: 2100, consumedProteinG: 130 }),
      ],
      workoutLog: [...days(PRIOR, 1), ...days(WEEK, 4)],
      bodyLogs: [],
    })!;
    expect(digest.lines.length).toBeLessThanOrEqual(3);
    expect(digest.body).toBe(digest.lines.join(" "));
    expect(digest.title).toBe("Your week, read by Gozlin");
  });
});

describe("summariseWeek", () => {
  it("counts only the seven days of its own week", () => {
    const week = summariseWeek(WEEK, {
      dietHistory: [...days(PRIOR, 7), ...days(WEEK, 5), ...days(READ_ON, 7)],
      workoutLog: days(WEEK, 3),
      bodyLogs: [{ date: PRIOR, weightKg: 90 }],
    });
    expect(week.daysLogged).toBe(5);
    expect(week.workouts).toBe(3);
    expect(week.weightKg).toBeNull(); // the weigh-in belongs to the prior week
  });

  it("averages only the days that actually recorded a number", () => {
    const week = summariseWeek(WEEK, {
      dietHistory: [
        { date: WEEK, consumedCalories: 2000 },
        { date: "2026-08-18", consumedCalories: 2400 },
        { date: "2026-08-19" }, // logged, but no totals captured
      ],
      workoutLog: [],
      bodyLogs: [],
    });
    expect(week.daysLogged).toBe(3);
    expect(week.avgCalories).toBe(2200); // not dragged toward zero by the blank day
    expect(week.avgProteinG).toBeNull();
  });
});
