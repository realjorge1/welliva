/**
 * Movement profiles — guarantees the demonstration figure can represent every
 * catalogued exercise and that no keyframe pose leaves the drawable box.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { EXERCISE_MOTIONS } from "@/fitness/animation/exerciseMotions";
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import {
  FRAME_LEN,
  MOVEMENT_PROFILES,
  baseMotionOf,
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

  it("resolves a drawable movement for every exercise in the catalog", () => {
    for (const ex of EXERCISE_DATABASE) {
      const motion = resolveFigureMotion(ex.id, ex.category);
      // Whatever it resolves to, it must be drawable from BOTH cameras.
      expect(FRONT_PROFILES[motion], `${ex.id} → ${motion}`).toBeDefined();
      expect(SIDE_PROFILES[motion], `${ex.id} → ${motion}`).toBeDefined();
      // ...and every authored movement still collapses to one of the seven
      // patterns, so nothing downstream has to learn a second taxonomy.
      expect(MOVEMENT_PROFILES[baseMotionOf(motion)], `${ex.id} → ${motion}`).toBeDefined();
    }
  });

  it("leaves an unmapped exercise on its own movement pattern", () => {
    // A specialisation is opt-in. Anything without one — including a catalogue
    // entry added tomorrow — must still land on its pattern, never on neutral.
    for (const ex of EXERCISE_DATABASE) {
      if (EXERCISE_MOTIONS[ex.id]) continue;
      expect(resolveFigureMotion(ex.id, ex.category), ex.id).toBe(ex.movementPattern);
    }
  });

  it("prefers an exercise's own authored movement over its pattern", () => {
    // The complaint that started this: three different cardio moves, one loop.
    const jack = resolveFigureMotion("cardio_01", "cardio");
    const knees = resolveFigureMotion("cardio_02", "cardio");
    const kicks = resolveFigureMotion("cardio_03", "cardio");
    expect(new Set([jack, knees, kicks]).size).toBe(3);
    // An exercise with nothing authored still falls back to its pattern.
    expect(resolveFigureMotion("core_02", "core")).toBe("core");
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
