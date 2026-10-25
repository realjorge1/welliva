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
  GOZLIN_ASK_LIMIT,
  MOOD_LABEL,
  SYMPTOM_LABEL,
  type CycleDayLog,
  type CycleSettings,
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

/* ────────────────────────── asking for permission ──────────────────────────
 * THE ASK, AND WHY IT IS NOT A SETTINGS TOGGLE.
 *
 * `cycle_gozlin` is off by default and nothing ever surfaced it, so the coach
 * was blind to her cycle for everyone except the handful of people who went
 * looking through Cycle settings. For a paying user that is the worst version
 * of the feature: she is paying for a coach that knows nothing about the one
 * thing shaping her day.
 *
 * So it is asked ONCE, WELL-TIMED, AND EASILY DECLINED:
 *
 *  · WELL-TIMED. Only on a day the answer would obviously change something —
 *    cramps or a heavy flow logged today, a period that is late, the first
 *    couple of days of one, a low mood or flat energy. Not on an ordinary day
 *    nine days out, where the honest answer to "why does it want this?" is
 *    "no reason yet".
 *  · NEVER ON THE DAY SHE TURNED TRACKING ON. She has just answered two
 *    questions about her body; a third about sending it somewhere, in the same
 *    minute, reads as the app taking advantage of momentum.
 *  · EASILY DECLINED. "Not now" is permanent (`gozlinAskDismissed`), and the
 *    toggle stays in Cycle settings for anyone who changes her mind.
 *  · AND IT GIVES UP. Scrolling past a card is not declining it — it may never
 *    have been seen — so an unanswered ask returns on another hard day, at most
 *    {@link GOZLIN_ASK_LIMIT} days in total, then never again.
 *
 * Pure, so the timing and the words are testable. Whether she CAN use the coach
 * is a billing question and belongs to the card, not here — the permission is
 * worth having in place either way, which is what the Settings toggle has
 * always said.
 */

/** What made today the moment. The card leads with it. */
export type GozlinAskReason = "cramps" | "heavy" | "late" | "period" | "mood" | "energy";

export interface GozlinAsk {
  reason: GozlinAskReason;
  /** Names what she logged, so the ask is obviously about today. */
  headline: string;
  /** What the coach would be able to do with it. */
  detail: string;
}

const ASK_COPY: Record<GozlinAskReason, { headline: string; detail: string }> = {
  cramps: {
    headline: "You logged cramps today",
    detail:
      "Gozlin can't see your cycle unless you say so. Switch it on and it knows the day you're on when you ask it anything — today's session, what to eat, why you feel like this.",
  },
  heavy: {
    headline: "A heavy day",
    detail:
      "Gozlin can't see your cycle unless you say so. Switch it on and it can answer about today knowing where you are — iron, training, how long this usually runs for you.",
  },
  late: {
    headline: "Your period is later than usual",
    detail:
      "Gozlin can't see your cycle unless you say so. Switch it on and you can ask about this without explaining it first.",
  },
  period: {
    headline: "Day one or two",
    detail:
      "Gozlin can't see your cycle unless you say so. Switch it on and it knows where you are when you ask about training, food or how you're feeling.",
  },
  mood: {
    headline: "A low day, logged",
    detail:
      "Gozlin can't see your cycle unless you say so. Switch it on and it can take the day you're on into account instead of guessing.",
  },
  energy: {
    headline: "Low energy today",
    detail:
      "Gozlin can't see your cycle unless you say so. Switch it on and it knows the day you're on when you ask what to do about it.",
  },
};

/**
 * Should the ask be in front of her today, and in what words? Null for no.
 *
 * @param input.sharing  consent `cycle_gozlin` — already granted means nothing to ask
 */
export function gozlinAsk(input: {
  settings: Pick<
    CycleSettings,
    "enabled" | "enabledAt" | "gozlinAskDismissed" | "gozlinAskDays"
  >;
  sharing: boolean;
  mode: CycleMode;
  status: CycleToday;
  todayLog?: CycleDayLog;
  today: string;
}): GozlinAsk | null {
  const { settings, sharing, mode, status, todayLog, today } = input;
  if (!settings.enabled || sharing || settings.gozlinAskDismissed) return null;
  // Nothing to share, and nothing the coach could do with it.
  if (mode === "pregnancy") return null;

  // Out of asks — unless today is one she has already been counted for, in
  // which case the card she is looking at should not vanish under her.
  const asked = settings.gozlinAskDays;
  if (asked.length >= GOZLIN_ASK_LIMIT && !asked.includes(today)) return null;

  // Not in the same breath as setting it up.
  const since = settings.enabledAt?.slice(0, 10);
  if (since && since >= today) return null;

  const reason = askReason(status, todayLog);
  return reason ? { reason, ...ASK_COPY[reason] } : null;
}

/** The moment, in priority order: the hardest fact about today wins. */
function askReason(status: CycleToday, log: CycleDayLog | undefined): GozlinAskReason | null {
  if (log?.symptoms?.includes("cramps")) return "cramps";
  if (log?.flow === "heavy") return "heavy";
  if (status.lateBy > 0) return "late";
  if (status.inPeriod && status.periodDay !== null && status.periodDay <= 2 && !status.periodStale) {
    return "period";
  }
  if (log?.mood === "low" || log?.mood === "irritable" || log?.mood === "anxious") return "mood";
  if (log?.energy === "low") return "energy";
  return null;
}
