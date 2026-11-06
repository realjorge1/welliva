/**
 * THE DRINKS BEHIND TODAY'S TOTAL.
 *
 * The counter is the truth and the list is its explanation, so what is pinned
 * here is the ways an explanation can go wrong: showing more water than the day
 * holds, losing track of which day a list is for, and handing out one id twice.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_POURS_PER_DAY,
  appendPour,
  asPourLog,
  dropPour,
  newPourId,
  poursOn,
  reconcilePours,
  type Pour,
  type PourLog,
} from "../waterPours";

const pour = (id: string, ml: number, at: string): Pour => ({ id, ml, at });
const DAY = "2026-10-31";

describe("appendPour", () => {
  it("starts a log for the day when there is none", () => {
    const log = appendPour(null, DAY, pour("a", 250, "2026-10-31T08:00:00.000Z"));
    expect(log).toEqual({ date: DAY, pours: [pour("a", 250, "2026-10-31T08:00:00.000Z")] });
  });

  it("adds to the same day's log, in the order recorded", () => {
    let log = appendPour(null, DAY, pour("a", 250, "2026-10-31T08:00:00.000Z"));
    log = appendPour(log, DAY, pour("b", 500, "2026-10-31T09:00:00.000Z"));
    expect(log.pours.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("REPLACES a log from another day instead of adding to it — that is the midnight rollover", () => {
    const yesterday: PourLog = {
      date: "2026-10-30",
      pours: [pour("old", 1000, "2026-10-30T20:00:00.000Z")],
    };
    const log = appendPour(yesterday, DAY, pour("new", 250, "2026-10-31T07:00:00.000Z"));
    expect(log.date).toBe(DAY);
    expect(log.pours.map((p) => p.id)).toEqual(["new"]);
  });

  it("bounds a runaway day, keeping the newest", () => {
    let log: PourLog | null = null;
    for (let i = 0; i < MAX_POURS_PER_DAY + 25; i++) {
      log = appendPour(log, DAY, pour(`p${i}`, 100, `2026-10-31T08:${String(i % 60).padStart(2, "0")}:00.000Z`));
    }
    expect(log!.pours).toHaveLength(MAX_POURS_PER_DAY);
    expect(log!.pours[log!.pours.length - 1].id).toBe(`p${MAX_POURS_PER_DAY + 24}`);
  });
});

describe("dropPour", () => {
  const log: PourLog = {
    date: DAY,
    pours: [pour("a", 250, "2026-10-31T08:00:00.000Z"), pour("b", 500, "2026-10-31T09:00:00.000Z")],
  };

  it("removes exactly the pour asked for and says which one it was", () => {
    const out = dropPour(log, "a");
    expect(out.removed).toEqual(pour("a", 250, "2026-10-31T08:00:00.000Z"));
    expect(out.log!.pours.map((p) => p.id)).toEqual(["b"]);
  });

  it("leaves everything alone, and removes nothing, for an id it has never seen", () => {
    const out = dropPour(log, "zzz");
    expect(out.removed).toBeNull();
    expect(out.log).toEqual(log);
  });

  it("copes with there being no log at all", () => {
    expect(dropPour(null, "a")).toEqual({ log: null, removed: null });
  });

  it("does not mutate the log it was given", () => {
    dropPour(log, "a");
    expect(log.pours).toHaveLength(2);
  });
});

describe("poursOn", () => {
  const log: PourLog = { date: DAY, pours: [pour("a", 250, "2026-10-31T08:00:00.000Z")] };

  it("is the day's pours when the log is that day's", () => {
    expect(poursOn(log, DAY)).toHaveLength(1);
  });

  it("is nothing for another day — a stale list is never shown against a fresh day", () => {
    expect(poursOn(log, "2026-11-01")).toEqual([]);
    expect(poursOn(null, DAY)).toEqual([]);
  });
});

describe("reconcilePours", () => {
  const a = pour("a", 250, "2026-10-31T08:00:00.000Z");
  const b = pour("b", 500, "2026-10-31T10:00:00.000Z");
  const c = pour("c", 250, "2026-10-31T13:00:00.000Z");

  it("lists the newest first when they add up to the total exactly", () => {
    const rows = reconcilePours(1000, [a, b, c]);
    expect(rows.pours.map((p) => p.id)).toEqual(["c", "b", "a"]);
    expect(rows.earlierMl).toBe(0);
  });

  it("orders by WHEN a drink was had, not by when it reached the list", () => {
    // A lock-screen press from 07:00 folded in after a 10:00 in-app tap.
    const late = pour("late", 250, "2026-10-31T07:00:00.000Z");
    const rows = reconcilePours(750, [b, late]);
    expect(rows.pours.map((p) => p.id)).toEqual(["b", "late"]);
  });

  it("calls the shortfall 'earlier' — water the list never saw — instead of inventing a pour", () => {
    const rows = reconcilePours(1500, [a, b]);
    expect(rows.earlierMl).toBe(750);
    expect(rows.pours).toHaveLength(2);
  });

  it("shows only 'earlier' when no drink has been recorded but the day has water", () => {
    expect(reconcilePours(750, [])).toEqual({ pours: [], earlierMl: 750 });
  });

  it("never claims more water than the day holds: the counter wins, oldest pours go first", () => {
    // 1000 ml in the pours, 500 on the counter (lowered elsewhere).
    const rows = reconcilePours(500, [a, b, c]);
    expect(rows.pours.reduce((s, p) => s + p.ml, 0)).toBeLessThanOrEqual(500);
    expect(rows.pours.map((p) => p.id)).toEqual(["c"]);
    expect(rows.earlierMl).toBe(250);
  });

  it("is empty for an empty day", () => {
    expect(reconcilePours(0, [a, b])).toEqual({ pours: [], earlierMl: 0 });
    expect(reconcilePours(0, [])).toEqual({ pours: [], earlierMl: 0 });
  });

  it("survives a bad total", () => {
    expect(reconcilePours(Number.NaN, [a])).toEqual({ pours: [], earlierMl: 0 });
    expect(reconcilePours(-50, [a])).toEqual({ pours: [], earlierMl: 0 });
  });

  it("does not reorder or mutate the list it was given", () => {
    const input = [c, a, b];
    reconcilePours(1000, input);
    expect(input.map((p) => p.id)).toEqual(["c", "a", "b"]);
  });
});

describe("asPourLog", () => {
  it("reads a good log", () => {
    const log = { date: DAY, pours: [pour("a", 250, "2026-10-31T08:00:00.000Z")] };
    expect(asPourLog(log)).toEqual(log);
  });

  it("is null for anything that is not a log, rather than throwing", () => {
    for (const bad of [null, undefined, 5, "x", [], {}, { date: DAY }, { date: 1, pours: [] }]) {
      expect(asPourLog(bad)).toBeNull();
    }
  });

  it("drops malformed pours from an otherwise good log", () => {
    const log = asPourLog({
      date: DAY,
      pours: [
        pour("ok", 250, "2026-10-31T08:00:00.000Z"),
        { id: "no-ml", at: "x" },
        { id: "zero", ml: 0, at: "x" },
        { id: "neg", ml: -5, at: "x" },
        null,
      ],
    });
    expect(log!.pours.map((p) => p.id)).toEqual(["ok"]);
  });
});

describe("newPourId", () => {
  it("is stable for the same inputs and different for different ones", () => {
    expect(newPourId(1_700_000_000_000, 0.5)).toBe(newPourId(1_700_000_000_000, 0.5));
    expect(newPourId(1_700_000_000_000, 0.5)).not.toBe(newPourId(1_700_000_000_001, 0.5));
    expect(newPourId(1_700_000_000_000, 0.5)).not.toBe(newPourId(1_700_000_000_000, 0.6));
  });
});
