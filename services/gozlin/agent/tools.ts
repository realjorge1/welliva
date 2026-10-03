/**
 * GOZLIN AGENT — the tool surface.
 *
 * This is the inversion. Before, `classifyIntent` decided which engine ran and
 * the engine's output WAS the answer — the regex was the ceiling. Here every
 * engine becomes a tool the model can call, and the model decides. The engines
 * are unchanged: still deterministic, still grounded, still the only thing
 * allowed to produce a number.
 *
 * Everything runs ON DEVICE. Three reasons, in order of how much they'd hurt:
 *   1. app/privacy.tsx promises "your raw history never leaves it — only short
 *      summaries do". Engine outputs ARE those summaries. Moving the engines
 *      server-side breaks a shipped promise.
 *   2. The deterministic path has to survive with no network.
 *   3. The engines read ~50 AsyncStorage keys. Shipping that up every turn is
 *      absurd.
 *
 * Descriptions are written PRESCRIPTIVELY — when to call, not just what it does.
 * That wording is load-bearing for should-call rate; don't soften it to prose.
 *
 * Tool results are COMPACT projections, not the full render-models. Two reasons:
 * tokens, and grounding — every number the model is allowed to say has to come
 * from one of these payloads (see ./grounding.ts).
 */

import type { GozlinChatContext } from "../GozlinChatEngine";
import { buildNutritionAdaptations } from "../GozlinAdaptiveNutritionEngine";
import { buildWorkoutAdaptations } from "../GozlinAdaptiveWorkoutEngine";
import { buildBriefing, type BriefingInput } from "../GozlinBriefingEngine";
import { buildDetectiveReport, type DetectiveFocus } from "../GozlinDetectiveEngine";
import { buildForecast } from "../GozlinForecastEngine";
import { buildHabitReport } from "../GozlinHabitEngine";
import { buildWeeklyReview } from "../GozlinProgressEngine";
import { computeRecovery } from "../GozlinRecoveryEngine";
import { loadMemorySnapshot } from "../GozlinMemoryStore";
import { clampMoodDays, MOOD_DAYS_DEFAULT, summarizeMood } from "./moodLog";
import { isVerbatim, resolveNoteSubject } from "./experiences";
import type { ExerciseSubject } from "../novelty/subjects";
import type { Enjoyed, ExperienceSource, Soreness } from "../novelty/types";

// ── Injected side-effects ──────────────────────────────────────────
//
// Write tools never import a context or a store directly — the caller passes
// callbacks in. Keeps this package pure (and keeps the contexts → services
// dependency one-directional, same discipline as CoachInsightEngine).

/** What a write tool is asking permission to do, for the confirmation UI. */
export interface ToolConfirmRequest {
  tool: string;
  /** One-line, user-facing: "Log 1 × Banana (1 medium) as a snack?" */
  summary: string;
  /**
   * What the summary can't hold: the figures the write will record, and any
   * way it differs from what was asked for. Shown above the reassurance line.
   */
  detail?: string;
  input: Record<string, unknown>;
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * A catalog food, resolved AND measured at the amount that will be logged,
 * BEFORE anyone is asked to confirm it — so the sheet names the item and the
 * figures that will actually be written, not the words the model used.
 */
export interface FoodLogPreview {
  /** The host's handle for the catalog row; passed back to `logFood` as-is. */
  id: string;
  /** The catalog's own name. */
  name: string;
  /** Exactly the line the food log will record, e.g. "0.5 medium Avocado". */
  label: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
}

/**
 * Portions move in quarters — "half an avocado" is 0.5, "a quarter" 0.25. The
 * food log takes any amount; the step only stops a model's "0.33" from being
 * written as a figure nobody said.
 */
const PORTION_STEP = 0.25;
const MAX_LOGGED_PORTIONS = 10;

const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/** investigate_progress's enum. An unknown value reads as no focus, not a guess. */
const DETECTIVE_FOCI: readonly DetectiveFocus[] = ["weight", "strength", "energy", "adherence"];

export interface GozlinToolActions {
  /**
   * Find the catalog food `name` refers to and measure `portions` of it, the
   * same way the food log will. Nothing is written.
   */
  resolveFood?: (
    name: string,
    portions: number,
  ) => Promise<{ ok: true; food: FoodLogPreview } | { ok: false; reason: string }>;
  /**
   * Write a previewed food to today's food log under `meal`. Returns what was
   * actually logged so the model can cite real figures.
   */
  logFood?: (
    food: FoodLogPreview,
    meal: MealSlot,
  ) => Promise<
    | { ok: true; label: string; calories: number; proteinG: number }
    | { ok: false; reason: string }
  >;
  /** Persist an identity fact (motivation / preference / constraint). */
  rememberFact?: (
    kind: "motivation" | "preference" | "constraint",
    value: string,
  ) => Promise<void>;
  /**
   * Record what they said about something they tried (note_experience). No
   * confirmation sheet — the caller shows a "Noted · Undo" toast instead; see
   * the tool for why. Absent means the feature is off: the tool fails closed.
   */
  noteExperience?: (note: ExperienceNote) => Promise<{ ok: true; id: string } | { ok: false; reason: string }>;
  /**
   * Confirmation gate for write tools. When absent, every write is DECLINED —
   * fail closed. The model must never mutate user data unprompted.
   */
  confirm?: (request: ToolConfirmRequest) => Promise<boolean>;
}

/** What note_experience hands the caller to store. Already resolved and checked. */
export interface ExperienceNote {
  subject: ExerciseSubject;
  triedOn: string | null;
  /** Their words, verbatim — checked against what they typed. */
  quote: string;
  soreness: Soreness | null;
  enjoyed: Enjoyed | null;
  source: ExperienceSource;
}

export interface GozlinToolContext extends GozlinChatContext {
  actions?: GozlinToolActions;
  /**
   * This turn, as the tools may need it: what the person just typed (the
   * verbatim check reads it) and how many notes have been taken (one a turn).
   * Set by the agent loop; absent in a context built anywhere else.
   */
  turn?: { text: string; notes: number };
}

export interface GozlinTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Runs on-device against the live context. */
  run: (input: any, ctx: GozlinToolContext) => Promise<unknown> | unknown;
  /** Read-only tools are parallel-safe and need no confirmation. */
  readOnly: boolean;
}

// ── Schema helpers ─────────────────────────────────────────────────
//
// Every schema is strict-mode shaped (additionalProperties:false + required),
// so `tool_use.input` is guaranteed to validate against it.

const NO_ARGS = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

function obj(
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

// ── Compact projections ────────────────────────────────────────────
//
// The render-models carry icons, tones and copy the model doesn't need and
// shouldn't parrot. These keep the evidence and drop the presentation.

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

function briefingInput(ctx: GozlinToolContext, now: Date): BriefingInput {
  return {
    twin: ctx.twin,
    insights: ctx.insights,
    dietHistory: ctx.snapshot.dietHistory,
    workoutLog: ctx.snapshot.workoutLog,
    motivation: ctx.identity.motivation,
    journeyStartedAt: ctx.snapshot.goals.journeyStartedAt,
    weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
    now,
  };
}

const nowOf = (ctx: GozlinToolContext) => ctx.now ?? new Date();

/** Strip a finding down to claim + evidence. */
function slimFinding(f: {
  kind: string;
  title: string;
  detail: string;
  evidence: string[];
  lever?: string;
}) {
  return {
    kind: f.kind,
    title: f.title,
    detail: f.detail,
    evidence: f.evidence,
    ...(f.lever ? { lever: f.lever } : {}),
  };
}

/** note_experience's enums → the stored answers. "unsaid" maps to nothing. */
const SORENESS_INPUT: Record<string, Soreness> = { none: 0, mild: 1, moderate: 2, severe: 3 };
const ENJOYED_INPUT: Record<string, Enjoyed> = { yes: "yes", mixed: "mixed", no: "no" };

// ── The surface ────────────────────────────────────────────────────

export const GOZLIN_TOOLS: GozlinTool[] = [
  {
    name: "investigate_progress",
    description:
      "Root-cause analysis of why a metric is or isn't moving. Call this whenever the " +
      "user asks why something is happening, mentions a plateau, says they're stuck, " +
      "says nothing is working, or expresses confusion about their results. Returns " +
      "ranked candidate causes with the evidence behind each. Prefer this over " +
      "get_forecast when the question is 'why', not 'when'.",
    input_schema: obj(
      {
        focus: {
          type: "string",
          enum: ["weight", "strength", "energy", "adherence"],
          description: "Which outcome the user is asking about.",
        },
      },
      ["focus"],
    ),
    readOnly: true,
    run: (input: { focus: string }, ctx) => {
      const focus = DETECTIVE_FOCI.find((f) => f === input.focus);
      const r = buildDetectiveReport({
        twin: ctx.twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        sessionHistory: ctx.snapshot.sessionHistory,
        bodyLogs: ctx.snapshot.bodyLogs,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        // The argument used to be echoed back and otherwise ignored, so a
        // strength question could get a weight plateau as its root cause.
        focus,
        checkins: ctx.snapshot.checkins ?? ctx.checkins ?? null,
        now: nowOf(ctx),
      });
      return {
        focus: focus ?? "overall",
        headline: r.headline,
        rootCause: r.rootCause ? slimFinding(r.rootCause) : null,
        metrics: r.metrics.map((m) => ({
          label: m.label,
          value: m.value,
          delta: m.delta,
          direction: m.direction,
        })),
        supportingFindings: r.findings.slice(0, 4).map(slimFinding),
        dataLimited: r.dataLimited,
      };
    },
  },

  {
    name: "analyze_nutrition",
    description:
      "Analyze the user's recent eating and return ranked, evidence-backed nutrition " +
      "adjustments plus inferred food avoidances. Call this when the user asks about " +
      "their macros, calories, protein, diet quality, or wants their eating tuned, " +
      "optimized, or rebalanced. Do NOT call it to log a food — use log_food.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const a = buildNutritionAdaptations({
        twin: ctx.twin,
        bio: ctx.snapshot.bio,
        targets: ctx.snapshot.targets,
        consumed: {
          calories: ctx.snapshot.consumed.calories,
          proteinG: ctx.snapshot.consumed.proteinG,
          carbsG: ctx.snapshot.consumed.carbsG,
          fatG: ctx.snapshot.consumed.fatG,
        },
        dietHistory: ctx.snapshot.dietHistory,
        weekStart: ctx.weekStart,
        now: nowOf(ctx),
      });
      return {
        summary: a.summary,
        weeklyFocus: a.weeklyFocus,
        adaptations: a.adaptations.slice(0, 4).map((x) => ({
          kind: x.kind,
          title: x.title,
          explanation: x.explanation,
          evidence: x.evidence,
          action: x.action,
        })),
        avoidances: a.avoidances.map((v) => ({
          label: v.label,
          skipRate: round1(v.rate * 100) + "%",
          skips: v.skips,
          served: v.served,
        })),
        dataLimited: a.dataLimited,
      };
    },
  },

  {
    name: "analyze_training",
    description:
      "Analyze recent training performance per exercise and return ranked programming " +
      "adjustments (volume, intensity, rest, substitutions). Call this when the user " +
      "asks whether they're ready to progress, says a workout is too easy or too hard, " +
      "or wants their training tuned, adapted, or made harder/easier.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const a = buildWorkoutAdaptations({
        twin: ctx.twin,
        sessionHistory: ctx.snapshot.sessionHistory,
        workoutLog: ctx.snapshot.workoutLog,
        plan: ctx.snapshot.workoutPlan,
        difficulty: ctx.snapshot.bio?.exerciseLevel ?? "beginner",
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now: nowOf(ctx),
      });
      return {
        summary: a.summary,
        adaptations: a.adaptations.slice(0, 4).map((x) => ({
          kind: x.kind,
          exercise: x.exerciseName,
          title: x.title,
          explanation: x.explanation,
          evidence: x.evidence,
        })),
        trends: a.trends.slice(0, 6).map((t) => ({
          exercise: t.exerciseName,
          sessions: t.sessions,
          direction: t.direction,
          completionRate: round(t.completionRate * 100) + "%",
        })),
        dataLimited: a.dataLimited,
        // Why the plan is what it is — the training engine's own reasons
        // (services/training), so a "why is X in my plan?" is answered from
        // the inputs that built it, never from a guess.
        plan: ctx.snapshot.workoutPlan
          ? {
              howThisWeekWasBuilt: (ctx.snapshot.workoutPlan.reasons ?? []).slice(0, 8),
              week: ctx.snapshot.workoutPlan.sessions.map((s) => ({
                day: s.dayLabel,
                why: s.reason ?? null,
              })),
              today: ctx.snapshot.workoutSession
                ? {
                    session: ctx.snapshot.workoutSession.dayLabel,
                    moves: ctx.snapshot.workoutSession.exercises
                      .filter((e) => (e.block ?? "main") === "main")
                      .map((e) => ({
                        exercise: e.name,
                        dose: `${e.sets}×${e.reps}`,
                        why: e.reason ?? null,
                        doseWhy: e.doseReason ?? null,
                      })),
                  }
                : null,
            }
          : null,
      };
    },
  },

  {
    name: "get_weekly_review",
    description:
      "The structured review of the current week: adherence score, wins, watch-outs, " +
      "trajectory, and the single focus for next week. Call this when the user asks " +
      "how their week went, for a recap, a review, or a summary of the last 7 days.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const r = buildWeeklyReview({
        twin: ctx.twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        weekStart: ctx.weekStart,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now: nowOf(ctx),
      });
      return {
        weekStart: r.weekStart,
        adherence: r.adherence,
        wins: r.wins.map((w) => w.text),
        watchouts: r.watchouts.map((w) => w.text),
        trajectory: r.trajectoryLine,
        oneFocusNextWeek: r.oneFocusNextWeek,
      };
    },
  },

  {
    name: "get_forecast",
    description:
      "Project where the user's body is heading: rate of change, expected goal date, " +
      "likelihood of success, and the highest-leverage change. Call this when the user " +
      "asks when they'll hit a goal, how long something will take, whether they're on " +
      "track, or what they're on course to achieve. Use investigate_progress instead " +
      "when they're asking WHY rather than WHEN.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const f = buildForecast({
        twin: ctx.twin,
        dietHistory: ctx.snapshot.dietHistory,
        bodyLogs: ctx.snapshot.bodyLogs,
        calorieTarget: ctx.snapshot.targets?.calories ?? 0,
        goal: ctx.twin.goal,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now: nowOf(ctx),
      });
      return {
        summary: f.summary,
        ratePerWeekKg: f.projectedRatePerWeek,
        velocityTrend: f.velocity.trend,
        currentWeightKg: f.currentWeightKg,
        goalWeightKg: f.goalWeightKg,
        etaWeeks: f.etaWeeks,
        expectedGoalDate: f.expectedGoalDate,
        successScore: f.successScore,
        successBand: f.successBand,
        confidence: f.confidence,
        basis: f.basis,
        drivers: f.drivers,
        oneLever: f.oneLever,
      };
    },
  },

  {
    name: "get_habit_report",
    description:
      "Read the user's behavioural patterns: per-domain scores, learned habits, " +
      "predicted at-risk habits, and rescue strategies. Call this when the user asks " +
      "what habits or patterns you've noticed about them, about their consistency, or " +
      "about their sleep, mood, or stress.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const h = buildHabitReport({
        twin: ctx.twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        workoutPlan: ctx.snapshot.workoutPlan,
        checkins: ctx.checkins,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now: nowOf(ctx),
      });
      return {
        headline: h.headline,
        overallScore: h.overallScore,
        scoreLabel: h.scoreLabel,
        domains: h.behaviorScores.map((b) => ({
          domain: b.domain,
          score: b.score,
          band: b.band,
          trend: b.trend,
          drivers: b.drivers,
        })),
        patterns: h.patterns.slice(0, 5).map((p) => ({
          kind: p.kind,
          slot: p.slot,
          rate: round(p.rate * 100) + "%",
          message: p.message,
        })),
        risks: h.risks.slice(0, 3).map((r) => ({
          slot: r.slot,
          title: r.title,
          when: r.whenLabel,
          why: r.why,
        })),
        dataLimited: h.dataLimited,
      };
    },
  },

  {
    name: "review_mood_log",
    description:
      "Read the state-of-mind entries the user logged: how pleasant or unpleasant they " +
      "have felt, the feelings they named, what they tied them to (work, sleep, family…), " +
      "and hours slept. Call this when they ask how they have been feeling, mention " +
      "stress, low mood or low energy, or wonder whether something — work, sleep, " +
      "training — affects how they feel. Valence runs from -1 (very unpleasant) to +1 " +
      "(very pleasant). It is self-report, not a clinical measure: never diagnose from it.",
    input_schema: obj(
      {
        days: {
          type: "integer",
          description: `How many days back to read, 7 to 60. Use ${MOOD_DAYS_DEFAULT} when they don't say.`,
        },
      },
      ["days"],
    ),
    readOnly: true,
    run: (input: { days: number }, ctx) =>
      summarizeMood(ctx.checkins ?? [], clampMoodDays(input.days), nowOf(ctx)),
  },

  {
    name: "review_tracked_habits",
    description:
      "Read the user's own HABIT TRACKER: the habits they created themselves, how each " +
      "is going this week, and the habits they used to keep but have since stopped " +
      "tracking. Different from get_habit_report, which infers behaviour from meals and " +
      "workouts — this is what the user explicitly told the app they want to do. Call it " +
      "when they mention a specific routine or ritual of theirs, ask what they should add " +
      "or drop, ask about a streak, wonder whether they used to do something, or when a " +
      "recommendation you are about to make is already one of their habits.",
    input_schema: obj(
      {
        include_stopped: {
          type: "boolean",
          description:
            "Include habits they no longer track. Use when the question is about the " +
            "past, about restarting something, or about why a routine faded.",
        },
      },
      ["include_stopped"],
    ),
    readOnly: true,
    run: (input: { include_stopped: boolean }, ctx) => {
      const brief = ctx.habits;
      // No tracker in this context is "nothing to say", never an invented list.
      if (!brief) return { tracked: [], stopped: [], available: false };
      return {
        available: true,
        tracked: brief.tracked.map((t) => ({
          name: t.name,
          target: t.frequency,
          thisWeek: `${t.weekDone}/${t.weekTarget}`,
          streak: t.streak > 0 ? `${t.streak} ${t.streakUnit}s` : "none",
          last30Pct: t.last30Pct,
          doneToday: t.doneToday,
          recentlyMissed: t.recentMisses,
        })),
        stopped: input.include_stopped
          ? brief.retired.map((r) => ({
              name: r.name,
              record: r.summary,
              daysDone: r.totalDone,
              bestStreak: `${r.bestStreak} ${r.streakUnit}s`,
              stoppedOn: r.retiredOn,
              daysSinceStopped: r.daysSince,
              wasConsistent: r.wasConsistent,
            }))
          : [],
      };
    },
  },

  {
    name: "get_recovery_status",
    description:
      "Current recovery/readiness: a 0–100 score, its level, what drove it, and a " +
      "training recommendation. Call this when the user asks whether they should train " +
      "today, says they're sore, tired, drained, or asks about rest and readiness. " +
      "ALWAYS call this before advising on training intensity.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const r = computeRecovery({
        workoutLog: ctx.snapshot.workoutLog,
        todaySession: ctx.snapshot.workoutSession,
        // The twin's level too, for the same reason as the check-ins below.
        exerciseLevel: ctx.snapshot.bio?.exerciseLevel,
        wearable: ctx.snapshot.wearable ?? null,
        // The snapshot's copy first — it is what the twin's state-block score
        // was computed from, and the tool must never disagree with that line.
        checkins: ctx.snapshot.checkins ?? ctx.checkins ?? null,
        now: nowOf(ctx),
      });
      return {
        score: r.score,
        level: r.level,
        drivers: r.drivers,
        recommendation: r.recommendation,
        basis: r.basis,
      };
    },
  },

  {
    name: "get_daily_briefing",
    description:
      "Today's full coaching brief: yesterday's record, today's focus, workout and " +
      "nutrition targets, risk alerts, and the single smallest next win. Call this " +
      "when the user asks what to do today, what to focus on, for a plan for today, " +
      "or opens with a bare greeting and no specific question.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: (_input, ctx) => {
      const b = buildBriefing(briefingInput(ctx, nowOf(ctx)));
      return {
        headline: b.headline,
        dayCount: b.dayCount,
        journey: b.journeyLabel,
        yesterday: b.yesterday.map((l) => l.text),
        todayFocus: b.todayFocus,
        workoutFocus: b.workoutFocus.text,
        nutritionFocus: b.nutritionFocus.text,
        riskAlerts: b.riskAlerts.map((l) => l.text),
        adjustments: b.adjustments.map((l) => l.text),
        microAction: b.microAction,
      };
    },
  },

  {
    name: "recall_memory",
    description:
      "Retrieve what you already know about this user: their stated reason for being " +
      "here, preferences, constraints, past milestones, and learned behaviours. Call " +
      "this when the user asks what you know or remember about them, references " +
      "something they told you before, or when personalising advice would benefit from " +
      "their history.",
    input_schema: NO_ARGS,
    readOnly: true,
    run: async (_input, ctx) => {
      const snap = await loadMemorySnapshot();
      return {
        motivation: snap.identity.motivation ?? null,
        preferences: snap.identity.preferences,
        constraints: snap.identity.constraints,
        milestones: snap.episodic.slice(-6).map((e) => ({
          date: e.date,
          kind: e.kind,
          summary: e.summary,
        })),
        learnedPatterns: snap.behavioral.slice(0, 5).map((p) => p.message),
        identitySummary: ctx.twin.identitySummary,
      };
    },
  },

  // ── Write tools — gated, never silent ────────────────────────────

  {
    name: "remember_fact",
    description:
      "Save a durable fact about the user: their motivation ('my why'), a preference, " +
      "or a constraint. Call this ONLY when the user states something about themselves " +
      "they'd expect you to remember later — not for passing remarks and not for " +
      "anything you inferred. Requires the user's confirmation before it is saved.",
    input_schema: obj(
      {
        kind: {
          type: "string",
          enum: ["motivation", "preference", "constraint"],
          description:
            "motivation = why they're here; preference = what they like/dislike; " +
            "constraint = a limit on what they can do.",
        },
        value: {
          type: "string",
          description:
            "The fact in the user's own framing, third person, one clause. " +
            "e.g. 'wants to be strong enough to carry their kid upstairs'.",
        },
      },
      ["kind", "value"],
    ),
    readOnly: false,
    run: async (
      input: { kind: "motivation" | "preference" | "constraint"; value: string },
      ctx,
    ) => {
      const value = (input.value ?? "").trim();
      if (!value) return { status: "rejected", reason: "Empty value." };

      const actions = ctx.actions;
      if (!actions?.rememberFact || !actions.confirm) {
        return { status: "unavailable", reason: "Saving is not available right now." };
      }
      const approved = await actions.confirm({
        tool: "remember_fact",
        summary: `Remember that they ${value}?`,
        input: { ...input },
      });
      if (!approved) {
        return {
          status: "declined",
          reason: "The user declined. Do not save it, and do not ask again this turn.",
        };
      }
      await actions.rememberFact(input.kind, value);
      return { status: "saved", kind: input.kind, value };
    },
  },

  {
    name: "log_food",
    description:
      "Log a food the user ate onto today's food log, under the meal it belongs to. Call " +
      "this ONLY when the user clearly states they ate or drank something and wants it " +
      "recorded — never to answer a question about a food, and never speculatively. " +
      "Portions can be fractional: 'half an avocado' is 0.5. Requires the user's " +
      "confirmation. Returns what was actually logged; cite those figures, never your own " +
      "estimate.",
    input_schema: obj(
      {
        food: {
          type: "string",
          description: "The food's common name, singular. e.g. 'banana', 'jollof rice'.",
        },
        servings: {
          type: "number",
          description:
            "How many standard portions, fractions allowed (0.5 for half). Default 1 when unstated.",
        },
        meal: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner", "snack"],
          description:
            "The meal it belongs to — as they said it, or by the time of day on their clock. " +
            "'snack' for something between meals.",
        },
      },
      ["food", "servings", "meal"],
    ),
    readOnly: false,
    run: async (input: { food: string; servings: number; meal: MealSlot }, ctx) => {
      const food = (input.food ?? "").trim();
      if (!food) return { status: "rejected", reason: "No food named." };
      const requested =
        Number.isFinite(input.servings) && input.servings > 0 ? input.servings : 1;
      const meal: MealSlot = MEAL_SLOTS.includes(input.meal) ? input.meal : "snack";

      const actions = ctx.actions;
      if (!actions?.resolveFood || !actions.logFood || !actions.confirm) {
        return { status: "unavailable", reason: "Logging is not available right now." };
      }

      // The amount that will ACTUALLY be written, settled before the question
      // is asked. It once was rounded to a whole serving after the user had
      // approved "0.5 ×", so they agreed to half an avocado and got a whole one.
      const portions = Math.min(
        MAX_LOGGED_PORTIONS,
        Math.max(PORTION_STEP, Math.round(requested / PORTION_STEP) * PORTION_STEP),
      );
      const adjusted = Math.abs(portions - requested) > 1e-9;

      // Resolve and MEASURE first. The sheet used to quote the model's words
      // ("jollof rice") while the write took the catalog's first search hit,
      // which could be a different food — consent to one thing, a write of
      // another. Now the sheet shows the exact line the log will hold.
      const resolved = await actions.resolveFood(food, portions);
      if (!resolved.ok) return { status: "not_found", reason: resolved.reason };
      const item = resolved.food;

      const approved = await actions.confirm({
        tool: "log_food",
        summary:
          meal === "snack" ? `Log ${item.label} as a snack?` : `Log ${item.label} to ${meal}?`,
        detail: [
          `${Math.round(item.calories)} kcal · ${Math.round(item.proteinG)} g protein`,
          adjusted
            ? `You mentioned ${requested}. Portions go in quarters, so this logs ${portions}.`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        input: { food: item.name, portions, meal },
      });
      if (!approved) {
        return {
          status: "declined",
          reason: "The user declined. Do not log it, and do not ask again this turn.",
        };
      }
      const result = await actions.logFood(item, meal);
      return result.ok
        ? {
            status: "logged",
            logged: result.label,
            meal,
            ...(adjusted ? { requestedPortions: requested } : {}),
            calories: result.calories,
            proteinG: result.proteinG,
          }
        : { status: "failed", reason: result.reason };
    },
  },

  {
    // THE ONE WRITE WITHOUT A CONFIRMATION SHEET, and the reasons are specific
    // to it (docs/gozlin/11 §7.3). It stores only the person's own words, and
    // the check below proves they ARE their words; the record is visible and
    // forgettable in Memory; and a sheet in front of every "yeah, legs were
    // wrecked" is exactly the friction that would make nobody answer. The
    // consent is a "Noted · Undo" toast the caller shows. It still fails
    // closed: no action, no switch, no write.
    name: "note_experience",
    description:
      "Record how an exercise they did went for them, in their own words, so you can remember it the next time it " +
      "comes up. Call it when they answer a question the current-state block told you to ask, or when they tell you " +
      "unprompted how a specific exercise they did felt during or afterwards. Exercises only — never food, drink, " +
      "supplements or anything else. `quote` must be copied exactly from their message: never paraphrase, never " +
      "summarise, never record what they did not say. Do not call it for plans or for opinions about exercise in " +
      "general. It saves without a confirmation step — they see a note with an undo, so you need not say you saved it.",
    input_schema: obj(
      {
        exercise: {
          type: "string",
          description: "The exercise, as they or the current-state block named it. e.g. 'Nordic curls'.",
        },
        quote: {
          type: "string",
          description: "The part of their message about how it went, copied exactly.",
        },
        soreness: {
          type: "string",
          enum: ["none", "mild", "moderate", "severe", "unsaid"],
          description: "How sore they said it left them. 'unsaid' when they did not say.",
        },
        enjoyed: {
          type: "string",
          enum: ["yes", "mixed", "no", "unsaid"],
          description: "Whether they said they liked it. 'unsaid' when they did not say.",
        },
      },
      ["exercise", "quote", "soreness", "enjoyed"],
    ),
    readOnly: false,
    run: async (
      input: { exercise: string; quote: string; soreness: string; enjoyed: string },
      ctx,
    ) => {
      const actions = ctx.actions;
      if (!ctx.experiences?.enabled || !actions?.noteExperience) {
        return { status: "unavailable", reason: "Noting this is switched off. Do not mention it." };
      }
      const turn = ctx.turn;
      if (turn && turn.notes >= 1) {
        return { status: "rejected", reason: "One note per reply. Do not record another this turn." };
      }

      // Their words, or nothing. Checked against what they typed this turn and
      // the two user turns before it — an answer can arrive a message late.
      const quote = (input.quote ?? "").trim();
      const typed = [
        ...(turn?.text ? [turn.text] : []),
        ...(ctx.conversation ?? [])
          .filter((m) => m.role === "user")
          .slice(-2)
          .map((m) => m.content),
      ];
      if (!isVerbatim(quote, typed)) {
        return {
          status: "rejected",
          reason: "quote must be copied exactly from their message. Nothing was saved.",
        };
      }

      const resolved = resolveNoteSubject(input.exercise ?? "", ctx, nowOf(ctx));
      if (!resolved) {
        return {
          status: "not_recorded",
          reason: "Only exercises are noted, and this does not match one. Nothing was saved; do not mention it.",
        };
      }

      const result = await actions.noteExperience({
        subject: resolved.subject,
        triedOn: resolved.triedOn,
        quote,
        soreness: SORENESS_INPUT[input.soreness] ?? null,
        enjoyed: ENJOYED_INPUT[input.enjoyed] ?? null,
        source: resolved.answersDue ? "asked-chat" : "volunteered",
      });
      if (!result.ok) return { status: "failed", reason: result.reason };
      if (turn) turn.notes += 1;
      return { status: "noted", exercise: resolved.subject.label, triedOn: resolved.triedOn };
    },
  },
];

/**
 * Schemas only — what crosses the wire. Sorted by name because tools render at
 * position 0 of the cached prefix: a reordered tool array invalidates every
 * cache entry we have.
 */
export const TOOL_SCHEMAS = GOZLIN_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema,
  strict: true,
})).sort((a, b) => a.name.localeCompare(b.name));

export function findTool(name: string): GozlinTool | undefined {
  return GOZLIN_TOOLS.find((t) => t.name === name);
}
