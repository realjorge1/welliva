/**
 * LOCK COPY — what each lock says when it sends someone to the upgrade screen.
 *
 * Copy lives next to the UI rather than in services/billing (which stays pure
 * data) but it is still centralised, for two reasons:
 *
 *  1. A contextual ask converts far better than a generic one. Someone who just
 *     hit the coach cap should read about the coach, not a feature grid. Every
 *     `openUpgrade(source)` call site names its lock, and the source is what
 *     selects the headline AND which tier the screen leads with.
 *  2. The `source` string doubles as the analytics dimension for which lock
 *     actually drives upgrades — the whole reason for having several. The ids
 *     are `FeatureId` from services/billing/tiers.ts, the same union that
 *     decides which tier unlocks the feature, so a lock can never advertise a
 *     tier that doesn't actually unlock it and a typo is a type error rather
 *     than a silently mis-attributed conversion.
 *
 * TONE RULE: name the value, never scold. "Plans built for you, not picked for
 * you" — not "you have run out." The user hit a boundary while doing something
 * they wanted; the copy's job is to make the paid version sound like the obvious
 * continuation of that, and to be honest about what free already gives them.
 *
 * TIER RULE: every blurb names the tier that actually unlocks it, and promises
 * only what a gate actually withholds. With one paid tier the first half is
 * easy — every lock opens at Pro — and the second half is the one that bites:
 * "Plus lets Gozlin remember your history" survived here for a while against no
 * gate at all, because nothing in the code contradicted the sentence. A blurb
 * that sells an ungated capability is a refund request with a delay on it.
 */
import type { Ionicons } from "@expo/vector-icons";

import { FEATURE_MIN_TIER, type FeatureId } from "@/services/billing";

/** The lock vocabulary IS the feature vocabulary. See the header. */
export type LockId = FeatureId;

export interface LockCopy {
  /** The headline for this lock. */
  title: string;
  /** One or two sentences. Says what they get AND what free still does. */
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const LOCK_COPY: Record<LockId, LockCopy> = {
  /**
   * The zero case, and the reason this blurb no longer counts anything.
   *
   * It used to say "you've used today's free coaching", which was true when
   * Free had three messages. Free now has none, so a sentence about running out
   * would be describing an allowance the reader never had — and the lock fires
   * on their FIRST message, where "you've used it up" reads as a bug.
   */
  "coach-limit": {
    title: "Gozlin answers on Pro",
    blurb:
      "Free is the whole tracking app — diets, fitness, logs, habits, Memory. The conversation is what Pro adds: a coach that has actually read all of it.",
    icon: "chatbubbles-outline",
  },
  "ai-plans": {
    title: "Plans built for you, not picked for you",
    blurb:
      "Free matches you to the full reviewed catalog of diets and workouts — all of it. Pro is the one that writes a plan against your own body, goals, conditions and local foods instead of picking the closest fit.",
    icon: "sparkles-outline",
  },
  sync: {
    title: "Your data on every device",
    blurb:
      "Back up everything to the cloud and pick up on your phone, tablet or a new device. Your logs stay on this device either way — Pro is what makes them portable.",
    icon: "cloud-done-outline",
  },
  history: {
    title: "See your whole story",
    blurb:
      "Free shows the last 30 days. Pro goes back to day one — every chart, report and trend, and it's your data, getting more useful the longer you keep going.",
    icon: "trending-up-outline",
  },
  insights: {
    title: "Open the card",
    blurb:
      "The cards on your home screen are free and stay there. Pro opens them — the correlation behind each one, across your sleep, food, training and mood.",
    icon: "bulb-outline",
  },
  habits: {
    title: "Habits of your own",
    blurb:
      "Food, water and workouts already tick themselves off your logs, free, and always will. Pro is what adds habits you choose — the suggested ones and your own — unlimited, with full heatmaps and streak history for each.",
    icon: "grid-outline",
  },
  foods: {
    title: "The Foods catalog",
    blurb:
      "Search anything you eat and log it at a real portion — the whole dictionary, your own foods and barcode scans. Your diet plan and its tracking stay free either way.",
    icon: "search-outline",
  },
  "deep-dive": {
    title: "The research behind the answer",
    blurb:
      "Gozlin keeps its coaching short on purpose. A deep dive is the other half: what the research actually shows, the effect sizes, the mechanism and the caveats — written against the answer you just got. It comes with Pro.",
    icon: "library-outline",
  },
  "photo-log": {
    title: "Log a meal from a photo",
    blurb:
      "Point your camera at a plate and Gozlin logs it — portions, calories and macros read against our reference tables, not guessed. That part is Pro.",
    icon: "camera-outline",
  },
  generic: {
    title: "Meet Gozlin",
    blurb:
      "Everything you track stays free. Pro adds Gozlin — the coach that's read all of it.",
    // Not a star. A star is what every app in the store puts on its paid tier,
    // which makes it read as "generic upsell" rather than as Welliva's own thing
    // — and it's the mark the menu's Upgrade row already uses.
    icon: "diamond-outline",
  },
};

/** Narrow an untrusted route param to a known lock. */
export function toLockId(source: string | string[] | undefined): LockId {
  const key = Array.isArray(source) ? source[0] : source;
  return key && key in FEATURE_MIN_TIER ? (key as LockId) : "generic";
}
