/**
 * services/cycle/flags.ts — "worth mentioning to a doctor", never a diagnosis.
 *
 * ONE STANDARD, FIGO 2018, held in ./standards (the owner's choice,
 * 2026-11-20; before that, length and bleeding used 21–35 and 7 days while
 * regularity used FIGO):
 *
 *   · cycles under 24 days, or over 38 (21 and 45 under the age of 20) —
 *     flagged only when it happens in TWO of the last six cycles. One odd month
 *     is a month, not a pattern. A long gap she hasn't answered about counts
 *     toward "long" as if it were one real cycle, and the note says so.
 *   · bleeding for more than 8 days, in any of the last three bleeds she ended
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
 * On hormonal contraception only the long-bleeding note applies. The gaps
 * between bleeds follow the method there, so short, long, irregular and missed
 * "cycles" would all be notes about the packet, not about her.
 *
 * And one from her own answers (./relief): cramps she said nothing eased, on
 * NOTHING_HELPED_NOTE or more of her recent answered days, more often than
 * anything else helped. The cramps page carries the same line and number.
 *
 * Three more from what she logs around her periods (./doctorChecks, which
 * holds the thresholds; 2026-11-13):
 *   · cramps that kept her from her day, in 2 of her last 3 periods with cramps
 *     (every mode that logs cramps; never in pregnancy)
 *   · a heavy flow on 3 or more days, in 2 of her last 3 periods that logged
 *     flow, with an iron blood test suggested when she also logged low energy
 *     inside them (also on hormonal contraception: it is about how much, not when)
 *   · bleeding between periods in 2 of her last 3 cycles, spotting right
 *     around her estimated ovulation left out (off on hormonal contraception,
 *     where bleeding between bleeds is common)
 *
 * Every note says what was seen, in her numbers, and that it is worth raising —
 * it never names a condition. A dismissed note stays dismissed until its
 * evidence changes: the `signature` is built from the dates behind it, so a new
 * long cycle brings it back and the same old one never does.
 */

import { daysBetween, formatDay } from "./dates";
import {
  betweenPeriods,
  completedPeriods,
  disruptiveCramps,
  HEAVY_DAYS,
  heavyPeriods,
  ofTheRecent,
  ofYourLast,
  strayBleedDays,
} from "./doctorChecks";
import { liveEpisodes, splitEpisodes } from "./episodes";
import { cycleRangeFor, MAX_NORMAL_BLEED_DAYS, regularityLimit } from "./standards";
import {
  lutealFor,
  POPULATION_PERIOD_DAYS,
  STATS_WINDOW,
  type CycleMode,
  type CycleProfile,
  type CycleRecord,
} from "./predict";
import { unrelieved } from "./relief";
import type { CycleDays, CycleSettings, PeriodEpisode } from "./types";

export type DoctorNoteId =
  | "short_cycles"
  | "long_cycles"
  | "long_bleeding"
  | "irregular"
  | "missed"
  | "menopause_bleeding"
  | "cramps_unrelieved"
  | "cramps_disruptive"
  | "heavy_periods"
  | "between_periods";

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
  /** Her day logs — for what she said helped (./relief), and what she logged around her periods. */
  days?: CycleDays;
  /** Her typical bleed, which resolves the end of a period she never closed. */
  typicalBleed?: number;
  /** The first day her history counts from (after a birth, after stopping a method). */
  since?: string | null;
}

// The thresholds live in ./standards (one medical standard, FIGO 2018); this
// re-export keeps the name where older readers look for it.
export { regularityLimit } from "./standards";

/** No period this long, outside pregnancy, postpartum and menopause, is worth raising. ./late quotes it. */
export const MISSED_AFTER_DAYS = 90;

function list(xs: number[]): string {
  return xs.join(", ");
}

export function doctorNotes(input: NotesInput): DoctorNote[] {
  const { cycles, today, mode } = input;
  const notes: DoctorNote[] = [];
  // On hormonal contraception the gaps between bleeds follow the method, so
  // the cycle-length notes say nothing about her cycle. A long bleed still
  // counts: it is worth raising on any method.
  const hormonal = mode === "hormonal";
  const recent = hormonal ? [] : cycles.filter((c) => c.status === "counted").slice(-STATS_WINDOW);
  const m = recent.length;

  // One standard (./standards): FIGO 2018's 24–38 days, or 21–45 under 20.
  const range = cycleRangeFor(input.profile?.age);
  const short = recent.filter((c) => c.length < range.min);
  if (short.length >= 2) {
    notes.push({
      id: "short_cycles",
      title: "Some short cycles",
      body: `${short.length} of your last ${m} cycles were shorter than ${range.min} days (${list(
        short.map((c) => c.length),
      )} days). That's worth mentioning to a doctor. It often has a simple explanation, and they can tell you.`,
      signature: short.map((c) => c.start).join(","),
    });
  }

  // A long gap she hasn't answered about stays out of the forecast (one skipped
  // log would distort it), but here it counts as if it were one real cycle — or
  // a real shift to long cycles would never reach this note. Said so.
  const longPool = hormonal
    ? []
    : cycles.filter((c) => c.status === "counted" || c.status === "gap").slice(-STATS_WINDOW);
  const long = longPool.filter((c) => c.length > range.max);
  if (long.length >= 2) {
    const unsure = long.filter((c) => c.status === "gap" || c.assumedLong).length;
    const asIf =
      unsure === 0
        ? ""
        : unsure === 1
          ? " That includes a long gap you haven't told me about, counted as if that was one real cycle."
          : ` That includes ${unsure} long gaps you haven't told me about, each counted as if it was one real cycle.`;
    notes.push({
      id: "long_cycles",
      title: "Some long cycles",
      body: `${long.length} of your last ${longPool.length} cycles were longer than ${range.max} days (${list(
        long.map((c) => c.length),
      )} days).${asIf} That's worth mentioning to a doctor. It's common, and it's worth knowing why.`,
      signature: long.map((c) => c.start).join(","),
    });
  }

  // How LONG she bled, so every bleed she ended herself counts — a stray
  // (bleeding between periods, ./episodes splitEpisodes) included. Only the
  // wording knows the difference.
  const { periods, strays } = splitEpisodes(input.episodes);
  const ended = [...periods, ...strays]
    .filter((e) => e.end && !e.endEstimated)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .slice(-3);
  const longBleeds = ended.filter((e) => daysBetween(e.start, e.end as string) + 1 > MAX_NORMAL_BLEED_DAYS);
  if (longBleeds.length) {
    const latest = longBleeds[longBleeds.length - 1];
    const days = daysBetween(latest.start, latest.end as string) + 1;
    const between = strays.some((s) => s.id === latest.id);
    const what = hormonal ? "Your bleed" : between ? "Bleeding" : "Your period";
    notes.push({
      id: "long_bleeding",
      title: hormonal || between ? "A long bleed" : "A long period",
      body: hormonal
        ? `${what} from ${formatDay(latest.start)} lasted ${days} days. Bleeding for more than ${MAX_NORMAL_BLEED_DAYS} days is worth mentioning to a doctor, or to whoever prescribes your contraception.`
        : `${what} from ${formatDay(latest.start)} lasted ${days} days. Bleeding for more than ${MAX_NORMAL_BLEED_DAYS} days is worth mentioning to a doctor.`,
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

  const last = periods.length ? periods[periods.length - 1] : null;
  // With menopause on the profile ANY bleeding is the event, stray or not.
  const live = liveEpisodes(input.episodes);
  const lastBleed = live.length ? live[live.length - 1] : null;

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

  // "Nothing helped", said often enough that the cramps page's own line applies:
  // pain that nothing eases is worth raising. Her answers, not a judgement.
  const pain = input.days && mode !== "pregnancy" ? unrelieved(input.days, "cramps") : null;
  if (pain) {
    notes.push({
      id: "cramps_unrelieved",
      title: "Cramps that nothing eased",
      body: `On ${pain.nothing} of the last ${pain.observed} days you had cramps, you told me nothing helped. Pain that nothing eases is worth mentioning to a doctor, who can look for the cause and what will help.`,
      signature: pain.dates.join(","),
    });
  }

  // ── What she logged around her periods (./doctorChecks) ──
  const days = input.days ?? {};
  const spans = completedPeriods(
    input.episodes,
    today,
    input.typicalBleed ?? POPULATION_PERIOD_DAYS,
    input.since ?? null,
  );
  const noun = hormonal ? "bleeds" : "periods";

  // Pain that stops her day: every mode where cramps are logged, never in pregnancy.
  const stopped = mode !== "pregnancy" ? disruptiveCramps(spans, days) : null;
  if (stopped) {
    const n = stopped.days.length;
    notes.push({
      id: "cramps_disruptive",
      title: "Cramps that stop your day",
      body: `Cramps kept you from your day ${ofYourLast(stopped.hits, stopped.observed, `${noun} with cramps`)} (${n} ${
        n === 1 ? "day" : "days"
      } in all). Pain that stops your normal day is worth mentioning to a doctor. It's the sign they look for, and there's usually something that helps.`,
      signature: stopped.days.join(","),
    });
  }

  // How much she bleeds, not when: so it stays on with hormonal contraception.
  // Menopause has its own note for any bleeding at all.
  const heavy = mode === "normal" || mode === "postpartum" || hormonal ? heavyPeriods(spans, days) : null;
  if (heavy) {
    const scope = heavy.consecutive
      ? ofYourLast(heavy.hits, heavy.observed, noun)
      : ofTheRecent(heavy.hits, heavy.observed, `${noun} you logged flow in`);
    notes.push({
      id: "heavy_periods",
      title: hormonal ? "Heavy bleeds" : "Heavy periods",
      body:
        `You logged a heavy flow on ${HEAVY_DAYS} or more days ${scope} (${list(heavy.heavyDays)} days). ` +
        (hormonal
          ? "That's worth mentioning to a doctor, or to whoever prescribes your contraception."
          : "That's worth mentioning to a doctor. It's common, and very treatable.") +
        (heavy.tired
          ? ` Heavy ${noun} and tiredness together are worth asking about. A simple blood test can check your iron.`
          : ""),
      signature: `${heavy.starts.join(",")}${heavy.tired ? ":tired" : ""}`,
    });
  }

  // Bleeding between periods. Off on hormonal contraception, where bleeding
  // between bleeds is common, and in the logging-only life stages.
  const between =
    mode === "normal" || mode === "postpartum"
      ? betweenPeriods(
          cycles,
          spans,
          days,
          lutealFor(cycles, days, !!input.profile?.conditions?.includes("pcos")).days,
          strayBleedDays(input.episodes, input.since ?? null),
        )
      : null;
  if (between) {
    notes.push({
      id: "between_periods",
      title: "Bleeding between periods",
      body: `Bleeding between periods ${ofYourLast(between.hits, between.observed, "cycles")} (${between.firsts
        .map((d) => formatDay(d))
        .join(", ")}). That's worth mentioning to a doctor, even when it's light. Spotting right around ovulation isn't counted, because that's common.`,
      signature: between.days.join(","),
    });
  }

  if (mode === "menopause" && lastBleed && daysBetween(lastBleed.start, today) <= 60) {
    notes.push({
      id: "menopause_bleeding",
      title: "Bleeding with menopause on your profile",
      body: "If it's been a year or more since your last period, any bleeding after that is worth getting checked by a doctor soon, not just at your next routine visit.",
      signature: lastBleed.start,
    });
  }

  return notes;
}

/**
 * The notes she hasn't dismissed, or whose evidence has GROWN since she did. A
 * signature is a comma-joined list of the evidence behind a note; a note whose
 * evidence is all among what she dismissed stays dismissed — so when fewer of
 * her cycles qualify (the move to FIGO 2018 on 2026-11-20, say), a note she
 * closed never comes back for no reason, and a new long cycle still brings it back.
 */
export function visibleNotes(
  notes: readonly DoctorNote[],
  settings: Pick<CycleSettings, "dismissedFlags">,
): DoctorNote[] {
  return notes.filter((n) => {
    const dismissed = settings.dismissedFlags[n.id];
    if (dismissed === undefined) return true;
    if (dismissed === n.signature) return false;
    const seen = new Set(dismissed.split(","));
    return !n.signature.split(",").every((t) => seen.has(t));
  });
}

/**
 * Gaps that look like a missed log, still waiting on her answer: the ones kept
 * out of the average, and the ones counted because they make a pattern
 * (`assumedLong`) — so she can always say she missed a log or was on a break.
 */
export function gapQuestions(cycles: readonly CycleRecord[]): CycleRecord[] {
  return cycles.filter((c) => c.status === "gap" || c.assumedLong);
}
