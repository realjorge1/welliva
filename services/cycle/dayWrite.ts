/**
 * services/cycle/dayWrite.ts — what one tap on the day sheet writes. PURE.
 *
 * The cycle provider (contexts/CycleContext) only loads, persists and re-lays
 * reminders; the decision about what a change to one day's log does to her
 * history lives here, so it can be tested against the real rule rather than a
 * copy of it (the 2026-11-16 audit's phantom-period scenario runs through this).
 *
 * A flow on a day outside any period goes through ./bleeding first: since
 * 2026-11-20 it starts a period only when it can be one (inside or near the
 * expected window, late, or with nothing to compare against). Bleeding between
 * periods stays a day log, and a clearly early flow waits for her answer.
 */

import { normalizeTemperatureC } from "./bbt";
import { classifyFlowDay, firstPeriodFlowDay, flowRunStart } from "./bleeding";
import { episodeOn, startPeriod, togglePeriodDay } from "./episodes";
import { cycleModeOf, predict, typicalPeriodLength, type CycleProfile } from "./predict";
import {
  isEmptyDayLog,
  type CycleData,
  type CycleDayLog,
  type CycleMood,
  type Discharge,
  type Energy,
  type Flow,
  type OvulationTest,
  type Symptom,
} from "./types";

/** A change to one day's log. `null` clears a field; `undefined` leaves it alone. */
export interface DayPatch {
  flow?: Flow | null;
  symptoms?: Symptom[];
  mood?: CycleMood | null;
  energy?: Energy | null;
  ovulationTest?: OvulationTest | null;
  /** "Kept me from school, work or plans" — only kept beside cramps. */
  stoppedDay?: true | null;
  /** Only offered with the fertile window on. */
  discharge?: Discharge | null;
  /** °C, normalized to 34–42 in 0.05 steps (./bbt); anything else is refused. */
  temperatureC?: number | null;
}

/** Flows that can mean a period day. Spotting never does. */
export const PERIOD_FLOWS: readonly Flow[] = ["light", "medium", "heavy"];

export interface DayWriteContext {
  today: string;
  /** ISO instant of the write — every changed document is stamped with it. */
  now: string;
  /** Her profile: the mode (pregnancy, menopause...) and the forecast depend on it. */
  profile: CycleProfile;
}

/** Her typical bleed and today's forecast, from the log as it stands before the write. */
function context(data: CycleData, ctx: DayWriteContext) {
  const mode = cycleModeOf(ctx.profile.conditions, data.settings.contraception?.answer);
  const prediction =
    mode === "pregnancy"
      ? null
      : predict({ episodes: data.periods, days: data.days, settings: data.settings, today: ctx.today, profile: ctx.profile });
  const typicalBleed = prediction?.periodLength ?? typicalPeriodLength(data.periods, data.settings).days;
  return { mode, prediction, typicalBleed };
}

/**
 * Apply `patch` to `date`'s log. Returns `data` itself when nothing changes, so
 * the provider writes nothing.
 */
export function applyDayPatch(data: CycleData, date: string, patch: DayPatch, ctx: DayWriteContext): CycleData {
  if (date > ctx.today) return data;
  const prev: CycleDayLog | undefined = data.days[date];
  const next: CycleDayLog = { ...(prev ?? { date }), date, updatedAt: ctx.now };
  const apply = <K extends keyof DayPatch>(key: K) => {
    const v = patch[key];
    if (v === undefined) return;
    if (v === null || (Array.isArray(v) && v.length === 0)) {
      delete (next as unknown as Record<string, unknown>)[key];
    } else {
      (next as unknown as Record<string, unknown>)[key] = Array.isArray(v) ? [...new Set(v)] : v;
    }
  };
  apply("flow");
  apply("symptoms");
  apply("mood");
  apply("energy");
  apply("ovulationTest");
  apply("stoppedDay");
  apply("discharge");
  if (patch.temperatureC !== undefined) {
    const t = patch.temperatureC === null ? null : normalizeTemperatureC(patch.temperatureC);
    if (patch.temperatureC !== null && t === null) return data; // out of range: nothing written
    if (t === null) delete next.temperatureC;
    else next.temperatureC = t;
  }
  // An answer about a symptom she has just un-ticked goes with it.
  if (next.relief) {
    const kept = next.relief.filter((r) => next.symptoms?.includes(r.symptom));
    if (kept.length) next.relief = kept;
    else delete next.relief;
  }
  // "Kept me from my day" is about the cramps: un-ticking them takes it too.
  if (next.stoppedDay && !next.symptoms?.includes("cramps")) delete next.stoppedDay;
  // "Not a period" is about the bleeding: clearing the flow takes it too.
  if (next.bleedAnswer && !next.flow) delete next.bleedAnswer;
  // Nothing logged, nothing to clear: don't create an empty day.
  if (isEmptyDayLog(next) && isEmptyDayLog(prev)) return data;
  const days = { ...data.days, [date]: next };

  // Only a change of FLOW can say anything about her periods: adding a symptom
  // to a day that already had one says nothing new.
  let periods = data.periods;
  if (patch.flow && PERIOD_FLOWS.includes(patch.flow)) {
    const { mode, prediction, typicalBleed } = context(data, ctx);
    if (!episodeOn(data.periods, date, ctx.today, typicalBleed)) {
      const kind = classifyFlowDay({
        date,
        flow: patch.flow,
        episodes: data.periods,
        days,
        prediction,
        mode,
        today: ctx.today,
        typicalBleed,
      });
      if (kind === "continues" || kind === "starts") {
        periods = togglePeriodDay(data.periods, date, true, ctx.today, typicalBleed, ctx.now);
      }
    }
  }
  return { ...data, periods, days };
}

/**
 * Her answer to "Is this the start of your period?" for the run of bleeding
 * `date` belongs to.
 *
 *   period  — the existing start path, from the run's first light-or-more day;
 *             any earlier "No" for the run is taken back.
 *   between — kept on the run's first day, so the question doesn't come back
 *             for those days. Nothing about her periods changes.
 */
export function answerBleed(
  data: CycleData,
  date: string,
  answer: "period" | "between",
  ctx: DayWriteContext,
): CycleData {
  if (date > ctx.today || !data.days[date]?.flow) return data;
  const runStart = flowRunStart(data.days, date);
  const first = data.days[runStart];
  if (answer === "between") {
    if (first?.bleedAnswer === "between") return data;
    return { ...data, days: { ...data.days, [runStart]: { ...first, bleedAnswer: "between", updatedAt: ctx.now } } };
  }
  const startDay = firstPeriodFlowDay(data.days, date) ?? date;
  const { typicalBleed } = context(data, ctx);
  const periods = startPeriod(data.periods, startDay, ctx.today, typicalBleed, ctx.now);
  let days = data.days;
  if (first?.bleedAnswer) {
    const cleared: CycleDayLog = { ...first, updatedAt: ctx.now };
    delete cleared.bleedAnswer;
    days = { ...data.days, [runStart]: cleared };
  }
  if (periods === data.periods && days === data.days) return data;
  return { ...data, periods, days };
}
