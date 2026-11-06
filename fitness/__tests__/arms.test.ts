/**
 * THE ARMS. The owner's report: "the arms are not as flexible and smooth as the
 * legs". The legs had joints (a knee that folds one way, a foot set by its ankle,
 * a planted foot that stays planted); the arms were two rods turning about a
 * fixed point. These hold each thing the arm was given, on the solved pose every
 * renderer draws from: see rig.ts "The arms" and motion.ts "The hands".
 */
import { motionCameras } from "@/fitness/animation/cameras";
import { boneTip, buildMotionKit, motionTempo, solvePose, type MotionKit } from "@/fitness/animation/motion";
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig, type Rig } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { lutAt } from "@/fitness/animation/tempo";
import { describe, expect, it } from "vitest";

type View = "front" | "side";
const BUILD = { front: buildFrontRig, side: buildSideRig } as const;
const DEG = 180 / Math.PI;
const wrap = (a: number): number => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x <= -Math.PI) x += Math.PI * 2;
  return x;
};

const SHOWN: [FigureMotion, View][] = [...new Set([...Object.keys(FRONT_PROFILES), ...Object.keys(SIDE_PROFILES)])].flatMap(
  (m) => motionCameras(m as FigureMotion).map((v) => [m, v] as [FigureMotion, View]),
);

/** Every arm of every shown camera, with its rig and kit. */
function eachArm(visit: (m: FigureMotion, v: View, rig: Rig, k: MotionKit, arm: Rig["arms"][number]) => void): void {
  for (const [m, v] of SHOWN) {
    const rig = BUILD[v](m);
    const k = buildMotionKit(m, v);
    for (const arm of rig.arms) visit(m, v, rig, k, arm);
  }
}

const REP = Array.from({ length: 49 }, (_, s) => s / 48);

describe("an elbow folds one way", () => {
  // The doorway stretch holds its upper arm out to the side and its forearm up:
  // the arm is out of the picture's plane, so side-on it has no fold to read.
  const OUT_OF_PLANE = new Set<FigureMotion>(["doorwayStretch"]);

  it("side-on, at every instant of every movement", () => {
    const wrong: string[] = [];
    eachArm((m, v, rig, k, arm) => {
      if (v !== "side" || OUT_OF_PLANE.has(m)) return;
      for (const q of REP) {
        const p = solvePose(k, q);
        // What the bend is, measured the way round the elbow actually folds.
        const bend = wrap(rig.facing * (p[arm.upper * 3 + 2] - p[arm.fore * 3 + 2]));
        if (bend * DEG < -4) wrong.push(`${m}/${rig.bones[arm.fore].name}@${q.toFixed(2)}: ${(bend * DEG).toFixed(0)}°`);
      }
    });
    expect(wrong).toEqual([]);
  });

  it("does not spin the forearm against the upper arm: a jump squat's arm swings up whole", () => {
    const rig = buildSideRig("jumpSquat");
    const k = buildMotionKit("jumpSquat", "side");
    const arm = rig.arms[0];
    for (const q of REP) {
      const p = solvePose(k, q);
      const bend = wrap(p[arm.upper * 3 + 2] - p[arm.fore * 3 + 2]) * DEG;
      expect(Math.abs(bend), `q ${q}`).toBeLessThan(45);
    }
  });

  it("brings a tapping hand up in front of the shoulder, not back through the hip", () => {
    const rig = buildSideRig("shoulderTap");
    const k = buildMotionKit("shoulderTap", "side");
    const fore = rig.arms[0].fore;
    const hips = solvePose(k, 0.25)[0];
    for (const q of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45]) {
      const [x] = boneTip(k, solvePose(k, q), fore);
      expect(x, `q ${q}`).toBeGreaterThan(hips + 20);
    }
  });
});

describe("an upper arm goes round the front of the body", () => {
  it("presses overhead through the front, never behind the back", () => {
    const rig = buildSideRig("push");
    const k = buildMotionKit("push", "side");
    const { upper } = rig.arms[0];
    // Halfway, the elbow is out in front of the shoulder.
    const p = solvePose(k, 0.25);
    expect(boneTip(k, p, upper)[0]).toBeGreaterThan(p[upper * 3]);
  });
});

describe("a hand that holds something stays held", () => {
  /** How far a planted wrist gets from where it is pinned, over a rep. */
  const wander = (k: MotionKit, j: number): number => {
    const f = k.pins[j + 1];
    let most = 0;
    for (const q of REP) {
      const share = lutAt(k.base, q);
      const x = k.pins[j + 3] + (k.pins[j + 5] - k.pins[j + 3]) * share;
      const y = k.pins[j + 4] + (k.pins[j + 6] - k.pins[j + 4]) * share - k.pins[j + 10] * Math.sin(Math.PI * share);
      const [wx, wy] = boneTip(k, solvePose(k, q), f);
      most = Math.max(most, Math.hypot(wx - x, wy - y));
    }
    return most;
  };

  it("on the floor, the bar, the wall and the bench", () => {
    for (const [m, v] of [
      ["pushup", "side"],
      ["plank", "side"],
      ["kneePushup", "side"],
      ["declinePushup", "side"],
      ["inclinePushup", "side"],
      ["wallPushup", "side"],
      ["dip", "side"],
      ["handstandPushup", "side"],
      ["pullUp", "side"],
      ["pullUp", "front"],
      ["invertedRow", "side"],
      ["leanRow", "side"],
      ["catCow", "side"],
    ] as [FigureMotion, View][]) {
      const k = buildMotionKit(m, v);
      expect(k.pins.length, `${v} ${m} is planted`).toBe(22);
      for (let j = 0; j < k.pins.length; j += 11) {
        expect(wander(k, j), `${v} ${m}`).toBeLessThan(0.3);
      }
    }
  });

  it("everywhere, within what the body's own path allows", () => {
    // A rep's two poses are all there is, and between them a body can pass out of
    // an arm's reach: a mountain climber's bob lifts a hand this little, and a
    // Hindu push-up's swoop (which rises where a real one dips) a little more.
    const far: string[] = [];
    for (const [m, v] of SHOWN) {
      const k = buildMotionKit(m, v);
      for (let j = 0; j < k.pins.length; j += 11) {
        const w = wander(k, j);
        if (w > (m === "hinduPushup" ? 4 : 2.5)) far.push(`${v} ${m} ${w.toFixed(1)}`);
      }
    }
    expect(far).toEqual([]);
  });

  it("does not catch a hand that holds nothing", () => {
    for (const [m, v] of [
      ["squat", "side"],
      ["curl", "side"],
      ["jumpingJack", "front"],
      ["jumpRope", "front"],
      ["lunge", "side"],
      ["figureFour", "side"],
      ["hipThrust", "side"],
    ] as [FigureMotion, View][]) {
      expect(buildMotionKit(m, v).pins, `${v} ${m}`).toEqual([]);
    }
  });

  it("locks out a push-up: the arm is all but straight at the top and folds at the bottom", () => {
    const rig = buildSideRig("pushup");
    const k = buildMotionKit("pushup", "side");
    const { upper, fore } = rig.arms[0];
    const bend = (q: number) => {
      const p = solvePose(k, q);
      return wrap(p[upper * 3 + 2] - p[fore * 3 + 2]) * DEG;
    };
    expect(bend(0)).toBeGreaterThanOrEqual(0);
    expect(bend(0)).toBeLessThan(20);
    expect(bend(0.5)).toBeGreaterThan(90);
  });

  it("has no snap as an arm leaves straight: the elbow moves on from it, frame by frame", () => {
    // An elbow solved to dead straight jumped 13° in one frame in a bear crawl.
    for (const m of ["bearCrawl", "hinduPushup", "pushup", "mountainClimber"] as FigureMotion[]) {
      const rig = buildSideRig(m);
      const k = buildMotionKit(m, "side");
      const { upper, fore } = rig.arms[0];
      const bend = (q: number) => {
        const p = solvePose(k, q);
        return wrap(p[upper * 3 + 2] - p[fore * 3 + 2]) * DEG;
      };
      let prev = bend(0);
      for (let s = 1; s <= 240; s++) {
        const now = bend(s / 240);
        expect(Math.abs(now - prev), `${m} @${s}`).toBeLessThan(6);
        prev = now;
      }
    }
  });

  it("lays a hand on the floor flat, grips a bar and sets a palm on a wall", () => {
    const handAngle = (m: FigureMotion, v: View) => {
      const rig = BUILD[v](m);
      const k = buildMotionKit(m, v);
      return solvePose(k, 0.25)[rig.arms[0].hand * 3 + 2];
    };
    // Flat: within a third of a right angle of level.
    expect(Math.abs(Math.sin(handAngle("pushup", "side")))).toBeLessThan(0.5);
    // Fingers forward: toward the way the body faces.
    expect(Math.cos(handAngle("pushup", "side"))).toBeGreaterThan(0.5);
    expect(Math.cos(handAngle("cobra", "side"))).toBeLessThan(-0.5);
    // Up, on the bar and on the wall.
    expect(Math.sin(handAngle("pullUp", "side"))).toBeLessThan(-0.8);
    expect(Math.sin(handAngle("wallPushup", "side"))).toBeLessThan(-0.8);
  });

  it("holds the hand's set still while the arm moves over it, however far the wrist bends", () => {
    const rig = buildSideRig("pushup");
    const k = buildMotionKit("pushup", "side");
    const { hand, fore } = rig.arms[0];
    const at = (q: number) => solvePose(k, q);
    expect(at(0.1)[hand * 3 + 2]).toBeCloseTo(at(0.4)[hand * 3 + 2], 6);
    expect(Math.abs(wrap(at(0.1)[fore * 3 + 2] - at(0.4)[fore * 3 + 2])) * DEG).toBeGreaterThan(15);
  });

  it("lifts a crawling hand as it steps, and the same hand lands on the floor it left", () => {
    const rig = buildSideRig("bearCrawl");
    const k = buildMotionKit("bearCrawl", "side");
    const fore = rig.arms[0].fore;
    const wrist = (q: number) => boneTip(k, solvePose(k, q), fore);
    expect(wrist(0)[1] - wrist(0.25)[1]).toBeGreaterThan(1);
    expect(Math.abs(wrist(0)[1] - wrist(0.5)[1])).toBeLessThan(1);
    expect(Math.abs(wrist(0)[0] - wrist(0.5)[0])).toBeGreaterThan(5);
  });
});

describe("a free arm is loose", () => {
  it("is never dead straight: an unloaded elbow rests a little bent", () => {
    const stiff: string[] = [];
    eachArm((m, v, rig, k, arm) => {
      if (!rig.armsFree || k.depthSlot[arm.fore] >= 0) return;
      for (const q of [0, 0.5]) {
        const p = solvePose(k, q);
        // Front-on the bend runs out as an arm passes level, so only a hanging or
        // raised arm is held to it.
        if (v === "front" && Math.abs(Math.sin(p[arm.upper * 3 + 2])) < 0.5) continue;
        const bend = Math.abs(wrap(p[arm.upper * 3 + 2] - p[arm.fore * 3 + 2])) * DEG;
        if (bend < 7) stiff.push(`${v} ${m}/${rig.bones[arm.fore].name}@${q}: ${bend.toFixed(1)}°`);
      }
    });
    expect(stiff).toEqual([]);
  });

  it("bends a swinging elbow on the way, and takes a different line home", () => {
    const rig = buildFrontRig("jumpingJack");
    const k = buildMotionKit("jumpingJack", "front");
    const { fore } = rig.arms[0];
    // The same point of the swing going and coming: the hand is on another line.
    const at = (q: number) => boneTip(k, solvePose(k, q), fore);
    const [gx, gy] = at(0.25);
    const [cx, cy] = at(0.75);
    expect(Math.hypot(gx - cx, gy - cy)).toBeGreaterThan(3);
  });

  it("leaves with the body and arrives with the body: only the middle of a move is behind", () => {
    const bad: string[] = [];
    eachArm((m, v, rig, k, arm) => {
      for (const i of [arm.fore, arm.hand]) {
        if (k.trail[i] === 0) continue;
        const swing = k.anglesB[i] - k.anglesA[i];
        if (Math.abs(swing) < 1e-3) continue;
        const share = (q: number) => (solvePose(k, q)[i * 3 + 2] - k.anglesA[i]) / swing;
        // Both ends exactly, nothing past them, and never turning back on itself.
        if (Math.abs(share(0)) > 1e-6) bad.push(`${v} ${m}/${i} at A`);
        if (Math.abs(share(0.5) - 1) > 1e-6) bad.push(`${v} ${m}/${i} at B`);
        let prev = 0;
        for (let s = 1; s <= 24; s++) {
          const now = share((s / 24) * 0.5);
          if (now < -1e-9 || now > 1 + 1e-9) bad.push(`${v} ${m}/${i}@${s} overshoots`);
          if (now < prev - 1e-9) bad.push(`${v} ${m}/${i}@${s} turns back`);
          prev = now;
        }
      }
    });
    expect(bad).toEqual([]);
  });

  it("has nothing to trail behind when the upper arm is still: a curl's forearm is the move", () => {
    const rig = buildSideRig("curl");
    expect(buildMotionKit("curl", "side").trail[rig.arms[0].fore]).toBeLessThan(0.05);
  });

  it("curls a relaxed hand on its wrist", () => {
    const rig = buildSideRig("neutral");
    const k = buildMotionKit("neutral", "side");
    const { fore, hand } = rig.arms[0];
    const p = solvePose(k, 0);
    expect(Math.abs(wrap(p[hand * 3 + 2] - p[fore * 3 + 2])) * DEG).toBeGreaterThan(8);
  });
});

describe("the shoulder rises under a raised arm", () => {
  /** The shoulder joint's height off the chest at each end of the rep. */
  const rise = (m: FigureMotion, v: View) => {
    const rig = BUILD[v](m);
    const k = buildMotionKit(m, v);
    const { upper } = rig.arms[0];
    const trunk = rig.bones.findIndex((b) => b.name === "upperSpine");
    const off = (q: number) => {
      const p = solvePose(k, q);
      return boneTip(k, p, trunk)[1] - p[upper * 3 + 1];
    };
    return off(0.5) - off(0);
  };

  it("front-on and side-on", () => {
    expect(rise("jumpingJack", "front")).toBeGreaterThan(2);
    // The overhead press starts up there, so it comes down instead.
    expect(rise("push", "front")).toBeLessThan(-1);
    expect(rise("push", "side")).toBeLessThan(-1);
  });

  it("not on the floor, where nothing lifts it", () => {
    expect(Math.abs(rise("pushup", "side"))).toBeLessThan(0.5);
  });
});

describe("an arm can come toward the camera", () => {
  it("curls straight up: the forearms no longer sweep across the body in an X", () => {
    const rig = buildFrontRig("curl");
    const k = buildMotionKit("curl", "front");
    const [right, left] = rig.arms;
    for (const q of REP) {
      const p = solvePose(k, q);
      // Each hand stays on its own side of the body.
      expect(boneTip(k, p, right.fore)[0], `q ${q}`).toBeGreaterThan(53);
      expect(boneTip(k, p, left.fore)[0], `q ${q}`).toBeLessThan(47);
    }
    // And the forearm shows little of its length as it points at the viewer.
    const mid = (() => {
      for (const q of REP) if (lutAt(k.base, q) >= 0.5) return q;
      return 0.25;
    })();
    expect(solvePose(k, mid)[k.n * 3 + right.fore]).toBeLessThan(0.3);
    expect(solvePose(k, 0)[k.n * 3 + right.fore]).toBeGreaterThan(0.85);
  });

  it("keeps the arm's true length for what it shows, whatever the pose gives it", () => {
    const squat = buildFrontRig("squat");
    const neutral = buildFrontRig("neutral");
    const len = (rig: Rig, name: string) => rig.bones.find((b) => b.name === name)!.length;
    expect(Math.abs(len(squat, "upArmR") - len(neutral, "upArmR"))).toBeLessThan(1);
    expect(Math.abs(len(squat, "foreArmR") - len(neutral, "foreArmR"))).toBeLessThan(1);
  });

  it("is only ever a front-on thing, and only where a profile says so", () => {
    for (const [m, v] of SHOWN) {
      const rig = BUILD[v](m);
      if (v === "side" || !FRONT_PROFILES[m]?.depth) expect(rig.depthBones, `${v} ${m}`).toEqual([]);
      else expect(rig.depthBones.length, `${v} ${m}`).toBeGreaterThan(0);
    }
  });
});

describe("the rhythm is not the arm's to change", () => {
  it("a softer elbow leaves every movement on the beat it was on", () => {
    expect(motionTempo("jumpingJack").loopMs).toBe(1000);
    expect(motionTempo("squat").loopMs).toBe(3000);
    expect(motionTempo("pushup").loopMs).toBe(3000);
    expect(motionTempo("pullUp").loopMs).toBe(3000);
    expect(motionTempo("dip").loopMs).toBe(3000);
    expect(motionTempo("boxing").loopMs).toBe(1500);
  });
});

describe("a marching bridge", () => {
  it("does not drop the body through the floor as the feet change over", () => {
    const k = buildMotionKit("marchingBridge", "side");
    const hipY = (q: number) => solvePose(k, q)[1];
    const ends = hipY(0);
    for (const q of REP) expect(Math.abs(hipY(q) - ends), `q ${q}`).toBeLessThan(5);
  });
});
