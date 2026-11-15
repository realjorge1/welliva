/**
 * A longer memory for Gozlin — earlier conversations, derived from the chat
 * history on the phone (services/gozlin/pastChats.ts).
 *
 * The goal is one sentence: Gozlin can say "on Friday 3 October we talked about
 * your knee on squats, and you were going to try box squats; how did that go?"
 * The rules are what keep that sentence honest and safe: no figures, nothing
 * from a crisis conversation, no "eat less" plans followed up, a hard cap, and
 * Forget means forget.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";
import { clearGozlinMemory, type ArchivedConversation } from "../GozlinMemoryStore";
import type { GozlinMessage } from "../gozlin.types";
import type { ExperienceRecord } from "../novelty/types";
import {
  MAX_THREADS,
  PAST_CHAT_FORGOTTEN_KEY,
  derivePastChats,
  forgetPastChat,
  loadForgottenPastChats,
  pastChatLines,
  pastChatSummary,
  sayChatDay,
  selectPastChats,
  triesIn,
} from "../pastChats";
import { twinStateMessage } from "../agent/context";
import { runAgentTurn, type CoachTransport } from "../agent/GozlinAgent";
import type { GozlinToolContext } from "../agent/tools";

const NOW = new Date(2026, 9, 20, 12, 0); // Tue 20 Oct 2026
const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h, 0).getTime();

let seq = 0;
const u = (content: string, t = 0): GozlinMessage => ({ id: `u${seq++}`, role: "user", content, createdAt: t });
const c = (content: string, t = 0): GozlinMessage => ({ id: `c${seq++}`, role: "coach", content, createdAt: t });

function thread(id: string, title: string, endedAt: number, messages: GozlinMessage[]): ArchivedConversation {
  return { id, title, messages, startedAt: endedAt - 10 * 60_000, endedAt };
}

const KNEE = thread("knee", "Knee pain on squats", at(2026, 10, 3), [
  u("my knee hurts when I squat deep"),
  c("That's worth easing off. You could try box squats instead, they let you control depth."),
  u("ok I'll try that"),
]);

describe("what they said they'd try", () => {
  it("takes their own words", () => {
    expect(triesIn([u("I'll try box squats tomorrow")])).toEqual(["box squats"]);
    expect(triesIn([u("I'm going to try yoga before work.")])).toEqual(["yoga before work"]);
    expect(triesIn([u("I'll give swimming a go")])).toEqual(["swimming"]);
  });

  it("takes the coach's suggestion when they said 'I'll try that'", () => {
    expect(triesIn(KNEE.messages)).toEqual(["box squats"]);
  });

  it("drops anything with a figure, never rewording it", () => {
    expect(triesIn([u("I'll try 5k runs")])).toEqual([]);
    expect(triesIn([u("I'll try three sets of ten")])).toEqual([]);
  });

  it("never keeps a plan to eat less", () => {
    expect(triesIn([u("I'll try skipping breakfast")])).toEqual([]);
    expect(triesIn([u("I'm going to try fasting until noon")])).toEqual([]);
    expect(triesIn([u("I'll try eating less at night")])).toEqual([]);
  });

  it("keeps at most two", () => {
    expect(triesIn([u("I'll try yoga. I'll try swimming. I'll try pilates.")])).toHaveLength(2);
  });
});

describe("deriving past chats", () => {
  it("gives the day, the topic and what they said they'd try", () => {
    const [k] = derivePastChats({ archive: [KNEE], now: NOW });
    expect(k).toMatchObject({ id: "knee", day: "2026-10-03", title: "Knee pain on squats", tries: ["box squats"] });
  });

  it("links a 'tried something new' note made during the chat", () => {
    const note = {
      id: "e1",
      label: "Nordic curls",
      answeredAt: new Date(KNEE.endedAt - 5 * 60_000).toISOString(),
      forgotten: false,
    } as ExperienceRecord;
    const later = { ...note, id: "e2", label: "Hip thrusts", answeredAt: new Date(KNEE.endedAt + 86_400_000).toISOString() };
    const [k] = derivePastChats({ archive: [KNEE], experiences: [note, later], now: NOW });
    expect(k.notes).toEqual(["Nordic curls"]);
  });

  it("links a fact they asked Gozlin to remember when it came up there", () => {
    const [k] = derivePastChats({
      archive: [KNEE],
      identity: { constraints: ["knee hurts when squatting", "no gym on Sundays"], preferences: [] },
      now: NOW,
    });
    expect(k.facts).toEqual(["knee hurts when squatting"]);
  });

  it("leaves out a chat they told Gozlin to forget", () => {
    expect(derivePastChats({ archive: [KNEE], forgotten: ["knee"], now: NOW })).toEqual([]);
  });

  it("leaves out chats too old to bring up", () => {
    const old = thread("old", "Protein intake", at(2026, 4, 1), [u("how much protein do I need")]);
    expect(derivePastChats({ archive: [old], now: NOW })).toEqual([]);
  });

  it("never brings back a conversation the safety screen caught", () => {
    const crisis = thread("crisis", "Chest pain", at(2026, 10, 10), [u("I have chest pain when I train")]);
    expect(derivePastChats({ archive: [crisis, KNEE], now: NOW }).map((p) => p.id)).toEqual(["knee"]);
  });

  it("drops a title holding a figure", () => {
    const t = thread("p", "Hitting 150g protein", at(2026, 10, 12), [u("how do I hit 150g protein"), u("I'll try greek yogurt")]);
    const [p] = derivePastChats({ archive: [t], now: NOW });
    expect(p.title).toBeNull();
    expect(p.tries).toEqual(["greek yogurt"]);
  });
});

describe("choosing what one turn carries", () => {
  const many = Array.from({ length: 10 }, (_, i) =>
    thread(`t${i}`, "Meal ideas", at(2026, 10, 10 + i), [u("what should I cook tonight")]),
  );

  it("never carries more than the cap", () => {
    const chats = derivePastChats({ archive: [...many, KNEE], now: NOW });
    expect(selectPastChats(chats, "hello")).toHaveLength(MAX_THREADS);
  });

  it("brings the chat that matches what they asked, even when it isn't the latest", () => {
    const chats = derivePastChats({ archive: [...many, KNEE], now: NOW });
    expect(selectPastChats(chats, "my knee is sore again after squats").map((p) => p.id)).toContain("knee");
    expect(selectPastChats(chats, "hello").map((p) => p.id)).not.toContain("knee");
  });
});

describe("the state-block lines", () => {
  it("are empty when there is nothing to remember, so the block is unchanged", () => {
    expect(pastChatLines([], "hi")).toEqual([]);
    expect(pastChatLines(undefined, "hi")).toEqual([]);
  });

  it("say the day, the topic and the plan — and no figure but the date", () => {
    const lines = pastChatLines(derivePastChats({ archive: [KNEE], now: NOW }), "knee");
    const body = lines.join("\n");
    expect(body).toContain("EARLIER CONVERSATIONS");
    expect(body).toContain('- Saturday 3 October: "Knee pain on squats"; they said they\'d try box squats');
    // Strip the written dates; nothing numeric may remain.
    expect(body.replace(/\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December)\b/g, "")).not.toMatch(/\d/);
  });

  it("writes a date the number check reads as a date", () => {
    expect(sayChatDay("2026-10-03")).toBe("Saturday 3 October");
  });

  it("summarises for the Memory screen and the export", () => {
    const [k] = derivePastChats({ archive: [KNEE], now: NOW });
    expect(pastChatSummary(k)).toBe("You said you'd try box squats");
  });
});

// ── With the coach ──────────────────────────────────────────────────────────

const TWIN = {
  asOf: "2026-10-20T12:00:00",
  identitySummary: "building strength",
  flags: [],
  goal: "build_muscle",
  today: {
    calories: { consumed: 1840, target: 2200, pct: 0.84 },
    protein: { consumed: 96, target: 150, pct: 0.64 },
    water: { consumed: 1200, target: 2500, pct: 0.48 },
    workout: { planned: "Lower body", done: false, minutes: 40 },
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
    weekStart: "2026-10-19",
    weeklyWorkoutTarget: 3,
    now: NOW,
    ...over,
  } as GozlinToolContext;
}

describe("Gozlin with a longer memory", () => {
  const pastChats = derivePastChats({ archive: [KNEE], now: NOW });

  it("sees the earlier conversation in its state block", () => {
    const block = String(twinStateMessage(TWIN, context({ pastChats }), "squats today?").content);
    expect(block).toContain("they said they'd try box squats");
  });

  it("can say the day and ask how it went — the date is not an unbacked figure", async () => {
    const reply = "On Saturday 3 October you were going to try box squats. How did that go?";
    let calls = 0;
    const transport: CoachTransport = async () => {
      calls++;
      return { content: [{ type: "text", text: reply }], stop_reason: "end_turn" };
    };
    const r = await runAgentTurn("squats today?", context({ pastChats }), { transport });
    expect(calls).toBe(1);
    expect(r.outcome).toBe("answered");
    expect(r.message.content).toBe(reply);
    expect((r.message.receipts ?? []).map((x) => x.shown)).not.toContain(3);
  });

  it("gives memory no power to back a number", async () => {
    let calls = 0;
    const transport: CoachTransport = async () => {
      calls++;
      return {
        content: [{ type: "text", text: calls === 1 ? "Last time you box squatted 135 kg." : "How did the box squats feel?" }],
        stop_reason: "end_turn",
      };
    };
    const r = await runAgentTurn("squats today?", context({ pastChats }), { transport });
    expect(calls).toBe(2);
    expect(r.outcome).toBe("answered_after_fix_number");
  });
});

describe("forgetting", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(PAST_CHAT_FORGOTTEN_KEY);
  });

  it("Forget on the Memory screen is kept, once", async () => {
    await forgetPastChat("knee");
    await forgetPastChat("knee");
    expect(await loadForgottenPastChats()).toEqual(["knee"]);
  });

  it("'Forget everything' clears it with the rest of Gozlin's memory", async () => {
    await forgetPastChat("knee");
    await clearGozlinMemory();
    expect(await AsyncStorage.getItem(PAST_CHAT_FORGOTTEN_KEY)).toBeNull();
  });
});
