/**
 * COACH INSIGHT ENGINE
 *
 * Turns the user's *current* state into a small set of prioritized, human
 * coaching messages. Adaptive (reacts to consumption, hydration, workouts,
 * streak) and time-aware (paces expectations against the waking day), so the
 * app feels like it understands the user rather than nagging.
 *
 * Pure function: same context → same insights. No storage, no side effects.
 * The context type is defined locally (not imported from AppContext) to keep
 * this engine free of any contexts → services import cycle.
 */

import { TodayDiet } from "../../models/diet";
import { NutritionTargets } from "../../models/nutrition";
import { UserBio } from "../../models/user";
import { WorkoutSession } from "../../models/workout";
import { StreakData } from "../StreakService";

export type InsightTone = "positive" | "nudge" | "warning";
export type InsightType =
  | "nutrition"
  | "protein"
  | "hydration"
  | "workout"
  | "streak"
  | "motivation";

export interface CoachInsight {
  id: string;
  type: InsightType;
  tone: InsightTone;
  /** Ionicons name. */
  icon: string;
  title: string;
  message: string;
  /** Higher = more important. Used for ordering / headline selection. */
  priority: number;
}

export interface ConsumedTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterMl: number;
}

export interface CoachContext {
  bio: UserBio | null;
  targets: NutritionTargets | null;
  consumed: ConsumedTotals;
  waterGoalMl: number;
  todayDiet: TodayDiet | null;
  /** Today's scheduled workout session, or null on a rest day / no plan. */
  workoutSession: WorkoutSession | null;
  workoutDoneToday: boolean;
  streak: StreakData;
  /** Injectable for testing; defaults to now. */
  now?: Date;
}

// Waking window used to pace expectations (07:00 → 21:00).
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Fraction of the eating/drinking day elapsed by `hour`. */
function dayProgress(hour: number): number {
  return clamp01((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR));
}

/**
 * Generate prioritized coaching insights from the current state.
 * Always returns at least one (a positive/motivational fallback).
 */
export function generateCoachInsights(ctx: CoachContext): CoachInsight[] {
  const now = ctx.now ?? new Date();
  const hour = now.getHours();
  const progress = dayProgress(hour);
  const insights: CoachInsight[] = [];

  const hasPlan = !!ctx.todayDiet?.hasScheduledDiet;
  const targets = ctx.targets;

  // ── Nutrition pacing ────────────────────────────────────────
  if (!hasPlan && hour >= 8) {
    insights.push({
      id: "no-diet",
      type: "nutrition",
      tone: "nudge",
      icon: "restaurant-outline",
      title: "No meal plan for today",
      message:
        "Set up today's meals so I can track your targets and keep you on pace.",
      priority: 8,
    });
  } else if (hasPlan && targets && targets.calories > 0) {
    const calPct = ctx.consumed.calories / targets.calories;

    if (hour >= 11 && calPct < 0.12) {
      insights.push({
        id: "behind-cal-morning",
        type: "nutrition",
        tone: "nudge",
        icon: "cafe-outline",
        title: "Nothing logged yet",
        message:
          "Tap a meal as eaten when you have it — it keeps your day accurate.",
        priority: 7,
      });
    } else if (calPct > 1.08) {
      insights.push({
        id: "over-cal",
        type: "nutrition",
        tone: "warning",
        icon: "flame",
        title: "Over your calorie target",
        message: `You're ${Math.round((calPct - 1) * 100)}% past your ${Math.round(
          targets.calories,
        )} kcal goal. Lighter choices tomorrow will balance it out.`,
        priority: 6,
      });
    } else if (hour >= 19 && calPct < 0.6) {
      insights.push({
        id: "behind-cal-evening",
        type: "nutrition",
        tone: "nudge",
        icon: "flame-outline",
        title: "Behind on calories",
        message:
          "A balanced dinner will get you closer to your goal without overdoing it.",
        priority: 6,
      });
    } else if (calPct >= progress - 0.2 && calPct <= 1.05 && calPct > 0.1) {
      insights.push({
        id: "on-track-cal",
        type: "nutrition",
        tone: "positive",
        icon: "checkmark-circle",
        title: "On track with calories",
        message: `${Math.round(ctx.consumed.calories)} of ${Math.round(
          targets.calories,
        )} kcal — nicely paced for the time of day.`,
        priority: 4,
      });
    }

    // ── Protein (judged relative to overall intake) ───────────
    if (targets.proteinG > 0) {
      const proteinPct = ctx.consumed.proteinG / targets.proteinG;
      if (calPct > 0.5 && proteinPct < calPct - 0.2) {
        insights.push({
          id: "low-protein",
          type: "protein",
          tone: "nudge",
          icon: "leaf-outline",
          title: "Protein is lagging",
          message:
            "You've eaten well but protein is behind — a protein-rich snack would round things out.",
          priority: 5,
        });
      } else if (proteinPct >= 0.9) {
        insights.push({
          id: "good-protein",
          type: "protein",
          tone: "positive",
          icon: "leaf",
          title: "Strong protein today",
          message: "Great for recovery and staying full. Keep it up.",
          priority: 3,
        });
      }
    }
  }

  // ── Hydration ───────────────────────────────────────────────
  if (ctx.waterGoalMl > 0) {
    const waterPct = ctx.consumed.waterMl / ctx.waterGoalMl;
    if (hour >= 10 && waterPct < progress - 0.25) {
      const remaining = Math.max(
        0,
        ctx.waterGoalMl - ctx.consumed.waterMl,
      );
      insights.push({
        id: "low-water",
        type: "hydration",
        tone: "nudge",
        icon: "water-outline",
        title: "Hydration is behind",
        message: `About ${remaining}ml to go today — small sips add up.`,
        priority: 5,
      });
    } else if (waterPct >= 1) {
      insights.push({
        id: "water-done",
        type: "hydration",
        tone: "positive",
        icon: "water",
        title: "Hydration goal reached",
        message: "Nice — staying hydrated supports energy and recovery.",
        priority: 2,
      });
    }
  }

  // ── Workout ─────────────────────────────────────────────────
  if (ctx.workoutSession && !ctx.workoutDoneToday) {
    const mins = ctx.workoutSession.totalDurationMinutes;
    if (hour >= 18) {
      insights.push({
        id: "workout-late",
        type: "workout",
        tone: "nudge",
        icon: "barbell",
        title: "Today's workout is still waiting",
        message: `${ctx.workoutSession.focus}, ~${mins} min. A short session beats skipping it.`,
        priority: 7,
      });
    } else {
      insights.push({
        id: "workout-today",
        type: "workout",
        tone: "nudge",
        icon: "barbell-outline",
        title: `Today: ${ctx.workoutSession.focus}`,
        message: `Ready when you are — about ${mins} min.`,
        priority: 4,
      });
    }
  } else if (ctx.workoutSession && ctx.workoutDoneToday) {
    insights.push({
      id: "workout-done",
      type: "workout",
      tone: "positive",
      icon: "trophy",
      title: "Workout done",
      message: "That's today's session in the bag. Recover well.",
      priority: 4,
    });
  } else if (!ctx.workoutSession && ctx.bio) {
    insights.push({
      id: "rest-day",
      type: "workout",
      tone: "positive",
      icon: "bed-outline",
      title: "Rest day",
      message: "Recovery fuels progress. A walk or light stretch is plenty.",
      priority: 2,
    });
  }

  // ── Streak ──────────────────────────────────────────────────
  if (ctx.streak.currentStreak >= 3) {
    insights.push({
      id: "streak-strong",
      type: "streak",
      tone: "positive",
      icon: "flame",
      title: `${ctx.streak.currentStreak}-day streak`,
      message: "Consistency is what gets results — keep it alive today.",
      priority: 4,
    });
  } else if (ctx.streak.currentStreak === 0) {
    insights.push({
      id: "streak-start",
      type: "streak",
      tone: "nudge",
      icon: "flag-outline",
      title: "Start a streak today",
      message: "Log a meal or finish a workout to get the momentum going.",
      priority: 3,
    });
  }

  // ── Guaranteed fallback ─────────────────────────────────────
  if (insights.length === 0) {
    insights.push({
      id: "motivation",
      type: "motivation",
      tone: "positive",
      icon: "sparkles",
      title: "You're doing great",
      message: "Small consistent choices beat big occasional ones. Keep going.",
      priority: 1,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

/** The single most relevant insight right now (for a hero / headline slot). */
export function getDailyHeadline(ctx: CoachContext): CoachInsight {
  return generateCoachInsights(ctx)[0];
}
