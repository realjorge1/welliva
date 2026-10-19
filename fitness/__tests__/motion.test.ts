/**
 * MOTION (animation/motion.ts) turns the clock into a pose, for the animated
 * panel and the SVG still alike. Everything here is about the figure BEHAVING:
 * a frozen frame is the authored pose, the skeleton stays in one piece, a joint
 * never turns faster than the speed budget, a planted foot stays planted, a hop
 * leaves the floor, the loop has no seam, and the figure always fits the panel
 * (or the ring) it is drawn in.
 */
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import {
  buildMotionKit,
  framePanel,
  headFrame,
  headRadius,
  motionBounds,
  motionTempo,
  neckAngleAt,
  poseBounds,
  repPhase,
  solveLife,
  solvePose,
  SHOULDER_SPREAD,
} from "@/fitness/animation/motion";
import { motionLoopMs } from "@/fitness/animation/cameras";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { FX, speedBudget } from "@/fitness/animation/tempo";
import { describe, expect, it } from "vitest";

const BUILDERS = { front: buildFrontRig, side: buildSideRig } as const;
const MOTIONS_BY_VIEW = {
  front: Object.keys(FRONT_PROFILES) as FigureMotion[],
  side: Object.keys(SIDE_PROFILES) as FigureMotion[],
} as const;
const ALL: [FigureMotion, "front" | "side"][] = (["front", "side"] as const).flatMap((v) =>
  MOTIONS_BY_VIEW[v].map((m) => [m, v] as [FigureMotion, "front" | "side"]),
);

const DEG = 180 / Math.PI;
const angleDiff = (a: number, b: number): number => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) * DEG;
};

describe("the tempo of every movement", () => {
  it("is shared by both cameras, never faster than authored, and a whole number of 50 ms", () => {
    for (const m of new Set(ALL.map(([mo]) => mo))) {
      const t = motionTempo(m);
      expect(t.loopMs, m).toBeGreaterThanOrEqual(motionLoopMs(m));
      expect(t.loopMs % 50, m).toBe(0);
      expect(t.macroMs, m).toBe(t.loopMs * t.reps);
    }
  });

  it("is cached: the same movement resolves to the same tempo", () => {
    expect(motionTempo("squat")).toBe(motionTempo("squat"));
  });

  it("slows the quick cardio — a jumping jack no longer blurs", () => {
    expect(motionTempo("jumpingJack").loopMs).toBeGreaterThanOrEqual(1200);
    expect(motionTempo("fastFeet").loopMs).toBeGreaterThanOrEqual(800);
    expect(motionTempo("highKnee").loopMs).toBeGreaterThanOrEqual(1000);
    expect(motionTempo("mountainClimber").loopMs).toBeGreaterThanOrEqual(1000);
  });
});

describe("the solved pose", () => {
  it("rests on the authored poses when the clock is frozen at 0 or the middle of a rep", () => {
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const rig = BUILDERS[view](m);
      const kit = buildMotionKit(m, view);
      const a = solvePose(kit, 0);
      const b = solvePose(kit, 0.5);
      rig.bones.forEach((bone, i) => {
        // Joints that trail their parents are a few degrees off on a continuous
        // movement, where there is no pause for them to catch up in.
        if (angleDiff(a[i * 3 + 2], rig.anglesA[i]) > 6) bad.push(`${view} ${m}/${bone.name}@0`);
        if (angleDiff(b[i * 3 + 2], rig.anglesB[i]) > 6) bad.push(`${view} ${m}/${bone.name}@0.5`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("is exact on a lift, a flow and a hold, which pause at both ends", () => {
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const t = motionTempo(m);
      if (t.feel !== "lift" && t.feel !== "flow" && t.feel !== "hold") continue;
      const rig = BUILDERS[view](m);
      const kit = buildMotionKit(m, view);
      const a = solvePose(kit, 0);
      const b = solvePose(kit, 0.5);
      rig.bones.forEach((bone, i) => {
        if (angleDiff(a[i * 3 + 2], rig.anglesA[i]) > 2) bad.push(`${view} ${m}/${bone.name}@0`);
        if (angleDiff(b[i * 3 + 2], rig.anglesB[i]) > 2) bad.push(`${view} ${m}/${bone.name}@0.5`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("keeps the skeleton in one piece: every bone starts where its parent ends", () => {
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const rig = BUILDERS[view](m);
      const kit = buildMotionKit(m, view);
      for (let s = 0; s <= 8; s++) {
        const pose = solvePose(kit, s / 8);
        rig.bones.forEach((bone, i) => {
          if (bone.parent < 0) return;
          const p = bone.parent;
          const tx = pose[p * 3] + kit.lengths[p] * Math.cos(pose[p * 3 + 2]);
          const ty = pose[p * 3 + 1] + kit.lengths[p] * Math.sin(pose[p * 3 + 2]);
          if (Math.hypot(pose[i * 3] - tx, pose[i * 3 + 1] - ty) > 1e-6) bad.push(`${view} ${m}/${bone.name}@${s}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });

  it("never lets a joint leave the drawable box, overshoot and hop included", () => {
    const escaped: string[] = [];
    for (const [m, view] of ALL) {
      const kit = buildMotionKit(m, view);
      for (let s = 0; s <= 24; s++) {
        const pose = solvePose(kit, s / 24);
        for (let i = 0; i < kit.n; i++) {
          const x = pose[i * 3] + kit.lengths[i] * Math.cos(pose[i * 3 + 2]);
          const y = pose[i * 3 + 1] + kit.lengths[i] * Math.sin(pose[i * 3 + 2]);
          if (x < -14 || x > 114 || y < -14 || y > 114) escaped.push(`${view} ${m}@${s}: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        }
      }
    }
    expect(escaped).toEqual([]);
  });

  it("has no seam: the end of a rep is the start of the next", () => {
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const kit = buildMotionKit(m, view);
      const a = solvePose(kit, 0);
      const z = solvePose(kit, 0.999999);
      for (let i = 0; i < kit.n; i++) {
        if (angleDiff(a[i * 3 + 2], z[i * 3 + 2]) > 0.5) bad.push(`${view} ${m}/${i} angle`);
        if (Math.hypot(a[i * 3] - z[i * 3], a[i * 3 + 1] - z[i * 3 + 1]) > 0.3) bad.push(`${view} ${m}/${i} pos`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("moves smoothly: no joint jumps between neighbouring frames", () => {
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const kit = buildMotionKit(m, view);
      const N = 240;
      let prev = solvePose(kit, 0);
      for (let s = 1; s <= N; s++) {
        const pose = solvePose(kit, s / N);
        for (let i = 0; i < kit.n; i++) {
          // 240 steps a rep: a joint turning more than 25° in one is a pop.
          if (angleDiff(pose[i * 3 + 2], prev[i * 3 + 2]) > 25) bad.push(`${view} ${m}/${i}@${s}`);
        }
        prev = pose;
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("the speed budget, measured on the solved pose", () => {
  it("no drawn joint turns faster than its feel allows", () => {
    const tooFast: string[] = [];
    for (const [m, view] of ALL) {
      const rig = BUILDERS[view](m);
      const kit = buildMotionKit(m, view);
      const t = motionTempo(m);
      const N = 480;
      let prev = solvePose(kit, 0);
      let peak = 0;
      let who = "";
      for (let s = 1; s <= N; s++) {
        const pose = solvePose(kit, s / N);
        rig.bones.forEach((bone, i) => {
          if (!bone.draw) return;
          const dps = angleDiff(pose[i * 3 + 2], prev[i * 3 + 2]) / (t.loopMs / N / 1000);
          if (dps > peak) {
            peak = dps;
            who = bone.name;
          }
        });
        prev = pose;
      }
      // A little over for the joints that trail and overshoot (gain > 1).
      if (peak > speedBudget(t.feel) * 1.12) tooFast.push(`${view} ${m} ${who} ${Math.round(peak)}°/s`);
    }
    expect(tooFast).toEqual([]);
  });
});

describe("the planted foot", () => {
  /** The lowest ankle's height through a rep. */
  const ankleRange = (m: FigureMotion, view: "front" | "side") => {
    const kit = buildMotionKit(m, view);
    const ys: number[] = [];
    for (let s = 0; s <= 48; s++) {
      const pose = solvePose(kit, s / 48);
      let low = -Infinity;
      for (const a of kit.ankles) {
        low = Math.max(low, pose[a * 3 + 1] + kit.lengths[a] * Math.sin(pose[a * 3 + 2]));
      }
      ys.push(low);
    }
    return Math.max(...ys) - Math.min(...ys);
  };

  it("stays on the floor through a squat, a push-up, a plank, a curl and a hinge", () => {
    // The bare rig lifts a squat's feet five units off the floor at the bottom.
    for (const [m, view] of [
      ["squat", "front"],
      ["squat", "side"],
      ["gobletSquat", "side"],
      ["sumoSquat", "side"],
      ["pushup", "side"],
      ["plank", "side"],
      ["curl", "front"],
      ["hinge", "side"],
      ["crunch", "side"],
    ] as const) {
      expect(ankleRange(m, view), `${view} ${m}`).toBeLessThan(0.6);
    }
  });

  it("lets go when the feet are meant to leave it", () => {
    expect(buildMotionKit("pullUp", "front").lock).toBe(0);
    expect(buildMotionKit("jumpSquat", "side").lock).toBe(0);
    expect(buildMotionKit("calfRaise", "side").lock).toBe(0);
    expect(ankleRange("calfRaise", "side")).toBeGreaterThan(4);
    expect(buildMotionKit("squat", "side").lock).toBe(1);
  });

  it("a jumping jack leaves the floor in the middle of a hop and lands at each end", () => {
    const kit = buildMotionKit("jumpingJack", "front");
    const bodyY = (q: number) => {
      const pose = solvePose(kit, q);
      return pose[0 * 3 + 1];
    };
    // Higher in the air (smaller y) than on the ground, by the hop.
    expect(bodyY(0.25)).toBeLessThan(bodyY(0) - 3);
    expect(bodyY(0.75)).toBeLessThan(bodyY(0.5) - 3);
    // On the ground at both poses.
    const low = (q: number) => {
      const pose = solvePose(kit, q);
      return Math.max(...kit.ankles.map((a) => pose[a * 3 + 1] + kit.lengths[a] * Math.sin(pose[a * 3 + 2])));
    };
    expect(Math.abs(low(0) - kit.footA)).toBeLessThan(1.2);
    expect(Math.abs(low(0.5) - kit.footB)).toBeLessThan(1.2);
  });
});

describe("the character's shoulders", () => {
  it("are set wider front-on for the character only — the pictogram is untouched", () => {
    const rig = buildFrontRig("squat");
    const clav = rig.bones.findIndex((b) => b.name === "clavR");
    expect(buildMotionKit("squat", "front", "character").lengths[clav]).toBeCloseTo(
      rig.bones[clav].length + SHOULDER_SPREAD,
      9,
    );
    expect(buildMotionKit("squat", "front", "pictogram").lengths[clav]).toBe(rig.bones[clav].length);
    // The side view has one shoulder and needs no spreading.
    const side = buildSideRig("squat");
    const sc = side.bones.findIndex((b) => b.name === "clav");
    expect(buildMotionKit("squat", "side", "character").lengths[sc]).toBe(side.bones[sc].length);
  });
});

describe("the head", () => {
  it("sits one head-radius up the neck, chin at the collar, within a couple of units", () => {
    const rig = buildFrontRig("neutral");
    const kit = buildMotionKit("neutral", "front");
    const pose = solvePose(kit, 0);
    const r = headRadius(rig);
    const h = headFrame(kit, pose, r);
    const neck = rig.headBone;
    const baseY = pose[neck * 3 + 1];
    // Straight up: the head's centre is about one radius above the collar.
    expect(baseY - h.y).toBeGreaterThan(r - 3.5);
    expect(baseY - h.y).toBeLessThan(r + 3);
    expect(h.rot).toBeCloseTo(0, 1);
  });

  it("turns with the neck", () => {
    const kit = buildMotionKit("hinge", "side");
    const down = neckAngleAt(kit, 0.5);
    const up = neckAngleAt(kit, 0);
    expect(Math.abs(down - up) * DEG).toBeGreaterThan(5);
  });
});

describe("the life layer on the solver's clock", () => {
  it("settles its hair on the first frame", () => {
    for (const [m, view] of ALL) {
      const kit = buildMotionKit(m, view);
      const f = solveLife(kit, 0);
      expect(Math.abs(f[FX.SWAY]), `${view} ${m}`).toBeLessThan(0.1);
    }
  });

  it("spans several reps, and its rep position wraps cleanly", () => {
    const kit = buildMotionKit("squat", "side");
    expect(kit.reps).toBeGreaterThanOrEqual(2);
    expect(repPhase(kit, 0)).toBe(0);
    expect(repPhase(kit, 1 / kit.reps)).toBeCloseTo(0, 9);
    expect(repPhase(kit, 0.5 / kit.reps)).toBeCloseTo(0.5, 9);
    expect(repPhase(kit, 0.25)).toBeGreaterThanOrEqual(0);
    expect(repPhase(kit, 0.25)).toBeLessThan(1);
  });
});

describe("framing", () => {
  const SIZE = 240;

  it("fits every movement inside its panel, the whole rep, at a decent scale", () => {
    const bad: string[] = [];
    let smallest = Infinity;
    for (const [m, view] of ALL) {
      const rig = BUILDERS[view](m);
      const kit = buildMotionKit(m, view);
      const b = motionBounds(kit, rig);
      const f = framePanel(b, view, SIZE);
      smallest = Math.min(smallest, f.k / ((SIZE * 0.84) / 100));
      const left = f.tx + b.minX * f.k;
      const right = f.tx + b.maxX * f.k;
      const top = f.ty + b.minY * f.k;
      const floor = f.ty + b.floorY * f.k;
      if (left < -0.5 || right > f.panelW + 0.5 || top < -0.5 || floor > SIZE + 0.5) {
        bad.push(`${view} ${m}: ${left.toFixed(0)}..${right.toFixed(0)} × ${top.toFixed(0)}..${floor.toFixed(0)} in ${f.panelW.toFixed(0)}×${SIZE}`);
      }
    }
    expect(bad).toEqual([]);
    // No movement is shrunk to a speck to make it fit.
    expect(smallest).toBeGreaterThan(0.6);
  });

  it("stands every figure on one baseline", () => {
    const rig = buildFrontRig("squat");
    const kit = buildMotionKit("squat", "front");
    const b = motionBounds(kit, rig);
    const f = framePanel(b, "front", SIZE);
    expect(f.ty + b.floorY * f.k).toBeCloseTo(SIZE - SIZE * 0.06, 6);
  });

  it("gives a head that hangs high (a jump, a step-up) the room it needs", () => {
    for (const m of ["stepUp", "jumpSquat", "pullUp"] as const) {
      const view = "side";
      const rig = buildSideRig(m);
      const kit = buildMotionKit(m, view);
      const b = motionBounds(kit, rig);
      const f = framePanel(b, view, SIZE);
      expect(f.ty + b.minY * f.k, m).toBeGreaterThanOrEqual(-0.5);
    }
  });

  describe("fitted inside a ring", () => {
    const FIT = 100;
    const PANEL = 260;

    it("keeps every joint of every movement inside the circle, over the whole rep", () => {
      const bad: string[] = [];
      for (const [m, view] of ALL) {
        const rig = BUILDERS[view](m);
        const kit = buildMotionKit(m, view);
        const b = motionBounds(kit, rig);
        const f = framePanel(b, view, PANEL, FIT);
        const cx = f.panelW / 2;
        const cy = PANEL / 2;
        let far = 0;
        for (let s = 0; s <= 24; s++) {
          const pose = solvePose(kit, s / 24);
          for (let i = 0; i < kit.n; i++) {
            for (const t of [0, 1]) {
              const x = pose[i * 3] + t * kit.lengths[i] * Math.cos(pose[i * 3 + 2]);
              const y = pose[i * 3 + 1] + t * kit.lengths[i] * Math.sin(pose[i * 3 + 2]);
              far = Math.max(far, Math.hypot(f.tx + x * f.k - cx, f.ty + y * f.k - cy));
            }
          }
        }
        if (far > FIT) bad.push(`${view} ${m}: ${far.toFixed(1)} > ${FIT}`);
      }
      expect(bad).toEqual([]);
    });

    it("is bigger than the standing-on-a-line framing for a compact pose, and never past the canvas", () => {
      const rig = buildFrontRig("curl");
      const kit = buildMotionKit("curl", "front");
      const b = motionBounds(kit, rig);
      const plain = framePanel(b, "front", 190);
      const fitted = framePanel(b, "front", 260, 112);
      expect(fitted.k).toBeGreaterThan(plain.k * 1.1);
      const left = fitted.tx + b.minX * fitted.k;
      const right = fitted.tx + b.maxX * fitted.k;
      expect(left).toBeGreaterThanOrEqual(-0.5);
      expect(right).toBeLessThanOrEqual(fitted.panelW + 0.5);
    });

    it("holds the ground shadow inside the circle too", () => {
      for (const [m, view] of ALL) {
        const rig = BUILDERS[view](m);
        const kit = buildMotionKit(m, view);
        const b = motionBounds(kit, rig);
        const f = framePanel(b, view, PANEL, FIT);
        const cx = f.panelW / 2;
        const cy = PANEL / 2;
        for (const x of [b.shadowX - f.shadowRx, b.shadowX + f.shadowRx]) {
          const d = Math.hypot(f.tx + x * f.k - cx, f.ty + b.floorY * f.k - cy);
          expect(d, `${view} ${m}`).toBeLessThanOrEqual(FIT + 1.5);
        }
      }
    });
  });

  it("measures a single pose for a thumbnail", () => {
    const rig = buildSideRig("pushup");
    const kit = buildMotionKit("pushup", "side");
    const pose = solvePose(kit, 0);
    const one = poseBounds(kit, rig, pose);
    const rep = motionBounds(kit, rig);
    expect(one.maxX - one.minX).toBeLessThanOrEqual(rep.maxX - rep.minX + 1e-6);
    expect(one.floorY).toBeLessThanOrEqual(rep.floorY + 1e-6);
  });
});
