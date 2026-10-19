/**
 * services/cycle/brief.ts — the little Gozlin may see, when she says so.
 *
 * The cycle log never reaches the coach by default. When she switches on
 * "Let Gozlin see your cycle" (consent category `cycle_gozlin`), each chat turn
 * carries THIS and nothing more: where she is in her cycle, when the next period
 * is likely, her typical length, and what she logged today. No dates, no
 * history, no fertile window unless she has chosen to see one herself.
 *
 * The brief is also the grounding evidence: every number in the lines below is
 * a field of the object, so the reply may quote "day 12" exactly when it was
 * put in front of the model (services/gozlin/agent/grounding).
 */

import type { CycleMode, CycleToday, Phase, Prediction } from "./predict";
import {
  ENERGY_LABEL,
  FLOW_LABEL,
  MOOD_LABEL,
  SYMPTOM_LABEL,
  type CycleDayLog,
} from "./types";

export interface CycleBrief {
  lifeStage: CycleMode;
  cycleDay: number | null;
  periodDay: number | null;
  /** Plain words: "period", "follicular", "mid-cycle", "fertile window", "luteal", "late". */
  phase: string | null;
  /** Days from today to the likely window, when predicting. */
  nextPeriodFrom: number | null;
  nextPeriodTo: number | null;
  lateByDays: number | null;
  typicalCycleDays: number | null;
  /** What she logged today, in words. */
  loggedToday: string[];
}

function phaseWords(phase: Phase | null, showFertile: boolean): string | null {
  switch (phase) {
    case "period":
      return "period";
    case "follicular":
      return "follicular phase";
    case "fertile":
      return showFertile ? "fertile window (estimate)" : "mid-cycle";
    case "luteal":
      return "luteal phase";
    case "late":
      return "period later than predicted";
    default:
      return null;
  }
}

export function buildCycleBrief(input: {
  status: CycleToday;
  prediction: Prediction | null;
  todayLog?: CycleDayLog;
  showFertileWindow: boolean;
}): CycleBrief {
  const { status, prediction, todayLog } = input;
  const logged: string[] = [];
  if (todayLog?.flow) logged.push(`${FLOW_LABEL[todayLog.flow].toLowerCase()} flow`);
  for (const s of todayLog?.symptoms ?? []) logged.push(SYMPTOM_LABEL[s].toLowerCase());
  if (todayLog?.mood) logged.push(`mood: ${MOOD_LABEL[todayLog.mood].toLowerCase()}`);
  if (todayLog?.energy) logged.push(`energy: ${ENERGY_LABEL[todayLog.energy].toLowerCase()}`);

  const predicting = status.predicting && prediction !== null;
  return {
    lifeStage: status.mode,
    cycleDay: status.cycleDay,
    periodDay: status.periodDay,
    phase: phaseWords(status.phase, input.showFertileWindow),
    nextPeriodFrom: predicting && !status.inPeriod ? Math.max(0, status.toEarliest ?? 0) : null,
    nextPeriodTo: predicting && !status.inPeriod ? Math.max(0, status.toLatest ?? 0) : null,
    lateByDays: status.lateBy > 0 ? status.lateBy : null,
    typicalCycleDays: prediction && prediction.basedOn > 0 ? prediction.cycleLength : null,
    loggedToday: logged,
  };
}

/** The state-block lines. Empty when there is nothing worth a token. */
export function cycleStateLines(brief: CycleBrief | null | undefined): string[] {
  if (!brief) return [];
  if (brief.lifeStage === "pregnancy") {
    return ["", "CYCLE (she chose to share this): cycle tracking is paused during pregnancy."];
  }
  const facts: string[] = [];
  if (brief.periodDay !== null) facts.push(`on her period, day ${brief.periodDay}`);
  else if (brief.cycleDay !== null) {
    facts.push(`cycle day ${brief.cycleDay}${brief.phase ? ` (${brief.phase})` : ""}`);
  }
  if (brief.lateByDays !== null) {
    facts.push(`period ${brief.lateByDays} days later than her predicted window`);
  } else if (brief.nextPeriodFrom !== null && brief.nextPeriodTo !== null) {
    facts.push(
      brief.nextPeriodFrom === brief.nextPeriodTo
        ? `next period likely in about ${brief.nextPeriodFrom} days (an estimate)`
        : `next period likely in ${brief.nextPeriodFrom}–${brief.nextPeriodTo} days (an estimate)`,
    );
  }
  if (brief.typicalCycleDays !== null) facts.push(`her cycles usually run about ${brief.typicalCycleDays} days`);
  if (brief.lifeStage === "menopause") facts.push("menopause is on her profile");
  if (brief.lifeStage === "postpartum") facts.push("she is postpartum");
  if (brief.loggedToday.length) facts.push(`logged today: ${brief.loggedToday.join(", ")}`);
  if (!facts.length) return [];
  return [
    "",
    "HER CYCLE (she chose to share this; bring it up only where it bears on what she asked, never diagnose, and treat predictions as estimates, never as contraception):",
    ...facts.map((f) => `- ${f}`),
  ];
}
