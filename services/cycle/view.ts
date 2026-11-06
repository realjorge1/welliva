/**
 * services/cycle/view.ts — everything the screens show, derived in one place.
 *
 * Pure: the same data and the same day always give the same view. The React
 * provider, the headless reminder re-lay and the tests all call this, so the
 * Home card, the cycle screen and a lock-screen reminder can never disagree
 * about when her period is due.
 *
 * Cross-domain patterns (mood, sleep, training) are NOT here: they need the
 * Mind and workout logs, which only the cycle screen loads. Everything here
 * reads the cycle documents alone.
 */

import { cycleEase, headsUps, ironMoment, type CycleEase, type HeadsUp, type IronReason } from "./care";
import { daysBetween } from "./dates";
import { doctorNotes, gapQuestions, visibleNotes, type DoctorNote } from "./flags";
import {
  hungryAllowed,
  hungryOffer,
  hungryPattern,
  hungryPlanDays,
  type HungryOffer,
  type HungryPattern,
  type IntakePoint,
} from "./hungry";
import { timingPatterns, weightPattern, type CyclePattern, type WeighInPoint } from "./patterns";
import { reliefAsk, reliefRecalls, type ReliefAsk, type ReliefRecall } from "./relief";
import { comingUp, UPCOMING_HEADS_UP_DAYS, type ComingUp, type LifeMoment } from "./upcoming";
import { noisyWeightDates, waterMoment, type WaterMoment } from "./water";
import {
  buildCycles,
  countFrom,
  cycleModeOf,
  fertileWindowAllowed,
  predict,
  todayStatus,
  typicalPeriodLength,
  type CycleMode,
  type CycleProfile,
  type CycleRecord,
  type CycleToday,
  type Prediction,
} from "./predict";
import type { CycleData, CycleDayLog } from "./types";

/** Today's heads-ups are read at a glance: two is a note, five is a list. */
const MAX_HEADS_UPS = 2;

export interface CycleView {
  mode: CycleMode;
  /** Her typical bleed, for resolving an unended period. */
  typicalBleed: number;
  cycles: CycleRecord[];
  prediction: Prediction | null;
  status: CycleToday;
  /** Doctor notes she hasn't dismissed. */
  notes: DoctorNote[];
  /** Every note, dismissed or not (the doctor summary lists them all). */
  allNotes: DoctorNote[];
  /** Long gaps waiting on "did you miss a log?". */
  gaps: CycleRecord[];
  /** Symptom-timing patterns from the cycle log alone. */
  timing: CyclePattern[];
  headsUps: HeadsUp[];
  ease: CycleEase | null;
  iron: IronReason | null;
  todayLog: CycleDayLog | undefined;
  /**
   * The fertile window may be shown: she asked for it AND this mode predicts.
   * Every surface reads this, never `settings.showFertileWindow` on its own.
   */
  showFertile: boolean;
  /** "Yesterday's cramps: what helped most?" — today's one question, or null. */
  reliefAsk: ReliefAsk | null;
  /** What has helped her most, per symptom, once her answers meet the standard. */
  relief: ReliefRecall[];
  /** Trips and events a predicted period is likely to meet, soonest first. */
  comingUp: ComingUp[];
  /** Does her weight rise before her period? Only in the modes that predict. */
  weightPattern: CyclePattern | null;
  /** "That's water, not fat", about her latest reading — or null. */
  water: WaterMoment | null;
  /** Days a reading can't be read as fat, for the calorie model and the coach's trend. */
  noisyWeightDates: string[];
  /** Does she eat more before a period? Only in the mode that may plan for it. */
  hungry: HungryPattern | null;
  /** May she have the plan at all, whatever she has said about it? */
  hungryAllowed: boolean;
  /** "Want me to plan for it?" — today, or null. */
  hungryOffer: HungryOffer | null;
  /** Date → kcal for the period ahead, once she has said yes. */
  hungryPlan: Record<string, number>;
}

export function computeView(
  data: CycleData,
  ctx: {
    today: string;
    profile: CycleProfile;
    /** Her trips and events (./lifeMoments), which the provider reads for this. */
    moments?: readonly LifeMoment[];
    /** Her weigh-ins (services/BodyLogService). */
    weighIns?: readonly WeighInPoint[];
    /** Calories on days that RECORDED food (services/nutrition/recordedIntake). */
    intake?: readonly IntakePoint[];
    /** Her usual daily calorie target and its safety floor. */
    calories?: { targetKcal: number; floorKcal: number } | null;
  },
): CycleView {
  const { settings, periods, days } = data;
  const { today, profile } = ctx;
  const mode = cycleModeOf(profile.conditions, settings.contraception?.answer);
  const since = countFrom(settings, mode);
  const input = { episodes: periods, days, settings, today, profile };
  // On hormonal contraception the intervals between bleeds follow the method:
  // there is no cycle to read timing patterns from, and a long gap between
  // bleeds is expected rather than a missed log worth asking about.
  const logOnly = mode === "hormonal";

  const prediction = mode === "pregnancy" ? null : predict(input);
  const status = todayStatus(input, prediction);
  const cycles = buildCycles(periods, settings, today, since);
  const allNotes = doctorNotes({ cycles, episodes: periods, today, mode, profile, days });
  const timing = logOnly ? [] : timingPatterns(cycles, days);
  const relief = reliefRecalls(days);
  // Beside a forecast, her own answer is said back — except a painkiller, so a
  // heads-up about tomorrow can never read as "take something before it starts".
  const remedy = (subject: string) => {
    const r = relief.find((x) => x.symptom === subject);
    return r && r.helped !== "painkiller" ? r.short : null;
  };
  const upcoming = comingUp({ prediction, status, moments: ctx.moments ?? [], timing, cycles, days });
  // A few days out, an event a period is likely to land on joins today's heads-ups.
  const soon: HeadsUp[] = upcoming
    .filter((u) => {
      const until = daysBetween(today, u.start);
      return until >= 0 && until <= UPCOMING_HEADS_UP_DAYS;
    })
    .map((u) => ({ id: `upcoming:${u.id}`, icon: "calendar-outline", text: u.text }));
  const fromPatterns = status.predicting || status.inPeriod ? headsUps(timing, status, prediction, remedy) : [];
  const weighIns = ctx.weighIns ?? [];
  // With tracking off it "hides everywhere": nothing here may keep shaping her
  // calorie target or the coach's weight trend from behind the switch.
  const on = settings.enabled;
  const weight = on && (mode === "normal" || mode === "postpartum") ? weightPattern(cycles, weighIns) : null;
  const eating = on && mode === "normal" ? hungryPattern(cycles, ctx.intake ?? []) : null;
  const hungryInput = {
    pattern: eating,
    mode,
    profile,
    status,
    prediction,
    targetKcal: ctx.calories?.targetKcal ?? null,
    floorKcal: ctx.calories?.floorKcal ?? null,
  };

  return {
    mode,
    typicalBleed: prediction?.periodLength ?? typicalPeriodLength(periods, settings).days,
    cycles,
    prediction,
    status,
    notes: visibleNotes(allNotes, settings),
    allNotes,
    gaps: logOnly ? [] : gapQuestions(cycles),
    timing,
    headsUps: [...soon, ...fromPatterns].slice(0, MAX_HEADS_UPS),
    ease: cycleEase({
      enabled: settings.enabled,
      mode,
      today,
      days,
      fullSessionDays: settings.fullSessionDays,
    }),
    iron:
      settings.enabled && mode !== "pregnancy"
        ? ironMoment({ today, days, episodes: periods, status, conditions: profile.conditions })
        : null,
    todayLog: days[today],
    showFertile: fertileWindowAllowed(settings.showFertileWindow, mode),
    reliefAsk: reliefAsk({ days, today, mode, enabled: settings.enabled }),
    relief,
    comingUp: upcoming,
    weightPattern: weight,
    water: on
      ? waterMoment({ mode, status, prediction, cycles, weighIns, pattern: weight, today, noteOn: settings.waterNoteOn })
      : null,
    noisyWeightDates: noisyWeightDates({ pattern: weight, cycles, status, prediction, today }),
    hungry: eating,
    hungryAllowed: hungryAllowed(mode, profile),
    hungryOffer: hungryOffer({ ...hungryInput, settings, today }),
    hungryPlan: hungryPlanDays({ ...hungryInput, settings }),
  };
}
