/**
 * GOZLIN NLU — the offline classifier's regression net.
 *
 * Accuracy is asserted with a floor rather than per-case, because a lexicon is
 * a tuning surface: demanding 100% would make every future weight tweak a
 * test-editing exercise and the suite would stop meaning anything. The
 * behavioural guarantees — negation, abstain, multi-label — ARE asserted
 * per-case, because those are correctness, not tuning.
 */

import { describe, expect, it } from "vitest";
import {
  classify,
  classifyIntent,
  negationSigns,
  normalize,
  scoreIntents,
  similarity,
  stem,
  tokenize,
} from "../classify";
import { detectLanguage } from "../language";
import {
  FIXTURE_COUNT,
  MULTI,
  NEGATIONS,
  NON_ENGLISH,
  SINGLE,
  TYPOS,
  UNKNOWN,
} from "./fixtures";

/** The intent, whether it came back as a single label or the top of a set. */
function topIntent(text: string): string {
  const r = classify(text);
  if (r.kind === "single") return r.intent;
  if (r.kind === "multi") return r.intents[0];
  if (r.kind === "ambiguous") return r.options[0].intent;
  return r.kind;
}

/** Did `intent` show up at all — as the label, or either half of a pair? */
function mentions(text: string, intent: string): boolean {
  const r = classify(text);
  if (r.kind === "single") return r.intent === intent;
  if (r.kind === "multi") return r.intents.includes(intent as never);
  if (r.kind === "ambiguous") return r.options.some((o) => o.intent === intent);
  return false;
}

describe("normalization", () => {
  it("folds case, accents and apostrophes", () => {
    expect(normalize("Why ISN'T my wéight móving?")).toBe("why isnt my weight moving");
  });

  it("keeps apostrophe-joined words whole so phrases match", () => {
    expect(tokenize(normalize("it isn't working"))).toEqual(["it", "isnt", "working"]);
  });

  it("stems only when the stem stays substantial", () => {
    expect(stem("workouts")).toBe("workout");
    expect(stem("stalled")).toBe("stall");
    expect(stem("training")).toBe("train");
    // "los" would collide with half the lexicon — leave it alone.
    expect(stem("losing")).toBe("losing");
  });
});

describe("similarity", () => {
  it("is 1 for identical strings", () => {
    expect(similarity("plateau", "plateau")).toBe(1);
  });

  it("scores a near-miss above an unrelated word", () => {
    expect(similarity("plateau", "plateua")).toBeGreaterThan(
      similarity("plateau", "breakfast"),
    );
  });

  it("keeps genuinely different short words apart", () => {
    // The classic false-positive pair — these must not fuse.
    expect(similarity("stuck", "stick")).toBeLessThan(0.5);
  });
});

describe("negation", () => {
  it("flips the sign for tokens inside the window", () => {
    const signs = negationSigns(["im", "not", "stuck", "today"]);
    expect(signs[0]).toBe(1);
    expect(signs[2]).toBe(-1);
  });

  it("leaves tokens beyond the window alone", () => {
    const signs = negationSigns(["not", "a", "b", "c", "d", "far"]);
    expect(signs[5]).toBe(1);
  });

  it.each(NEGATIONS)("does not return $notIntent for: $text", ({ text, notIntent }) => {
    expect(mentions(text, notIntent)).toBe(false);
  });
});

describe("single-intent accuracy", () => {
  it("classifies clear utterances correctly", () => {
    const misses = SINGLE.filter((f) => !mentions(f.text, f.intent));
    const accuracy = (SINGLE.length - misses.length) / SINGLE.length;
    // Surface what actually failed — a bare ratio is useless when tuning.
    expect(
      { accuracy: Number(accuracy.toFixed(3)), misses: misses.map((m) => `${m.text} → ${topIntent(m.text)} (want ${m.intent})`) },
      "single-intent accuracy",
    ).toMatchObject({ accuracy: expect.any(Number) });
    expect(accuracy).toBeGreaterThanOrEqual(0.85);
  });

  it("never confuses the two adapt_* intents with each other", () => {
    // The sharpest regression in the old table: "tune my macros" hit
    // adapt_workout purely because it was listed first.
    expect(mentions("optimize my macros", "adapt_workout")).toBe(false);
    expect(mentions("tune my training", "adapt_nutrition")).toBe(false);
  });

  it("routes a plateau question to the detective, not the forecast", () => {
    expect(mentions("why am I stuck?", "detective")).toBe(true);
    expect(mentions("why am I stuck?", "forecast")).toBe(false);
  });
});

describe("typo tolerance", () => {
  it("recovers the intent from single-character errors", () => {
    const misses = TYPOS.filter((f) => !mentions(f.text, f.intent));
    const accuracy = (TYPOS.length - misses.length) / TYPOS.length;
    expect(accuracy, `misses: ${misses.map((m) => m.text).join(", ")}`).toBeGreaterThanOrEqual(
      0.7,
    );
  });
});

describe("multi-intent", () => {
  it.each(MULTI)("surfaces both intents for: $text", ({ text, intents }) => {
    const r = classify(text);
    expect(["multi", "ambiguous"]).toContain(r.kind);
    const found =
      r.kind === "multi" ? r.intents : r.kind === "ambiguous" ? r.options.map((o) => o.intent) : [];
    for (const intent of intents) expect(found).toContain(intent);
  });
});

describe("abstaining", () => {
  it.each(UNKNOWN)("returns unknown for: %s", (text) => {
    expect(classify(text).kind).toBe("unknown");
  });

  it("never returns a confident single intent for gibberish", () => {
    for (const text of UNKNOWN) {
      expect(classify(text).kind).not.toBe("single");
    }
  });
});

describe("language detection", () => {
  it.each(NON_ENGLISH)("detects $language for: $text", ({ text, language }) => {
    const result = detectLanguage(text);
    expect(result.isEnglish).toBe(false);
    expect(result.language).toBe(language);
    expect(result.apology.length).toBeGreaterThan(10);
  });

  it("does not misfire on English", () => {
    for (const f of SINGLE) {
      expect(detectLanguage(f.text).isEnglish, f.text).toBe(true);
    }
  });

  it("classifies non-English as non_english, not smalltalk", () => {
    const r = classify("¿Por qué no estoy perdiendo peso?");
    expect(r.kind).toBe("non_english");
  });
});

describe("back-compatible entry point", () => {
  it("collapses non-single results to smalltalk", () => {
    expect(classifyIntent("asdkjfh")).toBe("smalltalk");
    expect(classifyIntent("what's my forecast?")).toBe("forecast");
  });
});

describe("scoring mechanics", () => {
  it("never early-exits — every intent gets a score", () => {
    const scores = scoreIntents("what should I eat?");
    expect(scores.length).toBeGreaterThan(10);
    expect(scores).toEqual([...scores].sort((a, b) => b.score - a.score));
  });

  it("is order-independent for equivalent phrasings", () => {
    const a = topIntent("tune my nutrition");
    const b = topIntent("my nutrition needs tuning");
    expect(a).toBe(b);
  });
});

describe("coverage", () => {
  it("holds a meaningful number of labelled utterances", () => {
    expect(FIXTURE_COUNT).toBeGreaterThanOrEqual(180);
  });
});
