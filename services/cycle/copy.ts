/**
 * services/cycle/copy.ts — the words, derived from the view, in one place.
 *
 * The Home card, the cycle screen and the settings row all describe the same
 * moment; deriving every sentence here is what keeps them saying the same thing.
 * The register: plain, calm, never alarming, never cute — and never more
 * certain than the numbers behind it. A prediction is "likely", a window is a
 * window, and the fertile window is always called an estimate.
 */

import { HORMONAL_LINE } from "./contraception";
import { formatDay, formatRange } from "./dates";
import type { CycleMode, Prediction } from "./predict";
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

export function phaseLabel(view: CycleView, showFertile: boolean): string | null {
  switch (view.status.phase) {
    case "period":
      return "Period";
    case "follicular":
      return "Follicular phase";
    case "fertile":
      return showFertile ? "Fertile window (estimate)" : "Mid-cycle";
    case "luteal":
      return "Luteal phase";
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
    if (s.inPeriod && s.periodDay !== null && !s.periodStale) {
      return {
        eyebrow: "Bleeding logged",
        title: `Day ${s.periodDay}`,
        detail: "Logging only. I don't predict bleeding on hormonal contraception.",
      };
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
export type ConfidenceWord = "Fairly sure" | "Still learning" | "Varies for you";

export function confidenceWord(p: Prediction): ConfidenceWord {
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
export function confidenceLine(p: Prediction): string {
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

/** "Likely 26–30 Oct · most likely Tue 28 Oct". */
export function windowLine(p: Prediction): string {
  return p.earliest === p.latest
    ? `Most likely ${formatDay(p.likely, { weekday: true })}`
    : `Likely ${formatRange(p.earliest, p.latest)} · most likely ${formatDay(p.likely, { weekday: true })}`;
}
