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

/** Relative tolerance for larger figures — absorbs rounding, not invention. */
const RELATIVE_TOLERANCE = 0.02;

/** Absolute floor so 47 vs 48 passes but 120 vs 340 never does. */
const ABSOLUTE_TOLERANCE = 1;

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
 * Register a value plus the roundings a coach would naturally speak it as.
 * The engines carry full precision; people say "0.4 kg" and "72%".
 */
function add(set: Set<number>, n: number): void {
  set.add(n);
  set.add(Math.round(n));
  set.add(Math.round(n * 10) / 10);
  // Rates and fractions are routinely voiced as percentages.
  if (n > 0 && n <= 1) set.add(Math.round(n * 100));
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
 * Extract numeric literals from text.
 *
 * ISO dates, clock times and ordinal suffixes are stripped first — "2026-07-26"
 * is not three numeric claims, and flagging it would bury real violations.
 */
export function extractNumbers(text: string): number[] {
  const cleaned = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ") // ISO dates
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, " ") // clock times
    .replace(/\b\d{1,2}\s*(am|pm)\b/gi, " ") // bare hours
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, " ") // ordinals
    .replace(/\bcovid-?19\b/gi, " ");

  const out: number[] = [];
  for (const m of cleaned.matchAll(/\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Is `n` accounted for by something we actually gave the model? */
function isGrounded(n: number, allowed: Set<number>): boolean {
  if (allowed.has(n)) return true;
  for (const a of allowed) {
    const tolerance = Math.max(ABSOLUTE_TOLERANCE, Math.abs(a) * RELATIVE_TOLERANCE);
    if (Math.abs(a - n) <= tolerance) return true;
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
    if (Number.isInteger(n) && n <= SMALL_INTEGER_CEILING) continue;
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
