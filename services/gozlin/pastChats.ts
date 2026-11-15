/**
 * GOZLIN — what it remembers from earlier conversations.
 *
 * Gozlin sees the last 20 messages of the thread you are in. Before this, a
 * chat you closed was gone from its view: it could not say "on 3 October we
 * talked about your knee on squats, and you were going to try box squats; how
 * did that go?", even though that conversation sat in the chat history on the
 * same phone.
 *
 * This module turns the chat history into a small brief, with NO extra AI call:
 *
 *   - each past thread's topic (the title the history list already shows) and
 *     the day it happened,
 *   - anything they said they'd try ("I'll try box squats", or "ok I'll try
 *     that" after the coach suggested something),
 *   - the "tried something new" notes made during it (ExperienceStore),
 *   - the facts they asked Gozlin to remember that came up in it.
 *
 * Everything is DERIVED, every time, from what is already stored. Nothing new is
 * saved except the list of chats the person told Gozlin to forget, so deleting
 * a chat, "Forget everything" and deleting the account all take this memory
 * with them, and nothing new leaves the phone.
 *
 * THE RULES that keep it honest and safe:
 *   - NO FIGURES. Any item holding a digit or a number word is dropped, never
 *     reworded: the brief is not evidence, and grounding must never meet a
 *     number it cannot back. The only digits rendered are the day of a date,
 *     which grounding already reads as a date.
 *   - Nothing from it joins the grounding allowed-set or the receipt ledger.
 *   - A thread where they said something the clinical screen catches is never
 *     brought up again on an unrelated turn.
 *   - A "try" that is about eating less, skipping or fasting is never recalled.
 *   - Hard cap: at most MAX_THREADS lines. The block is sent on every turn and
 *     is never cached.
 */

import { readJSON, toLocalDateString, writeJSON } from "../OfflineStorage";
import { screenForClinicalRisk } from "./agent/clinical";
import type { ArchivedConversation } from "./GozlinMemoryStore";
import type { GozlinIdentityMemory, GozlinMessage } from "./gozlin.types";
import type { ExperienceRecord } from "./novelty/types";

/** The ids of past chats the person told Gozlin to forget. Ids only. */
export const PAST_CHAT_FORGOTTEN_KEY = "@gozlin_past_chats_forgotten";

/** Most past chats one turn can carry: the block is uncached and paid every turn. */
export const MAX_THREADS = 6;
/** Of those, most chosen for matching what they just asked (the rest: the latest). */
const MAX_RELEVANT = 4;
/** Older than this, a plan they mentioned is more likely stale than useful. */
export const PAST_CHAT_MAX_AGE_DAYS = 120;
const MAX_TRIES = 2;
const MAX_NOTES = 2;
const MAX_FACTS = 2;
const MAX_TRY_WORDS = 6;
/** A note made within this of a thread's first/last message belongs to it. */
const NOTE_SLACK_MS = 5 * 60_000;
const FORGOTTEN_CAP = 200;
const DAY_MS = 86_400_000;

export interface PastChat {
  /** The archived conversation's id: what Forget records. */
  id: string;
  /** Local YYYY-MM-DD the chat ended. */
  day: string;
  endedAt: number;
  /** The history list's title, or null when it holds a figure. */
  title: string | null;
  /** What they said they'd try, in their words (or the coach's, when they agreed). */
  tries: string[];
  /** Things they told Gozlin about after trying something new, during this chat. */
  notes: string[];
  /** Facts they asked Gozlin to remember that came up in this chat. */
  facts: string[];
  /** Word stems of the chat, for matching only. Never rendered. */
  words: string[];
}

// ── Words ──────────────────────────────────────────────────────────────────

const STOP = new Set(
  (
    "the and but for with about from into than then them they their there here this that these those " +
    "what why how when where which who whom whose was were are been being have has had does did doing " +
    "can could should would will shall may might must just really very much more most some any get got " +
    "still also not yes okay today yesterday tomorrow tonight week weeks day days think know want need " +
    "like feel felt gozlin please thanks thank hey hello you your yours mine myself our ours its it's " +
    "i'm i've i'll i'd im ive ill going gonna try trying tried let lets maybe well good great sure"
  ).split(/\s+/),
);

const NUMBER_WORD =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|half)\b/i;

/** True when the text could put a figure in front of the model. */
function holdsFigure(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORD.test(text);
}

function stem(w: string): string {
  let s = w.replace(/'s$/, "");
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  // "squatt" (from squatting) → "squat"
  if (s.length > 3 && s[s.length - 1] === s[s.length - 2]) s = s.slice(0, -1);
  return s;
}

/** Content-word stems, lower-case, no stop words, nothing with a digit. */
export function contentStems(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[‘’]/g, "'").split(/[^a-z']+/)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (w.length < 3 || STOP.has(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

// ── "I'll try …" ───────────────────────────────────────────────────────────

const STOP_AFTER = String.raw`(?=[.!?;,:\n]|\s+(?:and then|then|tomorrow|tonight|today|next|this week|this time|instead|again|later|first|soon|for a while|to see)\b|$)`;
const USER_TRY = new RegExp(
  String.raw`\b(?:i'?ll|i will|i'?m going to|i am going to|i'?m gonna|gonna|going to|i want to|i'?d like to|let me|i might|i could|i should|maybe i'?ll)\s+(?:try|give)\s+(.{2,80}?)` + STOP_AFTER,
  "gi",
);
const COACH_TRY = new RegExp(String.raw`\btry(?:ing)?\s+(.{2,80}?)` + STOP_AFTER, "i");
const PRONOUN_ONLY = /^(?:that|it|this|those|these|them|that one|this one|it out|that out|your idea|your suggestion|what you said)$/i;
/** Never recalled: a plan to eat less is not something a coach should follow up. */
const RESTRICTIVE =
  /\b(?:skip\w*|fast(?:ing|ed)?|starv\w*|purg\w*|go(?:ing)? without|cut(?:ting)? out|eat(?:ing)? less|less food|fewer calories|laxative\w*|throw(?:ing)? up|diet pills?|water fast|juice cleanse)\b/i;

function cleanTry(raw: string): string | null {
  let s = raw.trim().replace(/\s+/g, " ");
  s = s.replace(/^(?:to|out|doing|some|a few|the idea of)\s+/i, "");
  s = s.replace(/\s+(?:a go|a try|a shot|out)$/i, "");
  s = s.replace(/[\s"'”’)]+$/g, "");
  if (!s || PRONOUN_ONLY.test(s)) return null;
  const words = s.split(" ");
  if (words.length > MAX_TRY_WORDS) s = words.slice(0, MAX_TRY_WORDS).join(" ");
  if (holdsFigure(s) || RESTRICTIVE.test(s)) return null;
  return s;
}

/**
 * What they said they would try, in order. "ok I'll try that" takes the thing
 * from the coach's message just before it: they agreed to that suggestion.
 */
export function triesIn(messages: readonly GozlinMessage[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user" || typeof m.content !== "string") continue;
    for (const match of m.content.matchAll(USER_TRY)) {
      const said = match[1].trim();
      let phrase: string | null = null;
      if (PRONOUN_ONLY.test(said.replace(/[\s.!?]+$/, ""))) {
        const before = [...messages.slice(0, i)].reverse().find((x) => x.role === "coach");
        const suggested = before ? COACH_TRY.exec(before.content ?? "") : null;
        phrase = suggested ? cleanTry(suggested[1]) : null;
      } else {
        phrase = cleanTry(said);
      }
      if (phrase && !out.some((p) => p.toLowerCase() === phrase!.toLowerCase())) out.push(phrase);
    }
  }
  return out.slice(0, MAX_TRIES);
}

// ── Deriving ───────────────────────────────────────────────────────────────

export interface PastChatSources {
  archive: readonly ArchivedConversation[];
  experiences?: readonly ExperienceRecord[];
  identity?: Pick<GozlinIdentityMemory, "preferences" | "constraints"> | null;
  forgotten?: readonly string[];
  now?: Date;
}

/**
 * Every past chat Gozlin may remember, newest first. The Memory screen lists
 * exactly these; a turn carries the few that matter (selectPastChats).
 */
export function derivePastChats(src: PastChatSources): PastChat[] {
  const now = (src.now ?? new Date()).getTime();
  const forgotten = new Set(src.forgotten ?? []);
  const facts = [...(src.identity?.constraints ?? []), ...(src.identity?.preferences ?? [])].filter(
    (f) => typeof f === "string" && f.trim() && !holdsFigure(f),
  );
  const notes = (src.experiences ?? []).filter((r) => !r.forgotten && !r.clinical && r.label);

  const out: PastChat[] = [];
  for (const a of src.archive) {
    if (!a || forgotten.has(a.id) || !Array.isArray(a.messages)) continue;
    const endedAt = Number(a.endedAt) || 0;
    if (now - endedAt > PAST_CHAT_MAX_AGE_DAYS * DAY_MS) continue;

    const userTexts = a.messages
      .filter((m) => m.role === "user" && typeof m.content === "string")
      .map((m) => m.content);
    // A conversation the safety screen caught is not small talk to revisit.
    if (userTexts.some((t) => screenForClinicalRisk(t) !== null)) continue;

    const stems = new Set(contentStems(userTexts.join(" ")));
    const tries = triesIn(a.messages);
    const startedAt = Number(a.startedAt) || endedAt;
    const noted = notes
      .filter((r) => {
        const at = Date.parse(r.answeredAt);
        return at >= startedAt - NOTE_SLACK_MS && at <= endedAt + NOTE_SLACK_MS;
      })
      .map((r) => r.label.trim())
      .filter((l) => !holdsFigure(l));
    const factsHere = facts.filter((f) => {
      const fs = contentStems(f);
      return fs.length > 0 && fs.every((w) => stems.has(w));
    });

    const title = a.title && a.title !== "Conversation" && !holdsFigure(a.title) ? a.title.trim() : null;
    if (!title && tries.length === 0 && noted.length === 0 && factsHere.length === 0) continue;

    for (const t of [title ?? "", ...tries, ...noted]) for (const w of contentStems(t)) stems.add(w);
    out.push({
      id: a.id,
      day: toLocalDateString(new Date(endedAt)),
      endedAt,
      title,
      tries,
      notes: [...new Set(noted)].slice(0, MAX_NOTES),
      facts: factsHere.slice(0, MAX_FACTS),
      words: [...stems],
    });
  }
  return out.sort((x, y) => y.endedAt - x.endedAt);
}

/**
 * The few this turn carries: the ones that share words with what they just
 * asked, most shared first, then the latest to fill. Newest first.
 */
export function selectPastChats(chats: readonly PastChat[], userText: string, max = MAX_THREADS): PastChat[] {
  const asked = new Set(contentStems(userText));
  const scored = chats.map((c) => ({ c, score: c.words.filter((w) => asked.has(w)).length }));
  const relevant = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.c.endedAt - a.c.endedAt)
    .slice(0, Math.min(MAX_RELEVANT, max))
    .map((s) => s.c);
  const chosen = new Set(relevant.map((c) => c.id));
  const fill = chats.filter((c) => !chosen.has(c.id)).slice(0, Math.max(0, max - relevant.length));
  return [...relevant, ...fill].sort((a, b) => b.endedAt - a.endedAt);
}

// ── Rendering ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Friday 3 October": a written date, which the number check reads as a date. */
export function sayChatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(y, (m || 1) - 1, d || 1);
  return `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** One plain sentence of what is remembered — the Memory screen and the export use it too. */
export function pastChatSummary(c: PastChat): string {
  const parts: string[] = [];
  if (c.tries.length) parts.push(`you said you'd try ${joinAnd(c.tries)}`);
  if (c.notes.length) parts.push(`you told Gozlin how ${joinAnd(c.notes)} went`);
  if (c.facts.length) parts.push(`you mentioned ${joinAnd(c.facts.map((f) => `"${f}"`))}`);
  const s = parts.join("; ");
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const LINE_MAX = 170;

function chatLine(c: PastChat): string {
  const bits = [c.title ? `"${c.title}"` : "a chat"];
  if (c.tries.length) bits.push(`they said they'd try ${joinAnd(c.tries)}`);
  if (c.notes.length) bits.push(`they told you how ${joinAnd(c.notes)} went`);
  if (c.facts.length) bits.push(`it came up that: ${c.facts.join("; ")}`);
  const line = `- ${sayChatDay(c.day)}: ${bits.join("; ")}`;
  return line.length > LINE_MAX ? `${line.slice(0, LINE_MAX - 1).replace(/\s+\S*$/, "")}…` : line;
}

/**
 * The state-block lines (TIER 3). Empty when there is nothing to remember, so
 * a first-time user's block is byte-identical to before.
 */
export function pastChatLines(chats: readonly PastChat[] | undefined, userText: string): string[] {
  if (!chats || chats.length === 0) return [];
  const picked = selectPastChats(chats, userText);
  if (picked.length === 0) return [];
  return [
    "",
    "EARLIER CONVERSATIONS (from the chat history on their phone: the day, the topic and their own words; memories, not evidence, so never cite a figure because of them). Bring one up only when it bears on what they are asking now; name the day you talked and ask how it went rather than assume. Plans change: what they tell you now wins.",
    ...picked.map(chatLine),
  ];
}

// ── Forgetting ─────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribePastChats(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** After a forget here, and from clearGozlinMemory. */
export function announcePastChats(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.log("[pastChats] subscriber failed:", e);
    }
  }
}

export async function loadForgottenPastChats(): Promise<string[]> {
  const list = await readJSON<string[]>(PAST_CHAT_FORGOTTEN_KEY, []);
  return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
}

/**
 * Gozlin stops bringing this chat up. The chat itself stays in the history
 * (deleting it there takes this memory with it too).
 */
export async function forgetPastChat(id: string): Promise<string[]> {
  const list = await loadForgottenPastChats();
  if (list.includes(id)) return list;
  const next = [...list, id].slice(-FORGOTTEN_CAP);
  await writeJSON(PAST_CHAT_FORGOTTEN_KEY, next);
  announcePastChats();
  return next;
}
