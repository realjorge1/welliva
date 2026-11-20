/**
 * services/cycle/copy.ts — the words, derived from the view, in one place.
 *
 * The Home card, the cycle screen and the settings row all describe the same
 * moment; deriving every sentence here is what keeps them saying the same thing.
 * The register: plain, calm, never alarming, never cute — and never more
 * certain than the numbers behind it. A prediction is "likely", a window is a
 * window, and the fertile window is always called an estimate.
 */

import { MIN_BACKTEST } from "./backtest";
import { HORMONAL_LINE } from "./contraception";
import { pillLine } from "./pill";
import { daysBetween, formatDay, formatRange } from "./dates";
import { WIDE_WINDOW_DAYS, type CycleMode, type Prediction } from "./predict";
import type { CycleView } from "./view";

export interface CycleHeadline {
  eyebrow: string;
  title: string;
  detail: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** How every surface names the bleeding it logs. */
export interface BleedWords {
  /** Mid-sentence: "period" / "bleed". */
  noun: string;
  /** A label on its own: "Period" / "Bleeding". */
  label: string;
  /** The one-tap buttons. */
  started: string;
  ended: string;
  /** The dial's eyebrow while it lasts: "Period day" / "Bleeding day". */
  day: string;
}

/**
 * On hormonal contraception there is no period, only bleeding that follows the
 * method — the contraception page says so, and the screens say it the same way.
 */
export function bleedWords(mode: CycleMode): BleedWords {
  return mode === "hormonal"
    ? { noun: "bleed", label: "Bleeding", started: "Bleeding started", ended: "Bleeding stopped", day: "Bleeding day" }
    : { noun: "period", label: "Period", started: "Period started", ended: "Period ended", day: "Period day" };
}

/**
 * The phase names: the proper name, then what it means in plain words. The
 * library's how-it-works page lists the same names (a test holds them together).
 */
export const PHASE_NAMES = {
  follicular: "Follicular phase · building up to ovulation",
  midCycle: "Mid-cycle · around ovulation",
  luteal: "Luteal phase · after ovulation, before your period",
} as const;

export function phaseLabel(view: Pick<CycleView, "status">, showFertile: boolean): string | null {
  // Every day the window covers is called the fertile window, wide or not —
  // the cautious direction; the phase underneath follows the best estimate.
  if (showFertile && view.status.inFertileWindow) return "Fertile window (estimate)";
  switch (view.status.phase) {
    case "period":
      return "Period";
    case "follicular":
      return PHASE_NAMES.follicular;
    case "fertile":
      return showFertile ? "Fertile window (estimate)" : PHASE_NAMES.midCycle;
    case "luteal":
      return PHASE_NAMES.luteal;
    case "late":
      return "Later than usual";
    default:
      return null;
  }
}

/** "Next period in 15–18 days", "Period likely any day now", "… tomorrow". */
export function nextPeriodLine(view: CycleView): string | null {
  const s = view.status;
  if (!s.predicting || s.inPeriod || s.toEarliest === null || s.toLatest === null) return null;
  if (s.lateBy > 0) return `Late by ${plural(s.lateBy, "day")}`;
  if (s.toEarliest <= 0) return "Period likely any day now";
  if (s.toEarliest === s.toLatest) return `Next period in about ${plural(s.toEarliest, "day")}`;
  if (s.toEarliest === 1 && s.toLatest <= 2) return "Period likely in the next couple of days";
  return `Next period in ${s.toEarliest}–${s.toLatest} days`;
}

export function cycleHeadline(view: CycleView, showFertile: boolean): CycleHeadline {
  const s = view.status;
  const p = view.prediction;

  if (s.mode === "pregnancy") {
    return { eyebrow: "Cycle", title: "Paused during pregnancy", detail: "Your history is kept safe here." };
  }
  if (s.mode === "hormonal") {
    const pill = view.pill;
    if (s.inPeriod && s.periodDay !== null && !s.periodStale) {
      return {
        eyebrow: "Bleeding logged",
        title: `Day ${s.periodDay}`,
        detail: pill
          ? "Your next bleed is shown from your pack schedule."
          : "Logging only. I don't predict bleeding on hormonal contraception.",
      };
    }
    // The combined pill: one forecast, from the pack — never "your period" (./pill).
    if (pill) {
      return pill.missed
        ? { eyebrow: "Cycle", title: "No bleed logged yet", detail: pillLine(pill) }
        : { eyebrow: "Cycle", title: `Next bleed likely ${formatRange(pill.earliest, pill.latest)}`, detail: "From your pack schedule." };
    }
    return { eyebrow: "Cycle", title: "Logging only", detail: HORMONAL_LINE };
  }
  if (s.cycleDay === null) {
    return s.mode === "postpartum"
      ? {
          eyebrow: "Cycle",
          title: "Waiting for your first period",
          detail: "After a birth it can take a while. Log it when it comes.",
        }
      : { eyebrow: "Cycle", title: "Log your next period", detail: "Predictions start from your first log." };
  }
  if (s.mode === "menopause") {
    return s.inPeriod
      ? {
          eyebrow: "Bleeding logged",
          title: `Day ${s.periodDay}`,
          detail: "With menopause on your profile, this is worth mentioning to a doctor.",
        }
      : {
          eyebrow: "Cycle",
          title: "Logging only",
          detail: "With menopause on your profile there's nothing to predict.",
        };
  }
  if (s.inPeriod) {
    if (s.periodStale) {
      return { eyebrow: "Period", title: "Has it ended?", detail: "Tell me the last day and I'll re-tune." };
    }
    const overrun = s.periodDay !== null && s.periodDay > view.typicalBleed;
    const ending =
      !overrun && s.expectedEnd
        ? s.periodDay === view.typicalBleed
          ? "Usually your last day"
          : `Usually eases off around ${formatDay(s.expectedEnd, { weekday: true })}`
        : "Running a little longer than usual for you";
    return { eyebrow: "Period", title: `Day ${s.periodDay}`, detail: ending };
  }
  if (s.lateBy > 0) {
    return {
      eyebrow: `Cycle day ${s.cycleDay}`,
      title: `Late by ${plural(s.lateBy, "day")}`,
      detail: "Stress, travel, illness and training changes can all shift a cycle.",
    };
  }
  const next = nextPeriodLine(view);
  const phase = phaseLabel(view, showFertile);
  return {
    eyebrow: `Cycle day ${s.cycleDay}`,
    title: next ?? (phase ?? "Your cycle"),
    detail: [phase, p ? `most likely ${formatDay(p.likely, { weekday: true })}` : null]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * The same judgement as {@link confidenceLine}, in two words, for a glance.
 * Every message that names a window (the Home card, the coach, the trip and
 * late and hungry-week lines) speaks with THESE words, so no surface sounds
 * surer than the cycle screen does.
 */
export type ConfidenceWord =
  | "Fairly sure"
  | "Still learning"
  | "Varies for you"
  | "From your test"
  | "From your tests"
  | "From your temperature";

export function confidenceWord(p: Prediction): ConfidenceWord {
  // A window this cycle's own signs dated is not the calendar's guess.
  if (p.testBasis === "positive" || p.fromTest) return "From your test";
  if (p.testBasis === "negatives") return "From your tests";
  if (p.testBasis === "temperature") return "From your temperature";
  switch (p.confidence) {
    case "confident":
      return "Fairly sure";
    case "variable":
      return "Varies for you";
    case "told":
    case "learning":
      return "Still learning";
  }
}

/**
 * The word a glance surface shows beside the next-period window — or null when
 * it shows no window: logging-only and paused modes, during a period (the
 * window is about the next one), and once she's late (the window has passed).
 */
export function glanceConfidence(view: Pick<CycleView, "status" | "prediction">): ConfidenceWord | null {
  const s = view.status;
  if (!view.prediction || !s.predicting || s.inPeriod || s.lateBy > 0) return null;
  return confidenceWord(view.prediction);
}

/** How sure the prediction is, and why — the line that makes it trustworthy. */
/** What dated this cycle besides the calendar, in one sentence — or null. */
export function testBasisLine(p: Prediction): string | null {
  if (p.fromTest) return `Updated from your ovulation test on ${formatDay(p.fromTest, { weekday: true })}.`;
  if (p.testBasis === "negatives") return NEGATIVES_LINE;
  // Names no ovulation date: this line shows with the fertile window off too.
  if (p.testBasis === "temperature") return "Updated from your temperature: its rise confirmed ovulation this cycle.";
  return null;
}

/**
 * Why the fertile window is as wide as it is, when that needs saying — or
 * null. Never "safe days": a wide window says the edges are uncertain, not
 * that the days outside it are.
 */
export function fertileWindowNote(p: Prediction): string | null {
  if (p.testBasis) return null;
  const days = daysBetween(p.fertileStart, p.fertileEnd) + 1;
  if (p.basedOn === 0) return "A rough window from what you told me. It narrows as you log your periods.";
  if (days > WIDE_WINDOW_DAYS) return "Wide because your cycles vary. Ovulation tests narrow it.";
  return null;
}

/** Clear, stretchy discharge logged today (./view fertileNow): the cautious reading, no date moved. */
export const FERTILE_NOW_LINE =
  "You logged clear, stretchy discharge today, so today counts as fertile, whatever the estimate says.";

/** A run of negative tests moved this cycle's dates later (./predict negativesNotBefore). */
export const NEGATIVES_LINE = "Your tests haven't shown a surge yet, so I've moved your dates back.";

export function confidenceLine(p: Prediction): string {
  const basis = testBasisLine(p);
  if (basis) return basis;
  const n = p.basedOn;
  switch (p.confidence) {
    case "told":
      return "Based on what you told me. It sharpens with every period you log.";
    case "learning":
      return n === 0
        ? "Learning your rhythm. Log your next period and this sharpens."
        : `From your last ${plural(n, "cycle")}: ${p.recentLengths.join(" · ")} days. Still learning your rhythm.`;
    case "confident":
      return `From your last ${n} cycles: ${p.recentLengths.join(" · ")} days.`;
    case "variable": {
      const lo = Math.min(...p.recentLengths);
      const hi = Math.max(...p.recentLengths);
      return `Your cycles vary (${lo}–${hi} days), so the window is wider.`;
    }
  }
}

/**
 * "5 of your last 6 forecasts landed inside the window." — what ./backtest
 * counted, exactly: her recent completed cycles, each forecast re-run as it
 * stood the day after that period began. Null below MIN_BACKTEST.
 */
export function calibrationLine(p: Prediction): string | null {
  const c = p.calibration;
  if (!c || c.n < MIN_BACKTEST) return null;
  return `${c.hits} of your last ${c.n} forecasts landed inside the window.`;
}

/** "Likely 26–30 Oct · most likely Tue 28 Oct". */
export function windowLine(p: Prediction): string {
  return p.earliest === p.latest
    ? `Most likely ${formatDay(p.likely, { weekday: true })}`
    : `Likely ${formatRange(p.earliest, p.latest)} · most likely ${formatDay(p.likely, { weekday: true })}`;
}
