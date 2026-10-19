import { describe, expect, it } from "vitest";
import { computeView } from "../view";
import { dialModel, monthGrid, paintDays, shiftMonthCursor } from "../visual";
import { day, days, history, NOW, nextId, settings } from "./helpers";

const s = settings({ usualCycleDays: 28, showFertileWindow: true });
const regular = history("2026-04-01", [28, 28, 28, 28, 28, 28]); // last start 16 Sep, likely 14 Oct

describe("the dial", () => {
  it("draws the logged period solid, the run-up to the next one lighter, and today", () => {
    const today = "2026-09-30"; // cycle day 15
    const view = computeView({ settings: s, periods: regular, days: {} }, { today, profile: {} });
    const m = dialModel({ episodes: regular, view, today, showFertile: false });
    expect(m.length).toBe(28);
    expect(m.today).toBe(15);
    expect(m.arcs).toEqual([
      { kind: "period", from: 1, to: 5 },
      { kind: "predicted", from: 27, to: 28 },
    ]);
    expect(m.ovulation).toBeNull();
  });

  it("adds the fertile window only when she has chosen to see it", () => {
    const today = "2026-09-30";
    const view = computeView({ settings: s, periods: regular, days: {} }, { today, profile: {} });
    const m = dialModel({ episodes: regular, view, today, showFertile: true });
    expect(m.arcs.find((a) => a.kind === "fertile")).toEqual({ kind: "fertile", from: 10, to: 16 });
    expect(m.ovulation).toBe(15);
  });

  it("shows the rest of an ongoing period as expected, not as logged", () => {
    const today = "2026-10-15";
    const episodes = [...regular, { id: nextId(), start: "2026-10-14", end: null, updatedAt: NOW }];
    const view = computeView({ settings: s, periods: episodes, days: {} }, { today, profile: {} });
    const m = dialModel({ episodes, view, today, showFertile: false });
    expect(m.today).toBe(2);
    expect(m.arcs.slice(0, 2)).toEqual([
      { kind: "period", from: 1, to: 2 },
      { kind: "periodAhead", from: 3, to: 5 },
    ]);
  });

  it("stretches to today when she's late, with the missed window behind her", () => {
    const today = "2026-10-20"; // cycle day 35, window 12–16 Oct
    const view = computeView({ settings: s, periods: regular, days: {} }, { today, profile: {} });
    const m = dialModel({ episodes: regular, view, today, showFertile: false });
    expect(m.length).toBe(35);
    expect(m.today).toBe(35);
    expect(m.arcs.find((a) => a.kind === "predicted")).toEqual({ kind: "predicted", from: 27, to: 31 });
  });

  it("is empty before anything is logged", () => {
    const view = computeView({ settings: s, periods: [], days: {} }, { today: "2026-10-15", profile: {} });
    expect(dialModel({ episodes: [], view, today: "2026-10-15", showFertile: true })).toMatchObject({
      today: null,
      arcs: [],
    });
  });
});

describe("the calendar", () => {
  it("paints logged days, forecasts lighter and further ahead, and marks logged notes", () => {
    const today = "2026-09-30";
    const logs = days(day("2026-09-17", { symptoms: ["cramps"] }));
    const view = computeView({ settings: s, periods: regular, days: logs }, { today, profile: {} });
    const paint = paintDays({ episodes: regular, days: logs, view, today, showFertile: true });
    expect(paint("2026-09-16").period).toBe("logged");
    expect(paint("2026-09-17").hasLog).toBe(true);
    expect(paint("2026-10-14").period).toBe("predicted");
    expect(paint("2026-11-11").period).toBe("predicted"); // the cycle after
    expect(paint("2026-09-30").ovulation).toBe(true);
    expect(paint("2026-09-26").fertile).toBe(true);
    expect(paint("2026-10-05").period).toBeNull();
  });

  it("lays out Monday-first weeks, padded with the neighbouring months", () => {
    const weeks = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
    expect(weeks[0].map((d) => d.date)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(weeks[0][2].inMonth).toBe(false);
    expect(weeks[0][3].inMonth).toBe(true);
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(shiftMonthCursor({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonthCursor({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});
