/**
 * Gozlin agent — the safety layers.
 *
 * These are release gates, not unit tests. The numeric-grounding rate and the
 * clinical gate are the two things that make it acceptable to put a language
 * model in front of someone's health data at all.
 */

import { describe, expect, it } from "vitest";
import {
  addDerivedGaps,
  collectAllowedNumbers,
  extractNumbers,
  groundingStats,
  recordGrounding,
  resetGroundingStats,
  validateNumbers,
} from "../grounding";
import { conditionRules, screenForClinicalRisk } from "../clinical";
import { GOZLIN_SYSTEM, toWireMessages, twinStateMessage } from "../context";
import { TOOL_SCHEMAS, GOZLIN_TOOLS } from "../tools";
import type { UserBio } from "../../../../models/user";

// ════════════════════════════════════════════════════════════════
// D1 — numeric grounding
// ════════════════════════════════════════════════════════════════

describe("numeric grounding", () => {
  const evidence = {
    calories: { consumed: 1840, target: 2200 },
    protein: { consumed: 96, target: 150 },
    streak: 12,
    adherence: 78,
    summary: "0.4 kg/week down",
  };

  const allowed = () => {
    const set = collectAllowedNumbers(evidence);
    addDerivedGaps(set, [
      { consumed: 1840, target: 2200 },
      { consumed: 96, target: 150 },
    ]);
    return set;
  };

  it("accepts figures that came from the evidence", () => {
    expect(validateNumbers("You're at 1840 of 2200 calories.", allowed()).ok).toBe(true);
  });

  it("REJECTS an invented figure — the product-ending case", () => {
    // The exact failure this layer exists for: real gap is 360, model says 340.
    const result = validateNumbers("You're 340 calories over.", allowed());
    expect(result.ok).toBe(false);
    expect(result.violations).toContain(340);
  });

  it("allows the gap between consumed and target", () => {
    // "About 54g to go" is the most natural line this product produces;
    // banning it would push every reply into stilted phrasing for no safety gain.
    expect(validateNumbers("Protein's the gap — about 54g to go.", allowed()).ok).toBe(
      true,
    );
  });

  it("mines numbers out of pre-formatted engine copy", () => {
    expect(validateNumbers("You're trending 0.4 kg/week down.", allowed()).ok).toBe(true);
  });

  it("treats small integers as prose, not measurements", () => {
    // "a couple of days", "3 sets" — flagging these would bury real violations.
    expect(validateNumbers("Give it 3 more days and 2 solid sessions.", allowed()).ok).toBe(
      true,
    );
  });

  it("does not treat dates and clock times as numeric claims", () => {
    expect(extractNumbers("On 2026-07-26 at 7:30am")).toEqual([]);
  });

  it("tolerates rounding but not invention", () => {
    // 1841 vs 1840 is rounding; 1900 is a different claim.
    expect(validateNumbers("about 1841 calories", allowed()).ok).toBe(true);
    expect(validateNumbers("about 1900 calories", allowed()).ok).toBe(false);
  });

  it("counts violations so the release gate has a number to read", () => {
    resetGroundingStats();
    recordGrounding(validateNumbers("1840 calories", allowed()));
    recordGrounding(validateNumbers("340 calories over", allowed()));
    const stats = groundingStats();
    expect(stats.replies).toBe(2);
    expect(stats.violations).toBe(1);
    expect(stats.rate).toBeCloseTo(0.5, 5);
  });
});

// ════════════════════════════════════════════════════════════════
// D2 — the clinical gate
// ════════════════════════════════════════════════════════════════

describe("clinical gate", () => {
  it.each([
    ["I have chest pain when I train", "emergency"],
    ["I passed out at the gym", "emergency"],
    ["should I double my metformin?", "medication"],
    ["what dosage of creatine should I take", "medication"],
    ["do I have diabetes?", "diagnosis"],
    ["I have a sharp pain in my knee", "symptom"],
    ["I've been dizzy all week", "symptom"],
    ["I want to make myself throw up after eating", "disordered_eating"],
    ["I've been thinking about ending my life", "mental_health"],
  ])("catches %s", (text, kind) => {
    const risk = screenForClinicalRisk(text);
    expect(risk).not.toBeNull();
    expect(risk!.kind).toBe(kind);
    expect(risk!.reply.length).toBeGreaterThan(40);
  });

  it("refers out rather than hedging", () => {
    const risk = screenForClinicalRisk("I have a sharp pain in my knee");
    expect(risk!.reply).toMatch(/doctor|professional/i);
  });

  it("does not fire on ordinary training talk", () => {
    // False positives here are expensive: every one is a coaching question the
    // user asked and didn't get answered.
    for (const text of [
      "my legs are dead after that session",
      "that workout killed me",
      "I'm sore from squats",
      "I'm dying to get back to training",
      "what should I eat today?",
      "my arms are wrecked",
      "should I train today?",
      "I'm exhausted",
    ]) {
      expect(screenForClinicalRisk(text), text).toBeNull();
    }
  });

  it("emits a hard protein rule for renal impairment", () => {
    const bio = { medicalConditions: ["renal_issues"] } as unknown as UserBio;
    const rules = conditionRules(bio);
    expect(rules.join(" ")).toMatch(/NEVER suggest increasing protein/);
  });

  it("emits no-deficit rules in pregnancy, with the trimester", () => {
    const bio = {
      medicalConditions: ["pregnancy"],
      pregnancyTrimester: 2,
    } as unknown as UserBio;
    const rules = conditionRules(bio);
    expect(rules.join(" ")).toMatch(/never suggest a calorie deficit/i);
    expect(rules.join(" ")).toMatch(/trimester 2/);
  });

  it("treats allergies as absolute", () => {
    const bio = {
      medicalConditions: [],
      allergies: ["peanuts", "shellfish"],
    } as unknown as UserBio;
    expect(conditionRules(bio).join(" ")).toMatch(/peanuts, shellfish/);
  });

  it("stays silent for an unremarkable profile", () => {
    const bio = { medicalConditions: ["none"], allergies: [] } as unknown as UserBio;
    expect(conditionRules(bio)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════
// A2 — the context architecture
// ════════════════════════════════════════════════════════════════

describe("context architecture", () => {
  it("keeps the cached system prompt free of anything user-specific", () => {
    // The whole economic model: byte-identical across every user means one
    // cached prefix serves the entire install base. A date or a name in here
    // collapses that into a per-user cache that mostly misses.
    expect(GOZLIN_SYSTEM).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(GOZLIN_SYSTEM).not.toMatch(/\$\{/);
    expect(GOZLIN_SYSTEM).toMatch(/Use ONLY numbers/);
  });

  it("sorts tool schemas so the cached prefix is stable", () => {
    const names = TOOL_SCHEMAS.map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("exposes every engine as a tool, with prescriptive descriptions", () => {
    expect(GOZLIN_TOOLS.length).toBeGreaterThanOrEqual(11);
    for (const tool of GOZLIN_TOOLS) {
      // "Call this when…" is what earns the should-call rate.
      expect(tool.description, tool.name).toMatch(/call this|call it/i);
    }
  });

  it("marks exactly the two mutating tools as writes", () => {
    const writes = GOZLIN_TOOLS.filter((t) => !t.readOnly).map((t) => t.name).sort();
    expect(writes).toEqual(["log_food", "remember_fact"]);
  });

  it("puts volatile state in a system message, not the cached prefix", () => {
    const twin = {
      asOf: "2026-07-26",
      identitySummary: "losing fat",
      flags: ["PROTEIN_LAG"],
      today: {
        calories: { consumed: 1840, target: 2200, pct: 0.83 },
        protein: { consumed: 96, target: 150, pct: 0.64 },
        water: { consumed: 1200, target: 2500, pct: 0.48 },
        workout: { planned: "Upper body", done: false, minutes: 40 },
        dayProgress: 0.5,
      },
      momentum: { streak: 12, adherence7d: 78, trainingLoad7d: 3, trend: "steady" },
      recovery: { score: 66, level: "amber", drivers: [], recommendation: "", basis: "" },
    } as never;

    const message = twinStateMessage(twin);
    expect(message.role).toBe("system");
    expect(String(message.content)).toContain("1840/2200");
    expect(String(message.content)).toContain("streak 12d");
  });

  it("drops a leading coach turn so history starts with the user", () => {
    const wire = toWireMessages([
      { id: "1", role: "coach", content: "Morning briefing", createdAt: 1 },
      { id: "2", role: "user", content: "hey", createdAt: 2 },
    ]);
    expect(wire[0].role).toBe("user");
  });

  it("merges consecutive same-role turns", () => {
    const wire = toWireMessages([
      { id: "1", role: "user", content: "hey", createdAt: 1 },
      { id: "2", role: "user", content: "you there?", createdAt: 2 },
    ]);
    expect(wire).toHaveLength(1);
    expect(wire[0].content).toBe("hey\n\nyou there?");
  });
});
