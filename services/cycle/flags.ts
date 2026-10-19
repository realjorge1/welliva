/**
 * services/cycle/flags.ts — "worth mentioning to a doctor", never a diagnosis.
 *
 * The thresholds are the ones agreed with the owner (2026-10-15), drawn from the
 * standard clinical descriptions of a typical cycle:
 *
 *   · cycles under 21 days, or over 35 — flagged only when it happens in TWO of
 *     the last six cycles. One odd month is a month, not a pattern.
 *   · bleeding for more than 7 days, in any of the last three periods she ended
 *     herself (an assumed end is never evidence)
 *   · big month-to-month swings: shortest-to-longest spread across her recent
 *     cycles beyond 7 days (ages 26–41) or 9 days (other ages) — the FIGO 2018
 *     regularity limits, which are wider for younger and older women
 *   · no period for 90 days outside pregnancy, postpartum and menopause
 *
 * Plus one life-stage note that is NOT a cycle irregularity: bleeding logged
 * while the profile says menopause. Bleeding after menopause should always be
 * checked, so it gets said plainly.
 *
 * Every note says what was seen, in her numbers, and that it is worth raising —
 * it never names a condition. A dismissed note stays dismissed until its
 * evidence changes: the `signature` is built from the dates behind it, so a new
 * long cycle brings it back and the same old one never does.
 */

import { daysBetween, formatDay } from "./dates";
import { liveEpisodes } from "./episodes";
import { STATS_WINDOW, type CycleMode, type CycleProfile, type CycleRecord } from "./predict";
import type { CycleSettings, PeriodEpisode } from "./types";

export type DoctorNoteId =
  | "short_cycles"
  | "long_cycles"
  | "long_bleeding"
  | "irregular"
  | "missed"
  | "menopause_bleeding";

export interface DoctorNote {
  id: DoctorNoteId;
  title: string;
  body: string;
  /** Changes only when the evidence does. */
  signature: string;
}

export interface NotesInput {
  cycles: readonly CycleRecord[];
  episodes: readonly PeriodEpisode[];
  today: string;
  mode: CycleMode;
  profile?: CycleProfile;
}

/** FIGO 2018: a regular cycle varies by ≤7 days at 26–41, ≤9 days otherwise. */
export function regularityLimit(age: number | null | undefined): number {
  return age != null && age >= 26 && age <= 41 ? 7 : 9;
}

const MISSED_AFTER_DAYS = 90;

function list(xs: number[]): string {
  return xs.join(", ");
}

export function doctorNotes(input: NotesInput): DoctorNote[] {
  const { cycles, today, mode } = input;
  const notes: DoctorNote[] = [];
  const recent = cycles.filter((c) => c.status === "counted").slice(-STATS_WINDOW);
  const m = recent.length;

  const short = recent.filter((c) => c.length < 21);
  if (short.length >= 2) {
    notes.push({
      id: "short_cycles",
      title: "Some short cycles",
      body: `${short.length} of your last ${m} cycles were shorter than 21 days (${list(
        short.map((c) => c.length),
      )} days). That's worth mentioning to a doctor. It often has a simple explanation, and they can tell you.`,
      signature: short.map((c) => c.start).join(","),
    });
  }

  const long = recent.filter((c) => c.length > 35);
  if (long.length >= 2) {
    notes.push({
      id: "long_cycles",
      title: "Some long cycles",
      body: `${long.length} of your last ${m} cycles were longer than 35 days (${list(
        long.map((c) => c.length),
      )} days). That's worth mentioning to a doctor. It's common, and it's worth knowing why.`,
      signature: long.map((c) => c.start).join(","),
    });
  }

  const ended = liveEpisodes(input.episodes)
    .filter((e) => e.end && !e.endEstimated)
    .slice(-3);
  const longBleeds = ended.filter((e) => daysBetween(e.start, e.end as string) + 1 > 7);
  if (longBleeds.length) {
    const latest = longBleeds[longBleeds.length - 1];
    const days = daysBetween(latest.start, latest.end as string) + 1;
    notes.push({
      id: "long_bleeding",
      title: "A long period",
      body: `Your period from ${formatDay(latest.start)} lasted ${days} days. Bleeding for more than 7 days is worth mentioning to a doctor.`,
      signature: longBleeds.map((e) => `${e.start}:${e.end}`).join(","),
    });
  }

  if (m >= 4) {
    const lengths = recent.map((c) => c.length);
    const lo = Math.min(...lengths);
    const hi = Math.max(...lengths);
    const limit = regularityLimit(input.profile?.age);
    if (hi - lo > limit) {
      const pcos = input.profile?.conditions?.includes("pcos");
      notes.push({
        id: "irregular",
        title: "Cycles that vary a lot",
        body:
          `Across your last ${m} cycles, the length has ranged from ${lo} to ${hi} days, a spread of ${
            hi - lo
          }. More than ${limit} days of difference is worth mentioning to a doctor.` +
          (pcos ? " You have PCOS on your profile, which can do this, so it's a good one to raise at your next appointment." : ""),
        signature: `${recent[0].start}:${lo}-${hi}`,
      });
    }
  }

  const live = liveEpisodes(input.episodes);
  const last = live.length ? live[live.length - 1] : null;

  if (mode === "normal" && last) {
    // An unended period this old is a forgotten tap, so it counts from its start too.
    const since = daysBetween(last.start, today);
    if (since >= MISSED_AFTER_DAYS) {
      notes.push({
        id: "missed",
        title: "No period logged for a while",
        body: `Your last logged period started ${since} days ago. If you've had periods and just not logged them, add them and this goes away. If not, it's worth mentioning to a doctor, and if there's any chance you're pregnant, a test can tell you.`,
        signature: last.start,
      });
    }
  }

  if (mode === "menopause" && last && daysBetween(last.start, today) <= 60) {
    notes.push({
      id: "menopause_bleeding",
      title: "Bleeding with menopause on your profile",
      body: "If it's been a year or more since your last period, any bleeding after that is worth getting checked by a doctor soon, not just at your next routine visit.",
      signature: last.start,
    });
  }

  return notes;
}

/** The notes she hasn't dismissed, or whose evidence has changed since she did. */
export function visibleNotes(
  notes: readonly DoctorNote[],
  settings: Pick<CycleSettings, "dismissedFlags">,
): DoctorNote[] {
  return notes.filter((n) => settings.dismissedFlags[n.id] !== n.signature);
}

/** Gaps that look like a missed log — asked about, never averaged in. */
export function gapQuestions(cycles: readonly CycleRecord[]): CycleRecord[] {
  return cycles.filter((c) => c.status === "gap");
}
