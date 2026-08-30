/**
 * TAI CHI RIG PROBE — the Phase 1 spike's findings, frozen as assertions.
 *
 * The spike asked one question: can the exercise pictogram rig show waist
 * rotation and weight transfer? The answer was half yes, and the half that is
 * NO is a structural property of the rig rather than a limit of any particular
 * keyframe pair. Left as prose in a report that fact would rot; asserted here
 * it stays true, and the day someone changes the rig enough to make it false,
 * this file is what tells them the constraint has moved and the tai chi
 * question is worth reopening.
 *
 * So these are not really tests of `taijiProfiles`. They are tests of what the
 * rig can and cannot represent, written against the movement that needs it
 * most.
 */
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import {
  buildFrontRig,
  buildFrontRigFrom,
  buildSideRig,
  buildSideRigFrom,
  poseRig,
  type Rig,
} from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { CLOUD_HANDS } from "@/practices/animation/taijiProfiles";
import { describe, expect, it } from "vitest";

/** Where a bone's tip lands at rep progress `p`, in box units. */
function tip(rig: Rig, p: number, name: string): [number, number] {
  const i = rig.bones.findIndex((b) => b.name === name);
  expect(i, name).toBeGreaterThanOrEqual(0);
  const pose = poseRig(rig, p);
  const a = pose[i * 3 + 2];
  return [
    pose[i * 3] + rig.bones[i].length * Math.cos(a),
    pose[i * 3 + 1] + rig.bones[i].length * Math.sin(a),
  ];
}

/** Sample the whole cycle, not just the two authored ends. */
const STEPS = Array.from({ length: 17 }, (_, i) => i / 16);

describe("rigging a profile that is not in the exercise registry", () => {
  // The split exists so a modality can be drawn without widening
  // `FigureMotion`. It is only safe if it is a pure refactor.
  it("matches the registry path bone for bone", () => {
    for (const [motion, profile] of Object.entries(FRONT_PROFILES)) {
      expect(buildFrontRigFrom(profile), motion).toEqual(
        buildFrontRig(motion as keyof typeof FRONT_PROFILES),
      );
    }
    for (const [motion, profile] of Object.entries(SIDE_PROFILES)) {
      expect(buildSideRigFrom(profile), motion).toEqual(
        buildSideRig(motion as keyof typeof SIDE_PROFILES),
      );
    }
  });

  it("builds a well-formed skeleton from an unregistered profile", () => {
    for (const rig of [buildFrontRigFrom(CLOUD_HANDS.front), buildSideRigFrom(CLOUD_HANDS.side)]) {
      expect(rig.bones.length).toBeGreaterThan(0);
      expect(rig.loopMs).toBeGreaterThan(0);
      for (const bone of rig.bones) {
        expect(bone.length, bone.name).toBeGreaterThan(0);
        expect(Number.isFinite(bone.length), bone.name).toBe(true);
      }
    }
  });
});

describe("what the rig CANNOT show — rotation about the vertical axis", () => {
  /*
   * A body turning on its vertical axis foreshortens: project a shoulder line
   * turned by θ and its width scales by cos θ. Width is therefore the ONLY
   * channel that carries a turn in a flat view.
   *
   * The rig freezes every bone's length at the average of the two keyframes —
   * which is precisely the invariant that stopped limbs behaving like rubber,
   * and is not negotiable. A clavicle is a bone. So the shoulder line is a bar
   * of fixed width, and no keyframe pair can make it narrow.
   */
  it("holds the shoulder and hip lines at a fixed width all cycle", () => {
    const rig = buildFrontRigFrom(CLOUD_HANDS.front);
    const spans = STEPS.map((p) => ({
      shoulder: tip(rig, p, "clavR")[0] - tip(rig, p, "clavL")[0],
      hip: tip(rig, p, "pelvisR")[0] - tip(rig, p, "pelvisL")[0],
    }));
    // Stated as a RATIO, because that is the claim: a 40° turn is authored
    // into both keyframes, so a rig that could foreshorten would swing these
    // spans by about a third (1 − cos 40°). They do not move by a thousandth.
    const drift = (pick: (s: (typeof spans)[number]) => number) => {
      const vs = spans.map(pick);
      return (Math.max(...vs) - Math.min(...vs)) / vs[0];
    };
    expect(drift((s) => s.shoulder)).toBeLessThan(0.001);
    expect(drift((s) => s.hip)).toBeLessThan(0.001);
    expect(spans[0].shoulder).toBeGreaterThan(0);
  });

  it("cannot narrow the trunk, which is the widest thing on the figure", () => {
    // Even if a pose could pull the shoulder JOINTS inward, the torso is drawn
    // as a capsule whose width lives on the bone spec, not on a keyframe — so
    // the silhouette a viewer actually reads never changes width.
    const rig = buildFrontRigFrom(CLOUD_HANDS.front);
    const trunk = rig.bones.filter((b) => b.name.endsWith("Spine"));
    expect(trunk.length).toBeGreaterThan(0);
    for (const bone of trunk) {
      expect(typeof bone.w0).toBe("number");
      expect(typeof bone.w1).toBe("number");
    }
    // The widest trunk width is wider than the entire hip line it sits on:
    // narrowing the joints alone cannot make the body look turned.
    const hipSpan = tip(rig, 0, "pelvisR")[0] - tip(rig, 0, "pelvisL")[0];
    expect(Math.max(...trunk.map((b) => b.w1))).toBeGreaterThan(hipSpan);
  });
});

describe("what the rig CAN show — weight transfer between planted feet", () => {
  /*
   * Weight transfer survives because it is carried by translation and joint
   * angle, neither of which the rig freezes: the pelvis travels toward the
   * loaded foot, and the loaded knee takes more bend than the empty one.
   */
  const rig = buildFrontRigFrom(CLOUD_HANDS.front);

  it("travels the pelvis clear across the stance", () => {
    const xs = STEPS.map((p) => poseRig(rig, p)[0]);
    const travel = Math.max(...xs) - Math.min(...xs);
    const stance = tip(rig, 0, "shinR")[0] - tip(rig, 0, "shinL")[0];
    // Better than a quarter of the stance width — enough that the lean is the
    // most obvious thing about the figure, which is what makes it readable.
    expect(travel / stance).toBeGreaterThan(0.25);
  });

  it("keeps both feet planted", () => {
    // Cloud Hands never lifts a foot. The rig averages each leg's two authored
    // lengths into one, so a stance that changed shape between keyframes would
    // slide the feet along the floor — an athlete skating, not shifting.
    for (const foot of ["shinR", "shinL"]) {
      const xs = STEPS.map((p) => tip(rig, p, foot)[0]);
      expect(Math.max(...xs) - Math.min(...xs), foot).toBeLessThan(1);
    }
  });

  it("holds the head level, which is the form's own test of itself", () => {
    // A rising and falling head is the single most-corrected fault in the
    // movement. If the demonstration bobs, it is teaching the error.
    const ys = STEPS.map((p) => tip(rig, p, "neck")[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.5);
  });
});
