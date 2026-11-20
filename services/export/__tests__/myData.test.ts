/**
 * "WHY YOUR NUMBERS CHANGED" — the section that has to answer the question
 * months after the card that asked it has gone.
 *
 * The correction notice (services/nutrition/TargetsVersion) is shown once and
 * erased on "Got it". Until 2026-11-20 nothing else kept it, so a user whose
 * target moved 3,200 → 5,091 kcal and tapped Got it got a document that said
 * her numbers had never moved by themselves. These tests pin the other half of
 * that fix: a recorded correction reaches the page.
 */
import { describe, expect, it } from "vitest";

import { buildMyDataBlocks, type MyDataInput } from "../myData";
import type { DocBlock } from "../docx";

const input = (targets?: MyDataInput["targets"]): MyDataInput => ({
  exportedAt: new Date("2026-11-20T21:00:00.000Z"),
  bio: null,
  goals: null,
  bodyLogs: [],
  dietHistory: [],
  meals: [],
  water: [],
  workouts: [],
  effort: [],
  pain: [],
  habits: [],
  moods: [],
  cycle: { status: "off" },
  targets,
  coach: { preferences: [], constraints: [], episodes: [], conversations: [] },
});

/** The blocks under a heading, up to the next heading of the same level. */
function sectionOf(blocks: DocBlock[], title: string): DocBlock[] {
  const start = blocks.findIndex((b) => b.kind === "heading" && b.text === title);
  if (start < 0) return [];
  const rest = blocks.slice(start + 1);
  const end = rest.findIndex((b) => b.kind === "heading" && (b.level ?? 1) === 1);
  return end < 0 ? rest : rest.slice(0, end);
}

const CORRECTION =
  "Your target was capped for large, active frames, which left you short of " +
  "what your goal needs, so I removed the cap. Your daily target moved from " +
  "3,200 to 5,091 kcal.";

describe("why your numbers changed", () => {
  it("prints a recorded correction, sentence and all", () => {
    const blocks = buildMyDataBlocks(
      input({ moves: [{ date: "2026-11-20", message: CORRECTION }], offers: [] }),
    );
    const body = sectionOf(blocks, "Why your numbers changed");

    const table = body.find((b) => b.kind === "table");
    expect(table).toBeDefined();
    expect(table).toMatchObject({ header: ["Date", "What changed"] });
    expect(table!.kind === "table" && table!.rows).toEqual([["20 Nov 2026", CORRECTION]]);
  });

  it("says nothing moved only when nothing did", () => {
    const body = sectionOf(
      buildMyDataBlocks(input({ moves: [], offers: [] })),
      "Why your numbers changed",
    );
    expect(body).toEqual([
      { kind: "paragraph", text: "Your daily numbers haven't moved by themselves." },
    ]);
  });

  it("keeps a correction beside her own moves, in the order they happened", () => {
    const blocks = buildMyDataBlocks(
      input({
        moves: [
          { date: "2026-11-20", message: CORRECTION },
          { date: "2026-11-02", message: "You've been steady at 92 kg, so I lifted your target." },
        ],
        offers: [],
      }),
    );
    const table = sectionOf(blocks, "Why your numbers changed").find((b) => b.kind === "table");
    // Oldest first: a document is read forwards, not like a feed.
    expect(table!.kind === "table" && table!.rows.map((r) => r[0])).toEqual([
      "2 Nov 2026",
      "20 Nov 2026",
    ]);
  });
});
