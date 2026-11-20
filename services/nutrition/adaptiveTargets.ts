/**
 * ADAPTIVE TARGETS — the learning model's number, offered as her target.
 *
 * The filter in health-os/learning/tdee.ts learns what her day really burns
 * from what she logs and what the scale does. Until 2026-11-20 nothing used it:
 * `tdeeForTargets` had no caller. Now, once it has earned it, the app OFFERS
 * new numbers (the owner's 2026-11-20 decision: ask first, one tap to accept,
 * at most once a week) — it never changes them by itself.
 *
 * A proposal exists only when ALL hold:
 *   · the model says it's confident (its own gate: 14 weigh-ins, ±120 kcal);
 *   · at least MIN_COMPLETE_DAYS whole days of intake and MIN_WEIGH_INS
 *     weigh-ins in the last 28 days — recent evidence, not old;
 *   · she is not under 18, pregnant, postpartum or underweight;
 *   · ADAPT_COOLDOWN_DAYS have passed since the last proposal, answered or not.
 *
 * The new maintenance BLENDS the formula's and the learned figure by the
 * model's own uncertainty (the surer it is, the more it counts), stays within
 * ±25% of the formula (MAX_MAINTENANCE_ADJUST_SHARE), and one step never moves
 * her target more than ADAPT_STEP_KCAL. The clinical pass still runs after it:
 * the result is just a bio field (`maintenanceAdjustKcal`) that
 * calculateNutritionTargets reads.
 *
 * HONESTY: the learned figure blends her body AND her logging habits (logs run
 * 20–30% low). It is right for setting targets she will log against; it is
 * never stated as a fact about her metabolism, and the sentence says so.
 */
import type { UserBio } from "../../models/user";
import { read as readKalman, type TdeeReading } from "../../health-os/learning/tdee";
import type { KalmanState } from "../../health-os/learning/types";
import { store as healthStore } from "../../health-os/platform/storage/AsyncStorageAdapter";
import { K } from "../../health-os/platform/storage/keys";
import {
  calculateNutritionTargets,
  maintenanceTdee,
  MAX_MAINTENANCE_ADJUST_SHARE,
} from "../NutritionService";
import { noCutReason } from "./pace";
import { loadOffers, makeOffer, offeredWithin, saveOffer, type TargetOffer } from "./targetOffers";
import { RETARGET_KCAL } from "./weightRetarget";

/** Whole days of known intake needed in the last 28. */
export const MIN_COMPLETE_DAYS = 14;
/** Weigh-ins needed in the last 28 days. */
export const MIN_WEIGH_INS = 8;
/** One proposal never moves her target more than this. */
export const ADAPT_STEP_KCAL = 150;
/** At most one proposal a week, whatever she answered. */
export const ADAPT_COOLDOWN_DAYS = 7;
/** The formula's own error bar (σ, kcal) — the same 300 the filter starts from. */
export const FORMULA_SD_KCAL = 300;

const fmt = (n: number) => Math.round(n).toLocaleString();

export interface AdaptInput {
  bio: UserBio;
  reading: TdeeReading;
  knownIntakeDays28: number;
  weighIns28: number;
  offers: readonly TargetOffer[];
  today: string;
  now?: Date;
}

/** The maintenance the evidence supports: formula and learned, blended by certainty, clamped. */
export function blendedMaintenance(formula: number, learned: number, learnedSd: number): number {
  const vF = FORMULA_SD_KCAL * FORMULA_SD_KCAL;
  const vL = Math.max(1, learnedSd * learnedSd);
  const w = vF / (vF + vL);
  const blended = formula + w * (learned - formula);
  const cap = formula * MAX_MAINTENANCE_ADJUST_SHARE;
  return Math.max(formula - cap, Math.min(formula + cap, blended));
}

/** The plain "why", never a claim about her body alone. */
export function describeLearned(formula: number, learned: number, before: number, after: number): string {
  const gap = Math.round(Math.abs(learned - formula) / 10) * 10;
  const way = learned < formula ? "less" : "more";
  return (
    `I've watched 4 weeks of your meals and weigh-ins. Going by what you log, your ` +
    `weight has moved as if your day burns about ${fmt(gap)} kcal ${way} than the formula ` +
    `guessed. New numbers: ${fmt(before)} → ${fmt(after)} kcal a day.`
  );
}

/** A one-tap offer, or null (see the header for every gate). */
export function proposeAdjustment(input: AdaptInput): TargetOffer | null {
  const { bio, reading } = input;
  if (noCutReason(bio) !== null) return null;
  if (!reading.confident) return null;
  if (input.knownIntakeDays28 < MIN_COMPLETE_DAYS || input.weighIns28 < MIN_WEIGH_INS) return null;
  if (input.offers.some((o) => o.id === "learned" && o.status === "pending")) return null;
  if (offeredWithin(input.offers, "learned", input.today, ADAPT_COOLDOWN_DAYS)) return null;

  const formula = maintenanceTdee(bio);
  const want = Math.round(blendedMaintenance(formula, reading.learnedTdee, reading.uncertainty) - formula);
  const current = Number.isFinite(bio.maintenanceAdjustKcal) ? (bio.maintenanceAdjustKcal as number) : 0;
  const step = Math.max(-ADAPT_STEP_KCAL, Math.min(ADAPT_STEP_KCAL, want - current));
  const next = current + step;

  const before = calculateNutritionTargets(bio);
  const after = calculateNutritionTargets({ ...bio, maintenanceAdjustKcal: next });
  if (Math.abs(after.calories - before.calories) < RETARGET_KCAL) return null;

  return makeOffer(
    "learned",
    input.today,
    before,
    after,
    describeLearned(formula, reading.learnedTdee, before.calories, after.calories),
    { maintenanceAdjustKcal: next },
    input.now,
  );
}

/** Is the learning model confident about her burn right now? (Activity calibration defers to it.) */
export async function learningConfident(): Promise<boolean> {
  try {
    const state = await healthStore.get<KalmanState | null>(K.LEARNING_TDEE, null);
    return state ? readKalman(state).confident : false;
  } catch {
    return false;
  }
}

/**
 * After the nightly learning job: stage a proposal if one is due. Never throws
 * (learning is an enhancement, never a gate).
 */
export async function stageLearnedOffer(
  bio: UserBio,
  evidence: { knownIntakeDays28: number; weighIns28: number },
  today: string,
): Promise<void> {
  try {
    const state = await healthStore.get<KalmanState | null>(K.LEARNING_TDEE, null);
    if (!state) return;
    const offer = proposeAdjustment({
      bio,
      reading: readKalman(state),
      knownIntakeDays28: evidence.knownIntakeDays28,
      weighIns28: evidence.weighIns28,
      offers: await loadOffers(),
      today,
    });
    if (offer) await saveOffer(offer);
  } catch (e) {
    console.log("stageLearnedOffer: nothing offered", e);
  }
}
