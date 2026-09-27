/**
 * RECALL — "last time you tried this, you said…", only when "this" is back.
 *
 * A memory is offered to the model when its subject reappears, and at no
 * other time:
 *
 *   mentioned — the person named it just now. Always: staying quiet about
 *               their own history when they bring it up is amnesia, not tact.
 *   planned   — it is in today's session.
 *   logged    — they did it today.
 *
 * The last two rest for RECALL.restDays once a reply has actually USED the
 * memory. Without that, a Monday plan would bring up the same sentence every
 * Monday — the coach turns into a broken record, and a broken record about
 * someone's body reads as surveillance.
 *
 * At most RECALL.max memories ride in one turn, never the store.
 *
 * Pure. `now` injected.
 */

import { parseLocalDate, toLocalDateString } from "../../OfflineStorage";
import { mentionsSubject, normalizeName, type ExerciseSubject } from "./subjects";
import type { ExperienceRecord } from "./types";

export const RECALL = {
  max: 3,
  /** Days a used memory rests before a plan or log may raise it again. */
  restDays: 21,
  /** A memory made this recently is not "last time" — it is this morning. */
  freshHours: 20,
} as const;

export type RecallTrigger = "mentioned" | "planned" | "logged";

export interface RecallPick {
  record: ExperienceRecord;
  trigger: RecallTrigger;
  /** The same exercise, or another variant of its family. */
  match: "variant" | "family";
  /** Whole days from when they tried it (or told us) to today. Shown AND registered. */
  daysAgo: number;
}

/** Is there anything in it worth recalling? A bare record says nothing. */
export function hasContent(r: ExperienceRecord): boolean {
  if (r.forgotten) return false;
  return !!r.quote || r.soreness != null || r.enjoyed != null || r.feelings.length > 0;
}

function daysAgo(r: ExperienceRecord, now: Date): number {
  const from = r.triedOn ?? toLocalDateString(new Date(r.answeredAt));
  const today = toLocalDateString(now);
  return Math.max(
    0,
    Math.round((parseLocalDate(today).getTime() - parseLocalDate(from).getTime()) / 86_400_000),
  );
}

const TRIGGER_ORDER: Record<RecallTrigger, number> = { mentioned: 0, planned: 1, logged: 2 };

export interface RecallInput {
  records: readonly ExperienceRecord[];
  /** The message being answered. */
  text: string;
  planned: readonly ExerciseSubject[];
  logged: readonly ExerciseSubject[];
  now: Date;
}

export function recallFor(input: RecallInput): RecallPick[] {
  const { records, text, planned, logged, now } = input;
  const t = now.getTime();
  const picks: RecallPick[] = [];

  for (const record of records) {
    if (!hasContent(record)) continue;

    const hits: { trigger: RecallTrigger; match: RecallPick["match"] }[] = [];
    if (text && mentionsSubject(text, record)) hits.push({ trigger: "mentioned", match: "variant" });

    const resting =
      (!!record.lastRecalledAt &&
        t - Date.parse(record.lastRecalledAt) < RECALL.restDays * 86_400_000) ||
      t - Date.parse(record.answeredAt) < RECALL.freshHours * 3_600_000;
    if (!resting) {
      for (const [trigger, list] of [
        ["planned", planned],
        ["logged", logged],
      ] as const) {
        for (const s of list) {
          if (s.variantKey === record.variantKey) hits.push({ trigger, match: "variant" });
          else if (s.familyKey === record.familyKey) hits.push({ trigger, match: "family" });
        }
      }
    }
    if (hits.length === 0) continue;

    hits.sort(byStrength);
    picks.push({ record, ...hits[0], daysAgo: daysAgo(record, now) });
  }

  return picks
    .sort((a, b) => byStrength(a, b) || b.record.answeredAt.localeCompare(a.record.answeredAt))
    .slice(0, RECALL.max);
}

/** Their own mention first, then today's plan, then today's log; exact before family. */
function byStrength(
  a: { trigger: RecallTrigger; match: RecallPick["match"] },
  b: { trigger: RecallTrigger; match: RecallPick["match"] },
): number {
  return (
    TRIGGER_ORDER[a.trigger] - TRIGGER_ORDER[b.trigger] ||
    (a.match === b.match ? 0 : a.match === "variant" ? -1 : 1)
  );
}

// ── Reading a reply back ────────────────────────────────────────────────────

/** Words that name nothing on their own — "up", "leg", "hold". */
const WEAK = new Set(["up", "leg", "arm", "hold", "single", "standing", "seated", "body", "the"]);

/**
 * Does the text refer to this exercise at all, loosely? Any distinctive word of
 * its name or family. Used only to read the MODEL's reply about a subject it
 * was just handed — "how did the Nordics sit?" names Nordic Hamstring Curls
 * perfectly well without all three words.
 */
export function refersTo(text: string, subject: { label: string; familyKey: string }): boolean {
  if (mentionsSubject(text, subject)) return true;
  const said = new Set(normalizeName(text).split(" "));
  const words = [
    ...normalizeName(subject.label).split(" "),
    ...(subject.familyKey.startsWith("ai:") ? [] : normalizeName(subject.familyKey).split(" ")),
  ].filter((w) => w.length >= 3 && !WEAK.has(w));
  return words.some((w) => said.has(w));
}

/** Split into sentences, keeping each one's terminal mark. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Did the reply ASK about it? A sentence that refers to the subject and ends
 * in a question mark. Deterministic, and allowed to be wrong in the cheap
 * direction: a miss only means the line rides one more turn, inside the cap.
 */
export function askedInReply(reply: string, subject: { label: string; familyKey: string }): boolean {
  return sentences(reply).some((s) => s.endsWith("?") && refersTo(s, subject));
}

/** The memories a reply actually used — what earns a YOU TOLD ME receipt. */
export function recallsUsed(reply: string, picks: readonly RecallPick[]): RecallPick[] {
  return picks.filter((p) => refersTo(reply, p.record));
}
