/**
 * Her cycle in the coach's state block — only when she shares it.
 *
 * The brief is opt-in (consent `cycle_gozlin`, off by default), so the absent
 * case is the one that matters most: no brief, no cycle line, ever. When it is
 * shared, every figure in it must be citable — grounding is built from the
 * same object the block renders, or a correct "day 23" gets thrown away.
 */
import { describe, expect, it } from "vitest";
import type { CycleBrief } from "../../../cycle/brief";
import { twinStateMessage } from "../context";
import { runAgentTurn, type CoachTransport } from "../GozlinAgent";
import type { GozlinToolContext } from "../tools";

const TWIN = {
  asOf: "2026-07-26",
  identitySummary: "losing fat",
  flags: [],
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

const NO_IDENTITY = { preferences: [], constraints: [], updatedAt: 0 };

const BRIEF: CycleBrief = {
  lifeStage: "normal",
  cycleDay: 23,
  periodDay: null,
  phase: "luteal phase",
  nextPeriodFrom: 4,
  nextPeriodTo: 7,
  lateByDays: null,
  typicalCycleDays: 29,
  loggedToday: ["headache", "energy: low"],
};

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

describe("the cycle in Gozlin's state block", () => {
  it("is absent unless she shared it", () => {
    const state = String(twinStateMessage(TWIN, { snapshot: { bio: null } as never, identity: NO_IDENTITY }).content);
    expect(state).not.toMatch(/CYCLE|period/i);
  });

  it("carries the day, the window and today's log when she did", () => {
    const state = String(
      twinStateMessage(TWIN, { snapshot: { bio: null } as never, identity: NO_IDENTITY, cycle: BRIEF }).content,
    );
    expect(state).toContain("HER CYCLE (she chose to share this");
    expect(state).toContain("- cycle day 23 (luteal phase)");
    expect(state).toContain("- next period likely in 4–7 days (an estimate)");
    expect(state).toContain("- logged today: headache, energy: low");
  });

  it("lets the coach quote a figure from it", async () => {
    const transport: CoachTransport = async () => ({
      content: [{ type: "text", text: "You're on day 23, so a lighter session is a fair call." }],
      stop_reason: "end_turn",
    });
    const r = await runAgentTurn("why am I so tired?", context({ cycle: BRIEF }), { transport });
    expect(r.source).toBe("agent");
    expect(r.message.content).toContain("day 23");
  });
});
