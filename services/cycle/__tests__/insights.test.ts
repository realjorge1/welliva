import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import { doctorNotes, regularityLimit, visibleNotes } from "../flags";
import {
  moodPattern,
  sleepPattern,
  timingPattern,
  timingPatterns,
  trainingPattern,
  trendPattern,
  type MindPoint,
} from "../patterns";
import { buildCycles } from "../predict";
import type { CycleDays, PeriodEpisode } from "../types";
import { day, history, NOW, nextId, period, settings } from "./helpers";

const TODAY = "2026-10-15";
const cyclesOf = (episodes: PeriodEpisode[]) => buildCycles(episodes, settings(), TODAY);

describe("doctor notes", () => {
  it("needs two long cycles, not one, before it says anything", () => {
    const one = doctorNotes({
      cycles: cyclesOf(history("2026-01-05", [28, 38, 28, 29])),
      episodes: [],
      today: TODAY,
      mode: "normal",
    });
    expect(one.map((n) => n.id)).not.toContain("long_cycles");

    const two = doctorNotes({
      cycles: cyclesOf(history("2026-01-05", [28, 38, 28, 39])),
      episodes: [],
      today: TODAY,
      mode: "normal",
    });
    const note = two.find((n) => n.id === "long_cycles")!;
    expect(note.body).toContain("2 of your last 4 cycles");
    expect(note.body).toContain("38, 39 days");
    expect(note.body).toMatch(/worth mentioning to a doctor/);
  });

  it("flags short cycles the same way", () => {
    const notes = doctorNotes({
      cycles: cyclesOf(history("2026-04-01", [19, 28, 20, 28])),
      episodes: [],
      today: TODAY,
      mode: "normal",
    });
    expect(notes.map((n) => n.id)).toContain("short_cycles");
  });

  it("flags a period that lasted more than 7 days — only when she ended it herself", () => {
    const logged = doctorNotes({
      cycles: [],
      episodes: [period("2026-09-01", 9)],
      today: TODAY,
      mode: "normal",
    });
    expect(logged.find((n) => n.id === "long_bleeding")?.body).toContain("lasted 9 days");

    const guessed = doctorNotes({
      cycles: [],
      episodes: [{ ...period("2026-09-01", 9), endEstimated: true }],
      today: TODAY,
      mode: "normal",
    });
    expect(guessed.map((n) => n.id)).not.toContain("long_bleeding");
  });

  it("uses the age-aware regularity limit", () => {
    expect(regularityLimit(30)).toBe(7);
    expect(regularityLimit(22)).toBe(9);
    const lengths = [26, 30, 34, 28, 27]; // spread 8
    const at30 = doctorNotes({
      cycles: cyclesOf(history("2026-03-01", lengths)),
      episodes: [],
      today: TODAY,
      mode: "normal",
      profile: { age: 30 },
    });
    const at22 = doctorNotes({
      cycles: cyclesOf(history("2026-03-01", lengths)),
      episodes: [],
      today: TODAY,
      mode: "normal",
      profile: { age: 22 },
    });
    expect(at30.map((n) => n.id)).toContain("irregular");
    expect(at22.map((n) => n.id)).not.toContain("irregular");
  });

  it("notes a missed period, but never in pregnancy", () => {
    const episodes = [period("2026-06-20")];
    const normal = doctorNotes({ cycles: [], episodes, today: TODAY, mode: "normal" });
    expect(normal.find((n) => n.id === "missed")?.body).toContain("117 days ago");
    const pregnant = doctorNotes({ cycles: [], episodes, today: TODAY, mode: "pregnancy" });
    expect(pregnant).toEqual([]);
  });

  it("says plainly that bleeding with menopause on the profile should be checked", () => {
    const notes = doctorNotes({
      cycles: [],
      episodes: [period("2026-10-10", 2)],
      today: TODAY,
      mode: "menopause",
    });
    expect(notes.map((n) => n.id)).toEqual(["menopause_bleeding"]);
  });

  it("stays dismissed until the evidence changes", () => {
    const notes = doctorNotes({
      cycles: [],
      episodes: [period("2026-09-01", 9)],
      today: TODAY,
      mode: "normal",
    });
    const sig = notes[0].signature;
    expect(visibleNotes(notes, { dismissedFlags: { long_bleeding: sig } })).toEqual([]);
    expect(visibleNotes(notes, { dismissedFlags: { long_bleeding: "older" } })).toHaveLength(1);
  });
});

/** Three 28-day cycles from 1 Jun, plus the start of a fourth. */
const EPISODES = history("2026-06-01", [28, 28, 28]); // starts 1 Jun, 29 Jun, 27 Jul, 24 Aug
const CYCLES = cyclesOf(EPISODES);
const STARTS = ["2026-06-01", "2026-06-29", "2026-07-27"];

function logEach(offsets: number[], patch: Parameters<typeof day>[1], starts = STARTS): CycleDays {
  const out: CycleDays = {};
  for (const s of starts) for (const o of offsets) out[addDays(s, o)] = day(addDays(s, o), patch);
  return out;
}

describe("timing patterns", () => {
  it("finds cramps on days 1–2 of her period, in all three cycles", () => {
    const p = timingPattern("cramps", CYCLES, logEach([0, 1], { symptoms: ["cramps"] }))!;
    expect(p.window).toEqual({ anchor: "start", lo: 1, hi: 2 });
    expect(p.title).toBe("Cramps on days 1–2 of your period");
    expect(p.body).toBe("You've logged cramps on days 1–2 of your period in 3 of your last 3 cycles.");
  });

  it("finds headaches the day before her period in two of three cycles", () => {
    // 28-day cycles: the day before the next start is offset 27.
    const logs = logEach([27], { symptoms: ["headache"] }, STARTS.slice(0, 2));
    // The third cycle is logged in, just without a headache.
    logs["2026-07-30"] = day("2026-07-30", { energy: "steady" });
    const p = timingPattern("headache", CYCLES, logs)!;
    expect(p.window).toEqual({ anchor: "next", lo: -1, hi: -1 });
    expect(p.body).toBe("You've logged headaches the day before your period in 2 of your last 3 cycles.");
  });

  it("names the denominator honestly when some cycles weren't logged at all", () => {
    const p = timingPattern("cramps", CYCLES, logEach([0], { symptoms: ["cramps"] }, STARTS.slice(1)))!;
    expect(p.scope).toBe("2 of the 2 recent cycles you logged in");
  });

  it("stays silent on one cycle, and on a symptom that comes all month", () => {
    expect(timingPattern("cramps", CYCLES, logEach([0], { symptoms: ["cramps"] }, STARTS.slice(0, 1)))).toBeNull();
    const allMonth = logEach([0, 4, 9, 14, 19, 24], { symptoms: ["bloating"] });
    expect(timingPattern("bloating", CYCLES, allMonth)).toBeNull();
  });

  it("reads low energy and low moods as subjects too", () => {
    const logs = { ...logEach([26, 27], { energy: "low" }) };
    const found = timingPatterns(CYCLES, logs);
    expect(found[0].subject).toBe("low_energy");
    expect(found[0].title).toBe("Energy dips 1–2 days before your period");
  });
});

describe("cross-domain patterns", () => {
  function mind(fn: (date: string, toNext: number) => Partial<MindPoint> | null): MindPoint[] {
    const out: MindPoint[] = [];
    for (const c of CYCLES) {
      for (let i = 0; i < c.length; i += 1) {
        const date = addDays(c.start, i);
        const p = fn(date, c.length - i);
        if (p) out.push({ date, valence: null, sleepHours: null, ...p });
      }
    }
    return out;
  }

  it("sees her mood check-ins run lower before her period", () => {
    const points = mind((_, toNext) => ({ valence: toNext <= 5 ? -0.3 : 0.3 }));
    const p = moodPattern(CYCLES, points)!;
    expect(p.title).toBe("Mood dips before your period");
    expect(p.scope).toBe("3 of 3 cycles with enough check-ins");
  });

  it("measures sleep in minutes, rounded to five", () => {
    const points = mind((_, toNext) => ({ sleepHours: toNext <= 5 ? 6.6 : 7.3 }));
    const p = sleepPattern(CYCLES, points)!;
    expect(p.body).toContain("about 40 minutes less");
  });

  it("does not invent a mood pattern from a noisy log", () => {
    let flip = 1;
    const points = mind(() => ({ valence: (flip *= -1) * 0.4 }));
    expect(moodPattern(CYCLES, points)).toBeNull();
  });

  it("notices she trains less in the first days of her period", () => {
    const workouts: { date: string }[] = [];
    for (const c of CYCLES) for (let i = 3; i < c.length; i += 2) workouts.push({ date: addDays(c.start, i) });
    const p = trainingPattern(CYCLES, workouts)!;
    expect(p.title).toBe("You train less early in your period");
    expect(p.body).toContain("trained on 0 of the 9 first three days");
  });

  it("calls out cycles drifting steadily longer", () => {
    const p = trendPattern(cyclesOf(history("2026-03-01", [26, 28, 29, 31])))!;
    expect(p.body).toContain("26, 28, 29, 31 days");
    expect(trendPattern(cyclesOf(history("2026-03-01", [26, 28, 27, 31])))).toBeNull();
  });
});

describe("reading the forgotten-open case", () => {
  it("does not count an open period as missed while it is fresh", () => {
    const open = [{ id: nextId(), start: "2026-10-12", end: null, updatedAt: NOW }];
    expect(doctorNotes({ cycles: [], episodes: open, today: TODAY, mode: "normal" })).toEqual([]);
  });
});
