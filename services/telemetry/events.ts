/**
 * THE EVENT TAXONOMY — every event the app may ever send, and its exact props.
 *
 * This file is the privacy boundary, not a convenience. `AnalyticsEvents` below is
 * a CLOSED map: `track()` is typed against it, so `track("weight_logged", { kg })`
 * does not compile. That is deliberate. The alternative — a free-form
 * `track(name, props)` — is how analytics in health apps ends up carrying someone's
 * weight, calorie count or cycle day to a server, one well-meant debug prop at a
 * time. Here, adding a field is a code review.
 *
 * THE RULES, in order of how badly they bite if broken:
 *
 *  1. NO HEALTH VALUES. Not weight, calories, macros, cycle dates, moods, meals,
 *     symptoms, medications. Not bucketed, not rounded, not hashed. If a number
 *     describes the user's body or what they ate, it does not belong here.
 *  2. NO FREE TEXT. No chat messages, no food names, no habit titles, no search
 *     queries. Every string prop below is a closed union of literals the code
 *     chooses, never something the user typed.
 *  3. COUNTS AND NAMES ONLY. "a food was logged" is fine. "which food" is not.
 *  4. The props type is the schema. `sanitize()` in Analytics.ts enforces shape at
 *     runtime too, because a typed boundary does not survive an `as any`.
 *
 * WHY THESE EVENTS AND NOT MORE. Each one exists to answer a question we actually
 * have: activation, where setup bleeds, D1/D7, paywall conversion, and whether the
 * 100-message ceiling in tiers.ts is affordable. An event nobody will query is a
 * privacy cost with no return, so it is not here.
 */

import type { SmartFeature } from "../smart/types";

/** Closed set of screens/locks that can send someone to the upgrade screen. */
export type PaywallSource =
  | "coach-limit"
  | "ai-plans"
  | "sync"
  | "history"
  | "insights"
  | "insight-history"
  | "habits"
  | "foods"
  | "photo-log"
  | "deep-dive"
  | "adaptive-training"
  | "generic"
  | "menu"
  | "settings";

/**
 * Runtime mirror of PaywallSource, so a route param can be validated before it
 * becomes an event prop.
 */
export const PAYWALL_SOURCES: readonly PaywallSource[] = [
  "coach-limit",
  "ai-plans",
  "sync",
  "history",
  "insights",
  "insight-history",
  "habits",
  "foods",
  "photo-log",
  "deep-dive",
  "adaptive-training",
  "generic",
  "menu",
  "settings",
] as const;

/** Which plan a purchase concerned. Never a price — stores localise those. */
export type PlanKind = "monthly" | "annual" | "unknown";

/** How a purchase ended. Mirrors PurchaseOutcome in services/billing. */
export type PurchaseResult = "success" | "cancelled" | "pending" | "error";

/** Which path logged the food. The route, never the food. */
export type FoodLogSource = "manual" | "menu" | "scan" | "photo" | "coach";

/** Runtime mirror of OnboardingStep, so a test can assert the flow agrees. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  "welcome",
  "goal",
  "about",
  "activity",
  "training",
  "food",
  "health",
  "menu",
  "why",
  "building",
  "plan",
] as const;

/** How someone authenticated. The method, never the address. */
export type AuthMethod = "email" | "google" | "facebook" | "apple";

/**
 * Named onboarding checkpoints. A closed union rather than a step index, because
 * indices shift every time the flow is reordered and then the funnel silently
 * compares last month's step 4 with this month's.
 *
 * MUST stay identical to the `Step` union in app/onboarding.tsx. It is the same
 * machine, and a name here that the flow never emits is a funnel row that reads
 * as 100% drop-off forever. onboardingFunnel.test.ts asserts the two agree.
 */
export type OnboardingStep =
  | "welcome"
  | "goal"
  | "about"
  | "activity"
  | "training"
  | "food"
  | "health"
  | "menu"
  | "why"
  | "building"
  | "plan";

/**
 * event name → its props. `Record<string, never>` means "no props".
 *
 * Keep this list short. Every addition is a thing we promise never to misuse.
 */
export interface AnalyticsEvents {
  /* ── lifecycle: the raw material for D1/D7 ─────────────────────────────── */
  /** App came to the foreground. One per cold start and per resume. */
  app_open: { cold: boolean };

  /* ── the activation funnel ─────────────────────────────────────────────── */
  onboarding_start: Record<string, never>;
  onboarding_step: { step: OnboardingStep };
  onboarding_complete: Record<string, never>;
  /**
   * Fired EXACTLY ONCE per install, when setup is finished and the first thing
   * has been logged. The single most important event in this file: it is the
   * denominator-free answer to "did this install become a user?".
   */
  activated: Record<string, never>;

  /* ── the habit that makes the app worth paying for ─────────────────────── */
  food_logged: { source: FoodLogSource };
  water_logged: Record<string, never>;
  workout_logged: { source: "session" | "manual" };
  habit_kept: Record<string, never>;
  /** The daily-commitment flame fired — the retention mechanic doing its job. */
  streak_kept: Record<string, never>;

  /* ── auth ──────────────────────────────────────────────────────────────── */
  sign_up: { method: AuthMethod };
  sign_in: { method: AuthMethod };

  /* ── money ─────────────────────────────────────────────────────────────── */
  paywall_view: { source: PaywallSource };
  purchase_start: { plan: PlanKind };
  purchase_success: { plan: PlanKind };
  purchase_failed: { plan: PlanKind; result: PurchaseResult };
  trial_start: Record<string, never>;
  /** Cancelled from inside the app (Settings → Subscription). */
  subscription_cancelled: Record<string, never>;

  /* ── cost of goods: is the 100-message ceiling affordable? ─────────────── */
  coach_message: { tier: "free" | "pro" };
  deep_dive: Record<string, never>;

  /* ── stability (the crash BODY goes to crash_reports, not here) ────────── */
  crash: { surface: string };

  /* ── the smart layer: which of its features people actually use ──────── */
  /**
   * A smart moment reached the screen, or was answered (services/smart). The
   * feature's NAME only — never what it said, never a rough day's reason.
   */
  smart_moment: { feature: SmartFeature; result: "shown" | "accepted" | "dismissed" };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/**
 * Runtime mirror of the keys above. `sanitize()` checks against this, so an
 * event smuggled in through a cast is dropped rather than sent.
 */
export const KNOWN_EVENTS: readonly AnalyticsEventName[] = [
  "app_open",
  "onboarding_start",
  "onboarding_step",
  "onboarding_complete",
  "activated",
  "food_logged",
  "water_logged",
  "workout_logged",
  "habit_kept",
  "streak_kept",
  "sign_up",
  "sign_in",
  "paywall_view",
  "purchase_start",
  "purchase_success",
  "purchase_failed",
  "trial_start",
  "subscription_cancelled",
  "coach_message",
  "deep_dive",
  "crash",
  "smart_moment",
] as const;

/**
 * The ONLY prop keys that may ever be sent, for any event. A second, blunter
 * guard than the types: if a prop key is not on this list, `sanitize()` drops it
 * even when the call site compiled. Rule 1 of the header is worth two locks.
 */
export const ALLOWED_PROP_KEYS: readonly string[] = [
  "cold",
  "step",
  "source",
  "method",
  "plan",
  "result",
  "tier",
  "surface",
  "feature",
] as const;

/** Longest a prop string may be. Every legitimate value here is a short literal. */
export const MAX_PROP_STRING = 40;
