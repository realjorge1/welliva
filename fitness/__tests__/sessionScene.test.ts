/**
 * SESSION SCENE — the stage in the player's hero card holds on a 569dp phone
 * and a 900dp one: the figure stands on the floor line, and the floor's light
 * panels keep honest time without ever reaching above it.
 */
import { describe, expect, it } from "vitest";

import {
  FLOOR_AT,
  auxSize,
  figureBox,
  floorGrid,
  floorSteps,
  litFloor,
  stageOf,
} from "@/fitness/components/sessionScene";

const STAGES = [
  [296, 132], // a 320dp phone at a large font
  [296, 166], // the TECNO / UFI
  [366, 420], // a tall phone
  [400, 560],
] as const;

/** Every corner of a step's panels, as [x, y]. */
function corners(step: string): [number, number][] {
  const nums = (step.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

describe("the stage", () => {
  it("puts the floor at the same share of every stage", () => {
    for (const [w, h] of STAGES) expect(stageOf(w, h).floorY).toBe(Math.round(h * FLOOR_AT));
  });

  it("stands the figure's floor on the floor line, inside the stage", () => {
    for (const [w, h] of STAGES) {
      const stage = stageOf(w, h);
      const box = figureBox(stage);
      expect(Math.abs(box.top + box.size * 0.94 - stage.floorY)).toBeLessThanOrEqual(1);
      expect(box.top).toBeGreaterThanOrEqual(-1);
      expect(box.size * 0.94).toBeLessThanOrEqual(w);
    }
  });

  it("never shrinks the second panel to a smudge, or grows it into the stage", () => {
    for (const [w, h] of STAGES) {
      const s = auxSize(stageOf(w, h));
      expect(s).toBeGreaterThanOrEqual(54);
      expect(s).toBeLessThanOrEqual(110);
    }
  });

  it("draws a floor only when there is room for one", () => {
    expect(floorGrid(stageOf(300, 200))).not.toBe("");
    expect(floorGrid(stageOf(300, 20))).toBe("");
    expect(floorGrid(stageOf(0, 200))).toBe("");
    expect(floorSteps(stageOf(300, 20))).toEqual([]);
  });
});

describe("the floor's light panels — the stage's clock", () => {
  it("has the same number of steps on every phone, so a set reads the same everywhere", () => {
    const counts = STAGES.map(([w, h]) => floorSteps(stageOf(w, h)).length);
    expect(counts[0]).toBeGreaterThanOrEqual(12);
    for (const c of counts) expect(c).toBe(counts[0]);
  });

  it("keeps every panel on the floor — none reaches up beside the figure", () => {
    for (const [w, h] of STAGES) {
      const stage = stageOf(w, h);
      for (const step of floorSteps(stage)) {
        for (const [, y] of corners(step)) {
          expect(y).toBeGreaterThanOrEqual(stage.floorY);
          expect(y).toBeLessThanOrEqual(stage.height);
        }
      }
    }
  });

  it("lights a mirrored pair per step, so the light is always centred on the athlete", () => {
    const stage = stageOf(296, 166);
    for (const step of floorSteps(stage)) {
      const pts = corners(step);
      expect(pts).toHaveLength(8);
      const left = pts.slice(0, 4);
      const right = pts.slice(4);
      left.forEach(([x, y], i) => {
        // The right panel walks its corners in the same order, mirrored.
        const mirror = right[[1, 0, 3, 2][i]];
        expect(mirror[0]).toBeCloseTo(stage.width - x, 1);
        expect(mirror[1]).toBeCloseTo(y, 1);
      });
    }
  });

  it("lights the big front panels in the middle first — and so puts them out last", () => {
    const stage = stageOf(296, 166);
    const steps = floorSteps(stage);
    const first = corners(steps[0]);
    // The first pair touches the card's foot and the centre line.
    expect(Math.max(...first.map(([, y]) => y))).toBeGreaterThan(stage.height - 2);
    const xs = first.map(([x]) => x);
    expect(Math.min(...xs)).toBeLessThan(stage.width / 2);
    expect(Math.max(...xs)).toBeGreaterThan(stage.width / 2);
    // The next pair is the same column, one row further back.
    const second = corners(steps[1]);
    expect(Math.max(...second.map(([, y]) => y))).toBeLessThan(
      Math.min(...first.map(([, y]) => y)) + 1,
    );
  });

  it("lights nothing at zero and everything at one", () => {
    const steps = floorSteps(stageOf(296, 166));
    expect(litFloor(steps, 0)).toBe("");
    expect(litFloor(steps, 1)).toBe(steps.join(""));
    expect(litFloor(steps, 2)).toBe(steps.join(""));
    expect(litFloor(steps, -1)).toBe("");
  });

  it("rounds UP, so the floor goes dark on the second the box runs out, not a step early", () => {
    const steps = floorSteps(stageOf(296, 166));
    // One second left of a long set still keeps a panel on.
    expect(litFloor(steps, 1 / 180)).toBe(steps[0]);
    // Exactly one step's worth is one step, not two.
    expect(litFloor(steps, 1 / steps.length)).toBe(steps[0]);
  });

  it("lights a third of the floor per beat of the 3-2-1", () => {
    const steps = floorSteps(stageOf(296, 166));
    const lengths = [1 / 3, 2 / 3, 1].map((f) => litFloor(steps, f).length);
    expect(lengths[0]).toBeGreaterThan(0);
    expect(lengths[1]).toBeGreaterThan(lengths[0]);
    expect(lengths[2]).toBeGreaterThan(lengths[1]);
    expect(lengths[2]).toBe(steps.join("").length);
  });
});
