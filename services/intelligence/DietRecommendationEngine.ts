/**
 * DIET RECOMMENDATION ENGINE
 *
 * The intelligence layer on top of DietMatchService. It does NOT re-score diets
 * (DietMatchService remains the single source of scoring + banding); it wraps
 * those scores with plain-language, explainable reasons so users understand
 * *why* a diet is recommended.
 *
 * Bands (enforced by DietMatchService, surfaced here):
 *   - Recommended : 87–96%
 *   - Safe Option : 75–86%
 *   - Score is clamped at 96 — we never show 100%.
 */

import {
  DIET_DATABASE,
  DietData,
  DietMealOption,
} from "../../constants/DietDatabase";
import { DietMatchScore } from "../../models/diet";
import { NutritionTargets } from "../../models/nutrition";
import { UserBio } from "../../models/user";
import { calculateDietMatches } from "../DietMatchService";

export type DietBand = "recommended" | "safe";

export interface DietRecommendation {
  dietId: string;
  diet: DietData;
  /** 75–96, never 100. */
  score: number;
  band: DietBand;
  /** Explainable, plain-language reasons (max 4). */
  reasons: string[];
  warnings: string[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function avg(range: { min: number; max: number }): number {
  return (range.min + range.max) / 2;
}

/** Average protein (g) across a diet's main meals — proxy for protein density. */
function estimateMealProtein(diet: DietData): number {
  const mains: DietMealOption[] = [
    ...diet.breakfastOptions,
    ...diet.lunchOptions,
    ...diet.dinnerOptions,
  ];
  if (mains.length === 0) return 0;
  return mains.reduce((s, m) => s + avg(m.protein), 0) / mains.length;
}

function hasNigerianOptions(diet: DietData): boolean {
  return [
    ...diet.breakfastOptions,
    ...diet.lunchOptions,
    ...diet.dinnerOptions,
  ].some((m) => m.isNigerian);
}

const MUSCLE_GOALS = new Set(["build_muscle", "athletic_performance"]);

/**
 * Build explainable reasons for choosing a diet.
 *
 * Reasons are ordered most-personal-first and merged with the goal/condition
 * reasons already produced by DietMatchService. Capped at 4 so the UI stays
 * scannable. Safe to call with null bio/targets (degrades gracefully).
 */
export function buildDietReasons(
  diet: DietData,
  bio: UserBio | null,
  targets: NutritionTargets | null,
  matchReasons: string[] = [],
): string[] {
  const reasons: string[] = [];

  // Calorie fit — the daily plan for any diet is assembled around the user's
  // calorie target (see DietPlanGenerator.getMealCalorieSplit), so this is
  // accurate and reassuring.
  if (targets?.calories) {
    reasons.push(`Built around your ${Math.round(targets.calories)} kcal goal`);
  }

  // Protein density.
  const mealProtein = estimateMealProtein(diet);
  if (mealProtein >= 22) {
    reasons.push("High in protein");
  } else if (mealProtein >= 16 && bio && MUSCLE_GOALS.has(bio.primaryGoal)) {
    reasons.push("Solid protein for muscle building");
  }

  // Adherence / difficulty.
  if (diet.difficulty === "Easy") {
    reasons.push("Beginner-friendly — easy to follow");
  }

  // Goal / condition reasons from the scorer (e.g. "Good for hypertension").
  for (const r of matchReasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  // Cultural fit.
  if (hasNigerianOptions(diet)) {
    reasons.push("Includes Nigerian meal options");
  }

  return reasons.slice(0, 4);
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

function toRecommendation(
  match: DietMatchScore,
  band: DietBand,
  bio: UserBio,
  targets: NutritionTargets | null,
): DietRecommendation | null {
  const diet = DIET_DATABASE.find((d) => d.id === match.dietId);
  if (!diet) return null;
  return {
    dietId: match.dietId,
    diet,
    score: match.score,
    band,
    reasons: buildDietReasons(diet, bio, targets, match.reasons ?? []),
    warnings: match.warnings ?? [],
  };
}

/**
 * Recommend diets for a user, split into the two bands with explainable reasons.
 */
export function recommendDiets(
  bio: UserBio,
  targets: NutritionTargets | null,
): { recommended: DietRecommendation[]; safeOptions: DietRecommendation[] } {
  const matches = calculateDietMatches(bio);

  const recommended = matches
    .filter((m) => m.isRecommended && !m.isBlocked)
    .sort((a, b) => b.score - a.score)
    .map((m) => toRecommendation(m, "recommended", bio, targets))
    .filter((r): r is DietRecommendation => r !== null);

  const safeOptions = matches
    .filter((m) => m.isSafeOption && !m.isBlocked)
    .sort((a, b) => b.score - a.score)
    .map((m) => toRecommendation(m, "safe", bio, targets))
    .filter((r): r is DietRecommendation => r !== null);

  return { recommended, safeOptions };
}
