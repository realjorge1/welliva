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
import {
  buildTurnMessages,
  habitEvidence,
  identityEvidence,
  type WireMessage,
} from "./context";
import { screenForClinicalRisk, type ClinicalRiskKind } from "./clinical";
import { experienceEvidence } from "./experiences";
import { askedInReply, recallsUsed } from "../novelty/recall";
import type { ChatStage } from "../novelty/curiosity";
import { toLocalDateString } from "../../OfflineStorage";
import {
  addDerivedGaps,
  addUserStatedNumbers,
  collectAllowedNumbers,
  recordGrounding,
  validateNumbers,
} from "./grounding";
import {
  collectWithProvenance,
  createLedger,
  receiptsFor,
} from "./receipts";
import {
  OUTPUT_FALLBACK,
  recordOutputScreen,
  screenOutput,
} from "./outputSafety";
import { safeDisplayLength } from "./streamGate";
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
  /**
   * What KIND of turn this is, for a backend that wants to treat one
   * differently — a deep dive (./deepDive.ts) needs a longer answer than a
   * coach reply and says so here. Omitted for an ordinary turn, and a server
   * that ignores it still answers correctly, so this is a hint and never a
   * dependency.
   */
  mode?: string;
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
  /**
   * How the reply was produced — drives the fallback-rate release gate.
   *
   * `locked`: the SERVER refused the turn because this account is not entitled
   * to the coach. The message is the deterministic floor, but the caller must
   * not present it as the coach's answer — the app believed the coach was open
   * and the server disagreed, and saying so is the only honest reply.
   */
  source: "agent" | "deterministic" | "clinical" | "locked";
  /** What this turn did with "trying something new". Agent replies only. */
  curiosity?: TurnCuriosity;
  /**
   * Which clinical screen answered, when the model never ran. The caller needs
   * it for one reason: a disordered-eating signal leaves a care flag (kind and
   * time, no words — services/gozlin/careFlags.ts).
   */
  clinicalKind?: ClinicalRiskKind;
}

/**
 * The question and the memories, after the reply: what the caller stores so
 * the next turn knows (services/gozlin/novelty/curiosity.ts afterTurn).
 */
export interface TurnCuriosity {
  /** The open question this turn carried, if it carried one. */
  entryId: string | null;
  stage: ChatStage | null;
  /** The reply asked it. */
  asked: boolean;
  /** note_experience recorded an answer this turn. */
  noted: boolean;
  /** Memories the reply used — they start their recall rest. */
  recalled: string[];
}

/**
 * The transport raises an error carrying this code when the backend refuses a
 * turn for entitlement (backend-welliva requireCoachAccess). Matched by shape,
 * not by class: this package cannot import services/api without a cycle.
 */
export const COACH_LOCKED_CODE = "pro_required";

function isLockedError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === COACH_LOCKED_CODE
  );
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
  review_tracked_habits: "checking your habit tracker…",
  review_mood_log: "reading how you've been feeling…",
  note_experience: "noting that…",
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
  //    The profile's height is what lets a stated goal weight be judged at all.
  const risk = screenForClinicalRisk(text, ctx.snapshot?.bio);
  if (risk) {
    return {
      message: coachMsg(risk.reply, risk.kind === "emergency" ? "alert" : "gentle", now),
      source: "clinical",
      clinicalKind: risk.kind,
    };
  }

  // 2. Offline / unconfigured → the floor. Unchanged behaviour, no network.
  const transport = opts.transport;
  if (!transport) return { ...respondDeterministic(text, ctx), source: "deterministic" };

  const fallback = (): AgentTurnResult => ({
    ...respondDeterministic(text, ctx),
    source: "deterministic",
  });

  // This turn as the state block AND the tools see it: one clock, so the days
  // the block says were "15 days ago" are the days grounding registered, and
  // the text note_experience checks quotes against.
  const turn = { text: text.trim(), notes: 0 };
  const tctx: GozlinToolContext = { ...ctx, now, turn };
  const messages = buildTurnMessages(text, tctx);

  // Everything the model is allowed to quote: the state block plus every tool
  // result it sees this turn. The habit tracker is part of that block, so its
  // streaks and percentages are citable — omit them here and grounding would
  // reject the model for repeating a number we handed it ourselves.
  const habitFacts = habitEvidence(text, ctx);
  // What the block shows of their identity — the same capped lists, read from
  // the same function, so a figure inside a constraint they gave ("30 minutes
  // at lunch") is citable exactly when it was actually put in front of the model.
  const identityFacts = identityEvidence(ctx.identity);
  // Something new, and memories of things tried: exactly the figures the
  // block shows — "23 sessions logged before it", "15 days ago", and any
  // number inside their own quoted words.
  const experience = experienceEvidence(text, tctx, now);
  const allowed = collectAllowedNumbers({
    twin: ctx.twin,
    identity: identityFacts,
    habits: habitFacts.habits,
    habitLink: habitFacts.link,
    experiences: experience.facts,
  });
  // The same evidence, indexed by WHERE each figure came from. Built in
  // lockstep with the allowed-set above so that anything grounding lets
  // through has a receipt to show — the two must never disagree.
  const ledger = createLedger();
  collectWithProvenance(ctx.twin, "current-state", ledger);
  collectWithProvenance(identityFacts, "recall_memory", ledger);
  if (habitFacts.habits) {
    collectWithProvenance(habitFacts.habits, "habit-tracker", ledger);
    collectWithProvenance(habitFacts.link, "habit-tracker", ledger);
  }
  collectWithProvenance(experience.facts, "experience-log", ledger);
  addDerivedGaps(allowed, [
    ctx.twin.today.calories,
    ctx.twin.today.protein,
    ctx.twin.today.water,
  ]);
  // …and the same gaps on the ledger, named, so "about 360 to go" — the line
  // this product says most — opens a receipt instead of passing unexplained.
  collectWithProvenance(gapEvidence(ctx), "current-state", ledger);
  // The one deliberate exception to "every accepted figure has a receipt": a
  // number the person typed may be said back to them, but it is not from their
  // logs, so it never joins the ledger. See addUserStatedNumbers.
  addUserStatedNumbers(
    allowed,
    messages
      .filter((m) => m.role === "user" && typeof m.content === "string")
      .map((m) => m.content as string),
  );

  let regenerations = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (opts.signal?.aborted) return fallback();

      opts.onTurnStart?.();

      // THE STREAM GATE. Deltas used to go straight to the bubble, and the
      // checks below ran only once the reply was complete — so a draft that
      // grounding or output safety then threw away had already been READ: the
      // invented "340 calories over" was on screen for a second before the
      // regeneration wiped it. Now the bubble shows a draft only up to the
      // first figure that isn't backed yet, or the first sentence that trips
      // the output screen. Whatever the checks will reject never appears.
      let draft = "";
      let shown = 0;
      const onDelta = opts.onDelta
        ? (delta: string) => {
            draft += delta;
            const safe = safeDisplayLength(draft, allowed);
            if (safe > shown) {
              opts.onDelta!(draft.slice(shown, safe));
              shown = safe;
            }
          }
        : undefined;

      const res = await transport({
        messages,
        signal: opts.signal,
        onDelta,
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
              `Your last reply used ${check.violations.join(", ")} (written in digits or in words), which does not appear in ` +
              "any tool result or the current-state block. Rewrite it using only figures you " +
              "were given, or with no figures at all. Do not mention this correction.",
          });
          continue;
        }

        // 4. OUTPUT SAFETY. Grounding proved the figures are real; this asks
        //    whether the advice around them is safe to act on. Same shape as
        //    grounding — one specific correction, then a floor that cannot be
        //    wrong. See ./outputSafety.ts for why it screens actions, not words.
        const risk = screenOutput(reply);
        recordOutputScreen(risk);
        if (risk) {
          if (regenerations < MAX_REGENERATIONS) {
            regenerations++;
            messages.push({ role: "system", content: risk.correction });
            continue;
          }
          // Regeneration already spent, or spent again on the same fault: send
          // the deterministic reply for this risk rather than the model's.
          return {
            message: coachMsg(OUTPUT_FALLBACK[risk.kind], "gentle", now),
            source: "clinical",
          };
        }

        const message = coachMsg(reply, inferTone(ctx), now);
        // Only the agent path gets receipts: it is the only one whose figures
        // came from evidence rather than from copy we wrote ourselves.
        message.receipts = receiptsFor(reply, ledger);

        // The memories the reply actually used get a YOU TOLD ME receipt — and
        // only those: one handed to the model and left unused is not a claim.
        const used = recallsUsed(reply, experience.recalls);
        if (used.length > 0) {
          message.recalls = used.map((p) => ({
            recordId: p.record.id,
            label: p.record.label,
            on: p.record.triedOn ?? toLocalDateString(new Date(p.record.answeredAt)),
          }));
        }
        const curiosity: TurnCuriosity | undefined =
          experience.stage || used.length > 0 || turn.notes > 0
            ? {
                entryId: experience.due?.id ?? null,
                stage: experience.stage,
                asked:
                  experience.stage === "ask" && experience.due
                    ? askedInReply(reply, experience.due)
                    : false,
                noted: turn.notes > 0,
                recalled: used.map((p) => p.record.id),
              }
            : undefined;
        return { message, source: "agent", ...(curiosity ? { curiosity } : {}) };
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
            const out = await tool.run(c.input ?? {}, tctx);
            collectAllowedNumbers(out, allowed);
            collectWithProvenance(out, c.name ?? "tool", ledger);
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
  } catch (e) {
    // The server said this account may not use the coach. Say so, flagged, so
    // the caller can show the full Pro message — never the offline coach's
    // answer, which would pass a canned card off as the coach replying.
    if (isLockedError(e)) {
      return {
        message: coachMsg("Talking this through is part of welliva Pro.", "gentle", now),
        source: "locked",
      };
    }
    // Network, timeout, malformed payload — all land on the floor.
    return fallback();
  }
}

/**
 * Today's gaps as named evidence — left to go, or over, per target. Only the
 * non-zero side of each is registered: "0 over" is not a figure anyone says.
 */
function gapEvidence(ctx: GozlinChatContext) {
  const side = (m: { consumed: number; target: number }) => {
    if (!Number.isFinite(m.consumed) || !Number.isFinite(m.target) || m.target <= 0) return {};
    const left = m.target - m.consumed;
    return left >= 0 ? { left } : { over: -left };
  };
  return {
    today: {
      calories: side(ctx.twin.today.calories),
      protein: side(ctx.twin.today.protein),
      water: side(ctx.twin.today.water),
    },
  };
}
