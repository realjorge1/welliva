/**
 * DEEP DIVE — the reading behind a coach reply.
 *
 * Gozlin answers in one to four sentences. That is doctrine, not a limitation:
 * a coach who lectures gets skimmed, and the whole system prompt is built
 * around getting to the point. But short answers hide their reasoning, and the
 * question people actually have after a good one is "…why, though?"
 *
 * This is that answer, and it is a DIFFERENT KIND of writing, so it does not
 * live in the conversation:
 *
 *   THE CHAT is about YOU. Every figure in it comes from your logs and is
 *   checked against them (./grounding.ts) before it can be shown.
 *
 *   A DEEP DIVE is about the SUBJECT. Effect sizes, mechanisms, what the
 *   literature converges on and where it doesn't — general knowledge, which by
 *   definition is not in your logs.
 *
 * WHY GROUNDING IS NOT APPLIED HERE, AND WHY THAT IS SAFE.
 *
 * `validateNumbers` asks one question: "did this figure come from this user's
 * evidence?" For a dive into the research the honest answer is no — and it
 * SHOULD be no. Running the check anyway would reject every real citation and
 * fall the feature back to boilerplate, which is how a safety rail turns into a
 * broken feature. So the protections are re-pointed rather than dropped:
 *
 *  1. The dive is rendered on its OWN surface, labelled as general research
 *     rather than as your data (components/gozlin/DeepDiveReader.tsx). It is
 *     never a coach message, never in the thread, and never persisted as one.
 *  2. The prompt forbids inventing the USER's numbers outright — personal
 *     figures may only be repeated from the state block it is given.
 *  3. Fabricating a citation is forbidden. Naming a real consensus body or
 *     describing what the literature generally finds is allowed; inventing a
 *     title, an author, a DOI or a link is not. An unverifiable citation is
 *     worse than none — it launders a guess as a fact.
 *  4. `screenOutput` still runs (./outputSafety.ts). Grounding asks whether the
 *     numbers are real; output safety asks whether the ADVICE is safe to act
 *     on, and that question does not change because the subject is general.
 *  5. The clinical screen already ran on the question that produced the reply
 *     this expands, and the same "not a doctor" rules are restated below.
 *
 * The transport is injected, exactly as in ./GozlinAgent.ts — services/api
 * imports services/gozlin, so reaching the other way would close a cycle.
 */

import type { GozlinChatContext } from "../GozlinChatEngine";
import type { GozlinTwin } from "../gozlin.types";
import { twinStateMessage, type WireMessage } from "./context";
import type { CoachTransport, ContentBlock } from "./GozlinAgent";
import { recordOutputScreen, screenOutput } from "./outputSafety";

/**
 * The mode flag sent alongside the messages. The backend may use it to raise
 * `max_tokens` for this one call; a server that ignores it still returns a
 * usable (if shorter) dive, so this is an optimisation and never a dependency.
 */
export const DEEP_DIVE_MODE = "deep-dive";

/**
 * The instruction, as a `role: "system"` message.
 *
 * It goes in `messages` rather than replacing the app's system prompt because
 * that prompt is the cached shared prefix (see ./context.ts) — rewriting it per
 * call would cost every user the cache. A trailing system message is also the
 * unforgeable channel: nothing the user types can imitate it.
 *
 * It overrides exactly two things from the persona — LENGTH and SHAPE — and
 * restates every safety rule verbatim rather than assuming they carry over.
 */
const DEEP_DIVE_INSTRUCTION = `DEEP DIVE MODE — this one reply only.

The person has read your short answer above and asked for the reading behind it. For this reply, and only this reply, the "one to four sentences, no headings, no lists" rule is replaced by what follows. Everything about safety and about their personal numbers is unchanged.

# What to write
A briefing on the SUBJECT of that answer: the evidence, the mechanism, the numbers the field actually reports, and where it is genuinely unsettled. Write it for an intelligent adult who is not a specialist. 250-400 words. Dense, not padded — every sentence carries a fact, a figure or a consequence. No filler opener, no restatement of what you already said, no closing pep talk.

Include, where the subject supports it:
- What the research converges on, and roughly how strong that consensus is.
- Real effect sizes and figures from the literature — percentages, ranges, doses, timeframes — each with the qualifier that makes it honest ("in trained men", "over 8-12 weeks", "in short trials").
- The mechanism. Why the effect happens at all, in plain language.
- Where the evidence is thin, contested, or drawn from populations unlike them.
- What it changes for someone in their position, in one or two sentences at the end.

# Shape
Use 2-4 short section headings, each on its own line, written as: ## Heading
Use "- " at the start of a line for bullets. Keep paragraphs to 2-4 sentences. No bold, no italics, no tables, no emoji.

# Citations — the hard rule
Attribute claims the way an honest expert does out loud: name a real body ("the ACSM position stand", "WHO guidance"), a real journal, a real and well-known line of work, or describe the literature in general ("meta-analyses consistently find…").

NEVER invent a study title, an author, a year, a journal name, a DOI or a link. If you are not certain a specific paper exists, describe the finding without naming a paper. An invented citation is the worst thing you can produce here: it turns a guess into something the reader will repeat as a fact.

# Their numbers
Figures about THIS PERSON — their calories, protein, weight, streak, adherence, recovery — may only be repeated from the current-state block. Never compute, estimate or extrapolate one. Research figures are general knowledge, not their data; never present the two as the same kind of thing.

# Safety
Unchanged. You are not a doctor, a dietitian of record or a therapist. Do not diagnose, do not interpret symptoms, do not advise on medication or on supplements as treatment. If the subject touches any of that, say plainly that it is a conversation for a professional and cover only the general science around it.`;

export interface DeepDiveInput {
  /** What the user asked, which produced the reply being expanded. */
  question: string;
  /** The coach reply this dive explains. */
  answer: string;
  twin: GozlinTwin;
  /** Optional identity/snapshot, so the state block can carry clinical rules. */
  context?: Pick<GozlinChatContext, "snapshot" | "identity">;
}

export type DeepDiveFailure =
  /** No backend configured, or the network died. Nothing was spent. */
  | "offline"
  /** The model declined, returned nothing, or failed output safety. */
  | "unavailable";

export interface DeepDiveResult {
  ok: boolean;
  /** The dive, in the light markup described above. Present when `ok`. */
  text?: string;
  reason?: DeepDiveFailure;
}

export interface DeepDiveOptions {
  transport?: CoachTransport | null;
  signal?: AbortSignal;
  /** Streamed text, so the sheet fills in rather than sitting on a spinner. */
  onDelta?: (text: string) => void;
}

function textOf(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/**
 * Ask for the reading behind one reply.
 *
 * ONE model call, no tool loop. The dive is about the subject, not about the
 * user's logs — every tool in ./tools.ts reads their history, so none of them
 * has anything to contribute, and a loop would only add latency and the chance
 * of a write the user never asked for.
 */
export async function runDeepDive(
  input: DeepDiveInput,
  opts: DeepDiveOptions = {},
): Promise<DeepDiveResult> {
  const transport = opts.transport;
  // No transport is not a failure of the feature — it is the absence of a
  // backend. Callers must not spend an allowance on it.
  if (!transport) return { ok: false, reason: "offline" };

  const request =
    `I asked: "${input.question.trim()}"\n\n` +
    `You answered: "${input.answer.trim()}"\n\n` +
    "Give me the reading behind that answer.";

  // ONE trailing system block, not two. The volatile channel has a shape
  // contract (see ./context.ts): a system message must follow a user turn and
  // be last or followed by an assistant turn. Two in a row breaks it, so the
  // state and the instruction ride together.
  const state = twinStateMessage(input.twin, input.context);
  const messages: WireMessage[] = [
    { role: "user", content: request },
    { role: "system", content: `${String(state.content)}\n\n${DEEP_DIVE_INSTRUCTION}` },
  ];

  try {
    const res = await transport({
      messages,
      signal: opts.signal,
      onDelta: opts.onDelta,
      mode: DEEP_DIVE_MODE,
    });

    if (res.stop_reason === "refusal") return { ok: false, reason: "unavailable" };

    const text = textOf(res.content ?? []);
    if (!text) return { ok: false, reason: "unavailable" };

    // Output safety, same rail as the chat. There is no regeneration here: a
    // dive is a bonus surface, and showing nothing is an acceptable outcome
    // where showing unsafe advice is not.
    const risk = screenOutput(text);
    recordOutputScreen(risk);
    if (risk) return { ok: false, reason: "unavailable" };

    return { ok: true, text };
  } catch {
    return { ok: false, reason: "offline" };
  }
}
