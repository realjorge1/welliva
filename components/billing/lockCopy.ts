/**
 * LOCK COPY — what each paywall says, and the benefit list it sells.
 *
 * Copy lives next to the UI rather than in services/billing (which stays pure
 * data) but it is still centralised, for two reasons:
 *
 *  1. A contextual paywall converts far better than a generic one. Someone who
 *     just hit the coach cap should read about the coach, not a feature grid.
 *     Every `openPaywall(source)` call site names its lock, and the source is
 *     what selects the headline.
 *  2. The `source` string doubles as the analytics dimension for which lock
 *     actually drives upgrades — the whole reason for having several. Keeping the
 *     ids in one union means a typo at a call site is a type error, not a silently
 *     mis-attributed conversion.
 *
 * TONE RULE: name the value, never scold. "Plans built for you, not picked for
 * you" — not "you have run out." The user hit a boundary while doing something
 * they wanted; the copy's job is to make the paid version sound like the obvious
 * continuation of that, and to be honest about what free already gives them.
 */
import type { Ionicons } from "@expo/vector-icons";

export type LockId =
  | "coach-limit"
  | "ai-plans"
  | "clinical-diets"
  | "sync"
  | "history"
  | "insights"
  | "habits"
  | "recap-archive"
  | "photo-log"
  | "generic";

export interface LockCopy {
  /** The paywall headline for this lock. */
  title: string;
  /** One or two sentences. Says what they get AND what free still does. */
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const LOCK_COPY: Record<LockId, LockCopy> = {
  "coach-limit": {
    title: "Keep talking to Gozlin",
    blurb:
      "You've used today's free coaching. Pro removes the daily limit and lets Gozlin remember your history, so the advice compounds instead of resetting every conversation.",
    icon: "chatbubbles-outline",
  },
  "ai-plans": {
    title: "Plans built for you, not picked for you",
    blurb:
      "Free plans are matched from 28 clinically-reviewed diets and 112 workouts — genuinely good ones. Pro generates a plan against your own body, goals, conditions and local foods.",
    icon: "sparkles-outline",
  },
  "clinical-diets": {
    title: "Diets for your condition",
    blurb:
      "22 condition-specific protocols — PCOS, thyroid, diabetic, renal, GERD, iron-deficiency, postpartum and more — each built around what that condition actually needs.",
    icon: "medkit-outline",
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
      "Free shows the last 30 days. Pro opens every chart, report and trend back to day one — and it's your data, getting more useful the longer you keep going.",
    icon: "trending-up-outline",
  },
  insights: {
    title: "Gozlin actually knows you",
    blurb:
      "Correlations across your sleep, food, training and mood; a memory of what you've told it; and nudges that arrive before you need them, not after.",
    icon: "bulb-outline",
  },
  habits: {
    title: "Track every habit",
    blurb:
      "Free covers 3 habits. Pro is unlimited, with full heatmaps and streak history for each one.",
    icon: "grid-outline",
  },
  "recap-archive": {
    title: "Your full recap archive",
    blurb:
      "This month's recap is always free. Pro keeps every past month, so you can look back on the whole year.",
    icon: "book-outline",
  },
  "photo-log": {
    title: "Log a meal from a photo",
    blurb:
      "Point your camera at a plate and Gozlin logs it — portions, calories and macros read against our reference tables, not guessed.",
    icon: "camera-outline",
  },
  generic: {
    title: "Welliva Pro",
    blurb:
      "Unlimited AI coaching, plans built around your body, the full clinical diet catalog and your complete history — everywhere you sign in.",
    icon: "star-outline",
  },
};

/** Narrow an untrusted route param to a known lock. */
export function toLockId(source: string | string[] | undefined): LockId {
  const key = Array.isArray(source) ? source[0] : source;
  return key && key in LOCK_COPY ? (key as LockId) : "generic";
}

export interface ProBenefit {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** The honest free-tier counterpart, shown smaller. */
  free?: string;
}

/**
 * The benefit list on the paywall, ordered by how much people actually pay for
 * it. Each row names the free counterpart too — a paywall that admits what you
 * already get reads as trustworthy, and it stops the "so the app is useless
 * without paying?" reaction that kills a free tier's word of mouth.
 */
export const PRO_BENEFITS: ProBenefit[] = [
  {
    icon: "chatbubbles-outline",
    label: "Unlimited AI coaching, with memory",
    free: "3 messages a day on free",
  },
  {
    icon: "sparkles-outline",
    label: "Diet & workout plans generated for your body",
    free: "Matched from 28 diets & 112 workouts on free",
  },
  {
    icon: "medkit-outline",
    label: "All 22 condition-specific diets",
    free: "6 mainstream diets on free",
  },
  {
    icon: "cloud-done-outline",
    label: "Cloud backup & sync across devices",
    free: "This device only on free",
  },
  {
    icon: "trending-up-outline",
    label: "Your complete history & trends",
    free: "Last 30 days on free",
  },
  {
    icon: "bulb-outline",
    label: "Insights, correlations & proactive nudges",
  },
  {
    icon: "grid-outline",
    label: "Unlimited habit tracking",
    free: "3 habits on free",
  },
];

/** Shown under the benefit list so free users know what never gets taken away. */
export const ALWAYS_FREE_NOTE =
  "Logging food, water, weight and workouts is always free — along with your streaks, achievements, reminders and data export.";
