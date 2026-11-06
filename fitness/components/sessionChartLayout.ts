/**
 * SESSION CHART — the geometry behind <SessionChart>: the whole session drawn
 * as one strip, every SET a column of dots and every MOVE a pill beneath.
 *
 *     ▪ ▪   ▪▪ ▪▪ ▪▪   ▪▪ ▪▪ ░░   ░░ ░░ ░░        ░  ░
 *     ▪ ▪   ▪▪ ▪▪ ▪▪   ▪▪ ▪▪ ░░   ░░ ░░ ░░        ░  ░
 *                            ▼
 *     ━ ━ ● ━━━━━━━━   ━━━━━━━━   ░░░░░░░░   ● ░  ░
 *     WARM-UP  MAIN                              COOL
 *
 * A column's height is how long that set is boxed to; its dots light up as the
 * set is worked — white once banked, the brand gold while it is live, orange on
 * top for any time past the box. Everything not yet reached is a ghost of the
 * plan, so the strip is the session's shape AND its progress at once: lit up to
 * now, faint after. The pills group the columns into moves, an orange stop sits
 * where one block hands over to the next, and the blocks are named underneath —
 * which is what makes a nine-move session read as three parts instead of nine
 * things.
 *
 * Every number is a reading: a column only lights for time the athlete was in a
 * set, and a set that was never done stays a ghost — on the completion card too
 * (see the owner's rule in welliva-no-cosmetic-counters).
 *
 * Pure — no React — so "where is now", "does it fit" and "does a skipped set
 * stay dark" are arithmetic, tested in fitness/__tests__/sessionChartLayout.test.ts.
 */
import { dotsPath, type Dot } from "@/components/ui/dotMatrix";
import {
  resolveWorkSeconds,
  type ExerciseSessionResult,
  type SessionBlock,
  type SessionExerciseInfo,
  type SessionPhase,
} from "@/models/session";
import { BLOCK_LABEL, BLOCK_SHORT, blockOf } from "./sessionBlocks";

export type ColumnState = "done" | "live" | "todo" | "skipped";

export interface ChartColumn {
  /** Index of the move in the session. */
  exercise: number;
  /** 1-based set within the move. */
  set: number;
  block: SessionBlock;
  /** Seconds the set is boxed to. */
  planned: number;
  /** Seconds actually worked: banked for a done set, the live clock for the set on now. */
  worked: number;
  state: ColumnState;
}

export interface ChartInput {
  exercises: readonly SessionExerciseInfo[];
  results: readonly ExerciseSessionResult[];
  phase: SessionPhase;
  /** state.currentExerciseIndex */
  exerciseIndex: number;
  /** state.currentSet */
  set: number;
  /** state.timerValue — seconds into the live set. */
  timer: number;
}

/** A set's address in the session. */
export interface Cursor {
  exercise: number;
  set: number;
}

/**
 * Where NOW is: the set being worked, or the next one to be. During a rest the
 * set just banked is behind you and the next one is now; during a hand-over it
 * is the first set of the next move. Null once the session is over.
 */
export function cursorOf(input: Pick<ChartInput, "phase" | "exerciseIndex" | "set">): Cursor | null {
  switch (input.phase) {
    case "ACTIVE_SET":
    case "COUNTDOWN":
      return { exercise: input.exerciseIndex, set: input.set };
    case "REST":
      return { exercise: input.exerciseIndex, set: input.set + 1 };
    case "TRANSITION":
      return { exercise: input.exerciseIndex + 1, set: 1 };
    case "INTRO":
      return { exercise: 0, set: 1 };
    default:
      return null;
  }
}

const isAhead = (c: Cursor | null, exercise: number, set: number) =>
  !!c && (exercise > c.exercise || (exercise === c.exercise && set >= c.set));

/** Every set of the session, in order, with what has become of it. */
export function chartColumns(input: ChartInput): ChartColumn[] {
  const cursor = cursorOf(input);
  const columns: ChartColumn[] = [];
  input.exercises.forEach((ex, i) => {
    const planned = resolveWorkSeconds(ex);
    const result = input.results.find((r) => r.exerciseId === ex.exerciseId && !r.skipped);
    for (let s = 1; s <= Math.max(1, ex.sets); s++) {
      const banked = result?.setsCompleted.find((x) => x.setNumber === s && !x.skipped);
      let state: ColumnState;
      let worked = 0;
      if (banked) {
        state = "done";
        worked = Math.max(0, banked.durationSeconds);
      } else if (input.phase === "ACTIVE_SET" && i === input.exerciseIndex && s === input.set) {
        state = "live";
        worked = Math.max(0, input.timer);
      } else if (isAhead(cursor, i, s)) {
        state = "todo";
      } else {
        // Behind now and never banked: skipped, or cut by ending early.
        state = "skipped";
      }
      columns.push({ exercise: i, set: s, block: blockOf(ex), planned, worked, state });
    }
  });
  return columns;
}

/* ── Geometry ─────────────────────────────────────────────────────────────── */

/** Blank dot-columns between two sets of one move, between two moves, between two blocks. */
export const SET_GAP = 1;
export const MOVE_GAP = 2;
export const BLOCK_GAP = 3;
/** Lit dot diameter as a share of the pitch — the same density as the dot numerals. */
export const DOT_FILL = 0.72;
/** The rows the chart aims for; the pitch is picked from this and the height. */
const TARGET_ROWS = 9;
/** Biggest a dot may get when a short session has few columns to spread. */
const MAX_PITCH = 7;
/** Widest a set column may get (in dots) for the same reason. */
const MAX_COL_WIDTH = 12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function gapBefore(cols: readonly ChartColumn[], k: number): number {
  if (k === 0) return 0;
  const a = cols[k - 1];
  const b = cols[k];
  if (a.block !== b.block) return BLOCK_GAP;
  if (a.exercise !== b.exercise) return MOVE_GAP;
  return SET_GAP;
}

export interface ChartGeometry {
  /** Centre-to-centre distance between dots. */
  pitch: number;
  /** Lit dot radius. */
  radius: number;
  rows: number;
  /** Rows the plan may use; the rows above are headroom for overtime. */
  planRows: number;
  width: number;
  height: number;
  /** Left edge of the dot grid — more than zero only when a short session is centred. */
  offsetX: number;
  /** Dot columns per set. */
  colWidth: number;
  /** First dot column of every set column. */
  starts: number[];
}

/**
 * Fit the session into `width` × `height`. Few sets get wide columns of big
 * dots; many sets get one-dot columns — whatever keeps the dots near the target
 * size and the strip exactly the width it was given (centred if even the
 * biggest dots can't fill it).
 */
export function chartGeometry(
  cols: readonly ChartColumn[],
  width: number,
  height: number,
): ChartGeometry | null {
  if (cols.length === 0 || !(width > 0) || !(height > 0)) return null;
  let gaps = 0;
  const starts: number[] = [];
  const target = clamp(height / TARGET_ROWS, 3, 6);
  cols.forEach((_, k) => (gaps += gapBefore(cols, k)));
  const colWidth = clamp(Math.round((width / target - gaps) / cols.length), 1, MAX_COL_WIDTH);
  const span = cols.length * colWidth + gaps;
  const pitch = Math.min(MAX_PITCH, width / span);
  const rows = clamp(Math.floor(height / pitch), 3, 16);
  let at = 0;
  cols.forEach((_, k) => {
    at += gapBefore(cols, k);
    starts.push(at);
    at += colWidth;
  });
  return {
    pitch,
    radius: (pitch * DOT_FILL) / 2,
    rows,
    planRows: rows - (rows >= 7 ? 2 : 1),
    width,
    height,
    offsetX: Math.max(0, (width - span * pitch) / 2),
    colWidth,
    starts,
  };
}

export interface ChartDots {
  /** The plan, not yet reached (and sets that never were). */
  ghost: Dot[];
  /** Banked work. */
  done: Dot[];
  /** The set on now. */
  live: Dot[];
  /** Time past the box, on top of a column. */
  over: Dot[];
}

/**
 * Light the columns. One scale for the whole session — the longest box fills
 * the plan rows — so a column's height compares with every other column's.
 */
export function chartDots(cols: readonly ChartColumn[], g: ChartGeometry): ChartDots {
  const out: ChartDots = { ghost: [], done: [], live: [], over: [] };
  const maxPlanned = Math.max(1, ...cols.map((c) => c.planned));
  const perRow = maxPlanned / g.planRows;
  cols.forEach((c, k) => {
    const plan = clamp(Math.round(c.planned / perRow), 1, g.planRows);
    const worked = c.state === "done" || c.state === "live";
    // A banked set always shows at least one lamp; the live one only once it has earned it.
    const lit =
      c.state === "done"
        ? c.worked > 0
          ? clamp(Math.round(c.worked / perRow), 1, plan)
          : 0
        : c.state === "live"
          ? clamp(Math.floor(c.worked / perRow), 0, plan)
          : 0;
    const extra =
      worked && c.worked > c.planned
        ? clamp(Math.ceil((c.worked - c.planned) / perRow), 1, g.rows - plan)
        : 0;
    const layer: keyof ChartDots = c.state === "live" ? "live" : "done";
    for (let r = 0; r < plan + extra; r++) {
      const into: keyof ChartDots = r >= plan ? "over" : r < lit ? layer : "ghost";
      for (let dc = 0; dc < g.colWidth; dc++) {
        out[into].push({
          x: g.offsetX + (g.starts[k] + dc + 0.5) * g.pitch,
          y: g.height - (r + 0.5) * g.pitch,
        });
      }
    }
  });
  return out;
}

export interface ChartPaths {
  ghost: string;
  done: string;
  live: string;
  over: string;
}

/** Each layer as one SVG path — a whole session is one element per colour. */
export function chartPaths(dots: ChartDots, radius: number): ChartPaths {
  return {
    ghost: dotsPath(dots.ghost, radius * 0.86),
    done: dotsPath(dots.done, radius),
    live: dotsPath(dots.live, radius),
    over: dotsPath(dots.over, radius),
  };
}

/** The centre of the column at `cursor`, for the ▼ marker — null when there is no now. */
export function markerX(
  cols: readonly ChartColumn[],
  g: ChartGeometry,
  cursor: Cursor | null,
): number | null {
  if (!cursor) return null;
  const k = cols.findIndex((c) => c.exercise === cursor.exercise && c.set === cursor.set);
  if (k < 0) return null;
  return g.offsetX + (g.starts[k] + g.colWidth / 2) * g.pitch;
}

/* ── The pills under the columns ──────────────────────────────────────────── */

export type PillState = "done" | "live" | "todo" | "skipped";

export interface ChartPill {
  exercise: number;
  block: SessionBlock;
  /** Left edge and width, lined up with the dots of the move's columns. */
  x: number;
  w: number;
  state: PillState;
}

/** One pill per move, spanning its set columns. */
export function chartPills(
  cols: readonly ChartColumn[],
  g: ChartGeometry,
  cursor: Cursor | null,
): ChartPill[] {
  const inset = (g.pitch * (1 - DOT_FILL)) / 2;
  const pills: ChartPill[] = [];
  let k = 0;
  while (k < cols.length) {
    const exercise = cols[k].exercise;
    let end = k;
    while (end + 1 < cols.length && cols[end + 1].exercise === exercise) end++;
    const states = cols.slice(k, end + 1).map((c) => c.state);
    const state: PillState =
      states.includes("live") || cursor?.exercise === exercise
        ? "live"
        : states.some((s) => s === "done")
          ? "done"
          : states.every((s) => s === "todo")
            ? "todo"
            : "skipped";
    const x = g.offsetX + g.starts[k] * g.pitch + inset;
    const right = g.offsetX + (g.starts[end] + g.colWidth) * g.pitch - inset;
    pills.push({ exercise, block: cols[k].block, x, w: Math.max(1, right - x), state });
    k = end + 1;
  }
  return pills;
}

/** The middle of every gap where one block hands over to the next — the orange stops. */
export function blockStops(cols: readonly ChartColumn[], g: ChartGeometry): number[] {
  const xs: number[] = [];
  for (let k = 1; k < cols.length; k++) {
    if (cols[k].block === cols[k - 1].block) continue;
    const end = g.starts[k - 1] + g.colWidth;
    xs.push(g.offsetX + ((end + g.starts[k]) / 2) * g.pitch);
  }
  return xs;
}

/* ── The axis ─────────────────────────────────────────────────────────────── */

export interface AxisLabel {
  block: SessionBlock;
  text: string;
  /** Left edge. */
  x: number;
}

/**
 * The block names under the strip, each starting under its own run. The full
 * name when it fits the run, the short one when it doesn't; a label is pushed
 * right rather than overlap the one before, and dropped rather than leave the
 * card. A session of one block names nothing — there is nothing to tell apart.
 *
 * `charWidth` is the advance of one character of the (monospaced) label face.
 */
export function axisLabels(
  cols: readonly ChartColumn[],
  g: ChartGeometry,
  charWidth: number,
): AxisLabel[] {
  const runs: { block: SessionBlock; k: number }[] = [];
  cols.forEach((c, k) => {
    if (k === 0 || c.block !== cols[k - 1].block) runs.push({ block: c.block, k });
  });
  if (runs.length < 2) return [];
  const out: AxisLabel[] = [];
  let floor = 0;
  runs.forEach((run, i) => {
    const x0 = g.offsetX + g.starts[run.k] * g.pitch;
    const next = runs[i + 1];
    const room = (next ? g.offsetX + g.starts[next.k] * g.pitch : g.width) - x0 - charWidth;
    const full = BLOCK_LABEL[run.block].toUpperCase();
    const short = BLOCK_SHORT[run.block].toUpperCase();
    const text = full.length * charWidth <= room ? full : short;
    const w = text.length * charWidth;
    let x = Math.max(x0, floor);
    if (x + w > g.width) x = g.width - w;
    if (x < floor - 0.5) return;
    out.push({ block: run.block, text, x });
    floor = x + w + charWidth;
  });
  return out;
}

/** Sets banked out of sets planned — the strip, said out loud. */
export function chartTally(cols: readonly ChartColumn[]): { done: number; total: number } {
  return { done: cols.filter((c) => c.state === "done").length, total: cols.length };
}
