/**
 * Demonstration accuracy — the guard rails from the 2026-10-15 cross-check.
 *
 * A user reported that the standing torso twist "played the wrong movement".
 * It did: flex_14 had no movement of its own and played the flexibility
 * family's loop, a reach up into a forward fold. Forty other exercises were in
 * the same state (crunches drew a STANDING knee tuck, lateral raises an
 * overhead press, every stretch the same fold), and floor work was drawn
 * standing up in its "front" panel. These tests keep all three from coming back.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { motionCameras, motionLoopMs } from "@/fitness/animation/cameras";
import { EXERCISE_MOTIONS } from "@/fitness/animation/exerciseMotions";
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import { resolveFigureMotion, type FigureMotion } from "@/fitness/animation/movementProfiles";
import { MOTION_PROPS, propsFor } from "@/fitness/animation/props";
import { buildFrontRig, buildSideRig, poseRig, type Rig } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { describe, expect, it } from "vitest";

/**
 * The only catalogued exercises allowed to play their pattern's shape: for
 * these the shape IS the exercise (an overhead press, a band pulldown, two
 * squats, two Romanian deadlifts).
 */
const PATTERN_IS_THE_EXERCISE = new Set(["push_06", "pull_15", "legs_01", "legs_13", "hinge_04", "hinge_11"]);

/** Where a named bone's tip lands at rep progress `p`, in box units. */
function tip(rig: Rig, p: number, name: string): [number, number] {
  const i = rig.bones.findIndex((b) => b.name === name);
  expect(i, name).toBeGreaterThanOrEqual(0);
  const pose = poseRig(rig, p);
  const a = pose[i * 3 + 2];
  return [pose[i * 3] + rig.bones[i].length * Math.cos(a), pose[i * 3 + 1] + rig.bones[i].length * Math.sin(a)];
}

describe("exercise demonstrations", () => {
  it("gives every catalogued exercise a movement of its own", () => {
    for (const ex of EXERCISE_DATABASE) {
      if (PATTERN_IS_THE_EXERCISE.has(ex.id)) {
        expect(EXERCISE_MOTIONS[ex.id], ex.id).toBeUndefined();
        expect(resolveFigureMotion(ex.id), ex.id).toBe(ex.movementPattern);
      } else {
        expect(EXERCISE_MOTIONS[ex.id], `${ex.id} ${ex.name} has no movement of its own`).toBeDefined();
      }
    }
  });

  it("only maps real exercises", () => {
    const ids = new Set(EXERCISE_DATABASE.map((e) => e.id));
    for (const id of Object.keys(EXERCISE_MOTIONS)) expect(ids.has(id), id).toBe(true);
  });

  it("draws the standing torso twist as a twist, not the flexibility fold", () => {
    expect(resolveFigureMotion("flex_14")).toBe("torsoTwist");
    const rig = buildFrontRig("torsoTwist");
    // The arms sweep across the body from one side to the other…
    const [handA] = tip(rig, 0, "foreArmR");
    const [handB] = tip(rig, 0.5, "foreArmR");
    expect(Math.abs(handA - handB)).toBeGreaterThan(25);
    // …while the head stays up, from either camera. The fold it used to play
    // dropped the head toward the floor at the bottom of every rep.
    for (const twist of [rig, buildSideRig("torsoTwist")]) {
      expect(Math.abs(tip(twist, 0, "neck")[1] - tip(twist, 0.5, "neck")[1])).toBeLessThan(2);
    }
    const fold = buildSideRig("flexibility");
    expect(tip(fold, 0.5, "neck")[1] - tip(fold, 0, "neck")[1]).toBeGreaterThan(15);
  });

  it("never draws floor work standing up", () => {
    // Lying, plank and all-fours work has no honest front camera: the rig
    // cannot foreshorten, so its "front" view was a person standing upright
    // (a plank that breathed, a bridge that stood still, a bird dog raising an
    // arm like a question). These must stay side-on only.
    const FLOOR_WORK: FigureMotion[] = [
      "pushup", "plank", "forearmPlank", "kneePlank", "shoulderTap", "plankUpDown",
      "kneePushup", "inclinePushup", "declinePushup", "pikePushup", "hinduPushup",
      "scapPushup", "spidermanPushup", "chestPress", "mountainClimber", "bearCrawl",
      "inchworm", "squatThrust", "sprawl",
      "gluteBridge", "singleLegBridge", "marchingBridge", "hipThrust", "wheel",
      "legRaise", "crunch", "situp", "vUp", "toeTouch", "heelTap", "deadBug",
      "hollowHold", "hollowRock", "flutterKick", "reverseCrunch", "bicycleCrunch",
      "boatHold", "superman", "cobra", "figureFour", "seatedFold", "seatedRow",
      "birdDog", "catCow", "childsPose", "donkeyKick", "threadNeedle", "downDog",
      "pigeon", "kneelingLunge", "couchStretch", "worldsGreatest", "nordicCurl",
      "invertedRow",
    ];
    for (const motion of FLOOR_WORK) {
      expect(SIDE_PROFILES[motion], motion).toBeDefined();
      expect(FRONT_PROFILES[motion], `${motion} would be drawn standing up`).toBeUndefined();
    }
  });

  it("draws knee drives side-on, never as a front-view split", () => {
    // Front-on, a constant-length thigh can only come up by swinging out
    // through horizontal: every rep flashed both legs into a sideways split.
    for (const motion of ["highKnee", "march", "buttKick"] as FigureMotion[]) {
      expect(FRONT_PROFILES[motion], motion).toBeUndefined();
      // Side-on, one knee is up while the other leg stays planted.
      const rig = buildSideRig(motion);
      expect(SIDE_PROFILES[motion]?.framesFar, motion).toBeDefined();
      const [, nearFoot] = tip(rig, 0, "shin");
      const [, farFoot] = tip(rig, 0, "farShin");
      expect(Math.abs(nearFoot - farFoot), motion).toBeGreaterThan(10);
    }
  });

  it("puts the forearm plank on its forearms and the side plank low", () => {
    // The plank exercise is a FOREARM plank; it used to play a high plank.
    expect(resolveFigureMotion("core_01")).toBe("forearmPlank");
    const plank = buildSideRig("forearmPlank");
    const [, elbowY] = tip(plank, 0, "upArm");
    const [, handY] = tip(plank, 0, "foreArm");
    expect(Math.abs(elbowY - handY)).toBeLessThan(1.5);
    // The side plank used to stand at ~67° like a person leaning on a wall.
    // Body line: bottom foot (node 8) to chest (node 1) in the front frame.
    const side = FRONT_PROFILES.sidePlank!.frames[0];
    const rise = Math.atan2(side[17] - side[3], side[2] - side[16]) * (180 / Math.PI);
    expect(rise).toBeGreaterThan(5);
    expect(rise).toBeLessThan(35);
  });

  it("hangs pull-ups from a fixed bar instead of drawing a standing pulldown", () => {
    for (const id of ["pull_06", "pull_07", "pull_16", "pull_17", "pull_18"]) {
      expect(resolveFigureMotion(id), id).toBe("pullUp");
    }
    for (const build of [buildFrontRig, buildSideRig]) {
      const rig = build("pullUp");
      const hand = (p: number) => tip(rig, p, rig.bones.some((b) => b.name === "foreArmR") ? "foreArmR" : "foreArm");
      // The hands stay on the bar while the body rises.
      expect(Math.abs(hand(0)[1] - hand(0.5)[1])).toBeLessThan(1.5);
      expect(tip(rig, 0, "neck")[1] - tip(rig, 0.5, "neck")[1]).toBeGreaterThan(15);
    }
  });
});

describe("cameras", () => {
  it("lists exactly the cameras a movement has a profile for", () => {
    const keys = new Set([...Object.keys(FRONT_PROFILES), ...Object.keys(SIDE_PROFILES)]) as Set<FigureMotion>;
    for (const motion of keys) {
      const cameras = motionCameras(motion);
      expect(cameras.includes("front"), motion).toBe(!!FRONT_PROFILES[motion]);
      expect(cameras.includes("side"), motion).toBe(!!SIDE_PROFILES[motion]);
    }
  });

  it("times a single-camera movement off its own profile, not the neutral fallback", () => {
    expect(motionLoopMs("crunch")).toBe(SIDE_PROFILES.crunch!.loopMs);
    expect(motionLoopMs("sidePlank")).toBe(FRONT_PROFILES.sidePlank!.loopMs);
    expect(motionLoopMs("lateralRaise")).toBe(FRONT_PROFILES.lateralRaise!.loopMs);
  });
});

describe("props", () => {
  it("stays inside the box, on a camera the movement actually has", () => {
    for (const [motion, byCamera] of Object.entries(MOTION_PROPS)) {
      for (const [camera, props] of Object.entries(byCamera ?? {})) {
        expect(motionCameras(motion as FigureMotion), `${motion} ${camera}`).toContain(camera);
        for (const p of props ?? []) {
          expect(p.w, motion).toBeGreaterThan(0);
          expect(p.h, motion).toBeGreaterThan(0);
          expect(p.x, motion).toBeGreaterThanOrEqual(0);
          expect(p.y, motion).toBeGreaterThanOrEqual(0);
          expect(p.x + p.w, motion).toBeLessThanOrEqual(100);
          expect(p.y + p.h, motion).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("is where the body rests on it", () => {
    // The point of a prop is contact: the hands on the bench, the foot on the
    // step, the hands on the bar. A prop a few units off reads as levitation.
    const near = (pt: [number, number], top: number, x0: number, x1: number, slack = 6) => {
      expect(pt[0]).toBeGreaterThanOrEqual(x0 - 4);
      expect(pt[0]).toBeLessThanOrEqual(x1 + 4);
      expect(Math.abs(pt[1] - top)).toBeLessThan(slack);
    };
    const box = (m: FigureMotion, camera: "front" | "side") => propsFor(m, camera)[0];

    const incline = box("inclinePushup", "side");
    near(tip(buildSideRig("inclinePushup"), 0, "foreArm"), incline.y, incline.x, incline.x + incline.w);

    const step = box("stepUp", "side");
    near(tip(buildSideRig("stepUp"), 0.5, "shin"), step.y, step.x, step.x + step.w);

    const bench = box("dip", "side");
    near(tip(buildSideRig("dip"), 0.5, "foreArm"), bench.y, bench.x, bench.x + bench.w);

    const bar = box("pullUp", "front");
    near(tip(buildFrontRig("pullUp"), 0.5, "foreArmR"), bar.y, bar.x, bar.x + bar.w);
  });
});
