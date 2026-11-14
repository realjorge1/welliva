/**
 * services/cycle/hormones.ts — "What's at work today": which hormone is
 * leading, what it does, why now, and how long it usually lasts.
 *
 * Asked for by the owner on 2026-11-13. One quiet line in the cycle screen's
 * Today section; tapping it (or the phase name under the dial) opens the card,
 * with a small picture of four typical curves stretched to HER cycle.
 *
 * ── THE RULES (each one is a test) ─────────────────────────────────────────
 *  · SHAPES, NOT LEVELS. No number for a hormone level, ever. "Usually",
 *    "about now", timed from her own estimated dates, carrying the
 *    prediction's own confidence word.
 *  · IT EXPLAINS; IT NEVER PRESCRIBES. Nothing here says what to eat, how to
 *    train or how she will feel. No phase stereotypes: the library's
 *    energy-and-training page promises that.
 *  · NEVER BLAME A FEELING ON A HORMONE. A hormone is linked to a symptom only
 *    when she logged that symptom TODAY, and only a physical one: tender
 *    breasts, bloating, breakouts, headache. Mood and energy, never.
 *  · THE FERTILE WINDOW IS OPT-IN. With it off, no ovulation date appears
 *    anywhere here, the mid-cycle card speaks in general terms, and the
 *    picture shows only oestrogen and progesterone, with no ovulation mark.
 *  · A positive ovulation test (./predict `fromTest`) makes it exact: "your
 *    test caught the LH surge".
 *  · Modes: hormonal contraception gets one accurate line (methods differ;
 *    never "there's no ovulation"); PCOS explains without timing; pregnancy
 *    and menopause show nothing; after a birth it waits for the first period.
 *
 * Pure: the view (./view) computes it; components/cycle/HormoneSheet draws it.
 */

import { confidenceWord } from "./copy";
import { addDays, daysBetween, formatDay } from "./dates";
import type { CycleMode, CycleProfile, CycleToday, Phase, Prediction } from "./predict";
import type { CycleDayLog, Symptom } from "./types";

/* ───────────────────────────── thresholds ───────────────────────────── */

/** Under this age, cycles (and the hormones behind them) are still settling: timings are looser. */
export const HORMONE_YOUNG_AGE = 20;
/** From this age, the run-up to menopause can begin: hormones swing more from cycle to cycle. */
export const HORMONE_SWING_AGE = 40;
/** Progesterone's fall takes the last few days before a period: from here it is "falling". */
export const FALL_BEFORE_PERIOD_DAYS = 3;
/** For this many days after ovulation, progesterone is still "rising" toward its peak. */
export const RISING_AFTER_OVULATION_DAYS = 4;
/** Oestrogen peaks about a day before ovulation. */
const OESTROGEN_PEAK_BEFORE_OVULATION = 1;
/** "Your test caught the LH surge" is said for this many days after the test. */
const TEST_LINE_DAYS = 3;

/* ───────────────────────────── the shape ───────────────────────────── */

export type Hormone = "oestrogen" | "progesterone" | "lh" | "fsh";

export const HORMONE_LABEL: Record<Hormone, string> = {
  oestrogen: "Oestrogen",
  progesterone: "Progesterone",
  lh: "LH",
  fsh: "FSH",
};

export interface HormonePicture {
  /** Days across: this cycle, the first half to her estimated ovulation, the second her luteal length. */
  length: number;
  /** 1-based day of her estimated ovulation. Null with the fertile window off: no mark. */
  ovulationDay: number | null;
  /** 1-based, today. */
  today: number;
  /** Typical shapes, 0..1, sampled evenly across the cycle. Never a measured level. */
  curves: { id: Hormone; points: number[] }[];
}

export interface HormoneCard {
  /** The one quiet line in Today: "Progesterone · at its highest about now". */
  line: string;
  /**
   * False for a line that is all there is to say (hormonal contraception,
   * the wait after a birth): it is shown, but opens nothing.
   */
  opens: boolean;
  /** "Progesterone: at its highest about now". */
  title: string;
  /** What's at work and why, in short paragraphs. */
  body: string[];
  /** "How long", or null where it can't be timed honestly. */
  howLong: string | null;
  /** A physical symptom she logged today, and the hormone it often comes with. */
  symptomLine: string | null;
  /** A positive test this cycle, said plainly. Only with the fertile window on. */
  testLine: string | null;
  /** Why the timings are looser for her (her age, or PCOS). */
  caveat: string | null;
  /** The prediction's confidence, in its own words: "Still learning: based on 2 cycles." */
  sure: string | null;
  picture: HormonePicture | null;
}

/** What the hormonal-contraception line says. Accurate: methods differ, and many still ovulate. */
export const HORMONAL_HORMONES_LINE =
  "Hormonal contraception changes how your own cycle's hormones rise and fall (some methods stop ovulation, others work mainly in the womb), so welliva can't time them. That's also why it logs your bleeding instead of predicting it.";

export const AFTER_BIRTH_HORMONES_LINE =
  "After a birth, the cycle's hormones take a while to restart. This starts again with your first period.";

export const PCOS_HORMONES_LINE =
  "With PCOS, ovulation can come late or not at all, so these are the usual shapes, not timed to your dates.";

export const PICTURE_CAPTION = "Typical shapes, not measured.";

/** The physical symptoms a hormone may be linked to, and only when logged today. */
export const LINKABLE_SYMPTOMS: readonly Symptom[] = ["tender_breasts", "bloating", "acne", "headache"];

/* ───────────────────────────── the card ───────────────────────────── */

export interface HormoneInput {
  mode: CycleMode;
  status: CycleToday;
  prediction: Prediction | null;
  profile: CycleProfile;
  /** The view's flag: she asked for the fertile window AND the mode predicts. */
  showFertile: boolean;
  todayLog: CycleDayLog | undefined;
  /** Her typical bleed, in days. */
  typicalBleed: number;
  today: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function hormoneCard(input: HormoneInput): HormoneCard | null {
  const { mode, status, prediction: p, showFertile, today } = input;
  if (mode === "pregnancy" || mode === "menopause") return null;
  if (mode === "hormonal") return lineOnly(HORMONAL_HORMONES_LINE);
  if (mode === "postpartum" && status.cycleDay === null) return lineOnly(AFTER_BIRTH_HORMONES_LINE);
  const phase = status.phase;
  if (!phase) return null;
  // The period needs no prediction; every other phase is read off one.
  if (phase !== "period" && !p) return null;

  const pcos = !!input.profile.conditions?.includes("pcos");
  const age = input.profile.age ?? null;
  const ageCaveat =
    age !== null && age < HORMONE_YOUNG_AGE
      ? "In the first years of periods, hormones swing more from cycle to cycle, so these timings are looser."
      : age !== null && age >= HORMONE_SWING_AGE
        ? "From your forties, hormones swing more from cycle to cycle, so these timings are looser."
        : null;

  const base = PHASES[phase]({ p, status, showFertile, today, typicalBleed: input.typicalBleed, timed: !pcos });
  const picture = !pcos && p && phase !== "late" ? hormonePicture(p, status, showFertile) : null;
  // No confidence word once she's late: the window it would vouch for has passed
  // (the Home card's glance word goes quiet then too).
  const sure = !pcos && p && phase !== "period" && phase !== "late" ? sureLine(p) : null;
  const testLine =
    showFertile && !pcos && p?.fromTest && daysBetween(p.fromTest, today) <= TEST_LINE_DAYS
      ? `Your test caught the LH surge on ${formatDay(p.fromTest, { weekday: true })}. Ovulation usually follows within a day and a half.`
      : null;

  return {
    line: pcos ? base.general.replace(": ", " · ") : base.line,
    opens: true,
    title: pcos ? base.general : base.title,
    body: base.body,
    howLong: pcos ? null : base.howLong,
    symptomLine: symptomLine(phase, input.todayLog, status),
    testLine,
    caveat: pcos ? PCOS_HORMONES_LINE : ageCaveat,
    sure,
    picture,
  };
}

function lineOnly(line: string): HormoneCard {
  return {
    line,
    opens: false,
    title: line,
    body: [],
    howLong: null,
    symptomLine: null,
    testLine: null,
    caveat: null,
    sure: null,
    picture: null,
  };
}

interface PhaseInput {
  p: Prediction | null;
  status: CycleToday;
  showFertile: boolean;
  today: string;
  typicalBleed: number;
  /** False with PCOS: explain, don't time. */
  timed: boolean;
}

interface PhaseCopy {
  line: string;
  title: string;
  /** The untimed title, for PCOS. */
  general: string;
  body: string[];
  howLong: string | null;
}

const STEADY_HALF = "This second half is the steady one";

const PHASES: Record<Phase, (i: PhaseInput) => PhaseCopy> = {
  period: (i) => ({
    line: "Oestrogen and progesterone · at their lowest",
    title: "Oestrogen and progesterone: at their lowest",
    general: "Oestrogen and progesterone: low",
    body: [
      "Both are at their lowest now. Their fall at the end of the last cycle is what started this bleed: without them, the womb lining can't hold, and it sheds.",
      "FSH, the hormone that grows the next egg, is already rising.",
    ],
    howLong: `Until the bleeding stops: usually about ${plural(i.typicalBleed, "day")} for you.`,
  }),

  follicular: (i) => {
    const p = i.p as Prediction;
    const toPeak = daysBetween(i.today, addDays(p.ovulation, -OESTROGEN_PEAK_BEFORE_OVULATION));
    const varies =
      "This first half varies more than the second, which is why a late period usually means a late ovulation.";
    return {
      line: "Oestrogen · climbing",
      title: "Oestrogen: climbing",
      general: "Oestrogen: the first half",
      body: [
        "FSH has started a few follicles growing in an ovary. One takes the lead, and it makes oestrogen.",
        i.showFertile
          ? "Oestrogen rebuilds the womb lining after your period, and as it climbs it makes discharge wetter. You can note that in the day log."
          : "Oestrogen rebuilds the womb lining after your period, and as it climbs it makes discharge wetter.",
      ],
      // With the fertile window off, nothing here may time ovulation.
      howLong: i.showFertile
        ? `Until ovulation: oestrogen usually peaks ${toPeak >= 1 ? `in about ${plural(toPeak, "day")}` : "about now"}. ${varies}`
        : `Until ovulation. ${varies}`,
    };
  },

  fertile: (i) =>
    i.showFertile
      ? {
          line: "LH · surging about now",
          title: "LH: surging about now",
          general: "Mid-cycle: oestrogen and LH",
          body: [
            "Oestrogen's peak sets off a surge of LH. That surge is what ovulation tests detect.",
            "The egg is released about a day after the surge, and it lives for about a day.",
          ],
          howLong: "The surge itself usually lasts a day or two.",
        }
      : {
          line: "Oestrogen · at its peak",
          title: "Mid-cycle: oestrogen at its peak",
          general: "Mid-cycle: oestrogen and LH",
          body: [
            "Around the middle of the cycle, oestrogen reaches its peak and sets off a short surge of LH, the hormone ovulation tests detect.",
            "Ovulation usually follows the surge within about a day.",
          ],
          howLong: "The surge itself usually lasts a day or two.",
        },

  luteal: (i) => {
    const p = i.p as Prediction;
    const sinceOvulation = daysBetween(p.ovulation, i.today);
    const toLikely = i.status.toLikely ?? daysBetween(i.today, p.likely);
    const state: "rising" | "peak" | "falling" =
      toLikely <= FALL_BEFORE_PERIOD_DAYS ? "falling" : sinceOvulation <= RISING_AFTER_OVULATION_DAYS ? "rising" : "peak";
    const when = toLikely <= 0 ? "any day now" : formatDay(p.likely, { weekday: true });
    const steady = p.lutealPersonal
      ? `${STEADY_HALF}: usually about ${plural(p.lutealDays, "day")} for you.`
      : `${STEADY_HALF}: usually 11 to 16 days.`;
    const toFall = toLikely - FALL_BEFORE_PERIOD_DAYS;
    const howLong =
      state === "falling"
        ? `If there's no pregnancy, it falls and your period follows, likely ${when}. ${steady}`
        : `It usually starts falling in about ${plural(Math.max(1, toFall), "day")}. If there's no pregnancy, your period follows, likely ${when}. ${steady}`;
    const head =
      state === "rising" ? "rising" : state === "falling" ? "falling" : "at its highest about now";
    return {
      line: `Progesterone · ${head}`,
      title: `Progesterone: ${head}`,
      general: "Progesterone: the second half",
      body: [
        "It's made by what's left of the follicle after it released the egg. It keeps the womb lining steady, and it warms you up a little, by up to about half a degree.",
        "Oestrogen has a second, smaller rise alongside it. Progesterone usually peaks about a week after ovulation.",
      ],
      howLong,
    };
  },

  late: () => ({
    line: "Hormones · a later ovulation, most likely",
    title: "Why a period comes late",
    general: "Why a period comes late",
    body: [
      "The second half of the cycle is the steady one, so a late period usually means ovulation came later than usual this cycle, not that the second half dragged.",
      "What changed this cycle, if anything stands out, is in the late section on the cycle screen.",
    ],
    howLong: null,
  }),
};

/**
 * A physical symptom she logged TODAY, and the hormone it often comes with —
 * or null. Mood and energy are never linked. One line: the first that fits.
 */
function symptomLine(phase: Phase, log: CycleDayLog | undefined, status: CycleToday): string | null {
  const logged = new Set(log?.symptoms ?? []);
  const secondHalf = phase === "luteal" || phase === "late";
  const nearPeriod =
    phase === "period" || phase === "late" || (phase === "luteal" && (status.toLikely ?? 99) <= FALL_BEFORE_PERIOD_DAYS);
  if (secondHalf && logged.has("tender_breasts")) {
    return "You logged sore breasts. That often comes with progesterone's rise.";
  }
  if (secondHalf && logged.has("bloating")) {
    return "You logged bloating. It's common in the second half, while progesterone is high.";
  }
  if (nearPeriod && logged.has("headache")) {
    return "You logged a headache. Headaches often come as oestrogen falls, just before or early in a period.";
  }
  if (nearPeriod && logged.has("acne")) {
    return "You logged breakouts. They often come in the days around a period, as oestrogen falls.";
  }
  return null;
}

function sureLine(p: Prediction): string {
  if (p.fromTest) return `From your test on ${formatDay(p.fromTest, { weekday: true })}.`;
  const word = confidenceWord(p);
  if (p.basedOn === 0) return `${word}: based on what you told me so far.`;
  return `${word}: based on ${plural(p.basedOn, "cycle")}.`;
}

/* ───────────────────────────── the picture ───────────────────────────── */

/** Samples across the cycle: plenty for a smooth line on a phone-wide picture. */
export const PICTURE_SAMPLES = 64;

/** A bell, wider on one side than the other. */
function bell(x: number, mu: number, left: number, right: number): number {
  const w = x < mu ? left : right;
  return Math.exp(-0.5 * ((x - mu) / w) ** 2);
}

/**
 * The four typical shapes, stretched to her cycle: the first half runs to her
 * estimated ovulation (day `o`), the second is her luteal length. Shapes only,
 * 0..1 each; the textbook pattern, never a measurement.
 */
export function hormoneShapes(length: number, o: number): Record<Hormone, number[]> {
  const luteal = Math.max(1, length - o);
  const follicular = Math.max(1, o);
  const out: Record<Hormone, number[]> = { oestrogen: [], progesterone: [], lh: [], fsh: [] };
  for (let i = 0; i < PICTURE_SAMPLES; i += 1) {
    const d = (i / (PICTURE_SAMPLES - 1)) * length; // day, 0 = the start of day 1
    const surge = o - OESTROGEN_PEAK_BEFORE_OVULATION;
    out.oestrogen.push(
      0.12 + 0.85 * bell(d, surge, 0.33 * follicular, 1.4) + 0.36 * bell(d, o + 0.55 * luteal, 0.22 * luteal, 0.2 * luteal),
    );
    out.progesterone.push(0.05 + 0.95 * bell(d, o + 0.5 * luteal, 0.24 * luteal, 0.22 * luteal));
    out.lh.push(0.06 + 0.94 * bell(d, surge, 0.7, 0.7));
    out.fsh.push(0.15 + 0.3 * bell(d, 2, 3, 4) + 0.35 * bell(d, surge, 0.8, 0.8) + 0.25 * bell(d, length + 1, 3, 3));
  }
  // Each shape on its own 0..1 scale: these are shapes, not levels to compare.
  for (const id of Object.keys(out) as Hormone[]) {
    const max = Math.max(...out[id]);
    out[id] = out[id].map((v) => Math.round((v / max) * 1000) / 1000);
  }
  return out;
}

function hormonePicture(p: Prediction, status: CycleToday, showFertile: boolean): HormonePicture | null {
  const length = daysBetween(p.lastStart, p.likely);
  const cycleDay = status.cycleDay;
  if (length < 10 || cycleDay === null) return null;
  const o = daysBetween(p.lastStart, p.ovulation) + 1;
  const shapes = hormoneShapes(length, o);
  const shown: Hormone[] = showFertile ? ["oestrogen", "progesterone", "lh", "fsh"] : ["oestrogen", "progesterone"];
  return {
    length,
    ovulationDay: showFertile ? o : null,
    today: Math.min(cycleDay, length),
    curves: shown.map((id) => ({ id, points: shapes[id] })),
  };
}
