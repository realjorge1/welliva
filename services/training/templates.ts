/**
 * WEEK SHAPES — what each training day is for, by goal and by how many days.
 *
 * A day is a TEMPLATE: an ordered list of slots ("a main squat-pattern move",
 * "a core accessory"), not exercises. The planner fills slots with the moves
 * that score best for this person (select.ts). The family a week is built from
 * depends on the emphasis and the number of days: three days of muscle work is
 * full body each time; four is an upper/lower split; five or six are
 * push/pull/legs — because those are the splits that give each muscle group
 * its recovery at that frequency.
 *
 * `arrangeWeek` then fits the family onto the user's ACTUAL weekdays. Days the
 * user picked can sit back to back, so the order is chosen to keep the same
 * muscles off consecutive days, and a run of consecutive full-body days is
 * split upper/lower — with a reason line saying exactly that.
 */

import type { MovementPattern } from "../../models/workout";
import type { Emphasis } from "./context";
import { COOLDOWN, WARMUP } from "./vocabulary";

export type DayKind =
  | "full_a"
  | "full_b"
  | "full_c"
  | "upper"
  | "lower"
  | "push"
  | "pull"
  | "legs"
  | "conditioning"
  | "power"
  | "mobility";

export type SlotRole = "main" | "accessory" | "finisher" | "balance" | "mobility";

export interface Slot {
  pattern: MovementPattern;
  role: SlotRole;
  /** Why this slot exists when an input added it (a finisher, balance, milestone). */
  why?: string;
  /** Only explosive moves — a Power day's lead. */
  plyo?: boolean;
  /** Fill this slot with the milestone's current rung. */
  milestone?: boolean;
}

type Load = "push" | "pull" | "legs";

export interface DayTemplate {
  label: string;
  /** What the day works, for the session's focus line. */
  focus: string;
  /** Muscle groups worked hard — what must not repeat on a back-to-back day. */
  loads: Load[];
  slots: Slot[];
  warmup: keyof typeof WARMUP;
  cooldown: keyof typeof COOLDOWN;
}

const M = (pattern: MovementPattern, extra: Partial<Slot> = {}): Slot => ({ pattern, role: "main", ...extra });
const A = (pattern: MovementPattern): Slot => ({ pattern, role: "accessory" });
const MOB: Slot = { pattern: "flexibility", role: "mobility" };

export const DAY_TEMPLATES: Record<DayKind, DayTemplate> = {
  full_a: {
    label: "Full body",
    focus: "Full body",
    loads: ["push", "pull", "legs"],
    slots: [M("squat"), M("push"), M("pull"), A("hinge"), A("core")],
    warmup: "full",
    cooldown: "full",
  },
  full_b: {
    label: "Full body",
    focus: "Full body",
    loads: ["push", "pull", "legs"],
    slots: [M("hinge"), M("push"), M("pull"), A("squat"), A("core")],
    warmup: "full",
    cooldown: "full",
  },
  full_c: {
    label: "Full body",
    focus: "Full body",
    loads: ["push", "pull", "legs"],
    slots: [M("squat"), M("pull"), M("push"), A("hinge"), A("core")],
    warmup: "full",
    cooldown: "full",
  },
  upper: {
    label: "Upper body",
    focus: "Chest, back, shoulders & arms",
    loads: ["push", "pull"],
    slots: [M("push"), M("pull"), A("push"), A("pull"), A("core")],
    warmup: "upper",
    cooldown: "upper",
  },
  lower: {
    label: "Lower body",
    focus: "Legs & glutes",
    loads: ["legs"],
    slots: [M("squat"), M("hinge"), A("squat"), A("hinge"), A("core")],
    warmup: "lower",
    cooldown: "lower",
  },
  push: {
    label: "Push",
    focus: "Chest, shoulders & triceps",
    loads: ["push"],
    slots: [M("push"), M("push"), A("push"), A("core")],
    warmup: "upper",
    cooldown: "upper",
  },
  pull: {
    label: "Pull",
    focus: "Back & biceps",
    loads: ["pull"],
    slots: [M("pull"), M("pull"), A("pull"), A("core")],
    warmup: "upper",
    cooldown: "upper",
  },
  legs: {
    label: "Legs",
    focus: "Legs & glutes",
    loads: ["legs"],
    slots: [M("squat"), M("hinge"), A("squat"), A("hinge"), A("core")],
    warmup: "lower",
    cooldown: "lower",
  },
  conditioning: {
    label: "Conditioning",
    focus: "Heart & lungs",
    loads: [],
    slots: [M("cardio"), M("squat"), M("cardio"), A("push"), A("core")],
    warmup: "full",
    cooldown: "conditioning",
  },
  power: {
    label: "Power",
    focus: "Explosive strength",
    loads: ["legs"],
    slots: [M("cardio", { plyo: true }), M("squat"), M("push"), A("pull"), A("core")],
    warmup: "full",
    cooldown: "full",
  },
  mobility: {
    label: "Mobility",
    focus: "Mobility & recovery",
    loads: [],
    slots: [MOB, MOB, MOB, A("core"), MOB],
    warmup: "gentle",
    cooldown: "gentle",
  },
};

/** Which days each emphasis trains, for 1–7 days a week. Index = days − 1. */
const FAMILIES: Record<Emphasis, DayKind[][]> = {
  muscle: [
    ["full_a"],
    ["full_a", "full_b"],
    ["full_a", "full_b", "full_c"],
    ["upper", "lower", "upper", "lower"],
    ["push", "pull", "legs", "upper", "lower"],
    ["push", "pull", "legs", "push", "pull", "legs"],
    ["push", "pull", "legs", "push", "pull", "legs", "mobility"],
  ],
  strength: [
    ["full_a"],
    ["full_a", "full_b"],
    ["full_a", "power", "full_b"],
    ["upper", "lower", "upper", "power"],
    ["upper", "lower", "power", "upper", "lower"],
    ["upper", "lower", "power", "upper", "lower", "conditioning"],
    ["upper", "lower", "power", "upper", "lower", "conditioning", "mobility"],
  ],
  fat_loss: [
    ["full_c"],
    ["full_a", "full_b"],
    ["full_a", "conditioning", "full_b"],
    ["upper", "lower", "conditioning", "full_c"],
    ["upper", "lower", "conditioning", "full_a", "conditioning"],
    ["upper", "lower", "conditioning", "upper", "lower", "conditioning"],
    ["upper", "lower", "conditioning", "upper", "lower", "conditioning", "mobility"],
  ],
  endurance: [
    ["conditioning"],
    ["full_a", "conditioning"],
    ["conditioning", "full_a", "conditioning"],
    ["conditioning", "full_a", "conditioning", "full_b"],
    ["conditioning", "full_a", "conditioning", "full_b", "mobility"],
    ["conditioning", "full_a", "conditioning", "full_b", "conditioning", "mobility"],
    ["conditioning", "full_a", "conditioning", "full_b", "conditioning", "mobility", "full_c"],
  ],
  general: [
    ["full_a"],
    ["full_a", "full_b"],
    ["full_a", "conditioning", "full_b"],
    ["upper", "lower", "conditioning", "full_c"],
    ["upper", "lower", "conditioning", "full_a", "mobility"],
    ["upper", "lower", "conditioning", "upper", "lower", "mobility"],
    ["upper", "lower", "conditioning", "upper", "lower", "conditioning", "mobility"],
  ],
  everyday: [
    ["full_a"],
    ["full_a", "full_b"],
    ["full_a", "mobility", "full_b"],
    ["full_a", "mobility", "full_b", "conditioning"],
    ["full_a", "mobility", "full_b", "conditioning", "mobility"],
    ["full_a", "mobility", "full_b", "conditioning", "full_c", "mobility"],
    ["full_a", "mobility", "full_b", "conditioning", "full_c", "mobility", "mobility"],
  ],
  calm: [
    ["mobility"],
    ["mobility", "full_a"],
    ["mobility", "full_a", "mobility"],
    ["mobility", "full_a", "mobility", "full_b"],
    ["mobility", "full_a", "mobility", "full_b", "mobility"],
    ["mobility", "full_a", "mobility", "full_b", "mobility", "full_c"],
    ["mobility", "full_a", "mobility", "full_b", "mobility", "full_c", "mobility"],
  ],
};

export function familyFor(emphasis: Emphasis, days: number): DayKind[] {
  const n = Math.min(7, Math.max(1, days));
  return [...FAMILIES[emphasis][n - 1]];
}

/**
 * What a day kind falls back to when the user's body rules most of it out.
 * Conditioning comes before the opposite split: an upper/lower week with the
 * upper days ruled out would otherwise become four leg days, two of them back
 * to back.
 */
export const FALLBACKS: Record<DayKind, DayKind[]> = {
  full_a: [],
  full_b: [],
  full_c: [],
  upper: ["conditioning", "lower", "full_c", "mobility"],
  push: ["pull", "conditioning", "lower", "mobility"],
  pull: ["push", "conditioning", "lower", "mobility"],
  lower: ["conditioning", "upper", "full_c", "mobility"],
  legs: ["conditioning", "upper", "full_c", "mobility"],
  power: ["full_c", "conditioning", "mobility"],
  conditioning: ["full_c", "mobility"],
  mobility: [],
};

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface ArrangedDay {
  day: number;
  kind: DayKind;
  /** Index of this day's kind in the family passed in (arrangement reorders). */
  source: number;
  /** Set when this day sat in a back-to-back run of full-body days that was split upper/lower. */
  splitRun?: { from: number; to: number };
}

function overlap(a: DayKind, b: DayKind): number {
  const la = DAY_TEMPLATES[a].loads;
  return DAY_TEMPLATES[b].loads.filter((l) => la.includes(l)).length;
}

function cost(days: number[], kinds: DayKind[], order: number[]): number {
  let c = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === 1) c += overlap(kinds[order[i - 1]], kinds[order[i]]);
  }
  return c;
}

/** All orderings of `xs`, in a fixed order (identity first). */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    const rest = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

const isFull = (k: DayKind) => k === "full_a" || k === "full_b" || k === "full_c";

/**
 * Fit a family onto the user's weekdays. The family's own order wins unless a
 * different order keeps the same muscles off more back-to-back days; then any
 * run of consecutive full-body days still left is split upper/lower.
 */
export function arrangeWeek(days: number[], kinds: DayKind[]): ArrangedDay[] {
  const identity = kinds.map((_, i) => i);
  let best = identity;
  let bestCost = cost(days, kinds, best);
  if (bestCost > 0 && kinds.length <= 7) {
    for (const p of permutations(identity)) {
      const c = cost(days, kinds, p);
      if (c < bestCost) {
        best = p;
        bestCost = c;
        if (c === 0) break;
      }
    }
  }

  const arranged: ArrangedDay[] = days.map((day, i) => ({ day, kind: kinds[best[i]], source: best[i] }));

  // A run of back-to-back full-body days trains everything two days running.
  // Split the WHOLE run upper/lower — converting only the second day would
  // still put legs on both. The run starts with whatever the day before it
  // (when that day is back to back too) left rested.
  let i = 0;
  while (i < arranged.length) {
    if (!isFull(arranged[i].kind)) {
      i++;
      continue;
    }
    let j = i;
    while (
      j + 1 < arranged.length &&
      arranged[j + 1].day - arranged[j].day === 1 &&
      isFull(arranged[j + 1].kind)
    ) {
      j++;
    }
    if (j > i) {
      const before =
        i > 0 && arranged[i].day - arranged[i - 1].day === 1
          ? DAY_TEMPLATES[arranged[i - 1].kind].loads
          : [];
      let next: DayKind = before.includes("push") || before.includes("pull") ? "lower" : "upper";
      const run = { from: arranged[i].day, to: arranged[j].day };
      for (let k = i; k <= j; k++) {
        arranged[k] = { day: arranged[k].day, kind: next, source: arranged[k].source, splitRun: run };
        next = next === "upper" ? "lower" : "upper";
      }
    }
    i = j + 1;
  }
  return arranged;
}
