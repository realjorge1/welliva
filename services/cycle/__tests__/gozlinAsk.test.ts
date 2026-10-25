/**
 * "LET GOZLIN SEE YOUR CYCLE?" — the timing, which is the whole design.
 *
 * `cycle_gozlin` was off by default with nothing that ever surfaced it, so this
 * ask is the only thing standing between a paying user and a coach that is
 * blind on the day it matters. Its value is entirely in WHEN it appears: a
 * consent prompt on an ordinary Tuesday is the settings toggle again, with worse
 * manners.
 *
 * What's held here: it asks only on a day the answer would obviously change
 * something; it never asks in the same breath as setting tracking up; "not now"
 * is permanent; it gives up rather than becoming furniture; and it never asks
 * someone who has already said yes.
 */
import { describe, expect, it } from "vitest";

import { gozlinAsk, type GozlinAskReason } from "../brief";
import type { CycleToday } from "../predict";
import {
  DEFAULT_CYCLE_SETTINGS,
  GOZLIN_ASK_LIMIT,
  type CycleDayLog,
  type CycleSettings,
} from "../types";

const TODAY = "2026-10-21";

const settings = (over: Partial<CycleSettings> = {}): CycleSettings => ({
  ...DEFAULT_CYCLE_SETTINGS,
  enabled: true,
  // Turned on a fortnight ago, so the "not in the same breath" rule is clear.
  enabledAt: "2026-10-07T09:00:00.000Z",
  ...over,
});

const status = (over: Partial<CycleToday> = {}): CycleToday =>
  ({
    mode: "normal",
    cycleDay: 14,
    periodDay: null,
    inPeriod: false,
    periodOpen: false,
    periodStale: false,
    expectedEnd: null,
    phase: "luteal",
    predicting: true,
    toEarliest: 10,
    toLatest: 13,
    lateBy: 0,
    ringDays: 28,
    ...over,
  }) as CycleToday;

const log = (over: Partial<CycleDayLog> = {}): CycleDayLog => ({
  date: TODAY,
  updatedAt: "2026-10-21T10:00:00.000Z",
  ...over,
});

function ask(over: Partial<Parameters<typeof gozlinAsk>[0]> = {}) {
  return gozlinAsk({
    settings: settings(),
    sharing: false,
    mode: "normal",
    status: status(),
    todayLog: log({ symptoms: ["cramps"] }),
    today: TODAY,
    ...over,
  });
}

describe("when it asks", () => {
  const moments: [GozlinAskReason, Partial<Parameters<typeof gozlinAsk>[0]>][] = [
    ["cramps", { todayLog: log({ symptoms: ["cramps"] }) }],
    ["heavy", { todayLog: log({ flow: "heavy" }) }],
    ["late", { todayLog: undefined, status: status({ lateBy: 3 }) }],
    [
      "period",
      {
        todayLog: undefined,
        status: status({ inPeriod: true, periodDay: 1, periodOpen: true, phase: "period" }),
      },
    ],
    ["mood", { todayLog: log({ mood: "low" }) }],
    ["energy", { todayLog: log({ energy: "low" }) }],
  ];

  for (const [reason, input] of moments) {
    it(`asks on a ${reason} day, in words about it`, () => {
      const out = ask(input);
      expect(out?.reason).toBe(reason);
      expect(out?.headline.length).toBeGreaterThan(8);
      // Every version says the thing that makes it a question, not a toggle.
      expect(out?.detail).toContain("unless you say so");
    });
  }

  it("leads with the hardest fact when several are true at once", () => {
    expect(
      ask({ todayLog: log({ symptoms: ["cramps"], flow: "heavy", mood: "low" }) })?.reason,
    ).toBe("cramps");
    expect(ask({ todayLog: log({ flow: "heavy", mood: "low" }) })?.reason).toBe("heavy");
  });
});

describe("when it stays quiet", () => {
  it("says nothing on an ordinary mid-cycle day", () => {
    expect(ask({ todayLog: undefined })).toBeNull();
    expect(ask({ todayLog: log({ mood: "great", energy: "steady" }) })).toBeNull();
  });

  it("says nothing to someone who already said yes", () => {
    expect(ask({ sharing: true })).toBeNull();
  });

  it("says nothing once she has said not now", () => {
    expect(ask({ settings: settings({ gozlinAskDismissed: true }) })).toBeNull();
  });

  it("says nothing when she isn't tracking", () => {
    expect(ask({ settings: settings({ enabled: false }) })).toBeNull();
  });

  it("says nothing during pregnancy — there is nothing to share", () => {
    expect(ask({ mode: "pregnancy" })).toBeNull();
  });

  it("never asks on the day tracking was turned on", () => {
    // Two questions about her body, then a third about sending it somewhere,
    // in the same minute. That's momentum, not consent.
    expect(ask({ settings: settings({ enabledAt: `${TODAY}T08:00:00.000Z` }) })).toBeNull();
    // The next day is fair.
    expect(ask({ settings: settings({ enabledAt: "2026-10-20T08:00:00.000Z" }) })).not.toBeNull();
  });

  it("asks even when enabledAt was never recorded", () => {
    expect(ask({ settings: settings({ enabledAt: null }) })).not.toBeNull();
  });

  it("does not treat spotting or a light flow as the moment", () => {
    expect(ask({ todayLog: log({ flow: "spotting" }) })).toBeNull();
    expect(ask({ todayLog: log({ flow: "light" }) })).toBeNull();
  });

  it("does not use a stale unended period as a reason", () => {
    // "Day 1" of a period she forgot to close weeks ago is not a day-1 moment.
    expect(
      ask({
        todayLog: undefined,
        status: status({ inPeriod: true, periodDay: 1, periodStale: true }),
      }),
    ).toBeNull();
  });

  it("stops treating a period as the moment after day two", () => {
    expect(
      ask({ todayLog: undefined, status: status({ inPeriod: true, periodDay: 3, periodOpen: true }) }),
    ).toBeNull();
  });
});

describe("the budget", () => {
  it("gives up after its last day", () => {
    const spent = Array.from({ length: GOZLIN_ASK_LIMIT }, (_, i) => `2026-10-1${i}`);
    expect(ask({ settings: settings({ gozlinAskDays: spent }) })).toBeNull();
  });

  it("does not vanish part-way through a day it has already counted", () => {
    // The card she is looking at must not disappear under her thumb because
    // its own appearance spent the last of the budget.
    const spent = [
      ...Array.from({ length: GOZLIN_ASK_LIMIT - 1 }, (_, i) => `2026-10-1${i}`),
      TODAY,
    ];
    expect(ask({ settings: settings({ gozlinAskDays: spent }) })?.reason).toBe("cramps");
  });

  it("still asks while there is budget left", () => {
    expect(ask({ settings: settings({ gozlinAskDays: ["2026-10-10"] }) })).not.toBeNull();
  });
});
