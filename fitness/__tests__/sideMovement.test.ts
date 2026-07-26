/**
 * Side movement profiles — guarantees every profile-view demonstration pose is
 * well-formed and stays inside the drawable 0–100 box, and that the side set
 * covers exactly the motions the front set does (so both demo panels render the
 * same exercise from two angles).
 */
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import {
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

  it("covers exactly the motions the front-view library covers", () => {
    for (const key of Object.keys(FRONT_PROFILES)) {
      expect(SIDE_PROFILES[key as keyof typeof SIDE_PROFILES], key).toBeDefined();
    }
    expect(Object.keys(SIDE_PROFILES).sort()).toEqual(Object.keys(FRONT_PROFILES).sort());
  });

  it("falls back to neutral for anything unmapped", () => {
    // @ts-expect-error — exercising the runtime guard with an invalid key.
    expect(getSideProfile("nope")).toBe(SIDE_PROFILES.neutral);
  });
});
