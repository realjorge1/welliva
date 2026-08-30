/**
 * GOZLIN — what this conversation is ABOUT, and whether it was ever finished.
 *
 * Three pure functions, all deterministic, all testable, none of which touch
 * storage or React. They exist because the coach screen makes two claims it
 * previously had no way to back:
 *
 *   1. the header names the thread you are in, the way ChatGPT does
 *   2. the Action Bar offers to take you back to one you walked out of
 *
 * ── WHY THE TITLE IS DERIVED HERE AND NOT ASKED FOR ─────────────────────────
 *
 * The obvious implementation is a second model call: "summarise this thread in
 * four words". It is also the wrong one. A title has to appear the instant the
 * first reply lands, it has to be identical every time you reopen the thread,
 * it has to work with no network, and it must never cost the user one of their
 * metered turns. A round trip fails all four. So the title is a topic MATCH
 * against the user's own words, with a cleaned-up version of the question as
 * the fallback — which is both cheaper and more honest, because the words on
 * screen are always words the user actually chose.
 *
 * THE RULES ARE ORDERED, AND THE ORDER IS THE DESIGN. First match wins, so the
 * specific must precede the general: "am I getting enough protein" is a protein
 * question, not a nutrition question, and "should I train while sore" is about
 * soreness rather than about training. Adding a broad rule near the top is the
 * one way to break this file.
 *
 * TITLES ARE NOUN PHRASES, NEVER SENTENCES. "Protein intake", not "Are you
 * getting enough protein". A header is a label on a drawer; the moment it forms
 * a sentence it starts competing with the conversation for the reader's voice.
 */

import type { GozlinMessage } from "./gozlin.types";

/** Longest a derived title may be before it is trimmed at a word boundary. */
const MAX_TITLE = 34;

/**
 * Openers that carry no topic. Stripped from the front of a fallback title,
 * repeatedly, so "hey can you tell me why my weight stalled" reduces to
 * "why my weight stalled" before it is ever considered as a label.
 */
const FILLER = [
  /^(hey|hi|hello|yo|ok|okay|so|um|erm|please|pls)\b[\s,]*/i,
  /^(can|could|would|will)\s+you\s+/i,
  /^(i\s+)?(want|need|would\s+like)\s+(to\s+)?(know|understand|see|ask)\s+/i,
  /^(tell|show|give|explain\s+to)\s+me\s+(about\s+)?/i,
  /^(what'?s|whats)\s+your\s+(take|view|thoughts?)\s+on\s+/i,
  /^(let'?s|lets)\s+(talk|chat)\s+about\s+/i,
  /^(do|does|did)\s+you\s+(think|reckon)\s+/i,
  /^gozlin[\s,]*/i,
];

/**
 * Topic rules — the whole vocabulary of the coach, in the order it must be
 * tested. Every one of the 26 prompt chips lands on a rule here, and so do the
 * questions people type in their own words around them.
 */
const TOPIC_RULES: readonly { test: RegExp; title: string }[] = [
  // ── Recovery & the body's own signals (before "training", which they mention) ──
  { test: /\bsore(ness)?\b|\bdoms\b|\bache[sd]?\b/i, title: "Training while sore" },
  { test: /\brecover(ed|y|ing)?\b|\bfresh\b.*\btrain/i, title: "Recovery status" },
  { test: /\bover(training|reaching)\b|\btraining load\b|\btoo much\b/i, title: "Training load" },
  { test: /\bsleep|\binsomnia\b|\bslept\b|\brest(ing)? badly\b/i, title: "Sleep and results" },
  { test: /\benergy\b|\btired\b|\bfatigue[d]?\b|\bexhaust/i, title: "Energy levels" },
  { test: /\bstress(ed)?\b|\banxious\b|\bburn(t|ed) out\b/i, title: "Stress and training" },
  { test: /\binjur(y|ed|ies)\b|\bhurt(s|ing)?\b|\bpain\b|\bstrain(ed)?\b/i, title: "Injury check" },

  // ── Nutrition, specific before general ──
  { test: /\bprotein\b/i, title: "Protein intake" },
  { test: /\bcarb(s|ohydrate)/i, title: "Carb intake" },
  { test: /\bfat(s)?\b(?!\s*loss)/i, title: "Fat intake" },
  { test: /\bwater\b|\bhydrat|\bdrink(ing)? enough\b/i, title: "Hydration" },
  { test: /\bcravin|\bsugar\b|\bsnack(ing|s)?\b|\bbinge/i, title: "Cravings" },
  { test: /\beat(ing)? out\b|\brestaurant\b|\btakeaway\b|\btakeout\b/i, title: "Eating out" },
  { test: /\balcohol\b|\bdrink(s|ing)\b.*\bnight\b|\bwine\b|\bbeer\b/i, title: "Alcohol and progress" },
  { test: /\bweekend(s)?\b/i, title: "Weekends" },
  { test: /\bcalorie(s)?\b|\bdeficit\b|\bsurplus\b|\bmaintenance\b/i, title: "Calorie targets" },
  { test: /\bwhat (should i|to) eat\b|\bnext meal\b|\bmeal idea/i, title: "What to eat next" },
  { test: /\bbreakfast\b|\blunch\b|\bdinner\b|\bmeal plan\b|\bmenu\b/i, title: "Meals" },
  { test: /\bnutrition\b|\bdiet\b|\bmacro(s|nutrient)/i, title: "Nutrition" },

  // ── Progress & the long arc ──
  { test: /\bstall(ed|ing)?\b|\bplateau\b|\bstuck\b|\bnot moving\b|\bno progress\b/i, title: "Why progress stalled" },
  { test: /\bforecast\b|\bon track\b|\bproject(ion|ed)\b|\bwhen will i\b/i, title: "Your forecast" },
  { test: /\btarget weight\b|\bgoal weight\b|\bhit my (target|goal)\b/i, title: "Reaching your target" },
  { test: /\bnext (four|4) weeks\b|\bnext month\b|\bplan (out )?the next\b/i, title: "The next four weeks" },
  { test: /\bweigh(t|ing|-?in)\b|\bscale\b|\blost\b.*\bkg|\blb(s)?\b/i, title: "Weight trend" },
  { test: /\bwhat('?s| has) changed\b|\blast month\b|\bsince i started\b/i, title: "What has changed" },
  { test: /\bweekly review\b|\bthis week\b|\blast week\b|\bmy week\b/i, title: "Weekly review" },
  { test: /\bbest week\b/i, title: "Your best week" },
  { test: /\bhabit(s)?\b|\bpattern(s)?\b|\bstreak(s)?\b|\bconsisten(t|cy)\b/i, title: "Your habits" },
  { test: /\bmeasurement(s)?\b|\bwaist\b|\bbody fat\b|\bcomposition\b/i, title: "Body measurements" },

  // ── Training, general — after everything that merely mentions it ──
  { test: /\b(20|15|30|45)\s*min(ute)?s?\b|\bshort on time\b|\bno time\b|\bquick (workout|session)\b/i, title: "A shorter session" },
  { test: /\brest day\b|\bday off\b|\bdeload\b/i, title: "Rest days" },
  { test: /\badapt|\btune\b|\badjust\b|\bchange my (plan|program|programme|training)\b/i, title: "Tuning your plan" },
  { test: /\bshould i train\b|\btrain today\b|\bworkout today\b/i, title: "Training today" },
  { test: /\bform\b|\btechnique\b|\bhow do i do\b/i, title: "Technique" },
  { test: /\bexercise(s)?\b|\bworkout(s)?\b|\btrain(ing)?\b|\bgym\b|\bsession\b|\blift(ing)?\b|\brun(ning)?\b|\bcardio\b/i, title: "Training" },

  // ── The day itself ──
  { test: /\btoday\b|\bright now\b|\bthis morning\b|\bthis evening\b/i, title: "Today's focus" },
  { test: /\btomorrow\b/i, title: "Tomorrow" },
  { test: /\bmotivat|\bgive up\b|\bcan'?t be bothered\b|\bdiscourag/i, title: "Motivation" },
];

/** Sentence-case a phrase without flattening acronyms or units the user typed. */
function sentenceCase(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * Trim to MAX_TITLE at a word boundary, with no ellipsis.
 *
 * A header is not prose: "Why my weight has been…" reads as truncated content,
 * whereas "Why my weight" reads as a label. Cutting cleanly is the difference
 * between looking finished and looking clipped.
 */
function clip(text: string): string {
  if (text.length <= MAX_TITLE) return text;
  const cut = text.slice(0, MAX_TITLE);
  const space = cut.lastIndexOf(" ");
  return (space > 12 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "");
}

/** The user's question, stripped back to the part that carries the subject. */
function fallbackTitle(question: string): string {
  let text = question.replace(/\s+/g, " ").trim();

  // Filler comes off repeatedly: "hey can you tell me why…" has three layers.
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of FILLER) {
      const next = text.replace(rule, "");
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
  }

  // A question mark is the one punctuation mark that would make the header ask
  // something. Terminal punctuation goes; internal commas stay.
  text = text.replace(/[?!.]+\s*$/, "").trim();
  if (!text) return "New conversation";
  return sentenceCase(clip(text));
}

/**
 * What this conversation is about, as a short noun phrase — or null when there
 * is nothing to name yet.
 *
 * NULL IS A REAL ANSWER, not a failure. A thread holding only the day's
 * briefing has no topic: the user has not said anything, and inventing a label
 * for a conversation they have not had is exactly the kind of confident
 * nonsense that makes an AI product feel untrustworthy. The screen shows its
 * coach subhead instead.
 */
export function deriveConversationTitle(messages: GozlinMessage[]): string | null {
  const first = messages.find((m) => m.role === "user")?.content?.trim();
  if (!first) return null;

  const normalized = first.replace(/\s+/g, " ");
  for (const rule of TOPIC_RULES) {
    if (rule.test.test(normalized)) return rule.title;
  }
  return fallbackTitle(normalized);
}

/* ────────────────────────── the new-chat subhead ────────────────────────── */

/**
 * What the header says before there is a topic.
 *
 * IT IS NOT A TAGLINE. A fixed line under the name ("Your AI coach") is a badge
 * — read once, never again, and it makes an empty thread feel like a product
 * page. These are OPENING MOVES: each one is something a coach standing in
 * front of you would actually say while waiting for you to start, so the empty
 * state reads as a person who is present rather than a feature that is idle.
 *
 * THEY ARE DRAWN PER CONVERSATION, NOT PER RENDER. A subhead that changes while
 * you are looking at it is a glitch; one that is the same every single time is
 * wallpaper. Once per thread is the only cadence that reads as a greeting.
 */
export const COACH_SUBHEADS: readonly string[] = [
  "Reading your last seven days",
  "Every number here is yours",
  "Online · your data, on your device",
  "Caught up on everything you logged",
  "Ask me something specific",
  "I've been watching the trend",
  "Nothing's off the record here",
  "Your coach, fully briefed",
  "Ready when you are",
  "Listening",
  "I know what this week looked like",
  "Let's find the one thing that matters",
  "No generic advice — I have your logs",
  "Synced with today",
  "Pick up anywhere",
  "I remember what we said last time",
  "Tell me how today actually went",
  "Your history is loaded",
  "Straight answers, from your own data",
  "What's on your mind?",
];

/**
 * One subhead, drawn from the pool. `seed` is the caller's, so a screen can
 * hold a stable draw for the life of a conversation rather than re-rolling on
 * every render — pass `Math.random()` once and keep it.
 */
export function pickCoachSubhead(seed: number = Math.random()): string {
  const i = Math.floor(Math.abs(seed) * COACH_SUBHEADS.length) % COACH_SUBHEADS.length;
  return COACH_SUBHEADS[i];
}

/* ─────────────────────── the conversation you walked out of ─────────────── */

/**
 * Nudges for the Action Bar's "come back to this" rung.
 *
 * FIVE PHRASINGS, PICKED BY SEED, because the alternative is a control that
 * says the identical sentence every time it appears. The bar's whole claim is
 * that it knows what is going on right now; a stock phrase repeated for the
 * hundredth time undoes that in a way no amount of correct logic repairs.
 */
export const CONTINUE_NUDGES: readonly string[] = [
  "Pick that back up",
  "Finish that thought",
  "You left one hanging",
  "Back to what you asked",
  "Gozlin's still waiting",
];

/** A conversation that was started and never resolved. */
export interface OpenThread {
  /** What it was about — the Action Bar's caption. */
  topic: string;
  /** When the last thing was said, epoch ms. */
  lastAt: number;
  /** Why it counts as unfinished. Drives nothing but tests and reasoning. */
  reason: "no-reply" | "coach-asked";
}

/** Below this a thread is too fresh to nudge — you have only just left it. */
export const OPEN_MIN_AGE_MS = 2 * 60_000;
/** Past this the moment has gone; a two-day-old question is an interruption. */
export const OPEN_MAX_AGE_MS = 36 * 60 * 60_000;

/**
 * Is this thread genuinely mid-conversation?
 *
 * ── WHAT "UNFINISHED" HAD TO MEAN ───────────────────────────────────────────
 *
 * The cheap test is "the thread is not archived", and it is useless: every
 * conversation anyone has ever had is unarchived until they press New. That
 * rung would appear forever, for everyone, which is the same as appearing
 * never — a control that is always on is a control nobody reads.
 *
 * So a thread is open only when someone is genuinely waiting on the other one:
 *
 *   · YOU asked and no answer landed. The app was killed mid-turn, or the
 *     network died. There is a question of yours sitting there unanswered, and
 *     that is the clearest possible case of walking out mid-sentence. An empty
 *     coach placeholder — a reply that had started streaming and never
 *     finished — is the same state and counts the same way.
 *
 *   · GOZLIN asked you something back and you never said. "Want me to adjust
 *     anything?" with nothing after it is a conversation left open by the user,
 *     which is exactly what this rung is for.
 *
 * Everything else — a reply that answered you and stopped — is a conversation
 * that ENDED. Offering to continue it would be inventing an obligation.
 *
 * THE AGE WINDOW IS PART OF THE DEFINITION. Under two minutes you have merely
 * changed screens and the bar would be shadowing you; past thirty-six hours the
 * thread is history rather than something you are in the middle of.
 */
export function findOpenThread(
  messages: GozlinMessage[],
  now: number = Date.now(),
): OpenThread | null {
  if (messages.length === 0) return null;
  if (!messages.some((m) => m.role === "user")) return null;

  const last = messages[messages.length - 1];
  const lastAt = last.createdAt ?? 0;
  const age = now - lastAt;
  if (!Number.isFinite(age) || age < OPEN_MIN_AGE_MS || age > OPEN_MAX_AGE_MS) {
    return null;
  }

  const topic = deriveConversationTitle(messages);
  if (!topic) return null;

  if (last.role === "user") return { topic, lastAt, reason: "no-reply" };

  const text = last.content?.trim() ?? "";
  // A placeholder that never filled: the reply died on its way here.
  if (!text) return { topic, lastAt, reason: "no-reply" };
  // The coach put the ball back in the user's court and it never came back.
  if (/\?\s*$/.test(text)) return { topic, lastAt, reason: "coach-asked" };

  return null;
}
