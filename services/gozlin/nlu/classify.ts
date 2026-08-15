/**
 * GOZLIN NLU — scored multi-label intent classification.
 *
 * Replaces the ordered first-match regex table. That table had five structural
 * problems, and every one of them was a misroute a user could feel:
 *
 *   order dependence  the first pattern that matched won, so "tune my macros"
 *                     hit `adapt_workout` purely because it was listed earlier.
 *   no typo tolerance "platuea" fell through to smalltalk.
 *   no negation       "I'm NOT stuck" scored identically to "I'm stuck".
 *   single label      "I always eat too much protein" is habits AND nutrition;
 *                     one of them was silently dropped.
 *   no abstain        everything unmatched became "smalltalk", which answered
 *                     with a canned deflection rather than admitting confusion.
 *
 * The replacement scores every intent, never early-exits, and can say it
 * doesn't know. A coach who asks a clarifying question reads as attentive; a
 * coach who confidently answers the wrong question reads as broken.
 *
 * This is now the OFFLINE path only — online, the model picks tools directly
 * (services/gozlin/agent). Which raises the bar rather than lowering it: this
 * is the fallback for a much better experience, so it has to be good.
 */

import type { GozlinIntent } from "../GozlinChatEngine";
import { SIGNALS, type IntentSignal } from "./lexicon";
import { detectLanguage, type DetectedLanguage } from "./language";

// ── Tuning ─────────────────────────────────────────────────────────
//
// Calibrated against __tests__/fixtures.ts. Moving these without re-running
// that suite is how you get a confidently-wrong classifier.

/** Below this, we admit we didn't understand rather than guess. */
const ABSTAIN_THRESHOLD = 1.15;
/** Top and runner-up closer than this are not meaningfully distinguishable. */
const MARGIN = 0.55;
/** A runner-up above this is a genuine second intent, not noise. */
const MULTI_THRESHOLD = 2.6;
/**
 * Trigram Jaccard at or above this counts as the same word.
 *
 * 0.45 rather than the more intuitive 0.6 because trigram Jaccard is harsh on
 * short words: a single substitution in a 7-letter word only scores ~0.45, so a
 * 0.6 floor means no typo tolerance at all below about twelve characters. It's
 * still comfortably above the classic false-positive pair (stuck/stick, 0.33).
 */
const SIMILARITY_FLOOR = 0.45;
/** How far a negator's scope reaches, in tokens. */
const NEGATION_WINDOW = 4;
/**
 * Per-token positional penalty. Deliberately gentle: at 0.1 a term nine words
 * in loses 47% of its weight, which was enough to make "my sleep is bad and my
 * macros are off" read as a single-intent sleep question.
 */
const POSITION_DECAY = 0.06;

// ── Normalization ──────────────────────────────────────────────────

/**
 * Lowercase, fold accents, drop apostrophes, strip punctuation.
 *
 * Apostrophes go BEFORE punctuation splitting so "isn't" becomes "isnt" rather
 * than "isn t" — the lexicon's phrases are written the same way.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light suffix stripping. Only fires when the stem stays ≥ 4 characters, which
 * keeps "losing" intact (→ "los" would collide with everything) while still
 * folding "workouts" → "workout" and "stalled" → "stall".
 */
export function stem(word: string): string {
  for (const suffix of ["ing", "ed", "s"]) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

export function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

// ── Fuzzy matching ─────────────────────────────────────────────────

/**
 * Padded character trigrams. Cheaper than Levenshtein, and more forgiving of
 * transpositions — which is most of what real typing errors are.
 */
export function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

const TRIGRAM_CACHE = new Map<string, Set<string>>();
function cachedTrigrams(s: string): Set<string> {
  let t = TRIGRAM_CACHE.get(s);
  if (!t) {
    t = trigrams(s);
    TRIGRAM_CACHE.set(s, t);
  }
  return t;
}

/** Jaccard overlap of trigram sets, 0–1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = cachedTrigrams(a);
  const B = cachedTrigrams(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── Pre-stemmed lexicon ────────────────────────────────────────────
//
// Both sides go through the same stemmer at load, so a lexicon entry can never
// drift out of reach of the tokens it's meant to catch.

interface PreparedSignal {
  intent: GozlinIntent;
  terms: { key: string; weight: number }[];
  phrases: { text: string; weight: number }[];
}

const PREPARED: PreparedSignal[] = SIGNALS.map((s: IntentSignal) => ({
  intent: s.intent,
  terms: Object.entries(s.terms).map(([k, weight]) => ({ key: stem(normalize(k)), weight })),
  phrases: Object.entries(s.phrases ?? {}).map(([text, weight]) => ({
    text: normalize(text),
    weight,
  })),
}));

// ── Spelling correction ────────────────────────────────────────────
//
// Fuzzy TERM matching alone isn't enough, because phrases are matched as exact
// substrings — one typo anywhere in "should I train" and the phrase, which is
// the strongest signal we have, contributes nothing. So the input is corrected
// against the lexicon's own vocabulary BEFORE either kind of matching runs.
//
// This only ever maps an unknown word onto a word we already care about, so it
// cannot invent signal: a token with no close lexicon match is left untouched.

const VOCAB: string[] = [
  ...new Set(
    SIGNALS.flatMap((s) => [
      ...Object.keys(s.terms).map((k) => normalize(k)),
      ...Object.keys(s.phrases ?? {}).flatMap((p) => normalize(p).split(" ")),
    ]),
  ),
].filter((w) => w.length >= 3);

const VOCAB_SET = new Set(VOCAB);

function correctToken(token: string): string {
  if (token.length < 3 || VOCAB_SET.has(token)) return token;
  let best = token;
  let bestScore = SIMILARITY_FLOOR;
  for (const candidate of VOCAB) {
    // A correction that changes length a lot is a different word, not a typo.
    if (Math.abs(candidate.length - token.length) > 2) continue;
    const sim = similarity(token, candidate);
    if (sim > bestScore) {
      bestScore = sim;
      best = candidate;
    }
  }
  return best;
}

// ── Negation ───────────────────────────────────────────────────────

const NEGATORS = new Set([
  "not", "dont", "doesnt", "didnt", "no", "never", "isnt", "arent",
  "wasnt", "wont", "cant", "cannot", "stop", "without", "havent", "hasnt",
]);

/**
 * Sign per token position: -1 inside a negator's scope, +1 otherwise.
 *
 * Scope is a fixed forward window rather than a parse. It's crude, and it fixes
 * a whole class of misreads for the cost of about ten lines.
 */
export function negationSigns(tokens: string[]): number[] {
  const signs = new Array(tokens.length).fill(1);
  for (let i = 0; i < tokens.length; i++) {
    if (!NEGATORS.has(tokens[i])) continue;
    for (let j = i + 1; j <= Math.min(i + NEGATION_WINDOW, tokens.length - 1); j++) {
      signs[j] = -1;
    }
  }
  return signs;
}

// ── Scoring ────────────────────────────────────────────────────────

/** Terms early in a sentence carry the ask; later ones are usually qualifiers. */
const positionDecay = (index: number) => 1 / (1 + POSITION_DECAY * index);

export interface ScoredIntent {
  intent: GozlinIntent;
  score: number;
}

export function scoreIntents(text: string): ScoredIntent[] {
  const rawTokens = tokenize(normalize(text));
  // Correct first, then match — so a typo'd word still reaches its phrase.
  const tokens = rawTokens.map(correctToken);
  const normalized = tokens.join(" ");
  const stems = tokens.map(stem);
  const signs = negationSigns(tokens);

  const scored: ScoredIntent[] = PREPARED.map((signal) => {
    let score = 0;

    // Phrases: matched on the whole normalized string. A phrase's position is
    // where it starts, so an opening phrase still outranks a trailing one.
    for (const phrase of signal.phrases) {
      const at = normalized.indexOf(phrase.text);
      if (at < 0) continue;
      const tokenIndex = normalized.slice(0, at).split(" ").filter(Boolean).length;
      // A negator immediately before the phrase flips it ("not stuck").
      const sign = signs[tokenIndex] ?? 1;
      score += phrase.weight * sign * positionDecay(tokenIndex);
    }

    // Terms: best single match per token, so near-duplicate lexicon entries
    // ("macro" and "macros") can't double-count one word.
    for (let i = 0; i < stems.length; i++) {
      let best = 0;
      for (const term of signal.terms) {
        const sim = similarity(stems[i], term.key);
        if (sim < SIMILARITY_FLOOR) continue;
        const value = term.weight * sim;
        if (value > best) best = value;
      }
      if (best > 0) score += best * signs[i] * positionDecay(i);
    }

    return { intent: signal.intent, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ── Decision ───────────────────────────────────────────────────────

export type ClassifyResult =
  | { kind: "single"; intent: GozlinIntent; score: number }
  | { kind: "multi"; intents: GozlinIntent[]; scores: ScoredIntent[] }
  | { kind: "ambiguous"; options: ScoredIntent[] }
  | { kind: "unknown"; topScore: number }
  | { kind: "non_english"; language: DetectedLanguage; apology: string };

/**
 * Classify one utterance.
 *
 * Order matters and differs from the obvious reading: `multi` is checked BEFORE
 * `ambiguous`. Two strong, close scores mean the user asked about both things;
 * two weak, close scores mean we genuinely can't tell which one they meant.
 * Checking margin first would collapse the former into the latter and make us
 * ask a clarifying question about a message that was perfectly clear.
 */
export function classify(text: string): ClassifyResult {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "unknown", topScore: 0 };

  const language = detectLanguage(trimmed);
  if (!language.isEnglish) {
    return {
      kind: "non_english",
      language: language.language,
      apology: language.apology,
    };
  }

  const ranked = scoreIntents(trimmed);
  const top = ranked[0];
  const second = ranked[1];

  if (!top || top.score < ABSTAIN_THRESHOLD) {
    return { kind: "unknown", topScore: top?.score ?? 0 };
  }
  if (second && second.score >= MULTI_THRESHOLD && top.score - second.score < MARGIN) {
    return { kind: "multi", intents: [top.intent, second.intent], scores: [top, second] };
  }
  if (second && top.score - second.score < MARGIN) {
    return { kind: "ambiguous", options: [top, second] };
  }
  return { kind: "single", intent: top.intent, score: top.score };
}

/**
 * Back-compatible single-label entry point.
 *
 * Everything that isn't a confident single intent collapses to "smalltalk",
 * which is exactly what the old classifier returned for those inputs — so any
 * caller still on this signature behaves as it did before.
 *
 * @deprecated Prefer {@link classify}; this discards the ambiguous / multi /
 * unknown distinction, which is most of the point.
 */
export function classifyIntent(text: string): GozlinIntent {
  const result = classify(text);
  return result.kind === "single" ? result.intent : "smalltalk";
}
