/**
 * SESSION BLOCKS — the player says where you are inside the part of the session
 * you are in, and a warm-up flows from move to move instead of stopping.
 */
import { describe, expect, it } from "vitest";

import {
  FLOW_SECONDS,
  HANDOVER_SECONDS,
  blockRuns,
  handoverSeconds,
  hasBlocks,
  parseBlocks,
  positionLabel,
  positionOf,
  sessionSeconds,
} from "@/fitness/components/sessionBlocks";
import type { SessionBlock, SessionExerciseInfo } from "@/models/session";

function move(id: string, block?: SessionBlock, extra: Partial<SessionExerciseInfo> = {}): SessionExerciseInfo {
  return {
    exerciseId: id,
    name: id,
    category: "legs",
    difficulty: "beginner",
    exerciseType: "reps",
    sets: 3,
    reps: "10",
    restSeconds: 60,
    transitionSeconds: 30,
    setupPosition: "",
    instructions: [],
    coachCues: [],
    icon: "body",
    ...(block ? { block } : {}),
    ...extra,
  };
}

/** The shape of a planned full-body day: 2 warm-up, 5 main, 2 cool-down. */
const PLANNED: SessionExerciseInfo[] = [
  move("w1", "warmup", { sets: 1 }),
  move("w2", "warmup", { sets: 1 }),
  move("m1", "main"),
  move("m2", "main"),
  move("m3", "main"),
  move("m4", "main"),
  move("m5", "main"),
  move("c1", "cooldown", { sets: 1 }),
  move("c2", "cooldown", { sets: 1 }),
];

describe("parseBlocks", () => {
  it("reads the route param, and an unknown entry as no block", () => {
    expect(parseBlocks("warmup,main,cooldown")).toEqual(["warmup", "main", "cooldown"]);
    expect(parseBlocks("warmup, junk ,main")).toEqual(["warmup", undefined, "main"]);
    expect(parseBlocks(undefined)).toEqual([]);
    expect(parseBlocks("")).toEqual([]);
  });
});

describe("handoverSeconds", () => {
  const blocks = PLANNED.map((m) => m.block);

  it("flows between two moves of the same warm-up or cool-down", () => {
    expect(handoverSeconds(blocks, 1)).toBe(FLOW_SECONDS);
    expect(handoverSeconds(blocks, 8)).toBe(FLOW_SECONDS);
  });

  it("gives a full hand-over before main work and into a new block", () => {
    expect(handoverSeconds(blocks, 2)).toBe(HANDOVER_SECONDS); // warm-up → main
    expect(handoverSeconds(blocks, 3)).toBe(HANDOVER_SECONDS); // main → main
    expect(handoverSeconds(blocks, 7)).toBe(HANDOVER_SECONDS); // main → cool-down
  });

  it("treats a session without blocks as main work throughout", () => {
    expect(handoverSeconds([], 1)).toBe(HANDOVER_SECONDS);
    expect(handoverSeconds([undefined, undefined], 1)).toBe(HANDOVER_SECONDS);
  });
});

describe("where you are", () => {
  it("counts inside the block, not across the session", () => {
    expect(positionOf(PLANNED, 0)).toEqual({ block: "warmup", index: 1, total: 2 });
    expect(positionOf(PLANNED, 3)).toEqual({ block: "main", index: 2, total: 5 });
    expect(positionOf(PLANNED, 8)).toEqual({ block: "cooldown", index: 2, total: 2 });
  });

  it("names the block when there is more than one", () => {
    expect(positionLabel(PLANNED, 0)).toBe("WARM-UP · 1 OF 2");
    expect(positionLabel(PLANNED, 6)).toBe("MAIN · 5 OF 5");
    expect(positionLabel(PLANNED, 7)).toBe("COOL-DOWN · 1 OF 2");
  });

  it("says MOVE when there is nothing to tell apart, and the sets for a single move", () => {
    const flat = [move("a"), move("b"), move("c")];
    expect(hasBlocks(flat)).toBe(false);
    expect(positionLabel(flat, 1)).toBe("MOVE 2 OF 3");
    expect(positionLabel([move("solo")], 0)).toBe("3 SETS");
    expect(positionLabel([move("solo", undefined, { sets: 1 })], 0)).toBe("1 SET");
  });
});

describe("blockRuns", () => {
  it("splits the session into its parts, in order, with moves and sets", () => {
    const runs = blockRuns(PLANNED);
    expect(runs.map((r) => [r.block, r.start, r.moves, r.sets])).toEqual([
      ["warmup", 0, 2, 2],
      ["main", 2, 5, 15],
      ["cooldown", 7, 2, 2],
    ]);
  });

  it("adds up to the whole session's length", () => {
    const runs = blockRuns(PLANNED);
    expect(runs.reduce((s, r) => s + r.seconds, 0)).toBe(sessionSeconds(PLANNED));
  });

  it("does not charge the first move a hand-over", () => {
    const one = [move("solo", undefined, { sets: 1, reps: "10" })];
    // 10 reps × 3 s + 4 s settle → 34 → rounded to 35; no rest, no hand-over.
    expect(sessionSeconds(one)).toBe(35);
  });
});
