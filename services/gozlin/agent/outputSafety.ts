/**
 * GOZLIN AGENT — output safety.
 *
 * The gap this closes. There were two gates on a coach reply and neither looked
 * at the ADVICE:
 *
 *   · screenForClinicalRisk() reads the user's message, before the model runs.
 *   · validateNumbers() reads the reply, but only asks whether its figures were
 *     invented.
 *
 * So a reply saying "skip dinner and you'll be under by 400" passed both — the
 * 400 was real, and the user's question ("how do I hit my deficit?") tripped no
 * clinical pattern. Grounding proves a number is true. It says nothing about
 * whether acting on the sentence around it is safe.
 *
 * THE DOCTRINE, APPLIED WHERE IT WAS MISSING. grounding.ts states it plainly:
 * prompting reduces a rate, architecture sets a floor. The system prompt
 * already forbids all of this, and prompts mostly hold — but "mostly" is a rate,
 * and for restriction advice to a vulnerable user the acceptable rate is not a
 * rate at all. So the same shape used for numbers is used here: check the
 * output, regenerate once with a specific correction, then fall to a
 * deterministic reply that cannot be wrong.
 *
 * WHY THIS IS DELIBERATELY NARROW. Every pattern below targets an ACTION the
 * coach is telling someone to take. It does not police tone, vocabulary, or
 * mentions of food and bodies — a coach that cannot say "protein" or "weight"
 * is useless, and a gate that fires on ordinary coaching gets switched off by
 * whoever maintains it. False positives cost one regeneration; that budget is
 * spent on instructions, not on words.
 *
 * NOT A SUBSTITUTE FOR THE SERVER. This runs on-device against the finished
 * text. A model-based classifier on the backend would generalise far better and
 * should still be added — see docs. This is the floor beneath it, and it works
 * offline, which the server-side one never will.
 */

export type OutputRiskKind =
  | "restriction" // told to eat less / skip / fast
  | "compensation" // food framed as earned, owed, or burned off
  | "diagnosis" // asserts what a symptom or sign means
  | "medication" // advises on drugs or supplements-as-treatment
  | "body_comment"; // judges the body rather than the behaviour

export interface OutputRisk {
  kind: OutputRiskKind;
  /** The phrase that tripped it — logged, never shown to the user. */
  matched: string;
  /** What to tell the model when regenerating. Specific, not a scolding. */
  correction: string;
}

interface Rule {
  kind: OutputRiskKind;
  pattern: RegExp;
  correction: string;
}

/**
 * Ordered by severity. Restriction first: it is the one that does harm fastest
 * and the one a well-meaning coaching model produces most readily.
 */
const RULES: Rule[] = [
  {
    kind: "restriction",
    // Instructions to eat less, skip, or fast. Anchored to imperative/advisory
    // forms so a factual observation ("you ate 300 under today") doesn't trip.
    pattern:
      /\b(?:you (?:should|could|can|might want to)|try(?:ing)? to|consider|i'?d suggest|why not|just)\s+(?:\w+\s+){0,3}?(?:skip(?:ping)?|miss(?:ing)?|drop(?:ping)?|cut(?:ting)?\s+out|fast(?:ing)?(?:\s+(?:for|through|until))?|go without|starve)\s+(?:\w+\s+){0,2}?(?:breakfast|lunch|dinner|a meal|meals|eating|food|dinner tonight)\b|\b(?:eat|stay)\s+(?:under|below)\s+\d{3,4}\b|\bskip (?:breakfast|lunch|dinner|a meal|meals)\b|\b(?:cut|drop) (?:your )?calories (?:to|down to) \d{3,4}\b/i,
    correction:
      "Your last reply told this person to eat less, skip a meal, or fast. Never do that: " +
      "their targets are already set from their body and goal, and advising below them is unsafe. " +
      "Rewrite it without any instruction to restrict, skip, or delay eating.",
  },
  {
    kind: "compensation",
    // Food as debt: earned, owed, worked off, cancelled out.
    pattern:
      /\b(?:burn (?:that|it|those|them|this) off|work (?:that|it|those|them) off|earn(?:ed)? (?:your|that|those|it)?\s*(?:meal|dinner|lunch|breakfast|calories|treat|food)|make up for (?:that|it|those|eating|the)|cancel(?:l?ed|l?ing)? (?:that|it|those) out|offset (?:that|those|it)|pay(?:ing)? (?:that|it|those) (?:back|off)|deserve (?:that|it|those) (?:meal|treat|after))\b/i,
    correction:
      "Your last reply framed food as something to earn, repay, or burn off. Never do that — " +
      "it is the core thought pattern in disordered eating, and it is wrong on its own terms: " +
      "eating is not a debt. Rewrite it without any earning, offsetting, or compensating framing.",
  },
  {
    kind: "diagnosis",
    // Asserting what a sign or symptom means.
    pattern:
      // Three shapes, because the condition word sits in a different place in
      // each: it IS the claim (1), it follows a possession verb (2), or it
      // trails a hedge (3). The old single pattern only handled (3), which
      // silently made the commonest form — "you're probably deficient" —
      // unmatchable, since there was no condition word left after the trigger.
      /\b(?:you'?re|you are)\s+(?:probably|likely|possibly|maybe)?\s*(?:deficient|an?a?emic|insulin[\s-]?resistant|hypothyroid|hyperthyroid|pre-?diabetic|diabetic|inflamed)\b|\byou (?:probably|likely|may|might) have\b|\b(?:that|this|it|the \w+)\s+(?:sounds like|could be|might be|is probably|is likely|points to)\b[^.!?]{0,60}?\b(?:deficien\w*|an?a?emi\w*|thyroid|diabet\w*|insulin|infection|inflammation|syndrome|disorder|condition|imbalance)\b/i,
    correction:
      "Your last reply suggested what a symptom or sign means clinically. You do not diagnose, " +
      "and you do not speculate about conditions or deficiencies. Rewrite it saying plainly that " +
      "this needs a clinician, and offer only what their own logs show.",
  },
  {
    kind: "medication",
    // Advising on drugs or supplements as treatment.
    pattern:
      /\b(?:you (?:should|could|might)\s+(?:\w+\s+){0,2}?(?:take|start|stop|skip|double|halve|increase|reduce)\s+(?:\w+\s+){0,2}?(?:your\s+)?(?:medication|meds|insulin|metformin|statin|antidepressant|thyroid|supplement|creatine|melatonin|iron|magnesium)|\btry (?:taking |some )?(?:creatine|melatonin|ashwagandha|berberine|iron|magnesium|zinc|a supplement)\b|\b\d+\s*(?:mg|mcg|iu)\b(?:(?!\s*(?:of )?(?:sodium|caffeine in|protein)).){0,20}?\b(?:daily|a day|per day|each day)\b)/i,
    correction:
      "Your last reply advised on medication or a supplement as treatment. You never do that — " +
      "not dosage, not timing, not starting or stopping, and not recommending one. Rewrite it " +
      "deferring that entirely to their prescriber or pharmacist.",
  },
  {
    kind: "body_comment",
    // Judging the body rather than the behaviour.
    pattern:
      /\b(?:you'?d look (?:better|great|amazing)|(?:once|when) you (?:slim|lean|trim) down|your (?:belly|gut|stomach|thighs|arms) (?:is|are|looks?)\s+(?:too |a bit |quite )?(?:big|large|soft|flabby|heavy)|you'?re carrying (?:too much|a lot of) (?:weight|fat)|(?:need|have) to lose (?:that|the) (?:belly|gut|weight) (?:before|first))\b/i,
    correction:
      "Your last reply commented on this person's body rather than on what they did. Never do " +
      "that, whatever their goal is. Rewrite it about the behaviour and the data only.",
  },
];

/**
 * Screen a generated reply. Returns the first risk found, or null.
 *
 * First rather than all: the caller regenerates on any hit, and one specific
 * correction produces a better rewrite than five stacked ones.
 */
export function screenOutput(reply: string): OutputRisk | null {
  const text = reply.trim();
  if (!text) return null;

  for (const rule of RULES) {
    const m = rule.pattern.exec(text);
    if (m) {
      return { kind: rule.kind, matched: m[0], correction: rule.correction };
    }
  }
  return null;
}

/**
 * The reply sent when regeneration also fails.
 *
 * Deterministic and deliberately plain. It does not pretend nothing happened,
 * and it does not confess to a filter either — it redirects to the one thing
 * that is always safe to offer, which is the user's own data.
 */
export const OUTPUT_FALLBACK: Record<OutputRiskKind, string> = {
  restriction:
    "Let me stay on what your logs actually show rather than pushing your intake around — " +
    "your targets are already set for your body and goal. Ask me what your numbers are doing " +
    "and I'll walk you through them.",
  compensation:
    "I don't think about food as something to earn or pay back, so let me answer that a different way — " +
    "tell me what you want to change and I'll look at what your logs say about it.",
  diagnosis:
    "That's outside what I can read from your training and nutrition data — it needs someone who can " +
    "actually examine you. Tell me any limits they give you and I'll build around them.",
  medication:
    "I don't advise on medication or supplements. That's between you and your prescriber or pharmacist. " +
    "Tell me any restrictions they set and I'll fit your plan around them.",
  body_comment:
    "Let me stick to what you did rather than how you look — that's the part I can actually help with. " +
    "Ask me about your training or your intake and I'll show you where you are.",
};

// ── Telemetry ──────────────────────────────────────────────────────────
//
// Counted in-process, exactly like grounding's. A rising rate here means the
// system prompt has drifted or the model changed underneath us, and that is
// worth knowing before a user reports it. Nothing leaves the device.

let screened = 0;
const byKind: Record<string, number> = {};

export function recordOutputScreen(risk: OutputRisk | null): void {
  screened++;
  if (risk) byKind[risk.kind] = (byKind[risk.kind] ?? 0) + 1;
}

export function outputSafetyStats(): {
  screened: number;
  flagged: number;
  byKind: Record<string, number>;
} {
  const flagged = Object.values(byKind).reduce((a, b) => a + b, 0);
  return { screened, flagged, byKind: { ...byKind } };
}

export function resetOutputSafetyStats(): void {
  screened = 0;
  for (const k of Object.keys(byKind)) delete byKind[k];
}
