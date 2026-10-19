/**
 * Front movement profiles — guarantees every camera-facing demonstration pose
 * is well-formed and stays inside the drawable 0–100 box (both authored
 * keyframes; linear interpolation between in-box points stays in-box).
 */
import {
  FRONT_FRAME_LEN,
  FRONT_LEFT_LEN,
  FRONT_PROFILES,
  getFrontProfile,
} from "@/fitness/animation/frontProfiles";
import { MOVEMENT_PROFILES } from "@/fitness/animation/movementProfiles";
import { describe, expect, it } from "vitest";

describe("front movement profiles", () => {
  it("has well-formed keyframes inside the 0–100 box", () => {
    for (const [key, profile] of Object.entries(FRONT_PROFILES)) {
      expect(profile.frames, key).toHaveLength(2);
      for (const frame of profile.frames) {
        expect(frame, key).toHaveLength(FRONT_FRAME_LEN);
        for (const n of frame) {
          expect(n, key).toBeGreaterThanOrEqual(0);
          expect(n, key).toBeLessThanOrEqual(100);
        }
      }
      expect(profile.loopMs).toBeGreaterThan(0);
    }
  });

  it("keeps authored left limbs well-formed and on the left", () => {
    for (const [key, profile] of Object.entries(FRONT_PROFILES)) {
      if (!profile.framesL) continue;
      expect(profile.framesL, key).toHaveLength(2);
      profile.framesL.forEach((left, f) => {
        expect(left, key).toHaveLength(FRONT_LEFT_LEN);
        for (const n of left) {
          expect(n, key).toBeGreaterThanOrEqual(0);
          expect(n, key).toBeLessThanOrEqual(100);
        }
        // Hands and even a crossing step legitimately reach past the
        // centreline (a russian twist, a curtsy lunge). The HIPS do not: if
        // they swap sides the pelvis is inside out. "Side" is measured against
        // the spine, not the box's centreline, because a whole body can shift
        // (a lateral lunge sits over one foot) or lie down (a side plank, the
        // top-down sweeps) and still be the right way round.
        const right = profile.frames[f];
        const [chestX, chestY, pelvisX, pelvisY] = [right[2], right[3], right[4], right[5]];
        const sx = chestX - pelvisX;
        const sy = chestY - pelvisY;
        const side = (x: number, y: number) => sx * (y - pelvisY) - sy * (x - pelvisX);
        expect(side(right[12], right[13]), `${key} hipR`).toBeGreaterThan(0);
        expect(side(left[6], left[7]), `${key} hipL`).toBeLessThan(0);
      });
    }
  });

  it("keeps a front view for every pattern fallback that reads from the front", () => {
    // The hip hinge is the one pattern with no front view: the rig cannot
    // foreshorten, so a body folding toward the camera drew a person standing
    // still. Every other fallback must stay drawable from the front, because an
    // unknown exercise lands on one of them.
    for (const key of Object.keys(MOVEMENT_PROFILES)) {
      if (key === "hinge") continue;
      expect(FRONT_PROFILES[key as keyof typeof FRONT_PROFILES], key).toBeDefined();
    }
    expect(FRONT_PROFILES.idle).toBeDefined();
  });

  it("falls back to neutral for anything unmapped", () => {
    // @ts-expect-error — exercising the runtime guard with an invalid key.
    expect(getFrontProfile("nope")).toBe(FRONT_PROFILES.neutral);
  });
});
