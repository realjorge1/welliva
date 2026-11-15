/**
 * How a coach turn ended — every exit of the loop names its outcome.
 *
 * The coach_turn event (services/telemetry/events.ts) is how "is Gozlin really
 * answering, and when it isn't, why?" gets measured. A path that forgot to set
 * its outcome would be a hole in that measurement, so each exit is driven here
 * once, and the last test checks nothing in the closed list went untested.
 */

import { readFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { COACH_TURN_OUTCOMES, coachTurnSeconds } from "../../../telemetry/events";
import { sanitize } from "../../../telemetry/Analytics";
import {
  runAgentTurn,
  type AgentTurnResult,
  type CoachTransport,
  type CoachTurnResponse,
} from "../GozlinAgent";
import type { GozlinToolContext } from "../tools";

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

const text = (t: string): CoachTurnResponse => ({
  content: [{ type: "text", text: t }],
  stop_reason: "end_turn",
});

/** Answers with each scripted response in turn (the last one repeats). */
function scripted(responses: CoachTurnResponse[]): CoachTransport {
  let n = 0;
  return async () => responses[Math.min(n++, responses.length - 1)];
}

const seen = new Set<string>();
function note(r: AgentTurnResult): AgentTurnResult {
  seen.add(r.outcome);
  return r;
}

describe("every exit names how the turn ended", () => {
  it("answered: the first draft ships", async () => {
    const r = note(await runAgentTurn("how's today?", context(), {
      transport: scripted([text("You're doing well today.")]),
    }));
    expect(r).toMatchObject({ source: "agent", outcome: "answered", toolCalls: 0 });
  });

  it("answered_after_fix_number: one rewrite for a figure it couldn't back", async () => {
    const r = note(await runAgentTurn("how am I doing on calories?", context(), {
      transport: scripted([text("You're 1,340 over."), text("You're 360 under your target.")]),
    }));
    expect(r).toMatchObject({ source: "agent", outcome: "answered_after_fix_number" });
  });

  it("ungrounded: the number check failed twice", async () => {
    const r = note(await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([text("You're 1,340 over."), text("You're 9,870 over.")]),
    }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "ungrounded" });
  });

  it("answered_after_fix_safety: one rewrite for unsafe advice", async () => {
    const r = note(await runAgentTurn("what about tonight?", context(), {
      transport: scripted([text("You should skip dinner tonight."), text("Keep dinner simple tonight.")]),
    }));
    expect(r).toMatchObject({ source: "agent", outcome: "answered_after_fix_safety" });
    expect(r.message.content).toBe("Keep dinner simple tonight.");
  });

  it("unsafe: output safety replaced the reply", async () => {
    const r = note(await runAgentTurn("what about tonight?", context(), {
      transport: scripted([text("You should skip dinner tonight."), text("You should skip lunch tomorrow.")]),
    }));
    expect(r).toMatchObject({ source: "clinical", outcome: "unsafe" });
  });

  it("unsafe, too, when the one rewrite was already spent on a number", async () => {
    const r = await runAgentTurn("how am I doing on calories?", context(), {
      transport: scripted([text("You're 1,340 over."), text("You should skip dinner tonight.")]),
    });
    expect(r.outcome).toBe("unsafe");
  });

  it("refused: the model declined", async () => {
    const r = note(await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([{ content: [], stop_reason: "refusal" }]),
    }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "refused" });
  });

  it("empty: the model returned no text", async () => {
    const r = note(await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([{ content: [], stop_reason: "end_turn" }]),
    }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "empty" });
  });

  it("malformed: asked to use tools but named none", async () => {
    const r = note(await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([{ content: [{ type: "text", text: "let me check" }], stop_reason: "tool_use" }]),
    }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "malformed", toolCalls: 0 });
  });

  it("loop_cap: tool rounds that never end, every call counted", async () => {
    const r = note(await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([
        { content: [{ type: "tool_use", id: "t", name: "not_a_tool", input: {} }], stop_reason: "tool_use" },
      ]),
    }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "loop_cap", toolCalls: 6 });
  });

  it("counts tool calls across rounds on an answered turn", async () => {
    const r = await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([
        {
          content: [
            { type: "tool_use", id: "a", name: "not_a_tool", input: {} },
            { type: "tool_use", id: "b", name: "also_not_a_tool", input: {} },
          ],
          stop_reason: "tool_use",
        },
        { content: [{ type: "tool_use", id: "c", name: "not_a_tool", input: {} }], stop_reason: "tool_use" },
        text("You're on track."),
      ]),
    });
    expect(r).toMatchObject({ outcome: "answered", toolCalls: 3 });
  });

  it("offline: a network failure", async () => {
    const down: CoachTransport = async () => {
      throw new Error("Network request failed");
    };
    const r = note(await runAgentTurn("qwerty zxcvb", context(), { transport: down }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "offline" });
  });

  it("no_backend: no connection to the coach configured", async () => {
    const r = note(await runAgentTurn("qwerty zxcvb", context(), { transport: null }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "no_backend", toolCalls: 0 });
  });

  it("cancelled: stopped before the call", async () => {
    const controller = new AbortController();
    controller.abort();
    const r = note(await runAgentTurn("qwerty zxcvb", context(), {
      transport: scripted([text("never sent")]),
      signal: controller.signal,
    }));
    expect(r).toMatchObject({ source: "deterministic", outcome: "cancelled" });
  });

  it("cancelled, not offline, when stopped mid-call", async () => {
    const controller = new AbortController();
    const aborting: CoachTransport = async () => {
      controller.abort();
      throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    };
    const r = await runAgentTurn("qwerty zxcvb", context(), {
      transport: aborting,
      signal: controller.signal,
    });
    expect(r.outcome).toBe("cancelled");
  });

  it("clinical_screen: answered before the model ran", async () => {
    let called = false;
    const r = note(await runAgentTurn("I have chest pain when I train", context(), {
      transport: async () => {
        called = true;
        return text("nope");
      },
    }));
    expect(called).toBe(false);
    expect(r).toMatchObject({ source: "clinical", outcome: "clinical_screen", toolCalls: 0 });
  });

  it("locked: the server said the coach is Pro only", async () => {
    const refused: CoachTransport = async () => {
      throw Object.assign(new Error("Pro"), { status: 403, code: "pro_required" });
    };
    const r = note(await runAgentTurn("qwerty zxcvb", context(), { transport: refused }));
    expect(r).toMatchObject({ source: "locked", outcome: "locked" });
  });

  afterAll(() => {
    // Every outcome in the closed list was produced by a real exit above.
    expect([...seen].sort()).toEqual([...COACH_TURN_OUTCOMES].sort());
  });
});

describe("the coach_turn event at the privacy boundary", () => {
  it("keeps its three props", () => {
    expect(sanitize("coach_turn", { result: "answered", tools: 2, seconds: 4.3 })).toEqual({
      event: "coach_turn",
      props: { result: "answered", tools: 2, seconds: 4.3 },
    });
  });

  it("drops anything else smuggled in beside them", () => {
    const out = sanitize("coach_turn", {
      result: "offline",
      tools: 0,
      seconds: 1.2,
      question: "how many calories in a croissant",
      reply: "about 230",
      calories: 1840,
      tool: "analyze_nutrition",
    } as never);
    expect(out?.props).toEqual({ result: "offline", tools: 0, seconds: 1.2 });
  });

  it("sends seconds to one decimal, never raw milliseconds", () => {
    expect(coachTurnSeconds(4321)).toBe(4.3);
    expect(coachTurnSeconds(4350)).toBe(4.4);
    expect(coachTurnSeconds(80)).toBe(0.1);
    expect(coachTurnSeconds(-5)).toBe(0);
    expect(coachTurnSeconds(Number.NaN)).toBe(0);
  });

  it("every outcome word fits the prop-string limit", () => {
    for (const o of COACH_TURN_OUTCOMES) {
      expect(sanitize("coach_turn", { result: o, tools: 0, seconds: 0 })?.props.result).toBe(o);
    }
  });
});

describe("the analytics_coach_quality view", () => {
  const sql = readFileSync(
    fileURLToPath(
      new URL("../../../../supabase/migrations/20261114120000_analytics_coach_quality.sql", import.meta.url),
    ),
    "utf8",
  );

  it("has a count for every outcome", () => {
    for (const o of COACH_TURN_OUTCOMES) expect(sql).toContain(`where result = '${o}')`);
  });

  it("is readable by the service role only", () => {
    expect(sql).toMatch(/revoke all on public\.analytics_coach_quality from anon, authenticated;/);
    expect(sql).toMatch(/grant select on public\.analytics_coach_quality to service_role;/);
    expect(sql).not.toMatch(/grant select[^;]*to (?:anon|authenticated)/);
  });
});
