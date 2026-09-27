import { describe, expect, it } from "vitest";
import type { SessionSummaryData } from "../../../../models/session";
import { COVERAGE, HISTORY_CAP, detectNovelty, emptyLedger, ingestSessions } from "../detector";
import {
  ARCHER,
  BRIDGE,
  INCLINE,
  LUNGE,
  MARCH,
  NORDIC,
  PIGEON,
  PLANK,
  PUSHUP,
  ROW,
  SQUAT,
  at,
  day,
  routine,
  session,
  type Ex,
} from "./fixtures";

/** Six weeks of Mon/Wed/Fri, then `extra` on day 43 (a Wednesday). */
function scenario(extra: Ex[], base = routine(6)) {
  const tried = session(44, [PUSHUP, SQUAT, ...extra], "run_new");
  const history = [...base, tried];
  const ledger = ingestSessions(emptyLedger(), history, { fullHistory: true });
  return { history, ledger, tried };
}

const nextMorning = at(45, 8);

describe("ingest", () => {
  it("is idempotent — the player and the summary screen both save the same run", () => {
    const { history, ledger } = scenario([NORDIC]);
    expect(ingestSessions(ledger, history, { fullHistory: true })).toBe(ledger);
    expect(ingestSessions(ledger, [history[history.length - 1]])).toBe(ledger);
  });

  it("does not count a session where everything was skipped", () => {
    const skipped = session(1, [{ ...PUSHUP, sets: 0 }], "all_skipped");
    const ledger = ingestSessions(emptyLedger(), [skipped]);
    expect(ledger.sessionsSeen).toBe(0);
    expect(ledger.subjects.push_01).toBeUndefined();
  });

  it("remembers a first sighting after the history has dropped it", () => {
    // 60 sessions, ingested as they were saved. The history keeps 50.
    const all = routine(20);
    let ledger = emptyLedger();
    for (const s of all) ledger = ingestSessions(ledger, [s]);
    const kept = all.slice(-HISTORY_CAP);
    const after = ingestSessions(ledger, kept, { fullHistory: true });
    expect(after.observedSince).toBe(day(0));
    expect(after.subjects["fam:push-up"].firstSeen).toBe(day(0));
  });

  it("moves its proof forward when sessions may have been lost unseen (a hole)", () => {
    const all = routine(20);
    // Only the first 5 were ever ingested; 55 later ones were saved while the
    // ledger write failed, and the history now holds only the newest 50.
    const ledger = ingestSessions(emptyLedger(), all.slice(0, 5));
    const kept = all.slice(-HISTORY_CAP);
    const after = ingestSessions(ledger, kept, { fullHistory: true });
    expect(after.observedSince).toBe(kept[0].date);
    expect(after.sessionsSeen).toBe(HISTORY_CAP);
  });
});

describe("detectNovelty — what was new, only where the log can say so", () => {
  it("finds a new movement for a regular logger, with evidence that matches the ledger exactly", () => {
    const { ledger, history } = scenario([NORDIC]);
    const [c] = detectNovelty(ledger, history, nextMorning);
    expect(c).toMatchObject({ variantKey: "hinge_09", familyKey: "nordic-curl", novelty: "family" });
    expect(c.evidence).toEqual({ sessionsBefore: 18, since: day(0) });
    expect(c.evidence.sessionsBefore).toBe(ledger.subjects["fam:nordic-curl"].priorSessions);
  });

  it("claims nothing in someone's first four weeks, however new the move", () => {
    // Every day for 20 days — plenty of sessions, but not enough time.
    const base: SessionSummaryData[] = Array.from({ length: 20 }, (_, i) => session(i, [PUSHUP, SQUAT]));
    const tried = session(21, [NORDIC], "run_new");
    const ledger = ingestSessions(emptyLedger(), [...base, tried]);
    expect(detectNovelty(ledger, [...base, tried], at(22, 8))).toEqual([]);
  });

  it("claims nothing for someone who logs too rarely for a gap to mean anything", () => {
    // One session a fortnight for 12 weeks: 6 sessions, 6 active weeks of 12.
    const base = [0, 14, 28, 42, 56, 70].map((d) => session(d, [PUSHUP, SQUAT]));
    const tried = session(84, [NORDIC], "run_new");
    const ledger = ingestSessions(emptyLedger(), [...base, tried]);
    expect(detectNovelty(ledger, [...base, tried], at(85, 8))).toEqual([]);
    expect(COVERAGE.minPriorSessions).toBeGreaterThan(base.length);
  });

  it("ignores an exercise they skipped, or barely started", () => {
    expect(detectNovelty(...args(scenario([{ ...NORDIC, sets: 0 }])))).toEqual([]);
    expect(detectNovelty(...args(scenario([{ ...NORDIC, sets: 1, seconds: 25 }])))).toEqual([]);
  });

  it("does not call a single tried set 'new' again when they do it properly later", () => {
    const base = [...routine(6), session(40, [{ ...NORDIC, sets: 1, seconds: 25 }], "taste")];
    expect(detectNovelty(...args(scenario([NORDIC], base)))).toEqual([]);
  });

  it("treats an easier variant of a known family as nothing new", () => {
    expect(detectNovelty(...args(scenario([INCLINE])))).toEqual([]);
  });

  it("does flag a harder variant than anything done in the family", () => {
    const [c] = detectNovelty(...args(scenario([ARCHER])));
    expect(c).toMatchObject({ variantKey: "push_08", novelty: "harder" });
  });

  it("never offers a stretch or a warm-up march", () => {
    expect(detectNovelty(...args(scenario([PIGEON])))).toEqual([]);
    expect(detectNovelty(...args(scenario([MARCH])))).toEqual([]);
  });

  it("offers ONE per session — the one most likely to be felt", () => {
    const found = detectNovelty(...args(scenario([BRIDGE, NORDIC, LUNGE])));
    expect(found).toHaveLength(1);
    expect(found[0].variantKey).toBe("hinge_09");
  });

  it("does not see an AI exercise as new because the plan moved it", () => {
    const aiRoutine = (week: number, slot: number) =>
      [0, 2, 4].map((d) =>
        session(week * 7 + d, [
          PUSHUP,
          SQUAT,
          ROW,
          { id: `ai_${d}_${slot}_turkish-get-up`, name: "Turkish Get-Up", category: "core", difficulty: "advanced" },
        ]),
      );
    const history = [0, 1, 2, 3, 4, 5].flatMap((w) => aiRoutine(w, w));
    const ledger = ingestSessions(emptyLedger(), history, { fullHistory: true });
    expect(detectNovelty(ledger, history, at(36, 8))).toEqual([]);
  });

  it("forgets a candidate once its 48 hours are gone", () => {
    const { ledger, history } = scenario([NORDIC]);
    expect(detectNovelty(ledger, history, at(46, 17))).toHaveLength(1);
    expect(detectNovelty(ledger, history, at(46, 19))).toEqual([]);
  });

  it("only reads sessions the ledger has ingested", () => {
    const { ledger, history } = scenario([NORDIC]);
    const unseen = session(45, [PLANK, { ...ARCHER }], "not_ingested");
    expect(detectNovelty(ledger, [...history, unseen], at(46, 8)).map((c) => c.triedRunId)).not.toContain(
      "not_ingested",
    );
  });
});

function args(s: ReturnType<typeof scenario>) {
  return [s.ledger, s.history, nextMorning] as const;
}
