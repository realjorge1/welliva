/**
 * GOZLIN AGENT — the loop.
 *
 * This is the inversion, in about 150 lines. Previously `classifyIntent` picked
 * an engine and that engine's output was the answer. Now the model picks tools,
 * the tools run on-device, and the model composes the reply from what they
 * return.
 *
 * `respondDeterministic` is unchanged and becomes the FLOOR, not the ceiling.
 * Every failure path lands there — offline, unconfigured, refusal, timeout,
 * iteration cap, ungrounded numbers. Nothing that works today gets worse; the
 * only question is how often we clear the floor.
 *
 * The transport is injected rather than imported. services/api already imports
 * services/gozlin, so reaching the other way would close a cycle — and it makes
 * the whole loop testable without a network.
 */

import type { GozlinChatContext, GozlinChatResult } from "../GozlinChatEngine";
import { respondDeterministic } from "../GozlinChatEngine";
import type { GozlinMessage, GozlinTone } from "../gozlin.types";
import { buildTurnMessages, type WireMessage } from "./context";
import { screenForClinicalRisk } from "./clinical";
import {
  addDerivedGaps,
  collectAllowedNumbers,
  recordGrounding,
  validateNumbers,
} from "./grounding";
import { findTool, type GozlinToolContext } from "./tools";

/**
 * Hard stop. A coach answering a question about this week never legitimately
 * needs more than a couple of rounds; anything beyond this is a loop, not work.
 */
const MAX_ITERATIONS = 6;

/** One regeneration attempt when the reply cites a number we can't account for. */
const MAX_REGENERATIONS = 1;

// ── Transport seam ─────────────────────────────────────────────────

export interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  [k: string]: unknown;
}

export interface CoachTurnRequest {
  messages: WireMessage[];
  signal?: AbortSignal;
  /** Streamed text deltas, for rendering into the bubble as they arrive. */
  onDelta?: (text: string) => void;
}

export interface CoachTurnResponse {
  content: ContentBlock[];
  /** "end_turn" | "tool_use" | "refusal" | "max_tokens" | … */
  stop_reason: string | null;
  model?: string;
}

export type CoachTransport = (req: CoachTurnRequest) => Promise<CoachTurnResponse>;

export interface AgentTurnOptions {
  /** Absent ⇒ straight to the deterministic path. */
  transport?: CoachTransport | null;
  onDelta?: (text: string) => void;
  /**
   * Fires before each model call. The loop can call the model several times
   * (tool rounds, one regeneration), and each call streams its own text — so
   * the UI must clear whatever it has rendered rather than concatenating two
   * different drafts of the same reply.
   */
  onTurnStart?: () => void;
  /** Surfaces tool work as visible activity ("checking your last 6 weeks…"). */
  onActivity?: (label: string) => void;
  signal?: AbortSignal;
}

export interface AgentTurnResult extends GozlinChatResult {
  /** How the reply was produced — drives the fallback-rate release gate. */
  source: "agent" | "deterministic" | "clinical";
}

// ── Activity labels ────────────────────────────────────────────────
//
// The loop can take 3–8 seconds. Dead air reads as broken; naming the work
// turns the latency into a trust signal — the user watches the coach dig.

const ACTIVITY: Record<string, string> = {
  investigate_progress: "digging into what's been happening…",
  analyze_nutrition: "going through what you've been eating…",
  analyze_training: "reviewing your recent sessions…",
  get_weekly_review: "pulling your week together…",
  get_forecast: "running your trajectory…",
  get_habit_report: "looking at your patterns…",
  get_recovery_status: "checking your recovery…",
  get_daily_briefing: "looking at today…",
  recall_memory: "remembering what you've told me…",
  remember_fact: "saving that…",
  log_food: "logging that…",
};

// ── Message helpers ────────────────────────────────────────────────

let SEQ = 0;
function coachMsg(content: string, tone: GozlinTone, now?: Date): GozlinMessage {
  return {
    id: `gz_a_${Date.now()}_${SEQ++}`,
    role: "coach",
    content,
    tone,
    createdAt: (now ?? new Date()).getTime(),
  };
}

function textOf(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/**
 * Pick a register from the user's actual state rather than the model's word
 * choice — keeps the visual tone honest even when the prose is upbeat.
 */
function inferTone(ctx: GozlinChatContext): GozlinTone {
  const f = new Set(ctx.twin.flags);
  if (ctx.twin.recovery.level === "red") return "gentle";
  if (f.has("SETBACK") || f.has("STREAK_BROKEN")) return "gentle";
  if (f.has("STREAK_STRONG") || f.has("WORKOUT_DONE")) return "proud";
  if (f.has("OVER_CALORIES") || f.has("PROTEIN_LAG")) return "honest";
  if (f.has("ON_TRACK")) return "steady";
  return "warm";
}

// ── The loop ───────────────────────────────────────────────────────

export async function runAgentTurn(
  text: string,
  ctx: GozlinToolContext,
  opts: AgentTurnOptions = {},
): Promise<AgentTurnResult> {
  const now = ctx.now ?? new Date();

  // 1. Clinical screen — BEFORE any model call. A gate the model can be talked
  //    around isn't a gate.
  const risk = screenForClinicalRisk(text);
  if (risk) {
    return {
      message: coachMsg(risk.reply, risk.kind === "emergency" ? "alert" : "gentle", now),
      source: "clinical",
    };
  }

  // 2. Offline / unconfigured → the floor. Unchanged behaviour, no network.
  const transport = opts.transport;
  if (!transport) return { ...respondDeterministic(text, ctx), source: "deterministic" };

  const fallback = (): AgentTurnResult => ({
    ...respondDeterministic(text, ctx),
    source: "deterministic",
  });

  const messages = buildTurnMessages(text, ctx);

  // Everything the model is allowed to quote: the state block plus every tool
  // result it sees this turn.
  const allowed = collectAllowedNumbers({
    twin: ctx.twin,
    identity: ctx.identity,
  });
  addDerivedGaps(allowed, [
    ctx.twin.today.calories,
    ctx.twin.today.protein,
    ctx.twin.today.water,
  ]);

  let regenerations = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (opts.signal?.aborted) return fallback();

      opts.onTurnStart?.();
      const res = await transport({
        messages,
        signal: opts.signal,
        onDelta: opts.onDelta,
      });

      // Safety classifiers decline with HTTP 200 and stop_reason "refusal".
      // Check BEFORE reading content — on a pre-output refusal it's empty.
      if (res.stop_reason === "refusal") return fallback();

      const content = res.content ?? [];
      messages.push({ role: "assistant", content });

      if (res.stop_reason !== "tool_use") {
        const reply = textOf(content);
        if (!reply) return fallback();

        // 3. Numeric grounding. One correction, then the floor.
        const check = validateNumbers(reply, allowed);
        recordGrounding(check);
        if (!check.ok) {
          if (regenerations >= MAX_REGENERATIONS) return fallback();
          regenerations++;
          messages.push({
            role: "system",
            content:
              `Your last reply used ${check.violations.join(", ")}, which does not appear in ` +
              "any tool result or the current-state block. Rewrite it using only figures you " +
              "were given, or with no figures at all. Do not mention this correction.",
          });
          continue;
        }

        return { message: coachMsg(reply, inferTone(ctx), now), source: "agent" };
      }

      // 4. Tool round. Execute every call, return ALL results in ONE user
      //    message — splitting them across messages trains the model out of
      //    parallel calls.
      const calls = content.filter((b) => b.type === "tool_use");
      if (calls.length === 0) return fallback();

      for (const c of calls) {
        const label = ACTIVITY[c.name ?? ""];
        if (label) opts.onActivity?.(label);
      }

      const results = await Promise.all(
        calls.map(async (c) => {
          const tool = findTool(c.name ?? "");
          if (!tool) {
            return {
              type: "tool_result",
              tool_use_id: c.id,
              content: `Error: no such tool "${c.name}".`,
              is_error: true,
            };
          }
          try {
            const out = await tool.run(c.input ?? {}, ctx);
            collectAllowedNumbers(out, allowed);
            return {
              type: "tool_result",
              tool_use_id: c.id,
              content: JSON.stringify(out),
            };
          } catch (e) {
            // Never drop a failed tool — an unanswered tool_use wedges the turn.
            return {
              type: "tool_result",
              tool_use_id: c.id,
              content: `Error: ${e instanceof Error ? e.message : String(e)}`,
              is_error: true,
            };
          }
        }),
      );

      messages.push({ role: "user", content: results });
    }

    // Iteration cap — it's looping, not working.
    return fallback();
  } catch {
    // Network, timeout, malformed payload — all land on the floor.
    return fallback();
  }
}
