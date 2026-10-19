/**
 * Side movement profiles — guarantees every profile-view demonstration pose is
 * well-formed and stays inside the drawable 0–100 box, that authored far limbs
 * are well-formed, and that the two camera libraries agree on rhythm wherever a
 * movement has both (so both demo panels hit the bottom of the rep together).
 */
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import { MOVEMENT_PROFILES } from "@/fitness/animation/movementProfiles";
import {
  SIDE_FAR_LEN,
  SIDE_FRAME_LEN,
  SIDE_PROFILES,
  getSideProfile,
} from "@/fitness/animation/sideProfiles";
import { describe, expect, it } from "vitest";

describe("side movement profiles", () => {
  it("has well-formed keyframes inside the 0–100 box", () => {
    for (const [key, profile] of Object.entries(SIDE_PROFILES)) {
      expect(profile.frames, key).toHaveLength(2);
      for (const frame of profile.frames) {
        expect(frame, key).toHaveLength(SIDE_FRAME_LEN);
        for (const n of frame) {
          expect(n, key).toBeGreaterThanOrEqual(0);
          expect(n, key).toBeLessThanOrEqual(100);
        }
      }
      expect(profile.loopMs).toBeGreaterThan(0);
    }
  });

  it("keeps authored far limbs well-formed and inside the box", () => {
    for (const [key, profile] of Object.entries(SIDE_PROFILES)) {
      if (!profile.framesFar) continue;
      expect(profile.framesFar, key).toHaveLength(2);
      for (const frame of profile.framesFar) {
        expect(frame, key).toHaveLength(SIDE_FAR_LEN);
        for (const n of frame) {
          expect(n, key).toBeGreaterThanOrEqual(0);
          expect(n, key).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("covers every pattern fallback and the idle pose", () => {
    // An unknown exercise lands on its pattern, so every pattern must draw.
    for (const key of [...Object.keys(MOVEMENT_PROFILES), "idle"]) {
      expect(SIDE_PROFILES[key as keyof typeof SIDE_PROFILES], key).toBeDefined();
    }
  });

  it("shares one rep length with the front view wherever both exist", () => {
    // Both panels run off ONE clock; a mismatch would end one camera's rep
    // early and loop it out of step with the other.
    for (const [key, side] of Object.entries(SIDE_PROFILES)) {
      const front = FRONT_PROFILES[key as keyof typeof FRONT_PROFILES];
      if (!front) continue;
      expect(side.loopMs, key).toBe(front.loopMs);
    }
  });

  it("falls back to neutral for anything unmapped", () => {
    // @ts-expect-error — exercising the runtime guard with an invalid key.
    expect(getSideProfile("nope")).toBe(SIDE_PROFILES.neutral);
  });
});
