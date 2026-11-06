/**
 * MOTION (animation/motion.ts) turns the clock into a pose, for the animated
 * panel and the SVG still alike. Everything here is about the figure BEHAVING:
 * a frozen frame is the authored pose, the whole body moves as one, the
 * skeleton stays in one piece, a joint never turns faster than the speed
 * budget, a planted foot stays planted, a hop leaves the floor, the loop has no
 * seam, and the figure always fits the panel (or the ring) it is drawn in.
 */
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import {
  boneTip,
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
import { motionCameras } from "@/fitness/animation/cameras";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { CYCLE_MS, FX, REP_GRID_MS, lutAt, speedBudget } from "@/fitness/animation/tempo";
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
  it("is on the beat grid, and every clock runs the same cycle", () => {
    for (const m of new Set(ALL.map(([mo]) => mo))) {
      const t = motionTempo(m);
      expect(REP_GRID_MS as readonly number[], m).toContain(t.loopMs);
      expect(t.macroMs, m).toBe(CYCLE_MS);
      expect(t.loopMs * t.reps, m).toBe(CYCLE_MS);
    }
  });

  it("is shared by both cameras: one kit per view, one rhythm", () => {
    for (const m of new Set(ALL.map(([mo]) => mo))) {
      if (!FRONT_PROFILES[m] || !SIDE_PROFILES[m]) continue;
      const front = buildMotionKit(m, "front");
      const side = buildMotionKit(m, "side");
      expect(front.loopMs, m).toBe(side.loopMs);
      expect(front.base, m).toBe(side.base);
      expect(front.hop, m).toBe(side.hop);
    }
  });

  it("is cached: the same movement resolves to the same tempo", () => {
    expect(motionTempo("squat")).toBe(motionTempo("squat"));
  });

  it("is neither a blur nor slow motion: cardio once a second or so, strength in three", () => {
    // A jumping jack at about its real cadence, inside the jump budget.
    expect(motionTempo("jumpingJack").loopMs).toBeGreaterThanOrEqual(1000);
    expect(motionTempo("jumpingJack").loopMs).toBeLessThanOrEqual(1500);
    expect(motionTempo("highKnee").loopMs).toBeLessThanOrEqual(1500);
    expect(motionTempo("fastFeet").loopMs).toBeLessThanOrEqual(1500);
    expect(motionTempo("squat").loopMs).toBe(3000);
    expect(motionTempo("pushup").loopMs).toBe(3000);
    for (const m of new Set(ALL.map(([mo]) => mo))) {
      expect(motionTempo(m).loopMs, m).toBeGreaterThanOrEqual(1000);
      expect(motionTempo(m).loopMs, m).toBeLessThanOrEqual(6000);
    }
  });
});

describe("the solved pose", () => {
  it("is exactly the settled pose when the clock is frozen at 0 or the middle of a rep", () => {
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const rig = BUILDERS[view](m);
      const kit = buildMotionKit(m, view);
      const a = solvePose(kit, 0);
      const b = solvePose(kit, 0.5);
      rig.bones.forEach((bone, i) => {
        // The kit's own angles: a planted arm is re-solved to reach what it holds,
        // and everything else is exactly what the rig built.
        if (angleDiff(a[i * 3 + 2], kit.anglesA[i]) > 1e-6) bad.push(`${view} ${m}/${bone.name}@0`);
        if (angleDiff(b[i * 3 + 2], kit.anglesB[i]) > 1e-6) bad.push(`${view} ${m}/${bone.name}@0.5`);
        if (/arm|hand/i.test(bone.name)) return;
        if (angleDiff(kit.anglesA[i], rig.anglesA[i]) > 1e-6) bad.push(`${view} ${m}/${bone.name} A moved`);
        if (angleDiff(kit.anglesB[i], rig.anglesB[i]) > 1e-6) bad.push(`${view} ${m}/${bone.name} B moved`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("moves the whole body as one: every joint is the same share of the way, at every instant", () => {
    // Nothing overshoots and nothing arrives late — the owner's "everything in
    // sync". The one thing behind the body in mid-move is a loose forearm and hand,
    // and arms.test.ts holds them to leaving and arriving with it.
    const bad: string[] = [];
    for (const [m, view] of ALL) {
      const kit = buildMotionKit(m, view);
      const planted = new Set<number>();
      for (let j = 0; j < kit.pins.length; j += 11) [0, 1].forEach((o) => planted.add(kit.pins[j + o]));
      for (let s = 1; s < 24; s++) {
        const q = s / 24;
        const t = lutAt(kit.base, q);
        const pose = solvePose(kit, q);
        for (let i = 0; i < kit.n; i++) {
          if (kit.trail[i] !== 0 || planted.has(i) || kit.depthSlot[i] >= 0) continue;
          const swing = kit.anglesB[i] - kit.anglesA[i];
          if (Math.abs(swing) < 1e-3) continue;
          const share = (pose[i * 3 + 2] - kit.anglesA[i]) / swing;
          if (Math.abs(share - t) > 1e-9) bad.push(`${view} ${m}/${i}@${s}`);
        }
      }
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
          // A bone seen end-on is drawn a little longer than it projects, so it
          // never vanishes; what hangs off it stays on its true end.
          if (kit.depthSlot[p] >= 0) return;
          const [tx, ty] = boneTip(kit, pose, p);
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
          const [x, y] = boneTip(kit, pose, i);
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
          // A bone pointing at the camera has no direction to speak of: what must
          // not jump is the far end of it, which is where the next bone starts.
          if (kit.depthSlot[i] >= 0) {
            if (Math.hypot(pose[i * 3] - prev[i * 3], pose[i * 3 + 1] - prev[i * 3 + 1]) > 2) {
              bad.push(`${view} ${m}/${i}@${s} start`);
            }
            continue;
          }
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
  it("no drawn joint turns faster than its feel allows, on every camera that is shown", () => {
    const tooFast: string[] = [];
    for (const [m, view] of ALL) {
      // A vetoed camera (cameras.ts NOT_SHOWN_FROM) is never drawn, and its
      // swing does not set the tempo.
      if (!motionCameras(m).includes(view)) continue;
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
          // The budget is for the limbs the eye follows. A wrist follows its
          // forearm, and a bone pointing at the camera has no direction to read.
          if (/^(far)?hand/i.test(bone.name) || kit.depthSlot[i] >= 0) return;
          const dps = angleDiff(pose[i * 3 + 2], prev[i * 3 + 2]) / (t.loopMs / N / 1000);
          if (dps > peak) {
            peak = dps;
            who = bone.name;
          }
        });
        prev = pose;
      }
      // Nothing overshoots, so the budget holds as solved (a hair over for
      // sampling a curve at 480 points). A loose forearm catches up late in the
      // move, and an arm goes the way round its joints allow, so an arm gets a
      // quarter more than the body it hangs from: the tempo is the body's.
      const allowed = speedBudget(t.feel) * (/arm/i.test(who) ? 1.25 : 1.02);
      if (peak > allowed) tooFast.push(`${view} ${m} ${who} ${Math.round(peak)}°/s`);
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
  it("are a person's width front-on: brought in for the character, untouched for the pictogram", () => {
    const rig = buildFrontRig("neutral");
    const clav = rig.bones.findIndex((b) => b.name === "clavR");
    expect(SHOULDER_SPREAD).toBeLessThan(0);
    const narrowed = buildMotionKit("neutral", "front", "character").lengths[clav];
    expect(narrowed).toBeCloseTo(rig.bones[clav].length + SHOULDER_SPREAD, 9);
    // Shoulder joints about a quarter of the ~84-unit standing height apart.
    expect(narrowed * 2).toBeGreaterThan(17);
    expect(narrowed * 2).toBeLessThan(22);
    expect(buildMotionKit("neutral", "front", "pictogram").lengths[clav]).toBe(rig.bones[clav].length);
    // The side view has one shoulder and needs no change.
    const side = buildSideRig("squat");
    const sc = side.bones.findIndex((b) => b.name === "clav");
    expect(buildMotionKit("squat", "side", "character").lengths[sc]).toBe(side.bones[sc].length);
  });

  it("stay where they were drawn when the hands bear weight — a hand on a bar stays on the bar", () => {
    const rig = buildFrontRig("pullUp");
    expect(rig.armsFree).toBe(false);
    const clav = rig.bones.findIndex((b) => b.name === "clavR");
    expect(buildMotionKit("pullUp", "front", "character").lengths[clav]).toBe(rig.bones[clav].length);
  });
});

describe("the head", () => {
  it("sits on a neck: the chin clears the shoulder line, the head does not float off it", () => {
    const rig = buildFrontRig("neutral");
    const kit = buildMotionKit("neutral", "front");
    const pose = solvePose(kit, 0);
    const r = headRadius(rig);
    const h = headFrame(kit, pose, r);
    const neck = rig.headBone;
    const chin = pose[neck * 3 + 1] - (h.y + r);
    expect(chin).toBeGreaterThan(1.5);
    expect(chin).toBeLessThan(4.5);
    expect(h.rot).toBeCloseTo(0, 1);
  });

  it("hangs low between the shoulders on a front-on bent-over reverse fly", () => {
    const rig = buildFrontRig("reverseFly");
    const kit = buildMotionKit("reverseFly", "front");
    const pose = solvePose(kit, 0);
    const r = headRadius(rig);
    const h = headFrame(kit, pose, r);
    const neck = rig.headBone;
    // The chin is BELOW the shoulder line: it reads as a body folded forward.
    expect(h.y + r).toBeGreaterThan(pose[neck * 3 + 1]);
  });

  it("turns with the neck", () => {
    const kit = buildMotionKit("hinge", "side");
    const down = neckAngleAt(kit, 0.5);
    const up = neckAngleAt(kit, 0);
    expect(Math.abs(down - up) * DEG).toBeGreaterThan(5);
  });
});

describe("the life layer on the solver's clock", () => {
  it("is only the breath, out on the first frame and keeping time with the rep", () => {
    for (const [m, view] of ALL) {
      const kit = buildMotionKit(m, view);
      const f = solveLife(kit, 0);
      expect(f, `${view} ${m}`).toEqual([0]);
      const q = 0.3;
      expect(solveLife(kit, q / kit.reps)[FX.BREATH]).toBeCloseTo(lutAt(kit.base, q), 9);
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
            const [ex, ey] = boneTip(kit, pose, i);
            for (const [x, y] of [
              [pose[i * 3], pose[i * 3 + 1]],
              [ex, ey],
            ]) {
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
