/**
 * The server's copy of the coach contract must match this one, byte for byte.
 *
 * The system prompt and the tool schemas live in TWO places: here (the app's
 * mirror, which the tools are implemented against) and in the backend repo
 * (the copy that actually reaches the model — the client never sends it). They
 * drifted once already, silently: the app gained `review_tracked_habits` and a
 * "# Their habits" doctrine section, the server never did, and both files still
 * said prompt version 2026-07-26.1 — so the one guard that existed, a version
 * mismatch warning in the server log, had nothing to fire on. The live model
 * could not call a tool the app had shipped.
 *
 * A version string only catches drift someone remembered to bump for. This
 * compares the CONTENT. It runs whenever the sibling backend checkout is
 * present (../backend-welliva, where this repo's notes say it lives) and skips
 * cleanly where it isn't, so a CI box with only this repo is unaffected.
 */

import { existsSync, readFileSync } from "node:fs";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { GOZLIN_SYSTEM } from "../context";
import { TOOL_SCHEMAS } from "../tools";

const BACKEND_GOZLIN = fileURLToPath(
  new URL("../../../../../backend-welliva/src/gozlin/", import.meta.url),
);
const APP_PROVIDER = fileURLToPath(
  new URL("../../../api/RemoteGozlinProvider.ts", import.meta.url),
);
const present = existsSync(`${BACKEND_GOZLIN}system.ts`) && existsSync(`${BACKEND_GOZLIN}tools.ts`);

/** Read from source rather than importing: that module pulls in the network stack. */
function appPromptVersion(): string {
  const m = /GOZLIN_PROMPT_VERSION = "([^"]+)"/.exec(readFileSync(APP_PROVIDER, "utf8"));
  if (!m) throw new Error("GOZLIN_PROMPT_VERSION not found in RemoteGozlinProvider.ts");
  return m[1];
}

async function server() {
  const system = await import(pathToFileURL(`${BACKEND_GOZLIN}system.ts`).href);
  const tools = await import(pathToFileURL(`${BACKEND_GOZLIN}tools.ts`).href);
  return {
    GOZLIN_SYSTEM: system.GOZLIN_SYSTEM as string,
    GOZLIN_PROMPT_VERSION: system.GOZLIN_PROMPT_VERSION as string,
    TOOL_SCHEMAS: tools.TOOL_SCHEMAS as typeof TOOL_SCHEMAS,
  };
}

describe.skipIf(!present)("app ↔ server coach contract", () => {
  it("ships the identical system prompt", async () => {
    const s = await server();
    expect(s.GOZLIN_SYSTEM).toBe(GOZLIN_SYSTEM);
  });

  it("offers the model exactly the tools the app implements", async () => {
    const s = await server();
    expect(s.TOOL_SCHEMAS.map((t) => t.name)).toEqual(TOOL_SCHEMAS.map((t) => t.name));
  });

  it("describes every tool identically — descriptions steer the should-call rate", async () => {
    const s = await server();
    const byName = new Map(s.TOOL_SCHEMAS.map((t) => [t.name, t]));
    for (const t of TOOL_SCHEMAS) {
      const other = byName.get(t.name);
      expect(other?.description, t.name).toBe(t.description);
      expect(other?.input_schema, t.name).toEqual(t.input_schema);
    }
  });

  it("carries the same prompt version on both sides", async () => {
    const s = await server();
    expect(s.GOZLIN_PROMPT_VERSION).toBe(appPromptVersion());
  });

  // The server now holds client `role: "system"` messages to the shapes the
  // app sends (backend src/domain.ts). If the loop ever starts sending another
  // shape — two in a row, block content — every turn would 400 and fall to the
  // offline coach with nothing failing here. So run the REAL loop, through a
  // grounding correction, and put every request it makes through the server's
  // own schema.
  it("sends only system-message shapes the server accepts", async () => {
    const domain = await import(pathToFileURL(`${BACKEND_DOMAIN}`).href);
    const schema = domain.CoachTurnSchema as {
      safeParse: (v: unknown) => { success: boolean; error?: unknown };
    };
    const { runAgentTurn } = await import("../GozlinAgent");

    const requests: unknown[][] = [];
    const replies = ["You're 340 over.", "You're over today."];
    const r = await runAgentTurn(
      "how am I doing?",
      {
        twin: {
          asOf: "2026-07-26",
          identitySummary: "losing fat",
          flags: [],
          goal: "lose_weight",
          today: {
            calories: { consumed: 1840, target: 2200, pct: 0.84 },
            protein: { consumed: 96, target: 150, pct: 0.64 },
            water: { consumed: 1200, target: 2500, pct: 0.48 },
            workout: { planned: null, done: false, minutes: 0 },
            dayProgress: 0.5,
          },
          momentum: { streak: 12, adherence7d: 78, trainingLoad7d: 3, trend: "steady" },
          recovery: { score: 66, level: "amber", drivers: [], recommendation: "", basis: "" },
        },
        snapshot: { bio: null },
        insights: [],
        identity: { preferences: [], constraints: [], updatedAt: 0 },
        checkins: [],
        conversation: [
          { id: "u0", role: "user", content: "morning", createdAt: 1 },
          { id: "c0", role: "coach", content: "Morning — how did you sleep?", createdAt: 1 },
        ],
        weekStart: "2026-07-20",
        weeklyWorkoutTarget: 3,
        now: new Date("2026-07-26T12:00:00"),
      } as never,
      {
        transport: async (req) => {
          requests.push([...req.messages]);
          const text = replies[Math.min(requests.length - 1, replies.length - 1)];
          return { content: [{ type: "text", text }], stop_reason: "end_turn" };
        },
      },
    );

    expect(r.source).toBe("agent");
    // One plain turn, then the same turn with a correction appended.
    expect(requests).toHaveLength(2);
    for (const messages of requests) {
      const parsed = schema.safeParse({ messages, promptVersion: appPromptVersion() });
      expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
    }
  });
});

const BACKEND_DOMAIN = fileURLToPath(
  new URL("../../../../../backend-welliva/src/domain.ts", import.meta.url),
);
