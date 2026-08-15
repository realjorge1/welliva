/**
 * GOZLIN NLU — the intent lexicon.
 *
 * Weights are roughly IDF: how much seeing this term should move you toward
 * this intent. A term that only ever appears in one intent ("plateau") earns
 * ~3; a term that shows up everywhere ("workout") earns ~1.5 and relies on its
 * neighbours to disambiguate.
 *
 * PHRASES beat terms. "why am i stuck" is unambiguous in a way that "why" and
 * "stuck" separately are not, and multi-word intent is exactly what the old
 * first-match regex kept getting wrong. Phrase keys are normalized at load with
 * the same function as the input, so write them as they'd be typed — the
 * normalizer strips the apostrophe from "isn't" for you.
 *
 * Overlap between intents is deliberate. "protein" genuinely belongs to both
 * nutrition and diet; the scoring margin decides, not the author of this file.
 */

import type { GozlinIntent } from "../GozlinChatEngine";

export interface IntentSignal {
  intent: GozlinIntent;
  /** Single tokens. Matched fuzzily (trigram similarity ≥ 0.6). */
  terms: Record<string, number>;
  /** Multi-word substrings. Matched exactly against normalized text. */
  phrases?: Record<string, number>;
}

export const SIGNALS: IntentSignal[] = [
  {
    intent: "greeting",
    terms: {
      hi: 3.0, hey: 3.0, hello: 3.0, yo: 2.4, sup: 2.4, hiya: 3.0,
      howdy: 3.0, gozlin: 2.0, morning: 1.5, afternoon: 1.5, evening: 1.5,
    },
    phrases: {
      "good morning": 3.2, "good afternoon": 3.2, "good evening": 3.2,
      "whats up": 2.4, "hey there": 3.2,
    },
  },

  {
    intent: "motivation",
    terms: { motivation: 2.4, motivated: 2.2, reason: 1.6, why: 0.8, goal: 1.0 },
    phrases: {
      "my goal is": 3.2, "my why": 3.4, "i want to": 2.2, "i wanna": 2.2,
      "im trying to": 2.4, "i am trying to": 2.4, "id like to": 2.2,
      "i would like to": 2.2, "because i": 2.0, "the reason i": 2.8,
      "im here to": 2.8, "im doing this": 2.8,
    },
  },

  {
    intent: "forecast",
    terms: {
      forecast: 3.2, trajectory: 3.0, project: 2.2, projection: 2.6,
      future: 1.8, eta: 2.4, predict: 2.4, achieve: 1.6,
    },
    phrases: {
      "on track to": 2.8, "on track": 2.0, "how long": 2.8, "how soon": 2.8,
      "when will i": 3.2, "when do i": 2.6, "goal date": 3.0,
      "how much longer": 3.0, "going to take": 2.6, "by when": 2.8,
      "will i hit": 2.8, "will i reach": 2.8,
    },
  },

  {
    intent: "weekly",
    terms: { recap: 2.8, weekly: 2.6, week: 1.4 },
    phrases: {
      "weekly review": 3.4, "week review": 3.2, "my week": 2.8,
      "how was my week": 3.4, "this week": 1.8, "past week": 2.8,
      "last week": 2.4, "last 7 days": 2.8, "week went": 3.0,
    },
  },

  {
    intent: "adapt_workout",
    terms: {
      tune: 1.6, adapt: 1.8, adjust: 1.5, optimize: 1.5, optimise: 1.5,
      upgrade: 1.6, reps: 2.0, sets: 1.9, volume: 2.2, intensity: 2.0,
      harder: 1.9, easier: 1.9, progression: 2.4, deload: 2.8,
      program: 1.6, routine: 1.6, training: 1.2, workout: 1.1,
    },
    phrases: {
      "too easy": 2.8, "too hard": 2.8, "ready to progress": 3.2,
      "add volume": 3.0, "add sets": 2.8, "add reps": 2.8,
      "make it harder": 3.0, "make it easier": 3.0, "tune my training": 3.4,
      "adapt my workout": 3.4, "adjust my workout": 3.4, "more challenging": 2.6,
      "should i progress": 3.0, "do more": 1.8, "my program": 2.6,
      "change my routine": 3.0,
    },
  },

  {
    intent: "adapt_nutrition",
    terms: {
      macro: 2.6, macros: 2.8, rebalance: 2.6, nutrition: 1.8,
      protein: 1.2, calorie: 1.2, calories: 1.2, carbs: 1.4, fats: 1.2,
      tune: 1.4, adjust: 1.3, optimize: 1.4, optimise: 1.4,
    },
    phrases: {
      "optimize my macros": 3.4, "optimise my macros": 3.4, "my macros": 3.0,
      "eating habits": 2.4, "food preferences": 2.4,
      "optimize my nutrition": 3.4, "optimise my nutrition": 3.4,
      "fix my diet": 3.0, "tune my nutrition": 3.4, "adjust my calories": 3.2,
      "too much protein": 2.4, "enough protein": 2.4, "protein intake": 2.6,
    },
  },

  {
    intent: "detective",
    terms: {
      plateau: 3.2, plateaued: 3.2, stuck: 3.0, stalled: 3.0, stall: 2.6,
      investigate: 2.8, why: 1.3, explain: 1.5, diagnose: 2.0,
    },
    phrases: {
      "root cause": 3.4, "why am i": 2.6, "why isnt": 3.0, "why is my": 2.4,
      "why arent": 3.0, "why hasnt": 3.0, "why wont": 2.8, "why cant": 2.6,
      "not losing": 3.2, "not gaining": 3.0, "not working": 2.8,
      "no progress": 3.4, "no results": 3.2, "no change": 2.8,
      "whats going on": 2.6, "figure out": 2.2, "havent lost": 3.2,
      "not moving": 2.8, "not changing": 2.6, "hasnt moved": 3.0,
      "going nowhere": 3.0, "nothing is happening": 3.0,
    },
  },

  {
    intent: "habits",
    terms: {
      habit: 2.8, habits: 3.0, behavior: 2.4, behaviour: 2.4,
      behavioral: 2.4, behavioural: 2.4, accountability: 2.6, keystone: 2.6,
      sleep: 2.0, mood: 2.2, stress: 2.0, consistency: 2.0, discipline: 2.2,
    },
    phrases: {
      // "I always / I never X" is a claim about a pattern, not about X. Weighted
      // to stand on its own so "I always eat too much protein" surfaces habits
      // AND nutrition instead of silently dropping one of them.
      "my habits": 3.4, "do i usually": 2.8, "i always": 2.8, "i never": 2.8,
      "i tend to": 2.6, "i usually": 2.6, "bad habit": 3.2, "life habits": 3.2,
      "noticed about me": 3.2, "my sleep": 2.6, "my stress": 2.6, "my mood": 2.6,
    },
  },

  {
    intent: "progress",
    terms: { progress: 1.8, trend: 2.2, trends: 2.2, insight: 2.2, noticed: 1.8, pattern: 1.6, patterns: 1.6 },
    phrases: {
      "how am i doing": 3.2, "my progress": 2.6, "hows it going": 2.4,
      "any patterns": 2.8, "what have you noticed": 3.0,
    },
  },

  {
    intent: "recovery",
    terms: {
      recover: 2.8, recovery: 3.0, recovered: 2.8, rest: 2.0, sore: 2.8,
      soreness: 2.8, tired: 2.4, readiness: 3.0, fatigue: 2.6,
      fatigued: 2.6, exhausted: 2.6, drained: 2.4, wrecked: 2.2,
    },
    phrases: {
      "should i train": 3.2, "should i rest": 3.2, "am i recovered": 3.4,
      "rest day": 2.8, "need a break": 2.4, "take today off": 2.8,
      "ok to train": 3.0, "safe to train": 3.0,
    },
  },

  {
    intent: "diet",
    terms: {
      eat: 1.6, eating: 1.3, meal: 1.8, meals: 1.8, food: 1.6, hungry: 2.4,
      snack: 2.2, water: 2.2, hydrate: 2.4, hydration: 2.4, carb: 1.3,
      breakfast: 2.2, lunch: 2.2, dinner: 2.2, diet: 1.3, drink: 1.8,
    },
    phrases: {
      "what should i eat": 3.2, "am i eating enough": 2.8,
      "what to eat": 3.0, "enough water": 2.8, "im hungry": 2.8,
    },
  },

  {
    intent: "workout",
    terms: {
      workout: 1.6, workouts: 1.6, train: 1.5, exercise: 1.5, gym: 2.4,
      session: 1.8, lift: 1.6, lifting: 1.8, run: 1.8, running: 1.8,
      cardio: 2.2, squat: 2.2, bench: 2.0, deadlift: 2.2,
    },
    phrases: {
      "todays workout": 3.2, "my session": 2.4, "whats my workout": 3.2,
      "training today": 2.6,
    },
  },

  {
    intent: "briefing",
    terms: { brief: 2.4, briefing: 3.0, today: 1.8, agenda: 2.2 },
    phrases: {
      "what should i do today": 3.4, "plan for today": 3.2, "right now": 2.0,
      "focus on today": 3.4, "whats today": 2.6, "what should i focus on": 3.4,
      "whats the plan": 2.8, "where do i start": 2.6,
    },
  },

  {
    intent: "memory_recall",
    terms: { remember: 2.6, profile: 2.0, recall: 2.4 },
    phrases: {
      "what do you know": 3.4, "remember about me": 3.6, "my profile": 2.8,
      "what do you remember": 3.6, "know about me": 3.2,
      "what have i told you": 3.2,
    },
  },
];
