import { describe, expect, it } from "vitest";
import { fullAgainBy, recoveryCopy } from "../components/recoveryCopy";

// Friday 2 October 2026, 9am local.
const NOW = new Date(2026, 9, 2, 9, 0).getTime();
const on = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

describe("fullAgainBy", () => {
  it("rounds up to the hour, so it never promises early", () => {
    expect(fullAgainBy(on(2, 15, 20), NOW)).toBe("Full again by 4 pm");
    expect(fullAgainBy(on(2, 16), NOW)).toBe("Full again by 4 pm");
  });

  it("says noon and midnight rather than 12 am / 12 pm", () => {
    expect(fullAgainBy(on(2, 11, 30), NOW)).toBe("Full again by noon");
    expect(fullAgainBy(on(2, 23, 10), NOW)).toBe("Full again by midnight");
    expect(fullAgainBy(on(3, 0), NOW)).toBe("Full again by midnight");
  });

  it("says tomorrow for the next day, and the weekday after that", () => {
    expect(fullAgainBy(on(3, 6, 40), NOW)).toBe("Full again by 7 am tomorrow");
    expect(fullAgainBy(on(3, 0, 20), NOW)).toBe("Full again by 1 am tomorrow");
    expect(fullAgainBy(on(3, 23, 30), NOW)).toBe("Full again by midnight tomorrow");
    expect(fullAgainBy(on(4, 13, 5), NOW)).toBe("Full again by Sun 2 pm");
  });
});

describe("recoveryCopy", () => {
  it("says fully charged at 100, with nothing to wait for", () => {
    expect(recoveryCopy({ score: 100, level: "green", fullAt: on(2, 10) }, NOW)).toEqual({
      label: "Fully charged",
      note: null,
    });
  });

  it("pairs each level with what to do, and says when the battery is full", () => {
    expect(recoveryCopy({ score: 86, level: "green", fullAt: on(2, 15, 20) }, NOW)).toEqual({
      label: "Ready to train",
      note: "Full again by 4 pm",
    });
    expect(recoveryCopy({ score: 58, level: "amber", fullAt: on(3, 6, 40) }, NOW).label).toBe(
      "Keep it light",
    );
    expect(recoveryCopy({ score: 31, level: "red", fullAt: on(4, 13, 5) }, NOW).label).toBe(
      "Rest and recharge",
    );
  });

  it("names what holds it down when the battery's clock won't fix it", () => {
    expect(
      recoveryCopy({ score: 65, level: "amber", fullAt: null, heldBackBy: "you said you felt drained" }, NOW),
    ).toEqual({ label: "Keep it light", note: "You said you felt drained" });
  });
});
