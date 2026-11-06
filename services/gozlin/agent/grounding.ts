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
  // Both readings of an ambiguous "1.840": the person meant one of them, and
  // either is theirs to have said back.
  for (const text of texts) {
    for (const span of numberSpans(text)) for (const n of readingsOf(span)) add(set, n);
  }
}

/** One numeric claim in a text: its value and exactly where it was written. */
export interface NumberSpan {
  value: number;
  /**
   * The same characters read by the other convention, when there is one:
   * "1.840" is 1.84 in English and 1840 in German. See `readDigits`.
   */
  alt?: number;
  start: number;
  end: number;
  kind: "digits" | "words";
}

/** Every value a span can be read as, its own reading first. */
export function readingsOf(span: Pick<NumberSpan, "value" | "alt">): number[] {
  return span.alt === undefined ? [span.value] : [span.value, span.alt];
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
 * Where the coach writes in another language, three more things are not
 * claims: a Chinese, Japanese or Korean year ("2026年", "2026년"), the
 * month-and-day those scripts write without spaces ("9月12日", "9월 12일"),
 * and the French and Portuguese clock ("19h30"). Dates spelled with a month
 * NAME are a per-language list, so they are masked per turn by
 * {@link maskLocalDates} instead.
 */
const NOT_CLAIMS_ANY_LANGUAGE: RegExp[] = [
  /\d{4}\s*[年년]/g,
  /\d{1,2}\s*[月월]\s*\d{1,2}\s*[日일]?/g,
  /\b\d{1,2}\s?h\s?\d{2}\b/gi,
];

/**
 * Decimal digits in other scripts, by the code point of each script's zero:
 * Arabic-Indic, Persian, N'Ko, Devanagari, Bengali, Gurmukhi, Gujarati, Odia,
 * Tamil, Telugu, Kannada, Malayalam, Sinhala, Thai, Lao, Tibetan, Myanmar
 * (twice), Khmer, Mongolian and full-width.
 *
 * Read as ASCII digits rather than ignored, because ignoring them was a hole:
 * "١٨٤٠" is 1840 to an Arabic reader and was invisible to this gate, so a
 * figure written that way was never checked at all. Every one of these is a
 * single UTF-16 unit, as is its replacement, so positions survive the swap.
 */
const DIGIT_ZEROS = [
  0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6,
  0x0d66, 0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0xff10,
];
/** Arabic's own decimal and thousands marks. */
const ARABIC_DECIMAL = 0x066b;
const ARABIC_THOUSANDS = 0x066c;

// Built from code points, never typed: these are invisible in an editor.
const NATIVE_DIGIT = new RegExp(
  `[${DIGIT_ZEROS.map((z) => `${String.fromCharCode(z)}-${String.fromCharCode(z + 9)}`).join("")}${String.fromCharCode(ARABIC_DECIMAL, ARABIC_THOUSANDS)}]`,
  "g",
);

/** `text` with every native digit swapped for its ASCII twin, one unit for one. */
function asciiDigits(text: string): string {
  return text.replace(NATIVE_DIGIT, (c) => {
    const cp = c.charCodeAt(0);
    if (cp === ARABIC_DECIMAL) return ".";
    if (cp === ARABIC_THOUSANDS) return ",";
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    return zero === undefined ? c : String(cp - zero);
  });
}

/**
 * Thousands marks that are never anything else: the no-break, thin and narrow
 * no-break spaces (French, Russian, Polish, Swedish…) and the Swiss
 * apostrophes. A plain space is deliberately NOT one — "3 100g servings" is
 * two numbers in English, and the reply-language rule asks for no separator
 * at all (./replyLanguage.ts).
 */
const GROUP_SPACES = String.fromCharCode(0x00a0, 0x2009, 0x202f);
const GROUP_MARKS = `${GROUP_SPACES}'${String.fromCharCode(0x2019)}`;
const GROUP_MARK = new RegExp(`[${GROUP_MARKS}]`, "g");

/**
 * Digits, with thousands separators read as ONE figure. The coach writes
 * "1,840" — it is how anyone writes a calorie count — and reading that as the
 * two claims "1" and "840" failed every reply that cited a four-digit figure
 * the ordinary way, then told the model it had written an "840" it never
 * wrote. components/gozlin/ReceiptText.tsx `segmentReply` reads through
 * {@link numberSpans} too, so the gate and the trail agree on what a number is.
 *
 * The other half of the world writes the same figure "1.840" or "1 840" and
 * its decimals "82,6", and a coach replying in German or French writes them
 * that way. In order: comma groups, dot groups (with a decimal comma), the
 * marks in {@link GROUP_MARKS}, a decimal comma, plain digits. Only exact
 * three-digit groups qualify, and a decimal comma never takes an item out of
 * a list, so "3,4,5" is still three numbers.
 */
const DIGITS = new RegExp(
  [
    String.raw`[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?(?!\d)`,
    String.raw`[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?(?!\d)`,
    String.raw`[1-9]\d{0,2}(?:[${GROUP_MARKS}]\d{3})+(?:[.,]\d+)?(?!\d)`,
    String.raw`(?<![\d,])\d+,\d+(?!\d|,\d)`,
    String.raw`\d+(?:\.\d+)?`,
  ].join("|"),
  "g",
);

/**
 * The value of one run {@link DIGITS} matched.
 *
 * One mark followed by exactly three digits — "1,840", "1.840" — is the one
 * genuinely ambiguous shape: English reads them 1840 and 1.84, German the
 * other way round. Both readings are kept, and the evidence decides which was
 * meant (see {@link readingsOf}). Everything else says which mark is the
 * decimal point: the LAST mark when there are two kinds, a comma that does not
 * group threes, a dot that does not group threes at least twice.
 */
function readDigits(literal: string): { value: number; alt?: number } | null {
  const one = /^([1-9]\d{0,2})([.,])(\d{3})$/.exec(literal);
  if (one) {
    const grouped = Number(one[1] + one[3]);
    const decimal = Number(`${one[1]}.${one[3]}`);
    return one[2] === "," ? { value: grouped, alt: decimal } : { value: decimal, alt: grouped };
  }

  let s = literal.replace(GROUP_MARK, "");
  const dot = s.lastIndexOf(".");
  const comma = s.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    s = dot > comma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (comma >= 0) {
    s = /^[1-9]\d{0,2}(?:,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^[1-9]\d{0,2}(?:\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const value = Number(s);
  return Number.isFinite(value) ? { value } : null;
}

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
  let masked = asciiDigits(text);
  for (const re of [...NOT_CLAIMS, ...NOT_CLAIMS_ANY_LANGUAGE]) {
    masked = masked.replace(re, (m) => " ".repeat(m.length));
  }

  const spans: NumberSpan[] = [];
  for (const m of masked.matchAll(DIGITS)) {
    const read = readDigits(m[0]);
    if (!read) continue;
    const start = m.index ?? 0;
    spans.push({ ...read, start, end: start + m[0].length, kind: "digits" });
  }
  spans.push(...wordNumberSpans(masked));
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Dates written with a month NAME in the reply's language — "12 septembre",
 * "12. September", "12 de septiembre de 2026", "12 сентября", "Satumba 12" —
 * blanked to spaces of the same length, so every position still lines up.
 *
 * {@link NOT_CLAIMS} already does this for English. Without the same for
 * other languages, a coach quoting "on 12 Sep you said…" in French failed
 * grounding on the 12, and the regeneration usually threw away the very
 * memory the reply was built on.
 *
 * The month names come from the phone's own `Intl` data rather than a table
 * here, so every language the phone can be set to is covered at once. Where
 * `Intl` can't supply them, this returns the text unchanged and a dated reply
 * costs one regeneration, which is how it was before.
 */
export function maskLocalDates(text: string, lang?: string | null): string {
  if (!lang || lang.split("-")[0].toLowerCase() === "en") return text;
  const re = localDatePattern(lang);
  if (!re) return text;
  const ascii = asciiDigits(text);
  let out = "";
  let cursor = 0;
  for (const m of ascii.matchAll(re)) {
    const start = m.index ?? 0;
    out += text.slice(cursor, start) + " ".repeat(m[0].length);
    cursor = start + m[0].length;
  }
  return out + text.slice(cursor);
}

const DATE_PATTERNS = new Map<string, RegExp | null>();

/** One pattern per language, built on first use and kept. */
function localDatePattern(lang: string): RegExp | null {
  const cached = DATE_PATTERNS.get(lang);
  if (cached !== undefined) return cached;
  let re: RegExp | null = null;
  try {
    // Deduplicated: twelve "tháng 9"s all become one "tháng \d{1,2}".
    const names = [...new Set(monthNames(lang).map(monthPattern))];
    if (names.length > 0) {
      const month = `(?:${names.join("|")})\\.?`;
      const day = String.raw`(?:3[01]|[12]\d|0?[1-9])`;
      // A year is a year-shaped number, and in a day-first date it follows
      // with no comma: in "le 12 septembre, 1840 kcal" the 1840 is a claim.
      const year = String.raw`(?:19|20)\d{2}`;
      // Never the tail of a longer number: "2024 septembre" is not the 24th.
      re = new RegExp(
        String.raw`(?<!\d)${day}\.?\s*(?:de\s+)?${month}(?:\s*(?:de\s+)?${year})?(?!\d)` +
          String.raw`|${month}\s*(?:${day}(?:,?\s*${year})?|${year})(?!\d)`,
        "gi",
      );
    }
  } catch {
    re = null;
  }
  DATE_PATTERNS.set(lang, re);
  return re;
}

/**
 * The month names `Intl` knows for a language: standalone ("septembre") and
 * as they appear inside a date, which is a different word in Russian, Polish,
 * Ukrainian and Greek ("сентября", not "сентябрь"). Gregorian always, and the
 * locale's own calendar too where it has one (Persian, Hijri), because the
 * coach could reasonably write either.
 *
 * Abbreviations count only when they end in a dot or run to four letters:
 * Italian shortens settembre to "set", which is also the Italian for a set of
 * an exercise, and "12 set" in a workout reply is not a date.
 */
function monthNames(lang: string): string[] {
  const names = new Set<string>();
  for (const calendar of ["gregory", undefined]) {
    for (const width of ["long", "short"] as const) {
      try {
        const opts: Intl.DateTimeFormatOptions = {
          month: width,
          timeZone: "UTC",
          ...(calendar ? { calendar } : {}),
        };
        const alone = new Intl.DateTimeFormat(lang, opts);
        const dated = new Intl.DateTimeFormat(lang, { ...opts, day: "numeric" });
        for (let m = 0; m < 12; m++) {
          const at = new Date(Date.UTC(2024, m, 15));
          const found = [alone.format(at)];
          try {
            for (const p of dated.formatToParts(at)) if (p.type === "month") found.push(p.value);
          } catch {
            // No formatToParts on this engine: the standalone names still count.
          }
          for (const n of found) {
            const name = n.trim();
            const short = width === "short" && !name.endsWith(".") && name.length < 4;
            // A bare "9" is a numeral, not a name (Chinese and Japanese parts).
            if (name.length >= 2 && /[^\d\s]/.test(name) && !short) names.add(name);
          }
        }
      } catch {
        // This calendar or width isn't available; the others may be.
      }
    }
  }
  // Longest first, so "septembre" is preferred to a shorter name inside it.
  return [...names].sort((a, b) => b.length - a.length);
}

/** A month name as regex source: literal, any whitespace, and any numeral in it ("9月", "tháng 9") as a slot. */
function monthPattern(name: string): string {
  return name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, String.raw`\s+`)
    .replace(/\d+/g, String.raw`\d{1,2}`);
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
 * Is one claim accounted for, under either of its readings? "1.840" backed as
 * 1840 is not an invention because English would have read it as 1.84: the
 * evidence decides which one was meant.
 */
export function isSpanGrounded(
  span: Pick<NumberSpan, "value" | "alt">,
  allowed: Set<number>,
): boolean {
  return readingsOf(span).some((n) => isGrounded(n, allowed));
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

  for (const span of numberSpans(reply)) {
    if (isProseNumber(span.value)) continue;
    checked++;
    if (!isSpanGrounded(span, allowed)) violations.push(span.value);
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
