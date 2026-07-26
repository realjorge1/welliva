/**
 * Movement profiles — guarantees the demonstration figure can represent every
 * catalogued exercise and that no keyframe pose leaves the drawable box.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import {
  FRAME_LEN,
  MOVEMENT_PROFILES,
  getMovementProfile,
  nodeXY,
  resolveFigureMotion,
  sampleFigure,
  smoothstep,
} from "@/fitness/animation/movementProfiles";
import { describe, expect, it } from "vitest";

describe("movement profiles", () => {
  it("has well-formed frames inside the 0–100 box", () => {
    for (const [key, profile] of Object.entries(MOVEMENT_PROFILES)) {
      expect(profile.frames, key).toHaveLength(2);
      for (const frame of profile.frames) {
        expect(frame, key).toHaveLength(FRAME_LEN);
        for (const n of frame) {
          expect(n, key).toBeGreaterThanOrEqual(0);
          expect(n, key).toBeLessThanOrEqual(100);
        }
      }
      expect(profile.loopMs).toBeGreaterThan(0);
    }
  });

  it("resolves a movement pattern for every exercise in the catalog", () => {
    for (const ex of EXERCISE_DATABASE) {
      const motion = resolveFigureMotion(ex.id, ex.category);
      expect(MOVEMENT_PROFILES[motion], `${ex.id} → ${motion}`).toBeDefined();
      // A DB exercise resolves to its own precise movement pattern.
      expect(motion).toBe(ex.movementPattern);
    }
  });

  it("falls back to category, then to neutral", () => {
    expect(resolveFigureMotion("does_not_exist", "legs")).toBe("squat");
    expect(resolveFigureMotion("does_not_exist", "cardio")).toBe("cardio");
    expect(resolveFigureMotion(undefined, undefined)).toBe("neutral");
    expect(resolveFigureMotion("does_not_exist")).toBe("neutral");
  });

  it("ping-pongs: progress 0 and ~1 return the top pose, 0.5 the bottom", () => {
    const profile = getMovementProfile("squat");
    const top = sampleFigure(profile, 0);
    const bottom = sampleFigure(profile, 0.5);
    expect(top).toEqual(profile.frames[0]);
    expect(bottom).toEqual(profile.frames[1]);
    // Symmetry: the back half retraces the front half.
    expect(sampleFigure(profile, 0.25)).toEqual(sampleFigure(profile, 0.75));
  });

  it("keeps sampled poses within the box for all progress", () => {
    for (const key of Object.keys(MOVEMENT_PROFILES) as (keyof typeof MOVEMENT_PROFILES)[]) {
      const profile = MOVEMENT_PROFILES[key];
      for (let p = 0; p < 1; p += 0.1) {
        for (const n of sampleFigure(profile, p)) {
          expect(n, `${key}@${p}`).toBeGreaterThanOrEqual(0);
          expect(n, `${key}@${p}`).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("nodeXY reads the right coordinates", () => {
    const frame = getMovementProfile("neutral").frames[0];
    expect(nodeXY(frame, "head")).toEqual([frame[0], frame[1]]);
    expect(nodeXY(frame, "foot")).toEqual([frame[12], frame[13]]);
  });

  it("smoothstep clamps and eases", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
  });
});
