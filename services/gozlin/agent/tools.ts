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
import { buildDetectiveReport } from "../GozlinDetectiveEngine";
import { buildForecast } from "../GozlinForecastEngine";
import { buildHabitReport } from "../GozlinHabitEngine";
import { buildWeeklyReview } from "../GozlinProgressEngine";
import { computeRecovery } from "../GozlinRecoveryEngine";
import { loadMemorySnapshot } from "../GozlinMemoryStore";

// ── Injected side-effects ──────────────────────────────────────────
//
// Write tools never import a context or a store directly — the caller passes
// callbacks in. Keeps this package pure (and keeps the contexts → services
// dependency one-directional, same discipline as CoachInsightEngine).

/** What a write tool is asking permission to do, for the confirmation UI. */
export interface ToolConfirmRequest {
  tool: string;
  /** One-line, user-facing: "Log 1 banana as a snack?" */
  summary: string;
  input: Record<string, unknown>;
}

export interface GozlinToolActions {
  /**
   * Resolve `name` against the whole-foods catalog and log it as a consumed
   * snack. Returns what was actually logged so the model can cite real macros.
   */
  logFood?: (
    name: string,
    servings: number,
  ) => Promise<
    | { ok: true; name: string; calories: number; proteinG: number }
    | { ok: false; reason: string }
  >;
  /** Persist an identity fact (motivation / preference / constraint). */
  rememberFact?: (
    kind: "motivation" | "preference" | "constraint",
    value: string,
  ) => Promise<void>;
  /**
   * Confirmation gate for write tools. When absent, every write is DECLINED —
   * fail closed. The model must never mutate user data unprompted.
   */
  confirm?: (request: ToolConfirmRequest) => Promise<boolean>;
}

export interface GozlinToolContext extends GozlinChatContext {
  actions?: GozlinToolActions;
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
      const r = buildDetectiveReport({
        twin: ctx.twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        sessionHistory: ctx.snapshot.sessionHistory,
        bodyLogs: ctx.snapshot.bodyLogs,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now: nowOf(ctx),
      });
      return {
        focus: input.focus,
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
        wearable: ctx.snapshot.wearable ?? null,
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
      "Log a whole food onto today's plan as a consumed snack. Call this ONLY when the " +
      "user clearly states they ate or drank something and wants it recorded — never " +
      "to answer a question about a food, and never speculatively. Requires the user's " +
      "confirmation. Returns the macros actually logged; cite those, never your own " +
      "estimate.",
    input_schema: obj(
      {
        food: {
          type: "string",
          description: "The food's common name, singular. e.g. 'banana', 'jollof rice'.",
        },
        servings: {
          type: "number",
          description: "How many standard servings. Default 1 when unstated.",
        },
      },
      ["food", "servings"],
    ),
    readOnly: false,
    run: async (input: { food: string; servings: number }, ctx) => {
      const food = (input.food ?? "").trim();
      if (!food) return { status: "rejected", reason: "No food named." };
      const servings =
        Number.isFinite(input.servings) && input.servings > 0 ? input.servings : 1;

      const actions = ctx.actions;
      if (!actions?.logFood || !actions.confirm) {
        return { status: "unavailable", reason: "Logging is not available right now." };
      }
      const approved = await actions.confirm({
        tool: "log_food",
        summary: `Log ${servings} × ${food} as a snack?`,
        input: { food, servings },
      });
      if (!approved) {
        return {
          status: "declined",
          reason: "The user declined. Do not log it, and do not ask again this turn.",
        };
      }
      const result = await actions.logFood(food, servings);
      return result.ok
        ? {
            status: "logged",
            food: result.name,
            calories: result.calories,
            proteinG: result.proteinG,
          }
        : { status: "failed", reason: result.reason };
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
