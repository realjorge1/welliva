/**
 * GOZLIN — Daily AI Briefing (Phase 4).
 *
 * Gozlin's morning sit-down. Composes the Twin + yesterday's record + today's
 * plan + the prioritized CoachInsights into one proactive, structured message:
 *
 *   Greeting · Day N of your Journey
 *   Yesterday Summary · Today's Plan · Workout Focus · Nutrition Focus
 *   Motivation (the "Gozlin Insight") · Risk Alerts · Suggested Adjustments
 *   + the single smallest next win (micro-action)
 *
 * Pure & deterministic (inject `now` for tests). The headline decision tree and
 * micro-action reuse the established Phase-2 logic; the section content reuses
 * the already-prioritized CoachInsights so there is no parallel scoring.
 * See docs/gozlin/04-daily-briefings.md.
 */

import type { DietHistoryEntry } from "../../models/diet";
import type { PrimaryGoal } from "../../models/user";
import type { WorkoutLogEntry } from "../../models/workout";
import type { CoachInsight, InsightTone } from "../intelligence";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import {
  celebrate,
  closer,
  pickVariant,
  PHRASES,
  reset,
} from "./GozlinPersona";
import type {
  BriefingLine,
  GozlinBriefing,
  GozlinTone,
  GozlinTwin,
} from "./gozlin.types";

export interface BriefingInput {
  twin: GozlinTwin;
  /** Already-prioritized insights (AppContext exposes these). */
  insights: CoachInsight[];
  /** Diet history — for the Yesterday Summary. */
  dietHistory: DietHistoryEntry[];
  /** Workout log — for the Yesterday Summary. */
  workoutLog: WorkoutLogEntry[];
  /** The user's stated motivation, if remembered. */
  motivation?: string;
  /** Journey start (YYYY-MM-DD) — drives the "Day N" header. */
  journeyStartedAt?: string;
  /** Sessions/week the user aims for — for the missed-training risk alert. */
  weeklyWorkoutTarget?: number;
  now?: Date;
}

const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365]);

const JOURNEY_LABEL: Record<PrimaryGoal, string> = {
  lose_weight: "Fat Loss Journey",
  build_muscle: "Muscle-Building Journey",
  improve_fitness: "Fitness Journey",
  increase_energy: "Energy Journey",
  better_health: "Health Journey",
  athletic_performance: "Performance Journey",
};

const sign = (n: number) => (n > 0.05 ? 1 : n < -0.05 ? -1 : 0);
const GOAL_INTENT_DIR: Record<PrimaryGoal, number> = {
  lose_weight: -1,
  build_muscle: +1,
  increase_energy: +1,
  athletic_performance: +1,
  improve_fitness: 0,
  better_health: 0,
};

function toneFromInsight(t: InsightTone): GozlinTone {
  if (t === "positive") return "steady";
  if (t === "warning") return "honest";
  return "curious";
}

function dayPartGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  if (h < 21) return "Good evening.";
  return "Winding down.";
}

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
}

function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from).getTime();
  const b = parseLocalDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** The single smallest next win, derived from the dominant signal. */
function microAction(twin: GozlinTwin): string {
  const f = new Set(twin.flags);
  if (f.has("SETBACK") || f.has("STREAK_BROKEN"))
    return "A 10-minute walk. That's the whole ask today.";
  if (f.has("NO_PLAN")) return "Set today's meal plan — it's one tap.";
  if (f.has("LOW_WATER")) return "A glass of water now, one with your next meal.";
  if (f.has("PROTEIN_LAG")) return "Add a protein-rich snack to your next meal.";
  if (f.has("WORKOUT_PENDING"))
    return `Start today's ${twin.today.workout.planned ?? "session"} when you're ready — about ${twin.today.workout.minutes} min.`;
  if (f.has("OVER_CALORIES"))
    return "Go a little lighter the rest of today — it balances out.";
  if (f.has("BEHIND_CALORIES"))
    return "A balanced dinner puts you right back on pace.";
  if (f.has("REST_DAY")) return "Rest well — a short walk or stretch is plenty.";
  if (f.has("STREAK_STRONG") || f.has("ON_TRACK"))
    return "Keep the chain alive — same good choices as yesterday.";
  return "Pick one small win today and log it.";
}

// ── Section builders ────────────────────────────────────────────────

function buildYesterday(input: BriefingInput, today: string): BriefingLine[] {
  const yDate = addDays(today, -1);
  const lines: BriefingLine[] = [];

  const didWorkout = input.workoutLog.some((l) => l.date === yDate);
  if (didWorkout) {
    lines.push({ icon: "checkmark-done-outline", text: "Workout completed", tone: "proud" });
  }

  const yDiet = input.dietHistory.find((h) => h.date === yDate);
  if (yDiet) {
    const onPlan = yDiet.totalMeals > 0 && yDiet.mealsConsumed >= yDiet.totalMeals;
    if (onPlan) {
      lines.push({ icon: "restaurant-outline", text: "Every meal on plan", tone: "proud" });
    } else if (yDiet.mealsConsumed > 0) {
      lines.push({
        icon: "restaurant-outline",
        text: `${yDiet.mealsConsumed}/${yDiet.totalMeals} meals logged`,
        tone: "steady",
      });
    } else {
      lines.push({ icon: "ellipse-outline", text: "Logging ran light", tone: "honest" });
    }

    // Protein goal — uses today's target as the standing daily goal.
    const proTarget = input.twin.today.protein.target;
    if (yDiet.consumedProteinG != null && proTarget > 0 && yDiet.consumedProteinG >= proTarget * 0.9) {
      lines.push({ icon: "leaf-outline", text: "Protein goal achieved", tone: "proud" });
    }
  }

  if (lines.length === 0) {
    lines.push({ icon: "sunny-outline", text: "Fresh page today — let's make it count.", tone: "warm" });
  }
  return lines;
}

function buildTodayFocus(twin: GozlinTwin): string {
  const f = new Set(twin.flags);
  const w = twin.today.workout;
  if (f.has("NO_PLAN")) return "Set your plan + Hydration";
  if (w.done) return "Recovery + Nutrition";
  if (w.planned) {
    const second = twin.recovery.level === "green" ? "Fuel" : "Recovery";
    return `${w.planned} + ${second}`;
  }
  return "Recovery + Mobility";
}

function buildWorkoutFocus(twin: GozlinTwin): BriefingLine {
  const w = twin.today.workout;
  const rec = twin.recovery;
  if (w.done)
    return { icon: "checkmark-done-outline", text: "Session done — recovery is where it sticks.", tone: "proud" };
  if (w.planned)
    return {
      icon: "barbell-outline",
      text: `${w.planned} · ~${w.minutes} min. Recovery ${rec.level}.`,
      tone: rec.level === "red" ? "gentle" : "warm",
    };
  return { icon: "walk-outline", text: `Rest day — ${rec.recommendation}`, tone: "steady" };
}

function buildNutritionFocus(twin: GozlinTwin): BriefingLine {
  const f = new Set(twin.flags);
  if (f.has("NO_PLAN"))
    return { icon: "restaurant-outline", text: "No meal plan set yet — one tap on the Diet tab.", tone: "curious" };

  const cal = Math.round(twin.today.calories.target);
  const pro = Math.round(twin.today.protein.target);
  const base = cal > 0 ? `Aim ${cal} kcal, ${pro}g protein.` : "Today's nutrition targets are set.";

  if (f.has("OVER_CALORIES"))
    return { icon: "trending-up-outline", text: `${base} You're already over — go lighter tonight.`, tone: "honest" };
  if (f.has("PROTEIN_LAG"))
    return { icon: "egg-outline", text: `${base} Protein's the gap — lead with it.`, tone: "curious" };
  if (f.has("BEHIND_CALORIES"))
    return { icon: "restaurant-outline", text: `${base} You're behind — a solid dinner squares it.`, tone: "curious" };
  return { icon: "nutrition-outline", text: base, tone: "steady" };
}

function buildMotivation(twin: GozlinTwin, motivation: string | undefined, seed: string): string {
  const f = new Set(twin.flags);
  let line = `Your consistency is ${twin.momentum.adherence7d}%.`;

  if (f.has("SETBACK") || f.has("STREAK_BROKEN")) {
    line += ` ${reset(seed)} Today's the reset.`;
  } else if (twin.momentum.streak >= 3) {
    line += ` ${twin.momentum.streak} days strong — you're building real momentum.`;
  } else if (twin.momentum.trend === "rising") {
    line += " Trend's pointing up — keep stacking.";
  } else {
    line += " Small consistent choices are doing the work.";
  }

  if (motivation) line += ` Still aiming at ${motivation}.`;
  return line;
}

function buildRiskAlerts(twin: GozlinTwin, weeklyWorkoutTarget: number, goal: PrimaryGoal | null): BriefingLine[] {
  const f = new Set(twin.flags);
  const out: BriefingLine[] = [];

  if (twin.recovery.level === "red")
    out.push({ icon: "alert-circle-outline", text: "Recovery's in the red — train light or rest today.", tone: "alert" });

  if (f.has("OVER_CALORIES"))
    out.push({ icon: "trending-up-outline", text: "Calories are running over plan today.", tone: "honest" });

  // Scale drifting the wrong way (measured against the goal direction).
  const body = twin.body;
  const goalDir =
    body.goalWeightKg != null && body.currentWeightKg != null
      ? sign(body.goalWeightKg - body.currentWeightKg)
      : goal
        ? GOAL_INTENT_DIR[goal]
        : 0;
  if (
    body.measuredRatePerWeek != null &&
    Math.abs(body.measuredRatePerWeek) >= 0.08 &&
    goalDir !== 0 &&
    sign(body.measuredRatePerWeek) !== goalDir
  ) {
    out.push({ icon: "swap-vertical-outline", text: "The scale's been drifting the wrong way.", tone: "honest" });
  }

  if (twin.momentum.trend === "cooling" && twin.momentum.adherence7d < 55)
    out.push({ icon: "trending-down-outline", text: "Consistency cooled — let's steady it this week.", tone: "honest" });

  if (f.has("LOW_WATER"))
    out.push({ icon: "water-outline", text: "Hydration's been light lately.", tone: "honest" });

  // Behind on the week's training (only flag late enough in the week to matter).
  return out.slice(0, 3);
}

function buildAdjustments(input: BriefingInput): BriefingLine[] {
  const twin = input.twin;
  const f = new Set(twin.flags);
  const out: BriefingLine[] = [];

  if (f.has("PROTEIN_LAG"))
    out.push({ icon: "egg-outline", text: "Add a protein-forward snack to your next meal.", tone: "curious" });
  if (f.has("LOW_WATER"))
    out.push({ icon: "water-outline", text: "Tie water to a daily anchor — a glass with each meal.", tone: "curious" });
  if (f.has("WORKOUT_PENDING"))
    out.push({ icon: "barbell-outline", text: `Lock in today's ${twin.today.workout.planned ?? "session"} — schedule it like an appointment.`, tone: "warm" });

  // Fall back to the prioritized CoachInsights (their whole job is "what to tweak").
  if (out.length < 2) {
    for (const ins of input.insights) {
      if (out.length >= 2) break;
      if (out.some((l) => l.text === ins.message)) continue;
      out.push({ icon: ins.icon, text: ins.message, tone: toneFromInsight(ins.tone) });
    }
  }
  return out.slice(0, 2);
}

// ════════════════════════════════════════════════════════════════════

export function buildBriefing(input: BriefingInput): GozlinBriefing {
  const { twin } = input;
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);
  const seed = today;
  const greeting = dayPartGreeting(now);
  const goal = twin.goal;
  const flags = new Set(twin.flags);

  // ── Journey header ──
  const journeyLabel = goal ? JOURNEY_LABEL[goal] : "Wellness Journey";
  const startDate =
    input.journeyStartedAt ??
    (input.dietHistory.length
      ? [...input.dietHistory].map((h) => h.date).sort()[0]
      : undefined);
  const dayCount = startDate ? daysBetween(startDate, today) + 1 : null;

  // ── Headline (Phase-2 decision tree, preserved) ──
  let headline: string;
  let headlineKind: GozlinBriefing["headlineKind"];
  let tone: GozlinTone;

  if (!twin.hasProfile) {
    headline = "Let's get you set up so I can actually coach you.";
    headlineKind = "motivation";
    tone = "warm";
  } else if (flags.has("SETBACK")) {
    headline = `${reset(seed)} One small win today resets everything.`;
    headlineKind = "recovery";
    tone = "gentle";
  } else if (flags.has("STREAK_STRONG") && STREAK_MILESTONES.has(twin.momentum.streak)) {
    headline = `That's ${twin.momentum.streak} days straight. ${celebrate(seed)}`;
    headlineKind = "celebration";
    tone = "proud";
  } else if (flags.has("OVER_CALORIES")) {
    headline = "You're over on calories today — no drama, we balance it.";
    headlineKind = "nudge";
    tone = "honest";
  } else if (flags.has("NO_PLAN")) {
    headline = "No meal plan yet today — let's fix that first.";
    headlineKind = "nudge";
    tone = "curious";
  } else if (flags.has("WORKOUT_PENDING")) {
    headline = `Today's ${twin.today.workout.planned} session is waiting for you.`;
    headlineKind = "nudge";
    tone = "warm";
  } else if (flags.has("ON_TRACK") || flags.has("WORKOUT_DONE")) {
    headline = pickVariant(PHRASES.onTrack, seed);
    headlineKind = "on-track";
    tone = "steady";
  } else {
    headline = input.motivation
      ? `Still aiming at ${input.motivation} — today's a small step toward it.`
      : "Small consistent choices beat big occasional ones.";
    headlineKind = "motivation";
    tone = "warm";
  }
  // A non–dead-end thread, except on celebration where the win is the point.
  if (headlineKind !== "celebration") headline += ` ${closer(seed)}`;

  return {
    __kind: "briefing",
    greeting,
    dayCount,
    journeyLabel,
    headline,
    headlineKind,
    yesterday: buildYesterday(input, today),
    todayFocus: buildTodayFocus(twin),
    workoutFocus: buildWorkoutFocus(twin),
    nutritionFocus: buildNutritionFocus(twin),
    motivation: buildMotivation(twin, input.motivation, seed),
    riskAlerts: buildRiskAlerts(twin, input.weeklyWorkoutTarget ?? 3, goal),
    adjustments: buildAdjustments(input),
    microAction: microAction(twin),
    tone,
  };
}
