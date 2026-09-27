/**
 * GOZLIN AGENT — numeric grounding.
 *
 * A health app that tells someone they're "340 calories over" when the real
 * figure is 120 is not a bug, it's a product-ending failure. Prompting alone
 * doesn't get you there — instructions reduce the rate, they don't floor it.
 *
 * So there are two layers, and only the second one is load-bearing:
 *
 *   1. The system prompt forbids computing figures (see ./context.ts).
 *   2. THIS: every number in the reply is checked against the numbers we
 *      actually handed the model. A mismatch regenerates once, then falls back
 *      to the deterministic reply.
 *
 * Violations are counted, not just logged. That rate is a release gate.
 */

/**
 * Integers at or below this are treated as ordinary language, not claims —
 * "a couple of days", "3 sets", "one more glass". Raising this weakens the
 * gate; lowering it floods you with false positives on normal coaching prose.
 */
const SMALL_INTEGER_CEILING = 10;

/**
 * A tiny slack on the rounding test, so floating-point noise at the exact
 * boundary ("0.3 − 0.2" is 0.0999…) never reads as "within one unit".
 */
const FLOAT_EPSILON = 1e-9;

export interface GroundingResult {
  ok: boolean;
  /** Numbers in the reply with no counterpart in the evidence. */
  violations: number[];
  /** How many numeric claims were checked at all. */
  checked: number;
}

/**
 * Pull every number out of arbitrary evidence (twin state, tool results).
 *
 * Walks objects and arrays, and also mines numbers embedded in strings —
 * engine payloads carry plenty of pre-formatted copy ("0.4 kg/week down",
 * "72/100"), and those figures are legitimately citable.
 */
export function collectAllowedNumbers(evidence: unknown, into?: Set<number>): Set<number> {
  const out = into ?? new Set<number>();

  const visit = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "number") {
      if (Number.isFinite(v)) add(out, v);
      return;
    }
    if (typeof v === "string") {
      for (const n of extractNumbers(v)) add(out, n);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (typeof v === "object") {
      for (const item of Object.values(v as Record<string, unknown>)) visit(item);
    }
  };

  visit(evidence);
  return out;
}

/**
 * The forms one evidence value may legitimately be SPOKEN in, before any
 * rounding: itself; its magnitude, because "0.4 kg down" is how a stored −0.4
 * is said; and, for a rate or fraction, the percentage it is voiced as.
 */
export function spokenForms(v: number): number[] {
  const forms = [v];
  if (v < 0) forms.push(-v);
  const mag = Math.abs(v);
  if (mag > 0 && mag <= 1) forms.push(mag * 100);
  return forms;
}

/**
 * Register a value plus the roundings a coach would naturally speak it as.
 * The engines carry full precision; people say "0.4 kg" and "72%".
 */
function add(set: Set<number>, n: number): void {
  for (const f of spokenForms(n)) {
    set.add(f);
    set.add(Math.round(f));
    set.add(Math.round(f * 10) / 10);
  }
}

/** Decimal places `n` was written with — "82.6" is 1, "83" is 0. */
function decimalsOf(n: number): number {
  const s = String(n);
  if (s.includes("e")) return 0;
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

/**
 * Is `n`, as written, an honest rounding of the evidence value `a`?
 *
 * THIS REPLACED A ±2% / ±1 TOLERANCE, which was loose in exactly the range a
 * coach speaks in. An invented 81 kg passed against a real 82.6 kg (2% of 82.6
 * is 1.65), a computed "6.6 kg to go" passed because a 6-day streak was within
 * one of it, and 42% of invented whole numbers between 11 and 100 matched
 * SOMETHING in a realistic evidence set. Rounding is a precise idea, so it is
 * tested as one:
 *
 *  - At the precision it was WRITTEN in, `n` must be within one unit of `a` —
 *    82.6 may be said "83" or "82" (rounded or truncated), never "81"; 0.4083
 *    may be "0.4"; 1840 may not be "1841", because rounding never adds a digit.
 *  - A whole number ending in zeros may round AT that magnitude — "about 1,800"
 *    for 1,840 — but only in steps no coarser than a tenth of the figure, so
 *    "300" can never stand in for 340 and "2,000" never for 2,200.
 */
export function isRoundingOf(n: number, a: number): boolean {
  if (!Number.isFinite(n) || !Number.isFinite(a)) return false;
  const d = decimalsOf(n);
  if (Math.abs(a - n) < 10 ** -d - FLOAT_EPSILON) return true;
  if (d === 0 && n !== 0) {
    const mag = Math.abs(n);
    for (let step = 10; n % step === 0 && step <= mag / 10; step *= 10) {
      if (Math.abs(a - n) <= step / 2) return true;
    }
  }
  return false;
}

/** Does `n` honestly render the evidence value `v` in any of its spoken forms? */
export function matchesEvidence(n: number, v: number): boolean {
  return spokenForms(v).some((f) => isRoundingOf(n, f));
}

/**
 * Numbers a coach may legitimately say that aren't literally in the payload:
 * the gap between where you are and where you're going. "About 40g to go" is
 * the single most natural line this product produces — banning it would push
 * every reply into stilted phrasing for no safety gain.
 */
export function addDerivedGaps(
  set: Set<number>,
  pairs: { consumed: number; target: number }[],
): void {
  for (const { consumed, target } of pairs) {
    if (!Number.isFinite(consumed) || !Number.isFinite(target)) continue;
    add(set, Math.abs(target - consumed));
    add(set, Math.max(0, target - consumed));
  }
}

/**
 * Numbers the PERSON typed. "I ran 5k in 31 minutes" answered with "31 minutes
 * is a solid 5k" is not an invention — it is listening — and rejecting it
 * regenerated the reply and, twice over, dropped a good answer to the offline
 * classifier. Before this, such an echo passed only when the figure happened to
 * collide with something else in the evidence.
 *
 * Only USER turns, and only the ones actually sent to the model this turn. A
 * coach reply is never a source here: a figure the model said last turn would
 * otherwise launder itself into this turn's evidence.
 *
 * THE TRADE, stated rather than hidden: a user who writes "am I 340 over?" makes
 * 340 citable. The prompt still requires their own figures to be presented as
 * theirs and never as what the logs show, the state block carries the real
 * figure right beside it, and the gate's job is to stop the model INVENTING —
 * which repeating a number back is not.
 *
 * These deliberately get NO receipt (see the agent loop). The trail under a
 * reply says "FROM YOUR LOGS", and a number the user just typed is not that.
 */
export function addUserStatedNumbers(set: Set<number>, texts: string[]): void {
  for (const text of texts) {
    for (const n of extractNumbers(text)) add(set, n);
  }
}

/** One numeric claim in a text: its value and exactly where it was written. */
export interface NumberSpan {
  value: number;
  start: number;
  end: number;
  kind: "digits" | "words";
}

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

/**
 * Things written with digits that are not numeric claims, blanked to spaces of
 * the SAME LENGTH so every span keeps its true position in the original text.
 */
const NOT_CLAIMS: RegExp[] = [
  // ISO dates and datetimes — "2026-07-26", "2026-09-27T15:10:00+01:00".
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,
  // Written dates — "Sep 27", "27 September 2026", "the 3rd of March".
  new RegExp(String.raw`\b${MONTH}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b`, "gi"),
  new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\.?(?:,?\s+\d{4})?\b`, "gi"),
  /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, // clock times
  /\b\d{1,2}\s*(?:am|pm)\b/gi, // bare hours
  /\b\d+(?:st|nd|rd|th)\b/gi, // ordinals
  /\bcovid-?19\b/gi,
];

/**
 * Digits, with thousands separators read as ONE figure. The coach writes
 * "1,840" — it is how anyone writes a calorie count — and reading that as the
 * two claims "1" and "840" failed every reply that cited a four-digit figure
 * the ordinary way, then told the model it had written an "840" it never
 * wrote. Same pattern as components/gozlin/ReceiptText.tsx `segmentReply`, so
 * the gate and the trail agree on what a number is. Only exact three-digit
 * groups qualify, so a list like "3,4,5" is left alone.
 */
const DIGITS = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

const UNIT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS_WORDS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALE_WORDS: Record<string, number> = { hundred: 100, thousand: 1000 };
const ORDINAL_WORD =
  /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\w+teenth|\w+tieth|hundredth|thousandth)$/;

/**
 * Numbers written as WORDS — "three hundred and forty", "sixty-four".
 *
 * Without this the whole gate could be walked around by spelling: the model
 * told to drop an invented "340" could write "three hundred and forty" and
 * pass, and nothing else would notice. Cardinals only, with the joins English
 * actually uses (spaces, hyphens, "and"); "a" counts only in front of a scale
 * ("a hundred"), and a run that turns out to be an ordinal ("twenty-seventh")
 * is dropped, the same as "27th" is.
 */
function wordNumberSpans(text: string): NumberSpan[] {
  const words = [...text.matchAll(/[A-Za-z]+/g)].map((m) => ({
    w: m[0].toLowerCase(),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  const joinable = (from: number, to: number) => /^[\s-]*$/.test(text.slice(from, to));
  const isNum = (w: string) => w in UNIT_WORDS || w in TENS_WORDS || w in SCALE_WORDS;

  const spans: NumberSpan[] = [];
  let i = 0;
  while (i < words.length) {
    const first = words[i];
    const next = words[i + 1];
    const leadsWithA =
      (first.w === "a" || first.w === "an") &&
      next !== undefined &&
      next.w in SCALE_WORDS &&
      joinable(first.end, next.start);
    if (!isNum(first.w) && !leadsWithA) {
      i++;
      continue;
    }

    // Collect the run: number words joined by spaces, hyphens, or "and".
    let total = 0;
    let current = leadsWithA ? 1 : 0;
    let last: "unit" | "tens" | "scale" | null = null;
    let j = leadsWithA ? i + 1 : i;
    let endIdx = i;
    for (; j < words.length; j++) {
      const t = words[j];
      if (j > i && !joinable(words[j - 1].end, t.start)) break;
      if (t.w === "and") {
        const after = words[j + 1];
        if (last === "scale" && after && isNum(after.w) && joinable(t.end, after.start)) continue;
        break;
      }
      if (t.w in UNIT_WORDS) {
        if (last === "unit") break; // "one two" is two numbers, not three
        current += UNIT_WORDS[t.w];
        last = "unit";
      } else if (t.w in TENS_WORDS) {
        if (last === "unit" || last === "tens") break;
        current += TENS_WORDS[t.w];
        last = "tens";
      } else if (t.w === "hundred") {
        current = (current || 1) * 100;
        last = "scale";
      } else if (t.w === "thousand") {
        total += (current || 1) * 1000;
        current = 0;
        last = "scale";
      } else {
        break;
      }
      endIdx = j;
    }

    const after = words[endIdx + 1];
    const isOrdinal =
      after !== undefined && ORDINAL_WORD.test(after.w) && joinable(words[endIdx].end, after.start);
    if (!isOrdinal) {
      spans.push({
        value: total + current,
        start: first.start,
        end: words[endIdx].end,
        kind: "words",
      });
    }
    i = Math.max(endIdx + 1, i + 1);
  }
  return spans;
}

/**
 * Every numeric claim in a text, with where it sits, in reading order.
 *
 * Positions matter now: the stream gate (./streamGate.ts) uses them to show a
 * draft only up to the first figure it cannot yet vouch for.
 */
export function numberSpans(text: string): NumberSpan[] {
  let masked = text;
  for (const re of NOT_CLAIMS) {
    masked = masked.replace(re, (m) => " ".repeat(m.length));
  }

  const spans: NumberSpan[] = [];
  for (const m of masked.matchAll(DIGITS)) {
    const value = Number(m[0].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const start = m.index ?? 0;
    spans.push({ value, start, end: start + m[0].length, kind: "digits" });
  }
  spans.push(...wordNumberSpans(masked));
  return spans.sort((a, b) => a.start - b.start);
}

/** Numeric claims in a text, values only, in reading order. */
export function extractNumbers(text: string): number[] {
  return numberSpans(text).map((s) => s.value);
}

/** Is a figure prose rather than a measurement? See SMALL_INTEGER_CEILING. */
export function isProseNumber(n: number): boolean {
  return Number.isInteger(n) && n <= SMALL_INTEGER_CEILING;
}

/** Is `n` accounted for by something we actually gave the model? */
export function isGrounded(n: number, allowed: Set<number>): boolean {
  if (allowed.has(n)) return true;
  for (const a of allowed) {
    if (isRoundingOf(n, a)) return true;
  }
  return false;
}

/**
 * Validate a reply against the evidence available when it was generated.
 *
 * Small integers pass unchecked (see SMALL_INTEGER_CEILING) — they're prose,
 * not measurements.
 */
export function validateNumbers(reply: string, allowed: Set<number>): GroundingResult {
  const violations: number[] = [];
  let checked = 0;

  for (const n of extractNumbers(reply)) {
    if (isProseNumber(n)) continue;
    checked++;
    if (!isGrounded(n, allowed)) violations.push(n);
  }

  return { ok: violations.length === 0, violations, checked };
}

// ── Violation telemetry ────────────────────────────────────────────
//
// Counted in-process so the release gate has a number to read. Deliberately
// not wired to any network sink — nothing about a user's figures leaves here.

let totalReplies = 0;
let totalViolations = 0;

export function recordGrounding(result: GroundingResult): void {
  totalReplies++;
  if (!result.ok) totalViolations++;
}

export function groundingStats(): {
  replies: number;
  violations: number;
  rate: number;
} {
  return {
    replies: totalReplies,
    violations: totalViolations,
    rate: totalReplies === 0 ? 0 : totalViolations / totalReplies,
  };
}

/** Test seam. */
export function resetGroundingStats(): void {
  totalReplies = 0;
  totalViolations = 0;
}
