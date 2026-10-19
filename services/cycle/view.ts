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
import { doctorNotes, gapQuestions, visibleNotes, type DoctorNote } from "./flags";
import { timingPatterns, type CyclePattern } from "./patterns";
import {
  buildCycles,
  cycleModeOf,
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
}

export function computeView(
  data: CycleData,
  ctx: { today: string; profile: CycleProfile },
): CycleView {
  const { settings, periods, days } = data;
  const { today, profile } = ctx;
  const mode = cycleModeOf(profile.conditions);
  const since = mode === "postpartum" ? settings.postpartumSince : null;
  const input = { episodes: periods, days, settings, today, profile };

  const prediction = mode === "pregnancy" ? null : predict(input);
  const status = todayStatus(input, prediction);
  const cycles = buildCycles(periods, settings, today, since);
  const allNotes = doctorNotes({ cycles, episodes: periods, today, mode, profile });
  const timing = timingPatterns(cycles, days);

  return {
    mode,
    typicalBleed: prediction?.periodLength ?? typicalPeriodLength(periods, settings).days,
    cycles,
    prediction,
    status,
    notes: visibleNotes(allNotes, settings),
    allNotes,
    gaps: gapQuestions(cycles),
    timing,
    headsUps: status.predicting || status.inPeriod ? headsUps(timing, status, prediction) : [],
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
  };
}
