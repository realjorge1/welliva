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
import { crossReference, type HabitTrackerBrief } from "../GozlinTrackerHabits";
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

# Their habits
This person keeps a habit tracker. What is in it is what they told you they want to be doing, in their own words — it is worth more than anything you could infer, and it is the only part of their routine they chose out loud.

The current-state block lists what they track and how it is going, and sometimes flags one thing from it that connects to what they just said. When it does:

- Weave it into your answer where it belongs. It is a reason your advice is what it is, not a postscript. Never open with it, never make it the whole reply.
- Always attach something they can do. An observation with no next step is just being watched.
- Say it once. If it is already in this conversation, it is said.
- Never scold, never tally, never imply they owe you an explanation.

When a habit they used to keep is flagged, do not ask why they stopped — that asks them to defend themselves. Say what the record shows, when it ended, and offer a reason they can accept or correct: "you were reading almost every day for two months and it stopped in August — was it the evenings getting busy?" Then let them answer. Do not chase it, do not raise it twice, and drop it entirely if they change the subject.

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
  ctx?: Pick<GozlinChatContext, "snapshot" | "identity" | "habits">,
  /** The message being answered — enables the habit cross-reference. */
  userText?: string,
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

  if (ctx?.habits) {
    lines.push(...habitLines(ctx.habits));
    if (userText) lines.push(...crossReferenceLines(userText, ctx.habits, twin.asOf));
  }

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
 * The tracker's own habits, compressed to a few lines.
 *
 * Only what a coach would actually cite: the name, the target, how the week is
 * going, and whether anything was recently missed. Capped at six habits and one
 * line each — this block is UNCACHED and paid for on every single turn, so it
 * earns its tokens or it does not go in.
 *
 * Retired habits are listed too, and separately, because they are a different
 * kind of fact: not something to nudge about, something to remember.
 */
function habitLines(brief: HabitTrackerBrief): string[] {
  const lines: string[] = [];

  const tracked = brief.tracked.slice(0, 6);
  if (tracked.length > 0) {
    lines.push("", "HABITS THEY TRACK (their own words, their own targets):");
    for (const t of tracked) {
      const bits = [`${t.frequency}`, `${t.weekDone}/${t.weekTarget} this week`];
      if (t.streak > 0) bits.push(`${t.streak}-${t.streakUnit} streak`);
      bits.push(`${t.last30Pct}% over 30d`);
      if (t.recentMisses.length > 0) bits.push(`missed ${t.recentMisses.length} recently`);
      lines.push(`- ${t.name}: ${bits.join(" · ")}`);
    }
  }

  // Only habits that were REAL and are recent enough to still be live history.
  // A two-day experiment abandoned in March is not something to bring up.
  const retired = brief.retired.filter((r) => r.wasConsistent && r.daysSince <= 180).slice(0, 4);
  if (retired.length > 0) {
    lines.push(
      "",
      "HABITS THEY USED TO KEEP (they stopped tracking these; the record stands):",
    );
    for (const r of retired) {
      lines.push(
        `- ${r.name}: ${r.summary}, ${r.totalDone} days total, best run ${r.bestStreak} ${r.streakUnit}s — stopped ${r.retiredOn} (${r.daysSince} days ago)`,
      );
    }
  }

  return lines;
}

/**
 * The cross-reference: one fact from their own history that connects to the
 * message they just sent.
 *
 * It arrives as an INSTRUCTION, not as data, because the failure mode is not
 * the model missing it — it is the model reciting it. Left as a bare fact in a
 * state block, a note like "missed vitamins Thursday" gets read as something to
 * report; framed as a condition ("only if it fits, and always with a fix"), it
 * gets used the way a coach would use it. The engine chose it, the engine's
 * numbers are the only ones in it, and the model decides whether it belongs in
 * the sentence at all.
 */
function crossReferenceLines(
  text: string,
  brief: HabitTrackerBrief,
  today: string,
): string[] {
  const ref = crossReference(text, brief, today);
  if (!ref) return [];

  const howToUse =
    ref.kind === "streak"
      ? "Acknowledge it in passing and build the advice on top of it — they are already doing this, so do not tell them to start."
      : "Connect it to what they asked, and offer one concrete way to make it easier. Not a reprimand.";

  return [
    "",
    "CONNECTED TO WHAT THEY JUST SAID — you may raise this once, if it genuinely fits:",
    ref.evidence,
    howToUse,
    "If it does not fit the reply naturally, leave it out entirely. Never list it as an aside.",
  ];
}

/**
 * Exactly what the habit half of the state block put in front of the model.
 *
 * The grounding gate only lets the model quote numbers it was actually given,
 * and it builds that set from the same objects this file renders. So the two
 * have to be read from ONE place: if the block says "12-day streak" and the
 * allowed-set was built without it, the reply gets rejected as invented and the
 * user watches a correct sentence get thrown away. Calling this from both sides
 * is what keeps them from drifting — it is pure and deterministic, so the
 * second call is free and cannot disagree with the first.
 */
export function habitEvidence(
  text: string,
  ctx: Pick<GozlinChatContext, "habits" | "twin">,
): { habits: HabitTrackerBrief | null; link: unknown } {
  if (!ctx.habits) return { habits: null, link: null };
  return {
    habits: ctx.habits,
    link: crossReference(text, ctx.habits, ctx.twin.asOf),
  };
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
    // The user's text is handed to the state block as well as sent as the turn:
    // the cross-reference is chosen FROM what they said, and it has to travel
    // on the system channel, where nothing typed into the chat can forge it.
    twinStateMessage(ctx.twin, ctx, text),
  ];
}
