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
 * TIER RULE: every blurb names the tier that actually unlocks it. Writing "Pro"
 * on a lock that Plus opens is the fastest way to lose the middle tier's trust —
 * they upgrade, the feature was already theirs, and the copy lied.
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
  "coach-limit": {
    title: "Keep talking to Gozlin",
    blurb:
      "You've used today's free coaching. Plus raises the daily limit to 25 and lets Gozlin remember your history; Pro lifts it entirely, so the advice compounds instead of resetting every conversation.",
    icon: "chatbubbles-outline",
  },
  "ai-plans": {
    title: "Plans built for you, not picked for you",
    blurb:
      "Every tier matches you to the full reviewed catalog of diets and workouts — free, all of it. Pro is the one that writes a plan against your own body, goals, conditions and local foods instead of picking the closest fit.",
    icon: "sparkles-outline",
  },
  sync: {
    title: "Your data on every device",
    blurb:
      "Back up everything to the cloud and pick up on your phone, tablet or a new device. Your logs stay on this device either way — Plus is what makes them portable.",
    icon: "cloud-done-outline",
  },
  history: {
    title: "See your whole story",
    blurb:
      "Free shows the last 30 days. Plus opens a full year of charts, reports and trends; Pro goes back to day one — and it's your data, getting more useful the longer you keep going.",
    icon: "trending-up-outline",
  },
  insights: {
    title: "Gozlin actually knows you",
    blurb:
      "Correlations across your sleep, food, training and mood; a memory of what you've told it; and nudges that arrive before you need them, not after. This is the Pro tier's own work.",
    icon: "bulb-outline",
  },
  habits: {
    title: "Track every habit",
    blurb:
      "Free covers 3 habits. Plus is unlimited, with full heatmaps and streak history for each one.",
    icon: "grid-outline",
  },
  "deep-dive": {
    title: "The reading behind the answer",
    blurb:
      "Gozlin keeps its coaching short on purpose. A deep dive is the other half: what the research actually shows, the effect sizes, the mechanism and the caveats — written against the answer you just got. Plus opens them for good.",
    icon: "library-outline",
  },
  "photo-log": {
    title: "Log a meal from a photo",
    blurb:
      "Point your camera at a plate and Gozlin logs it — portions, calories and macros read against our reference tables, not guessed. 5 scans a day on Plus, 30 on Pro.",
    icon: "camera-outline",
  },
  generic: {
    title: "Go further with Welliva",
    blurb:
      "Every diet and recommendation is already yours, free. Plus adds the depth: unlimited habits, a year of history and cloud backup across your devices. Pro adds the coaching that thinks — generated plans, insights and no daily cap.",
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
