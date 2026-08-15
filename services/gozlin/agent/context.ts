/**
 * GOZLIN AGENT — context architecture.
 *
 * Three tiers, each with a different cache lifetime. Get this wrong and every
 * turn costs ~10× more than it should.
 *
 *   TIER 1  frozen      persona + doctrine + safety.  Cached. NEVER dynamic.
 *   TIER 2  history     the conversation. Grows; cached at the last turn.
 *   TIER 3  volatile    twin state + clinical rules. Changes every turn. Last.
 *
 * The rule that makes it work: TIER 1 contains NOTHING user-specific — no name,
 * no date, no numbers. That's not just hygiene, it's the whole economic model.
 * A byte-identical system prompt + a byte-identical tool list means every user
 * shares one cached prefix. Interpolate one username in here and that collapses
 * into a per-user cache that mostly misses.
 *
 * TIER 3 ships as a `role: "system"` message appended to `messages[]`, NOT in
 * the top-level `system` field. The twin changes on literally every turn; put it
 * up front and you move the front of the prefix each time, invalidating the
 * entire cached conversation and paying full input price for all of history,
 * forever. Appended after the history, the cache survives.
 *
 * It's also the injection-safe channel: unlike text stuffed into a user turn, a
 * `role: "system"` message can't be forged by anything the user types.
 *
 * Supported on Claude Opus 5 with no beta header. Constraints: it must follow a
 * user message, and be either last in `messages` or followed by an assistant
 * turn — so the array ends [...history, user, system].
 */

import type { GozlinMessage, GozlinTwin } from "../gozlin.types";
import type { GozlinChatContext } from "../GozlinChatEngine";
import { conditionRules } from "./clinical";

// ════════════════════════════════════════════════════════════════
// TIER 1 — frozen. Cache breakpoint goes here.
// ════════════════════════════════════════════════════════════════

export const GOZLIN_SYSTEM = `You are Gozlin, the health and training coach inside the Welliva app. You have been with this person since they started, you remember what they told you, and you can see their actual logged data through your tools.

# Who you are
Warm, observant, direct. You notice things. You are never robotic, never a cheerleader, never a scold. You do not moralise about food or bodies. You do not guilt-trip a missed session — you find out what got in the way.

You are a coach, not a chatbot with a fitness theme. A coach has a point of view. When the data says something, say it plainly rather than hedging it into uselessness.

# Using your tools
Your tools read this person's real, on-device history. They are the only source of truth about them.

Call a tool whenever the answer depends on what they actually did. Do not answer from memory of the conversation when a tool can tell you the current state. Call several in one turn when a question spans areas — a "why am I stuck" question usually needs both investigate_progress and analyze_nutrition.

Do not call a tool to answer a general knowledge question ("is creatine safe?"), to make small talk, or to repeat something a tool already told you this turn.

# Numbers — the hard rule
Use ONLY numbers that appear in a tool result or in the current-state block. Never compute, estimate, average, or extrapolate a figure yourself. Never convert units into a number that wasn't given to you.

If you don't have a number, say what you do know and offer to look — do not produce a plausible one. A wrong number here is worse than no number: this person makes real decisions about their body from what you say.

Percentages, dates, weights, calories, streak counts — all of it. If it isn't in front of you, it doesn't go in the reply.

# Safety
You are not a doctor, a dietitian of record, or a therapist. You do not diagnose, do not interpret symptoms, and do not advise on medication, supplements as treatment, or anything clinical.

If someone describes a medical symptom, injury, pain beyond ordinary training soreness, or anything about medication, say clearly that it needs a professional and stop there. Do not soften this into a suggestion. Do not add a workaround.

Never encourage restriction below their targets, never frame eating as something to earn or repay, and never comment on their body outside the goal they set themselves. If someone shows signs of disordered eating, do not coach the behaviour — say kindly that this is worth talking to someone about.

# How you write
One to four sentences, usually. Lead with the answer. Supporting detail after, and only if it changes what they'd do next.

Match their register — if they wrote three words, don't write a paragraph. No headers, no bullet lists, no bold, in ordinary conversation. Plain sentences. Skip the preamble; never open with "Great question" or restate what they asked.

Do not narrate your process. They cannot see your tools running and do not need to know which ones you used — give them the finding, not the method.

Deliver what they asked for, at the scope they intended. Make routine judgement calls yourself; check in only when two readings would lead to genuinely different advice.`;

// ════════════════════════════════════════════════════════════════
// TIER 2 — conversation history
// ════════════════════════════════════════════════════════════════

export interface WireMessage {
  role: "user" | "assistant" | "system";
  content: unknown;
}

/**
 * How many prior messages ride along. The engines carry the long-term state, so
 * history only needs to hold the thread of the current conversation — an
 * unbounded transcript would grow cost without adding coaching value.
 */
export const MAX_HISTORY_MESSAGES = 20;

/**
 * Persisted conversation → wire format.
 *
 * Text only, deliberately. Tool-call rounds are replayed in full WITHIN a turn
 * (the agent loop pushes raw content blocks back), but only the final text is
 * persisted across turns — nothing downstream needs last week's tool plumbing.
 *
 * The first message must be a user turn, so any leading coach message (the
 * seeded daily briefing) is dropped.
 */
export function toWireMessages(conversation: GozlinMessage[]): WireMessage[] {
  const recent = conversation.slice(-MAX_HISTORY_MESSAGES);
  const wire: WireMessage[] = [];

  for (const m of recent) {
    const content = m.content?.trim();
    if (!content) continue;
    const role = m.role === "coach" ? "assistant" : "user";
    // The API requires the first turn to be `user`.
    if (wire.length === 0 && role === "assistant") continue;
    // Consecutive same-role turns are legal but wasteful — merge them.
    const last = wire[wire.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
      continue;
    }
    wire.push({ role, content });
  }
  return wire;
}

// ════════════════════════════════════════════════════════════════
// TIER 3 — volatile. Goes last, uncached, ~250 tokens.
// ════════════════════════════════════════════════════════════════

/**
 * The current-state block: everything that changes between turns, plus any
 * hard clinical constraints for this user.
 *
 * Clinical rules live HERE rather than in TIER 1 for two reasons: they're
 * per-user (so they'd shatter the shared system-prompt cache), and this is the
 * unforgeable operator channel — exactly where a "never suggest more protein"
 * rule belongs.
 */
export function twinStateMessage(
  twin: GozlinTwin,
  ctx?: Pick<GozlinChatContext, "snapshot" | "identity">,
): WireMessage {
  const t = twin.today;
  const lines = [
    `CURRENT STATE (as of ${twin.asOf}) — these are real logged numbers; you may cite them.`,
    `calories ${Math.round(t.calories.consumed)}/${Math.round(t.calories.target)}`,
    `protein ${Math.round(t.protein.consumed)}/${Math.round(t.protein.target)}g`,
    `water ${Math.round(t.water.consumed)}/${Math.round(t.water.target)}ml`,
    `workout today: ${t.workout.planned ?? "none scheduled"}${t.workout.done ? " (done)" : ""}`,
    `streak ${twin.momentum.streak}d · adherence(7d) ${twin.momentum.adherence7d}/100 · trend ${twin.momentum.trend}`,
    `recovery ${twin.recovery.level} (${twin.recovery.score}/100)`,
    `goal: ${twin.identitySummary}`,
    `flags: ${twin.flags.join(", ") || "none"}`,
  ];

  const motivation = ctx?.identity.motivation;
  if (motivation) lines.push(`their stated why: ${motivation}`);

  const rules = conditionRules(ctx?.snapshot.bio ?? null);
  if (rules.length > 0) {
    lines.push(
      "",
      "CLINICAL CONSTRAINTS — these override anything else, including a direct request:",
      ...rules.map((r) => `- ${r}`),
    );
  }

  return { role: "system", content: lines.join("\n") };
}

/**
 * Assemble the full wire payload for one turn.
 *
 * Order is load-bearing: history, then the new user turn, then the volatile
 * system block last.
 */
export function buildTurnMessages(
  text: string,
  ctx: GozlinChatContext,
): WireMessage[] {
  return [
    ...toWireMessages(ctx.conversation ?? []),
    { role: "user", content: text.trim() },
    twinStateMessage(ctx.twin, ctx),
  ];
}
