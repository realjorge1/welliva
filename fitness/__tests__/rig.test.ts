/**
 * Figure rig — the skeleton the demonstration panels animate.
 *
 * The two properties that matter are the ones the old position-interpolating
 * renderer could not give us:
 *   · bone lengths are CONSTANT through a rep (no rubber limbs), and
 *   · every pose in between the keyframes stays inside the drawable box.
 * A chain that drifts outside the box draws an athlete with a foot off the
 * panel, so this is asserted across the whole sweep, not just at the ends.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { HEAD_SCALE } from "@/fitness/animation/characterArt";
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import { resolveFigureMotion, type FigureMotion } from "@/fitness/animation/movementProfiles";
import { SIDE_FAR_BONES, buildFrontRig, buildSideRig, poseRig, repEase } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { describe, expect, it } from "vitest";

// Every drawable movement per camera, pattern fallbacks AND the exercise-
// specific ones — a pose that escapes the box is just as broken either way. A
// movement only reads from the cameras it was authored for, so each camera is
// checked against its own library.
const BUILDERS = { front: buildFrontRig, side: buildSideRig } as const;
const MOTIONS_BY_VIEW = {
  front: Object.keys(FRONT_PROFILES) as FigureMotion[],
  side: Object.keys(SIDE_PROFILES) as FigureMotion[],
} as const;

/** Every joint the chain produces at rep progress `p`, as [x, y] pairs. */
function joints(rig: ReturnType<typeof buildFrontRig>, p: number): [number, number][] {
  const pose = poseRig(rig, p);
  return rig.bones.map((bone, i) => {
    const a = pose[i * 3 + 2];
    return [
      pose[i * 3] + bone.length * Math.cos(a),
      pose[i * 3 + 1] + bone.length * Math.sin(a),
    ] as [number, number];
  });
}

describe("figure rig", () => {
  for (const [view, build] of Object.entries(BUILDERS)) {
    const MOTIONS = MOTIONS_BY_VIEW[view as keyof typeof MOTIONS_BY_VIEW];
    describe(`${view} view`, () => {
      it("builds a well-formed skeleton for every motion", () => {
        for (const motion of MOTIONS) {
          const rig = build(motion);
          expect(rig.bones.length, motion).toBeGreaterThan(0);
          expect(rig.anglesA, motion).toHaveLength(rig.bones.length);
          expect(rig.anglesB, motion).toHaveLength(rig.bones.length);
          expect(rig.loopMs, motion).toBeGreaterThan(0);
          for (const bone of rig.bones) {
            expect(bone.length, `${motion}/${bone.name}`).toBeGreaterThan(0);
            expect(Number.isFinite(bone.length), `${motion}/${bone.name}`).toBe(true);
            // Parents are always authored before their children so a single
            // forward pass can walk the chain.
            expect(bone.parent, `${motion}/${bone.name}`).toBeLessThan(
              rig.bones.indexOf(bone),
            );
          }
        }
      });

      // These two sweep every motion at 21 points of the rep. They collect
      // violations and assert ONCE: an expect() per joint per step was ~100k
      // assertions, which blew the 5s budget under a loaded full-suite run.
      it("keeps every bone the same length for the whole rep", () => {
        const stretched: string[] = [];
        for (const motion of MOTIONS) {
          const rig = build(motion);
          for (let step = 0; step <= 20; step++) {
            const pose = poseRig(rig, step / 20);
            rig.bones.forEach((bone, i) => {
              const a = pose[i * 3 + 2];
              const tipX = pose[i * 3] + bone.length * Math.cos(a);
              const tipY = pose[i * 3 + 1] + bone.length * Math.sin(a);
              const drawn = Math.hypot(tipX - pose[i * 3], tipY - pose[i * 3 + 1]);
              if (Math.abs(drawn - bone.length) > 1e-6) stretched.push(`${motion}/${bone.name}@${step}`);
            });
          }
        }
        expect(stretched).toEqual([]);
      });

      it("never lets a pose leave the drawable box", () => {
        const escaped: string[] = [];
        for (const motion of MOTIONS) {
          const rig = build(motion);
          for (let step = 0; step <= 20; step++) {
            for (const [x, y] of joints(rig, step / 20)) {
              if (x < -12 || x > 112 || y < -12 || y > 112) {
                escaped.push(`${motion}@${step}: (${x.toFixed(1)}, ${y.toFixed(1)})`);
              }
            }
          }
        }
        expect(escaped).toEqual([]);
      });

      it("never insets a drawn capsule out of existence", () => {
        for (const motion of MOTIONS) {
          const rig = build(motion);
          for (const bone of rig.bones) {
            if (!bone.draw) continue;
            expect(bone.drawInset, `${motion}/${bone.name}`).toBeLessThan(bone.length);
          }
        }
      });

      it("only hides bones that exist to position something else", () => {
        const positioning = /^(neck|clav|pelvis)/;
        for (const motion of MOTIONS) {
          for (const bone of build(motion).bones) {
            if (!bone.draw) {
              expect(bone.name, motion).toMatch(positioning);
            }
          }
        }
      });

      it("gives the head a clear gap above the trunk when standing tall", () => {
        // The pictogram's signature is a DETACHED head. Checked on the neutral
        // idle, which is the pose most exercises rest at.
        const rig = build("neutral");
        const pose = poseRig(rig, 0);
        const nb = rig.headBone;
        const na = pose[nb * 3 + 2];
        const headY =
          pose[nb * 3 + 1] + rig.bones[nb].length * Math.sin(na) + rig.headR;

        const trunk = rig.bones.findIndex((b) => b.name === "upperSpine");
        const ta = pose[trunk * 3 + 2];
        const drawn = rig.bones[trunk].length - rig.bones[trunk].drawInset;
        const capY = pose[trunk * 3 + 1] + drawn * Math.sin(ta);
        const trunkTop = capY - rig.bones[trunk].w1 / 2;

        expect(trunkTop).toBeGreaterThan(headY);
        expect(trunkTop - headY).toBeLessThan(8);
      });

      it("resolves a rig for every exercise in the catalog", () => {
        for (const ex of EXERCISE_DATABASE) {
          const motion = resolveFigureMotion(ex.id, ex.category);
          expect(() => build(motion), ex.id).not.toThrow();
        }
      });
    });
  }

  it("ping-pongs one rep with an eased turn at both ends", () => {
    expect(repEase(0)).toBe(0);
    expect(repEase(0.5)).toBe(1);
    expect(repEase(1)).toBe(0);
    // Symmetric about the bottom of the rep.
    expect(repEase(0.2)).toBeCloseTo(repEase(0.8), 10);
    // Eased, not linear: the first eighth barely moves, then it accelerates.
    expect(repEase(0.125)).toBeLessThan(0.16);
    expect(repEase(0.375)).toBeGreaterThan(0.84);
  });

  it("never spins a bone the long way round between keyframes", () => {
    for (const [view, build] of Object.entries(BUILDERS)) {
      for (const motion of MOTIONS_BY_VIEW[view as keyof typeof MOTIONS_BY_VIEW]) {
        const rig = build(motion);
        rig.bones.forEach((bone, i) => {
          // An arm goes the way its joints let it, which can be the long way round
          // (hanging to overhead through the front, not behind the back). That is
          // held by arms.test.ts.
          if (/arm|hand/i.test(bone.name)) return;
          const swing = Math.abs(rig.anglesB[i] - rig.anglesA[i]);
          // A FOOT turning about half a circle (planted ↔ sole up behind) is
          // routed through toes-down, the way an ankle points, even when that
          // is a hair past π — the other way round flips it over toes-up.
          if (/^(far)?foot$/i.test(bone.name) && swing > Math.PI) {
            const mid = (rig.anglesA[i] + rig.anglesB[i]) / 2;
            expect(Math.sin(mid), `${motion}/${bone.name} swings toes-down`).toBeGreaterThan(0);
            expect(swing, `${motion}/${bone.name}`).toBeLessThan((210 * Math.PI) / 180);
            return;
          }
          expect(swing, `${motion}/${bone.name}`).toBeLessThanOrEqual(Math.PI + 1e-9);
        });
      }
    }
  });

  it("echoes the near limbs on the far side unless a profile authors them", () => {
    // The far-limb bones were added without changing a single existing
    // demonstration: a profile with no framesFar must draw exactly the old
    // echo (the near arm and leg, set back), angle for angle.
    const NEAR_LIMBS = [4, 5, 6, 7, 8];
    for (const motion of MOTIONS_BY_VIEW.side) {
      if (SIDE_PROFILES[motion]?.framesFar) continue;
      const rig = buildSideRig(motion);
      SIDE_FAR_BONES.forEach((far, k) => {
        const near = NEAR_LIMBS[k];
        expect(rig.anglesA[far], `${motion} far ${k}`).toBeCloseTo(rig.anglesA[near], 9);
        expect(rig.anglesB[far], `${motion} far ${k}`).toBeCloseTo(rig.anglesB[near], 9);
        expect(rig.bones[far].length, `${motion} far ${k}`).toBeCloseTo(rig.bones[near].length, 9);
      });
    }
  });

  it("lets a profile move its far leg on its own (a lunge is one leg forward, one back)", () => {
    const rig = buildSideRig("lunge");
    const pose = poseRig(rig, 0.5);
    const footX = (i: number) => pose[i * 3] + rig.bones[i].length * Math.cos(pose[i * 3 + 2]);
    const near = rig.bones.findIndex((b) => b.name === "shin");
    const far = rig.bones.findIndex((b) => b.name === "farShin");
    // At the bottom of the lunge the two feet are a long stride apart.
    expect(footX(near) - footX(far)).toBeGreaterThan(25);
  });
});

/**
 * The BUILD: the skeleton is retuned from the authored poses to human
 * proportions (see rig.ts BUILD and characterArt.ts HEAD_SCALE). This is the
 * whole of the "the arms and legs are too short, the head is too big" fix, and
 * it is one constant away from quietly regressing, so it is measured here.
 */
describe("the figure is built like a person", () => {
  const rig = buildFrontRig("neutral");
  const len = (n: string) => rig.bones.find((b) => b.name === n)?.length ?? 0;
  const arm = len("upArmR") + len("foreArmR");
  const leg = len("thighR") + len("shinR");
  const headDiameter = rig.headR * HEAD_SCALE * 2;
  // Crown to floor: half a head, the neck, the two spines and a leg.
  const height = headDiameter / 2 + len("neck") + len("lowerSpine") + len("upperSpine") + leg;

  it("gives the limbs the share of the silhouette a person's have", () => {
    // A person: arm (shoulder to wrist) ≈ 40% of height, leg (hip to ankle)
    // ≈ 48%. It used to be 26% and 39% — which is what read as stubby.
    expect(arm / height).toBeGreaterThan(0.33);
    expect(leg / height).toBeGreaterThan(0.44);
  });

  it("gives it an athlete's head — about a seventh of its height, not a quarter", () => {
    // A quarter (and before that a third) is a character four heads tall: the
    // owner's "too fat". A person is seven to eight heads; the figure is ~6.5–7.
    expect(headDiameter / height).toBeGreaterThan(0.12);
    expect(headDiameter / height).toBeLessThan(0.18);
  });

  it("stands a push-up on the floor it was drawn against, arms and all", () => {
    // Longer arms would drive a planted hand straight through the floor, so a
    // movement that bears weight through its hands keeps its authored arms.
    const authored = SIDE_PROFILES.pushup!.frames;
    const span = (f: number[], a: number, b: number) =>
      Math.hypot(f[b * 2] - f[a * 2], f[b * 2 + 1] - f[a * 2 + 1]);
    const drawn =
      (span(authored[0], 1, 2) +
        span(authored[0], 2, 3) +
        span(authored[1], 1, 2) +
        span(authored[1], 2, 3)) /
      2;
    const pushup = buildSideRig("pushup");
    const built =
      (pushup.bones.find((b) => b.name === "upArm")?.length ?? 0) +
      (pushup.bones.find((b) => b.name === "foreArm")?.length ?? 0);
    expect(built).toBeCloseTo(drawn, 5);
    // A squat's hands carry nothing, so those arms do grow.
    const squat = buildSideRig("squat");
    const squatArm =
      (squat.bones.find((b) => b.name === "upArm")?.length ?? 0) +
      (squat.bones.find((b) => b.name === "foreArm")?.length ?? 0);
    const squatFrames = SIDE_PROFILES.squat!.frames;
    const squatDrawn =
      (span(squatFrames[0], 1, 2) +
        span(squatFrames[0], 2, 3) +
        span(squatFrames[1], 1, 2) +
        span(squatFrames[1], 2, 3)) /
      2;
    expect(squatArm / squatDrawn).toBeGreaterThan(1.1);
  });
});

/**
 * THE SIDE FEET (rig.ts "The side feet"). The owner's report: "the feet face
 * backward and the body faces forward". Every side foot used to be a standing
 * foot — level, toes toward +x — on every leg in every pose. These lock the
 * ankle back in: standing flat, kneeling on the tops of the feet, toes up on
 * the back, on the toes in a plank, and never turned over mid-rep.
 */
describe("the side feet are set by the ankle", () => {
  const footAngles = (motion: FigureMotion, which: "foot" | "farFoot") => {
    const rig = buildSideRig(motion);
    const i = rig.bones.findIndex((b) => b.name === which);
    return [rig.anglesA[i], rig.anglesB[i]] as const;
  };
  const deg = (r: number) => (r * 180) / Math.PI;
  /** Smallest angle between two directions, degrees. */
  const off = (a: number, b: number) => {
    const d = Math.abs(a - b) % (Math.PI * 2);
    return deg(d > Math.PI ? Math.PI * 2 - d : d);
  };

  it("stands flat, toes forward, when standing", () => {
    for (const m of ["squat", "hinge", "curl", "row", "gobletSquat", "wallSit"] as FigureMotion[]) {
      for (const a of footAngles(m, "foot")) expect(off(a, 0), m).toBeLessThan(1);
    }
  });

  it("kneels on the tops of the feet, toes pointing back, sole up", () => {
    for (const [m, which] of [
      ["catCow", "foot"],
      ["threadNeedle", "foot"],
      ["childsPose", "foot"],
      ["kneelingLunge", "farFoot"],
      ["birdDog", "foot"],
    ] as const) {
      expect(off(footAngles(m, which)[0], Math.PI), m).toBeLessThan(5);
    }
  });

  it("points the toes up, lying or sitting with the legs out", () => {
    for (const m of ["legRaise", "vUp", "seatedFold", "hollowHold", "deadBug"] as FigureMotion[]) {
      // Up the screen is −y: a toe pointing up has a negative sine.
      expect(Math.sin(footAngles(m, "foot")[0]), m).toBeLessThan(-0.5);
    }
  });

  it("stays on the toes in a plank — never on the tops of the feet, at either end of the rep", () => {
    for (const m of ["pushup", "plank", "forearmPlank", "shoulderTap", "mountainClimber", "plankUpDown"] as FigureMotion[]) {
      for (const which of ["foot", "farFoot"] as const) {
        for (const a of footAngles(m, which)) {
          expect(deg(a), `${m}/${which}`).toBeGreaterThanOrEqual(-1);
          expect(deg(a), `${m}/${which}`).toBeLessThan(90);
        }
      }
    }
  });

  it("rests a left-facing body's feet away from its head", () => {
    for (const m of ["cobra", "yRaise"] as FigureMotion[]) {
      expect(buildSideRig(m).facing, m).toBe(-1);
      expect(off(footAngles(m, "foot")[0], 0), m).toBeLessThan(10);
    }
    expect(buildSideRig("invertedRow").facing).toBe(-1);
    expect(buildSideRig("squat").facing).toBe(1);
    expect(buildFrontRig("squat").facing).toBe(1);
  });

  it("never turns a foot over between a planted end and a resting one", () => {
    // Reps whose foot is on the floor at both ends, with the leg nearly level
    // at one of them — where "resting on its top" would otherwise win there
    // and flip the shoe over mid-rep. (A foot in the air may swing sole-up, as
    // a butt kick's does; the long-way-round test routes that through toes-down.)
    const onTheFloor: [FigureMotion, "foot" | "farFoot"][] = [
      ["pushup", "foot"],
      ["lunge", "farFoot"],
      ["jumpLunge", "foot"],
      ["jumpLunge", "farFoot"],
      ["hinduPushup", "foot"],
      ["squatThrust", "foot"],
      ["sprawl", "foot"],
      ["plankUpDown", "foot"],
    ];
    for (const [m, which] of onTheFloor) {
      const [a, b] = footAngles(m, which);
      expect(off(a, b), `${m}/${which}`).toBeLessThan(30);
      for (const x of [a, b]) expect(off(x, Math.PI), `${m}/${which}`).toBeGreaterThan(90);
    }
  });

  it("hangs the feet free from a bar — nothing to stand on", () => {
    for (const a of footAngles("pullUp", "foot")) expect(Math.sin(a)).toBeGreaterThan(0.5);
  });
});
