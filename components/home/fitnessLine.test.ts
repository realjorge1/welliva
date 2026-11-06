import { describe, expect, it } from "vitest";
import type { WorkoutLogEntry } from "@/models/workout";
import { FITNESS_HISTORY_DAYS, buildFitnessLine } from "./fitnessLine";
import { pointAtLength, sparkline } from "./sparkline";

const TODAY = "2026-10-31";

function session(date: string, minutes: number): WorkoutLogEntry {
  return {
    id: `w-${date}-${minutes}`,
    date,
    sessionId: "s",
    sessionLabel: "Session",
    exercisesCompleted: 5,
    totalExercises: 5,
    completionPercent: 100,
    durationMinutes: minutes,
    completedAt: `${date}T08:00:00.000Z`,
  };
}

describe("buildFitnessLine", () => {
  it("is all zeros, with nothing to compare, on an empty log", () => {
    const f = buildFitnessLine([], TODAY);
    expect(f.minutes).toBe(0);
    expect(f.previous).toBe(0);
    expect(f.deltaPct).toBeNull();
    expect(f.series).toHaveLength(FITNESS_HISTORY_DAYS);
    expect(f.series.every((v) => v === 0)).toBe(true);
  });

  it("sums the seven days ending today, today included", () => {
    const f = buildFitnessLine(
      [
        session("2026-10-31", 30), // today
        session("2026-10-25", 45), // the 7th day back: still inside
        session("2026-10-24", 60), // the 8th day back: outside
      ],
      TODAY,
    );
    expect(f.minutes).toBe(75);
  });

  it("adds two sessions on one day", () => {
    const f = buildFitnessLine([session("2026-10-30", 20), session("2026-10-30", 25)], TODAY);
    expect(f.minutes).toBe(45);
  });

  it("makes the curve's last point exactly the figure beside it", () => {
    const log = [session("2026-10-31", 40), session("2026-10-29", 35), session("2026-10-20", 50)];
    const f = buildFitnessLine(log, TODAY);
    expect(f.series[f.series.length - 1]).toBe(f.minutes);
  });

  it("compares against the seven days BEFORE those, not a part-finished week", () => {
    const f = buildFitnessLine(
      [
        session("2026-10-31", 60), // this window
        session("2026-10-22", 40), // the window before (days 8–14 back)
        session("2026-10-21", 40),
      ],
      TODAY,
    );
    expect(f.minutes).toBe(60);
    expect(f.previous).toBe(80);
    expect(f.deltaPct).toBe(-25);
  });

  it("has no percentage when the earlier week was empty", () => {
    const f = buildFitnessLine([session("2026-10-31", 60)], TODAY);
    expect(f.previous).toBe(0);
    expect(f.deltaPct).toBeNull();
  });

  it("reports a full drop as -100, not as nothing", () => {
    const f = buildFitnessLine([session("2026-10-20", 50)], TODAY);
    expect(f.minutes).toBe(0);
    expect(f.deltaPct).toBe(-100);
  });

  it("rolls across a month boundary", () => {
    const f = buildFitnessLine([session("2026-10-28", 30)], "2026-11-02");
    expect(f.minutes).toBe(30);
  });

  it("ignores entries outside the window entirely", () => {
    const f = buildFitnessLine([session("2025-01-01", 500)], TODAY);
    expect(f.series.every((v) => v === 0)).toBe(true);
  });
});

describe("sparkline", () => {
  const W = 120;
  const H = 56;

  it("is empty for an empty series", () => {
    const s = sparkline([], W, H);
    expect(s).toMatchObject({ d: "", points: [], end: null });
    expect(s.trace.length).toBe(0);
    expect(s.trace.xs).toHaveLength(0);
  });

  it("starts at the first value, ends at the last, and reports the end point", () => {
    const s = sparkline([10, 40, 20, 60], W, H);
    expect(s.d.startsWith("M")).toBe(true);
    expect(s.points).toHaveLength(4);
    expect(s.end).toEqual(s.points[3]);
    expect(s.d.split("C").length - 1).toBe(3);
  });

  it("keeps every point inside the box", () => {
    for (const p of sparkline([0, 90, 5, 130, 70], W, H).points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(H);
    }
  });

  it("draws nothing but zeros as a flat line along the bottom", () => {
    const s = sparkline([0, 0, 0, 0], W, H);
    const ys = new Set(s.points.map((p) => p.y));
    expect(ys.size).toBe(1);
    expect([...ys][0]).toBe(H - 8);
  });

  it("puts a larger value higher on the page (smaller y)", () => {
    const s = sparkline([20, 80], W, H);
    expect(s.points[1].y).toBeLessThan(s.points[0].y);
  });

  it("anchors at zero, so a small wobble stays small", () => {
    const wobble = sparkline([120, 122], W, H);
    const rise = wobble.points[0].y - wobble.points[1].y;
    expect(rise).toBeLessThan(2);
  });

  it("never dips below a flat stretch or climbs above a peak — no invented minutes", () => {
    const s = sparkline([0, 0, 90, 90, 0, 0], W, H);
    const nums = s.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    // Path data alternates x, y; every y must sit between the floor and the peak.
    const ys = nums.filter((_, i) => i % 2 === 1);
    const lo = Math.min(...s.points.map((p) => p.y));
    const hi = Math.max(...s.points.map((p) => p.y));
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(lo - 0.01);
      expect(y).toBeLessThanOrEqual(hi + 0.01);
    }
  });

  it("does not divide by zero when there is no width yet", () => {
    const s = sparkline([10, 20, 30], 0, H, { x: 0, top: 4, bottom: 4 });
    expect(s.d).not.toMatch(/NaN|Infinity/);
  });

  it("handles a single value", () => {
    const s = sparkline([42], W, H);
    expect(s.points).toHaveLength(1);
    expect(s.d.startsWith("M")).toBe(true);
  });
});

describe("the trace the line is drawn on by", () => {
  const W = 200;
  const H = 64;
  const series = [0, 30, 30, 75, 110, 110, 140, 100, 155, 120, 150, 135];

  it("starts on the first point and ends on the last", () => {
    const s = sparkline(series, W, H);
    const { xs, ys, cum, length } = s.trace;
    expect(xs[0]).toBeCloseTo(s.points[0].x, 6);
    expect(ys[0]).toBeCloseTo(s.points[0].y, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(s.end!.x, 6);
    expect(ys[ys.length - 1]).toBeCloseTo(s.end!.y, 6);
    expect(cum[0]).toBe(0);
    expect(cum[cum.length - 1]).toBe(length);
  });

  it("only ever moves left to right, so a reveal really is left to right", () => {
    const { xs } = sparkline(series, W, H).trace;
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
  });

  it("has a running length that never goes backwards", () => {
    const { cum } = sparkline(series, W, H).trace;
    for (let i = 1; i < cum.length; i++) expect(cum[i]).toBeGreaterThanOrEqual(cum[i - 1]);
  });

  it("is at least as long as the straight line across and no longer than the box allows", () => {
    const s = sparkline(series, W, H);
    const straight = s.end!.x - s.points[0].x;
    expect(s.trace.length).toBeGreaterThanOrEqual(straight);
    // A curve through these points cannot be longer than the polyline through them
    // by more than a sliver — it would mean the trace was inventing wiggles.
    let poly = 0;
    for (let i = 1; i < s.points.length; i++) {
      poly += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y);
    }
    expect(s.trace.length).toBeLessThanOrEqual(poly * 1.05);
  });

  it("is a flat line as long as the line is wide when there is nothing but zeros", () => {
    const s = sparkline([0, 0, 0, 0, 0], W, H);
    expect(s.trace.length).toBeCloseTo(W - 16, 4);
  });

  it("copes with one value and with no width", () => {
    expect(sparkline([42], W, H).trace.length).toBe(0);
    const flat = sparkline([5, 9, 7], 0, H, { x: 0, top: 4, bottom: 4 });
    expect(flat.trace.xs).toHaveLength(3);
    expect(Number.isFinite(flat.trace.length)).toBe(true);
  });
});

describe("pointAtLength", () => {
  const s = sparkline([0, 30, 30, 75, 110, 110, 140, 100, 155, 120, 150, 135], 200, 64);
  const { xs, ys, cum, length } = s.trace;

  it("is the start at zero and the end at the full length", () => {
    expect(pointAtLength(xs, ys, cum, 0)).toEqual({ x: xs[0], y: ys[0] });
    const last = pointAtLength(xs, ys, cum, length);
    expect(last.x).toBeCloseTo(xs[xs.length - 1], 9);
    expect(last.y).toBeCloseTo(ys[ys.length - 1], 9);
  });

  it("clamps past both ends instead of leaving the curve", () => {
    expect(pointAtLength(xs, ys, cum, -50)).toEqual({ x: xs[0], y: ys[0] });
    const past = pointAtLength(xs, ys, cum, length * 3);
    expect(past.x).toBeCloseTo(xs[xs.length - 1], 9);
  });

  it("moves steadily right as the pen advances", () => {
    let lastX = -Infinity;
    for (let f = 0; f <= 1.0001; f += 0.02) {
      const p = pointAtLength(xs, ys, cum, f * length);
      expect(p.x).toBeGreaterThanOrEqual(lastX - 1e-9);
      lastX = p.x;
    }
  });

  it("stays on the curve: a halfway pen is as far along the line as the line is long", () => {
    const half = pointAtLength(xs, ys, cum, length / 2);
    // Find that point's own distance along the trace: it must be half the length.
    let along = 0;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] >= half.x) {
        const span = xs[i] - xs[i - 1] || 1;
        const f = (half.x - xs[i - 1]) / span;
        along = cum[i - 1] + (cum[i] - cum[i - 1]) * f;
        break;
      }
    }
    expect(along).toBeCloseTo(length / 2, 3);
  });

  it("returns the origin for an empty trace rather than throwing", () => {
    expect(pointAtLength([], [], [], 10)).toEqual({ x: 0, y: 0 });
  });
});
