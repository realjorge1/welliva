/**
 * WEIGHT RETARGET — her target follows her weight, in explained steps.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * Weigh-ins logged on the quick-log card or through Gozlin were saved to the
 * weight log and nowhere else. The target was calculated from the profile's
 * weight, which only the Profile screen ever changed — so someone who lost
 * 10 kg kept eating her day-one number, her deficit shrank month after month,
 * and she plateaued without knowing why.
 *
 * ── HOW IT MOVES ────────────────────────────────────────────────────────────
 *  1. Her TREND weight (weightTrend.ts), never a raw reading.
 *  2. The targets for the trend weight are compared with today's. Only a move
 *     of RETARGET_KCAL or RETARGET_PROTEIN_G is applied — small drift waits and
 *     accumulates into one explained step. Silent small drift is the one thing
 *     to avoid: a number that changes by itself is a bug in the user's eyes.
 *  3. Every applied move is stored with its own plain sentence and shown once
 *     (WeightMoveCard). The last MOVES_CAP moves are kept, so "why did my
 *     number change?" always has an answer.
 *
 * No automatic move for anyone under 18, pregnant, postpartum or underweight:
 * their numbers change only when they edit their profile. (A trend that crosses
 * INTO the no-cut range does apply — that move removes a cut, it never adds one.)
 *
 * The decisions here are pure; the store at the bottom is the only I/O.
 */
import type { NutritionTargets } from "../../models/nutrition";
import type { TargetPace, UserBio } from "../../models/user";
import { calculateNutritionTargets, targetMaintenance } from "../NutritionService";
import { readJSON, writeJSON } from "../OfflineStorage";
import { noCutReason, TAPER_KG } from "./pace";
import { makeOffer, offeredWithin, type TargetOffer } from "./targetOffers";
import { trendOn, weightTrend, type TrendResult, type WeighInPoint } from "./weightTrend";

/** A calorie move smaller than this waits (and accumulates). */
export const RETARGET_KCAL = 25;
/** A protein move smaller than this waits too. */
export const RETARGET_PROTEIN_G = 5;

/**
 * The pace guard: losing faster than this share of body weight a week…
 * (above ~1%/week lean-mass loss climbs — Helms 2014; Garthe 2011)
 */
export const PACE_GUARD_SHARE_PER_WEEK = 0.01;
/** …for this many weeks in a row, while on a cut, earns one offer to ease up. */
export const PACE_GUARD_WEEKS = 3;
/** Once offered, the guard stays quiet this long, whatever she answered. */
export const PACE_GUARD_QUIET_DAYS = 56;

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => Math.round(n).toLocaleString();

/** True while her trend weight is within TAPER_KG of her goal on a loss goal. */
export function shouldTaper(
  bio: Pick<UserBio, "primaryGoal">,
  trendKg: number,
  goalWeightKg: number | null | undefined,
): boolean {
  if (bio.primaryGoal !== "lose_weight") return false;
  if (!(typeof goalWeightKg === "number" && goalWeightKg > 0)) return false;
  return trendKg - goalWeightKg <= TAPER_KG;
}

/** The groups whose numbers never move by themselves. */
export function noAutomaticMoves(bio: UserBio): boolean {
  return noCutReason(bio) !== null;
}

export interface RetargetDecision {
  nextBio: UserBio;
  before: NutritionTargets;
  after: NutritionTargets;
  fromKg: number;
  toKg: number;
  taperChanged: boolean;
}

/**
 * Should her numbers follow her trend weight right now? Null = no (no trend,
 * a protected group, or a move too small to be worth a sentence).
 */
export function retargetDecision(input: {
  bio: UserBio;
  trendKg: number | null;
  goalWeightKg?: number | null;
}): RetargetDecision | null {
  const { bio, trendKg } = input;
  if (trendKg === null || !Number.isFinite(trendKg)) return null;
  if (noAutomaticMoves(bio)) return null;

  const toKg = round1(trendKg);
  const taper = shouldTaper(bio, toKg, input.goalWeightKg);
  const nextBio: UserBio = { ...bio, weightKg: toKg };
  if (taper) nextBio.nearGoalTaper = true;
  else delete nextBio.nearGoalTaper;

  const before = calculateNutritionTargets(bio);
  const after = calculateNutritionTargets(nextBio);
  const moved =
    Math.abs(after.calories - before.calories) >= RETARGET_KCAL ||
    Math.abs(after.proteinG - before.proteinG) >= RETARGET_PROTEIN_G;
  if (!moved) return null;

  return {
    nextBio,
    before,
    after,
    fromKg: bio.weightKg,
    toKg,
    taperChanged: !!bio.nearGoalTaper !== taper,
  };
}

/** The once-shown sentence for a weight move. Neutral either way: no praise, no blame. */
export function describeWeightMove(d: RetargetDecision): string {
  const kcal = `${fmt(d.before.calories)} → ${fmt(d.after.calories)} kcal`;
  const protein =
    Math.abs(d.after.proteinG - d.before.proteinG) >= RETARGET_PROTEIN_G
      ? `, protein ${fmt(d.before.proteinG)} → ${fmt(d.after.proteinG)} g`
      : "";
  const numbers = `${kcal}${protein}`;

  if (d.taperChanged && d.nextBio.nearGoalTaper) {
    return `You're within ${TAPER_KG} kg of your goal weight, so I've halved your calorie cut for the last stretch: ${numbers}.`;
  }
  if (noCutReason(d.nextBio) === "underweight" && noCutReason({ ...d.nextBio, weightKg: d.fromKg }) === null) {
    return `At your current weight for your height I don't set a calorie cut, so your target is now what your body uses: ${numbers}.`;
  }
  const change = round1(Math.abs(d.toKg - d.fromKg));
  const lead =
    d.toKg < d.fromKg
      ? `You've lost ${change.toFixed(1)} kg, so I updated your numbers`
      : `Your weight has gone up ${change.toFixed(1)} kg, so I updated your numbers`;
  return `${lead}: ${numbers}.`;
}

/* ──────────────────────────────── the pace guard ───────────────────────────*/

/** One step gentler. Null when there is no gentler pace to offer. */
export function gentlerPace(pace: TargetPace | undefined): TargetPace | null {
  if (pace === "faster") return "steady";
  if (pace === "steady") return "gentle";
  if (pace === undefined) return "gentle"; // the old fixed −500 → a 10% cut
  return null;
}

/**
 * True when her trend fell more than PACE_GUARD_SHARE_PER_WEEK of her weight in
 * each of the last PACE_GUARD_WEEKS weeks while she is on a cut. Reads the
 * TREND, so a single low reading can't trip it.
 */
export function paceGuardTripped(bio: UserBio, trend: TrendResult, today: string): boolean {
  if (bio.primaryGoal !== "lose_weight" || noAutomaticMoves(bio)) return false;
  const targets = calculateNutritionTargets(bio);
  if (targets.calories >= targetMaintenance(bio)) return false;
  const back = (weeks: number) => {
    const [y, m, d] = today.split("-").map(Number);
    const x = new Date(y!, m! - 1, d! - weeks * 7);
    const ds = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return trendOn(trend, ds);
  };
  for (let w = 0; w < PACE_GUARD_WEEKS; w++) {
    const now = back(w);
    const before = back(w + 1);
    if (now === null || before === null) return false;
    if (before - now <= before * PACE_GUARD_SHARE_PER_WEEK) return false;
  }
  return true;
}

/** The calm sentence for the pace-guard offer. Never "you're doing too well". */
export function describePaceGuard(before: NutritionTargets, after: NutritionTargets): string {
  return (
    `Your weight has been coming down faster than about 1% a week for three weeks, ` +
    `which is quicker than this plan aims for. I can raise your daily target a little: ` +
    `${fmt(before.calories)} → ${fmt(after.calories)} kcal.`
  );
}

/* ─────────────────────────── one pass, after a weigh-in ────────────────────*/

export interface WeightFollowPlan {
  trend: TrendResult;
  /** A move to apply now (and its record), or null. */
  decision: RetargetDecision | null;
  move: TargetMove | null;
  /** A pace-guard offer to stage, or null. */
  offer: TargetOffer | null;
}

/**
 * Everything a weigh-in (or the daily check) may do to her numbers, decided
 * purely from what's stored. The caller applies it.
 */
export function planWeightFollow(input: {
  bio: UserBio;
  goalWeightKg?: number | null;
  readings: readonly WeighInPoint[];
  noisyDates?: readonly string[];
  offers: readonly TargetOffer[];
  today: string;
  now: Date;
}): WeightFollowPlan {
  const trend = weightTrend(input.readings, { noisyDates: input.noisyDates });
  const decision = retargetDecision({
    bio: input.bio,
    trendKg: trend.trendKg,
    goalWeightKg: input.goalWeightKg,
  });
  const move = decision
    ? makeMove("weight", input.today, decision.before, decision.after, describeWeightMove(decision), input.now, {
        fromKg: decision.fromKg,
        toKg: decision.toKg,
      })
    : null;

  // The guard reads the bio as it will stand after any move above.
  const bioNow = decision ? decision.nextBio : input.bio;
  let offer: TargetOffer | null = null;
  const eased = gentlerPace(bioNow.pace);
  if (
    eased &&
    !offeredWithin(input.offers, "pace_guard", input.today, PACE_GUARD_QUIET_DAYS) &&
    paceGuardTripped(bioNow, trend, input.today)
  ) {
    const before = calculateNutritionTargets(bioNow);
    const after = calculateNutritionTargets({ ...bioNow, pace: eased });
    if (after.calories > before.calories) {
      offer = makeOffer("pace_guard", input.today, before, after, describePaceGuard(before, after), { pace: eased }, input.now);
    }
  }
  return { trend, decision, move, offer };
}

/* ──────────────────────────────── the record ──────────────────────────────*/

/** Synced (see services/sync/mergeStrategies: mergeById on `id`, newest `updatedAt` wins). */
export const TARGET_MOVES_KEY = "@welliva_target_moves";
/** How many moves are kept for "why did my number change?". */
export const MOVES_CAP = 10;

/**
 * `correction` is the odd one out: it is not a move SHE caused (a weigh-in, an
 * offer she accepted) but one the ALGORITHM made — recorded by
 * services/nutrition/TargetsVersion so the one-time notice still has an answer
 * once it is dismissed. It is always stored `seen`, because the correction card
 * has already said it; the move card must not say it twice.
 */
export type MoveKind = "weight" | "learned" | "activity" | "pace_guard" | "correction";

export interface TargetMove {
  /** `${kind}:${date}:${to.calories}` — two phones making the same move make one record. */
  id: string;
  kind: MoveKind;
  /** Local date the move was applied. */
  date: string;
  /** ISO time it was applied. */
  at: string;
  /** ISO time of the last change to this record (its `seen`), for the merge. */
  updatedAt: string;
  from: { calories: number; proteinG: number };
  to: { calories: number; proteinG: number };
  fromKg?: number;
  toKg?: number;
  /** The sentence shown once, kept as the answer to "why did it change?". */
  message: string;
  seen: boolean;
}

export function makeMove(
  kind: MoveKind,
  date: string,
  before: Pick<NutritionTargets, "calories" | "proteinG">,
  after: Pick<NutritionTargets, "calories" | "proteinG">,
  message: string,
  now: Date,
  kg?: { fromKg: number; toKg: number },
): TargetMove {
  const at = now.toISOString();
  return {
    id: `${kind}:${date}:${after.calories}`,
    kind,
    date,
    at,
    updatedAt: at,
    from: { calories: before.calories, proteinG: before.proteinG },
    to: { calories: after.calories, proteinG: after.proteinG },
    ...(kg ? kg : {}),
    message,
    seen: false,
  };
}

/** Newest first, capped — the same order and cap the merge strategy keeps. */
export function addMove(moves: readonly TargetMove[], move: TargetMove): TargetMove[] {
  const rest = moves.filter((m) => m.id !== move.id);
  return [move, ...rest].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, MOVES_CAP);
}

export async function loadMoves(): Promise<TargetMove[]> {
  try {
    const moves = await readJSON<TargetMove[]>(TARGET_MOVES_KEY, []);
    return Array.isArray(moves) ? moves : [];
  } catch {
    return [];
  }
}

export async function recordMove(move: TargetMove): Promise<void> {
  const moves = await loadMoves();
  await writeJSON(TARGET_MOVES_KEY, addMove(moves, move));
}

/** The newest move she hasn't seen, if any — one card at a time. */
export async function latestUnseenMove(): Promise<TargetMove | null> {
  const moves = await loadMoves();
  return moves.find((m) => !m.seen) ?? null;
}

/** Mark a move seen (and every older one: one card stands for the run). */
export async function markMovesSeen(upToId: string, now: Date = new Date()): Promise<void> {
  const moves = await loadMoves();
  const index = moves.findIndex((m) => m.id === upToId);
  if (index < 0) return;
  const stamp = now.toISOString();
  const next = moves.map((m, i) => (i >= index && !m.seen ? { ...m, seen: true, updatedAt: stamp } : m));
  await writeJSON(TARGET_MOVES_KEY, next);
}
