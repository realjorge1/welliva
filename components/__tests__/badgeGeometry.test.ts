/**
 * The badge drawings. What the 2026-11-01 redesign rests on is pinned here:
 * every tier is its own shape (the rank read at a glance), every drawing stays
 * inside the 100 × 108 box its callers size it by, the glyph sits on the face,
 * and the ribbon appears only on a badge that carries a label.
 */
import { describe, expect, it } from "vitest";
import { BADGE_BOX_H, badgeGeometry } from "../celebration/badgeGeometry";
import {
  MATERIALS,
  TIER_RIBBON,
  TIER_SHAPE,
  badgeShape,
  bareFinish,
  type BadgeShape,
} from "@/services/achievementBadges";
import { ACHIEVEMENTS } from "@/services/AchievementService";

const SHAPES: BadgeShape[] = ["coin", "hex", "shield", "seal", "star"];

/**
 * Every point a path's data visits. The paths use absolute M/L/Q (x,y pairs),
 * H (x alone), V (y alone) and Z — so H and V carry the other coordinate over.
 */
function points(d: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const [, cmd, args] of d.matchAll(/([MLQHVZ])([^MLQHVZ]*)/g)) {
    const nums = (args.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (cmd === "H") for (const n of nums) out.push([(x = n), y]);
    else if (cmd === "V") for (const n of nums) out.push([x, (y = n)]);
    else for (let i = 0; i + 1 < nums.length; i += 2) out.push([(x = nums[i]), (y = nums[i + 1])]);
  }
  return out;
}

describe("a shape per tier", () => {
  it("gives every tier its own outline", () => {
    const shapes = Object.values(TIER_SHAPE);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("covers every achievement, with a ribbon word for its tier", () => {
    for (const def of ACHIEVEMENTS) {
      expect(SHAPES).toContain(badgeShape(def));
      expect(TIER_RIBBON[def.tier]).toMatch(/^[A-Z]+$/);
    }
  });
});

describe("badgeGeometry", () => {
  it.each(SHAPES)("%s stays inside the 100 × 108 box, ribbon or not", (shape) => {
    for (const labelled of [false, true]) {
      const g = badgeGeometry(shape, labelled);
      const all = [g.rim, g.lip, g.rimShine, g.faceShadow, g.face, g.faceShine];
      if (g.ribbon) all.push(g.ribbon.band, g.ribbon.tails, g.ribbon.folds);
      for (const d of all) {
        for (const [x, y] of points(d)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(BADGE_BOX_H);
        }
      }
    }
  });

  it.each(SHAPES)("%s draws closed plates and open strokes of light", (shape) => {
    const g = badgeGeometry(shape);
    for (const d of [g.rim, g.lip, g.faceShadow, g.face]) expect(d.endsWith("Z")).toBe(true);
    // The shine strokes follow the outline for a stretch — never empty, never closed.
    for (const d of [g.rimShine, g.faceShine]) {
      expect(points(d).length).toBeGreaterThan(3);
      expect(d.endsWith("Z")).toBe(false);
    }
  });

  it.each(SHAPES)("%s keeps the glyph on the face and above the ribbon", (shape) => {
    for (const labelled of [false, true]) {
      const g = badgeGeometry(shape, labelled);
      const { cx, cy, size } = g.glyph;
      const d = g.faceDisc;
      expect(Math.hypot(cx - d.cx, cy - d.cy)).toBeLessThan(d.r);
      if (g.ribbon) {
        const bandTop = Math.min(...points(g.ribbon.band).map(([, y]) => y));
        expect(cy + size / 2).toBeLessThanOrEqual(bandTop);
      }
    }
  });

  it.each(SHAPES)("%s's strokes of light run most of their arc", (shape) => {
    // The rim's light spans 200–256°, the face's 200–250°, from each centre.
    const g = badgeGeometry(shape);
    const span = (d: string, cx: number, cy: number) => {
      const deg = points(d).map(([x, y]) => {
        const a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
        return a < 0 ? a + 360 : a;
      });
      return Math.max(...deg) - Math.min(...deg);
    };
    expect(span(g.rimShine, 50, 50)).toBeGreaterThan(56 * 0.75);
    expect(span(g.faceShine, g.faceDisc.cx, g.faceDisc.cy)).toBeGreaterThan(50 * 0.75);
  });

  it("draws a ribbon only for a labelled badge", () => {
    expect(badgeGeometry("hex").ribbon).toBeUndefined();
    expect(badgeGeometry("hex", true).ribbon?.text.width).toBeGreaterThan(0);
  });

  it("is computed once per shape and kept", () => {
    expect(badgeGeometry("seal", true)).toBe(badgeGeometry("seal", true));
  });
});

describe("the unstruck badge", () => {
  it("keeps three tones in both themes, so a locked badge still reads as a badge", () => {
    for (const dark of [false, true]) {
      const { ramp } = bareFinish(dark);
      expect(new Set(ramp).size).toBe(3);
    }
  });

  it("is never one of the real materials", () => {
    const real = new Set(Object.values(MATERIALS).map((m) => m.ramp[1]));
    expect(real.has(bareFinish(false).ramp[1])).toBe(false);
    expect(real.has(bareFinish(true).ramp[1])).toBe(false);
  });
});
