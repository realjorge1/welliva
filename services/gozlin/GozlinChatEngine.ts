/**
 * GOZLIN — Conversational engine (Phase 2 §10).
 *
 * Offline-first chat that feels like the coach. Coaching *decisions* always come
 * from the deterministic engines (Twin / Briefing / Forecast / Progress / Weekly
 * / Recovery); an optional LLM provider only rephrases or handles open-ended
 * chat. Pull the provider and the product still works.
 *
 * The engine is pure: it returns a message + a list of `effects` for the caller
 * to persist (so memory writes stay out of the pure core).
 */

import type { CoachInsight } from "../intelligence";
import { classify } from "./nlu/classify";
import { buildNutritionAdaptations } from "./GozlinAdaptiveNutritionEngine";
import { buildWorkoutAdaptations } from "./GozlinAdaptiveWorkoutEngine";
import { buildBriefing, type BriefingInput } from "./GozlinBriefingEngine";
import { buildDetectiveReport } from "./GozlinDetectiveEngine";
import { buildForecast } from "./GozlinForecastEngine";
import { buildHabitReport } from "./GozlinHabitEngine";
import type { HabitTrackerBrief } from "./GozlinTrackerHabits";
import { closer } from "./GozlinPersona";
import {
  buildWeeklyReview,
  detectFindings,
} from "./GozlinProgressEngine";
import type {
  GozlinCheckin,
  GozlinEpisode,
  GozlinIdentityMemory,
  GozlinMessage,
  GozlinSnapshotInput,
  GozlinStructured,
  GozlinTone,
  GozlinTwin,
} from "./gozlin.types";

// ── Provider seam (optional, online-only, never load-bearing) ──────

export interface GozlinProvider {
  isAvailable(): boolean;
  complete(input: { system: string; user: string }): Promise<string>;
}

// ── Context the chat engine reads ──────────────────────────────────

export interface GozlinChatContext {
  twin: GozlinTwin;
  snapshot: GozlinSnapshotInput;
  insights: CoachInsight[];
  identity: GozlinIdentityMemory;
  /** Self-reported daily check-ins (sleep / mood / stress) — powers Habit reads. */
  checkins: GozlinCheckin[];
  /**
   * The habit TRACKER, as facts: the habits this person declared out loud, and
   * the ones they stopped. Optional because the deterministic path predates it
   * and every surface that builds a context does not have the tracker to hand —
   * a missing brief means "don't mention habits", never a fabricated one.
   */
  habits?: HabitTrackerBrief;
  weekStart: string;
  weeklyWorkoutTarget: number;
  /**
   * Prior turns, oldest first. Read only by the agent loop (agent/context.ts) —
   * the deterministic path is stateless by design and ignores this.
   */
  conversation?: GozlinMessage[];
  now?: Date;
}

export interface GozlinChatResult {
  message: GozlinMessage;
  /** Side-effects for the caller to persist (keeps the engine pure). */
  effects?: { rememberMotivation?: string; addEpisode?: GozlinEpisode };
}

export type GozlinIntent =
  | "greeting"
  | "motivation"
  | "forecast"
  | "weekly"
  | "adapt_workout"
  | "adapt_nutrition"
  | "detective"
  | "habits"
  | "progress"
  | "recovery"
  | "diet"
  | "workout"
  | "briefing"
  | "memory_recall"
  | "smalltalk";

// ── Message id (stable, collision-free within a session) ───────────
let SEQ = 0;
function newId(): string {
  return `gz_${Date.now()}_${SEQ++}`;
}

function coachMsg(
  content: string,
  tone: GozlinTone,
  structured?: GozlinStructured,
  now?: Date,
): GozlinMessage {
  return {
    id: newId(),
    role: "coach",
    content,
    tone,
    structured,
    createdAt: (now ?? new Date()).getTime(),
  };
}

export function userMsg(content: string, now?: Date): GozlinMessage {
  return {
    id: newId(),
    role: "user",
    content: content.trim(),
    createdAt: (now ?? new Date()).getTime(),
  };
}

// ── Intent classification ──────────────────────────────────────────
//
// The ordered first-match regex table that used to live here is gone. It had a
// structural flaw no amount of pattern-tuning fixes: whichever rule was listed
// first won, so "tune my macros" routed to adapt_workout because that rule sat
// above adapt_nutrition. It also had no typo tolerance, no negation handling,
// no way to express two intents, and no way to say "I'm not sure".
//
// ./nlu scores every intent instead, and can abstain. See ./nlu/classify.ts.

export { classifyIntent } from "./nlu/classify";

// ── Deterministic responders per intent ────────────────────────────

/** Assemble the full Phase-4 briefing input from the chat context. */
function briefingInput(ctx: GozlinChatContext, now: Date): BriefingInput {
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

function dietReply(twin: GozlinTwin): { content: string; tone: GozlinTone } {
  const f = new Set(twin.flags);
  if (f.has("NO_PLAN"))
    return { content: "No plan set for today yet — let's sort that first, then I can keep you on target. One tap on the Diet tab.", tone: "curious" };
  if (f.has("OVER_CALORIES"))
    return { content: "You're over on calories today. No drama — go lighter on your next meal and tomorrow balances it out.", tone: "honest" };
  if (f.has("PROTEIN_LAG")) {
    const left = Math.max(0, Math.round(twin.today.protein.target - twin.today.protein.consumed));
    return { content: `Protein's the gap right now — about ${left}g to go. A protein-forward snack or your next meal closes it.`, tone: "curious" };
  }
  if (f.has("LOW_WATER")) {
    const left = Math.max(0, Math.round(twin.today.water.target - twin.today.water.consumed));
    return { content: `You're cruising on food but water's behind — roughly ${left}ml left. A glass now, one with your next meal.`, tone: "curious" };
  }
  return { content: "Nutrition's looking solid today — nothing I'd change. Keep it steady.", tone: "steady" };
}

function workoutReply(twin: GozlinTwin): { content: string; tone: GozlinTone } {
  const w = twin.today.workout;
  const rec = twin.recovery;
  if (w.done)
    return { content: "Already done today — that's the session in the bag. Recover well; that's where it sticks.", tone: "proud" };
  if (w.planned)
    return { content: `Today's ${w.planned}, about ${w.minutes} min. Recovery's ${rec.level} — ${rec.recommendation}`, tone: rec.level === "red" ? "gentle" : "warm" };
  return { content: `No session scheduled today. ${rec.recommendation}`, tone: "steady" };
}

/**
 * What we say when we genuinely didn't understand.
 *
 * The line this replaced ("that's a little outside my lane") did more brand
 * damage than any bug in the audit: it was a deflection dressed as a boundary,
 * and it fired on typos and on perfectly in-scope questions the regex happened
 * to miss. Admitting confusion and offering concrete options is both more
 * honest and more useful.
 */
function buildUnknownFallback(): string {
  return (
    "I didn't quite catch that. Try me on one of these — " +
    "what to focus on today, why your progress is doing what it's doing, " +
    "or whether you should train right now."
  );
}

/** Human labels, for the clarifying question. */
const INTENT_LABEL: Record<GozlinIntent, string> = {
  greeting: "how today's looking",
  motivation: "what's driving you",
  forecast: "where you're heading",
  weekly: "how your week went",
  adapt_workout: "tuning your training",
  adapt_nutrition: "tuning your nutrition",
  detective: "why your progress is doing what it's doing",
  habits: "the habits I've noticed",
  progress: "how you're doing overall",
  recovery: "whether you should train",
  diet: "what to eat",
  workout: "today's session",
  briefing: "what to focus on today",
  memory_recall: "what I know about you",
  smalltalk: "something else",
};

/**
 * Two plausible readings and no way to choose. Asking beats guessing: a coach
 * who asks reads as attentive, a coach who confidently answers the wrong
 * question reads as broken.
 */
function buildClarifier(a: GozlinIntent, b: GozlinIntent): string {
  return `Two ways I can take that — do you want ${INTENT_LABEL[a]}, or ${INTENT_LABEL[b]}?`;
}

/** System prompt that grounds an optional LLM in *real* numbers only. */
export function buildGroundingPrompt(ctx: GozlinChatContext): string {
  const t = ctx.twin;
  const facts = [
    `goal: ${t.identitySummary}`,
    `streak: ${t.momentum.streak} days`,
    `adherence(7d): ${t.momentum.adherence7d}/100`,
    `today calories: ${Math.round(t.today.calories.consumed)}/${Math.round(t.today.calories.target)}`,
    `today protein: ${Math.round(t.today.protein.consumed)}/${Math.round(t.today.protein.target)}g`,
    `recovery: ${t.recovery.level} (${t.recovery.score})`,
    `flags: ${t.flags.join(", ") || "none"}`,
    ctx.identity.motivation ? `their "why": ${ctx.identity.motivation}` : "",
  ].filter(Boolean).join("\n");
  return (
    "You are Gozlin, a persistent, warm, observant health coach inside the Welliva app. " +
    "Be brief (1–3 sentences), supportive, never robotic, never shaming, never guilt-tripping. " +
    "You are NOT a doctor: defer red-flag medical symptoms to a professional. " +
    "Use ONLY the facts below — never invent numbers. If you don't know, say so.\n\n" +
    `Known facts about the user:\n${facts}`
  );
}

/** Produce the reply for one already-resolved intent. */
function respondToIntent(
  intent: GozlinIntent,
  text: string,
  ctx: GozlinChatContext,
  now: Date,
): GozlinChatResult {
  const twin = ctx.twin;

  switch (intent) {
    case "greeting": {
      const b = buildBriefing(briefingInput(ctx, now));
      return { message: coachMsg(`${b.greeting} ${b.headline}`, b.tone, undefined, now) };
    }

    case "motivation": {
      // Capture the user's stated "why" as identity memory.
      const why = text.replace(/.*\b(my goal is|i want to|i'm trying to|i wanna|i'd like to|because i|my why( is)?)\b/i, "").trim();
      const clean = why.replace(/^(to|is|:)\s*/i, "").trim();
      if (clean.length >= 3) {
        return {
          message: coachMsg(
            `Got it — locking that in: you're here for ${clean}. I'll keep us pointed at it. ${closer(twin.asOf)}`,
            "warm",
            undefined,
            now,
          ),
          effects: { rememberMotivation: clean },
        };
      }
      return { message: coachMsg("Tell me the real reason you're doing this — I'll hold us to it.", "curious", undefined, now) };
    }

    case "forecast": {
      const f = buildForecast({
        twin,
        dietHistory: ctx.snapshot.dietHistory,
        bodyLogs: ctx.snapshot.bodyLogs,
        calorieTarget: ctx.snapshot.targets?.calories ?? 0,
        goal: twin.goal,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now,
      });
      return { message: coachMsg(f.summary, f.confidence === "low" ? "honest" : "steady", f, now) };
    }

    case "weekly": {
      const r = buildWeeklyReview({
        twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        weekStart: ctx.weekStart,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now,
      });
      return { message: coachMsg(`Here's your week. ${r.trajectoryLine}`, "warm", r, now) };
    }

    case "adapt_workout": {
      const wa = buildWorkoutAdaptations({
        twin,
        sessionHistory: ctx.snapshot.sessionHistory,
        workoutLog: ctx.snapshot.workoutLog,
        plan: ctx.snapshot.workoutPlan,
        difficulty: ctx.snapshot.bio?.exerciseLevel ?? "beginner",
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now,
      });
      return {
        message: coachMsg(wa.summary, wa.dataLimited ? "warm" : "steady", wa, now),
      };
    }

    case "adapt_nutrition": {
      const na = buildNutritionAdaptations({
        twin,
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
        now,
      });
      return {
        message: coachMsg(na.summary, na.dataLimited ? "warm" : "steady", na, now),
      };
    }

    case "detective": {
      const report = buildDetectiveReport({
        twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        sessionHistory: ctx.snapshot.sessionHistory,
        bodyLogs: ctx.snapshot.bodyLogs,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now,
      });
      return {
        message: coachMsg(report.headline, report.dataLimited ? "warm" : "honest", report, now),
      };
    }

    case "habits": {
      const report = buildHabitReport({
        twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        workoutPlan: ctx.snapshot.workoutPlan,
        checkins: ctx.checkins,
        weeklyWorkoutTarget: ctx.weeklyWorkoutTarget,
        now,
      });
      return { message: coachMsg(report.headline, report.tone, report, now) };
    }

    case "progress": {
      const findings = detectFindings({
        twin,
        dietHistory: ctx.snapshot.dietHistory,
        workoutLog: ctx.snapshot.workoutLog,
        now,
      });
      return {
        message: coachMsg(
          "I went digging in your data — here's what stands out.",
          "honest",
          { __kind: "progress", findings },
          now,
        ),
      };
    }

    case "recovery": {
      return {
        message: coachMsg(twin.recovery.recommendation, twin.recovery.level === "red" ? "gentle" : "steady", { __kind: "recovery", state: twin.recovery }, now),
      };
    }

    case "diet": {
      const { content, tone } = dietReply(twin);
      return { message: coachMsg(content, tone, undefined, now) };
    }

    case "workout": {
      const { content, tone } = workoutReply(twin);
      return { message: coachMsg(content, tone, undefined, now) };
    }

    case "briefing": {
      const b = buildBriefing(briefingInput(ctx, now));
      return { message: coachMsg(`${b.headline}`, b.tone, b, now) };
    }

    case "memory_recall": {
      const bits: string[] = [];
      if (ctx.identity.motivation) bits.push(`you're here for ${ctx.identity.motivation}`);
      bits.push(twin.identitySummary);
      if (twin.momentum.streak > 0) bits.push(`${twin.momentum.streak}-day streak`);
      return { message: coachMsg(`Here's what I've got on you: ${bits.join(", ")}. You can clear any of this any time.`, "warm", undefined, now) };
    }

    default:
      return { message: coachMsg(buildUnknownFallback(), "warm", undefined, now) };
  }
}

/**
 * Synchronous, fully-offline response. Always correct and complete.
 *
 * This is now the FLOOR under the agent loop rather than the primary path —
 * every failure in services/gozlin/agent lands here. That raises the bar: it's
 * the fallback for a much better online experience, so an honest "I didn't
 * catch that" matters more than it used to, not less.
 */
export function respondDeterministic(
  text: string,
  ctx: GozlinChatContext,
): GozlinChatResult {
  const now = ctx.now ?? new Date();
  const result = classify(text);

  switch (result.kind) {
    case "single":
      return respondToIntent(result.intent, text, ctx, now);

    case "multi": {
      // Both engines run and both answers ship. The old table picked one and
      // silently dropped the other — "I always eat too much protein" came back
      // as a habits read with no mention of nutrition at all.
      const [first, second] = result.intents;
      const a = respondToIntent(first, text, ctx, now);
      const b = respondToIntent(second, text, ctx, now);
      return {
        message: coachMsg(
          `${a.message.content}\n\n${b.message.content}`,
          a.message.tone ?? "warm",
          // Only one card can render; lead with the stronger intent's.
          a.message.structured ?? b.message.structured,
          now,
        ),
        effects: a.effects ?? b.effects,
      };
    }

    case "ambiguous":
      return {
        message: coachMsg(
          buildClarifier(result.options[0].intent, result.options[1].intent),
          "curious",
          undefined,
          now,
        ),
      };

    case "non_english":
      // Offline we can only work in English — say so in their language rather
      // than deflecting at them in ours.
      return { message: coachMsg(result.apology, "warm", undefined, now) };

    case "unknown":
    default:
      return { message: coachMsg(buildUnknownFallback(), "warm", undefined, now) };
  }
}

/**
 * Async response — the LEGACY single-shot path.
 *
 * Superseded by the agent loop (services/gozlin/agent), where the model picks
 * tools instead of only rephrasing whatever the classifier already decided.
 * Kept for callers that haven't moved over.
 *
 * The provider is consulted only when the classifier abstains, which is now a
 * much narrower set than the old catch-all "smalltalk" bucket.
 */
export async function respond(
  text: string,
  ctx: GozlinChatContext,
  provider?: GozlinProvider,
): Promise<GozlinChatResult> {
  const base = respondDeterministic(text, ctx);
  const result = classify(text);

  if (result.kind === "unknown" && provider?.isAvailable()) {
    try {
      const reply = await provider.complete({
        system: buildGroundingPrompt(ctx),
        user: text.trim(),
      });
      if (reply && reply.trim()) {
        return {
          message: coachMsg(reply.trim(), "warm", undefined, ctx.now),
          effects: base.effects,
        };
      }
    } catch {
      // Provider failed/offline — deterministic fallback already in `base`.
    }
  }
  return base;
}
