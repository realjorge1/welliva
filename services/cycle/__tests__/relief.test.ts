/**
 * "WHAT HELPED LAST TIME?" — one question the day after, and her answer said back.
 *
 * What a test can hold, and what would quietly rot without one:
 *   · the question: about yesterday only, the most significant symptom, once a
 *     day, never in pregnancy, and no longer about a symptom skipped three times
 *     running;
 *   · the recall keeps the patterns standard — two wins before anything is said,
 *     a tie says nothing, the denominator is the days she ANSWERED, and the
 *     scope is said exactly;
 *   · it repeats her answer and never advises: no doses, "nothing helped" is a
 *     doctor note rather than a remedy, and a forecast never suggests a painkiller;
 *   · the cramps page quotes the same two numbers the code acts on.
 */
import { describe, expect, it } from "vitest";

import { buildCycleBrief, cycleStateLines } from "../brief";
import { headsUps } from "../care";
import { addDays } from "../dates";
import { cycleCsv, doctorSummary } from "../exportData";
import { CYCLE_LIBRARY, READING_FOR_NOTE } from "../library";
import { timingPatterns } from "../patterns";
import { buildCycles, predict, todayStatus } from "../predict";
import {
  NOTHING_HELPED_NOTE,
  RELIEF_MIN_WINS,
  RELIEF_OPTIONS,
  RELIEF_SKIP_LIMIT,
  RELIEF_WINDOW,
  reliefAsk,
  reliefRecall,
  skipStreak,
  unrelieved,
  withRelief,
} from "../relief";
import { normalizeDayLog, type CycleDays, type Relief, type ReliefNote, type Symptom } from "../types";
import { computeView } from "../view";
import { day, days, history, NOW, settings } from "./helpers";

const TODAY = "2026-10-15";
const YESTERDAY = "2026-10-14";

/** A day she logged `symptoms` and, if given, answered about them. */
function logged(date: string, symptoms: Symptom[], relief: ReliefNote[] = []) {
  return day(date, { symptoms, ...(relief.length ? { relief } : {}) });
}

/** `answers` on successive earlier days with cramps, oldest first, ending the day before `before`. */
function crampDays(answers: (Relief | "skipped")[], before = YESTERDAY): CycleDays {
  const out: CycleDays = {};
  answers.forEach((helped, i) => {
    const date = addDays(before, -3 * (answers.length - i));
    out[date] = logged(date, ["cramps"], [{ symptom: "cramps", helped }]);
  });
  return out;
}

const ask = (d: CycleDays, mode: Parameters<typeof reliefAsk>[0]["mode"] = "normal", enabled = true) =>
  reliefAsk({ days: d, today: TODAY, mode, enabled });

describe("the question", () => {
  it("asks about yesterday's cramps, in words about yesterday", () => {
    expect(ask(days(logged(YESTERDAY, ["cramps"])))).toEqual({
      date: YESTERDAY,
      symptom: "cramps",
      question: "Yesterday's cramps: what helped most?",
    });
  });

  it("asks about the most significant symptom only: cramps, then headache, back pain, nausea", () => {
    expect(ask(days(logged(YESTERDAY, ["headache", "cramps"])))?.symptom).toBe("cramps");
    expect(ask(days(logged(YESTERDAY, ["nausea", "headache"])))?.symptom).toBe("headache");
    expect(ask(days(logged(YESTERDAY, ["nausea", "back_pain"])))?.symptom).toBe("back_pain");
    expect(ask(days(logged(YESTERDAY, ["nausea"])))?.question).toBe("Yesterday's nausea: what helped most?");
  });

  it("asks nothing about other symptoms, other days, or a day already answered", () => {
    expect(ask(days(logged(YESTERDAY, ["bloating", "acne"])))).toBeNull();
    expect(ask(days(logged("2026-10-13", ["cramps"])))).toBeNull();
    expect(ask(days(logged(YESTERDAY, ["cramps", "headache"], [{ symptom: "cramps", helped: "heat" }])))).toBeNull();
    // A skip is an answer to "ask me today?" too: one question a day.
    expect(ask(days(logged(YESTERDAY, ["cramps", "headache"], [{ symptom: "cramps", helped: "skipped" }])))).toBeNull();
  });

  it("never asks in pregnancy, or with tracking off — and does ask in logging-only mode", () => {
    const d = days(logged(YESTERDAY, ["cramps"]));
    expect(ask(d, "pregnancy")).toBeNull();
    expect(ask(d, "normal", false)).toBeNull();
    expect(ask(d, "hormonal")?.symptom).toBe("cramps");
    expect(ask(d, "menopause")?.symptom).toBe("cramps");
  });

  it(`stops asking about a symptom after ${RELIEF_SKIP_LIMIT} skips in a row`, () => {
    const skipped = crampDays(["skipped", "skipped", "skipped"]);
    expect(skipStreak(skipped, "cramps")).toBe(3);
    expect(ask({ ...skipped, [YESTERDAY]: logged(YESTERDAY, ["cramps"]) })).toBeNull();
    // ...but still asks about the next one down.
    expect(ask({ ...skipped, [YESTERDAY]: logged(YESTERDAY, ["cramps", "headache"]) })?.symptom).toBe("headache");
  });

  it("counts skips only back to her last real answer", () => {
    const d = crampDays(["skipped", "skipped", "heat", "skipped", "skipped"]);
    expect(skipStreak(d, "cramps")).toBe(2);
    expect(ask({ ...d, [YESTERDAY]: logged(YESTERDAY, ["cramps"]) })?.symptom).toBe("cramps");
  });

  it("is carried on the view, and gone once she has answered", () => {
    const s = settings();
    const d = days(logged(YESTERDAY, ["cramps"]));
    expect(computeView({ settings: s, periods: [], days: d }, { today: TODAY, profile: {} }).reliefAsk?.symptom).toBe("cramps");
    const answered = { [YESTERDAY]: withRelief(d[YESTERDAY], "cramps", "heat", NOW) };
    expect(computeView({ settings: s, periods: [], days: answered }, { today: TODAY, profile: {} }).reliefAsk).toBeNull();
  });
});

describe("storing the answer", () => {
  it("puts it on the symptom day, replacing an earlier answer about the same symptom only", () => {
    const base = logged(YESTERDAY, ["cramps", "headache"], [
      { symptom: "cramps", helped: "rest" },
      { symptom: "headache", helped: "sleep" },
    ]);
    const next = withRelief(base, "cramps", "heat", "2026-10-15T10:00:00.000Z");
    expect(next.relief).toEqual([
      { symptom: "headache", helped: "sleep" },
      { symptom: "cramps", helped: "heat" },
    ]);
    // Stamped at the answer, so the day merge carries it to her other phone.
    expect(next.updatedAt).toBe("2026-10-15T10:00:00.000Z");
    expect(next.updatedAt > base.updatedAt).toBe(true);
  });

  it("survives a round trip through storage, and drops what it can't trust", () => {
    const log = normalizeDayLog(YESTERDAY, {
      symptoms: ["cramps"],
      relief: [
        { symptom: "cramps", helped: "rest" },
        { symptom: "cramps", helped: "heat" },
        { symptom: "headache", helped: "sleep" },
        { symptom: "acne", helped: "heat" },
        { symptom: "cramps", helped: "whisky" },
        "heat",
      ],
      updatedAt: NOW,
    });
    // The last answer about cramps wins; headache wasn't logged that day; the rest are malformed.
    expect(log?.relief).toEqual([{ symptom: "cramps", helped: "heat" }]);
    expect(normalizeDayLog(YESTERDAY, { symptoms: ["cramps"], relief: [{ symptom: "cramps", helped: "skipped" }] })?.relief).toEqual([
      { symptom: "cramps", helped: "skipped" },
    ]);
  });
});

describe("saying it back", () => {
  it(`says nothing until the same answer has won on ${RELIEF_MIN_WINS} days`, () => {
    expect(reliefRecall(crampDays(["heat"]), "cramps")).toBeNull();
    const r = reliefRecall(crampDays(["heat", "heat"]), "cramps")!;
    expect(r.line).toBe("The last 2 times you had cramps, heat helped most.");
    expect(r.short).toBe("Heat helped most the last 2 times.");
    expect(r.fact).toBe("heat for cramps (the last 2 times)");
  });

  it("states the scope exactly when the answers differ", () => {
    const r = reliefRecall(crampDays(["rest", "heat", "heat", "heat"]), "cramps")!;
    expect(r).toMatchObject({ helped: "heat", hits: 3, observed: 4 });
    expect(r.line).toBe("Heat helped most on 3 of the last 4 days you had cramps.");
    expect(r.short).toBe("Heat helped most on 3 of the last 4 times.");
    expect(r.fact).toBe("heat for cramps (3 of the last 4 times)");
  });

  it("says nothing when two answers tie", () => {
    expect(reliefRecall(crampDays(["heat", "rest", "heat", "rest"]), "cramps")).toBeNull();
  });

  it("never says 'nothing' or 'something else' helped", () => {
    expect(reliefRecall(crampDays(["nothing", "nothing", "heat"]), "cramps")).toBeNull();
    expect(reliefRecall(crampDays(["other", "other", "heat"]), "cramps")).toBeNull();
  });

  it("counts the days she answered, never the days she skipped", () => {
    const r = reliefRecall(crampDays(["skipped", "heat", "skipped", "heat"]), "cramps")!;
    expect(r.observed).toBe(2);
    expect(r.line).toBe("The last 2 times you had cramps, heat helped most.");
  });

  it(`reads only her last ${RELIEF_WINDOW} answers`, () => {
    const older = ["rest", "rest", "rest", "rest", "rest"] as Relief[];
    const newer = ["heat", "rest", "heat", "heat", "rest", "heat"] as Relief[];
    const r = reliefRecall(crampDays([...older, ...newer]), "cramps")!;
    expect(r).toMatchObject({ helped: "heat", hits: 4, observed: 6 });
  });

  it("ignores an answer left on a day that no longer carries the symptom", () => {
    const d = crampDays(["heat", "heat"]);
    const first = Object.keys(d).sort()[0];
    d[first] = { ...d[first], symptoms: ["headache"] };
    expect(reliefRecall(d, "cramps")).toBeNull();
  });

  it("names no dose anywhere it speaks", () => {
    const said = [
      ...RELIEF_OPTIONS.map((o) => o.label),
      ...(["heat", "moving", "painkiller", "rest", "sleep", "hot_drink"] as Relief[]).flatMap((helped) => {
        const r = reliefRecall(crampDays([helped, helped]), "cramps")!;
        return [r.line, r.short, r.fact];
      }),
    ];
    for (const line of said) expect(line).not.toMatch(/\d\s*(mg|ml|g)\b|tablet|dose|every \d+ hours/i);
  });
});

describe("where it is said back", () => {
  // Cramps on day 1 of each of three completed cycles; today is day 1 again.
  const periods = history("2026-07-01", [28, 28, 28]);
  const withAnswers = (helped: Relief) => ({
    "2026-07-01": logged("2026-07-01", ["cramps"], [{ symptom: "cramps", helped }]),
    "2026-07-29": logged("2026-07-29", ["cramps"], [{ symptom: "cramps", helped }]),
    "2026-08-26": logged("2026-08-26", ["cramps"]),
  });
  const today = "2026-09-23";
  const headsUpText = (helped: Relief) =>
    computeView({ settings: settings(), periods, days: withAnswers(helped) }, { today, profile: {} }).headsUps.map(
      (h) => h.text,
    );

  it("closes a heads-up with what helped her", () => {
    expect(headsUpText("heat")).toEqual([
      "Cramps usually show up around now for you (on day 1 of your period). Heat helped most the last 2 times.",
    ]);
  });

  it("never suggests a painkiller ahead of time, even when that is what she chose", () => {
    expect(headsUpText("painkiller")).toEqual(["Cramps usually show up around now for you (on day 1 of your period)."]);
  });

  it("leaves heads-ups alone when there is nothing to add", () => {
    const d = withAnswers("heat");
    const s = settings();
    const input = { episodes: periods, days: d, settings: s, today, profile: {} };
    const p = predict(input);
    const plain = headsUps(timingPatterns(buildCycles(periods, s, today), d), todayStatus(input, p), p);
    expect(plain[0].text).toBe("Cramps usually show up around now for you (on day 1 of your period).");
  });

  it("tells the coach, as her experience rather than advice", () => {
    const v = computeView({ settings: settings(), periods, days: withAnswers("heat") }, { today, profile: {} });
    const lines = cycleStateLines(
      buildCycleBrief({ status: v.status, prediction: v.prediction, showFertileWindow: false, relief: v.relief }),
    );
    expect(lines).toContain(
      "- what has helped her before, by her own answers (her experience, not a recommendation): heat for cramps (the last 2 times)",
    );
  });

  it("goes in the doctor summary and the export, skips included in the export", () => {
    const d = {
      ...withAnswers("heat"),
      "2026-08-26": logged("2026-08-26", ["cramps", "headache"], [
        { symptom: "cramps", helped: "heat" },
        { symptom: "headache", helped: "skipped" },
      ]),
    };
    const data = { settings: settings(), periods, days: d };
    const v = computeView(data, { today, profile: {} });
    const summary = doctorSummary({ data, cycles: v.cycles, prediction: v.prediction, notes: v.allNotes, today });
    expect(summary).toContain("What helped most, as answered in the app: heat for cramps (the last 3 times).");
    const csv = cycleCsv(data);
    expect(csv).toContain("day,2026-07-01,,,Cramps,,,,what helped: cramps: heat");
    expect(csv).toContain("what helped: cramps: heat; headaches: skipped");
  });
});

describe("when nothing helps", () => {
  const view = (d: CycleDays) => computeView({ settings: settings(), periods: [], days: d }, { today: TODAY, profile: {} });

  it(`becomes a doctor note at ${NOTHING_HELPED_NOTE} times, linked to the cramps page`, () => {
    const d = crampDays(["heat", "nothing", "nothing", "nothing"]);
    expect(unrelieved(d, "cramps")).toMatchObject({ nothing: 3, observed: 4 });
    const note = view(d).allNotes.find((n) => n.id === "cramps_unrelieved")!;
    expect(note.body).toContain("On 3 of the last 4 days you had cramps, you told me nothing helped.");
    expect(note.body).toContain("worth mentioning to a doctor");
    expect(READING_FOR_NOTE.cramps_unrelieved).toBe("cramps");
  });

  it("stays quiet below the line, or when something else helped as often", () => {
    expect(unrelieved(crampDays(["nothing", "nothing"]), "cramps")).toBeNull();
    expect(unrelieved(crampDays(["nothing", "heat", "nothing", "heat", "nothing", "heat"]), "cramps")).toBeNull();
    expect(view(crampDays(["nothing", "nothing"])).allNotes.map((n) => n.id)).not.toContain("cramps_unrelieved");
  });

  it("comes back when the evidence changes, not before", () => {
    const d = crampDays(["nothing", "nothing", "nothing"]);
    const first = view(d).allNotes.find((n) => n.id === "cramps_unrelieved")!.signature;
    const more = { ...d, [YESTERDAY]: logged(YESTERDAY, ["cramps"], [{ symptom: "cramps", helped: "nothing" }]) };
    expect(view(more).allNotes.find((n) => n.id === "cramps_unrelieved")!.signature).not.toBe(first);
  });
});

describe("the cramps page says what the code does", () => {
  const text = CYCLE_LIBRARY.cramps.sections.flatMap((s) => [...(s.body ?? []), ...(s.points ?? [])]).join(" ");
  const WORDS: Record<number, string> = { 2: "twice", 3: "three times" };

  it("quotes the same two numbers the app acts on", () => {
    expect(text).toContain(`helped ${WORDS[RELIEF_MIN_WINS]}`);
    expect(text).toContain(`nothing helped ${WORDS[NOTHING_HELPED_NOTE]}`);
    expect(text).toContain("it only ever repeats your own answer");
  });
});
