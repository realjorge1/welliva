import { describe, expect, it } from "vitest";
import {
  movedLine,
  rememberReached,
  rememberSaid,
  saidBackLine,
  spanWords,
  type ForecastMemory,
} from "../body/forecastMemory";

const said = (eta: string, ratePerWeek: number | null = -0.5) => ({ targetKg: 75, eta, ratePerWeek });

describe("remembering what was said", () => {
  it("keeps the first date and moves the rest along", () => {
    let m = rememberSaid(null, said("2026-12-01"), "2026-08-12");
    m = rememberSaid(m, said("2026-12-05"), "2026-09-01");
    m = rememberSaid(m, said("2026-12-10"), "2026-10-01");
    expect(m.first).toEqual({ on: "2026-08-12", eta: "2026-12-01", ratePerWeek: -0.5 });
    expect(m.prior?.on).toBe("2026-09-01");
    expect(m.last.on).toBe("2026-10-01");
  });

  it("a second showing on the same day replaces only the latest", () => {
    let m = rememberSaid(null, said("2026-12-01"), "2026-08-12");
    m = rememberSaid(m, said("2027-01-10"), "2026-10-01");
    m = rememberSaid(m, said("2027-01-11"), "2026-10-01");
    expect(m.prior?.on).toBe("2026-08-12");
    expect(m.last.eta).toBe("2027-01-11");
  });

  it("starts afresh for a new goal weight", () => {
    const m = rememberSaid(null, said("2026-12-01"), "2026-08-12");
    expect(rememberSaid(m, { ...said("2027-03-01"), targetKg: 70 }, "2026-12-02").first.on).toBe("2026-12-02");
    const reached = rememberReached(m, 75, "2026-11-24")!;
    expect(rememberSaid(reached, { ...said("2027-03-01"), targetKg: 70 }, "2026-12-02").first.on).toBe("2026-12-02");
  });

  it("keeps a reached goal's record, so a forecast opened before the new-chapter screen can't wipe it", () => {
    const m = rememberSaid(null, said("2026-12-01"), "2026-08-12");
    const reached = rememberReached(m, 75, "2026-11-24")!;
    const after = rememberSaid(reached, said("2026-11-24"), "2026-11-24");
    expect(after).toBe(reached);
    expect(saidBackLine(after, 75, "2026-11-25")).toContain("You got there on 24 Nov, a week early.");
  });
});

describe("a date that moved", () => {
  const m: ForecastMemory = rememberSaid(null, said("2026-12-01", -0.5), "2026-10-12");

  it("says nothing for a small move", () => {
    expect(movedLine(m, said("2026-12-10", -0.48), "2026-11-14")).toBeNull();
  });

  it("says how far and why, from the two rates", () => {
    expect(movedLine(m, said("2027-01-05", -0.3), "2026-11-14")).toBe(
      "On 12 Oct I said around 1 Dec. It's now around 5 Jan 2027, 5 weeks later, because you've been losing about 0.3 kg a week lately, down from 0.5 kg then.",
    );
    expect(movedLine(m, said("2026-11-10", -0.8), "2026-10-20")).toContain("3 weeks sooner");
    expect(movedLine(m, said("2026-11-10", -0.8), "2026-10-20")).toContain("up from 0.5 kg then");
  });

  it("falls back to the plain reason when the rate hardly changed", () => {
    expect(movedLine(m, said("2027-01-05", -0.49), "2026-11-14")).toContain("because of how your weight has moved since then");
  });

  it("compares with what was said before today, even after a same-day showing", () => {
    const today = "2026-11-14";
    const after = rememberSaid(m, said("2027-01-05", -0.3), today);
    expect(movedLine(after, said("2027-01-05", -0.3), today)).toContain("On 12 Oct I said around 1 Dec");
  });

  it("ignores another goal weight", () => {
    expect(movedLine(m, { ...said("2027-06-01"), targetKg: 70 }, "2026-11-14")).toBeNull();
  });
});

describe("saying it back at the goal", () => {
  const m = rememberSaid(null, said("2026-12-01"), "2026-08-12");

  it("early, late and on time", () => {
    expect(saidBackLine(rememberReached(m, 75, "2026-11-24"), 75, "2026-11-24")).toBe(
      "On 12 Aug, Gozlin said you'd reach 75 kg around 1 Dec. You got there on 24 Nov, a week early.",
    );
    expect(saidBackLine(rememberReached(m, 75, "2026-12-03"), 75, "2026-12-03")).toContain("right on time");
    expect(saidBackLine(rememberReached(m, 75, "2026-12-22"), 75, "2026-12-22")).toContain(
      "3 weeks after that first date",
    );
  });

  it("says nothing before the goal, or for another one", () => {
    expect(saidBackLine(m, 75, "2026-11-24")).toBeNull();
    expect(saidBackLine(rememberReached(m, 75, "2026-11-24"), 70, "2026-11-24")).toBeNull();
  });

  it("spans read naturally", () => {
    expect(spanWords(1)).toBe("1 day");
    expect(spanWords(-4)).toBe("4 days");
    expect(spanWords(7)).toBe("a week");
    expect(spanWords(15)).toBe("2 weeks");
  });
});
