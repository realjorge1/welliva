/**
 * Front movement profiles — guarantees every camera-facing demonstration pose
 * is well-formed and stays inside the drawable 0–100 box (both authored
 * keyframes; linear interpolation between in-box points stays in-box).
 */
import {
  FRONT_FRAME_LEN,
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

  it("covers every motion the side-view library covers", () => {
    for (const key of Object.keys(MOVEMENT_PROFILES)) {
      expect(FRONT_PROFILES[key as keyof typeof FRONT_PROFILES], key).toBeDefined();
    }
  });

  it("falls back to neutral for anything unmapped", () => {
    // @ts-expect-error — exercising the runtime guard with an invalid key.
    expect(getFrontProfile("nope")).toBe(FRONT_PROFILES.neutral);
  });
});
