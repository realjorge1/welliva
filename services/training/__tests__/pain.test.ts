import { describe, expect, it } from "vitest";
import type { PainMemory } from "../../../fitness/types";
import type { UserBio } from "../../../models/user";
import {
  PAIN_REST_DAYS,
  answerFor,
  painReceipt,
  recurringPain,
  restingAreas,
  withPainAnswer,
  withRestingAreas,
} from "../pain";
import { buildContraindications } from "../safety";

const TODAY = "2026-11-14";

const pain = (runId: string, date: string, areas: string[]): PainMemory => ({
  runId,
  date,
  answer: "pain",
  areas,
  at: `${date}T18:00:00.000Z`,
});

const bio = { injuries: [] as string[], medicalConditions: [] } as unknown as UserBio;

describe("pain answers", () => {
  it("replaces the answer for the same run and keeps others", () => {
    let h = withPainAnswer([], pain("a", "2026-11-10", ["knee"]));
    h = withPainAnswer(h, pain("b", "2026-11-12", ["wrist"]));
    h = withPainAnswer(h, { runId: "a", date: "2026-11-10", answer: "none", at: "x" });
    expect(h).toHaveLength(2);
    expect(answerFor(h, "a")?.answer).toBe("none");
    expect(answerFor(h, "a")?.areas).toBeUndefined();
  });

  it("drops unknown areas", () => {
    const h = withPainAnswer([], pain("a", TODAY, ["knee", "toe"]));
    expect(h[0].areas).toEqual(["knee"]);
  });
});

describe("resting areas", () => {
  it("rests an area for two weeks from the last time it hurt", () => {
    const h = [pain("a", "2026-11-01", ["knee"]), pain("b", "2026-11-05", ["knee"])];
    expect(restingAreas(h, TODAY)).toEqual([{ id: "knee", lastDate: "2026-11-05", until: "2026-11-19" }]);
    // The day the window ends, it's gone.
    const after = "2026-11-19";
    expect(restingAreas(h, after)).toEqual([]);
    expect(PAIN_REST_DAYS).toBe(14);
  });

  it("ignores sore muscles and 'nothing hurt'", () => {
    const h: PainMemory[] = [
      { runId: "a", date: TODAY, answer: "sore", at: "x" },
      { runId: "b", date: TODAY, answer: "none", at: "x" },
    ];
    expect(restingAreas(h, TODAY)).toEqual([]);
  });

  it("hands the plan a bio whose safety rules keep the area out", () => {
    const h = [pain("a", "2026-11-12", ["knee"])];
    const planBio = withRestingAreas(bio, h, TODAY);
    expect(planBio.injuries).toEqual(["knee"]);
    expect(buildContraindications(planBio).patterns.has("squat")).toBe(true);
    // The person's own profile is untouched.
    expect(bio.injuries).toEqual([]);
  });

  it("returns the same bio when nothing is resting, so the plan fingerprint holds", () => {
    expect(withRestingAreas(bio, [], TODAY)).toBe(bio);
  });

  it("doesn't add an area the profile already names", () => {
    const own = { ...bio, injuries: ["Lower back"] } as UserBio;
    const out = withRestingAreas(own, [pain("a", TODAY, ["back"])], TODAY);
    expect(out).toBe(own);
  });

  it("is idempotent, so applying it twice changes nothing", () => {
    const h = [pain("a", TODAY, ["shoulder"])];
    const once = withRestingAreas(bio, h, TODAY);
    expect(withRestingAreas(once, h, TODAY)).toBe(once);
  });
});

describe("recurring pain", () => {
  it("needs three separate sessions inside two weeks", () => {
    const two = [pain("a", "2026-11-03", ["knee"]), pain("b", "2026-11-08", ["knee"])];
    expect(recurringPain(two, TODAY)).toEqual([]);
    const three = [...two, pain("c", "2026-11-12", ["knee"])];
    expect(recurringPain(three, TODAY)).toEqual([{ id: "knee", dates: ["2026-11-03", "2026-11-08", "2026-11-12"] }]);
  });

  it("counts a changed answer for one session once", () => {
    let h = withPainAnswer([], pain("a", "2026-11-03", ["knee"]));
    h = withPainAnswer(h, pain("a", "2026-11-03", ["knee"]));
    h = withPainAnswer(h, pain("b", "2026-11-08", ["knee"]));
    expect(recurringPain(h, TODAY)).toEqual([]);
  });

  it("forgets sessions older than the window", () => {
    const h = [pain("a", "2026-10-30", ["knee"]), pain("b", "2026-11-08", ["knee"]), pain("c", "2026-11-12", ["knee"])];
    expect(recurringPain(h, TODAY)).toEqual([]);
  });
});

describe("the receipt", () => {
  it("says what changes, in plain words", () => {
    expect(painReceipt(pain("a", TODAY, ["knee", "back"]), TODAY)).toBe(
      "Your plan will go easy on your knee and your lower back for the next two weeks. If it's still hurting, or it's swollen, get it checked.",
    );
    expect(painReceipt({ runId: "a", date: TODAY, answer: "sore", at: "x" }, TODAY)).toContain("normal");
  });
});
