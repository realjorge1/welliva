/**
 * "Trying something new", through the real agent loop (docs/gozlin/11).
 *
 * The engines are tested on their own in services/gozlin/novelty. This proves
 * what the COACH does with them: the question line appears only while it is
 * due, the model repeating its figures passes grounding and earns receipts,
 * note_experience keeps only the person's own words and only about exercise,
 * and a clinical message never reaches either.
 */

import { describe, expect, it, vi } from "vitest";
import { entryFor } from "../../novelty/curiosity";
import { subjectFor } from "../../novelty/subjects";
import type { CuriosityEntry, ExperienceBrief, ExperienceRecord, NoveltyCandidate } from "../../novelty/types";
import type { WireMessage } from "../context";
import { runAgentTurn, type CoachTransport, type CoachTurnRequest, type CoachTurnResponse } from "../GozlinAgent";
import type { ExperienceNote, GozlinToolContext } from "../tools";

const TWIN = {
  asOf: "2026-09-27",
  identitySummary: "getting stronger",
  flags: [],
  goal: "build_muscle",
  today: {
    calories: { consumed: 1840, target: 2200, pct: 0.84 },
    protein: { consumed: 96, target: 150, pct: 0.64 },
    water: { consumed: 1200, target: 2500, pct: 0.48 },
    workout: { planned: "Lower body", done: false, minutes: 40 },
    dayProgress: 0.3,
  },
  momentum: { streak: 12, adherence7d: 78, trainingLoad7d: 3, trend: "steady" },
  recovery: { score: 66, level: "amber", drivers: [], recommendation: "", basis: "" },
} as never;

/** Sat 27 Sep, 08:30 — the morning after a Friday-evening session. */
const MORNING = new Date(2026, 8, 27, 8, 30);

function nordicQuestion(openedAt = MORNING): CuriosityEntry {
  const c: NoveltyCandidate = {
    kind: "exercise",
    variantKey: "hinge_09",
    familyKey: "nordic-curl",
    label: "Nordic Hamstring Curl",
    category: "legs",
    difficulty: "advanced",
    novelty: "family",
    triedRunId: "run_fri",
    triedAt: new Date(2026, 8, 26, 18, 0).toISOString(),
    triedOn: "2026-09-26",
    score: 4,
    evidence: { sessionsBefore: 23, since: "2026-07-14" },
  };
  return entryFor(c, openedAt);
}

function memory(over: Partial<ExperienceRecord> = {}): ExperienceRecord {
  return {
    id: "xp_nordic",
    kind: "exercise",
    variantKey: "hinge_09",
    familyKey: "nordic-curl",
    label: "Nordic Hamstring Curl",
    triedOn: "2026-09-12",
    answeredAt: new Date(2026, 8, 13, 8, 0).toISOString(),
    source: "asked-chip",
    quote: "hamstrings were wrecked for two days",
    soreness: 3,
    enjoyed: "yes",
    feelings: [],
    updatedAt: new Date(2026, 8, 13, 8, 0).toISOString(),
    ...over,
  };
}

function brief(over: Partial<ExperienceBrief> = {}): ExperienceBrief {
  return { enabled: true, due: null, records: [], planned: [], logged: [], ...over };
}

function context(over: Partial<GozlinToolContext> = {}): GozlinToolContext {
  return {
    twin: TWIN,
    snapshot: { bio: null, sessionHistory: [] } as never,
    insights: [] as never,
    identity: { preferences: [], constraints: [], updatedAt: 0 },
    checkins: [],
    conversation: [],
    weekStart: "2026-09-22",
    weeklyWorkoutTarget: 3,
    now: MORNING,
    ...over,
  } as GozlinToolContext;
}

type Reply = string | { tool: string; input: Record<string, unknown> };

/** Answers each call with the next scripted reply — text, or one tool call. */
function scripted(replies: Reply[]): { transport: CoachTransport; calls: CoachTurnRequest[] } {
  const calls: CoachTurnRequest[] = [];
  const transport: CoachTransport = async (req) => {
    calls.push({ ...req, messages: [...req.messages] });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    const res: CoachTurnResponse =
      typeof r === "string"
        ? { content: [{ type: "text", text: r }], stop_reason: "end_turn" }
        : {
            content: [{ type: "tool_use", id: `t${calls.length}`, name: r.tool, input: r.input }],
            stop_reason: "tool_use",
          };
    return res;
  };
  return { transport, calls };
}

const stateBlock = (messages: WireMessage[]) =>
  String(messages.filter((m) => m.role === "system").map((m) => m.content)[0] ?? "");

/** The tool_result the loop sent back for a tool call, parsed. */
function toolResult(call: CoachTurnRequest): Record<string, unknown> {
  const last = call.messages[call.messages.length - 1];
  const block = (last.content as { content: string }[])[0];
  return JSON.parse(block.content);
}

describe("the question line", () => {
  it("rides the state block only while the question is due", async () => {
    const due = nordicQuestion();
    const inside = scripted(["Morning."]);
    await runAgentTurn("morning!", context({ experiences: brief({ due }) }), { transport: inside.transport });
    const block = stateBlock(inside.calls[0].messages);
    expect(block).toContain("WORTH ASKING ABOUT");
    expect(block).toContain("Nordic Hamstring Curl");
    expect(block).toContain("23 sessions logged before it");

    // The same evening it was done — before the window opens.
    const early = scripted(["Evening."]);
    await runAgentTurn(
      "evening",
      context({ now: new Date(2026, 8, 26, 21, 0), experiences: brief({ due }) }),
      { transport: early.transport },
    );
    expect(stateBlock(early.calls[0].messages)).not.toContain("WORTH ASKING ABOUT");

    // Two days on — the window has closed, and it is never asked late.
    const late = scripted(["Hi."]);
    await runAgentTurn("hi", context({ now: new Date(2026, 8, 28, 19, 0), experiences: brief({ due }) }), {
      transport: late.transport,
    });
    expect(stateBlock(late.calls[0].messages)).not.toContain("WORTH ASKING ABOUT");
  });

  it("says nothing at all with the switch off", async () => {
    const { transport, calls } = scripted(["Morning."]);
    await runAgentTurn("morning", context({ experiences: brief({ enabled: false, due: nordicQuestion() }) }), {
      transport,
    });
    expect(stateBlock(calls[0].messages)).not.toContain("WORTH ASKING");
  });

  it("stops offering it after three turns that did not use it", async () => {
    const due = { ...nordicQuestion(), turnsCarried: 3 };
    const { transport, calls } = scripted(["Morning."]);
    await runAgentTurn("morning", context({ experiences: brief({ due }) }), { transport });
    expect(stateBlock(calls[0].messages)).not.toContain("WORTH ASKING");
  });
});

describe("the model asking it", () => {
  const REPLY =
    "Big session yesterday — Nordic curls for the first time in 23 logged sessions. How are the hamstrings this morning?";

  it("passes grounding first time, with a receipt for the figure it repeated", async () => {
    const { transport, calls } = scripted([REPLY]);
    const r = await runAgentTurn("morning!", context({ experiences: brief({ due: nordicQuestion() }) }), {
      transport,
    });
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
    const receipt = r.message.receipts?.find((x) => x.shown === 23);
    expect(receipt?.sources[0].origin).toBe("experience-log");
  });

  it("would have been rejected without the evidence — the figure is not a coincidence", async () => {
    const { calls } = await (async () => {
      const s = scripted([REPLY, "How are the hamstrings this morning?"]);
      await runAgentTurn("morning!", context(), { transport: s.transport });
      return s;
    })();
    expect(calls).toHaveLength(2);
  });

  it("reports that it asked, so the next turn captures instead of asking again", async () => {
    const { transport } = scripted([REPLY]);
    const r = await runAgentTurn("morning!", context({ experiences: brief({ due: nordicQuestion() }) }), {
      transport,
    });
    expect(r.curiosity).toMatchObject({ stage: "ask", asked: true, noted: false });

    const asked = { ...nordicQuestion(), askedInChatAt: MORNING.toISOString(), turnsCarried: 1 };
    const next = scripted(["Good to hear."]);
    await runAgentTurn("pretty sore tbh", context({ experiences: brief({ due: asked }) }), {
      transport: next.transport,
    });
    const block = stateBlock(next.calls[0].messages);
    expect(block).toContain("YOU ASKED THEM ABOUT Nordic Hamstring Curl");
    expect(block).not.toContain("WORTH ASKING ABOUT");
  });
});

describe("note_experience", () => {
  const asked = () => ({ ...nordicQuestion(), askedInChatAt: MORNING.toISOString(), turnsCarried: 1 });

  function withNotes(over: Partial<GozlinToolContext> = {}) {
    const saved: ExperienceNote[] = [];
    const noteExperience = vi.fn(async (note: ExperienceNote) => {
      saved.push(note);
      return { ok: true as const, id: "xp_1" };
    });
    const ctx = context({ experiences: brief({ due: asked() }), actions: { noteExperience }, ...over });
    return { ctx, saved, noteExperience };
  }

  it("records their exact words about the question that was open", async () => {
    const { ctx, saved } = withNotes();
    const { transport, calls } = scripted([
      {
        tool: "note_experience",
        input: { exercise: "Nordic curls", quote: "hamstrings are wrecked", soreness: "severe", enjoyed: "unsaid" },
      },
      "That's normal after a first go — keep today easy.",
    ]);
    const r = await runAgentTurn("honestly my hamstrings are wrecked lol", ctx, { transport });
    expect(toolResult(calls[1]).status).toBe("noted");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      quote: "hamstrings are wrecked",
      soreness: 3,
      enjoyed: null,
      source: "asked-chat",
      triedOn: "2026-09-26",
    });
    expect(saved[0].subject.variantKey).toBe("hinge_09");
    expect(r.curiosity?.noted).toBe(true);
  });

  it("refuses a paraphrase — nothing they did not say is ever saved", async () => {
    const { ctx, noteExperience } = withNotes();
    const { transport, calls } = scripted([
      {
        tool: "note_experience",
        input: { exercise: "Nordic curls", quote: "experienced significant hamstring soreness", soreness: "severe", enjoyed: "unsaid" },
      },
      "Keep today easy.",
    ]);
    await runAgentTurn("honestly my hamstrings are wrecked lol", ctx, { transport });
    expect(toolResult(calls[1]).status).toBe("rejected");
    expect(noteExperience).not.toHaveBeenCalled();
  });

  it("refuses anything that is not an exercise — no food in Phase 1", async () => {
    const { ctx, noteExperience } = withNotes({ experiences: brief() });
    const { transport, calls } = scripted([
      {
        tool: "note_experience",
        input: { exercise: "that new protein bar", quote: "made me bloated", soreness: "unsaid", enjoyed: "no" },
      },
      "Noted.",
    ]);
    await runAgentTurn("that new protein bar made me bloated", ctx, { transport });
    expect(toolResult(calls[1]).status).toBe("not_recorded");
    expect(noteExperience).not.toHaveBeenCalled();
  });

  it("takes one note a turn", async () => {
    const { ctx, noteExperience } = withNotes();
    const note = {
      tool: "note_experience",
      input: { exercise: "Nordic curls", quote: "hamstrings are wrecked", soreness: "severe", enjoyed: "unsaid" },
    };
    const { transport, calls } = scripted([note, note, "Keep today easy."]);
    await runAgentTurn("honestly my hamstrings are wrecked lol", ctx, { transport });
    expect(toolResult(calls[2]).status).toBe("rejected");
    expect(noteExperience).toHaveBeenCalledTimes(1);
  });

  it("is unavailable with the switch off, even if the model calls it", async () => {
    const { ctx, noteExperience } = withNotes({ experiences: brief({ enabled: false, due: asked() }) });
    const { transport, calls } = scripted([
      {
        tool: "note_experience",
        input: { exercise: "Nordic curls", quote: "hamstrings are wrecked", soreness: "severe", enjoyed: "unsaid" },
      },
      "Keep today easy.",
    ]);
    await runAgentTurn("honestly my hamstrings are wrecked lol", ctx, { transport });
    expect(toolResult(calls[1]).status).toBe("unavailable");
    expect(noteExperience).not.toHaveBeenCalled();
  });

  it("never runs on a clinical message — the model is never called, nothing is noted", async () => {
    const { ctx, noteExperience } = withNotes();
    const { transport, calls } = scripted(["should never be sent"]);
    const r = await runAgentTurn("my knee is swollen after the nordic curls", ctx, { transport });
    expect(r.source).toBe("clinical");
    expect(r.clinicalKind).toBe("symptom");
    expect(calls).toHaveLength(0);
    expect(noteExperience).not.toHaveBeenCalled();
  });

  it("reports a disordered-eating signal by kind, so the caller can keep its care flag", async () => {
    const { transport } = scripted(["should never be sent"]);
    const r = await runAgentTurn("I made myself sick after dinner again", context(), { transport });
    expect(r.clinicalKind).toBe("disordered_eating");
  });
});

describe("recall", () => {
  const planned = [
    subjectFor({ exerciseId: "hinge_09", name: "Nordic Hamstring Curl", category: "legs", difficulty: "advanced" }),
  ];

  it("appears only when the exercise is back — in today's plan", async () => {
    const withPlan = scripted(["Ready?"]);
    await runAgentTurn("what's today?", context({ experiences: brief({ records: [memory()], planned }) }), {
      transport: withPlan.transport,
    });
    const block = stateBlock(withPlan.calls[0].messages);
    expect(block).toContain("WHAT THEY TOLD YOU BEFORE");
    expect(block).toContain('"hamstrings were wrecked for two days"');

    const without = scripted(["Ready?"]);
    await runAgentTurn("what's today?", context({ experiences: brief({ records: [memory()] }) }), {
      transport: without.transport,
    });
    expect(stateBlock(without.calls[0].messages)).not.toContain("WHAT THEY TOLD YOU BEFORE");
  });

  it("lets the coach quote it with the date and the days since, and attaches a YOU TOLD ME receipt", async () => {
    const { transport, calls } = scripted([
      "Nordics are back today. On 12 Sep you said your hamstrings were wrecked for two days — that was 15 days ago, so ease into the first set.",
    ]);
    const r = await runAgentTurn("what's today?", context({ experiences: brief({ records: [memory()], planned }) }), {
      transport,
    });
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
    expect(r.message.recalls).toEqual([{ recordId: "xp_nordic", label: "Nordic Hamstring Curl", on: "2026-09-12" }]);
    expect(r.curiosity?.recalled).toEqual(["xp_nordic"]);
  });

  it("gives no receipt to a memory the reply did not use", async () => {
    const { transport } = scripted(["Lower body today — squats first."]);
    const r = await runAgentTurn("what's today?", context({ experiences: brief({ records: [memory()], planned }) }), {
      transport,
    });
    expect(r.message.recalls).toBeUndefined();
  });
});
