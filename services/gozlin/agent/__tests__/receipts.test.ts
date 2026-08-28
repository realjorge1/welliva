/**
 * Receipts — provenance for every figure the coach speaks.
 *
 * The load-bearing test in this file is the LAST one: anything the grounding
 * layer accepts must have a receipt. If those two ever disagree, the app either
 * shows an underline that opens nothing, or silently drops the proof for a
 * figure it just validated — and the second is worse, because the feature's
 * whole claim is that the proof is always there.
 */

import { describe, expect, it } from "vitest";
import { collectAllowedNumbers, validateNumbers } from "../grounding";
import {
  collectWithProvenance,
  createLedger,
  originLabel,
  pathLabel,
  receiptsFor,
  sourcesFor,
} from "../receipts";

const TWIN = {
  today: { calories: 1840, protein: 86.4, water: 1.8, caloriesTarget: 2200 },
  streak: { current: 12, longest: 31 },
  weight: { current: 78.6, change: -0.4083 },
  note: "Trending 0.4 kg/week down over 21 days.",
};

function ledgerWithTwin() {
  const l = createLedger();
  collectWithProvenance(TWIN, "current-state", l);
  return l;
}

describe("provenance collection", () => {
  it("records a number with the path it came from", () => {
    const sources = sourcesFor(1840, ledgerWithTwin());
    expect(sources).toHaveLength(1);
    expect(sources[0].origin).toBe("current-state");
    expect(sources[0].path).toBe("today.calories");
    expect(sources[0].value).toBe(1840);
  });

  it("keeps the RAW value, not the rounding the coach spoke", () => {
    // 86.4 spoken as "86" must still lead back to the stored 86.4.
    const sources = sourcesFor(86, ledgerWithTwin());
    expect(sources[0].path).toBe("today.protein");
    expect(sources[0].value).toBe(86.4);
  });

  it("mines numbers out of pre-formatted engine copy, keeping that field", () => {
    const sources = sourcesFor(21, ledgerWithTwin());
    expect(sources.some((s) => s.path === "note")).toBe(true);
  });

  it("labels a tool result with the tool that produced it", () => {
    const l = ledgerWithTwin();
    collectWithProvenance({ gap: { calories: 360 } }, "analyze_nutrition", l);
    const sources = sourcesFor(360, l);
    expect(sources[0].origin).toBe("analyze_nutrition");
    expect(sources[0].path).toBe("gap.calories");
  });

  it("survives a cyclic payload rather than hanging the turn", () => {
    const cyclic: Record<string, unknown> = { value: 42 };
    cyclic.self = cyclic;
    const l = createLedger();
    expect(() => collectWithProvenance(cyclic, "tool", l)).not.toThrow();
    expect(sourcesFor(42, l)).toHaveLength(1);
  });
});

describe("receipts for a reply", () => {
  it("builds one receipt per backed figure", () => {
    const receipts = receiptsFor(
      "You're at 1840 of 2200 calories.",
      ledgerWithTwin(),
    );
    expect(receipts.map((r) => r.shown).sort((a, b) => a - b)).toEqual([1840, 2200]);
  });

  it("treats small integers as prose, so they never get an underline", () => {
    // 3 and 2 are language ("3 more days"), not measurements.
    const receipts = receiptsFor("Give it 3 more days and 2 sessions.", ledgerWithTwin());
    expect(receipts).toEqual([]);
  });

  it("gives NO receipt to a figure with no evidence behind it", () => {
    // The promise the underline makes must never be one we cannot keep.
    const receipts = receiptsFor("You burned 9999 calories.", ledgerWithTwin());
    expect(receipts).toEqual([]);
  });

  it("does not repeat a receipt when a figure is said twice", () => {
    const receipts = receiptsFor("1840 now, 1840 at lunch.", ledgerWithTwin());
    expect(receipts).toHaveLength(1);
  });

  it("resolves a rounded spoken figure back to its precise source", () => {
    // Stored -0.4083, spoken "0.4". This is the case that proves the number was
    // rounded for speech rather than invented for it.
    const receipts = receiptsFor("You're trending 0.4 kg/week down.", ledgerWithTwin());
    const r = receipts.find((x) => x.shown === 0.4);
    expect(r).toBeDefined();
    expect(r!.sources.some((s) => s.path === "weight.change" || s.path === "note")).toBe(true);
  });

  it("does not list the same field twice under different roundings", () => {
    const receipts = receiptsFor("You're at 1840 calories.", ledgerWithTwin());
    const paths = receipts[0].sources.map((s) => `${s.origin}|${s.path}`);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("human phrasing", () => {
  it("names a tool the way a person would say it", () => {
    expect(originLabel("analyze_nutrition")).toBe("Your food log");
    expect(originLabel("current-state")).toBe("Today's totals");
  });

  it("falls back to humanising an unknown tool rather than leaking snake_case", () => {
    expect(originLabel("some_new_tool")).toBe("some new tool");
  });

  it("humanises an unmapped field path instead of leaking array indices", () => {
    expect(pathLabel("days[3].totalReps")).toBe("Total reps");
    expect(pathLabel("today.calories")).toBe("Calories logged today");
  });
});

describe("the invariant: grounding and receipts must agree", () => {
  it("gives a receipt to every figure grounding accepts", () => {
    const evidence = {
      twin: TWIN,
      tool: { gap: { calories: 360 }, rate: 0.7156, days: [{ reps: 240 }] },
    };

    // Build both indexes from the SAME evidence, exactly as the agent loop does.
    const allowed = collectAllowedNumbers(evidence);
    const ledger = createLedger();
    collectWithProvenance(evidence, "current-state", ledger);

    const replies = [
      "You're at 1840 of 2200 calories.",
      "About 360 to go, and you hit 240 reps.",
      "That's 72% of the way there.",
      "Protein's at 86 and water at 1.8.",
      "Your longest run is 31 days.",
    ];

    for (const reply of replies) {
      const check = validateNumbers(reply, allowed);
      expect(check.ok, `grounding rejected: ${reply}`).toBe(true);

      const receipts = receiptsFor(reply, ledger);
      // Every checked figure grounding passed must be explainable.
      expect(receipts.length, `no receipts for: ${reply}`).toBe(check.checked);
    }
  });

  it("stays silent exactly where grounding fails", () => {
    const allowed = collectAllowedNumbers(TWIN);
    const ledger = ledgerWithTwin();
    const reply = "You're 4310 calories over.";

    expect(validateNumbers(reply, allowed).ok).toBe(false);
    expect(receiptsFor(reply, ledger)).toEqual([]);
  });
});
