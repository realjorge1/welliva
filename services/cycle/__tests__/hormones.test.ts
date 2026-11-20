/**
 * "WHAT'S AT WORK TODAY" — the hormone card's rules, each one held here:
 * shapes not levels, explain never prescribe, never blame a feeling on a
 * hormone, no ovulation date with the fertile window off, and every mode.
 */
import { describe, expect, it } from "vitest";

import { PHASE_NAMES, phaseLabel } from "../copy";
import { formatDay } from "../dates";
import {
  AFTER_BIRTH_HORMONES_LINE,
  HORMONAL_HORMONES_LINE,
  hormoneShapes,
  PCOS_HORMONES_LINE,
  type HormoneCard,
} from "../hormones";
import { CYCLE_LIBRARY } from "../library";
import type { CycleProfile } from "../predict";
import type { CycleDays, CycleSettings } from "../types";
import { computeView } from "../view";
import { day, days, history, settings } from "./helpers";

/** Last start 23 Sep. Calendar: ovulation 7 Oct, fertile 2–8 Oct, likely 21 Oct, window 18–24 Oct. */
const PERIODS = history("2026-07-01", [28, 28, 28]);
const ADULT: CycleProfile = { age: 30, conditions: [] };

function card(
  today: string,
  opts: { fertile?: boolean; profile?: CycleProfile; logs?: CycleDays; settings?: Partial<CycleSettings> } = {},
): HormoneCard | null {
  return computeView(
    {
      settings: settings({ showFertileWindow: opts.fertile ?? false, ...opts.settings }),
      periods: PERIODS,
      days: opts.logs ?? {},
    },
    { today, profile: opts.profile ?? ADULT },
  ).hormones;
}

const text = (c: HormoneCard | null) =>
  c ? [c.line, c.title, ...c.body, c.howLong, c.symptomLine, c.testLine, c.caveat, c.sure].filter(Boolean).join(" ") : "";

const EVERY_DAY = ["2026-09-25", "2026-09-29", "2026-10-05", "2026-10-10", "2026-10-14", "2026-10-19", "2026-10-27"];

describe("each phase", () => {
  it("during the period: both at their lowest, for about her usual bleed", () => {
    const c = card("2026-09-25")!;
    expect(c.line).toBe("Oestrogen and progesterone · at their lowest");
    expect(c.howLong).toBe("Until the bleeding stops: usually about 5 days for you.");
  });

  it("building up: oestrogen climbing; this half varies", () => {
    const c = card("2026-09-29")!;
    expect(c.line).toBe("Oestrogen · climbing");
    expect(c.howLong).toContain("a late period usually means a late ovulation");
  });

  it("around ovulation: the LH surge, with the fertile window on", () => {
    expect(card("2026-10-05", { fertile: true })!.line).toBe("LH · surging about now");
  });

  it("after ovulation: progesterone rising, at its highest, then falling", () => {
    expect(card("2026-10-10")!.line).toBe("Progesterone · rising");
    const peak = card("2026-10-14")!;
    expect(peak.line).toBe("Progesterone · at its highest about now");
    expect(peak.howLong).toContain("It usually starts falling in about 4 days.");
    expect(peak.howLong).toContain(`likely ${formatDay("2026-10-21", { weekday: true })}`);
    expect(peak.howLong).toContain("11 to 16 days");
    expect(card("2026-10-19")!.line).toBe("Progesterone · falling");
  });

  it("late: points to the late section rather than repeating it", () => {
    const c = card("2026-10-27")!;
    expect(c.title).toBe("Why a period comes late");
    expect(c.body.join(" ")).toContain("ovulation came later than usual");
    expect(c.howLong).toBeNull();
    expect(c.picture).toBeNull();
    // The window it would vouch for has passed: no "Fairly sure" on a late day.
    expect(c.sure).toBeNull();
  });

  it("carries the prediction's own confidence word", () => {
    // Three identical cycles, a ±3-day window: the Next period card says "Fairly sure" too.
    expect(card("2026-10-14")!.sure).toBe("Fairly sure: based on 3 cycles.");
  });
});

describe("the rules", () => {
  it("shapes, not levels: no number for a hormone level, ever", () => {
    for (const d of EVERY_DAY) {
      for (const fertile of [false, true]) {
        expect(text(card(d, { fertile }))).not.toMatch(/\d\s*(%|pg|ng|mIU|nmol|IU\b)/);
      }
    }
  });

  it("never prescribes food, training or how she will feel", () => {
    for (const d of EVERY_DAY) {
      expect(text(card(d, { fertile: true }))).not.toMatch(
        /you may feel|you might feel|irritab|moody|emotional|eat more|eat less|train|workout|exercise|craving/i,
      );
    }
  });

  it("links a physical symptom only when she logged it today", () => {
    const today = "2026-10-14";
    const logged = card(today, { logs: days(day(today, { symptoms: ["tender_breasts"] })) })!;
    expect(logged.symptomLine).toBe("You logged sore breasts. That often comes with progesterone's rise.");
    const yesterday = card(today, { logs: days(day("2026-10-13", { symptoms: ["tender_breasts"] })) })!;
    expect(yesterday.symptomLine).toBeNull();
  });

  it("never links mood or energy, however they were logged", () => {
    const today = "2026-10-19";
    const c = card(today, { logs: days(day(today, { mood: "irritable", energy: "low", symptoms: ["cravings"] })) })!;
    expect(c.symptomLine).toBeNull();
    expect(text(c)).not.toMatch(/mood|energy|irritab/i);
  });

  it("only physical symptoms, and only where the hormone fits", () => {
    // Sore breasts while oestrogen climbs is not progesterone's doing.
    const today = "2026-09-29";
    expect(card(today, { logs: days(day(today, { symptoms: ["tender_breasts"] })) })!.symptomLine).toBeNull();
    // A headache as oestrogen falls, during the period.
    const p = "2026-09-25";
    expect(card(p, { logs: days(day(p, { symptoms: ["headache"] })) })!.symptomLine).toMatch(/oestrogen falls/);
  });
});

describe("the fertile window is opt-in", () => {
  const ovulation = formatDay("2026-10-07");

  it("off: no ovulation date anywhere, and no timing toward it", () => {
    for (const d of EVERY_DAY) {
      const t = text(card(d));
      expect(t).not.toContain(ovulation);
      expect(t).not.toContain(formatDay("2026-10-07", { weekday: true }));
      expect(t).not.toMatch(/fertile/i);
    }
    expect(card("2026-09-29")!.howLong).not.toMatch(/peaks in about/);
  });

  it("off: the picture shows only oestrogen and progesterone, with no ovulation mark", () => {
    const pic = card("2026-10-14")!.picture!;
    expect(pic.curves.map((c) => c.id)).toEqual(["oestrogen", "progesterone"]);
    expect(pic.ovulationDay).toBeNull();
  });

  it("off: mid-cycle speaks in general terms", () => {
    const c = card("2026-10-05")!;
    expect(c.title).toBe("Mid-cycle: oestrogen at its peak");
    expect(text(c)).not.toMatch(/about now/);
  });

  it("on: four curves stretched to her cycle, ovulation marked, the peak timed", () => {
    const c = card("2026-09-29", { fertile: true })!;
    expect(c.picture!.curves.map((x) => x.id)).toEqual(["oestrogen", "progesterone", "lh", "fsh"]);
    expect(c.picture!.ovulationDay).toBe(16); // 8 Oct is day 16 from 23 Sep (13 days before 21 Oct)
    expect(c.picture!.length).toBe(28);
    expect(c.howLong).toMatch(/oestrogen usually peaks in about 8 days/);
  });

  it("a positive test makes it exact, with the window on", () => {
    const logs = days(day("2026-10-12", { ovulationTest: "positive" }));
    const on = card("2026-10-13", { fertile: true, logs })!;
    expect(on.testLine).toBe(
      `Your test caught the LH surge on ${formatDay("2026-10-12", { weekday: true })}. Ovulation usually follows within a day and a half.`,
    );
    expect(on.sure).toBe(`From your test on ${formatDay("2026-10-12", { weekday: true })}.`);
    expect(card("2026-10-13", { logs })!.testLine).toBeNull();
  });
});

describe("modes", () => {
  it("hormonal contraception: one accurate line, never 'no ovulation'", () => {
    const c = card("2026-10-14", {
      settings: { contraception: { answer: "hormonal", since: "2026-06-01", restartFrom: null } },
    })!;
    expect(c.line).toBe(HORMONAL_HORMONES_LINE);
    expect(c.opens).toBe(false);
    expect(c.line).toContain("some methods stop ovulation, others work mainly in the womb");
    expect(c.line).not.toMatch(/no ovulation|don't ovulate|doesn't ovulate|stops ovulation\b/i);
  });

  it("PCOS: explains without timing, says why, and draws no curves on her dates", () => {
    const c = card("2026-10-14", { profile: { age: 30, conditions: ["pcos"] }, fertile: true })!;
    expect(c.howLong).toBeNull();
    expect(c.picture).toBeNull();
    expect(c.sure).toBeNull();
    expect(c.caveat).toBe(PCOS_HORMONES_LINE);
    expect(c.line).toBe("Progesterone · the second half");
  });

  it("pregnancy and menopause: nothing", () => {
    expect(card("2026-10-14", { profile: { conditions: ["pregnancy"] } })).toBeNull();
    expect(card("2026-10-14", { profile: { age: 52, conditions: ["menopause"] } })).toBeNull();
  });

  it("after a birth, before the first period: one line, then it starts again", () => {
    const v = computeView(
      { settings: settings({ postpartumSince: "2026-10-01" }), periods: PERIODS, days: {} },
      { today: "2026-10-14", profile: { age: 30, conditions: ["postpartum"] } },
    );
    expect(v.hormones?.line).toBe(AFTER_BIRTH_HORMONES_LINE);
    expect(v.hormones?.opens).toBe(false);
  });

  it("ages under 20 and from 40 get one line about bigger swings", () => {
    expect(card("2026-10-14", { profile: { age: 17, conditions: [] } })!.caveat).toMatch(/swing more/);
    expect(card("2026-10-14", { profile: { age: 40, conditions: [] } })!.caveat).toMatch(/swing more/);
    expect(card("2026-10-14", { profile: { age: 30, conditions: [] } })!.caveat).toBeNull();
  });

  it("with tracking off, nothing", () => {
    expect(card("2026-10-14", { settings: { enabled: false } })).toBeNull();
  });
});

describe("the shapes", () => {
  const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));
  const at = (i: number, length: number) => (i / 63) * length;

  it("oestrogen and LH peak just before ovulation; progesterone about a week after", () => {
    const s = hormoneShapes(28, 14);
    expect(at(argmax(s.oestrogen), 28)).toBeGreaterThan(11);
    expect(at(argmax(s.oestrogen), 28)).toBeLessThan(14);
    expect(Math.abs(at(argmax(s.lh), 28) - 13)).toBeLessThan(1);
    expect(Math.abs(at(argmax(s.progesterone), 28) - 21)).toBeLessThan(1.5);
  });

  it("stretch to her cycle: a late ovulation moves the peaks later", () => {
    const s = hormoneShapes(35, 21);
    expect(Math.abs(at(argmax(s.lh), 35) - 20)).toBeLessThan(1);
  });
});

describe("the names match the library", () => {
  const page = CYCLE_LIBRARY["how-it-works"];
  const all = page.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.points ?? [])]).join(" ");

  it("every plain phase name is the one the how-it-works page lists", () => {
    for (const name of Object.values(PHASE_NAMES)) expect(all).toContain(name);
  });

  it("the phase label under the dial uses them", () => {
    const status = (phase: "follicular" | "fertile" | "luteal") =>
      ({ status: { phase } }) as Parameters<typeof phaseLabel>[0];
    expect(phaseLabel(status("follicular"), false)).toBe("Follicular phase · building up to ovulation");
    expect(phaseLabel(status("fertile"), false)).toBe("Mid-cycle · around ovulation");
    expect(phaseLabel(status("luteal"), false)).toBe("Luteal phase · after ovulation, before your period");
  });

  it("the page says what the card says about each hormone", () => {
    for (const h of ["FSH", "Oestrogen", "LH", "Progesterone"]) expect(all).toContain(h);
    expect(all).toContain("peaks about a week after ovulation");
    expect(all).toContain("never measured");
  });
});
