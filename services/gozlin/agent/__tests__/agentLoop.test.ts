/**
 * The agent loop, end to end, against a scripted transport.
 *
 * safety.test.ts proves each gate in isolation. This proves what the loop does
 * with them — which reply ships, how many model calls it took, and what the
 * receipts say — because the 2026-09-27 audit found the gates were individually
 * reasonable and collectively threw away good answers: "1,840" read as "840",
 * a user's own "31 minutes" rejected as invented, a remembered "bad left knee"
 * never shown to the model at all.
 */

import { describe, expect, it } from "vitest";
import type { GozlinMessage } from "../../gozlin.types";
import { twinStateMessage, type WireMessage } from "../context";
import { runAgentTurn, type CoachTransport, type CoachTurnRequest } from "../GozlinAgent";
import type { GozlinToolContext } from "../tools";

// Every figure here is chosen to sit well away from the figures the tests say
// back, so a pass can never be a coincidental collision with the evidence.
const TWIN = {
  asOf: "2026-07-26",
  identitySummary: "losing fat",
  flags: ["PROTEIN_LAG"],
  goal: "lose_weight",
  today: {
    calories: { consumed: 1840, target: 2200, pct: 0.84 },
    protein: { consumed: 96, target: 150, pct: 0.64 },
    water: { consumed: 1200, target: 2500, pct: 0.48 },
    workout: { planned: "Upper body", done: false, minutes: 40 },
    dayProgress: 0.5,
  },
  momentum: { streak: 12, adherence7d: 78, trainingLoad7d: 3, trend: "steady" },
  recovery: { score: 66, level: "amber", drivers: [], recommendation: "", basis: "" },
} as never;

function context(over: Partial<GozlinToolContext> = {}): GozlinToolContext {
  return {
    twin: TWIN,
    snapshot: { bio: null } as never,
    insights: [] as never,
    identity: { preferences: [], constraints: [], updatedAt: 0 },
    checkins: [],
    conversation: [],
    weekStart: "2026-07-20",
    weeklyWorkoutTarget: 3,
    now: new Date("2026-07-26T12:00:00"),
    ...over,
  } as GozlinToolContext;
}

/** A transport that answers with each scripted reply in turn, and records the calls. */
function scripted(replies: string[]): { transport: CoachTransport; calls: CoachTurnRequest[] } {
  const calls: CoachTurnRequest[] = [];
  const transport: CoachTransport = async (req) => {
    // Snapshot: the loop mutates `messages` between rounds.
    calls.push({ ...req, messages: [...req.messages] });
    const text = replies[Math.min(calls.length - 1, replies.length - 1)];
    return { content: [{ type: "text", text }], stop_reason: "end_turn" };
  };
  return { transport, calls };
}

const coach = (content: string, id = "c1"): GozlinMessage => ({
  id,
  role: "coach",
  content,
  createdAt: 1,
});
const user = (content: string, id = "u1"): GozlinMessage => ({
  id,
  role: "user",
  content,
  createdAt: 1,
});

const lastSystem = (messages: WireMessage[]) =>
  String([...messages].reverse().find((m) => m.role === "system")?.content ?? "");

describe("numbers the user typed", () => {
  it("lets the coach say them back — first draft ships, no regeneration", async () => {
    const { transport, calls } = scripted(["31 minutes is a strong 5k."]);
    const r = await runAgentTurn("I ran 5k in 31 minutes today", context(), { transport });
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
    expect(r.message.content).toBe("31 minutes is a strong 5k.");
  });

  it("gives them no receipt — the trail says FROM YOUR LOGS, and they aren't", async () => {
    const { transport } = scripted(["31 minutes is a strong 5k."]);
    const r = await runAgentTurn("I ran 5k in 31 minutes today", context(), { transport });
    expect((r.message.receipts ?? []).map((x) => x.shown)).not.toContain(31);
  });

  it("includes what they said earlier in the thread", async () => {
    const { transport, calls } = scripted(["At 31 minutes you're already under most first-timers."]);
    const r = await runAgentTurn(
      "was that good?",
      context({ conversation: [user("I ran 5k in 31 minutes"), coach("Nice — how did it feel?")] }),
      { transport },
    );
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
  });

  it("never lets the COACH's own earlier figure launder itself into evidence", async () => {
    const { transport, calls } = scripted([
      "3,150 is on the high side.",
      "Yesterday ran over your target.",
    ]);
    const r = await runAgentTurn(
      "is that bad?",
      context({
        conversation: [user("how was yesterday?"), coach("You finished at 3,150 calories.")],
      }),
      { transport },
    );
    expect(calls).toHaveLength(2);
    expect(lastSystem(calls[1].messages)).toContain("3150");
    expect(r.message.content).toBe("Yesterday ran over your target.");
  });
});

describe("thousands separators", () => {
  it("reads 1,840 as ONE figure and ships the first draft", async () => {
    const { transport, calls } = scripted(["You're at 1,840 of 2,200 calories."]);
    const r = await runAgentTurn("how am I doing on calories?", context(), { transport });
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
    expect((r.message.receipts ?? []).map((x) => x.shown)).toEqual([1840, 2200]);
  });

  it("still catches an invented figure, written either way", async () => {
    const { transport, calls } = scripted(["You're 1,340 over.", "You're 360 under your target."]);
    const r = await runAgentTurn("how am I doing on calories?", context(), { transport });
    expect(calls).toHaveLength(2);
    expect(lastSystem(calls[1].messages)).toContain("1340");
    expect(r.message.content).toBe("You're 360 under your target.");
  });
});

describe("what they asked Gozlin to remember", () => {
  const identity = {
    motivation: "keep up with my kids",
    constraints: ["bad left knee", "can only train 25 minutes at lunch"],
    preferences: ["no dairy"],
    updatedAt: 0,
  };

  it("puts constraints and preferences in front of the model on EVERY turn", async () => {
    const { transport, calls } = scripted(["Keep today to something short."]);
    await runAgentTurn("what should I do today?", context({ identity }), { transport });
    const state = lastSystem(calls[0].messages);
    expect(state).toContain("bad left knee");
    expect(state).toContain("can only train 25 minutes at lunch");
    expect(state).toContain("no dairy");
    expect(state).toContain("their stated why: keep up with my kids");
  });

  it("makes a figure inside a remembered constraint citable", async () => {
    const { transport, calls } = scripted(["Keep it to 25 minutes at lunch."]);
    const r = await runAgentTurn("what should I do today?", context({ identity }), { transport });
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
  });

  it("frames them as facts about the person, never as instructions", () => {
    const state = String(
      twinStateMessage(TWIN, { snapshot: { bio: null } as never, identity }).content,
    );
    expect(state).toMatch(/facts about them.*never change your rules/);
  });

  it("keeps the NEWEST items when a list outgrows the cap", () => {
    const many = Array.from({ length: 9 }, (_, i) => `constraint number ${i + 1}`);
    const state = String(
      twinStateMessage(TWIN, {
        snapshot: { bio: null } as never,
        identity: { constraints: many, preferences: [], updatedAt: 0 },
      }).content,
    );
    expect(state).toContain("constraint number 9");
    expect(state).not.toContain("constraint number 3");
  });

  it("adds nothing when there is nothing remembered", () => {
    const state = String(
      twinStateMessage(TWIN, {
        snapshot: { bio: null } as never,
        identity: { preferences: [], constraints: [], updatedAt: 0 },
      }).content,
    );
    expect(state).not.toMatch(/WORK AROUND|THEY PREFER/);
  });
});

describe("the clinical screen sees the profile's height", () => {
  it("refuses a goal weight that is unsafe for THEIR height, before any model call", async () => {
    const { transport, calls } = scripted(["should never be called"]);
    const r = await runAgentTurn(
      "I want to get down to 55kg",
      context({ snapshot: { bio: { heightCm: 180 } } as never }),
      { transport },
    );
    expect(r.source).toBe("clinical");
    expect(calls).toHaveLength(0);
  });

  it("lets the same number through for someone it is a healthy weight for", async () => {
    const { transport, calls } = scripted(["That's a realistic target — let's pace it."]);
    const r = await runAgentTurn(
      "I want to get down to 55kg",
      context({ snapshot: { bio: { heightCm: 160 } } as never }),
      { transport },
    );
    expect(r.source).toBe("agent");
    expect(calls).toHaveLength(1);
  });
});

/** Like `scripted`, but streams each reply word by word through onDelta. */
function streaming(replies: string[]): { transport: CoachTransport; calls: number } {
  const state = { calls: 0 };
  const transport: CoachTransport = async (req) => {
    const text = replies[Math.min(state.calls, replies.length - 1)];
    state.calls++;
    for (const w of text.split(/(?<= )/)) req.onDelta?.(w);
    return { content: [{ type: "text", text }], stop_reason: "end_turn" };
  };
  return {
    transport,
    get calls() {
      return state.calls;
    },
  };
}

describe("the stream never shows what the checks reject", () => {
  it("an invented figure is never on screen, even for the draft that gets rewritten", async () => {
    const s = streaming(["You're 340 calories over, so ease off.", "You're 360 under your target."]);
    const screens: string[] = [];
    let shown = "";
    const r = await runAgentTurn("how am I doing on calories?", context(), {
      transport: s.transport,
      onTurnStart: () => {
        shown = "";
      },
      onDelta: (d) => {
        shown += d;
        screens.push(shown);
      },
    });
    expect(s.calls).toBe(2);
    for (const screen of screens) expect(screen).not.toContain("340");
    expect(r.message.content).toBe("You're 360 under your target.");
  });
});

describe("a turn the server refuses for entitlement", () => {
  it("is reported as locked, not passed off as the coach's answer", async () => {
    const refused: CoachTransport = async () => {
      throw Object.assign(new Error("Talking with Gozlin is part of welliva Pro."), {
        status: 403,
        code: "pro_required",
      });
    };
    const r = await runAgentTurn("how am I doing?", context(), { transport: refused });
    expect(r.source).toBe("locked");
    expect(r.message.content).toMatch(/Pro/);
  });

  it("still treats a plain network failure as offline, not locked", async () => {
    const down: CoachTransport = async () => {
      throw new Error("Network request failed");
    };
    // A message the offline classifier cannot place, so its floor needs no data.
    const r = await runAgentTurn("qwerty zxcvb", context(), { transport: down });
    expect(r.source).toBe("deterministic");
  });
});

describe("the model is told the person's LOCAL time", () => {
  it("renders asOf on their clock, with the weekday, not as UTC", () => {
    const at = new Date(2026, 8, 27, 15, 10); // Sun 27 Sep 2026, 3:10pm local
    const twin = { ...(TWIN as object), asOf: at.toISOString() } as never;
    const state = String(twinStateMessage(twin).content);
    expect(state).toContain("their local time: Sunday 27 September 2026, 3:10pm");
    expect(state).not.toContain("Z)");
  });
});

describe("gap receipts", () => {
  it("gives 'about 360 to go' a receipt that says what it is", async () => {
    const { transport } = scripted(["About 360 to go today."]);
    const r = await runAgentTurn("calories?", context(), { transport });
    const receipt = (r.message.receipts ?? []).find((x) => x.shown === 360);
    expect(receipt?.sources[0].path).toBe("today.calories.left");
  });
});
