import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDay,
  formatRange,
  isIsoDate,
  relativeDays,
  weekdayOf,
} from "../dates";
import {
  endPeriod,
  episodeOn,
  liveEpisodes,
  normalizeEpisodes,
  openEpisode,
  periodDayMap,
  removeEpisode,
  resolveEnd,
  startPeriod,
  togglePeriodDay,
} from "../episodes";
import { NOW, nextId, period } from "./helpers";

const TODAY = "2026-10-15";

describe("dates", () => {
  it("does calendar arithmetic across month, year and leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    // Across the European and US daylight-saving changes, a day is still a day.
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-11-02")).toBe(9);
  });

  it("rejects impossible days", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate(20261015)).toBe(false);
  });

  it("formats days and ranges the short way", () => {
    expect(formatDay("2026-10-28")).toBe("28 Oct");
    expect(formatRange("2026-10-28", "2026-10-31")).toBe("28–31 Oct");
    expect(formatRange("2026-10-28", "2026-11-01")).toBe("28 Oct – 1 Nov");
    expect(formatRange("2026-10-28", "2026-10-28")).toBe("28 Oct");
    expect(weekdayOf("2026-10-15")).toBe(new Date(2026, 9, 15).getDay());
    expect(relativeDays(1)).toBe("tomorrow");
    expect(relativeDays(-3)).toBe("3 days ago");
  });
});

describe("startPeriod / endPeriod", () => {
  it("opens a period that runs through today until it is ended", () => {
    const list = startPeriod([], "2026-10-13", TODAY, 5, NOW, nextId);
    expect(list).toHaveLength(1);
    expect(list[0].end).toBeNull();
    const r = resolveEnd(list[0], TODAY, 5);
    expect(r).toEqual({ end: TODAY, ongoing: true, assumed: false });

    const ended = endPeriod(list, TODAY, TODAY, 5, NOW);
    expect(liveEpisodes(ended)[0].end).toBe(TODAY);
  });

  it("never logs the future", () => {
    expect(startPeriod([], "2026-10-16", TODAY, 5, NOW, nextId)).toEqual([]);
    expect(togglePeriodDay([], "2026-10-20", true, TODAY, 5, NOW, nextId)).toEqual([]);
  });

  it("treats bleeding again within two days of ending as the same period", () => {
    const list = [period("2026-10-08", 5)]; // 8–12 Oct
    const next = startPeriod(list, "2026-10-14", TODAY, 5, NOW, nextId);
    const live = liveEpisodes(next);
    expect(live).toHaveLength(1);
    expect(live[0].start).toBe("2026-10-08");
    expect(live[0].end).toBeNull();
  });

  it("closes a forgotten open period at its typical length when the next one starts", () => {
    const forgotten = { id: nextId(), start: "2026-09-10", end: null, updatedAt: NOW };
    const next = startPeriod([forgotten], "2026-10-08", TODAY, 5, NOW, nextId);
    const live = liveEpisodes(next);
    expect(live).toHaveLength(2);
    expect(live[0].end).toBe("2026-09-14");
    expect(live[0].endEstimated).toBe(true);
    expect(live[1].end).toBeNull();
  });

  it("assumes an unended period this old has ended, and says the end is a guess", () => {
    const stale = { id: nextId(), start: "2026-09-30", end: null, updatedAt: NOW };
    expect(resolveEnd(stale, TODAY, 5)).toEqual({ end: "2026-10-04", ongoing: false, assumed: true });
    expect(openEpisode([stale])?.id).toBe(stale.id);
  });

  it("moves a start earlier when it lands a day or two before a logged period", () => {
    const list = [period("2026-10-10", 4)];
    const next = startPeriod(list, "2026-10-08", TODAY, 5, NOW, nextId);
    expect(liveEpisodes(next)).toHaveLength(1);
    expect(liveEpisodes(next)[0].start).toBe("2026-10-08");
  });
});

describe("togglePeriodDay", () => {
  it("extends a period by an adjacent day, and starts a one-day period on an isolated one", () => {
    const list = [period("2026-10-01", 4)]; // 1–4 Oct
    const extended = togglePeriodDay(list, "2026-10-05", true, TODAY, 5, NOW, nextId);
    expect(liveEpisodes(extended)[0].end).toBe("2026-10-05");

    const isolated = togglePeriodDay(list, "2026-09-10", true, TODAY, 5, NOW, nextId);
    const live = liveEpisodes(isolated);
    expect(live).toHaveLength(2);
    expect(live[0]).toMatchObject({ start: "2026-09-10", end: "2026-09-10" });
  });

  it("ends the period the day before a middle day is switched off — never splits it", () => {
    const list = [period("2026-10-01", 6)]; // 1–6 Oct
    const next = togglePeriodDay(list, "2026-10-04", false, TODAY, 5, NOW, nextId);
    const live = liveEpisodes(next);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ start: "2026-10-01", end: "2026-10-03" });
  });

  it("moves the start when the first day is switched off, and removes a one-day period", () => {
    const list = [period("2026-10-01", 3)];
    const moved = togglePeriodDay(list, "2026-10-01", false, TODAY, 5, NOW, nextId);
    expect(liveEpisodes(moved)[0].start).toBe("2026-10-02");

    const single = [period("2026-10-01", 1)];
    const removed = togglePeriodDay(single, "2026-10-01", false, TODAY, 5, NOW, nextId);
    expect(liveEpisodes(removed)).toEqual([]);
    // The removal is a tombstone, so it wins a merge with another phone.
    expect(removed.find((e) => e.deleted)).toBeDefined();
  });

  it("switching today off during an open period ends it yesterday", () => {
    const open = { id: nextId(), start: "2026-10-12", end: null, updatedAt: NOW };
    const next = togglePeriodDay([open], TODAY, false, TODAY, 5, NOW, nextId);
    expect(liveEpisodes(next)[0].end).toBe("2026-10-14");
  });
});

describe("normalizeEpisodes", () => {
  it("merges the same period recorded on two devices into one", () => {
    const a = period("2026-10-01", 5);
    const b = period("2026-10-02", 6);
    const next = normalizeEpisodes([a, b], TODAY, 5, NOW);
    const live = liveEpisodes(next);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ start: "2026-10-01", end: "2026-10-07" });
    expect(next.filter((e) => e.deleted)).toHaveLength(1);
  });

  it("keeps two separate periods separate", () => {
    const next = normalizeEpisodes([period("2026-09-01"), period("2026-09-29")], TODAY, 5, NOW);
    expect(liveEpisodes(next)).toHaveLength(2);
  });

  it("removeEpisode tombstones exactly one period", () => {
    const a = period("2026-09-01");
    const b = period("2026-09-29");
    const next = removeEpisode([a, b], a.id, TODAY, 5, NOW);
    expect(liveEpisodes(next).map((e) => e.start)).toEqual(["2026-09-29"]);
  });
});

describe("reading periods", () => {
  it("paints logged days, and the guessed tail of a forgotten period as assumed", () => {
    const stale = { id: nextId(), start: "2026-09-30", end: null, updatedAt: NOW };
    const map = periodDayMap([stale], TODAY, 5);
    expect(map.get("2026-09-30")).toBe("logged");
    expect(map.get("2026-10-03")).toBe("assumed");
    expect(map.has("2026-10-05")).toBe(false);
  });

  it("finds the period a day belongs to", () => {
    const list = [period("2026-09-01", 5), period("2026-09-29", 5)];
    expect(episodeOn(list, "2026-09-03", TODAY, 5)?.start).toBe("2026-09-01");
    expect(episodeOn(list, "2026-09-10", TODAY, 5)).toBeNull();
  });
});
