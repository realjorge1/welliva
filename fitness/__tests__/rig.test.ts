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
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import { resolveFigureMotion, type FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig, poseRig, repEase } from "@/fitness/animation/rig";
import { describe, expect, it } from "vitest";

// Every drawable movement, pattern fallbacks AND the exercise-specific ones —
// a pose that escapes the box is just as broken either way.
const MOTIONS = Object.keys(FRONT_PROFILES) as FigureMotion[];
const BUILDERS = { front: buildFrontRig, side: buildSideRig } as const;

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

      it("keeps every bone the same length for the whole rep", () => {
        for (const motion of MOTIONS) {
          const rig = build(motion);
          for (let step = 0; step <= 20; step++) {
            const pose = poseRig(rig, step / 20);
            rig.bones.forEach((bone, i) => {
              const a = pose[i * 3 + 2];
              const tipX = pose[i * 3] + bone.length * Math.cos(a);
              const tipY = pose[i * 3 + 1] + bone.length * Math.sin(a);
              const drawn = Math.hypot(tipX - pose[i * 3], tipY - pose[i * 3 + 1]);
              expect(drawn, `${motion}/${bone.name}`).toBeCloseTo(bone.length, 6);
            });
          }
        }
      });

      it("never lets a pose leave the drawable box", () => {
        for (const motion of MOTIONS) {
          const rig = build(motion);
          for (let step = 0; step <= 20; step++) {
            for (const [x, y] of joints(rig, step / 20)) {
              expect(x, `${motion} x`).toBeGreaterThanOrEqual(-12);
              expect(x, `${motion} x`).toBeLessThanOrEqual(112);
              expect(y, `${motion} y`).toBeGreaterThanOrEqual(-12);
              expect(y, `${motion} y`).toBeLessThanOrEqual(112);
            }
          }
        }
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
    for (const motion of MOTIONS) {
      for (const build of Object.values(BUILDERS)) {
        const rig = build(motion);
        rig.bones.forEach((bone, i) => {
          const swing = Math.abs(rig.anglesB[i] - rig.anglesA[i]);
          expect(swing, `${motion}/${bone.name}`).toBeLessThanOrEqual(Math.PI + 1e-9);
        });
      }
    }
  });
});
