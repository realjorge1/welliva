/**
 * GOZLIN — Adaptive Nutrition Intelligence (Phase 6).
 *
 * The Nutrition-Scientist brain. It reads what the user has actually eaten —
 * selected meals, the meals they routinely skip, calorie & protein intake, and
 * the trend across the week — and decides how future eating should change:
 * calorie/protein alerts, macro optimization, meal swaps, and the food
 * preferences that should steer future plans.
 *
 * Composes the existing nutrition single-source (NutritionInsightEngine:
 * getProteinStatus / computeWeeklySummary) and the day-end history that
 * ScheduleService records — it adds no new persistence or macro scoring of its
 * own. Pure & deterministic (inject `now` for tests).
 *
 * Example output: "You consistently avoid dairy meals. Future plans will
 * prioritize dairy-free options."
 */

import type { DietHistoryEntry } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { PrimaryGoal, UserBio } from "../../models/user";
import { computeWeeklySummary, getProteinStatus } from "../intelligence";
// The water-free ConsumedTotals (macros only) — the barrel's same-named type
// (from CoachInsightEngine) additionally requires waterMl, which we don't need.
import type { ConsumedTotals } from "../intelligence/NutritionInsightEngine";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import type {
  FoodAvoidance,
  GozlinNutritionAdaptation,
  GozlinTwin,
  NutritionAdaptation,
} from "./gozlin.types";

// ── Tunables ────────────────────────────────────────────────────────
const WINDOW_DAYS = 14;
const MIN_DAYS = 4; // below this we don't have enough to read a trend
const OVER_RATIO = 1.08; // ≥108% of target, sustained → over
const UNDER_RATIO = 0.8; // ≤80% of target, sustained → under
const PROTEIN_OK = 0.85; // ≥85% of protein target → fine

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// ════════════════════════════════════════════════════════════════════
// Food-preference learning (the "you avoid dairy" detector)
// ════════════════════════════════════════════════════════════════════

interface FoodTag {
  tag: string;
  label: string;
  keywords: string[];
}

/** Keyword families used to classify meal names. Heuristic, confidence-gated. */
const FOOD_TAGS: FoodTag[] = [
  { tag: "dairy", label: "dairy meals", keywords: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "dairy"] },
  { tag: "egg", label: "egg dishes", keywords: ["egg", "omelet", "omelette", "frittata"] },
  { tag: "fish", label: "fish & seafood", keywords: ["fish", "salmon", "tuna", "mackerel", "sardine", "shrimp", "prawn", "seafood", "tilapia", "catfish"] },
  { tag: "red-meat", label: "red-meat meals", keywords: ["beef", "steak", "lamb", "mutton", "goat", "pork", "bacon"] },
  { tag: "poultry", label: "poultry meals", keywords: ["chicken", "turkey"] },
  { tag: "legume", label: "bean & legume dishes", keywords: ["bean", "lentil", "chickpea", "moimoi", "moi-moi", "akara", "hummus"] },
];

function matches(name: string, tag: FoodTag): boolean {
  const n = name.toLowerCase();
  return tag.keywords.some((k) => n.includes(k));
}

function entriesInWindow(history: DietHistoryEntry[], today: string): DietHistoryEntry[] {
  const end = parseLocalDate(today);
  const cutoff = new Date(end);
  cutoff.setDate(end.getDate() - WINDOW_DAYS);
  return history.filter((h) => {
    const d = parseLocalDate(h.date);
    return d >= cutoff && d <= end;
  });
}

/**
 * Infer which kinds of meals the user routinely skips, from the meal names
 * ScheduleService records by outcome. Each avoidance is confidence-gated on how
 * often that food was actually served, so a one-off skip never becomes a rule.
 */
export function analyzeFoodAvoidances(
  history: DietHistoryEntry[],
  today: string,
): FoodAvoidance[] {
  const windowed = entriesInWindow(history, today);
  const out: FoodAvoidance[] = [];

  for (const tag of FOOD_TAGS) {
    let served = 0;
    let skips = 0;
    for (const h of windowed) {
      const eaten = h.consumedMeals ?? [];
      const missed = h.skippedMeals ?? [];
      for (const name of eaten) if (matches(name, tag)) served++;
      for (const name of missed) if (matches(name, tag)) {
        served++;
        skips++;
      }
    }
    if (served < 3) continue; // not enough exposure to judge
    const rate = skips / served;
    const confidence = clamp(served / 5, 0, 1);
    if (rate >= 0.6 && confidence >= 0.5) {
      out.push({ tag: tag.tag, label: tag.label, skips, served, rate: Math.round(rate * 100) / 100, confidence: Math.round(confidence * 100) / 100 });
    }
  }

  return out.sort((a, b) => b.rate * b.confidence - a.rate * a.confidence);
}

// ════════════════════════════════════════════════════════════════════
// Decision engine
// ════════════════════════════════════════════════════════════════════

export interface NutritionAdaptationInput {
  twin: GozlinTwin;
  bio: UserBio | null;
  targets: NutritionTargets | null;
  /** Today's consumed totals (for the live meal-swap lever). */
  consumed: ConsumedTotals;
  dietHistory: DietHistoryEntry[];
  weekStart: string;
  now?: Date;
}

/** Minimum protein share of calories we want, by goal. */
function proteinShareTarget(goal: PrimaryGoal | null): number {
  switch (goal) {
    case "build_muscle":
    case "athletic_performance":
      return 0.3;
    case "lose_weight":
      return 0.3;
    default:
      return 0.22;
  }
}

interface WindowAverages {
  days: number;
  avgCal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
}

/** Average macros over windowed days the user actually ate (skips don't count). */
function windowAverages(history: DietHistoryEntry[], today: string): WindowAverages {
  const windowed = entriesInWindow(history, today).filter(
    (h) => typeof h.consumedCalories === "number" && (h.consumedCalories ?? 0) > 0,
  );
  return {
    days: windowed.length,
    avgCal: Math.round(mean(windowed.map((h) => h.consumedCalories ?? 0))),
    avgProtein: Math.round(mean(windowed.map((h) => h.consumedProteinG ?? 0))),
    avgCarbs: Math.round(mean(windowed.map((h) => h.consumedCarbsG ?? 0))),
    avgFat: Math.round(mean(windowed.map((h) => h.consumedFatG ?? 0))),
  };
}

export function buildNutritionAdaptations(
  input: NutritionAdaptationInput,
): GozlinNutritionAdaptation {
  const { twin, targets, bio } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const avg = windowAverages(input.dietHistory, today);
  const goal = bio?.primaryGoal ?? twin.goal;
  const dataLimited = avg.days < MIN_DAYS;

  const adaptations: NutritionAdaptation[] = [];
  const avoidances = analyzeFoodAvoidances(input.dietHistory, today);

  let proteinFlagged = false;

  if (!dataLimited && targets) {
    // ── Calorie alert (sustained over / under target) ──
    if (targets.calories > 0) {
      const ratio = avg.avgCal / targets.calories;
      if (ratio >= OVER_RATIO) {
        const over = avg.avgCal - targets.calories;
        adaptations.push({
          kind: "calorie_alert",
          icon: "alert-circle-outline",
          title: `Calories running ~${over} over`,
          explanation: `Your intake has averaged ${avg.avgCal} kcal over the last ${avg.days} days — about ${over} above your ${targets.calories} target. Trimming the easy extras (oversized portions, calorie drinks) brings it back in line without feeling restrictive.`,
          evidence: [`${avg.avgCal} avg kcal vs ${targets.calories} target`, `${avg.days} days analyzed`],
          action: "Cap one meal/day at a lighter option this week.",
          priority: 0.78,
          tone: "honest",
        });
      } else if (ratio <= UNDER_RATIO) {
        const under = targets.calories - avg.avgCal;
        adaptations.push({
          kind: "calorie_alert",
          icon: "trending-down-outline",
          title: `Under-fueling by ~${under} kcal`,
          explanation: goal === "build_muscle"
            ? `You're averaging ${avg.avgCal} kcal — about ${under} under target. You can't build on a deficit; let's add a protein-forward snack to feed the work.`
            : `You're averaging ${avg.avgCal} kcal, ${under} under target. Under-eating tanks energy and recovery — let's nudge intake back up.`,
          evidence: [`${avg.avgCal} avg kcal vs ${targets.calories} target`, `${avg.days} days analyzed`],
          action: "Add one balanced snack to your day.",
          priority: 0.72,
          tone: "honest",
        });
      }
    }

    // ── Protein alert (sustained weekly shortfall) ──
    if (targets.proteinG > 0) {
      const pRatio = avg.avgProtein / targets.proteinG;
      if (pRatio < PROTEIN_OK) {
        proteinFlagged = true;
        const gap = Math.max(0, targets.proteinG - avg.avgProtein);
        adaptations.push({
          kind: "protein_alert",
          icon: "barbell-outline",
          title: `Protein averaging ${avg.avgProtein}g/day`,
          explanation: `Across the last ${avg.days} days you've averaged ${avg.avgProtein}g protein against a ${targets.proteinG}g target — about ${gap}g short daily. Protein is the highest-leverage fix for recovery and staying full; future plans will prioritize protein-forward meals.`,
          evidence: [`${avg.avgProtein}g avg vs ${targets.proteinG}g target`, `~${gap}g/day short`],
          action: "Add a protein source (eggs, fish, beans, chicken) to one meal.",
          priority: 0.8,
          tone: "honest",
        });
      }
    }

    // ── Macro optimization (ratio off, even if absolute protein is okay) ──
    if (!proteinFlagged && avg.avgCal > 0) {
      const proteinShare = (avg.avgProtein * 4) / avg.avgCal;
      const carbShare = (avg.avgCarbs * 4) / avg.avgCal;
      const want = proteinShareTarget(goal);
      if (proteinShare < want - 0.04 && carbShare > 0.5) {
        adaptations.push({
          kind: "macro_optimization",
          icon: "pie-chart-outline",
          title: "Rebalance carbs toward protein",
          explanation: `Your split skews carb-heavy — about ${Math.round(carbShare * 100)}% of calories from carbs and only ${Math.round(proteinShare * 100)}% from protein. Shifting a portion of carbs to protein each day improves satiety and recovery for your goal without changing total calories.`,
          evidence: [`${Math.round(proteinShare * 100)}% protein / ${Math.round(carbShare * 100)}% carbs`, `target ~${Math.round(want * 100)}% protein`],
          action: "Swap a starchy side for a protein source at lunch or dinner.",
          priority: 0.55,
          tone: "curious",
        });
      }
    }
  }

  // ── Food preference (steers future plans) ──
  if (avoidances.length > 0) {
    const a = avoidances[0];
    adaptations.push({
      kind: "food_preference",
      icon: "options-outline",
      title: `You consistently avoid ${a.label}`,
      explanation: `You've skipped ${a.label} ${a.skips} of the ${a.served} times they came up — that's a preference, not a coincidence. Apply this and future plans will prioritize ${a.tag}-free options so your plan fits what you'll actually eat.`,
      evidence: [`skipped ${a.skips}/${a.served} ${a.label}`],
      action: `Prioritize ${a.tag}-free meals in future plans.`,
      tag: a.tag,
      priority: 0.6,
      tone: "warm",
    });
  }

  // ── Meal swap (today's live lever) ──
  if (targets) {
    const status = getProteinStatus({ consumed: input.consumed, targets, now });
    if ((status.state === "low" || status.state === "behind") && status.remainingG > 0) {
      adaptations.push({
        kind: "meal_swap",
        icon: "swap-horizontal",
        title: "Swap your next meal for a protein pick",
        explanation: `You're ${status.remainingG}g short on protein for today. Choosing a protein-forward option for your next meal — or using Smart Swaps on the Diet tab — closes the gap before the day's out.`,
        evidence: [`${status.consumedG}g of ${status.targetG}g so far today`],
        action: "Open Smart Swaps on your next meal.",
        priority: 0.5,
        tone: "curious",
      });
    }
  }

  // ── Weekly consistency recommendation ──
  if (!dataLimited && twin.momentum.adherence7d < 55) {
    const summary = computeWeeklySummary(input.dietHistory, input.weekStart, today);
    adaptations.push({
      kind: "weekly_recommendation",
      icon: "calendar-outline",
      title: "Tighten one meal slot this week",
      explanation: `Adherence has been sitting at ${twin.momentum.adherence7d}/100. Rather than overhaul everything, protect the one meal you skip most — making it non-negotiable lifts the whole week.`,
      evidence: [`${twin.momentum.adherence7d}/100 adherence`, `${summary.daysLogged} days logged this week`],
      priority: 0.35,
      tone: "steady",
    });
  }

  // ── Fallback ──
  if (adaptations.length === 0) {
    adaptations.push({
      kind: "weekly_recommendation",
      icon: dataLimited ? "calendar-outline" : "checkmark-circle-outline",
      title: dataLimited ? "Keep logging your meals" : "Your nutrition is dialed in",
      explanation: dataLimited
        ? "I need a few more logged days before I can adapt your nutrition. Mark meals as eaten and I'll start spotting the patterns and trends."
        : "Calories, protein, and your meal choices are all tracking well — no changes needed. Steady, repeatable eating is exactly the goal.",
      evidence: dataLimited ? ["awaiting more meal data"] : [`${avg.days} days analyzed`],
      priority: 0.1,
      tone: dataLimited ? "warm" : "steady",
    });
  }

  adaptations.sort((a, b) => b.priority - a.priority);
  const top = adaptations.slice(0, 5);

  return {
    __kind: "nutrition-adaptation",
    summary: buildSummary(top, avoidances, dataLimited),
    avoidances,
    adaptations: top,
    weeklyFocus: top[0]?.action ?? top[0]?.title ?? "Keep your current plan steady.",
    dataLimited,
  };
}

function buildSummary(
  adaptations: NutritionAdaptation[],
  avoidances: FoodAvoidance[],
  dataLimited: boolean,
): string {
  if (dataLimited) {
    return "Not enough logged meals yet to adapt your nutrition — let's build a few days of data first.";
  }
  const lead = adaptations[0];
  if (lead?.kind === "protein_alert") return "Protein's the lever this week — here's how to close the gap.";
  if (lead?.kind === "calorie_alert") return "Your intake's drifted from target — a small correction puts it right.";
  if (avoidances.length > 0) return "I'm learning what you'll actually eat — and tuning your plan to match.";
  if (lead?.kind === "macro_optimization") return "Your calories are fine; it's the macro split worth tuning.";
  return "Here's how I'd adapt your nutrition based on what you've actually been eating.";
}
