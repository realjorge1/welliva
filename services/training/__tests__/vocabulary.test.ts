/**
 * The planner's exercise vocabulary must name real exercises, and the jump
 * list must be complete: a move whose NAME says it jumps can never reach a
 * low-impact plan just because nobody added it to HIGH_IMPACT.
 */
import { describe, expect, it } from "vitest";

import { EXERCISE_DATABASE } from "../../../constants/ExerciseDatabase";
import {
  BALANCE,
  COOLDOWN,
  HIGH_IMPACT,
  LYING_DOWN,
  MILESTONE_LADDERS,
  PLYOMETRIC,
  WARMUP,
  vocabularyIds,
} from "../vocabulary";

const byId = new Map(EXERCISE_DATABASE.map((e) => [e.id, e]));

describe("training vocabulary", () => {
  it("names only exercises that exist", () => {
    const missing = vocabularyIds().filter((id) => !byId.has(id));
    expect(missing).toEqual([]);
  });

  it("lists every exercise whose name says it jumps or bounces as high-impact", () => {
    // "Hip Thrust" and "Skater Squats" stay on the floor; their jumping
    // namesakes ("Squat Thrusts", "Skaters") are matched by the full phrase.
    const jumpy = /jump|jack|burpee|\bskaters\b|sprawl|squat thrust|high knee|butt kick|fast feet|shuffle/i;
    const unlisted = EXERCISE_DATABASE.filter((e) => jumpy.test(e.name) && !HIGH_IMPACT.has(e.id)).map(
      (e) => `${e.id} ${e.name}`,
    );
    expect(unlisted).toEqual([]);
  });

  it("lists every move set up lying on the back or face down, and only those", () => {
    const lying = (setup: string) => /\b(lie|lying)\b/i.test(setup) && !/one side/i.test(setup);
    const unlisted = EXERCISE_DATABASE.filter((e) => lying(e.setupPosition) && !LYING_DOWN.has(e.id)).map(
      (e) => `${e.id} ${e.name}`,
    );
    expect(unlisted).toEqual([]);
    for (const id of LYING_DOWN) expect(lying(byId.get(id)!.setupPosition), id).toBe(true);
  });

  it("keeps explosive moves inside the high-impact set", () => {
    for (const id of PLYOMETRIC) expect(HIGH_IMPACT.has(id)).toBe(true);
  });

  it("never warms up or cools down with a loaded or advanced move", () => {
    for (const id of [...Object.values(WARMUP).flat(), ...Object.values(COOLDOWN).flat()]) {
      const ex = byId.get(id)!;
      expect(ex.equipment, id).toEqual([]);
      expect(ex.difficulty, id).not.toBe("advanced");
    }
    for (const id of WARMUP.pulseLowImpact) expect(HIGH_IMPACT.has(id)).toBe(false);
    for (const id of Object.values(COOLDOWN).flat()) expect(byId.get(id)!.category).toBe("flexibility");
  });

  it("builds every milestone ladder from one movement pattern, easiest first", () => {
    const rank = { beginner: 0, intermediate: 1, advanced: 2 } as const;
    for (const ladder of MILESTONE_LADDERS) {
      const rungs = ladder.rungs.map((id) => byId.get(id)!);
      for (const ex of rungs) expect(ex.movementPattern, `${ladder.id}: ${ex.id}`).toBe(ladder.pattern);
      for (let i = 1; i < rungs.length; i++) {
        expect(rank[rungs[i].difficulty]).toBeGreaterThanOrEqual(rank[rungs[i - 1].difficulty]);
      }
    }
  });

  it("orders balance work easiest first", () => {
    const rank = { beginner: 0, intermediate: 1, advanced: 2 } as const;
    const levels = BALANCE.map((id) => rank[byId.get(id)!.difficulty]);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });
});
