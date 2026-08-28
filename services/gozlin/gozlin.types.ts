/**
 * GOZLIN — shared types for the AI health-coach intelligence layer.
 *
 * Gozlin is the persona + orchestration layer on top of Welliva's existing
 * deterministic intelligence (services/intelligence/*). These types describe the
 * normalized read-model (the "Twin"), the structured outputs each feature emits,
 * the chat/session shapes, and the on-device memory model.
 *
 * Types are defined locally (not imported from contexts/AppContext) so this
 * package never creates a contexts → services import cycle — the same discipline
 * CoachInsightEngine uses.
 *
 * See docs/gozlin/02-intelligence-architecture.md for the full design.
 */

import type { Receipt } from "./agent/receipts";
import type { DietHistoryEntry, TodayDiet } from "../../models/diet";
import type { NutritionTargets } from "../../models/nutrition";
import type { SessionSummaryData } from "../../models/session";
import type { PrimaryGoal, UserBio, UserGoals } from "../../models/user";
import type {
  BodyLogEntry,
  GeneratedWorkoutPlan,
  WorkoutLogEntry,
  WorkoutSession,
} from "../../models/workout";
import type { StreakData } from "../StreakService";
// Type-only import from the substrate (erased at runtime — no cycle).
import type { WearableSnapshot } from "@/health-os";

// ════════════════════════════════════════════════════════════════
// Voice / tone
// ════════════════════════════════════════════════════════════════

/** Tonal register Gozlin speaks in — picked per-moment (Phase 1 §3). */
export type GozlinTone =
  | "warm" // default, understated warmth
  | "proud" // celebrating a real win
  | "steady" // on-track, nothing to fix
  | "curious" // a gentle, non-judgmental check-in
  | "honest" // the true thing, kindly (plateau, pattern)
  | "gentle" // setback / recovery, compassion-first
  | "alert"; // safety / refer-out, serious + hands-off

// ════════════════════════════════════════════════════════════════
// The AI Health Twin (central read-model)
// ════════════════════════════════════════════════════════════════

/** Normalized, de-cycled consumed totals (mirrors AppContext.ConsumedNutrition). */
export interface GozlinConsumed {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterMl: number;
}

/** Everything the Twin needs — supplied by the AppContext bridge (useGozlin). */
export interface GozlinSnapshotInput {
  bio: UserBio | null;
  targets: NutritionTargets | null;
  consumed: GozlinConsumed;
  waterGoalMl: number;
  todayDiet: TodayDiet | null;
  /** Today's scheduled session, or null on a rest day / no plan. */
  workoutSession: WorkoutSession | null;
  workoutDoneToday: boolean;
  workoutPlan: GeneratedWorkoutPlan | null;
  workoutLog: WorkoutLogEntry[];
  /**
   * Per-exercise session results (reps per set, skips) — the empirical ground
   * truth behind Adaptive Workout Intelligence (Phase 5). Empty until the
   * guided session starts persisting summaries.
   */
  sessionHistory: SessionSummaryData[];
  dietHistory: DietHistoryEntry[];
  /** Weigh-ins / tape measurements — the empirical ground truth for the forecast. */
  bodyLogs: BodyLogEntry[];
  streak: StreakData;
  goals: UserGoals;
  /**
   * Real wearable metrics (sleep / HRV / resting HR), when connected — folded into
   * Recovery so the readiness signal is true, not just a training-load proxy (P4).
   */
  wearable?: WearableSnapshot | null;
  /** Injectable for tests/determinism; defaults to now. */
  now?: Date;
}

/** Normalized signals every downstream feature can branch on. */
export type GozlinFlag =
  | "ON_TRACK"
  | "OVER_CALORIES"
  | "BEHIND_CALORIES"
  | "PROTEIN_LAG"
  | "PROTEIN_STRONG"
  | "LOW_WATER"
  | "WATER_DONE"
  | "WORKOUT_PENDING"
  | "WORKOUT_DONE"
  | "REST_DAY"
  | "NO_PLAN"
  | "STREAK_STRONG"
  | "STREAK_BROKEN"
  | "SETBACK";

export interface GozlinMetric {
  consumed: number;
  target: number;
  /** consumed / target, clamped 0–2. */
  pct: number;
}

export type MomentumTrend = "rising" | "steady" | "cooling";

export interface GozlinTwin {
  hasProfile: boolean;
  goal: PrimaryGoal | null;
  /** Human one-liner, e.g. "losing fat, training 4×/week". */
  identitySummary: string;
  today: {
    calories: GozlinMetric;
    protein: GozlinMetric;
    water: GozlinMetric;
    workout: { planned: string | null; done: boolean; minutes: number };
    /** 0–1 of the waking day (07:00–21:00) elapsed. */
    dayProgress: number;
  };
  momentum: {
    streak: number;
    /** 0–100 consistency (NutritionInsightEngine). */
    adherence7d: number;
    /** Sessions logged in the last 7 days. */
    trainingLoad7d: number;
    trend: MomentumTrend;
  };
  /** Body trajectory — the empirical signal behind the Transformation Forecast. */
  body: GozlinBodyState;
  recovery: RecoveryState;
  flags: GozlinFlag[];
  asOf: string;
}

/** Weight trajectory snapshot, normalized from body logs + the goal weight. */
export interface GozlinBodyState {
  /** Latest weigh-in (kg), or the onboarding weight if never logged. */
  currentWeightKg: number | null;
  /** Journey starting weight (kg) — earliest weigh-in, else onboarding weight. */
  startWeightKg: number | null;
  /** Goal weight (kg) from UserGoals, or null. */
  goalWeightKg: number | null;
  /** Least-squares kg/week from weigh-ins (signed), or null with <2 logs. */
  measuredRatePerWeek: number | null;
  /** Goodness-of-fit (R²) of the measured trend, 0–1. */
  trendFit: number;
  /** How many weigh-ins exist in the trend window. */
  weighIns: number;
  /** Last weigh-in date (YYYY-MM-DD), or null. */
  lastWeighInDate: string | null;
  /** 0–1 of the start→goal distance covered (clamped), or null with no goal. */
  goalProgress: number | null;
}

// ════════════════════════════════════════════════════════════════
// Recovery Intelligence
// ════════════════════════════════════════════════════════════════

export type RecoveryLevel = "green" | "amber" | "red";

export interface RecoveryState {
  /** 0–100. */
  score: number;
  level: RecoveryLevel;
  drivers: string[];
  recommendation: string;
  /** Honest about inputs — currently a training-load proxy (no wearables yet). */
  basis: string;
}

// ════════════════════════════════════════════════════════════════
// Structured outputs (rendered as cards, like features/ renderers)
// ════════════════════════════════════════════════════════════════

export type GozlinStructuredKind =
  | "briefing"
  | "forecast"
  | "progress"
  | "detective"
  | "weekly-review"
  | "recovery"
  | "workout-adaptation"
  | "nutrition-adaptation"
  | "habit";

interface StructuredBase {
  __kind: GozlinStructuredKind;
}

/** A single line in a briefing section — an icon, text, and optional tone tint. */
export interface BriefingLine {
  /** Ionicons name. */
  icon: string;
  text: string;
  tone?: GozlinTone;
}

/**
 * The Daily AI Briefing (Phase 4) — Gozlin's morning sit-down. Composes the
 * Twin + yesterday's record + today's plan + the forecast's lever into one
 * proactive, structured message. Every section is optional-by-content: empty
 * sections simply don't render.
 */
export interface GozlinBriefing extends StructuredBase {
  __kind: "briefing";
  /** "Good morning." — day-part aware. */
  greeting: string;
  /** Day N of the journey (null for brand-new users with no start date). */
  dayCount: number | null;
  /** "Fat Loss Journey", "Muscle-Building Journey", … */
  journeyLabel: string;
  /** The one-line emotional hook beneath the greeting. */
  headline: string;
  headlineKind:
    | "safety"
    | "recovery"
    | "celebration"
    | "nudge"
    | "on-track"
    | "motivation";

  // ── Sections (Phase 4) ──
  /** Yesterday Summary — what actually happened. */
  yesterday: BriefingLine[];
  /** Today's Plan — the one-line theme, e.g. "Strength + Recovery". */
  todayFocus: string;
  /** Workout Focus — today's session or rest guidance. */
  workoutFocus: BriefingLine;
  /** Nutrition Focus — today's intake target + the key nudge. */
  nutritionFocus: BriefingLine;
  /** Motivation — the Gozlin Insight line (consistency, momentum, their "why"). */
  motivation: string;
  /** Risk Alerts — things trending the wrong way, surfaced kindly. */
  riskAlerts: BriefingLine[];
  /** Suggested Adjustments — small, concrete tweaks for today. */
  adjustments: BriefingLine[];

  /** The single smallest next win. */
  microAction: string;
  tone: GozlinTone;
}

export type ForecastConfidence = "low" | "medium" | "high";

/** Where the projection's number actually comes from — kept honest in the UI. */
export type ForecastBasis =
  | "measured" // regression over real weigh-ins (trusted most)
  | "energy_balance" // intake-vs-maintenance math (no/too-few weigh-ins)
  | "blended" // weigh-ins + intake agree, reinforced
  | "insufficient"; // not enough of anything yet

export type VelocityTrend =
  | "accelerating" // moving toward goal, getting faster
  | "steady" // moving toward goal, holding pace
  | "slowing" // moving toward goal, decelerating (plateau risk)
  | "flat" // essentially no change
  | "reversing"; // moving away from goal

/** Progress Velocity — the rate of change plus its shape over time. */
export interface GozlinVelocity {
  /** Signed kg/week (negative = losing). Null when indeterminate. */
  perWeek: number | null;
  trend: VelocityTrend;
  /** Human label, e.g. "0.4 kg/week down". */
  label: string;
}

/** Likelihood-of-Success band — a felt verdict, not just a number. */
export type SuccessBand =
  | "on_track"
  | "achievable"
  | "at_risk"
  | "off_track"
  | "unknown";

/** A single recommended adjustment, ordered by estimated leverage. */
export interface GozlinAdjustment {
  /** Ionicons name. */
  icon: string;
  text: string;
  /** Estimated impact on the likelihood score (0–1) — for ordering, not display. */
  impact: number;
}

export interface GozlinForecast extends StructuredBase {
  __kind: "forecast";
  /** Current Projection — the headline sentence, plain language. */
  summary: string;

  // ── Progress Velocity ──
  velocity: GozlinVelocity;
  /** Back-compat mirror of velocity.perWeek (kg/week, signed, or null). */
  projectedRatePerWeek: number | null;
  unitLabel: string;

  // ── Current status ──
  currentWeightKg: number | null;
  startWeightKg: number | null;
  goalWeightKg: number | null;
  /** 0–1 of the start→goal distance covered (clamped), or null with no goal. */
  goalProgress: number | null;

  // ── Expected Goal Date ──
  /** Weeks to the stated goal at the current velocity, or null when indeterminate. */
  etaWeeks: number | null;
  /** Resolved calendar date (YYYY-MM-DD) of the projected goal, or null. */
  expectedGoalDate: string | null;

  // ── Likelihood of Success ──
  /** 0–100 composite of adherence, training, momentum, direction & coverage. */
  successScore: number;
  successBand: SuccessBand;

  // ── Confidence + evidence ──
  confidence: ForecastConfidence;
  basis: ForecastBasis;
  /** "What's driving this" — the evidence behind the numbers. */
  drivers: string[];

  // ── Recommended Adjustments ──
  /** The single highest-leverage change (mirrors adjustments[0]). */
  oneLever: string;
  adjustments: GozlinAdjustment[];

  /** True when the read is limited by how consistently things are logged. */
  adherenceLimited: boolean;
}

export type FindingKind =
  | "hidden_win"
  | "correlation"
  | "stall"
  // Progress Detective (Phase 8) — richer, root-cause-aware reads.
  | "root_cause" // the explained "why", e.g. recomposition behind a flat scale
  | "plateau" // a genuine stall with the goal not yet reached
  | "accelerator" // what's measurably driving progress forward
  | "blocker" // what's measurably holding progress back
  | "inconsistency"; // effort that swings too much day-to-day

export interface ProgressFinding {
  kind: FindingKind;
  /** Ionicons name. */
  icon: string;
  title: string;
  detail: string;
  /** The numbers behind it — keeps every finding explainable. */
  evidence: string[];
  /** Optional next lever. */
  lever?: string;
}

export interface GozlinProgressReport extends StructuredBase {
  __kind: "progress";
  findings: ProgressFinding[];
}

// ════════════════════════════════════════════════════════════════
// Progress Detective (Phase 8) — Data-Scientist root-cause analysis
// ════════════════════════════════════════════════════════════════

/** A single headline number in the detective's evidence strip. */
export interface DetectiveMetric {
  /** Ionicons name. */
  icon: string;
  label: string;
  /** Formatted value, e.g. "72/100", "+0.1 kg", "−1.2 kg". */
  value: string;
  /** Optional signed change, e.g. "+14%". */
  delta?: string;
  /** Felt direction for tinting — good/bad/neutral relative to the goal. */
  direction: "good" | "bad" | "neutral";
}

/**
 * The Progress Detective's report (Phase 8). Goes beyond surface findings to a
 * single, explained root cause — the "why" behind what the numbers are doing —
 * backed by an auditable metric strip and ranked supporting findings
 * (plateaus, inconsistencies, accelerators, blockers).
 */
export interface GozlinDetectiveReport extends StructuredBase {
  __kind: "detective";
  /** The one-line case the detective is making. */
  headline: string;
  /** The explained root cause, when one is found (the marquee insight). */
  rootCause: ProgressFinding | null;
  /** Auditable numbers behind the read. */
  metrics: DetectiveMetric[];
  /** Supporting findings, ranked (root cause excluded — it leads). */
  findings: ProgressFinding[];
  /** True when there isn't enough logged data to investigate confidently. */
  dataLimited: boolean;
}

export interface WeeklyReviewLine {
  icon: string;
  text: string;
}

export interface GozlinWeeklyReview extends StructuredBase {
  __kind: "weekly-review";
  weekStart: string;
  title: string;
  /** 0–100. */
  adherence: number;
  wins: WeeklyReviewLine[];
  watchouts: WeeklyReviewLine[];
  trajectoryLine: string;
  /** Exactly one focus for next week (never a list). */
  oneFocusNextWeek: string;
}

export interface GozlinRecoveryCard extends StructuredBase {
  __kind: "recovery";
  state: RecoveryState;
}

export type GozlinStructured =
  | GozlinBriefing
  | GozlinForecast
  | GozlinProgressReport
  | GozlinDetectiveReport
  | GozlinWeeklyReview
  | GozlinRecoveryCard
  | GozlinWorkoutAdaptation
  | GozlinNutritionAdaptation
  | GozlinHabitReport;

// ════════════════════════════════════════════════════════════════
// Adaptive Workout Intelligence (Phase 5)
// ════════════════════════════════════════════════════════════════

/** The shape of an exercise's recent performance trajectory. */
export type PerformanceDirection =
  | "improving" // beating prescription, getting easier
  | "steady" // hitting prescription reliably
  | "declining" // slipping below prescription
  | "avoided" // repeatedly skipped
  | "new"; // too few sessions to judge

/** A measured performance read for one exercise across recent sessions. */
export interface ExercisePerformanceTrend {
  exerciseId: string;
  exerciseName: string;
  /** Sessions in the window that programmed this exercise. */
  sessions: number;
  /** Mean reps actually completed per worked set (reps-based only; 0 for timed). */
  avgRepsPerSet: number;
  /** Prescribed reps (lower bound of the target range). */
  targetReps: number;
  /** 0–1 — sets completed ÷ sets prescribed across the window. */
  completionRate: number;
  /** 0–1 — fraction of programmed sessions where it was skipped entirely. */
  skipRate: number;
  /**
   * Signed headroom: (avgReps − targetReps) ÷ targetReps, clamped. Positive =
   * beating the prescription (room to progress); negative = falling short.
   */
  headroom: number;
  direction: PerformanceDirection;
  /** reps-based (true) vs timed (false). */
  repsBased: boolean;
}

export type WorkoutAdaptationKind =
  | "increase_volume"
  | "decrease_volume"
  | "increase_intensity"
  | "decrease_intensity"
  | "modify_rest"
  | "replace_exercise"
  | "recommend_recovery";

/** The concrete, machine-applicable mutation an adaptation encodes. */
export interface WorkoutChange {
  /** Multiplier for the rep target (e.g. 1.1 = +10% reps). */
  repFactor?: number;
  /** Delta to set count (e.g. +1, −1). */
  setsDelta?: number;
  /** Delta to rest seconds (e.g. +15, −10). */
  restDeltaSeconds?: number;
  /** Replacement exercise (database id + name) for replace_exercise. */
  replacementId?: string;
  replacementName?: string;
  /** Difficulty shift for intensity changes. */
  difficultyShift?: "easier" | "harder";
}

/** One ranked, explained training adjustment from the decision engine. */
export interface WorkoutAdaptation {
  kind: WorkoutAdaptationKind;
  /** Ionicons name. */
  icon: string;
  /** Targeted exercise (null for session-wide changes like recovery). */
  exerciseId: string | null;
  exerciseName: string | null;
  /** The headline change, e.g. "Increase volume by 10%". */
  title: string;
  /** Plain-language coach explanation (the "why"). */
  explanation: string;
  /** The numbers behind it — every decision stays auditable. */
  evidence: string[];
  /** Concrete parameters the apply-step consumes. */
  change: WorkoutChange;
  /** 0–1 leverage, drives ordering. */
  priority: number;
  tone: GozlinTone;
}

export interface GozlinWorkoutAdaptation extends StructuredBase {
  __kind: "workout-adaptation";
  /** One-line read on the training block. */
  summary: string;
  /** Per-exercise trends that drove the decisions (transparency). */
  trends: ExercisePerformanceTrend[];
  adaptations: WorkoutAdaptation[];
  /** True when there isn't enough logged training to adapt confidently. */
  dataLimited: boolean;
}

// ════════════════════════════════════════════════════════════════
// Adaptive Nutrition Intelligence (Phase 6)
// ════════════════════════════════════════════════════════════════

export type NutritionAdaptationKind =
  | "calorie_alert"
  | "protein_alert"
  | "macro_optimization"
  | "meal_swap"
  | "food_preference"
  | "weekly_recommendation";

/** An inferred food the user routinely avoids, with the evidence behind it. */
export interface FoodAvoidance {
  /** Tag/keyword, e.g. "dairy", "fish", "eggs". */
  tag: string;
  /** Human label, e.g. "dairy meals". */
  label: string;
  /** Times a meal matching this tag was skipped in the window. */
  skips: number;
  /** Times a matching meal was served at all. */
  served: number;
  /** 0–1 skip rate among served matches. */
  rate: number;
  /** 0–1 — gates whether Gozlin acts on it. */
  confidence: number;
}

/** One ranked, explained nutrition adjustment from the decision engine. */
export interface NutritionAdaptation {
  kind: NutritionAdaptationKind;
  /** Ionicons name. */
  icon: string;
  title: string;
  explanation: string;
  evidence: string[];
  /** Optional concrete next action. */
  action?: string;
  /**
   * For food_preference: the avoidance tag (e.g. "dairy") the user can apply as
   * a standing preference. Drives the card's Apply action → setFoodPreference.
   */
  tag?: string;
  /** 0–1 leverage, drives ordering. */
  priority: number;
  tone: GozlinTone;
}

export interface GozlinNutritionAdaptation extends StructuredBase {
  __kind: "nutrition-adaptation";
  /** One-line read on the week's eating. */
  summary: string;
  /** Inferred avoidances that will steer future plans. */
  avoidances: FoodAvoidance[];
  adaptations: NutritionAdaptation[];
  /** The single most important focus for next week. */
  weeklyFocus: string;
  dataLimited: boolean;
}

// ════════════════════════════════════════════════════════════════
// Habit Awareness System (Phase 7)
// ════════════════════════════════════════════════════════════════

export type HabitKind =
  | "skip" // a slot consistently missed (e.g. "Wednesday workouts")
  | "consistency" // a reliable, repeated win
  | "timing" // a time-of-day pattern
  | "weekend_dip" // the plan slips on weekends
  | "anchor" // a keystone habit that pulls the rest of the week up
  | "mood_link" // behavior tied to mood / stress (self-reported)
  | "sleep_link" // behavior tied to sleep (self-reported)
  | "bad_habit"; // a recurring choice working against the goal

/** The life domains Gozlin watches — fitness and beyond. */
export type HabitDomain =
  | "workout"
  | "nutrition"
  | "hydration"
  | "consistency"
  | "sleep"
  | "mood";

export interface HabitPattern {
  kind: HabitKind;
  /** The life domain this pattern lives in. */
  domain?: HabitDomain;
  /** Human label for the slot/context, e.g. "Monday workout". */
  slot: string;
  /** 0–1 completion rate for this pattern. */
  rate: number;
  /** Days observed. */
  window: number;
  /** 0–1 — gates whether Gozlin says anything. */
  confidence: number;
  /** Ionicons name for the card (optional — the card has a per-kind default). */
  icon?: string;
  message: string;
}

/**
 * A self-reported daily check-in — how the user slept, felt, and their stress.
 * The only source of the "life habits" (sleep / mood) the app can't measure on
 * its own. Stored on-device via the Gozlin memory store; entirely optional, and
 * every habit read degrades gracefully when there are none.
 */
export interface GozlinCheckin {
  date: string; // YYYY-MM-DD (local)
  /** 1 (rough) – 5 (great). */
  mood?: number;
  /** 1 (drained) – 5 (energized). */
  energy?: number;
  /** 1 (calm) – 5 (very stressed). */
  stress?: number;
  /** Hours slept last night. */
  sleepHours?: number;
  note?: string;
  createdAt: number;
}

export type BehaviorTrend = "rising" | "steady" | "cooling";

/** A 0–100 read on one habit domain, with the evidence that set it. */
export interface BehaviorScore {
  domain: HabitDomain;
  /** Ionicons name. */
  icon: string;
  /** Human label, e.g. "Training". */
  label: string;
  /** 0–100. */
  score: number;
  /** Band word, e.g. "Strong", "Building", "Fragile". */
  band: string;
  trend: BehaviorTrend;
  /** The numbers behind it. */
  drivers: string[];
}

/**
 * A predicted at-risk habit — Gozlin getting ahead of a slip before it happens
 * (behavior prediction + accountability). Carries a concrete rescue id linking
 * it to a recovery strategy.
 */
export interface HabitRisk {
  domain: HabitDomain;
  /** Ionicons name. */
  icon: string;
  /** The habit at risk, e.g. "Wednesday workout". */
  slot: string;
  title: string;
  /** 0–1 — how likely the slip is, drives ordering + tone. */
  likelihood: number;
  /** When it's coming, e.g. "in 2 days", "this weekend", "today". */
  whenLabel: string;
  /** Why Gozlin's flagging it — the evidence. */
  why: string[];
  /** Links to a HabitRescue.id, when one is offered. */
  rescueId?: string;
}

/** A concrete recovery strategy for an at-risk or broken habit (habit rescue). */
export interface HabitRescue {
  id: string;
  /** Ionicons name. */
  icon: string;
  title: string;
  /** The habit this rescues, e.g. "Wednesday workout". */
  forSlot: string;
  /** Small, ordered, do-able steps. */
  steps: string[];
  tone: GozlinTone;
}

/**
 * The Habit Awareness report (Phase 7) — Gozlin's read on who the user is
 * behaviorally: an overall behavior score, per-domain scores, the patterns it
 * has learned, the slips it predicts, and the rescues for them. Every part is
 * evidence-backed and gated on confidence, so it feels understood, not guessed.
 */
export interface GozlinHabitReport extends StructuredBase {
  __kind: "habit";
  /** The one-line read that leads the card. */
  headline: string;
  /** 0–100 composite across the scored domains. */
  overallScore: number;
  /** Band word for the composite, e.g. "Strong". */
  scoreLabel: string;
  /** Per-domain behavior scores (only domains with real data). */
  behaviorScores: BehaviorScore[];
  /** Learned patterns, confidence-gated. */
  patterns: HabitPattern[];
  /** Predicted at-risk habits, ranked by likelihood. */
  risks: HabitRisk[];
  /** Recovery strategies for the top risks / broken habits. */
  rescues: HabitRescue[];
  /** True when there isn't enough logged behavior to read habits confidently. */
  dataLimited: boolean;
  tone: GozlinTone;
}

// ════════════════════════════════════════════════════════════════
// Coach Presence — Gozlin everywhere (Phase 9 / CXO)
// ════════════════════════════════════════════════════════════════

/** A place in the app Gozlin can speak from. */
export type GozlinSurface =
  | "home"
  | "workout"
  | "diet"
  | "progress"
  | "reviews"
  | "habits"
  | "goals";

/**
 * The emotional/functional archetype of a presence beat — the six the
 * experience is designed around. Drives the eyebrow, accent, and treatment.
 */
export type GozlinMomentKind =
  | "celebration" // a real win, named and felt
  | "risk" // something trending the wrong way, surfaced kindly
  | "intervention" // a gentle, timely nudge to act
  | "insight" // a pattern worth knowing
  | "forecast" // where this is heading
  | "coach"; // steady, present, "I'm with you"

/**
 * A single contextual coach beat selected for one surface. Pure data — produced
 * by GozlinMomentEngine from the Twin, rendered by the GozlinMoment card. Tapping
 * it deep-links into the full coach with `prompt` pre-asked, so every surface is
 * a doorway into the conversation rather than a dead end.
 */
export interface GozlinMoment {
  /** Stable within a build of the Twin (kind + a discriminator). */
  id: string;
  kind: GozlinMomentKind;
  /** Ionicons name. */
  icon: string;
  /** The one-line headline, in Gozlin's voice. */
  title: string;
  /** The supporting sentence — the "why" or the felt thing. */
  message: string;
  tone: GozlinTone;
  /** 0–100 leverage; the highest-priority moment wins a surface. */
  priority: number;
  /** The question/prompt opened in the coach when the card is tapped. */
  prompt: string;
  /** Call-to-action label on the card (defaults per kind in the renderer). */
  cta?: string;
}

// ════════════════════════════════════════════════════════════════
// Chat / session
// ════════════════════════════════════════════════════════════════

export type GozlinRole = "user" | "coach";

export interface GozlinMessage {
  id: string;
  role: GozlinRole;
  content: string;
  tone?: GozlinTone;
  structured?: GozlinStructured;
  createdAt: number;
  /**
   * Provenance for every figure in `content` — see
   * services/gozlin/agent/receipts.ts.
   *
   * Present only on replies the AGENT LOOP produced. A deterministic
   * fallback composes its own engine copy and a clinical refusal carries no
   * figures at all, so neither has anything to show — and an empty receipt
   * is worse than none, because it invites a tap that answers nothing.
   *
   * Persisted with the conversation, so an old message still opens its
   * receipts long after the tool results that backed it are gone.
   */
  receipts?: Receipt[];
  /**
   * The reader's verdict on a coach reply, from the actions under the bubble.
   *
   * Stored ON the message rather than in a side table, because that is what it
   * is about — it travels with the reply into the archive, survives a reload,
   * and disappears with it when memory is cleared. Nothing is sent anywhere:
   * this is a local signal, and the honest reason to collect it is that a
   * thumbs-down is the cheapest way for someone to say "that was wrong"
   * without having to type it.
   */
  feedback?: "up" | "down";
  /**
   * A cached DEEP DIVE for this reply — the research expansion behind it (see
   * services/gozlin/agent/deepDive.ts).
   *
   * Cached deliberately: dives are metered on the free tier, so re-opening one
   * that has already been written must cost nothing, and reading it again
   * offline must work.
   */
  deepDive?: string;
  /**
   * True when the user rewrote this message and the thread was re-answered
   * from it. Purely presentational — the bubble shows an "edited" mark so a
   * conversation that no longer matches someone's memory of it explains itself.
   */
  edited?: boolean;
}

export interface GozlinSession {
  id: string;
  messages: GozlinMessage[];
  createdAt: number;
  updatedAt: number;
}

/** A tappable prompt chip shown under the composer. */
export interface GozlinSuggestion {
  label: string;
  /** The text submitted when tapped. */
  prompt: string;
  /** Ionicons name. */
  icon: string;
}

// ════════════════════════════════════════════════════════════════
// Memory model (4 tiers — see Phase 1 §8)
// ════════════════════════════════════════════════════════════════

export interface GozlinIdentityMemory {
  /** The user's stated "why". */
  motivation?: string;
  /** Free-form preferences the user told Gozlin. */
  preferences: string[];
  /** Constraints the user mentioned (time, injuries the user states, etc). */
  constraints: string[];
  updatedAt: number;
}

export interface GozlinEpisode {
  id: string;
  date: string; // YYYY-MM-DD
  /** e.g. "celebrated first 7-day streak". */
  summary: string;
  kind: "win" | "setback" | "milestone" | "note";
}

export interface GozlinMemorySnapshot {
  identity: GozlinIdentityMemory;
  episodic: GozlinEpisode[];
  behavioral: HabitPattern[];
}
