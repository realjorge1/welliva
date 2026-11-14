/**
 * The cycle dial (components/cycle/CycleDial). Pinned: day 1 sits at the top
 * and days run clockwise, the strokes stay inside their box, the record beats a
 * forecast, today is a needle and not a stroke, everything before today is lit
 * and nothing after it is, the shapes swell where they should, and the small
 * Home dial carries no inner line.
 */
import { describe, expect, it } from "vitest";
import type { DialModel } from "@/services/cycle/visual";
import {
  BEZEL_SHARE,
  DIAL_MAX_PER_DAY,
  cycleDialLayout,
  dayKinds,
  dialPoint,
  dropPath,
  mixHex,
  strokeShares,
  verticalShare,
} from "../cycle/cycleDialLayout";

const MODEL: DialModel = {
  length: 29,
  today: 18,
  arcs: [
    { kind: "period", from: 1, to: 5 },
    { kind: "fertile", from: 10, to: 16 },
    { kind: "predicted", from: 27, to: 29 },
  ],
  ovulation: 15,
};

/** Both ends of an "M x y L x y" stroke. */
function ends(d: string): [number, number, number, number] {
  const m = /^M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)$/.exec(d);
  if (!m) throw new Error(`not a stroke: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

describe("dayKinds", () => {
  it("labels each day, the record over the forecast, ovulation inside the fertile run", () => {
    const k = dayKinds(MODEL);
    expect(k).toHaveLength(29);
    expect(k[0]).toBe("period");
    expect(k[5]).toBe("plain");
    expect(k[9]).toBe("fertile");
    expect(k[14]).toBe("ovulation");
    expect(k[28]).toBe("predicted");
  });

  it("never paints a forecast over a logged period day", () => {
    const k = dayKinds({
      length: 10,
      today: 2,
      arcs: [
        { kind: "predicted", from: 1, to: 4 },
        { kind: "period", from: 1, to: 2 },
        { kind: "periodAhead", from: 3, to: 3 },
      ],
      ovulation: 2,
    });
    expect(k.slice(0, 4)).toEqual(["period", "period", "periodAhead", "predicted"]);
  });
});

describe("strokeShares", () => {
  it("swells through a period and peaks on the ovulation day", () => {
    const kinds = dayKinds(MODEL);
    const per = 4;
    const s = strokeShares(kinds, per);
    const mid = (day: number) => s[(day - 1) * per + Math.floor(per / 2)];
    // A period's middle is the full length; an ordinary day is short.
    expect(mid(3)).toBeCloseTo(1, 5);
    expect(mid(7)).toBeLessThan(0.6);
    // The fertile run rises toward ovulation and falls after it.
    expect(mid(15)).toBeGreaterThan(mid(12));
    expect(mid(15)).toBeGreaterThan(mid(16));
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
  });

  it("marks the start of each week on ordinary days", () => {
    const kinds = dayKinds({ length: 29, today: null, arcs: [], ovulation: null });
    const s = strokeShares(kinds, 1);
    expect(s[7]).toBeGreaterThan(s[6]); // day 8
    expect(s[14]).toBeGreaterThan(s[13]); // day 15
  });
});

describe("cycleDialLayout", () => {
  const SIZE = 300;
  const g = cycleDialLayout(MODEL, SIZE);

  it("matches the calorie dial's density, within a cap per day", () => {
    expect(g.perDay).toBeGreaterThanOrEqual(1);
    expect(g.perDay).toBeLessThanOrEqual(DIAL_MAX_PER_DAY);
    expect(g.total).toBe(MODEL.length * g.perDay);
    const spacing = (2 * Math.PI * g.outerR) / g.total;
    expect(spacing).toBeGreaterThan(5);
    expect(spacing).toBeLessThan(10);
  });

  it("starts at the top and runs clockwise", () => {
    const first = ends(g.strokes[0].d);
    // Day 1's first stroke sits just right of 12 o'clock.
    expect(first[2]).toBeGreaterThan(SIZE / 2);
    expect(first[3]).toBeLessThan(SIZE / 4);
    const quarter = g.strokes.find((s) => s.index === Math.round(g.total / 4));
    const q = ends(quarter!.d);
    // A quarter of the way round is 3 o'clock.
    expect(q[2]).toBeGreaterThan(SIZE * 0.9);
  });

  it("keeps every stroke and the needle inside the box", () => {
    for (const s of g.strokes) {
      const [x1, y1, x2, y2] = ends(s.d);
      for (const v of [x1, y1, x2, y2]) {
        expect(v).toBeGreaterThanOrEqual(g.strokeWidth / 2);
        expect(v).toBeLessThanOrEqual(SIZE - g.strokeWidth / 2);
      }
    }
    const n = g.needle!;
    for (const v of [n.x1, n.y1, n.x2, n.y2]) {
      expect(v).toBeGreaterThanOrEqual(n.width / 2);
      expect(v).toBeLessThanOrEqual(SIZE - n.width / 2);
    }
  });

  it("puts the needle on today, lights what is behind it and nothing ahead", () => {
    expect(g.todayIndex).toBe((18 - 1) * g.perDay + Math.floor(g.perDay / 2));
    expect(g.strokes.some((s) => s.index === g.todayIndex)).toBe(false);
    expect(g.strokes.filter((s) => s.lit).every((s) => s.index < g.todayIndex)).toBe(true);
    expect(g.strokes.filter((s) => !s.lit).every((s) => s.index > g.todayIndex)).toBe(true);
    expect(g.todayKind).toBe("plain");
    // The needle reaches deeper than any stroke.
    const deepest = Math.min(
      ...g.strokes.map((s) => {
        const [x, y] = ends(s.d);
        return Math.hypot(x - SIZE / 2, y - SIZE / 2);
      }),
    );
    expect(Math.hypot(g.needle!.x1 - SIZE / 2, g.needle!.y1 - SIZE / 2)).toBeLessThan(deepest);
  });

  it("keeps the inner line clear of the deepest needle", () => {
    expect(g.compact).toBe(false);
    const needleInner = Math.hypot(g.needle!.x1 - SIZE / 2, g.needle!.y1 - SIZE / 2);
    expect(g.innerR + g.innerWidth / 2).toBeLessThan(needleInner);
    expect(g.ovulationDeg).not.toBeNull();
  });

  it("draws Home's small dial as strokes and needle only", () => {
    const small = cycleDialLayout(MODEL, 78);
    expect(small.compact).toBe(true);
    expect(small.innerR).toBe(0);
    expect(small.perDay).toBe(1);
    expect(small.needle).not.toBeNull();
    expect(small.bezel).toEqual([]);
    expect(small.bezelR).toBe(0);
  });

  it("gives every stroke its angle, in sweep order", () => {
    for (let i = 1; i < g.strokes.length; i++) {
      expect(g.strokes[i].deg).toBeGreaterThan(g.strokes[i - 1].deg);
    }
  });

  it("leaves the bezel band clear of every stroke and the needle", () => {
    const band = SIZE * BEZEL_SHARE;
    const limit = SIZE / 2 - band;
    for (const s of g.strokes) {
      const [, , x, y] = ends(s.d);
      expect(Math.hypot(x - SIZE / 2, y - SIZE / 2) + g.strokeWidth / 2).toBeLessThanOrEqual(limit + 0.01);
    }
    const n = g.needle!;
    expect(Math.hypot(n.x2 - SIZE / 2, n.y2 - SIZE / 2) + n.width / 2).toBeLessThanOrEqual(limit + 0.01);
  });

  it("puts a drop at the top, an egg on ovulation, and week numbers that never crowd either", () => {
    const drop = g.bezel.find((m) => m.kind === "drop");
    const egg = g.bezel.find((m) => m.kind === "egg");
    expect(drop?.deg).toBe(0);
    expect(egg?.deg).toBe(g.ovulationDeg);
    const weeks = g.bezel.filter((m) => m.kind === "week");
    // Day 15 sits on the egg (ovulation is day 15) and day 29 on the drop: both left out.
    expect(weeks.map((m) => (m.kind === "week" ? m.day : 0))).toEqual([8, 22]);
    for (const m of g.bezel) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(SIZE);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(SIZE);
    }
  });

  it("with the fertile window hidden, the bezel has no egg and keeps day 15", () => {
    const hidden = cycleDialLayout({ ...MODEL, arcs: MODEL.arcs.filter((a) => a.kind !== "fertile"), ovulation: null }, SIZE);
    expect(hidden.bezel.some((m) => m.kind === "egg")).toBe(false);
    expect(hidden.bezel.filter((m) => m.kind === "week").map((m) => (m.kind === "week" ? m.day : 0))).toEqual([8, 15, 22]);
  });

  it("with nothing logged, draws the ring with no needle and nothing lit", () => {
    const empty = cycleDialLayout({ length: 29, today: null, arcs: [], ovulation: null }, 300);
    expect(empty.needle).toBeNull();
    expect(empty.todayDeg).toBeNull();
    expect(empty.strokes.every((s) => !s.lit)).toBe(true);
    expect(empty.strokes).toHaveLength(empty.total);
  });

  it("stays usable on a long, late cycle", () => {
    const late = cycleDialLayout({ length: 70, today: 70, arcs: [{ kind: "period", from: 1, to: 5 }], ovulation: null }, 300);
    expect(late.total).toBe(70 * late.perDay);
    expect(late.strokeWidth).toBeGreaterThanOrEqual(1.6);
    expect(late.todayDeg!).toBeLessThan(360);
  });
});

describe("helpers", () => {
  it("dialPoint: 0° is the top, 90° is the right", () => {
    expect(dialPoint(100, 40, 0)).toEqual({ x: 50, y: 10 });
    expect(dialPoint(100, 40, 90)).toEqual({ x: 90, y: 50 });
  });

  it("dropPath: one closed shape whose point faces away from the centre", () => {
    const d = dropPath(150, 20, 0, 12);
    expect(d.startsWith("M150 13.4")).toBe(true); // the point, above its centre at the top
    expect(d.endsWith("Z")).toBe(true);
    const turned = dropPath(280, 150, 90, 12);
    expect(turned.startsWith("M286.6 150")).toBe(true); // at 3 o'clock it points right
  });

  it("verticalShare: top 0, bottom 1", () => {
    expect(verticalShare(0)).toBeCloseTo(0);
    expect(verticalShare(180)).toBeCloseTo(1);
    expect(verticalShare(90)).toBeCloseTo(0.5);
  });

  it("mixHex blends, and returns the first colour for anything it can't read", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#F2789A", "#B8A4F4", 0)).toBe("#f2789a");
    expect(mixHex("#F2789A", "#B8A4F4", 1)).toBe("#b8a4f4");
    expect(mixHex("rgba(0,0,0,1)", "#ffffff", 0.5)).toBe("rgba(0,0,0,1)");
  });
});
