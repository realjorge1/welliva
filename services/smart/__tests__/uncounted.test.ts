/**
 * The hungrier-week card goes through the quiet layer like any other moment, but
 * it is never counted. WHEN a cycle card appears is itself cycle data: it says
 * roughly when someone's period is due, and the privacy policy promises the
 * usage counting never sees that (owner's decision, 2026-11-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("../../telemetry", () => ({ track: (...args: unknown[]) => track(...args) }));

import {
  answerSmart,
  claimSmartSlot,
  clearSmartLedger,
  ensureSmartLedger,
  forgetSmartFeature,
  smartLedgerSnapshot,
} from "../ledger";
import { UNCOUNTED_FEATURES } from "../types";

const TODAY = "2026-10-06";

describe("a moment that must not be counted", () => {
  beforeEach(async () => {
    track.mockClear();
    await clearSmartLedger();
    await ensureSmartLedger();
  });

  it("names the cycle's card", () => {
    expect(UNCOUNTED_FEATURES).toContain("hungry-week");
  });

  it("takes its slot without telling anyone", () => {
    expect(claimSmartSlot({ id: "hungry-week", feature: "hungry-week", priority: 1 }, "diet", TODAY)).toBe(true);
    expect(track).not.toHaveBeenCalled();
  });

  it("records an answer without telling anyone", async () => {
    await answerSmart({ id: "hungry-week", feature: "hungry-week", answer: "declined" });
    expect(track).not.toHaveBeenCalled();
  });

  it("leaves every other moment counted as before", () => {
    expect(claimSmartSlot({ id: "u1", feature: "usual", priority: 1 }, "diet", TODAY)).toBe(true);
    expect(track).toHaveBeenCalledWith("smart_moment", { feature: "usual", result: "shown" });
  });
});

describe("when her cycle log is erased", () => {
  it("forgets the day the card appeared, and leaves every other moment alone", async () => {
    track.mockClear();
    await clearSmartLedger();
    await ensureSmartLedger();
    claimSmartSlot({ id: "hungry-week", feature: "hungry-week", priority: 1 }, "diet", TODAY);
    claimSmartSlot({ id: "u1", feature: "usual", priority: 1 }, "home", TODAY);
    await forgetSmartFeature("hungry-week");
    const { shown } = smartLedgerSnapshot();
    expect(shown.map((s) => s.feature)).toEqual(["usual"]);
  });
});
