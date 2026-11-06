/**
 * "HOW SURE" — one judgement, said at every length.
 *
 * The cycle screen's confidence line already says how sure a prediction is and
 * why. The glance surfaces (the Home card, the coach, the doctor summary) say
 * the same judgement shorter. What a test holds: the short words follow the
 * same `confidence` the long line does, no surface shows a word where it shows
 * no window, and the coach is never handed a window without its certainty.
 */
import { describe, expect, it } from "vitest";

import { buildCycleBrief, cycleStateLines } from "../brief";
import { confidenceLine, confidenceWord, glanceConfidence } from "../copy";
import { doctorSummary } from "../exportData";
import { predict, type Prediction } from "../predict";
import type { CycleData, CycleSettings, PeriodEpisode } from "../types";
import { computeView } from "../view";
import { history, period, settings } from "./helpers";

const TODAY = "2026-10-15";

function viewOf(periods: PeriodEpisode[], s: CycleSettings = settings({ usualCycleDays: 28 }), conditions: string[] = []) {
  const data: CycleData = { settings: s, periods, days: {} };
  return computeView(data, { today: TODAY, profile: { age: 30, conditions } });
}

function predictionOf(periods: PeriodEpisode[], s: CycleSettings = settings({ usualCycleDays: 28 })): Prediction {
  return predict({ episodes: periods, days: {}, settings: s, today: TODAY, profile: { age: 30, conditions: [] } })!;
}

const STEADY = history("2026-04-08", [28, 28, 28, 28, 28, 28]);
/** Last start 5 Oct, so 15 Oct sits mid-cycle with a wide window ahead. */
const SWINGING = history("2026-04-10", [24, 34, 26, 36, 25, 33]);

describe("the short form follows the long line", () => {
  it("says the same thing at both lengths, for every confidence", () => {
    const told = predictionOf([period("2026-10-01")]);
    expect(told.confidence).toBe("told");
    expect(confidenceWord(told)).toBe("Still learning");
    expect(confidenceLine(told)).toContain("Based on what you told me");

    const learning = predictionOf([period("2026-10-01")], settings());
    expect(learning.confidence).toBe("learning");
    expect(confidenceWord(learning)).toBe("Still learning");
    expect(confidenceLine(learning)).toContain("Learning your rhythm");

    const steady = predictionOf(STEADY);
    expect(steady.confidence).toBe("confident");
    expect(confidenceWord(steady)).toBe("Fairly sure");

    const swinging = predictionOf(SWINGING);
    expect(swinging.confidence).toBe("variable");
    expect(confidenceWord(swinging)).toBe("Varies for you");
    expect(confidenceLine(swinging)).toContain("Your cycles vary");
  });
});

describe("a glance shows a word only beside a window", () => {
  it("shows it while a next period is forecast", () => {
    expect(glanceConfidence(viewOf(STEADY))).toBe("Fairly sure");
    expect(glanceConfidence(viewOf(SWINGING))).toBe("Varies for you");
  });

  it("shows nothing during a period, once she's late, or when nothing is predicted", () => {
    expect(glanceConfidence(viewOf([...STEADY, { ...period("2026-10-14"), end: null }]))).toBeNull();
    // Last start 16 Aug: the window closed weeks ago.
    const late = viewOf(history("2026-03-01", [28, 28, 28, 28, 28, 28]));
    expect(late.status.lateBy).toBeGreaterThan(0);
    expect(glanceConfidence(late)).toBeNull();
    const onMethod = settings({ usualCycleDays: 28, contraception: { answer: "hormonal", since: "2026-09-01", restartFrom: null } });
    expect(glanceConfidence(viewOf(STEADY, onMethod))).toBeNull();
    expect(glanceConfidence(viewOf(STEADY, settings({ usualCycleDays: 28 }), ["pregnancy"]))).toBeNull();
    expect(glanceConfidence(viewOf(STEADY, settings({ usualCycleDays: 28 }), ["menopause"]))).toBeNull();
  });
});

describe("the coach hears the window with its certainty", () => {
  const lines = (periods: PeriodEpisode[]) => {
    const v = viewOf(periods);
    return cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, todayLog: undefined, showFertileWindow: false }),
    );
  };

  it("says fairly sure only when the cycle screen does", () => {
    expect(lines(STEADY).find((l) => l.includes("next period"))).toMatch(/\(an estimate; fairly sure\)$/);
  });

  it("says the window is wide when her cycles vary, and that it is still learning early on", () => {
    expect(lines(SWINGING).find((l) => l.includes("next period"))).toContain("her cycles vary, so the window is wide");
    expect(lines([period("2026-10-01")]).find((l) => l.includes("next period"))).toContain("still learning her rhythm");
  });
});

describe("the doctor summary gives the window its basis", () => {
  it("names how many logged cycles it came from, or that none did", () => {
    const summary = (periods: PeriodEpisode[], s = settings({ usualCycleDays: 28 })) => {
      const v = viewOf(periods, s);
      return doctorSummary({
        data: { settings: s, periods, days: {} },
        cycles: v.cycles,
        prediction: v.prediction,
        notes: v.allNotes,
        today: TODAY,
      });
    };
    expect(summary(STEADY)).toMatch(/Next period estimated: .+, from 6 logged cycles\./);
    expect(summary([period("2026-10-01")])).toContain("from the usual length entered at setup.");
    expect(summary([period("2026-10-01")], settings())).toContain("from a typical cycle length, before any logged cycles.");
  });
});
