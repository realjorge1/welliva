/**
 * EXERCISE SELECTION — no dice.
 *
 * Every slot is filled by SCORING each eligible move on named factors (level
 * fit, effectiveness, goal fit, the user's kit, styles, location, milestone,
 * what they did last week, what they skip, what is already in the week) and
 * taking the highest score. Ties fall to the move done least recently, then to
 * the id — so the same data always produces the same plan, and different data
 * produces a different plan exactly where the data differs.
 *
 * The reason shown under each exercise is derived from the scores, not written
 * after the fact:
 *   1. A decisive special factor states itself — a Gozlin swap, a safety
 *      substitution ("Step-ups instead of Jump Squats — protects your knee"),
 *      the milestone, an outgrown move's next step, a skipped move replaced.
 *      "Decisive" is tested counterfactually: the factor is named only if,
 *      without it, a different move would have won.
 *   2. Otherwise the reason is the ordinary factor with the biggest lead over
 *      the runner-up — the thing that actually separated the two.
 */

import type { ExerciseDBEntry } from "../../constants/ExerciseDatabase";
import type { MovementPattern } from "../../models/workout";
import type { Emphasis, TrainingContext } from "./context";
import { parseReps, scaleReps, topOf, type Dose } from "./dose";
import { daysAgo, isAvoided, type EffortRead, type ExerciseHistory } from "./history";
import { decideDose, repCapFor, type DoseDecision } from "./progression";
import { difficultyIndex, isContraindicated, safetyLabel } from "./safety";
import { DAY_NAMES, type Slot, type SlotRole } from "./templates";
import { BALANCE, HIGH_IMPACT, LOCOMOTION, PLYOMETRIC } from "./vocabulary";

/** A Gozlin swap the user applied: `toId` takes `fromId`'s place for four weeks. */
export interface Pin {
  fromId: string;
  fromName: string;
  toId: string;
}

export interface SelectEnv {
  ctx: TrainingContext;
  pool: ExerciseDBEntry[];
  byId: Map<string, ExerciseDBEntry>;
  history: Map<string, ExerciseHistory>;
  today: string;
  carryFrom: string | null;
  effort: EffortRead;
  pins: Pin[];
  /** The milestone ladder's current rung, when one applies. */
  milestoneRung: string | null;
  /** Ladder rungs above the current one: the goal itself, not this week's work. */
  notYet: Set<string>;
  /** exercise id → weekday it is already on this week. */
  usedThisWeek: Map<string, number>;
}

export interface Pick {
  ex: ExerciseDBEntry;
  reason: string;
  decision: DoseDecision;
}

type Factor =
  | "level"
  | "quality"
  | "compound"
  | "goal"
  | "kit"
  | "style"
  | "place"
  | "continuity"
  | "variety"
  | "fresh"
  | "milestone"
  | "outgrown"
  | "nextStep"
  | "avoided";

/** Ordinary factors, in the order a tie between their leads is broken. */
const ORDINARY: Factor[] = [
  "continuity",
  "kit",
  "style",
  "goal",
  "compound",
  "place",
  "variety",
  "level",
  "quality",
  "fresh",
];

interface Scored {
  ex: ExerciseDBEntry;
  f: Record<Factor, number>;
  total: number;
}

const PATTERN_NOUN: Record<MovementPattern, string> = {
  push: "pushing",
  pull: "pulling",
  squat: "leg",
  hinge: "hip",
  core: "core",
  cardio: "cardio",
  flexibility: "mobility",
};

const KIT_NAME: Record<string, string> = {
  dumbbells: "dumbbells",
  resistance_bands: "resistance bands",
  pull_up_bar: "pull-up bar",
  bench: "bench",
  kettlebell: "kettlebell",
};

const STYLE_NOUN: Record<string, string> = {
  strength: "strength work",
  power: "power work",
  hiit: "HIIT",
  cardio: "cardio",
  endurance: "endurance work",
  core: "core work",
  mobility: "mobility work",
  recovery: "recovery work",
};

const GOAL_LINE: Record<Emphasis, string> = {
  strength: "Hard, low-rep work — builds strength",
  muscle: "Controlled reps that load the muscle — builds muscle",
  fat_loss: "Works big muscles — more burn for fat loss",
  endurance: "Long sets at a steady pace — builds endurance",
  general: "Works several muscles at once — all-round fitness",
  everyday: "Simple and joint-friendly — easy to keep up",
  calm: "Slow and steady — suits lower-stress training",
};

function kitList(equipment: string[]): string {
  const names = equipment.filter((e) => e !== "none").map((e) => KIT_NAME[e] ?? e.replace(/_/g, " "));
  if (names.length <= 1) return names[0] ?? "kit";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function muscleList(muscles: string[]): string {
  const m = muscles.slice(0, 2).map((x) => x.toLowerCase());
  return m.length === 2 ? `${m[0]} and ${m[1]}` : m[0];
}

function rating(ex: ExerciseDBEntry): number {
  const r = ex.effectiveness?.rating;
  return typeof r === "number" && r > 0 ? r : 3;
}

function isTimedEx(ex: ExerciseDBEntry): boolean {
  return ex.exerciseType === "timed" || !!parseReps(ex.defaultReps)?.timed;
}

/* ─────────────────────────────── eligibility ─────────────────────────────── */

function owned(ex: ExerciseDBEntry, env: SelectEnv): boolean {
  return ex.equipment.every((eq) => (env.ctx.equipment as string[]).includes(eq));
}

/** Within the user's ceiling, plus one level for the next step of an outgrown move. */
function withinLevel(ex: ExerciseDBEntry, env: SelectEnv, stretch: Set<string>): boolean {
  const idx = difficultyIndex(ex.difficulty);
  const ceiling = difficultyIndex(env.ctx.ceiling);
  if (idx <= ceiling) return true;
  const cap = env.ctx.contra.maxDifficulty ? difficultyIndex(env.ctx.contra.maxDifficulty) : 2;
  return stretch.has(ex.id) && idx === ceiling + 1 && idx <= cap;
}

/** The body says yes: no injury/condition rule, no jumping when the plan is low-impact. */
export function isSafeFor(ex: ExerciseDBEntry, ctx: TrainingContext): boolean {
  if (isContraindicated(ex, ctx.contra)) return false;
  if (ctx.lowImpact && HIGH_IMPACT.has(ex.id)) return false;
  return true;
}

function fitsSlot(ex: ExerciseDBEntry, slot: Slot): boolean {
  if (slot.role === "balance") return BALANCE.includes(ex.id);
  if (ex.movementPattern !== slot.pattern) return false;
  if (slot.plyo) return PLYOMETRIC.has(ex.id);
  // A main or accessory strength slot is not a stretch; mobility slots are only stretches.
  if (slot.role === "mobility") return ex.category === "flexibility";
  return true;
}

/* ───────────────────────────── outgrown moves ───────────────────────────── */

function authoredHarder(ex: ExerciseDBEntry, byId: Map<string, ExerciseDBEntry>): ExerciseDBEntry | null {
  const m = /\(([a-z]+_\d+)\)/i.exec(ex.modifications?.harder ?? "");
  const hit = m ? byId.get(m[1]) : undefined;
  return hit && hit.id !== ex.id ? hit : null;
}

/** The move to graduate to: the authored "harder" variant, else the next level up in the pattern. */
export function harderVariant(ex: ExerciseDBEntry, env: SelectEnv): ExerciseDBEntry | null {
  const ok = (c: ExerciseDBEntry) =>
    c.id !== ex.id &&
    c.movementPattern === ex.movementPattern &&
    owned(c, env) &&
    isSafeFor(c, env.ctx) &&
    difficultyIndex(c.difficulty) >= difficultyIndex(ex.difficulty) &&
    difficultyIndex(c.difficulty) <= Math.min(2, difficultyIndex(env.ctx.ceiling) + 1);
  const authored = authoredHarder(ex, env.byId);
  if (authored && ok(authored)) return authored;
  const next = env.pool
    .filter((c) => ok(c) && difficultyIndex(c.difficulty) > difficultyIndex(ex.difficulty))
    .sort(
      (a, b) =>
        difficultyIndex(a.difficulty) - difficultyIndex(b.difficulty) ||
        rating(b) - rating(a) ||
        a.id.localeCompare(b.id),
    );
  return next[0] ?? null;
}

/* ──────────────────────────────── the dose ──────────────────────────────── */

/** Today's starting dose for a move in a slot, under the user's dose rules. */
export function baseDose(ex: ExerciseDBEntry, role: SlotRole, ctx: TrainingContext): Dose {
  const s = ctx.scheme;
  const timed = isTimedEx(ex);
  let sets: number;
  let factor: number;
  let rest: number;
  switch (role) {
    case "main":
      sets = s.mainSets;
      factor = timed ? s.timedFactor : s.repFactor;
      rest = s.mainRest;
      break;
    case "accessory":
      sets = s.accSets;
      factor = timed ? s.timedFactor : s.repFactor;
      rest = s.accRest;
      break;
    case "finisher":
      sets = 2;
      factor = timed ? s.timedFactor : s.repFactor;
      rest = Math.min(s.accRest, 30);
      break;
    case "balance":
      sets = 2;
      factor = 1;
      rest = 30;
      break;
    case "mobility":
    default:
      sets = 2;
      factor = ctx.emphasis === "calm" ? 1.25 : 1;
      rest = 15;
      break;
  }
  if (ex.category === "flexibility") {
    factor = role === "mobility" && ctx.emphasis === "calm" ? 1.25 : 1;
    rest = 15;
  }
  const cap = timed ? s.holdCap : repCapFor(ex, ex.defaultReps, s);
  const reps = scaleReps(ex.defaultReps, factor, cap);
  if (ctx.age >= 65 && ex.category !== "flexibility") rest += 15;
  return { sets, reps, restSeconds: rest };
}

/** Progression decisions are per move and per role; cache them for the week. */
const doseCacheKey = (id: string, role: SlotRole) => `${id}:${role}`;

export function doseFor(
  ex: ExerciseDBEntry,
  role: SlotRole,
  env: SelectEnv,
  cache: Map<string, DoseDecision>,
): DoseDecision {
  const key = doseCacheKey(ex.id, role);
  const hit = cache.get(key);
  if (hit) return hit;
  const decision = decideDose({
    ex,
    base: baseDose(ex, role, env.ctx),
    history: env.history.get(ex.id),
    scheme: env.ctx.scheme,
    carryFrom: env.carryFrom,
    effort: env.effort,
  });
  cache.set(key, decision);
  return decision;
}

/* ──────────────────────────────── scoring ───────────────────────────────── */

function goalFit(ex: ExerciseDBEntry, emphasis: Emphasis): boolean {
  const p = parseReps(ex.defaultReps);
  const timed = isTimedEx(ex);
  const top = p ? topOf(p) : 10;
  const strengthPattern = ["push", "pull", "squat", "hinge"].includes(ex.movementPattern);
  switch (emphasis) {
    case "strength":
      return (strengthPattern && !timed && top <= 12) || PLYOMETRIC.has(ex.id);
    case "muscle":
      return strengthPattern && !timed && (ex.equipment.length > 0 || top <= 15);
    case "fat_loss":
      // Big muscles burn more: legs, hips, conditioning, and compound pushing.
      // Not core or upper-back isolation — "more burn" would be a false claim there.
      return (
        ex.category === "cardio" ||
        ex.movementPattern === "squat" ||
        ex.movementPattern === "hinge" ||
        (ex.movementPattern === "push" && ex.targetMuscles.length >= 3)
      );
    case "endurance":
      return timed || top >= 15;
    case "general":
      return ex.targetMuscles.length >= 3;
    case "everyday":
      return ex.difficulty === "beginner" && !HIGH_IMPACT.has(ex.id);
    case "calm":
      return !HIGH_IMPACT.has(ex.id) && (timed || ex.category === "flexibility");
  }
}

function styleFit(ex: ExerciseDBEntry, styles: string[]): string | null {
  for (const s of styles) {
    if (s === "core" && ex.category === "core") return s;
    if ((s === "hiit" || s === "cardio" || s === "endurance") && ex.category === "cardio") return s;
    if ((s === "mobility" || s === "recovery") && ex.category === "flexibility") return s;
    if (s === "power" && PLYOMETRIC.has(ex.id)) return s;
    if (s === "strength" && ["push", "pull", "legs"].includes(ex.category) && !isTimedEx(ex)) return s;
  }
  return null;
}

function placeFit(ex: ExerciseDBEntry, location: string): number {
  if (location === "home") return (HIGH_IMPACT.has(ex.id) ? 0 : 3) + (ex.equipment.length === 0 ? 2 : 0);
  if (location === "outdoors") return LOCOMOTION.has(ex.id) ? 5 : 0;
  if (location === "gym") return ex.equipment.length > 0 ? 4 : 0;
  return 0;
}

function score(
  ex: ExerciseDBEntry,
  slot: Slot,
  env: SelectEnv,
  outgrown: Map<string, string>,
  nextSteps: Map<string, string>,
): Scored {
  const { ctx } = env;
  const f = {} as Record<Factor, number>;
  const h = env.history.get(ex.id);

  const gap = difficultyIndex(ctx.ceiling) - difficultyIndex(ex.difficulty);
  f.level = gap === 0 ? 30 : gap === 1 ? 18 : gap === 2 ? 8 : 22;
  f.quality = rating(ex) * 2;
  // A day's main lifts should work several muscles at once; isolation work
  // belongs in the supporting slots.
  f.compound = slot.role === "main" && ex.targetMuscles.length >= 3 ? 4 : 0;
  f.goal = goalFit(ex, ctx.emphasis) ? 6 : 0;
  f.kit = ex.equipment.length > 0 ? (slot.role === "main" ? 8 : 5) : 0;
  f.style = styleFit(ex, ctx.styles) ? 6 : 0;
  f.place = placeFit(ex, ctx.location);
  f.continuity = h && h.records.length > 0 && !isAvoided(h) && !outgrown.has(ex.id) ? 14 : 0;
  f.variety = env.usedThisWeek.has(ex.id) ? -12 : 0;
  f.fresh = h?.lastDone ? Math.min(42, Math.max(0, daysAgo(h.lastDone, env.today))) * 0.05 : 2.1;
  f.milestone = slot.milestone && env.milestoneRung === ex.id ? 40 : 0;
  f.outgrown = outgrown.has(ex.id) ? -30 : 0;
  f.nextStep = nextSteps.has(ex.id) ? 26 : 0;
  f.avoided = isAvoided(h) ? -45 : 0;

  const total = (Object.values(f) as number[]).reduce((a, b) => a + b, 0);
  return { ex, f, total };
}

function better(a: Scored, b: Scored): boolean {
  if (a.total !== b.total) return a.total > b.total;
  return a.ex.id.localeCompare(b.ex.id) < 0;
}

function best(list: Scored[], without?: Factor): Scored | null {
  let top: Scored | null = null;
  for (const s of list) {
    const adj = without ? { ...s, total: s.total - s.f[without] } : s;
    if (!top || better(adj, top)) top = adj;
  }
  if (!top) return null;
  return list.find((s) => s.ex.id === top!.ex.id) ?? null;
}

/* ──────────────────────────────── reasons ───────────────────────────────── */

/**
 * When nothing separated the winner from the runner-up (two equally good
 * moves), the reason is the most telling factor the winner genuinely HAS —
 * still true of this move, still from its score, never a made-up lead.
 */
const HELD: Factor[] = ["continuity", "kit", "style", "goal", "compound", "quality", "place"];

function ordinaryReason(win: Scored, runner: Scored | null, slot: Slot, env: SelectEnv): string {
  const { ctx } = env;
  let lead: Factor | null = null;
  let gapBest = 0;
  if (runner) {
    for (const k of ORDINARY) {
      const d = win.f[k] - runner.f[k];
      if (d > gapBest + 1e-9) {
        gapBest = d;
        lead = k;
      }
    }
  }
  if (!lead) {
    lead =
      HELD.find((k) => (k === "quality" ? rating(win.ex) >= 4 : win.f[k] > 0)) ??
      (runner ? "level" : null);
  }
  if (!lead) return `The ${PATTERN_NOUN[slot.pattern]} move that fits your level and kit`;
  switch (lead) {
    case "continuity":
      return "Kept from your recent sessions so the reps can keep climbing";
    case "kit":
      return `Uses your ${kitList(win.ex.equipment)}`;
    case "style": {
      const s = styleFit(win.ex, ctx.styles);
      return `You said you enjoy ${STYLE_NOUN[s ?? ""] ?? "this kind of work"}`;
    }
    case "goal":
      return GOAL_LINE[ctx.emphasis];
    case "compound":
      return "Works several muscles at once — a strong main move";
    case "place":
      return ctx.location === "home"
        ? "Quiet and floor-friendly — suits training at home"
        : ctx.location === "outdoors"
          ? "Gets you moving — suits open space outdoors"
          : "Uses gym kit — you train at the gym";
    case "variety": {
      const day = runner ? env.usedThisWeek.get(runner.ex.id) : undefined;
      return runner && day !== undefined
        ? `Keeps your week varied — ${runner.ex.name} is on ${DAY_NAMES[day]}`
        : "Keeps your week varied";
    }
    case "level":
      return `Right for your ${ctx.ceiling} level`;
    case "quality":
      return rating(win.ex) >= 5
        ? `One of the most effective ${PATTERN_NOUN[win.ex.movementPattern]} moves you can do`
        : `A proven ${PATTERN_NOUN[win.ex.movementPattern]} move for your level`;
    case "fresh":
      return "Not done lately — keeps your training varied";
    default:
      return `Right for your ${ctx.ceiling} level and kit`;
  }
}

/* ──────────────────────────────── the pick ──────────────────────────────── */

export interface PickOptions {
  /** Ids already in this session (warm-up included). */
  taken: Set<string>;
  /** Ruled-out moves this session has already named in a substitution. */
  reported?: Set<string>;
  /** Weekday being built, for variety bookkeeping. */
  day: number;
  /** Shared per-week dose cache. */
  doseCache: Map<string, DoseDecision>;
  /** Outgrown move id → its name; and next-step id → the outgrown move's name. */
  outgrown: Map<string, string>;
  nextSteps: Map<string, string>;
}

/** Why a move is out for this body, as the tail of a substitution sentence. */
export function exclusionLabel(ex: ExerciseDBEntry, ctx: TrainingContext): string | null {
  const rule = safetyLabel(ex, ctx.bio);
  if (rule) return rule;
  if (ctx.lowImpact && HIGH_IMPACT.has(ex.id)) return `no jumping, ${ctx.lowImpact.label}`;
  return null;
}

export function pickForSlot(slot: Slot, env: SelectEnv, opts: PickOptions): Pick | null {
  const stretch = new Set(opts.nextSteps.keys());
  const base = env.pool.filter(
    (ex) =>
      fitsSlot(ex, slot) &&
      owned(ex, env) &&
      withinLevel(ex, env, stretch) &&
      !opts.taken.has(ex.id) &&
      !env.notYet.has(ex.id),
  );
  const safe = base
    .filter((ex) => isSafeFor(ex, env.ctx))
    .map((ex) => score(ex, slot, env, opts.outgrown, opts.nextSteps));

  // A Gozlin swap replaces its move exactly where that move would have won —
  // not every slot of the pattern. Elsewhere the swapped-out move just sits out.
  const natural = best(safe);
  const pin = natural ? env.pins.find((p) => p.fromId === natural.ex.id) : undefined;
  const pinned = pin ? safe.find((c) => c.ex.id === pin.toId) : undefined;
  const pinnedOut = new Set(env.pins.map((p) => p.fromId));
  const candidates = safe.filter((c) => !pinnedOut.has(c.ex.id));
  const win = pinned ?? best(candidates);
  if (!win) return null;

  const runner =
    candidates
      .filter((c) => c.ex.id !== win.ex.id)
      .reduce<Scored | null>((top, c) => (!top || better(c, top) ? c : top), null);

  // The move the body ruled out that would otherwise have won, if any.
  const unsafe = base
    .filter((ex) => !isSafeFor(ex, env.ctx))
    .map((ex) => score(ex, slot, env, opts.outgrown, opts.nextSteps))
    .reduce<Scored | null>((top, c) => (!top || better(c, top) ? c : top), null);

  const decides = (factor: Factor) => {
    const alt = best(candidates, factor);
    return !!alt && alt.ex.id !== win.ex.id;
  };

  let reason: string;
  // A ruled-out move is named once per session, not under every swap it caused.
  const unsafeLabel =
    unsafe && better(unsafe, win) && !opts.reported?.has(unsafe.ex.id)
      ? exclusionLabel(unsafe.ex, env.ctx)
      : null;
  if (pinned && pin) {
    reason = `Gozlin swapped this in for ${pin.fromName}`;
  } else if (unsafe && unsafeLabel) {
    reason = `${win.ex.name} instead of ${unsafe.ex.name} — ${unsafeLabel}`;
    opts.reported?.add(unsafe.ex.id);
  } else if (win.f.milestone > 0 && decides("milestone")) {
    reason = `Builds toward your milestone — “${env.ctx.milestoneText}”`;
  } else if (win.f.nextStep > 0 && decides("nextStep")) {
    reason = `You've outgrown ${opts.nextSteps.get(win.ex.id)} — this is the next step`;
  } else {
    const skipped = candidates
      .filter((c) => c.f.avoided < 0)
      .find((c) => better({ ...c, total: c.total - c.f.avoided }, win));
    const h = skipped ? env.history.get(skipped.ex.id) : undefined;
    if (skipped && h) {
      reason = `In for ${skipped.ex.name} — you skipped it ${h.skipped} of ${h.programmed} times`;
    } else if (slot.why) {
      reason = slot.why;
    } else if (slot.role === "mobility" && win.ex.targetMuscles.length > 0) {
      // A stretch is explained by what it opens up.
      reason = `Stretches your ${muscleList(win.ex.targetMuscles)}`;
    } else {
      reason = ordinaryReason(win, runner, slot, env);
    }
  }

  return { ex: win.ex, reason, decision: doseFor(win.ex, slot.role, env, opts.doseCache) };
}
