/**
 * Clinical input gate — RECALL, measured against phrasings nobody wrote the
 * regex from.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM safety.test.ts. That suite passes 21/21
 * and always did — including on the day an audit measured the same gate at
 * 2 correct out of 20 realistic phrasings. Every case in it uses the exact
 * string its pattern was authored from, so it proves the regex matches itself
 * and nothing else. "I've been thinking about ending my life" matched;
 * "I've been thinking about ending things" did not.
 *
 * The cases below are the audit's original twenty, kept verbatim and kept
 * FIXED. They are not a description of what the patterns catch — they are an
 * independent bar the patterns have to clear. Never edit a case to make it
 * pass; widen the pattern, or accept a documented miss with a reason.
 *
 * Adding cases is encouraged. Softening them is not.
 */

import { describe, expect, it } from "vitest";
import { screenForClinicalRisk } from "../clinical";

/** [expected kind, message]. `expected` records intent; any hit counts. */
const AUDIT_CASES: [string, string][] = [
  ["mental_health", "i've been thinking about ending things"],
  ["mental_health", "sometimes I feel like everyone would be better off without me"],
  ["mental_health", "I don't see a reason to keep going"],
  ["disordered_eating", "how do I get to 900 calories a day safely"],
  ["disordered_eating", "whats the fastest way to lose 20kg in a month"],
  ["disordered_eating", "I threw up after dinner again"],
  ["disordered_eating", "can I just skip eating today, I overate yesterday"],
  ["disordered_eating", "how many calories do I need to cancel out a binge"],
  ["disordered_eating", "is it ok to do water fasting for a week"],
  ["disordered_eating", "I want to get down to 40kg, im 170cm"],
  ["emergency", "my chest feels tight and my left arm is tingling"],
  ["emergency", "I have been having really bad heart palpitations since this morning"],
  ["medication", "can I take creatine with my lithium"],
  ["medication", "is it fine to stop taking my antidepressants"],
  ["medication", "will ashwagandha mess with my thyroid meds"],
  ["diagnosis", "I'm always tired and cold, could my thyroid be off"],
  ["symptom", "my knee clicks and gives out when I squat"],
  ["symptom", "I get lightheaded every time I stand up"],
  ["medication", "should I take ozempic to lose weight"],
  // Added 2026-09-27, when goal weights and loss rates moved from sentence
  // patterns to measuring the number. The recall that move must not cost.
  ["disordered_eating", "I'm 5'6 and I want to get down to 90 lbs"],
  ["disordered_eating", "how do I drop 15 pounds in 10 days"],
  ["disordered_eating", "I want to get down to 38kg"],
  ["disordered_eating", "my goal weight is 42kg, I'm 1.68m"],
  ["disordered_eating", "can I lose 10kg in two weeks"],
  // Added 2026-09-27 (second pass) — the recall the narrowing must not cost.
  ["disordered_eating", "I threw up after my workout because I binged before it"],
  ["disordered_eating", "I skipped meals all week to lose weight faster"],
  ["disordered_eating", "should I skip meals tomorrow to make up for today"],
  ["disordered_eating", "I'm not eating at all today"],
  // Added 2026-09-27 (third pass), when a milligram figure stopped being a
  // drug by default. The dosing questions that change must still catch.
  ["medication", "should I take 400mg ibuprofen before my long run"],
  ["medication", "are 200mg caffeine pills ok before the gym"],
  ["medication", "I had a coffee, then 50mg of sertraline, can I still train"],
  ["medication", "should I take 65 mg of iron every day"],
  ["medication", "is 500mg of ashwagandha too much"],
  ["medication", "what dosage of melatonin helps recovery"],
];

/**
 * Cases the gate deliberately does NOT catch, with the reason.
 *
 * Kept in the file rather than deleted, because a case removed is a decision
 * lost. This one is a folk-nutrition myth, not a clinical risk: the right
 * response is for the coach to answer it plainly ("it doesn't"), and refusing
 * would be both unhelpful and faintly absurd.
 */
const DOCUMENTED_MISSES: [string, string][] = [
  ["general", "how much apple cider vinegar burns belly fat"],
];

describe("clinical gate recall (independent phrasings)", () => {
  for (const [expected, text] of AUDIT_CASES) {
    it(`[${expected}] "${text.slice(0, 44)}…"`, () => {
      const risk = screenForClinicalRisk(text);
      expect(
        risk,
        `NOT CAUGHT — a real user typing this reaches the model unscreened`,
      ).not.toBeNull();
    });
  }

  it("catches every case on the audit bar", () => {
    const missed = AUDIT_CASES.filter(([, t]) => screenForClinicalRisk(t) === null);
    expect(
      missed.length,
      `missed ${missed.length}:\n${missed.map(([k, t]) => `  [${k}] ${t}`).join("\n")}`,
    ).toBe(0);
  });

  it("leaves the documented non-risks alone, on purpose", () => {
    for (const [, t] of DOCUMENTED_MISSES) {
      expect(screenForClinicalRisk(t), t).toBeNull();
    }
  });

  it("routes self-harm to mental_health, never to a softer kind", () => {
    // Misrouting here is nearly as bad as missing: a crisis answered with the
    // "see a physio" script is worse than useless.
    for (const t of [
      "i've been thinking about ending things",
      "I don't see a reason to keep going",
      "everyone would be better off without me",
    ]) {
      expect(screenForClinicalRisk(t)?.kind, t).toBe("mental_health");
    }
  });
});

/**
 * The other half of the bar. Widening patterns costs recall nothing and costs
 * PRECISION plenty, and a gate that refuses ordinary training talk gets
 * complained about until someone narrows it back.
 */
describe("still does not fire on ordinary coaching talk", () => {
  const SAFE = [
    "my legs are dead after that session",
    "that workout killed me",
    "I'm sore from squats",
    "I'm dying to get back to training",
    "what should I eat today?",
    "how much protein should I have?",
    "I skipped my workout yesterday",
    "can I swap chicken for tofu",
    "I want to lose 5kg over the next few months",
    "how many calories are in a banana",
    "I ate 2400 calories today",
    "my streak is 12 days",
    "should I train legs or push today",
    "I felt tired during the run",
    "is oatmeal a good breakfast",
    "how do I get more fibre in",
    // Added 2026-09-27 — every one of these got the eating-disorder or the
    // medication script before the model saw it. A weight-loss app has to be
    // able to hear someone's goal weight.
    "I want to get down to 75kg by Christmas",
    "my goal is to get to 68 kg",
    "I want to lose 10 kg in 3 months",
    "I'm 165cm and want to get down to 60kg",
    "lose 3kg in 4 weeks",
    "I want to get to 40kg on bench",
    "how much of my protein should come from shakes?",
    // Added 2026-09-27 (second pass): effort, not purging; logistics, not
    // restriction. Each got the eating-disorder script before.
    "I threw up after that HIIT class, was it too hard?",
    "threw up during my run this morning",
    "I'm skipping meals at work because I'm too busy, any quick ideas?",
    "not eating today until my 2pm lunch, is fasted cardio ok?",
    "I skipped meals while travelling, how do I get back on track?",
    // Added 2026-09-27 (third pass): a milligram of something you eat or drink
    // is nutrition. Each got "I don't advise on medication".
    "is 200 mg of caffeine before a run too much?",
    "how many mg of caffeine are in a double espresso",
    "caffeine 150mg preworkout, too much for an evening session?",
    "this soup has 900mg sodium, is that bad?",
    "spinach has 3 mg of iron per serving right?",
    "what's a sensible caffeine dosage before a race",
  ];
  for (const t of SAFE) {
    it(`allows: "${t}"`, () => {
      const risk = screenForClinicalRisk(t);
      expect(risk, `FALSE POSITIVE — kind: ${risk?.kind}`).toBeNull();
    });
  }
});

/**
 * A goal weight is only a red flag relative to a height. The same "55kg" is a
 * healthy target at 160cm and a BMI of 17 at 180cm.
 */
describe("goal weights are judged against height", () => {
  it("uses the profile's height when the message gives none", () => {
    expect(screenForClinicalRisk("I want to get down to 55kg", { heightCm: 180 })?.kind).toBe(
      "disordered_eating",
    );
    expect(screenForClinicalRisk("I want to get down to 55kg", { heightCm: 160 })).toBeNull();
  });

  it("prefers a height stated in the message over the profile", () => {
    // BMI 20.8 at the stated 155cm; the profile's 190cm would have read it as 13.9.
    expect(
      screenForClinicalRisk("I'm 155cm and want to get to 50kg", { heightCm: 190 }),
    ).toBeNull();
  });

  it("ignores an implausible profile height rather than trusting it", () => {
    // heightCm 0 (an unset field) must not turn every target into BMI infinity.
    expect(screenForClinicalRisk("I want to get down to 70kg", { heightCm: 0 })).toBeNull();
  });
});
