/**
 * The stream gate — a draft is shown only as far as the finished checks would
 * pass it, so whatever they reject is never on screen, not even for a second.
 */

import { describe, expect, it } from "vitest";
import { collectAllowedNumbers } from "../grounding";
import { safeDisplayLength } from "../streamGate";

const allowed = collectAllowedNumbers({ consumed: 1840, target: 2200, gap: 360, streak: 12 });

/** Feed a draft through in chunks the way a stream does; return what was shown. */
function stream(chunks: string[]): string[] {
  const shown: string[] = [];
  let draft = "";
  let len = 0;
  for (const c of chunks) {
    draft += c;
    const safe = safeDisplayLength(draft, allowed);
    if (safe > len) len = safe;
    shown.push(draft.slice(0, len));
  }
  return shown;
}

describe("the stream gate", () => {
  it("shows a clean draft word by word, holding back only the word still arriving", () => {
    const shown = stream(["You're at ", "1,840 ", "of 2,200 ", "today"]);
    expect(shown).toEqual([
      "You're at ",
      "You're at 1,840 ",
      "You're at 1,840 of 2,200 ",
      "You're at 1,840 of 2,200 ",
    ]);
  });

  it("never shows a half-written figure", () => {
    expect(stream(["You're at 1,8"])).toEqual(["You're at "]);
  });

  it("stops before an invented figure and never shows it", () => {
    const shown = stream(["You're ", "340 ", "calories over ", "today, so "]);
    for (const s of shown) expect(s).not.toContain("340");
    expect(shown[shown.length - 1]).toBe("You're ");
  });

  it("holds a spelled-out number until it can no longer grow", () => {
    // "three hundred" is not the claim yet — "and forty" may still be coming.
    const shown = stream(["You're three ", "hundred ", "and forty ", "over."]);
    for (const s of shown) expect(s).not.toMatch(/three|hundred|forty/);
  });

  it("shows prose numbers, which the gate never checks", () => {
    expect(stream(["Give it 3 more days ", "and "])).toEqual([
      "Give it 3 more days ",
      "Give it 3 more days and ",
    ]);
  });

  it("stops at the start of a sentence the output screen would reject", () => {
    const shown = stream(["Nice work today. ", "You could skip ", "dinner tonight ", "and land it."]);
    const last = shown[shown.length - 1];
    expect(last).toBe("Nice work today. You could skip ");
    for (const s of shown) expect(s).not.toContain("skip dinner");
  });

  it("does not stop on advice AGAINST restricting", () => {
    const shown = stream(["Don't skip ", "breakfast ", "on training days."]);
    // Everything but the word still arriving — nothing held for being unsafe.
    expect(shown[shown.length - 1]).toBe("Don't skip breakfast on training ");
  });
});
