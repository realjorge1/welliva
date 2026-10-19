/**
 * The daily commitment's read side. Every number Home and the flame screen
 * show comes from here, and the no-cosmetic-counters rule says each must count
 * exactly what it claims — so the two old lies are pinned shut:
 *
 *   • a lapsed streak must read 0, not the number it froze at;
 *   • the week strip must show THIS week's kept days, never last week's.
 */
import { describe, expect, it } from "vitest";
import {
  KEPT_DAYS_CAP,
  commitmentLine,
  commitmentStatus,
  isMilestone,
  liveStreak,
  readCommitment,
  shiftDay,
  weekdayIndex,
  withKeptDay,
  type StreakLike,
} from "../commitment";

const record = (over: Partial<StreakLike> = {}): StreakLike => ({
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "",
  totalActiveDays: 0,
  days: [],
  ...over,
});

// 2026-10-14 is a Wednesday.
const WED = "2026-10-14";

describe("calendar arithmetic", () => {
  it("shifts across month and year ends", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is not thrown by daylight-saving changes", () => {
    // Europe's 2026 change (29 Mar) and the US one (8 Mar) — a 23-hour day
    // must still be exactly one date.
    expect(shiftDay("2026-03-28", 1)).toBe("2026-03-29");
    expect(shiftDay("2026-03-29", 1)).toBe("2026-03-30");
    expect(shiftDay("2026-03-08", -1)).toBe("2026-03-07");
  });

  it("indexes the week from Monday", () => {
    expect(weekdayIndex("2026-10-12")).toBe(0); // Monday
    expect(weekdayIndex(WED)).toBe(2);
    expect(weekdayIndex("2026-10-18")).toBe(6); // Sunday
  });
});

describe("liveStreak — the run as it stands today", () => {
  it("counts a run kept today", () => {
    expect(liveStreak({ currentStreak: 5, lastActiveDate: WED }, WED)).toBe(5);
  });

  it("keeps a run alive through the day after (today is still open)", () => {
    expect(liveStreak({ currentStreak: 5, lastActiveDate: "2026-10-13" }, WED)).toBe(5);
  });

  it("reads a lapsed run as 0, whatever number it froze at", () => {
    expect(liveStreak({ currentStreak: 5, lastActiveDate: "2026-10-12" }, WED)).toBe(0);
    expect(liveStreak({ currentStreak: 40, lastActiveDate: "2026-09-01" }, WED)).toBe(0);
  });

  it("is 0 with no history at all", () => {
    expect(liveStreak({ currentStreak: 0, lastActiveDate: "" }, WED)).toBe(0);
  });
});

describe("withKeptDay — the ledger", () => {
  it("dedupes and keeps dates ascending", () => {
    expect(withKeptDay(["2026-10-13", "2026-10-11"], "2026-10-12")).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(withKeptDay(["2026-10-13"], "2026-10-13")).toEqual(["2026-10-13"]);
  });

  it("starts a ledger for a record written before it existed", () => {
    expect(withKeptDay(undefined, WED)).toEqual([WED]);
  });

  it("drops the OLDEST dates past the cap", () => {
    let days: string[] = [];
    for (let i = KEPT_DAYS_CAP + 5; i > 0; i--) days.push(shiftDay(WED, -i));
    days = withKeptDay(days, WED);
    expect(days).toHaveLength(KEPT_DAYS_CAP);
    expect(days[days.length - 1]).toBe(WED);
    expect(days[0]).toBe(shiftDay(WED, -(KEPT_DAYS_CAP - 1)));
  });
});

describe("readCommitment", () => {
  it("lays out Monday to Sunday with today and the future marked", () => {
    const { week } = readCommitment(record(), WED);
    expect(week.map((d) => d.label)).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
    expect(week.map((d) => d.date)[0]).toBe("2026-10-12");
    expect(week.filter((d) => d.isToday).map((d) => d.date)).toEqual([WED]);
    expect(week.filter((d) => d.isFuture).map((d) => d.label)).toEqual([
      "Th",
      "Fr",
      "Sa",
      "Su",
    ]);
  });

  it("reads kept days off the ledger — never last week's", () => {
    // Kept last Thursday and Friday, then this Monday. A Monday-reset array
    // that missed its Monday used to show Th/Fr ticked in THIS week.
    const s = readCommitment(
      record({
        currentStreak: 1,
        longestStreak: 2,
        lastActiveDate: "2026-10-12",
        totalActiveDays: 3,
        days: ["2026-10-08", "2026-10-09", "2026-10-12"],
      }),
      WED,
    );
    expect(s.week.filter((d) => d.kept).map((d) => d.label)).toEqual(["Mo"]);
    // Kept Monday, missed Tuesday: today the run has lapsed.
    expect(s.streak).toBe(0);
    expect(s.atRisk).toBe(false);
    expect(s.keptToday).toBe(false);
  });

  it("reconstructs the current run for a record with no ledger", () => {
    // Written before 2026-10-15: no `days`, but a run of 3 ending yesterday
    // means Mon, Tue (and the Sunday before) were each kept — exact, not a guess.
    const s = readCommitment(
      {
        currentStreak: 3,
        longestStreak: 9,
        lastActiveDate: "2026-10-13",
        totalActiveDays: 30,
      },
      WED,
    );
    expect(s.week.filter((d) => d.kept).map((d) => d.label)).toEqual(["Mo", "Tu"]);
    expect(s.streak).toBe(3);
    expect(s.atRisk).toBe(true);
    expect(s.best).toBe(9);
  });

  it("knows today is kept", () => {
    const s = readCommitment(
      record({ currentStreak: 4, longestStreak: 4, lastActiveDate: WED, days: [WED] }),
      WED,
    );
    expect(s.keptToday).toBe(true);
    expect(s.atRisk).toBe(false);
    expect(s.week.find((d) => d.isToday)?.kept).toBe(true);
  });

  it("never reports a best below the live run", () => {
    const s = readCommitment(
      record({ currentStreak: 6, longestStreak: 2, lastActiveDate: WED }),
      WED,
    );
    expect(s.best).toBe(6);
  });
});

describe("what the moment says", () => {
  it("is deterministic for a day — never re-rolled on a redraw", () => {
    expect(commitmentLine(4, 20, WED)).toBe(commitmentLine(4, 20, WED));
  });

  it("gives a milestone its own words", () => {
    expect(isMilestone(7)).toBe(true);
    expect(isMilestone(8)).toBe(false);
    expect(commitmentLine(7, 40, WED)).toContain("week");
    expect(commitmentLine(100, 300, WED)).toContain("hundred");
  });

  it("tells a comeback from a first day", () => {
    const first = commitmentLine(1, 1, WED);
    const back = commitmentLine(1, 25, WED);
    expect(first).not.toBe(back);
  });

  it("states where today stands", () => {
    const kept = readCommitment(
      record({ currentStreak: 4, lastActiveDate: WED, days: [WED] }),
      WED,
    );
    expect(commitmentStatus(kept)).toBe("Today's kept. Come back tomorrow for day 5.");

    const atRisk = readCommitment(
      record({ currentStreak: 4, lastActiveDate: "2026-10-13" }),
      WED,
    );
    expect(commitmentStatus(atRisk)).toContain("4-day streak needs today");

    const cold = readCommitment(record(), WED);
    expect(commitmentStatus(cold)).toContain("light today's flame");
  });

  it("never claims a ranking nothing measures", () => {
    // The old Home line said "you're in the top 10% of users" at 14 days.
    for (const n of [1, 2, 5, 14, 30, 100]) {
      for (const total of [1, 50]) {
        expect(commitmentLine(n, total, WED)).not.toMatch(/top \d+%|users/i);
      }
    }
  });
});
