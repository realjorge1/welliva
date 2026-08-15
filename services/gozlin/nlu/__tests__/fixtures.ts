/**
 * GOZLIN NLU — labelled fixtures.
 *
 * The regression net for the offline path. Every misroute class the audit
 * called out has a case here, so a lexicon tweak that fixes one intent and
 * quietly breaks another shows up immediately.
 *
 * Two things are asserted separately, and the second matters as much as the
 * first: accuracy on clear utterances, AND that genuinely ambiguous or
 * unintelligible input returns `ambiguous` / `unknown` rather than a confident
 * wrong answer.
 */

import type { GozlinIntent } from "../../GozlinChatEngine";

export interface SingleFixture {
  text: string;
  intent: GozlinIntent;
}

/** Unambiguous utterances — the classifier must name this intent. */
export const SINGLE: SingleFixture[] = [
  // ── greeting ──
  { text: "hi", intent: "greeting" },
  { text: "hey", intent: "greeting" },
  { text: "hello", intent: "greeting" },
  { text: "yo", intent: "greeting" },
  { text: "good morning", intent: "greeting" },
  { text: "hey there", intent: "greeting" },
  { text: "hi Gozlin", intent: "greeting" },
  { text: "good evening", intent: "greeting" },

  // ── briefing ──
  { text: "what should I do today?", intent: "briefing" },
  { text: "what's the plan for today?", intent: "briefing" },
  { text: "plan for today", intent: "briefing" },
  { text: "what should I focus on today?", intent: "briefing" },
  { text: "give me today's briefing", intent: "briefing" },
  { text: "where do I start today?", intent: "briefing" },
  { text: "brief me", intent: "briefing" },
  { text: "what's the plan?", intent: "briefing" },

  // ── forecast ──
  { text: "what am I on track to achieve?", intent: "forecast" },
  { text: "when will I hit my goal?", intent: "forecast" },
  { text: "how long until I reach my goal weight?", intent: "forecast" },
  { text: "what's my forecast?", intent: "forecast" },
  { text: "how soon will I see results?", intent: "forecast" },
  { text: "what's my trajectory?", intent: "forecast" },
  { text: "how much longer is this going to take?", intent: "forecast" },
  { text: "will I reach my target by summer?", intent: "forecast" },
  { text: "am I on track?", intent: "forecast" },

  // ── weekly ──
  { text: "give me my weekly review", intent: "weekly" },
  { text: "how was my week?", intent: "weekly" },
  { text: "recap my week", intent: "weekly" },
  { text: "my week review", intent: "weekly" },
  { text: "weekly recap please", intent: "weekly" },
  { text: "how was my past week", intent: "weekly" },
  { text: "review my week", intent: "weekly" },

  // ── adapt_workout ──
  { text: "adapt my workout to how I've been performing", intent: "adapt_workout" },
  { text: "tune my training", intent: "adapt_workout" },
  { text: "am I ready to progress?", intent: "adapt_workout" },
  { text: "should I add more volume?", intent: "adapt_workout" },
  { text: "my workouts are too easy", intent: "adapt_workout" },
  { text: "make it harder", intent: "adapt_workout" },
  { text: "adjust my workout", intent: "adapt_workout" },
  { text: "should I add sets?", intent: "adapt_workout" },
  { text: "my training feels too hard", intent: "adapt_workout" },
  { text: "change my routine", intent: "adapt_workout" },

  // ── adapt_nutrition ──
  { text: "optimize my nutrition based on what I've been eating", intent: "adapt_nutrition" },
  { text: "optimize my macros", intent: "adapt_nutrition" },
  { text: "tune my nutrition", intent: "adapt_nutrition" },
  { text: "fix my diet", intent: "adapt_nutrition" },
  { text: "rebalance my macros", intent: "adapt_nutrition" },
  { text: "adjust my calories", intent: "adapt_nutrition" },
  { text: "my macros are off", intent: "adapt_nutrition" },
  { text: "help me with my protein intake", intent: "adapt_nutrition" },

  // ── detective ──
  { text: "investigate why my progress isn't moving", intent: "detective" },
  { text: "why am I stuck?", intent: "detective" },
  { text: "I've plateaued", intent: "detective" },
  { text: "why isn't the scale moving?", intent: "detective" },
  { text: "no progress for weeks", intent: "detective" },
  { text: "why am I not losing weight?", intent: "detective" },
  { text: "what's going on with my weight?", intent: "detective" },
  { text: "I'm stalled", intent: "detective" },
  { text: "nothing is happening", intent: "detective" },
  { text: "figure out why I'm stuck", intent: "detective" },
  { text: "why haven't I lost anything?", intent: "detective" },
  { text: "root cause of my plateau", intent: "detective" },
  { text: "I'm on a plateau", intent: "detective" },

  // ── habits ──
  { text: "what habits have you noticed about me?", intent: "habits" },
  { text: "my habits", intent: "habits" },
  { text: "do I usually skip Mondays?", intent: "habits" },
  { text: "what bad habits do I have?", intent: "habits" },
  { text: "tell me about my sleep", intent: "habits" },
  { text: "my stress has been high", intent: "habits" },
  { text: "how's my consistency?", intent: "habits" },
  { text: "my mood lately", intent: "habits" },

  // ── progress ──
  { text: "how am I doing?", intent: "progress" },
  { text: "show me my progress", intent: "progress" },
  { text: "any trends?", intent: "progress" },
  { text: "what have you noticed?", intent: "progress" },
  { text: "any insights?", intent: "progress" },
  { text: "how's it going?", intent: "progress" },

  // ── recovery ──
  { text: "should I train today?", intent: "recovery" },
  { text: "I'm sore", intent: "recovery" },
  { text: "am I recovered?", intent: "recovery" },
  { text: "how's my recovery?", intent: "recovery" },
  { text: "I'm exhausted", intent: "recovery" },
  { text: "do I need a rest day?", intent: "recovery" },
  { text: "is it safe to train today?", intent: "recovery" },
  { text: "feeling drained", intent: "recovery" },
  { text: "my readiness", intent: "recovery" },

  // ── diet ──
  { text: "what should I eat?", intent: "diet" },
  { text: "I'm hungry", intent: "diet" },
  { text: "am I drinking enough water?", intent: "diet" },
  { text: "what's for lunch?", intent: "diet" },
  { text: "need a snack idea", intent: "diet" },
  { text: "what's my dinner?", intent: "diet" },
  { text: "meal ideas", intent: "diet" },
  { text: "what's for breakfast", intent: "diet" },

  // ── workout ──
  { text: "what's my workout today?", intent: "workout" },
  { text: "today's workout", intent: "workout" },
  { text: "what's my session?", intent: "workout" },
  { text: "gym today?", intent: "workout" },
  { text: "what lifting am I doing", intent: "workout" },
  { text: "my cardio today", intent: "workout" },

  // ── motivation ──
  { text: "my goal is to feel strong again", intent: "motivation" },
  { text: "I want to lose 10kg", intent: "motivation" },
  { text: "I'm trying to get healthy for my kids", intent: "motivation" },
  { text: "my why is my daughter", intent: "motivation" },
  { text: "the reason I started was my health", intent: "motivation" },
  { text: "I'd like to run a marathon", intent: "motivation" },
  { text: "I wanna be fitter", intent: "motivation" },

  // ── memory_recall ──
  { text: "what do you know about me?", intent: "memory_recall" },
  { text: "what do you remember about me?", intent: "memory_recall" },
  { text: "my profile", intent: "memory_recall" },
  { text: "what have I told you?", intent: "memory_recall" },
  { text: "tell me what you know about me", intent: "memory_recall" },
  { text: "recall my details", intent: "memory_recall" },

  // ── second pass: phrasings that broke the old first-match table ──
  { text: "my nutrition needs tuning", intent: "adapt_nutrition" },
  { text: "is my training too easy now", intent: "adapt_workout" },
  { text: "the scale hasn't moved in a month", intent: "detective" },
  { text: "I want to know why this stopped working", intent: "detective" },
  { text: "how did this week go?", intent: "weekly" },
  { text: "when do I hit my target weight", intent: "forecast" },
  { text: "I'm still sore from yesterday", intent: "recovery" },
  { text: "should I take today off?", intent: "recovery" },
  { text: "how much water have I had", intent: "diet" },
  { text: "am I training today?", intent: "workout" },
  { text: "what's on for the gym", intent: "workout" },
  { text: "I'm here to build muscle", intent: "motivation" },
  { text: "do you remember what I said?", intent: "memory_recall" },
  { text: "any patterns in my behaviour?", intent: "habits" },
  { text: "I tend to skip breakfast", intent: "habits" },
  { text: "give me my briefing", intent: "briefing" },
  { text: "my deload week", intent: "adapt_workout" },
  { text: "increase my reps", intent: "adapt_workout" },
  { text: "should I change my macros?", intent: "adapt_nutrition" },
  { text: "improve my nutrition", intent: "adapt_nutrition" },
];

/**
 * Typo tolerance. Single-character substitutions and deletions — what real
 * typing leaves behind. The old regex table dropped every one of these into
 * smalltalk.
 */
export const TYPOS: SingleFixture[] = [
  { text: "I've plateaued agian", intent: "detective" },
  { text: "why am I stuk", intent: "detective" },
  { text: "optimze my nutrition", intent: "adapt_nutrition" },
  { text: "optimize my macroes", intent: "adapt_nutrition" },
  { text: "am I recoverd?", intent: "recovery" },
  { text: "shoud I train today?", intent: "recovery" },
  { text: "my weekly reveiw", intent: "weekly" },
  { text: "whats my forcast", intent: "forecast" },
  { text: "tune my trainig", intent: "adapt_workout" },
  { text: "what habbits have you noticed", intent: "habits" },
  { text: "what do you know abuot me", intent: "memory_recall" },
  { text: "good mornin", intent: "greeting" },
  { text: "im exhausteed", intent: "recovery" },
  { text: "the plan for todday", intent: "briefing" },
  { text: "show me my progres", intent: "progress" },
  { text: "how was my weke", intent: "weekly" },
  { text: "am I on trak?", intent: "forecast" },
  { text: "whats my wokout today?", intent: "workout" },
  { text: "im hungrey", intent: "diet" },
  { text: "no progres for weeks", intent: "detective" },
  { text: "adjust my caloriess", intent: "adapt_nutrition" },
];

/**
 * Negation. Each of these must NOT return the intent its keywords suggest —
 * "I'm not stuck" scored identically to "I'm stuck" under the old table.
 */
export interface NegationFixture {
  text: string;
  notIntent: GozlinIntent;
}

export const NEGATIONS: NegationFixture[] = [
  { text: "I'm not stuck, things are going well", notIntent: "detective" },
  { text: "I'm not sore at all today", notIntent: "recovery" },
  { text: "I haven't plateaued", notIntent: "detective" },
  { text: "I don't want to change my macros", notIntent: "adapt_nutrition" },
  { text: "no rest day needed", notIntent: "recovery" },
  { text: "I'm not hungry", notIntent: "diet" },
  { text: "don't make it harder", notIntent: "adapt_workout" },
  { text: "I'm never tired these days", notIntent: "recovery" },
];

/**
 * Genuinely two-intent messages. The old table silently dropped one of them —
 * "I always eat too much protein" answered about habits and never mentioned
 * nutrition.
 */
export interface MultiFixture {
  text: string;
  /** Both must appear; order is not asserted. */
  intents: GozlinIntent[];
}

export const MULTI: MultiFixture[] = [
  { text: "I always eat too much protein", intents: ["habits", "adapt_nutrition"] },
  { text: "my sleep is bad and my macros are off", intents: ["habits", "adapt_nutrition"] },
  { text: "I'm sore and I've plateaued", intents: ["recovery", "detective"] },
];

/**
 * Unintelligible or out-of-domain. Must return `unknown` — an honest "I didn't
 * catch that" plus concrete suggestions, not the old "outside my lane" line.
 */
export const UNKNOWN: string[] = [
  "asdkjfh",
  "qwertyuiop",
  "...",
  "?????",
  "lorem ipsum dolor sit amet",
  "zzzzz",
  "42",
  "🙂🙂🙂",
  "blah blah blah",
];

/** Non-English. Must be detected, not deflected in English. */
export interface LanguageFixture {
  text: string;
  language: string;
}

export const NON_ENGLISH: LanguageFixture[] = [
  { text: "¿Por qué no estoy perdiendo peso?", language: "es" },
  { text: "quiero perder peso con una dieta", language: "es" },
  { text: "Pourquoi je ne perds pas de poids ?", language: "fr" },
  { text: "je veux perdre du poids avec mon programme", language: "fr" },
  { text: "Warum nehme ich nicht ab?", language: "de" },
  { text: "ich will mein gewicht nicht verlieren", language: "de" },
  { text: "Porque não estou perdendo peso?", language: "pt" },
  { text: "почему я не худею", language: "ru" },
  { text: "لماذا لا أفقد الوزن", language: "ar" },
  { text: "为什么我没有减重", language: "zh" },
  { text: "なぜ体重が減らないのですか", language: "ja" },
  { text: "왜 체중이 줄지 않나요", language: "ko" },
];

/** Total labelled utterances, for the coverage assertion. */
export const FIXTURE_COUNT =
  SINGLE.length +
  TYPOS.length +
  NEGATIONS.length +
  MULTI.length +
  UNKNOWN.length +
  NON_ENGLISH.length;
