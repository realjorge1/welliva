import { describe, expect, it } from "vitest";
import {
  BUDGET,
  CHAT_LIMITS,
  afterTurn,
  chatStage,
  chipVisible,
  effectiveStatus,
  entryFor,
  exerciseWindow,
  markAnswered,
  markDismissed,
  sampledIn,
  selectQuestion,
} from "../curiosity";
import type { CuriosityEntry, NoveltyCandidate } from "../types";
import { at } from "./fixtures";

/** A run id this subject is sampled IN on — the sampler is a hash, so find one. */
function sampledRun(variantKey: string, prefix = "run"): string {
  for (let i = 0; i < 100; i++) {
    const id = `${prefix}_${i}`;
    if (sampledIn({ variantKey, triedRunId: id })) return id;
  }
  throw new Error("no sampled run found");
}

function candidate(over: Partial<NoveltyCandidate> & { day?: number; hour?: number } = {}): NoveltyCandidate {
  const { day = 10, hour = 18, ...rest } = over;
  const variantKey = rest.variantKey ?? "hinge_09";
  return {
    kind: "exercise",
    variantKey,
    familyKey: rest.familyKey ?? "nordic-curl",
    label: "Nordic Hamstring Curl",
    category: "legs",
    difficulty: "advanced",
    novelty: "family",
    triedRunId: rest.triedRunId ?? sampledRun(variantKey, `r${day}`),
    triedAt: at(day, hour).toISOString(),
    triedOn: "x",
    score: 4,
    evidence: { sessionsBefore: 20, since: "2026-06-01" },
    ...rest,
  };
}

const on = (c: NoveltyCandidate[], log: CuriosityEntry[], now: Date) =>
  selectQuestion({ candidates: c, log, now, enabled: true });

describe("the window", () => {
  it("opens the next morning at 05:00 after an evening session, and closes at 48 hours", () => {
    const w = exerciseWindow(at(10, 18).toISOString());
    expect(new Date(w.opensAt).getTime()).toBe(at(11, 5).getTime());
    expect(new Date(w.closesAt).getTime()).toBe(at(12, 18).getTime());
  });

  it("waits at least 10 hours after a late session — never at 05:00 after five hours' sleep", () => {
    const w = exerciseWindow(at(10, 23, 30).toISOString());
    expect(new Date(w.opensAt).getTime()).toBe(at(11, 9, 30).getTime());
  });

  it("asks nothing the same evening, asks the next morning, and never late", () => {
    const c = [candidate()];
    expect(on(c, [], at(10, 22))).toBeNull();
    expect(on(c, [], at(11, 8))?.question.variantKey).toBe("hinge_09");
    expect(on(c, [], at(12, 19))).toBeNull();
  });

  it("an open question past its window reads as expired", () => {
    const e = entryFor(candidate(), at(11, 8));
    expect(effectiveStatus(e, at(12, 17))).toBe("open");
    expect(effectiveStatus(e, at(12, 18))).toBe("expired");
  });
});

describe("the gates", () => {
  it("does nothing at all with the switch off", () => {
    expect(selectQuestion({ candidates: [candidate()], log: [], now: at(11, 8), enabled: false })).toBeNull();
  });

  it("keeps ONE question open — a second new thing waits, the open one persists", () => {
    const first = on([candidate()], [], at(11, 8))!;
    expect(first.isNew).toBe(true);
    const log = [first.question];
    const second = candidate({ variantKey: "legs_07", familyKey: "single-leg-squat", day: 10, hour: 19 });
    const again = on([candidate(), second], log, at(11, 12))!;
    expect(again.isNew).toBe(false);
    expect(again.question.id).toBe(first.question.id);
  });

  it(`opens at most ${BUDGET.perDay} a day and ${BUDGET.perWeek} a week`, () => {
    const answeredToday = markAnswered(entryFor(candidate({ day: 10 }), at(11, 7)), at(11, 7, 30));
    const other = candidate({ variantKey: "legs_07", familyKey: "single-leg-squat", day: 10, hour: 20 });
    expect(on([other], [answeredToday], at(11, 12))).toBeNull();

    const a = markAnswered(entryFor(candidate({ day: 5 }), at(6, 8)), at(6, 9));
    const b = markAnswered(
      entryFor(candidate({ variantKey: "push_08", familyKey: "x", day: 8 }), at(9, 8)),
      at(9, 9),
    );
    expect(on([other], [a, b], at(11, 12))).toBeNull();

    // A week after the first of the two, there is room again.
    const fresh = candidate({ variantKey: "legs_07", familyKey: "single-leg-squat", day: 13 });
    expect(on([fresh], [a, b], at(14, 9))?.isNew).toBe(true);
  });

  it("never asks about the same family twice, however long ago", () => {
    const old = markAnswered(entryFor(candidate({ day: 1 }), at(2, 8)), at(2, 9));
    const again = candidate({ variantKey: "hinge_09", day: 60, triedRunId: sampledRun("hinge_09", "late") });
    expect(on([again], [old], at(61, 8))).toBeNull();
  });

  const ignored = (d: number, fam: string) =>
    markDismissed(entryFor(candidate({ day: d, familyKey: fam }), at(d + 1, 8)), at(d + 1, 9));

  it("backs off for a week after being ignored twice in a row", () => {
    const log = [ignored(1, "f1"), ignored(10, "f2")];
    const next = candidate({ variantKey: "legs_04", familyKey: "split-squat", day: 13 });
    expect(on([next], log, at(14, 8))).toBeNull(); // within 7 days of the last ignore

    const later = candidate({ variantKey: "legs_04", familyKey: "split-squat", day: 20 });
    expect(on([later], log, at(21, 8))?.isNew).toBe(true);
  });

  it("backs off for three weeks after three, and one answer resets it", () => {
    const log = [ignored(1, "f1"), ignored(10, "f2"), ignored(19, "f3")];
    const next = candidate({ variantKey: "legs_04", familyKey: "split-squat", day: 37 });
    expect(on([next], log, at(38, 8))).toBeNull(); // 21 days from day 20 runs to day 41

    const answered = markAnswered(entryFor(candidate({ day: 29, familyKey: "f4" }), at(30, 8)), at(30, 9));
    expect(on([next], [...log, answered], at(38, 8))?.isNew).toBe(true);
  });

  it("counts an expired question as ignored", () => {
    const expired = (d: number, fam: string) => entryFor(candidate({ day: d, familyKey: fam }), at(d + 1, 8));
    const log = [expired(1, "f1"), expired(10, "f2")];
    const next = candidate({ variantKey: "legs_04", familyKey: "split-squat", day: 13 });
    expect(on([next], log, at(14, 8))).toBeNull();
  });

  it("samples subjects stably — the same answer on every render, about 2 in 3 overall", () => {
    let passed = 0;
    for (let i = 0; i < 300; i++) {
      const c = { variantKey: `v${i}`, triedRunId: `run_${i * 7}` };
      expect(sampledIn(c)).toBe(sampledIn({ ...c }));
      if (sampledIn(c)) passed++;
    }
    expect(passed).toBeGreaterThan(170);
    expect(passed).toBeLessThan(230);
  });
});

describe("the conversation's share", () => {
  const open = () => entryFor(candidate(), at(11, 8));

  it(`carries the question for at most ${CHAT_LIMITS.askTurns} turns that don't use it`, () => {
    let e = open();
    for (let i = 0; i < CHAT_LIMITS.askTurns; i++) {
      expect(chatStage(e, at(11, 9))).toBe("ask");
      e = afterTurn(e, { stage: "ask", asked: false, noted: false }, at(11, 9));
    }
    expect(chatStage(e, at(11, 9))).toBeNull();
    expect(chipVisible(e, at(11, 9))).toBe(true); // the chip still holds it
  });

  it("once asked, hides the chip, captures for two turns, then closes as ignored", () => {
    let e = afterTurn(open(), { stage: "ask", asked: true, noted: false }, at(11, 9));
    expect(chipVisible(e, at(11, 9))).toBe(false);
    expect(chatStage(e, at(11, 9))).toBe("capture");
    e = afterTurn(e, { stage: "capture", asked: false, noted: false }, at(11, 10));
    e = afterTurn(e, { stage: "capture", asked: false, noted: false }, at(11, 11));
    expect(e.status).toBe("ignored");
    expect(chatStage(e, at(11, 12))).toBeNull();
  });

  it("an answer closes it", () => {
    const e = afterTurn(open(), { stage: "capture", asked: false, noted: true }, at(11, 10));
    expect(e.status).toBe("answered");
  });
});
