/**
 * services/cycle/brief.ts — the little Gozlin may see, when she says so.
 *
 * The cycle log never reaches the coach by default. When she switches on
 * "Let Gozlin see your cycle" (consent category `cycle_gozlin`), each chat turn
 * carries THIS and nothing more: where she is in her cycle, when the next period
 * is likely and how sure that is, her typical length, what she logged today,
 * whether she uses hormonal contraception (which is why nothing is predicted),
 * what she said helped a symptom, and what her logs show around her cycle: what
 * changed when a period is late, her weight before a period, a hungrier-week plan,
 * and a period that falls during a trip. No history, and no fertile window unless
 * she has chosen to see one herself. Every line is a token on every message, and
 * the Privacy Policy, the consent row and cycle settings all list these same things,
 * so a new line here means new words in all three.
 *
 * The brief is also the grounding evidence: every number in the lines below is
 * a field of the object, so the reply may quote "day 12" exactly when it was
 * put in front of the model (services/gozlin/agent/grounding).
 */

import { glanceConfidence, type ConfidenceWord } from "./copy";
import { hungryForCoach } from "./hungry";
import type { LateContext } from "./late";
import type { CyclePattern } from "./patterns";
import type { CycleMode, CycleToday, Phase, Prediction } from "./predict";
import type { ReliefRecall } from "./relief";
import type { ComingUp } from "./upcoming";
import { waterForCoach, type WaterMoment } from "./water";
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
  /** How sure that window is — the cycle screen's words, so the coach can't sound surer. */
  sure: ConfidenceWord | null;
  /** What she logged today, in words. */
  loggedToday: string[];
  /** What has helped her most, from her own answers: "heat for cramps (3 of the last 4 times)". */
  remedies?: string[];
  /** While late: what changed this cycle (./late), in words about her. Empty = nothing stands out. */
  lateChanges?: string[] | null;
  /** Events a predicted period is likely to meet (./upcoming), in words about her. */
  upcoming?: string[];
  /** Her weight rising before her period (./water), once her own weigh-ins confirm it. */
  water?: string | null;
  /** The hungrier-week plan she chose (./hungry), and what it does today. */
  hungry?: string | null;
}

/** Every line costs tokens on every message: the soonest two are plenty. */
const UPCOMING_FOR_COACH = 2;

/** The confidence words, said about her rather than to her. */
const SURE_FOR_COACH: Record<ConfidenceWord, string> = {
  "Fairly sure": "fairly sure",
  "Still learning": "still learning her rhythm",
  "Varies for you": "her cycles vary, so the window is wide",
};

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
  /** The view's recalls (./relief) — only ones that met the standard. */
  relief?: readonly ReliefRecall[];
  /** The late reading (./late), when she is late. */
  late?: LateContext | null;
  /** The view's overlaps with her trips and events (./upcoming). */
  comingUp?: readonly ComingUp[];
  /** The view's weight pattern and today's reading of it (./water). */
  weightPattern?: CyclePattern | null;
  water?: WaterMoment | null;
  /** Her hungrier-week plan: on or off, and today's kcal from the ledger. */
  hungryPlan?: { on: boolean; todayKcal: number };
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
    sure: glanceConfidence({ status, prediction }),
    loggedToday: logged,
    remedies: (input.relief ?? []).map((r) => r.fact),
    lateChanges: input.late && status.lateBy > 0 ? input.late.changes.map((c) => c.coach) : null,
    upcoming: (input.comingUp ?? []).slice(0, UPCOMING_FOR_COACH).map((u) => u.coach),
    water: waterForCoach(input.weightPattern ?? null, input.water ?? null),
    hungry: hungryForCoach(input.hungryPlan?.on ?? false, input.hungryPlan?.todayKcal ?? 0),
  };
}

/** The state-block lines. Empty when there is nothing worth a token. */
export function cycleStateLines(brief: CycleBrief | null | undefined): string[] {
  if (!brief) return [];
  if (brief.lifeStage === "pregnancy") {
    return ["", "CYCLE (she chose to share this): cycle tracking is paused during pregnancy."];
  }
  const facts: string[] = [];
  const hormonal = brief.lifeStage === "hormonal";
  if (brief.periodDay !== null) {
    facts.push(hormonal ? `bleeding, day ${brief.periodDay}` : `on her period, day ${brief.periodDay}`);
  } else if (brief.cycleDay !== null && !hormonal) {
    facts.push(`cycle day ${brief.cycleDay}${brief.phase ? ` (${brief.phase})` : ""}`);
  }
  if (hormonal) {
    facts.push("she uses hormonal contraception, so her bleeding follows the method and nothing is predicted");
  }
  if (brief.lateByDays !== null) {
    facts.push(`period ${brief.lateByDays} days later than her predicted window`);
    if (brief.lateChanges) {
      facts.push(
        brief.lateChanges.length
          ? `what's been different this cycle, from her logs (changes that can delay a period, never a cause or a diagnosis): ${brief.lateChanges.join("; ")}`
          : "nothing stands out in what she logged this cycle",
      );
    }
  } else if (brief.nextPeriodFrom !== null && brief.nextPeriodTo !== null) {
    const how = brief.sure ? `an estimate; ${SURE_FOR_COACH[brief.sure]}` : "an estimate";
    facts.push(
      brief.nextPeriodFrom === brief.nextPeriodTo
        ? `next period likely in about ${brief.nextPeriodFrom} days (${how})`
        : `next period likely in ${brief.nextPeriodFrom}–${brief.nextPeriodTo} days (${how})`,
    );
  }
  if (brief.upcoming?.length) facts.push(`coming up: ${brief.upcoming.join("; ")}`);
  if (brief.water) facts.push(brief.water);
  if (brief.hungry) facts.push(brief.hungry);
  if (brief.typicalCycleDays !== null) facts.push(`her cycles usually run about ${brief.typicalCycleDays} days`);
  if (brief.lifeStage === "menopause") facts.push("menopause is on her profile");
  if (brief.lifeStage === "postpartum") facts.push("she is postpartum");
  if (brief.loggedToday.length) facts.push(`logged today: ${brief.loggedToday.join(", ")}`);
  if (brief.remedies?.length) {
    facts.push(`what has helped her before, by her own answers (her experience, not a recommendation): ${brief.remedies.join("; ")}`);
  }
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
