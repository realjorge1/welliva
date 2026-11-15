/**
 * THE GROUND — animation/motion.ts "The ground" and "The feet", measured off the
 * drawing by animation/support.ts.
 *
 * Owner, 2026-11-14: "Animated figure seems floating and not on a base (floor)
 * … Animated figures should appear natural on a surface and not floating", with
 * pigeon pose, couch stretch, 90/90 and child's pose named as "not good enough",
 * and then "more human like in movements". Everything here is measured on the
 * solved pose the renderers draw, against the drawing's own lowest points —
 * the soles of the trainers, a kneeling knee, the seat of the shorts, a back.
 */
import { motionCameras } from "@/fitness/animation/cameras";
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import { boneTip, buildMotionKit, solvePose, type MotionKit } from "@/fitness/animation/motion";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig, type Rig } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { SUPPORT_STEPS } from "@/fitness/animation/support";
import { lutAt } from "@/fitness/animation/tempo";
import { describe, expect, it } from "vitest";

type View = "front" | "side";
const BUILD = { front: buildFrontRig, side: buildSideRig } as const;
const ARM = /^(far)?(upArm|foreArm|hand)/i;
const SHOWN: [FigureMotion, View][] = [...new Set([...Object.keys(FRONT_PROFILES), ...Object.keys(SIDE_PROFILES)])].flatMap(
  (m) => motionCameras(m as FigureMotion).map((v) => [m, v] as [FigureMotion, View]),
);
const REP = Array.from({ length: 97 }, (_, s) => s / 96);

/** How far below its start bone `i`'s drawing reaches at angle `a` — the kit's own table. */
function depth(k: MotionKit, i: number, a: number): number {
  const n = SUPPORT_STEPS;
  let u = (a / (Math.PI * 2)) * n;
  u -= Math.floor(u / n) * n;
  const j = Math.floor(u);
  const f = u - j;
  return k.supp[i * n + j] * (1 - f) + k.supp[i * n + ((j + 1) % n)] * f;
}

/** The lowest point of named parts of a solved pose (box units, y down). */
function lowOf(k: MotionKit, rig: Rig, pose: number[], test: (name: string) => boolean): number {
  let low = -Infinity;
  rig.bones.forEach((b, i) => {
    if (k.suppOn[i] && test(b.name)) low = Math.max(low, pose[i * 3 + 1] + depth(k, i, pose[i * 3 + 2]));
  });
  return low;
}

function kitOf(m: FigureMotion, v: View) {
  return { rig: BUILD[v](m), k: buildMotionKit(m, v) };
}

describe("the figure rests on its floor", () => {
  it("touches it every frame, and nothing it rests on goes through it", () => {
    // A third of a trainer's height either way. Off the floor by design: a hop's
    // air (the tempo's lift), a jump, a bar to hang from, a view from above, a
    // body up on equipment or carried on its hands.
    const MOST = 1.6;
    const bad: string[] = [];
    for (const [m, v] of SHOWN) {
      const { rig, k } = kitOf(m, v);
      if (k.ground !== 1 || k.surf.length > 0) continue;
      const handsCarry = lowOf(k, rig, solvePose(k, 0), (n) => !ARM.test(n)) < k.floor - 4;
      if (handsCarry) continue;
      for (const q of REP) {
        const pose = solvePose(k, q);
        const off = k.floor - lowOf(k, rig, pose, (n) => !ARM.test(n)) - k.hop;
        const into = lowOf(k, rig, pose, (n) => !ARM.test(n)) - k.floor;
        if (off > MOST || into > MOST) {
          bad.push(`${v} ${m} @${q.toFixed(2)}: ${off > MOST ? `${off.toFixed(1)} above` : `${into.toFixed(1)} into`}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("lies, kneels and sits ON it in the four stretches the owner named", () => {
    // What must be down through the rep, within a little under a unit (a seat
    // rolling onto one sit bone presses that much). The forehead only on the
    // breath out: the back rises a little on the breath in.
    const DOWN = 0.8;
    const cases: [FigureMotion, View, RegExp, string, number[]?][] = [
      // The back leg lies along the floor: knee and top of the foot down.
      ["pigeon", "side", /^farShin$/, "back knee"],
      ["pigeon", "side", /^farFoot$/, "back foot"],
      ["pigeon", "side", /^shin$/, "front shin"],
      // Knees, shins and the tops of the feet flat; the forehead and hands down.
      ["childsPose", "side", /^shin$/, "shins"],
      ["childsPose", "side", /^foot$/, "feet"],
      ["childsPose", "side", /^neck$/, "forehead", [0]],
      ["childsPose", "side", /^hand$/, "hands"],
      // The back knee on the floor at the wall; the front foot planted.
      ["couchStretch", "side", /^farShin$/, "back knee"],
      ["couchStretch", "side", /^foot$/, "front foot"],
      // Sitting on the floor: the seat is down.
      ["ninetyNinety", "front", /^lowerSpine$/, "seat"],
      ["butterfly", "front", /^lowerSpine$/, "seat"],
    ];
    const bad: string[] = [];
    for (const [m, v, part, what, when] of cases) {
      const { rig, k } = kitOf(m, v);
      for (const q of when ?? [0, 0.25, 0.5, 0.75]) {
        const gap = k.floor - lowOf(k, rig, solvePose(k, q), (n) => part.test(n));
        if (Math.abs(gap) > DOWN) bad.push(`${m} ${what} @${q}: ${gap.toFixed(2)} off the floor`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps the couch stretch's back shin up the wall, and the child's pose seat on the heels", () => {
    const couch = kitOf("couchStretch", "side");
    const wall = 30; // props.ts: the wall's face
    const shin = couch.rig.bones.findIndex((b) => b.name === "farShin");
    for (const q of [0, 0.5]) {
      const pose = solvePose(couch.k, q);
      const [x] = boneTip(couch.k, pose, shin);
      expect(x - wall, `ankle @${q}`).toBeLessThan(5);
      // Pointing up the wall.
      expect(Math.sin(pose[shin * 3 + 2]), `shin @${q}`).toBeLessThan(-0.9);
    }
    const child = kitOf("childsPose", "side");
    const pose = solvePose(child.k, 0);
    const seat = lowOf(child.k, child.rig, pose, (n) => n === "lowerSpine");
    // The heels: the top of a trainer lying sole-up, under the hips.
    const heel = child.rig.bones.findIndex((b) => b.name === "foot");
    expect(Math.abs(pose[heel * 3] - pose[0]), "hips over the heels").toBeLessThan(3);
    // Resting on the heels — a trainer lying sole-up stands about six units
    // off the floor — not down on the floor, and not hovering over them.
    expect(child.k.floor - seat, "seat on the heels").toBeGreaterThan(3.5);
    expect(child.k.floor - seat, "seat on the heels").toBeLessThan(7.5);
  });

  it("sits seated work down on the floor: no seat hovers over it", () => {
    for (const [m, v] of [
      ["seatedRow", "side"],
      ["seatedFold", "side"],
      ["boatHold", "side"],
      ["russianTwist", "side"],
      ["vUp", "side"],
    ] as [FigureMotion, View][]) {
      const { rig, k } = kitOf(m, v);
      for (const q of [0, 0.5]) {
        const gap = k.floor - lowOf(k, rig, solvePose(k, q), (n) => n === "lowerSpine" || /^(far)?thigh$/i.test(n));
        expect(Math.abs(gap), `${m} @${q}`).toBeLessThan(0.6);
      }
    }
  });
});

describe("a planted foot stays planted", () => {
  /** How far a foot that stands in one place all rep strays from its spot. */
  const stray = (m: FigureMotion, v: View, bone: string) => {
    const { rig, k } = kitOf(m, v);
    const i = rig.bones.findIndex((b) => b.name === bone);
    const [x0, y0] = boneTip(k, solvePose(k, 0), i);
    let most = 0;
    for (const q of REP) {
      const [x, y] = boneTip(k, solvePose(k, q), i);
      most = Math.max(most, Math.hypot(x - x0, y - y0));
    }
    return most;
  };

  it("does not skate: a foot on the floor in one spot at both ends stays on it all rep", () => {
    // A pistol squat's standing foot used to slide five units through each rep,
    // a cossack squat's nearly four, split and goblet squats a couple.
    const bad: string[] = [];
    for (const [m, v] of SHOWN) {
      const { rig, k } = kitOf(m, v);
      if (k.ground !== 1 || k.hop > 0) continue;
      const shins = v === "side" ? ["shin", "farShin"] : ["shinR", "shinL"];
      for (const bone of shins) {
        const i = rig.bones.findIndex((b) => b.name === bone);
        const foot = v === "side" ? rig.bones.findIndex((b) => b.name === (bone === "shin" ? "foot" : "farFoot")) : i;
        const at = [0, 0.5].map((q) => {
          const pose = solvePose(k, q);
          return { tip: boneTip(k, pose, i), low: pose[foot * 3 + 1] + depth(k, foot, pose[foot * 3 + 2]) };
        });
        const still = Math.hypot(at[1].tip[0] - at[0].tip[0], at[1].tip[1] - at[0].tip[1]) < 0.75;
        const down = at.every((e) => Math.abs(k.floor - e.low) < 0.75);
        if (!still || !down) continue;
        const s = stray(m, v, bone);
        if (s > 1) bad.push(`${v} ${m} ${bone} ${s.toFixed(2)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("is what the body moves from: a push-up pivots on its toes", () => {
    const { rig, k } = kitOf("pushup", "side");
    expect(k.anchor.length).toBeGreaterThan(0);
    const toe = k.anchor[0];
    expect(rig.bones[toe].name).toMatch(/foot/i);
    const [x0, y0] = boneTip(k, solvePose(k, 0), toe);
    for (const q of REP) {
      const [x, y] = boneTip(k, solvePose(k, q), toe);
      expect(Math.hypot(x - x0, y - y0), `@${q}`).toBeLessThan(1e-6);
    }
  });

  it("rises onto its toes in a calf raise, the toes staying down", () => {
    const { rig, k } = kitOf("calfRaise", "side");
    const shin = rig.bones.findIndex((b) => b.name === "shin");
    const ankle = (q: number) => boneTip(k, solvePose(k, q), shin)[1];
    expect(ankle(0) - ankle(0.5), "the heel comes up").toBeGreaterThan(3);
    for (const q of REP) {
      const gap = k.floor - lowOf(k, rig, solvePose(k, q), (n) => /^(far)?foot$/i.test(n));
      expect(Math.abs(gap), `toes @${q}`).toBeLessThan(0.6);
    }
  });
});

describe("a step is a step", () => {
  it("lifts only the swinging foot: one foot carries the body all through a crawl or a climber", () => {
    for (const m of ["mountainClimber", "bearCrawl"] as FigureMotion[]) {
      const { rig, k } = kitOf(m, "side");
      for (const q of REP) {
        const pose = solvePose(k, q);
        const near = k.floor - lowOf(k, rig, pose, (n) => n === "foot");
        const far = k.floor - lowOf(k, rig, pose, (n) => n === "farFoot");
        expect(Math.min(near, far), `${m} @${q.toFixed(2)}`).toBeLessThan(0.6);
      }
    }
  });

  it("takes turns when both feet travel the same way: a step-touch steps, then touches", () => {
    const { rig, k } = kitOf("stepTouch", "front");
    const tips = (q: number) =>
      ["shinR", "shinL"].map((n) => boneTip(k, solvePose(k, q), rig.bones.findIndex((b) => b.name === n)));
    // Early in the way over, one foot is on its way and the other has not left.
    const q = 0.06;
    const t = lutAt(k.base, q);
    expect(t).toBeLessThan(0.3);
    const [r0, l0] = tips(0);
    const [r1, l1] = tips(q);
    const moved = [Math.hypot(r1[0] - r0[0], r1[1] - r0[1]), Math.hypot(l1[0] - l0[0], l1[1] - l0[1])];
    expect(Math.min(...moved)).toBeLessThan(0.05);
    expect(Math.max(...moved)).toBeGreaterThan(0.3);
  });
});

describe("a jump pushes off before it leaves the floor", () => {
  it("keeps the feet down through the push, then rises to the height it was drawn at", () => {
    const { rig, k } = kitOf("tuckJump", "side");
    expect(k.ground).toBe(2);
    const off = (q: number) => k.floor - lowOf(k, rig, solvePose(k, q), (n) => !ARM.test(n));
    // Through the first part of the push-off, the feet are on the floor…
    for (const q of REP.filter((q) => q < 0.5 && lutAt(k.base, q) < 0.35)) expect(Math.abs(off(q)), `@${q}`).toBeLessThan(0.6);
    // …and at the top of the jump the body is well clear of it.
    expect(off(0.5)).toBeGreaterThan(8);
  });
});

describe("nothing levitates", () => {
  it("a standing knee tuck drives one knee and stands on the other leg", () => {
    const { rig, k } = kitOf("core", "side");
    for (const q of REP) {
      const gap = k.floor - lowOf(k, rig, solvePose(k, q), (n) => !ARM.test(n));
      expect(Math.abs(gap), `@${q}`).toBeLessThan(0.6);
    }
  });

  it("no plank is drawn with its feet in the air", () => {
    for (const m of ["burpee", "inchworm", "plankJack"] as FigureMotion[]) {
      const { rig, k } = kitOf(m, "side");
      const gap = k.floor - lowOf(k, rig, solvePose(k, 0.5), (n) => /^(far)?foot$/i.test(n));
      expect(Math.abs(gap), m).toBeLessThan(0.6);
    }
  });
});
