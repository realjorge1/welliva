/**
 * What the learning models know, in Gozlin's state block.
 *
 * Three things must hold. Each model's own gate decides what is sayable — a
 * half-formed estimate never reaches the coach as a number. Every figure the
 * block shows is citable, because grounding reads the same brief. And a figure
 * the block did NOT show is still rejected as invented.
 */
import { describe, expect, it } from "vitest";
import type { IntelligenceSnapshot } from "../../../../health-os";
import { twinStateMessage } from "../context";
import { runAgentTurn, type CoachTransport } from "../GozlinAgent";
import { buildLearnedBrief, learnedStateLines, type LearnedBrief } from "../learned";
import { collectWithProvenance, createLedger, receiptsFor, sourceLabel } from "../receipts";
import type { GozlinToolContext } from "../tools";

const TODAY = "2026-11-14";

function snap(over: Partial<IntelligenceSnapshot> = {}): IntelligenceSnapshot {
  return {
    ready: true,
    confidence: 0.4,
    models: [],
    tdee: null,
    training: { fitted: false, sessions: 3, readiness: 70, tau2: 7 },
    adherence: { probability: null, atRisk: false, samples: 4, action: { kind: "proceed" } },
    outcomes: { total: 0, resolved: 0, pending: 0, successRate: null, ignored: 0, ineffective: 0 },
    delivery: { personalization: 0, best: null, evidence: 0 },
    drift: null,
    ...over,
  };
}

const CONFIDENT_TDEE = {
  learned: 2240,
  uncertainty: 120,
  mifflin: 2510,
  confident: true,
  observations: 31,
  disclosure: null,
};

describe("buildLearnedBrief — each model's own gate", () => {
  it("says nothing before there is any history", () => {
    expect(buildLearnedBrief(null, { today: TODAY })).toBeUndefined();
    expect(buildLearnedBrief(snap({ ready: false }), { today: TODAY })).toBeUndefined();
  });

  it("carries learned maintenance only once the calorie model is confident", () => {
    const b = buildLearnedBrief(snap({ tdee: CONFIDENT_TDEE }), { today: TODAY });
    expect(b?.maintenance).toEqual({ kcal: 2240, plusMinus: 120, signupKcal: 2510, weighIns: 31 });
    expect(b?.maintenanceLearning).toBeUndefined();
  });

  it("reports progress, never a number, while the calorie model is still learning", () => {
    const early = buildLearnedBrief(
      snap({ tdee: { ...CONFIDENT_TDEE, confident: false, observations: 6 } }),
      { today: TODAY },
    );
    expect(early?.maintenance).toBeUndefined();
    expect(early?.maintenanceLearning).toEqual({ weighIns: 6, needed: 14 });

    // Past the minimum but the spread hasn't settled: no "20 of 14".
    const settling = buildLearnedBrief(
      snap({ tdee: { ...CONFIDENT_TDEE, confident: false, observations: 20 } }),
      { today: TODAY },
    );
    expect(settling?.maintenanceLearning).toEqual({ weighIns: 20, needed: null });

    // No filter state at all yet.
    expect(buildLearnedBrief(snap(), { today: TODAY })?.maintenanceLearning).toEqual({
      weighIns: 0,
      needed: 14,
    });
  });

  it("drops the signup figure when there was no profile to compute it", () => {
    const b = buildLearnedBrief(snap({ tdee: { ...CONFIDENT_TDEE, mifflin: 0 } }), { today: TODAY });
    expect(b?.maintenance?.signupKcal).toBeNull();
  });

  it("carries the fatigue curve only once it is fitted", () => {
    expect(buildLearnedBrief(snap(), { today: TODAY })?.training).toBeUndefined();
    const b = buildLearnedBrief(
      snap({ training: { fitted: true, sessions: 18, readiness: 64, tau2: 2.3 } }),
      { today: TODAY },
    );
    expect(b?.training).toEqual({ fatigueClearsDays: 2.3, sessions: 18 });
  });

  it("flags tomorrow only when the adherence model itself decided to shrink", () => {
    expect(buildLearnedBrief(snap(), { today: TODAY })?.tomorrowAtRisk).toBeUndefined();
    const b = buildLearnedBrief(
      snap({
        adherence: {
          probability: 0.3,
          atRisk: true,
          samples: 25,
          action: { kind: "shrink", scale: 0.65, reason: "x" },
        },
      }),
      { today: TODAY },
    );
    expect(b?.tomorrowAtRisk).toBe(true);
  });

  it("names a register only after enough results came in", () => {
    const best = { arm: "nudge:gentle" as const, mean: 0.7 };
    const thin = buildLearnedBrief(
      snap({ delivery: { personalization: 0.1, best, evidence: 3 }, outcomes: { ...snap().outcomes, resolved: 5 } }),
      { today: TODAY },
    );
    expect(thin?.approach).toBeUndefined();
    const enough = buildLearnedBrief(
      snap({ delivery: { personalization: 0.4, best, evidence: 9 }, outcomes: { ...snap().outcomes, resolved: 24 } }),
      { today: TODAY },
    );
    expect(enough?.approach).toBe("nudge:gentle");
  });

  it("keeps a behaviour shift only while it is recent", () => {
    const shift = (date: string) =>
      buildLearnedBrief(
        snap({
          drift: { at: 40, direction: "decline", magnitude: 2, metric: "session_completed", label: "your training", date },
        }),
        { today: TODAY },
      )?.shift;
    expect(shift("2026-11-02")).toEqual({ area: "your training", direction: "decline", daysAgo: 12 });
    expect(shift("2026-09-01")).toBeUndefined();
    expect(shift("")).toBeUndefined();
  });
});

describe("learnedStateLines", () => {
  it("adds nothing when there is no brief", () => {
    expect(learnedStateLines(undefined)).toEqual([]);
    expect(learnedStateLines({})).toEqual([]);
  });

  it("frames maintenance as a reading of their logs, and never as a reason to eat less", () => {
    const text = learnedStateLines(buildLearnedBrief(snap({ tdee: CONFIDENT_TDEE }), { today: TODAY })).join("\n");
    expect(text).toContain("WHAT THE APP HAS LEARNED ABOUT THEM");
    expect(text).toContain("maintenance by their logs: about 2240 kcal/day (±120)");
    expect(text).toContain("the signup formula said 2510");
    expect(text).toContain('never "you burn"');
    expect(text).toContain("still set from the signup formula");
    expect(text).toContain("never tell them to eat below their target");
  });

  it("asks for a smaller tomorrow without telling them they'll miss it", () => {
    const text = learnedStateLines({ tomorrowAtRisk: true }).join("\n");
    expect(text).toContain("make it smaller");
    expect(text).toContain("Never tell them they are likely to miss it");
  });
});

// ── Through the state block and the agent loop ─────────────────────

const TWIN = {
  asOf: "2026-11-14",
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

const LEARNED: LearnedBrief = {
  maintenance: { kcal: 2240, plusMinus: 120, signupKcal: 2510, weighIns: 31 },
};

function context(over: Partial<GozlinToolContext> = {}): GozlinToolContext {
  return {
    twin: TWIN,
    snapshot: { bio: null } as never,
    insights: [] as never,
    identity: NO_IDENTITY,
    checkins: [],
    conversation: [],
    weekStart: "2026-11-09",
    weeklyWorkoutTarget: 3,
    now: new Date("2026-11-14T12:00:00"),
    ...over,
  } as GozlinToolContext;
}

const REPLY = "By your logs your maintenance is about 2,240, so 2,200 is close to holding steady.";
const replying = (text: string): CoachTransport => async () => ({
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
});

describe("learned figures in the coach", () => {
  it("are in the state block only when there is a brief", () => {
    const without = String(twinStateMessage(TWIN, { snapshot: { bio: null } as never, identity: NO_IDENTITY }).content);
    expect(without).not.toContain("WHAT THE APP HAS LEARNED");
    const withBrief = String(
      twinStateMessage(TWIN, { snapshot: { bio: null } as never, identity: NO_IDENTITY, learned: LEARNED }).content,
    );
    expect(withBrief).toContain("maintenance by their logs: about 2240 kcal/day");
  });

  it("may be quoted once shown", async () => {
    const r = await runAgentTurn("why isn't my weight moving?", context({ learned: LEARNED }), {
      transport: replying(REPLY),
    });
    expect(r.source).toBe("agent");
    expect(r.message.content).toContain("2,240");
  });

  it("are still rejected as invented when the block never showed them", async () => {
    // A message the offline classifier cannot place, so the floor it falls back
    // to needs no data (the same trick agentLoop.test.ts uses).
    const r = await runAgentTurn("qwerty zxcvb", context(), { transport: replying(REPLY) });
    expect(r.source).toBe("deterministic");
    expect(r.message.content).not.toContain("2,240");
  });

  it("open a receipt that says where they came from", () => {
    const ledger = createLedger();
    collectWithProvenance(LEARNED, "learning", ledger);
    const receipt = receiptsFor("about 2,240 by your logs", ledger).find((x) => x.shown === 2240);
    expect(receipt?.sources[0].origin).toBe("learning");
    expect(sourceLabel(receipt!.sources[0])).toBe("Maintenance by your logs (kcal/day)");
  });
});
