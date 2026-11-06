/**
 * Welcome back and fresh-start moments — the same gap as the comeback
 * achievement, once per return, thin-but-not-absent weeks only, and never
 * more than once a fortnight.
 */
import { describe, expect, it } from "vitest";

import { COMEBACK_GAP_DAYS } from "../../AchievementService";
import {
  FRESH_START_DAYS,
  freshMomentDue,
  freshMomentTitle,
  freshStartDay,
  keptLastWeek,
  welcomeBackDue,
  welcomeLine,
} from "../welcomeBack";

describe("welcomeBackDue", () => {
  it("is due after the comeback gap, and names the gap", () => {
    expect(COMEBACK_GAP_DAYS).toBe(7);
    expect(welcomeBackDue({ lastActiveDate: "2026-11-01", totalActiveDays: 30 }, "2026-11-08")).toEqual({
      id: "welcome-back:2026-11-01",
      lastKept: "2026-11-01",
    });
  });

  it("is not due a day sooner", () => {
    expect(welcomeBackDue({ lastActiveDate: "2026-11-02", totalActiveDays: 30 }, "2026-11-08")).toBeNull();
  });

  it("never welcomes back someone who was never here", () => {
    expect(welcomeBackDue({ lastActiveDate: "", totalActiveDays: 0 }, "2026-11-08")).toBeNull();
  });
});

describe("freshMomentDue", () => {
  // 2026-11-02 is a Monday.
  const thin = { days: ["2026-10-28", "2026-10-30"], lastActiveDate: "2026-10-30", totalActiveDays: 20 };

  it("offers on a Monday morning after a thin week", () => {
    expect(freshMomentDue({ streak: thin, today: "2026-11-02", hour: 8, lastOffered: null })).toEqual({
      id: "fresh-start:2026-11-02",
      kind: "monday",
    });
    expect(freshMomentTitle("monday")).toBe("New week. Want a fresh start?");
  });

  it("and on the 1st of the month", () => {
    const s = { days: ["2026-11-27"], lastActiveDate: "2026-11-27", totalActiveDays: 20 };
    expect(freshMomentDue({ streak: s, today: "2026-12-01", hour: 9, lastOffered: null })?.kind).toBe("month");
  });

  it("not in the afternoon, not on a Tuesday", () => {
    expect(freshMomentDue({ streak: thin, today: "2026-11-02", hour: 13, lastOffered: null })).toBeNull();
    expect(freshMomentDue({ streak: thin, today: "2026-11-03", hour: 8, lastOffered: null })).toBeNull();
  });

  it("not after a full week, and not after an empty one (that is a welcome back)", () => {
    const busy = { days: ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"], lastActiveDate: "2026-10-30", totalActiveDays: 20 };
    expect(freshMomentDue({ streak: busy, today: "2026-11-02", hour: 8, lastOffered: null })).toBeNull();
    const gone = { days: ["2026-10-20"], lastActiveDate: "2026-10-20", totalActiveDays: 20 };
    expect(freshMomentDue({ streak: gone, today: "2026-11-02", hour: 8, lastOffered: null })).toBeNull();
  });

  it("at most once a fortnight", () => {
    expect(freshMomentDue({ streak: thin, today: "2026-11-02", hour: 8, lastOffered: "2026-10-26" })).toBeNull();
    expect(freshMomentDue({ streak: thin, today: "2026-11-02", hour: 8, lastOffered: "2026-10-19" })).not.toBeNull();
  });

  it("counts only the seven days before today", () => {
    expect(keptLastWeek(["2026-10-25", "2026-10-26", "2026-11-01", "2026-11-02"], "2026-11-02")).toBe(2);
  });
});

describe("freshStartDay", () => {
  const fresh = { since: "2026-11-08", from: "welcome-back" as const, at: "2026-11-08T09:00:00.000Z" };
  it("counts day 1 to 7, then ends", () => {
    expect(freshStartDay(fresh, "2026-11-08")).toBe(1);
    expect(freshStartDay(fresh, "2026-11-14")).toBe(FRESH_START_DAYS);
    expect(freshStartDay(fresh, "2026-11-15")).toBeNull();
    expect(freshStartDay(null, "2026-11-08")).toBeNull();
  });
});

describe("welcomeLine", () => {
  it("is one warm line, the same all day, never a count", () => {
    const line = welcomeLine("2026-11-08");
    expect(welcomeLine("2026-11-08")).toBe(line);
    expect(line).not.toMatch(/\d/);
    expect(line).not.toMatch(/missed/i);
  });
});
