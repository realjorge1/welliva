/**
 * services/cycle/relief.ts — "what helped last time?"
 *
 * The day after she logs cramps, a headache, back pain or nausea, ONE question:
 * "Yesterday's cramps: what helped most?" One tap answers it, "Skip" is fine,
 * and it is never a notification. After a few answers the app can say it back
 * where it matters: under the symptom when she ticks it again, beside a heads-up
 * that it is likely tomorrow, and to the coach if she shares her cycle.
 *
 * THE STANDARD is the one ./patterns keeps, applied to answers instead of cycles:
 *   · nothing is said from one answer — the same thing must have helped on at
 *     least {@link RELIEF_MIN_WINS} days, and it must have helped MOST (a tie
 *     is no winner);
 *   · the scope is stated exactly: "the last 3 times", or "on 3 of the last 4
 *     days you had cramps" — the denominator is the days she answered, never
 *     the days she didn't;
 *   · it is HER answer said back, never advice. Nothing here names a dose or
 *     recommends a painkiller, and a forward-looking heads-up leaves a painkiller
 *     out even when it is what she chose (./view), so a reminder can never read
 *     as "take something before it starts".
 *
 * WHERE IT LIVES. On the symptom day's own log (`CycleDayLog.relief`), so it
 * rides the day merge, the backup namespace, the export and Erase with no new
 * key. A skip is stored the same way, as "skipped", because three skips in a
 * row for one symptom is how the question learns to stop asking about it.
 *
 * Off in pregnancy, like everything else. Otherwise it asks in every mode:
 * what eased a symptom has nothing to do with predicting a period.
 */

import { addDays } from "./dates";
import type { CycleMode } from "./predict";
import {
  RELIEF_SYMPTOMS,
  SYMPTOM_LABEL,
  type CycleDayLog,
  type CycleDays,
  type Relief,
  type ReliefSymptom,
} from "./types";

/** Days the same answer must have won before "X helped most" is said: once is an anecdote. */
export const RELIEF_MIN_WINS = 2;
/** How many answered days the recall reads, newest first: recent enough to describe her now. */
export const RELIEF_WINDOW = 6;
/** Skips in a row after which a symptom is not asked about again: three is a clear "no thanks". */
export const RELIEF_SKIP_LIMIT = 3;
/**
 * "Nothing helped" this many times — and more often than any other answer —
 * becomes a doctor note (./flags). The cramps page quotes the same number.
 */
export const NOTHING_HELPED_NOTE = 3;

/** Answers she can give, in the order they are offered. */
export const RELIEF_OPTIONS: readonly { value: Relief; label: string }[] = [
  { value: "heat", label: "Heat" },
  { value: "moving", label: "Moving (walk, stretch)" },
  { value: "painkiller", label: "Painkiller" },
  { value: "rest", label: "Rest" },
  { value: "sleep", label: "Sleep" },
  { value: "hot_drink", label: "Hot drink or food" },
  { value: "other", label: "Something else" },
  { value: "nothing", label: "Nothing helped" },
];

/** The answers that can be said back. "Something else" names nothing; "Nothing helped" is a note, not a remedy. */
export type SayableRelief = Exclude<Relief, "other" | "nothing">;

const PHRASE: Record<SayableRelief, string> = {
  heat: "heat",
  moving: "moving (a walk or a stretch)",
  painkiller: "a painkiller",
  rest: "rest",
  sleep: "sleep",
  hot_drink: "a hot drink or food",
};

/** How each symptom reads mid-sentence: "the last 3 times you had cramps". */
const HAD: Record<ReliefSymptom, string> = {
  cramps: "cramps",
  headache: "a headache",
  back_pain: "back pain",
  nausea: "nausea",
};

/** For lists: "heat for cramps", "rest for headaches". */
export const RELIEF_NOUN: Record<ReliefSymptom, string> = {
  cramps: "cramps",
  headache: "headaches",
  back_pain: "back pain",
  nausea: "nausea",
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ───────────────────────────── the question ───────────────────────────── */

export interface ReliefAsk {
  /** The symptom day the answer is stored on — yesterday. */
  date: string;
  symptom: ReliefSymptom;
  question: string;
}

/** Days she logged `symptom` and gave an answer about it (a skip included), newest first. */
function asked(days: CycleDays, symptom: ReliefSymptom): { date: string; helped: Relief | "skipped" }[] {
  const out: { date: string; helped: Relief | "skipped" }[] = [];
  for (const [date, log] of Object.entries(days)) {
    if (!log.symptoms?.includes(symptom)) continue;
    const note = log.relief?.find((r) => r.symptom === symptom);
    if (note) out.push({ date, helped: note.helped });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Her real answers about `symptom` — skips left out — newest first. */
function answered(days: CycleDays, symptom: ReliefSymptom): { date: string; helped: Relief }[] {
  return asked(days, symptom).filter((a): a is { date: string; helped: Relief } => a.helped !== "skipped");
}

/** Skips in a row, counted back from her most recent answer about `symptom`. */
export function skipStreak(days: CycleDays, symptom: ReliefSymptom): number {
  let n = 0;
  for (const a of asked(days, symptom)) {
    if (a.helped !== "skipped") break;
    n += 1;
  }
  return n;
}

/**
 * Today's question, or null. About YESTERDAY's log only, one symptom (the most
 * significant she logged and still wants asked about), and not at all once
 * yesterday has any answer or skip on it: one question a day, at most.
 */
export function reliefAsk(input: {
  days: CycleDays;
  today: string;
  mode: CycleMode;
  enabled: boolean;
}): ReliefAsk | null {
  if (!input.enabled || input.mode === "pregnancy") return null;
  const date = addDays(input.today, -1);
  const log = input.days[date];
  if (!log?.symptoms?.length || log.relief?.length) return null;
  for (const symptom of RELIEF_SYMPTOMS) {
    if (!log.symptoms.includes(symptom)) continue;
    if (skipStreak(input.days, symptom) >= RELIEF_SKIP_LIMIT) continue;
    return {
      date,
      symptom,
      question: `Yesterday's ${SYMPTOM_LABEL[symptom].toLowerCase()}: what helped most?`,
    };
  }
  return null;
}

/** The day's log with her answer about `symptom` in it (replacing an earlier one). */
export function withRelief(
  log: CycleDayLog,
  symptom: ReliefSymptom,
  helped: Relief | "skipped",
  now: string,
): CycleDayLog {
  const relief = [...(log.relief ?? []).filter((r) => r.symptom !== symptom), { symptom, helped }];
  return { ...log, relief, updatedAt: now };
}

/* ───────────────────────────── saying it back ───────────────────────────── */

export interface ReliefRecall {
  symptom: ReliefSymptom;
  helped: SayableRelief;
  /** Days it helped most, and the answered days read. */
  hits: number;
  observed: number;
  /** For the day sheet: "The last 3 times you had cramps, heat helped most." */
  line: string;
  /** After a sentence about the symptom: "Heat helped most the last 3 times." */
  short: string;
  /** For the coach and the doctor summary: "heat for cramps (3 of the last 4 times)", or "(the last 2 times)". */
  fact: string;
}

/** Answer → how often she gave it, in the window. */
function tally(answers: readonly { helped: Relief }[]): Map<Relief, number> {
  const counts = new Map<Relief, number>();
  for (const a of answers) counts.set(a.helped, (counts.get(a.helped) ?? 0) + 1);
  return counts;
}

/** What helped her most with `symptom`, once the standard is met — else null. */
export function reliefRecall(days: CycleDays, symptom: ReliefSymptom): ReliefRecall | null {
  const answers = answered(days, symptom).slice(0, RELIEF_WINDOW);
  let best: Relief | null = null;
  let hits = 0;
  let tied = false;
  for (const [answer, n] of tally(answers)) {
    if (n > hits) {
      best = answer;
      hits = n;
      tied = false;
    } else if (n === hits) {
      tied = true;
    }
  }
  if (!best || tied || hits < RELIEF_MIN_WINS || best === "other" || best === "nothing") return null;

  const observed = answers.length;
  const phrase = PHRASE[best];
  const all = hits === observed;
  return {
    symptom,
    helped: best,
    hits,
    observed,
    line: all
      ? `The last ${observed} times you had ${HAD[symptom]}, ${phrase} helped most.`
      : `${capital(phrase)} helped most on ${hits} of the last ${observed} days you had ${HAD[symptom]}.`,
    short: all
      ? `${capital(phrase)} helped most the last ${observed} times.`
      : `${capital(phrase)} helped most on ${hits} of the last ${observed} times.`,
    fact: all
      ? `${phrase} for ${RELIEF_NOUN[symptom]} (the last ${observed} times)`
      : `${phrase} for ${RELIEF_NOUN[symptom]} (${hits} of the last ${observed} times)`,
  };
}

/** Every symptom she has a recall for, in the order of significance. */
export function reliefRecalls(days: CycleDays): ReliefRecall[] {
  return RELIEF_SYMPTOMS.map((s) => reliefRecall(days, s)).filter((r): r is ReliefRecall => r !== null);
}

/**
 * "Nothing helped", often enough to say so: at least {@link NOTHING_HELPED_NOTE}
 * times in the window, and more often than any single other answer. Null otherwise.
 */
export function unrelieved(
  days: CycleDays,
  symptom: ReliefSymptom,
): { nothing: number; observed: number; dates: string[] } | null {
  const answers = answered(days, symptom).slice(0, RELIEF_WINDOW);
  const counts = tally(answers);
  const nothing = counts.get("nothing") ?? 0;
  if (nothing < NOTHING_HELPED_NOTE) return null;
  for (const [answer, n] of counts) if (answer !== "nothing" && n >= nothing) return null;
  return {
    nothing,
    observed: answers.length,
    dates: answers.filter((a) => a.helped === "nothing").map((a) => a.date),
  };
}
