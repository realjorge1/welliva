/**
 * SESSION BLOCKS — warm-up, main, cool-down: the three parts a session is
 * written in, and how the player speaks about where you are.
 *
 * A planned session is two warm-up moves, about five main moves and two
 * cool-down stretches; a library workout averages eight moves. That count is
 * normal for a guided session. What made it read as "six sessions in one" was
 * the player flattening it: "Exercise 7 of 9", nine equal segments, and the
 * same thirty-second "Up next" stop before a shoulder roll as before a set of
 * squats. Coaches don't count that way and nor does any player people trust —
 * they say WHICH PART you are in, and a warm-up flows from move to move.
 *
 * So the player counts inside the block ("MAIN · 2 OF 5"), the session's
 * shape is drawn as three groups, and the hand-over between two moves of the
 * same warm-up or cool-down is a short flow rather than a full stop.
 *
 * Pure — no React, so the counting is tested rather than eyeballed.
 */
import {
  resolveWorkSeconds,
  type SessionBlock,
  type SessionExerciseInfo,
} from "@/models/session";

export const BLOCK_LABEL: Record<SessionBlock, string> = {
  warmup: "Warm-up",
  main: "Main",
  cooldown: "Cool-down",
};

/** For a label squeezed under a narrow run of the chart. */
export const BLOCK_SHORT: Record<SessionBlock, string> = {
  warmup: "Warm",
  main: "Main",
  cooldown: "Cool",
};

/** Seconds between two moves of the same warm-up or cool-down: walk, don't stop. */
export const FLOW_SECONDS = 10;
/** Seconds before any main move, and into a new block. */
export const HANDOVER_SECONDS = 30;

const KNOWN = new Set<string>(["warmup", "main", "cooldown"]);

/** A move's block. No block means main work. */
export function blockOf(ex: { block?: SessionBlock }): SessionBlock {
  return ex.block ?? "main";
}

/** The `blocks` route param ("warmup,main,…") — unknown entries read as no block. */
export function parseBlocks(csv: string | undefined): (SessionBlock | undefined)[] {
  if (!csv) return [];
  return csv.split(",").map((s) => {
    const v = s.trim();
    return KNOWN.has(v) ? (v as SessionBlock) : undefined;
  });
}

/**
 * The hand-over INTO move `i`, in seconds: a short flow between two moves of
 * the same warm-up or cool-down, a full hand-over before main work and at the
 * start of a block.
 */
export function handoverSeconds(blocks: readonly (SessionBlock | undefined)[], i: number): number {
  if (i <= 0) return HANDOVER_SECONDS;
  const here = blocks[i] ?? "main";
  const before = blocks[i - 1] ?? "main";
  return here === before && here !== "main" ? FLOW_SECONDS : HANDOVER_SECONDS;
}

/** True when the session has more than one block — otherwise there is nothing to name. */
export function hasBlocks(exercises: readonly { block?: SessionBlock }[]): boolean {
  const seen = new Set(exercises.map(blockOf));
  return seen.size > 1;
}

export interface BlockPosition {
  block: SessionBlock;
  /** 1-based, within the block. */
  index: number;
  /** Moves in the block. */
  total: number;
}

/** Where move `i` sits inside its block. */
export function positionOf(exercises: readonly { block?: SessionBlock }[], i: number): BlockPosition {
  const block = blockOf(exercises[i] ?? {});
  let index = 0;
  let total = 0;
  exercises.forEach((ex, k) => {
    if (blockOf(ex) !== block) return;
    total += 1;
    if (k <= i) index += 1;
  });
  return { block, index: Math.max(1, index), total: Math.max(1, total) };
}

/**
 * The eyebrow under a move's name: "MAIN · 2 OF 5" when the session has
 * blocks, "MOVE 2 OF 5" when it doesn't, and the sets when it is one move.
 */
export function positionLabel(exercises: readonly SessionExerciseInfo[], i: number): string {
  const ex = exercises[i];
  if (!ex) return "";
  if (exercises.length === 1) return `${ex.sets} ${ex.sets === 1 ? "SET" : "SETS"}`;
  const p = positionOf(exercises, i);
  if (!hasBlocks(exercises)) return `MOVE ${p.index} OF ${p.total}`;
  return `${BLOCK_LABEL[p.block].toUpperCase()} · ${p.index} OF ${p.total}`;
}

/** Wall-clock seconds one move takes: its sets, the rests between them, the hand-over in. */
export function moveSeconds(ex: SessionExerciseInfo, first = false): number {
  const work = resolveWorkSeconds(ex) * ex.sets;
  const rest = ex.restSeconds * Math.max(0, ex.sets - 1);
  return work + rest + (first ? 0 : ex.transitionSeconds);
}

/** Rough wall-clock length of a whole session. The first move has no hand-over. */
export function sessionSeconds(exercises: readonly SessionExerciseInfo[]): number {
  return exercises.reduce((sum, ex, i) => sum + moveSeconds(ex, i === 0), 0);
}

export interface BlockRun {
  block: SessionBlock;
  /** Index of the run's first move in the session. */
  start: number;
  moves: number;
  sets: number;
  seconds: number;
}

/** The session as consecutive runs of one block each, in order. */
export function blockRuns(exercises: readonly SessionExerciseInfo[]): BlockRun[] {
  const runs: BlockRun[] = [];
  exercises.forEach((ex, i) => {
    const block = blockOf(ex);
    const last = runs[runs.length - 1];
    const secs = moveSeconds(ex, i === 0);
    if (last && last.block === block) {
      last.moves += 1;
      last.sets += ex.sets;
      last.seconds += secs;
    } else {
      runs.push({ block, start: i, moves: 1, sets: ex.sets, seconds: secs });
    }
  });
  return runs;
}
