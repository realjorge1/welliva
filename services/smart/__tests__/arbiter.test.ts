/**
 * The quiet layer — every rule that keeps eight new voices down to at most two
 * a day, and none on the days that should be silent.
 */
import { describe, expect, it } from "vitest";

import { canClaim, coolingDown, daysFrom, inQuietStart, isOutranked, pickMoment } from "../arbiter";
import type { GateState, ShownRecord, SmartAnswer, SmartCandidate } from "../types";

const TODAY = "2026-11-20";
const STATE: GateState = { today: TODAY, accountSince: "2026-10-01", roughDay: false };

const move: SmartCandidate = { id: "reminder-move:habit:h1", feature: "reminder-move", priority: 40 };
const usual: SmartCandidate = { id: "usual:breakfast", feature: "usual", priority: 50 };
const hard: SmartCandidate = { id: "hard-day:3", feature: "hard-day", priority: 60 };
const welcome: SmartCandidate = { id: "welcome-back:2026-11-20", feature: "welcome-back", priority: 100 };

const shownOn = (id: string, surface: ShownRecord["surface"], feature: ShownRecord["feature"] = "usual"): ShownRecord => ({
  date: TODAY,
  id,
  feature,
  surface,
});

describe("rivals for one screen's slot", () => {
  it("the stronger moment goes first, whichever record loaded first", () => {
    expect(isOutranked(usual, [usual, hard])).toBe(true);
    expect(isOutranked(hard, [usual, hard])).toBe(false);
  });

  it("a moment alone has no rival", () => {
    expect(isOutranked(usual, [usual])).toBe(false);
  });

  it("an answer to what they just did isn't competing for the slot", () => {
    const chain: SmartCandidate = { id: "anchor-chain:h1", feature: "anchor", priority: 55, exempt: true };
    expect(isOutranked(chain, [chain, hard])).toBe(false);
    expect(isOutranked(usual, [usual, chain])).toBe(false);
  });

  it("nothing outranks the welcome", () => {
    expect(isOutranked(welcome, [{ ...hard, priority: 200 }])).toBe(false);
  });
});

describe("the first days and rough days are silent", () => {
  it("says nothing in an account's first three days", () => {
    expect(inQuietStart({ today: TODAY, accountSince: "2026-11-18" })).toBe(true);
    expect(inQuietStart({ today: TODAY, accountSince: "2026-11-17" })).toBe(false);
    expect(pickMoment([move], "habit", [], [], { ...STATE, accountSince: "2026-11-19" })).toBeNull();
  });

  it("treats an unknown start as not new", () => {
    expect(inQuietStart({ today: TODAY, accountSince: null })).toBe(false);
  });

  it("says nothing on a rough day", () => {
    expect(pickMoment([move, usual], "home", [], [], { ...STATE, roughDay: true })).toBeNull();
  });
});

describe("the budget", () => {
  it("picks the highest priority", () => {
    expect(pickMoment([move, usual, hard], "home", [], [], STATE)?.id).toBe(hard.id);
  });

  it("gives each screen one new moment a day — and keeps it there", () => {
    const shown = [shownOn(usual.id, "home")];
    expect(pickMoment([hard], "home", shown, [], STATE)).toBeNull();
    expect(pickMoment([usual, hard], "home", shown, [], STATE)?.id).toBe(usual.id);
  });

  it("allows two across the app, not three", () => {
    const shown = [shownOn(usual.id, "home"), shownOn(hard.id, "fitness", "hard-day")];
    expect(pickMoment([move], "habit", shown, [], STATE)).toBeNull();
  });

  it("lets the same moment appear on a second screen without spending more", () => {
    const shown = [shownOn(move.id, "reminders", "reminder-move"), shownOn(usual.id, "home")];
    expect(pickMoment([move], "habit", shown, [], STATE)?.id).toBe(move.id);
  });

  it("does not count exempt moments, and lets them through", () => {
    const chain: SmartCandidate = { id: "anchor-chain:h2", feature: "anchor", priority: 30, exempt: true };
    const shown = [shownOn(usual.id, "diet"), shownOn(hard.id, "fitness", "hard-day")];
    expect(canClaim(chain, "diet", shown)).toBe(true);
    expect(pickMoment([chain], "diet", shown, [], STATE)?.id).toBe(chain.id);
  });
});

describe("welcome back", () => {
  it("outranks everything, past the budget", () => {
    const shown = [shownOn(usual.id, "home"), shownOn(hard.id, "fitness", "hard-day")];
    expect(pickMoment([usual, welcome], "home", shown, [], STATE)?.id).toBe(welcome.id);
  });

  it("is the only moment on its day", () => {
    const shown = [shownOn(welcome.id, "home", "welcome-back")];
    expect(pickMoment([move], "habit", shown, [], STATE)).toBeNull();
  });
});

describe("answers are remembered", () => {
  const kept: SmartAnswer = {
    id: move.id,
    feature: "reminder-move",
    answer: "declined",
    at: "2026-11-10T20:00:00.000Z",
    until: "2026-12-09",
  };

  it("keeps a moment quiet through its cool-down", () => {
    expect(coolingDown([kept], move.id, TODAY)).toBe(true);
    expect(pickMoment([move], "habit", [], [kept], STATE)).toBeNull();
  });

  it("lets it back the day after", () => {
    expect(coolingDown([kept], move.id, "2026-12-10")).toBe(false);
  });

  it("reads the latest answer", () => {
    const later: SmartAnswer = { ...kept, answer: "accepted", at: "2026-11-11T08:00:00.000Z", until: undefined };
    expect(coolingDown([kept, later], move.id, TODAY)).toBe(false);
  });
});

describe("daysFrom", () => {
  it("counts calendar days across a month and a clock change", () => {
    expect(daysFrom("2026-10-24", "2026-11-03")).toBe(10);
    expect(daysFrom("2026-03-28", "2026-03-30")).toBe(2);
  });
});
