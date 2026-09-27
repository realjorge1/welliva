/**
 * GOZLIN AGENT — "trying something new", as the model sees it.
 * docs/gozlin/11-trying-something-new.md.
 *
 * The engines (../novelty) decide WHAT and WHEN. This file turns their answer
 * into the lines of the current-state block and nothing more; the model
 * decides HOW to say it, inside a conversation, or not at all.
 *
 * ── ONE FUNCTION, TWO READERS ───────────────────────────────────────────────
 * `experienceEvidence` is read by the state-block renderer (./context.ts) AND
 * by the grounding and receipt side (./GozlinAgent.ts) — the same rule as
 * habitEvidence and identityEvidence. The block says "23 sessions logged
 * before it" and "15 days ago"; if grounding were built from anything else,
 * the model would be rejected for repeating a number we handed it. `facts` is
 * exactly the figures `lines` contains, no more: a number that was not shown
 * is never made citable.
 *
 * ── WHY THE LINES ARE INSTRUCTIONS ──────────────────────────────────────────
 * The same lesson as the habit cross-reference: left as a bare fact, "new
 * exercise yesterday" gets RECITED. Framed as a condition — only if there is
 * room, once, in passing — it gets used the way a coach would use it.
 */

import { parseLocalDate, toLocalDateString } from "../../OfflineStorage";
import type { GozlinChatContext } from "../GozlinChatEngine";
import { chatStage, type ChatStage } from "../novelty/curiosity";
import { recallFor, refersTo, type RecallPick } from "../novelty/recall";
import {
  catalogIdForName,
  familyByRules,
  mentionsSubject,
  normalizeName,
  subjectFor,
  type ExerciseSubject,
} from "../novelty/subjects";
import { wasTried } from "../novelty/detector";
import type { CuriosityEntry, Enjoyed, ExperienceRecord, Soreness } from "../novelty/types";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Fri 26 Sep" — a written date, which grounding reads as a date, not a figure. */
export function sayDay(date: string): string {
  const d = parseLocalDate(date);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);
}

export const SORENESS_WORDS: Record<Soreness, string> = {
  0: "not sore",
  1: "a bit sore",
  2: "quite sore",
  3: "very sore",
};

const ENJOYED_WORDS: Record<Enjoyed, string> = {
  yes: "liked it",
  mixed: "mixed about it",
  no: "did not enjoy it",
};

const TRIGGER_WORDS: Record<RecallPick["trigger"], string> = {
  mentioned: "they just brought it up",
  planned: "it is in today's plan",
  logged: "they did it today",
};

export interface ExperienceEvidence {
  stage: ChatStage | null;
  due: CuriosityEntry | null;
  recalls: RecallPick[];
  /** Exactly the figures `lines` shows — registered for grounding and receipts. */
  facts: {
    question: { exercise: string; sessionsBefore: number } | null;
    memories: { exercise: string; daysAgo: number; said: string | null }[];
  } | null;
  lines: string[];
}

const NONE: ExperienceEvidence = { stage: null, due: null, recalls: [], facts: null, lines: [] };

function answerWords(r: ExperienceRecord): string {
  const bits: string[] = [];
  if (r.soreness != null) bits.push(SORENESS_WORDS[r.soreness]);
  if (r.enjoyed) bits.push(ENJOYED_WORDS[r.enjoyed]);
  if (r.feelings.length > 0) bits.push(`felt ${r.feelings.join(", ")}`);
  return bits.join("; ");
}

function questionLines(due: CuriosityEntry, today: string): string[] {
  const ago = daysBetween(due.triedOn, today);
  const when = ago === 1 ? "yesterday" : ago === 2 ? "the day before yesterday" : sayDay(due.triedOn);
  const what =
    due.novelty === "harder"
      ? "the hardest version of this movement on their log so far"
      : "the first time it has appeared on their log";
  return [
    "",
    "WORTH ASKING ABOUT — only if the conversation leaves room; at most once; never in place of answering them:",
    `${due.label}, done ${when} (${sayDay(due.triedOn)}) — ${what}; ${due.evidence.sessionsBefore} sessions logged before it, going back to ${sayDay(due.evidence.since)}.`,
    "Why now: a new movement often shows up a day or two later, as soreness.",
    'Ask how it sat with them, in passing and in your own words. "Fine" is a complete answer. When they answer, record it with note_experience, copying their words exactly. If it does not fit this reply, leave it out — the app offers it another way.',
  ];
}

function captureLines(due: CuriosityEntry): string[] {
  return [
    "",
    `YOU ASKED THEM ABOUT ${due.label} (done ${sayDay(due.triedOn)}). If their message answers it — even just "fine" — record it with note_experience, copying their words exactly. Do not ask about it again.`,
  ];
}

function recallLines(picks: RecallPick[]): string[] {
  if (picks.length === 0) return [];
  const lines = [
    "",
    "WHAT THEY TOLD YOU BEFORE ABOUT SOMETHING THAT IS BACK TODAY (their own words, one occasion each). Bring one up only where it helps, quoting them with the date. One occasion is not a pattern: never say it caused anything, never call it an intolerance, an allergy, an injury or a condition, and never tell them to avoid something because of it.",
  ];
  for (const p of picks) {
    const r = p.record;
    const when = r.triedOn
      ? `tried ${sayDay(r.triedOn)}, ${p.daysAgo} days ago`
      : `mentioned ${sayDay(toLocalDateString(new Date(r.answeredAt)))}, ${p.daysAgo} days ago`;
    const said = r.quote
      ? `${r.source === "volunteered" ? "They told you" : "Asked afterwards, they said"}: "${r.quote}"`
      : "They answered without words";
    const answers = answerWords(r);
    const family = p.match === "family" ? " (a different version of it)" : "";
    let line = `- ${r.label}${family} — ${TRIGGER_WORDS[p.trigger]}; ${when}. ${said}${answers ? ` (${answers})` : ""}.`;
    if (r.clinical) {
      line += " They described a symptom here: do not interpret it; if it matters today, ask whether they have had it looked at.";
    }
    lines.push(line);
  }
  return lines;
}

/**
 * The question and the memories for this turn — rendered lines plus exactly
 * the figures in them. Empty whenever the brief is absent or switched off.
 */
export function experienceEvidence(
  text: string,
  ctx: Pick<GozlinChatContext, "experiences">,
  now: Date,
): ExperienceEvidence {
  const brief = ctx.experiences;
  if (!brief?.enabled) return NONE;

  const today = toLocalDateString(now);
  const stage = chatStage(brief.due, now);
  const due = stage ? brief.due : null;
  const recalls = recallFor({
    records: brief.records,
    text,
    planned: brief.planned,
    logged: brief.logged,
    now,
  });
  if (!due && recalls.length === 0) return NONE;

  const lines: string[] = [];
  if (due && stage === "ask") lines.push(...questionLines(due, today));
  if (due && stage === "capture") lines.push(...captureLines(due));
  lines.push(...recallLines(recalls));

  return {
    stage,
    due,
    recalls,
    facts: {
      question:
        due && stage === "ask"
          ? { exercise: due.label, sessionsBefore: due.evidence.sessionsBefore }
          : null,
      memories: recalls.map((p) => ({
        exercise: p.record.label,
        daysAgo: p.daysAgo,
        said: p.record.quote,
      })),
    },
    lines,
  };
}

// ── note_experience's half ──────────────────────────────────────────────────

/** Typographic quotes, built from code points so the source stays readable. */
const CURLY_SINGLE = new RegExp(`[${String.fromCharCode(0x2018, 0x2019)}]`, "g");
const CURLY_DOUBLE = new RegExp(`[${String.fromCharCode(0x201c, 0x201d)}]`, "g");

/** Lowercase, straight quotes, single spaces, no surrounding punctuation. */
function flatten(text: string): string {
  return text
    .toLowerCase()
    .replace(CURLY_SINGLE, "'")
    .replace(CURLY_DOUBLE, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'.,!?;:\s]+|["'.,!?;:\s]+$/g, "");
}

/**
 * Is `quote` their own words? It must appear, as written, in something they
 * typed this turn or just before it. This is what makes "you said…" true BY
 * CONSTRUCTION: the model cannot paraphrase its way into someone's memory, and
 * it cannot record what they never said.
 */
export function isVerbatim(quote: string, userTexts: readonly string[]): boolean {
  const q = flatten(quote);
  if (q.length < 2) return false;
  return userTexts.some((t) => flatten(t).includes(q));
}

export interface ResolvedNoteSubject {
  subject: ExerciseSubject;
  triedOn: string | null;
  /** It answers the question that is open, rather than being volunteered. */
  answersDue: boolean;
}

/** How far back a volunteered note may find the session it is about. */
const NOTE_LOOKBACK_DAYS = 14;

/**
 * What exercise a note is about. The open question first, then their recent
 * sessions, then the catalog and the family rules. Nothing else: a note about
 * a food, a class, a supplement resolves to nothing and is not recorded —
 * Phase 1 is exercises only (docs/gozlin/11 §9).
 */
export function resolveNoteSubject(
  name: string,
  ctx: Pick<GozlinChatContext, "experiences" | "snapshot">,
  now: Date,
): ResolvedNoteSubject | null {
  const said = name.trim();
  if (!said) return null;
  const due = ctx.experiences?.due ?? null;

  if (due && (refersTo(said, due) || normalizeName(said) === normalizeName(due.label))) {
    return {
      subject: {
        variantKey: due.variantKey,
        familyKey: due.familyKey,
        label: due.label,
        category: due.category,
        difficulty: "intermediate",
      },
      triedOn: due.triedOn,
      answersDue: true,
    };
  }

  const catalogId = catalogIdForName(said);
  const ruleFamily = familyByRules(said);
  const today = toLocalDateString(now);
  const recent = [...(ctx.snapshot?.sessionHistory ?? [])]
    .filter((s) => s?.date && daysBetween(s.date, today) >= 0 && daysBetween(s.date, today) <= NOTE_LOOKBACK_DAYS)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  for (const s of recent) {
    for (const r of s.exerciseResults ?? []) {
      if (!wasTried(r)) continue;
      const subject = subjectFor({
        exerciseId: r.exerciseId,
        name: r.exerciseName,
        category: r.category,
        difficulty: r.difficulty,
      });
      if (
        subject.variantKey === catalogId ||
        mentionsSubject(said, subject) ||
        (ruleFamily !== null && ruleFamily === subject.familyKey)
      ) {
        return { subject, triedOn: s.date, answersDue: false };
      }
    }
  }

  if (catalogId || ruleFamily) {
    const subject = subjectFor({
      exerciseId: catalogId ?? `ai_0_0_${said}`,
      name: said,
      category: "core",
      difficulty: "intermediate",
    });
    return { subject, triedOn: null, answersDue: false };
  }
  return null;
}
