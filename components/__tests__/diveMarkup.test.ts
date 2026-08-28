import { describe, expect, it } from "vitest";

import { parseDive } from "@/components/gozlin/diveMarkup";

/**
 * The deep-dive parser (components/gozlin/diveMarkup.ts).
 *
 * What is being protected here is the FAILURE behaviour as much as the happy
 * path: this text is generated, so the parser will meet malformed input in
 * production, and the contract is that malformed input still renders as
 * readable prose rather than disappearing or rendering as a control.
 */
describe("parseDive", () => {
  it("reads the three shapes a dive is allowed to have", () => {
    const blocks = parseDive(
      [
        "## What the evidence says",
        "Meta-analyses converge on a small effect.",
        "It holds across training states.",
        "",
        "- Roughly 2-3% in trained lifters",
        "- Larger in untrained beginners",
        "",
        "## What it changes for you",
        "Not much this month.",
      ].join("\n"),
    );

    expect(blocks).toEqual([
      { kind: "heading", text: "What the evidence says" },
      {
        kind: "para",
        // Wrapped lines are one paragraph — a model wrapping its prose is not
        // expressing line breaks.
        text: "Meta-analyses converge on a small effect. It holds across training states.",
      },
      { kind: "bullet", text: "Roughly 2-3% in trained lifters" },
      { kind: "bullet", text: "Larger in untrained beginners" },
      { kind: "heading", text: "What it changes for you" },
      { kind: "para", text: "Not much this month." },
    ]);
  });

  it("accepts the bullet and heading marks models actually emit", () => {
    const blocks = parseDive(["# One hash", "* asterisk", "• bullet char", "· middot"].join("\n"));
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "bullet", "bullet", "bullet"]);
  });

  it("keeps unrecognised text as prose rather than dropping it", () => {
    const blocks = parseDive("**bold-ish** text with a stray * in it");
    expect(blocks).toEqual([
      { kind: "para", text: "**bold-ish** text with a stray * in it" },
    ]);
  });

  it("never emits an empty block", () => {
    const blocks = parseDive(["##", "", "-   ", "", "   ", "real text"].join("\n"));
    expect(blocks).toEqual([{ kind: "para", text: "real text" }]);
  });

  it("returns nothing for nothing — the sheet renders its skeleton off this", () => {
    expect(parseDive("")).toEqual([]);
    expect(parseDive("   \n\n  ")).toEqual([]);
  });

  it("handles a partial stream mid-word without losing what has arrived", () => {
    // The sheet renders while the dive is still streaming, so the parser is
    // called on every prefix of the final text.
    const blocks = parseDive("## What the evide");
    expect(blocks).toEqual([{ kind: "heading", text: "What the evide" }]);
  });
});
