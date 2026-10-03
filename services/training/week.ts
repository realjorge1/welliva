/**
 * THE WEEK BUILDER — one person's training week, built from their data and
 * explained line by line.
 *
 *   context   who this is and what they want     (context.ts)
 *   shape     which kind of day lands on which weekday   (templates.ts)
 *   moves     each slot filled by score, with its reason (select.ts)
 *   doses     each move's sets × reps, climbed from what they logged
 *             (progression.ts)
 *   reasons   one line per input that shaped the week, built from the same
 *             values that shaped it
 *
 * Deterministic: the same profile, preferences, history and week always build
 * the same plan. Nothing here reads a clock or a random number — `today` and
 * `now` are inputs.
 *
 * Warm-ups and cool-downs are REAL exercises in the session. The old plans
 * added "3 min warm-up + 2 min cool-down" to the session's length without the
 * player ever running either; a number that counted nothing. Now the minutes a
 * session claims are the minutes of the exercises it holds, estimated the way
 * the player boxes them.
 */

import type { ExerciseDBEntry } from "../../constants/ExerciseDatabase";
import type { WorkoutBlockItem, WorkoutDefinition } from "../../fitness/types";
import type { SessionSummaryData } from "../../models/session";
import type { UserBio } from "../../models/user";
import type { GeneratedWorkoutPlan, PlannedExercise, WorkoutSession } from "../../models/workout";
import { deriveContext, EMPHASIS_LABEL, schemePhrase, type TrainingContext } from "./context";
import { exerciseSeconds, formatDose, parseReps, scaleReps, type Dose } from "./dose";
import { daysAgo, readHistory, recentEffort } from "./history";
import type { TrainingPrefs } from "./prefs";
import type { DoseDecision } from "./progression";
import { contraindicationKey, difficultyIndex, safetyLabel, safetyNotes } from "./safety";
import {
  doseFor,
  exclusionLabel,
  harderVariant,
  isSafeFor,
  pickForSlot,
  type Pin,
  type PickOptions,
  type SelectEnv,
} from "./select";
import {
  arrangeWeek,
  DAY_SHORT,
  DAY_TEMPLATES,
  FALLBACKS,
  familyFor,
  type ArrangedDay,
  type DayKind,
  type Slot,
} from "./templates";
import { COOLDOWN, MILESTONE_LADDERS, PLYOMETRIC, WARMUP } from "./vocabulary";

/** What every day builder shares for one week. */
type DayOpts = Omit<PickOptions, "taken" | "day"> & { weekStart: string };

/** Bump when the engine changes what it builds: every older plan is rebuilt. */
export const ENGINE_VERSION = 2;

/** How long an applied Gozlin swap holds, in days from the week it was made. */
const PIN_DAYS = 28;

export interface BuildWeekInput {
  bio: UserBio;
  prefs: TrainingPrefs;
  /** Logged guided sessions (any order). */
  sessions: SessionSummaryData[];
  /** Monday of the week being built (YYYY-MM-DD). */
  weekStart: string;
  /** Today (YYYY-MM-DD) — history windows are measured back from here. */
  today: string;
  /** The exercise database. */
  pool: ExerciseDBEntry[];
  /** Library workouts by id, for "Let me choose" days. */
  library?: (id: string) => WorkoutDefinition | undefined;
  /** The plan being replaced, if any — decides whether last week's doses still apply. */
  previous?: GeneratedWorkoutPlan | null;
  /** Clock for `createdAt` only. */
  now?: Date;
}

function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function pinActive(weekApplied: string, weekStart: string): boolean {
  const age = daysAgo(weekApplied, weekStart);
  return age >= 0 && age <= PIN_DAYS;
}

/** The Gozlin changes that shape THIS week: live swaps, and dose changes made this week. */
function activeAdjustments(prefs: TrainingPrefs, weekStart: string) {
  return prefs.adjustments.filter((a) =>
    a.change.replacementId ? pinActive(a.weekStart, weekStart) : a.weekStart === weekStart,
  );
}

/**
 * Fingerprint of everything that shapes the plan EXCEPT the training log. Two
 * builds with the same fingerprint differ only by progression, which moves at
 * the weekly rebuild — so the plan never reshuffles under the user mid-week
 * because they finished a session.
 */
export function trainingInputHash(bio: UserBio, prefs: TrainingPrefs, weekStart: string): string {
  const ctx = deriveContext(bio, prefs);
  const key = JSON.stringify([
    ENGINE_VERSION,
    weekStart,
    ctx.level,
    ctx.ceiling,
    ctx.emphasis,
    ctx.secondary,
    ctx.schemeKey,
    ctx.scheme.mainRest,
    ctx.equipment,
    contraindicationKey(bio),
    ctx.lowImpact?.why ?? null,
    ctx.balance,
    ctx.warmupMoves,
    ctx.cooldownMoves,
    ctx.days,
    ctx.daysSource,
    ctx.sessionMinutes,
    ctx.minutesSource,
    ctx.styles,
    ctx.location,
    prefs.milestone,
    prefs.mode,
    prefs.mode === "chosen" ? prefs.chosen.map((c) => `${c.day}:${c.workoutId}`).sort() : [],
    activeAdjustments(prefs, weekStart)
      .map((a) => a.id)
      .sort(),
  ]);
  return `t${ENGINE_VERSION}_${hash32(key)}`;
}

/* ───────────────────────────── small helpers ───────────────────────────── */

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isTimedEx(ex: ExerciseDBEntry): boolean {
  return ex.exerciseType === "timed" || !!parseReps(ex.defaultReps)?.timed;
}

function secondsOf(ex: ExerciseDBEntry, dose: Dose): number {
  return exerciseSeconds(dose, ex.category, isTimedEx(ex));
}

function plannedFrom(
  ex: ExerciseDBEntry,
  dose: Dose,
  extra: Pick<PlannedExercise, "block" | "role" | "reason" | "doseReason">,
): PlannedExercise {
  const out: PlannedExercise = {
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    movementPattern: ex.movementPattern,
    sets: dose.sets,
    reps: dose.reps,
    restSeconds: dose.restSeconds,
    durationMinutes: Math.max(1, Math.round(secondsOf(ex, dose) / 60)),
    difficulty: ex.difficulty,
    block: extra.block,
  };
  if (extra.role) out.role = extra.role;
  if (extra.reason) out.reason = extra.reason;
  if (extra.doseReason) out.doseReason = extra.doseReason;
  return out;
}

function sessionSeconds(exercises: PlannedExercise[], byId: Map<string, ExerciseDBEntry>): number {
  return exercises.reduce((sum, p) => {
    const ex = byId.get(p.exerciseId);
    return ex ? sum + secondsOf(ex, { sets: p.sets, reps: p.reps, restSeconds: p.restSeconds }) : sum;
  }, 0);
}

function finishSession(
  base: Omit<WorkoutSession, "warmupMinutes" | "cooldownMinutes" | "totalDurationMinutes">,
  byId: Map<string, ExerciseDBEntry>,
): WorkoutSession {
  const part = (b: PlannedExercise["block"]) =>
    sessionSeconds(base.exercises.filter((e) => (e.block ?? "main") === b), byId);
  const total = sessionSeconds(base.exercises, byId);
  return {
    ...base,
    warmupMinutes: Math.round(part("warmup") / 60),
    cooldownMinutes: Math.round(part("cooldown") / 60),
    totalDurationMinutes: Math.max(1, Math.round(total / 60)),
  };
}

/* ─────────────────────────── warm-up / cool-down ─────────────────────────── */

function pickBlock(ids: readonly string[], count: number, env: SelectEnv, taken: Set<string>): ExerciseDBEntry[] {
  const out: ExerciseDBEntry[] = [];
  for (const id of ids) {
    if (out.length >= count) break;
    const ex = env.byId.get(id);
    if (!ex || taken.has(id) || !isSafeFor(ex, env.ctx)) continue;
    if (difficultyIndex(ex.difficulty) > difficultyIndex(env.ctx.ceiling)) continue;
    out.push(ex);
    taken.add(id);
  }
  return out;
}

function warmupFor(kind: DayKind, env: SelectEnv, taken: Set<string>): PlannedExercise[] {
  const { ctx } = env;
  const gentle = ctx.emphasis === "calm" || ctx.emphasis === "everyday" || kind === "mobility";
  const pulseIds = ctx.lowImpact || gentle ? WARMUP.pulseLowImpact : WARMUP.pulse;
  const pulse = kind === "mobility" ? [] : pickBlock(pulseIds, 1, env, taken);
  const primers = pickBlock(WARMUP[DAY_TEMPLATES[kind].warmup], ctx.warmupMoves - pulse.length, env, taken);
  return [...pulse, ...primers].map((ex) =>
    plannedFrom(ex, { sets: 1, reps: ex.defaultReps, restSeconds: 15 }, { block: "warmup" }),
  );
}

function cooldownFor(kind: DayKind, env: SelectEnv, taken: Set<string>): PlannedExercise[] {
  return pickBlock(COOLDOWN[DAY_TEMPLATES[kind].cooldown], env.ctx.cooldownMoves, env, taken).map((ex) =>
    plannedFrom(ex, { sets: 1, reps: ex.defaultReps, restSeconds: 15 }, { block: "cooldown" }),
  );
}

/* ─────────────────────────────── milestone ─────────────────────────────── */

interface Milestone {
  pattern: Slot["pattern"];
  rung: ExerciseDBEntry;
  /** Rungs above this one — the goal itself; they stay out of the week until reached. */
  notYet: string[];
}

function resolveMilestone(env: SelectEnv, outgrown: Map<string, string>): Milestone | null {
  const text = env.ctx.milestoneText;
  if (!text) return null;
  const ladder = MILESTONE_LADDERS.find((l) => l.keywords.test(text));
  if (!ladder) return null;
  const rungs = ladder.rungs
    .map((id) => env.byId.get(id))
    .filter(
      (ex): ex is ExerciseDBEntry =>
        !!ex &&
        ex.equipment.every((eq) => (env.ctx.equipment as string[]).includes(eq)) &&
        isSafeFor(ex, env.ctx) &&
        difficultyIndex(ex.difficulty) <= difficultyIndex(env.ctx.ceiling),
    );
  if (rungs.length === 0) return null;

  // Where they are on the ladder: the highest rung they have trained on —
  // the next one up once that is outgrown. A ladder never started begins one
  // below the hardest rung their level allows, so the target is still ahead.
  let at = -1;
  rungs.forEach((ex, i) => {
    if ((env.history.get(ex.id)?.records.length ?? 0) > 0) at = i;
  });
  let index: number;
  if (at >= 0) index = outgrown.has(rungs[at].id) ? Math.min(at + 1, rungs.length - 1) : at;
  else index = Math.max(0, rungs.length - 2);
  const rung = rungs[index];
  const above = ladder.rungs.slice(ladder.rungs.indexOf(rung.id) + 1);
  return { pattern: ladder.pattern, rung, notYet: [...above] };
}

/* ─────────────────────────────── day shapes ─────────────────────────────── */

function viable(kind: DayKind, env: SelectEnv): boolean {
  const mains = DAY_TEMPLATES[kind].slots.filter((s) => s.role === "main" || s.role === "mobility");
  const filled = mains.filter((slot) =>
    env.pool.some(
      (ex) =>
        ex.movementPattern === slot.pattern &&
        (!slot.plyo || PLYOMETRIC.has(ex.id)) &&
        ex.equipment.every((eq) => (env.ctx.equipment as string[]).includes(eq)) &&
        difficultyIndex(ex.difficulty) <= difficultyIndex(env.ctx.ceiling) &&
        isSafeFor(ex, env.ctx),
    ),
  ).length;
  return filled * 2 >= mains.length;
}

interface ShapedDay extends ArrangedDay {
  /** The kind the family asked for, when the body ruled it out. */
  replaced?: { from: DayKind; label: string };
}

function shapeWeek(env: SelectEnv): ShapedDay[] {
  const { ctx } = env;
  const replaced = new Map<number, { from: DayKind; label: string }>();
  const kinds = familyFor(ctx.emphasis, ctx.days.length).map((k, i) => {
    let kind: DayKind = k === "power" && ctx.lowImpact ? "full_c" : k;
    if (!viable(kind, env)) {
      const alt = FALLBACKS[kind].find((f) => viable(f, env));
      if (alt) {
        // Name the rule that ruled the day out, from a move it excluded.
        const blocked = env.pool.find(
          (ex) =>
            DAY_TEMPLATES[kind].slots.some((s) => s.pattern === ex.movementPattern) &&
            !isSafeFor(ex, ctx),
        );
        const label =
          (blocked && safetyLabel(blocked, ctx.bio)) ??
          (ctx.lowImpact ? ctx.lowImpact.label : "it fits what you have");
        replaced.set(i, { from: kind, label });
        kind = alt;
      }
    }
    return kind;
  });
  // Arrangement reorders the family; each day keeps its family index, so a
  // replacement note stays with the day that was replaced. A day the
  // arrangement then split upper/lower carries the split's reason instead.
  return arrangeWeek(ctx.days, kinds).map((d) => {
    const note = replaced.get(d.source);
    return note && !d.splitRun ? { ...d, replaced: note } : d;
  });
}

function dayReason(d: ShapedDay, ctx: TrainingContext): string {
  const t = DAY_TEMPLATES[d.kind];
  const n = ctx.days.length;
  if (d.replaced) {
    return `${t.label} instead of ${DAY_TEMPLATES[d.replaced.from].label.toLowerCase()} — ${d.replaced.label}`;
  }
  if (d.splitRun) {
    return `${t.label} — ${DAY_SHORT[d.splitRun.from]} to ${DAY_SHORT[d.splitRun.to]} are back to back, so full-body work alternates upper and lower`;
  }
  switch (d.kind) {
    case "full_a":
    case "full_b":
    case "full_c":
      return n <= 3
        ? `Full body — with ${n} training ${n === 1 ? "day" : "days"}, each session works everything`
        : "Full body — rounds out the week";
    case "upper":
    case "lower":
      return `${t.label} — your ${n} days alternate upper and lower so each half recovers`;
    case "push":
    case "pull":
    case "legs":
      return `${t.label} day — ${n} days a week gives each muscle group its own day`;
    case "conditioning":
      return ctx.emphasis === "muscle" || ctx.emphasis === "strength"
        ? "Conditioning — keeps your heart and lungs in the mix"
        : `Conditioning — heart and lungs, for ${EMPHASIS_LABEL[ctx.emphasis]}`;
    case "power":
      return "Power — explosive moves turn strength into speed";
    case "mobility":
      if (n >= 6) return `Mobility — with ${n} training days, one rebuilds instead of loading`;
      return ctx.emphasis === "calm"
        ? "Mobility — slow, breath-led work for lower stress"
        : "Mobility — keeps joints moving between harder days";
  }
}

/** Extra slots the user's other goals, styles and age add to a strength day. */
function extraSlots(kind: DayKind, ctx: TrainingContext): Slot[] {
  if (kind === "mobility") return [];
  const out: Slot[] = [];
  if (ctx.balance) {
    out.push({ pattern: "squat", role: "balance", why: "Balance work — advised every session past 65" });
  }
  const second = ctx.secondary.find((e) => e === "fat_loss" || e === "endurance" || e === "general");
  const cardioStyle = ctx.styles.find((s) => s === "hiit" || s === "cardio" || s === "endurance");
  if (kind !== "conditioning" && (second || cardioStyle)) {
    out.push({
      pattern: "cardio",
      role: "finisher",
      why: second
        ? `Cardio finisher — for your other goal, ${EMPHASIS_LABEL[second]}`
        : `Cardio finisher — you enjoy ${cardioStyle === "hiit" ? "HIIT" : cardioStyle}`,
    });
  }
  const gentle = ctx.secondary.find((e) => e === "calm" || e === "everyday");
  const mobilityStyle = ctx.styles.find((s) => s === "mobility" || s === "recovery");
  if (gentle || mobilityStyle) {
    out.push({
      pattern: "flexibility",
      role: "mobility",
      why: gentle
        ? `Mobility to finish — for your other goal, ${EMPHASIS_LABEL[gentle]}`
        : `Mobility to finish — you enjoy ${mobilityStyle} work`,
    });
  }
  const cores = DAY_TEMPLATES[kind].slots.filter((s) => s.pattern === "core").length;
  if (ctx.styles.includes("core") && cores <= 1) {
    out.push({ pattern: "core", role: "accessory", why: "Extra core — you said you enjoy core work" });
  }
  return out;
}

/** Fill order: what the day is FOR first, then what supports it, then extras. */
const ROLE_ORDER: Record<Slot["role"], number> = {
  main: 0,
  balance: 1,
  accessory: 2,
  finisher: 3,
  mobility: 4,
};

interface DayBuild {
  session: WorkoutSession;
  decisions: DoseDecision[];
  trimmed: boolean;
}

function buildPlannedDay(
  d: ShapedDay,
  milestoneDays: Set<number>,
  milestone: Milestone | null,
  env: SelectEnv,
  opts: DayOpts,
): DayBuild {
  const { ctx } = env;
  const template = DAY_TEMPLATES[d.kind];
  let slots: Slot[] = [...template.slots, ...extraSlots(d.kind, ctx)];

  if (milestone && milestoneDays.has(d.day)) {
    const i = slots.findIndex((s) => s.pattern === milestone.pattern && s.role !== "balance");
    if (i >= 0) slots[i] = { ...slots[i], milestone: true };
    else
      slots.push({
        pattern: milestone.pattern,
        role: milestone.pattern === "flexibility" ? "mobility" : "accessory",
        milestone: true,
        why: `Milestone practice — “${ctx.milestoneText}”`,
      });
  }
  // Milestone practice comes straight after the main work, so a short session
  // drops an accessory before it drops the thing the user is chasing. A
  // mobility day keeps its own order: the stretches are the point of it.
  const order = (s: Slot) => (s.milestone && s.role !== "main" ? 0.5 : ROLE_ORDER[s.role]);
  if (d.kind !== "mobility") {
    slots = slots
      .map((s, i) => ({ s, i }))
      .sort((a, b) => order(a.s) - order(b.s) || a.i - b.i)
      .map(({ s }) => s);
  }

  const taken = new Set<string>();
  const reported = new Set<string>();
  const warmup = warmupFor(d.kind, env, taken);
  // Reserve the cool-down before the work so a stretch is never spent twice.
  const cooldown = cooldownFor(d.kind, env, taken);

  let remaining =
    ctx.sessionMinutes * 60 - sessionSeconds(warmup, env.byId) - sessionSeconds(cooldown, env.byId);
  const work: PlannedExercise[] = [];
  const decisions: DoseDecision[] = [];
  let trimmed = false;

  /** `optional` work (top-ups, extras) that doesn't fit is simply not added. */
  const tryAdd = (slot: Slot, optional = false): boolean => {
    const pick = pickForSlot(slot, env, { ...opts, taken, reported, day: d.day });
    if (!pick) return false;
    let dose = pick.decision.dose;
    let doseReason = pick.decision.reason;
    let secs = secondsOf(pick.ex, dose);
    if (secs > remaining && (optional || work.length >= 2)) {
      if (!optional && slot.role === "main" && dose.sets > 2) {
        const fewer = { ...dose, sets: dose.sets - 1 };
        if (secondsOf(pick.ex, fewer) <= remaining) {
          dose = fewer;
          secs = secondsOf(pick.ex, fewer);
          doseReason = `${formatDose(fewer)} to fit your ${ctx.sessionMinutes}-minute sessions`;
        }
      }
      if (secs > remaining) {
        if (!optional) trimmed = true;
        return false;
      }
    }
    taken.add(pick.ex.id);
    env.usedThisWeek.set(pick.ex.id, env.usedThisWeek.get(pick.ex.id) ?? d.day);
    work.push(plannedFrom(pick.ex, dose, { block: "main", role: slot.role, reason: pick.reason, doseReason }));
    decisions.push(pick.decision);
    remaining -= secs;
    return true;
  };

  for (const slot of slots) tryAdd(slot);

  // The body ruled a slot out and time is left: keep the session a session,
  // with safe work that says why it is there.
  if (work.length < 3 && remaining >= 120) {
    const ruled = env.pool.find(
      (ex) => template.slots.some((s) => s.pattern === ex.movementPattern) && !isSafeFor(ex, ctx),
    );
    const label = ruled ? safetyLabel(ruled, ctx.bio) : null;
    for (const pattern of ["core", "flexibility", "hinge", "squat", "push", "pull"] as const) {
      if (work.length >= 3 || remaining < 120) break;
      tryAdd(
        {
          pattern,
          role: pattern === "flexibility" ? "mobility" : "accessory",
          why: label ? `Added while other moves are out — ${label}` : undefined,
        },
        true,
      );
    }
  }

  // Time left over: the user gave this session its minutes. A coach spends
  // them on one more set of the day's main work — never on padding moves
  // (a Wall Push-up after a Push-up). One extra set per move at most, and
  // never past one set above the user's dose rules.
  const setCap = d.kind === "mobility" ? 3 : ctx.scheme.mainSets + 1;
  let filled = 0;
  for (const p of work) {
    const fills = d.kind === "mobility" ? p.role === "mobility" : p.role === "main";
    const ex = env.byId.get(p.exerciseId);
    if (!fills || !ex || p.sets >= setCap) continue;
    const more: Dose = { sets: p.sets + 1, reps: p.reps, restSeconds: p.restSeconds };
    const extra = secondsOf(ex, more) - secondsOf(ex, { sets: p.sets, reps: p.reps, restSeconds: p.restSeconds });
    if (extra > remaining) continue;
    p.sets += 1;
    p.durationMinutes = Math.max(1, Math.round(secondsOf(ex, more) / 60));
    // The session line says this once; a move that also moved on its own
    // record says both, so its "Up from 3×…" still adds up.
    if (p.doseReason) p.doseReason = `${p.doseReason} · plus a set to use your ${ctx.sessionMinutes} minutes`;
    remaining -= extra;
    filled += 1;
  }

  let reason = dayReason(d, ctx);
  if (filled > 0) {
    reason += ` · one more set on the ${d.kind === "mobility" ? "stretches" : "main moves"} to use your ${ctx.sessionMinutes} minutes`;
  }
  if (trimmed) reason += ` · trimmed to fit ${ctx.sessionMinutes} minutes`;

  return {
    session: finishSession(
      {
        id: `session_${d.day}_${opts.weekStart}`,
        dayLabel: template.label,
        dayOfWeek: d.day,
        focus: template.focus,
        exercises: [...warmup, ...work, ...cooldown],
        isRestDay: false,
        reason,
        source: "planned",
      },
      env.byId,
    ),
    decisions,
    trimmed,
  };
}

/* ─────────────────────────────── chosen days ─────────────────────────────── */

function buildChosenDay(
  day: number,
  def: WorkoutDefinition,
  env: SelectEnv,
  opts: DayOpts,
): DayBuild {
  const { ctx } = env;
  const taken = new Set<string>();
  const reported = new Set<string>();
  const decisions: DoseDecision[] = [];
  const dropped: { name: string; label: string }[] = [];
  let swaps = 0;

  const keepBlock = (items: WorkoutBlockItem[], block: "warmup" | "cooldown") =>
    items.flatMap((item) => {
      const ex = env.byId.get(item.exerciseId);
      if (!ex || taken.has(ex.id) || !isSafeFor(ex, ctx)) return [];
      taken.add(ex.id);
      return [
        plannedFrom(
          ex,
          { sets: item.sets ?? 1, reps: item.reps ?? ex.defaultReps, restSeconds: 15 },
          { block },
        ),
      ];
    });

  const warmup = keepBlock(def.warmup, "warmup");
  const levelGap = difficultyIndex(ctx.ceiling) - difficultyIndex(def.difficulty);
  const factor = 1 + 0.15 * levelGap;

  const work: PlannedExercise[] = [];
  for (const item of def.main) {
    let ex = env.byId.get(item.exerciseId);
    if (!ex) continue;
    let reason: string | undefined;

    const pin = env.pins.find((p) => p.fromId === ex!.id);
    const pinned = pin ? env.byId.get(pin.toId) : undefined;
    // The user chose this workout, so its own moves stand — unless the body
    // rules one out, a condition caps it, or it is two levels beyond them.
    const capIdx = ctx.contra.maxDifficulty ? difficultyIndex(ctx.contra.maxDifficulty) : 2;
    const tooHard =
      difficultyIndex(ex.difficulty) > capIdx ||
      difficultyIndex(ex.difficulty) > difficultyIndex(ctx.ceiling) + 1;
    if (pin && pinned && isSafeFor(pinned, ctx) && !taken.has(pinned.id)) {
      reason = `Gozlin swapped this in for ${pin.fromName}`;
      ex = pinned;
    } else if (!isSafeFor(ex, ctx) || tooHard) {
      const original = ex;
      const label =
        exclusionLabel(original, ctx) ??
        (difficultyIndex(original.difficulty) > capIdx
          ? (safetyLabel(original, ctx.bio) ?? "kept safe for your health")
          : `an easier version for your ${ctx.ceiling} level`);
      const sub = pickForSlot({ pattern: original.movementPattern, role: "main" }, env, {
        ...opts,
        taken,
        reported,
        day,
      });
      if (!sub) {
        // Nothing safe stands in for it: say it was left out, and why.
        dropped.push({ name: original.name, label });
        continue;
      }
      reason = `${sub.ex.name} in place of ${original.name} — ${label}`;
      ex = sub.ex;
      swaps += 1;
    } else {
      reason = `Part of ${def.name}, your pick`;
    }
    if (taken.has(ex.id)) continue;

    // The workout's own prescription, scaled from the workout's level to the
    // user's, then climbed from what they logged. A substitute brings its own
    // defaults — they are already written for its level.
    const authored = ex.id === item.exerciseId;
    const timed = ex.exerciseType === "timed" || !!parseReps(ex.defaultReps)?.timed;
    const scaled = authored && levelGap !== 0;
    const reps = authored ? (item.reps ?? ex.defaultReps) : ex.defaultReps;
    const base: Dose = {
      sets: authored ? (item.sets ?? ex.defaultSets) : ex.defaultSets,
      reps: scaled ? scaleReps(reps, factor, timed ? ctx.scheme.holdCap : undefined) : reps,
      restSeconds: ex.restSeconds,
    };
    const decision = doseFor(ex, "main", env, opts.doseCache);
    const climbed =
      decision.move === "new"
        ? {
            dose: base,
            reason: scaled
              ? `Reps ${levelGap < 0 ? "eased" : "raised"} from the ${def.difficulty} version for your ${ctx.ceiling} level`
              : undefined,
          }
        : { dose: { ...decision.dose, restSeconds: base.restSeconds }, reason: decision.reason };
    taken.add(ex.id);
    env.usedThisWeek.set(ex.id, env.usedThisWeek.get(ex.id) ?? day);
    decisions.push(decision);
    work.push(plannedFrom(ex, climbed.dose, { block: "main", role: "main", reason, doseReason: climbed.reason }));
  }

  const cooldown = keepBlock(def.cooldown, "cooldown");
  const swapNote =
    (swaps > 0 ? ` · ${swaps} ${swaps === 1 ? "move" : "moves"} swapped to keep you safe` : "") +
    dropped.map((x) => ` · ${x.name} left out — ${x.label}`).join("");
  return {
    session: finishSession(
      {
        id: `chosen_${day}_${opts.weekStart}`,
        dayLabel: def.name,
        dayOfWeek: day,
        focus: def.tagline,
        exercises: [...warmup, ...work, ...cooldown],
        isRestDay: false,
        reason: `Your pick from Explore — reps set for your ${ctx.ceiling} level${swapNote}`,
        source: "chosen",
        libraryWorkoutId: def.id,
      },
      env.byId,
    ),
    decisions,
    trimmed: false,
  };
}

/* ───────────────────────────── adjustments ───────────────────────────── */

function applyDoseAdjustments(
  sessions: WorkoutSession[],
  prefs: TrainingPrefs,
  weekStart: string,
  byId: Map<string, ExerciseDBEntry>,
): WorkoutSession[] {
  const live = prefs.adjustments.filter((a) => a.weekStart === weekStart && !a.change.replacementId);
  if (live.length === 0) return sessions;
  return sessions.map((s) => {
    let touched = false;
    const exercises = s.exercises.map((p) => {
      if ((p.block ?? "main") !== "main") return p;
      let next = p;
      for (const a of live) {
        const hits = a.exerciseId ? p.exerciseId === a.exerciseId : !!a.change.restDeltaSeconds;
        if (!hits) continue;
        next = { ...next, doseReason: `Gozlin's change this week — ${a.title}` };
        if (a.change.repFactor && a.change.repFactor !== 1) next.reps = scaleReps(next.reps, a.change.repFactor);
        if (a.change.setsDelta) next.sets = Math.max(1, Math.min(6, next.sets + a.change.setsDelta));
        if (a.change.restDeltaSeconds) {
          next.restSeconds = Math.max(15, Math.min(240, next.restSeconds + a.change.restDeltaSeconds));
        }
        touched = true;
      }
      if (next !== p) {
        const ex = byId.get(p.exerciseId);
        if (ex) next.durationMinutes = Math.max(1, Math.round(secondsOf(ex, next) / 60));
      }
      return next;
    });
    return touched ? finishSession({ ...s, exercises }, byId) : s;
  });
}

/* ──────────────────────────────── reasons ──────────────────────────────── */

function listDays(days: number[]): string {
  return days.map((d) => DAY_SHORT[d]).join(", ");
}

function kitLine(ctx: TrainingContext): string {
  if (ctx.gymKit) return "Gym kit in play — you train at the gym";
  const kit = ctx.equipment.filter((e) => e !== "none").map((e) => e.replace(/_/g, " "));
  if (kit.length === 0) return "Bodyweight only — no kit needed";
  const list = kit.length === 1 ? kit[0] : `${kit.slice(0, -1).join(", ")} and ${kit[kit.length - 1]}`;
  return `Uses your ${list}`;
}

interface ReasonInput {
  ctx: TrainingContext;
  prefs: TrainingPrefs;
  decisions: DoseDecision[];
  effort: { hard: number; easy: number; counted: number };
  freshRules: boolean;
  milestone: Milestone | null;
  milestoneDays: number;
  chosenDays: number;
  weekStart: string;
}

function weekReasons(r: ReasonInput): string[] {
  const { ctx, prefs } = r;
  const out: string[] = [];
  const from = ctx.goalSource === "training" ? "your training goal" : "your goal";
  out.push(`Built for ${EMPHASIS_LABEL[ctx.emphasis]} (${from}) — ${schemePhrase(ctx.emphasis)}`);
  if (ctx.secondary.length > 0) {
    out.push(`Also for ${ctx.secondary.map((e) => EMPHASIS_LABEL[e]).join(" and ")} — see the extras on each day`);
  }

  const ups = r.decisions.filter((d) => d.move === "up").length;
  const downs = r.decisions.filter((d) => d.move === "down").length;
  const kept = r.decisions.filter((d) => d.move === "hold").length;
  if (r.freshRules) {
    out.push("New goal, new starting doses — last week's numbers were for a different plan");
  } else if (r.effort.counted >= 2 && r.effort.hard >= 2) {
    out.push(`No step-ups this week — you rated ${r.effort.hard} of your last ${r.effort.counted} sessions hard`);
  } else if (ups + downs + kept > 0) {
    const parts: string[] = [];
    if (ups > 0) parts.push(`${ups} ${ups === 1 ? "move" : "moves"} stepped up`);
    if (downs > 0) parts.push(`${downs} eased back`);
    if (kept > 0) parts.push(`${kept} held where you are`);
    out.push(`From your logged sessions: ${parts.join(", ")}`);
  }

  const n = ctx.days.length;
  out.push(
    `${n} ${n === 1 ? "day" : "days"} a week: ${listDays(ctx.days)} — ${
      ctx.daysSource === "you"
        ? "the days you picked"
        : "spread out for recovery; pick your own days in Training preferences"
    }`,
  );
  out.push(
    ctx.minutesSource === "you"
      ? `Up to ${ctx.sessionMinutes} minutes a session — the length you chose`
      : `Up to ${ctx.sessionMinutes} minutes a session — a starting length for your ${ctx.level} level; change it in Training preferences`,
  );

  if (ctx.ceiling !== ctx.level) {
    out.push(`${cap(ctx.ceiling)} moves at most — for ${ctx.ceilingWhy ?? "your health"}`);
  } else {
    out.push(`Moves for your ${ctx.level} level`);
  }
  if (ctx.gentleStart) out.push("Two sets per move to start — building up from a mostly seated day");

  out.push(...safetyNotes(ctx.bio));
  if (ctx.lowImpact && ctx.lowImpact.why !== "pregnancy" && ctx.lowImpact.why !== "postpartum") {
    out.push(`No jumping — ${ctx.lowImpact.label}`);
  }
  if (ctx.balance) out.push("A balance move every session — advised past 65");
  if (ctx.warmupMoves >= 3) out.push("Three-move warm-ups — a little longer to loosen up past 50");

  out.push(kitLine(ctx));
  if (ctx.location === "home") out.push("Quiet, floor-friendly moves first — you train at home");
  if (ctx.location === "outdoors") out.push("Moving drills first — you train outdoors");
  if (ctx.styles.length > 0) {
    out.push(`Leans toward what you enjoy: ${ctx.styles.map((s) => (s === "hiit" ? "HIIT" : s)).join(", ")}`);
  }
  if (r.milestone) {
    out.push(
      `${r.milestone.rung.name} on ${r.milestoneDays} ${r.milestoneDays === 1 ? "day" : "days"} — practice for your milestone “${ctx.milestoneText}”`,
    );
  }
  if (r.chosenDays > 0) {
    const planned = n - r.chosenDays;
    const picks = r.chosenDays === 1 ? "1 day is your pick" : `${r.chosenDays} days are your picks`;
    out.push(
      planned > 0
        ? `${picks} from Explore; Gozlin plans the other ${planned}`
        : "Every day is your pick from Explore — reps set for your level",
    );
  }
  for (const a of activeAdjustments(prefs, r.weekStart)) {
    out.push(`Gozlin's change: ${a.title}`);
  }
  return out;
}

function splitName(kinds: DayKind[], emphasisLabel: string, chosen: number): string {
  const n = kinds.length;
  const work = kinds.filter((k) => k !== "mobility");
  const set = new Set(work);
  const only = (allowed: DayKind[]) => work.length > 0 && [...set].every((k) => allowed.includes(k));
  let name: string;
  if (only(["full_a", "full_b", "full_c"])) name = `${n}-day full body`;
  else if (only(["upper", "lower"])) name = `${n}-day upper/lower`;
  else if (only(["push", "pull", "legs", "upper", "lower"]) && set.has("push")) name = `${n}-day push/pull/legs`;
  else name = `${n}-day ${emphasisLabel} plan`;
  return chosen > 0 ? `${name} · ${chosen} of your picks` : name;
}

/* ─────────────────────────────── the build ─────────────────────────────── */

export function buildTrainingWeek(input: BuildWeekInput): GeneratedWorkoutPlan {
  const { bio, prefs, weekStart, today, pool, previous } = input;
  const ctx = deriveContext(bio, prefs);
  const byId = new Map(pool.map((e) => [e.id, e]));
  const history = readHistory(input.sessions, today);
  const effort = recentEffort(input.sessions, today);

  // Doses climb from last week only while the dose rules are the same ones.
  // When the rules changed (a new goal), sessions before this week are not a
  // starting point — and the week says so, for as long as it is this week.
  let carryFrom: string | null = null;
  if (previous?.schemeKey) {
    carryFrom = previous.schemeKey === ctx.schemeKey ? (previous.schemeSince ?? null) : weekStart;
  }
  const freshRules =
    carryFrom === weekStart &&
    [...history.values()].some((h) => h.records.some((r) => r.date < weekStart));

  const pins: Pin[] = activeAdjustments(prefs, weekStart)
    .filter((a) => a.change.replacementId && a.exerciseId)
    .map((a) => ({
      fromId: a.exerciseId as string,
      fromName: a.exerciseName ?? byId.get(a.exerciseId as string)?.name ?? "the old move",
      toId: a.change.replacementId as string,
    }));

  const env: SelectEnv = {
    ctx,
    pool,
    byId,
    history,
    today,
    carryFrom,
    effort,
    pins,
    milestoneRung: null,
    notYet: new Set(),
    usedThisWeek: new Map(),
  };

  // Outgrown moves and the variants that take over from them.
  const doseCache = new Map<string, DoseDecision>();
  const outgrown = new Map<string, string>();
  const nextSteps = new Map<string, string>();
  for (const [id, h] of history) {
    const ex = byId.get(id);
    if (!ex || h.records.length === 0) continue;
    if (!doseFor(ex, "main", env, doseCache).outgrown) continue;
    const next = harderVariant(ex, env);
    if (next) {
      outgrown.set(ex.id, ex.name);
      nextSteps.set(next.id, ex.name);
    }
  }

  const milestone = resolveMilestone(env, outgrown);
  env.milestoneRung = milestone?.rung.id ?? null;
  env.notYet = new Set(milestone?.notYet ?? []);

  const shaped = shapeWeek(env);
  const chosenByDay = new Map(
    prefs.mode === "chosen" && input.library
      ? prefs.chosen
          .map((c) => [c.day, input.library!(c.workoutId)] as const)
          .filter((pair): pair is readonly [number, WorkoutDefinition] => !!pair[1])
      : [],
  );

  // Milestone practice on up to three planned days, preferring days whose
  // shape already trains the ladder's pattern.
  const milestoneDays = new Set<number>();
  if (milestone) {
    const planned = shaped.filter((d) => !chosenByDay.has(d.day) && d.kind !== "mobility");
    const has = planned.filter((d) => DAY_TEMPLATES[d.kind].slots.some((s) => s.pattern === milestone.pattern));
    for (const d of [...has, ...planned.filter((d) => !has.includes(d))]) {
      if (milestoneDays.size >= Math.min(3, Math.max(2, has.length))) break;
      milestoneDays.add(d.day);
    }
  }

  const opts = { doseCache, outgrown, nextSteps, weekStart };
  const builds = shaped.map((d) => {
    const def = chosenByDay.get(d.day);
    return def ? buildChosenDay(d.day, def, env, opts) : buildPlannedDay(d, milestoneDays, milestone, env, opts);
  });

  // Same label twice in a week reads as a typo; letter them in order.
  const labelCount = new Map<string, number>();
  for (const b of builds) labelCount.set(b.session.dayLabel, (labelCount.get(b.session.dayLabel) ?? 0) + 1);
  const seen = new Map<string, number>();
  let sessions = builds.map((b) => {
    const label = b.session.dayLabel;
    if ((labelCount.get(label) ?? 0) < 2 || b.session.source === "chosen") return b.session;
    const k = seen.get(label) ?? 0;
    seen.set(label, k + 1);
    return { ...b.session, dayLabel: `${label} ${String.fromCharCode(65 + k)}` };
  });
  sessions = applyDoseAdjustments(sessions, prefs, weekStart, byId);

  const inputHash = trainingInputHash(bio, prefs, weekStart);
  return {
    id: `wplan_${inputHash}`,
    createdAt: (input.now ?? new Date()).toISOString(),
    weekStart,
    splitType: splitName(
      shaped.map((d) => d.kind),
      EMPHASIS_LABEL[ctx.emphasis],
      chosenByDay.size,
    ),
    sessions,
    inputHash,
    reasons: weekReasons({
      ctx,
      prefs,
      decisions: builds.flatMap((b) => b.decisions),
      effort,
      freshRules,
      milestone,
      milestoneDays: milestoneDays.size,
      chosenDays: chosenByDay.size,
      weekStart,
    }),
    mode: prefs.mode,
    engineVersion: ENGINE_VERSION,
    schemeKey: ctx.schemeKey,
    ...(carryFrom ? { schemeSince: carryFrom } : {}),
  };
}
