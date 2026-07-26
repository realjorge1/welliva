/**
 * health-os/privacy/consent.ts
 *
 * The consent model — types + PURE helpers (no storage, injectable `now`). This is the
 * companion-phase subset of the full M3 privacy domain (docs/architecture/09): it adds
 * the **per-integration consent categories** the Proactive Companion needs so that every
 * sense (calendar, weather/location, wearable, health records, photo, voice) and the
 * out-of-app reach (proactive notifications) is independently, explicitly user-governed.
 *
 * Privacy is an architectural property, not a screen: the raw data never leaves the
 * device, integrations are OFF by default, and turning one off makes its native reads a
 * no-op (the Signal adapters degrade to `unavailable`). These helpers are pure so the
 * boundary is testable. See docs/companion/00-proactive-companion-blueprint.md §6 and
 * docs/architecture/09-privacy-and-consent.md §2.
 */
import { localISONow } from "../platform/clock";

export type ConsentCategory =
  // ── core (architecture/09 §2) ──
  | "local_processing" // on-device compute — the app's baseline (explained, not optional)
  | "ai_cloud" // send MINIMIZED context to the Claude-Haiku backend
  // ── companion integrations (blueprint §6) — each its own sense/reach, OFF by default ──
  | "calendar" // read the device calendar → travel/event Life Context proposals
  | "location_weather" // coarse location → weather → indoor/outdoor coaching
  | "wearable" // HRV/sleep/steps → real recovery
  | "health_records" // meds/conditions from the platform health store
  | "photo" // meal-photo analysis
  | "voice" // speech-to-text logging/chat
  | "proactive_notifications" // out-of-app briefings + anticipation alerts
  // ── declared-but-not-implemented (honest, future-proof UI) ──
  | "cloud_backup"
  | "crash_diagnostics";

export interface ConsentDecision {
  granted: boolean;
  /** Local-offset ISO timestamp of the decision (the auditable trail). */
  at: string;
}

export interface ConsentRecord {
  /** Bumped when the policy text materially changes → the user re-confirms. */
  version: number;
  decisions: Record<ConsentCategory, ConsentDecision>;
  updatedAt: string;
}

/** Bump when the consent copy/policy changes materially → triggers re-consent. */
export const CONSENT_VERSION = 1;

export type ConsentGroup = "core" | "integration" | "future";

export interface ConsentCategoryMeta {
  label: string;
  /** Plain-language, calm — one sentence the user actually reads. */
  blurb: string;
  group: ConsentGroup;
  icon: string;
  /** The default decision on a fresh install. Only `local_processing` is on. */
  defaultGranted: boolean;
  /** Native capability this gates (for the "what's connected" surface). */
  requiresNative?: boolean;
}

export const CONSENT_CATEGORY_META: Record<ConsentCategory, ConsentCategoryMeta> = {
  local_processing: {
    label: "On-device processing",
    blurb: "Welliva works entirely on your phone. Your raw history never leaves the device.",
    group: "core",
    icon: "phone-portrait",
    defaultGranted: true,
  },
  ai_cloud: {
    label: "Cloud AI (Gozlin)",
    blurb: "Let Gozlin use the cloud for richer chat — it only ever sees a short summary, never your full history.",
    group: "core",
    icon: "cloud",
    defaultGranted: false,
  },
  calendar: {
    label: "Calendar",
    blurb: "Read upcoming events to spot trips and big days, so I can plan around them. Read-only, on-device.",
    group: "integration",
    icon: "calendar",
    defaultGranted: false,
    requiresNative: true,
  },
  location_weather: {
    label: "Weather",
    blurb: "Use coarse location for today's forecast so I can move sessions indoors when needed. Rounded to ~1 km.",
    group: "integration",
    icon: "partly-sunny",
    defaultGranted: false,
    requiresNative: true,
  },
  wearable: {
    label: "Wearable & health metrics",
    blurb: "Read sleep, HRV and steps to make recovery real, not estimated. On-device only.",
    group: "integration",
    icon: "watch",
    defaultGranted: false,
    requiresNative: true,
  },
  health_records: {
    label: "Health records",
    blurb: "Read medications and conditions from your phone's health store to keep coaching safe.",
    group: "integration",
    icon: "medkit",
    defaultGranted: false,
    requiresNative: true,
  },
  photo: {
    label: "Meal photos",
    blurb: "Analyse a photo of a meal to draft a log you confirm. Nothing is logged without your okay.",
    group: "integration",
    icon: "camera",
    defaultGranted: false,
    requiresNative: true,
  },
  voice: {
    label: "Voice",
    blurb: "Speak to log or chat — speech is turned to text on the way in.",
    group: "integration",
    icon: "mic",
    defaultGranted: false,
    requiresNative: true,
  },
  proactive_notifications: {
    label: "Proactive notifications",
    blurb: "Let Gozlin reach out — a daily briefing and timely nudges, within your quiet hours and a gentle daily limit.",
    group: "integration",
    icon: "notifications",
    defaultGranted: false,
    requiresNative: true,
  },
  cloud_backup: {
    label: "Encrypted backup",
    blurb: "Not built yet — declared here so this screen stays honest about the future.",
    group: "future",
    icon: "save",
    defaultGranted: false,
  },
  crash_diagnostics: {
    label: "Crash diagnostics",
    blurb: "None are collected today. Declared for transparency.",
    group: "future",
    icon: "bug",
    defaultGranted: false,
  },
};

export const CONSENT_CATEGORIES = Object.keys(
  CONSENT_CATEGORY_META,
) as ConsentCategory[];

/** A fresh consent record: every category at its documented default. */
export function defaultConsent(now: Date = new Date()): ConsentRecord {
  const at = localISONow(now);
  const decisions = {} as Record<ConsentCategory, ConsentDecision>;
  for (const cat of CONSENT_CATEGORIES) {
    decisions[cat] = { granted: CONSENT_CATEGORY_META[cat].defaultGranted, at };
  }
  return { version: CONSENT_VERSION, decisions, updatedAt: at };
}

/**
 * Normalize a possibly-stale stored record: fill in any category added since it was
 * written (forward-compat), so reads never crash on a missing key. Does NOT change the
 * version — `needsReconsent` decides that.
 */
export function reconcile(record: ConsentRecord, now: Date = new Date()): ConsentRecord {
  const at = localISONow(now);
  const decisions = { ...record.decisions } as Record<ConsentCategory, ConsentDecision>;
  let changed = false;
  for (const cat of CONSENT_CATEGORIES) {
    if (!decisions[cat]) {
      decisions[cat] = { granted: CONSENT_CATEGORY_META[cat].defaultGranted, at };
      changed = true;
    }
  }
  return changed ? { ...record, decisions, updatedAt: at } : record;
}

/** Is a category granted in this record? `local_processing` is always effectively on. */
export function isGrantedIn(record: ConsentRecord, cat: ConsentCategory): boolean {
  if (cat === "local_processing") return true;
  return record.decisions[cat]?.granted ?? false;
}

/** A new record with one decision flipped (pure — no mutation). */
export function withDecision(
  record: ConsentRecord,
  cat: ConsentCategory,
  granted: boolean,
  now: Date = new Date(),
): ConsentRecord {
  const at = localISONow(now);
  return {
    ...record,
    decisions: { ...record.decisions, [cat]: { granted, at } },
    updatedAt: at,
  };
}

/** True when the stored policy version is behind the app's → prompt for re-consent. */
export function needsReconsent(record: ConsentRecord): boolean {
  return record.version < CONSENT_VERSION;
}

/** The integrations the user has switched on (for the "what Gozlin is watching" view). */
export function grantedIntegrations(record: ConsentRecord): ConsentCategory[] {
  return CONSENT_CATEGORIES.filter(
    (c) =>
      CONSENT_CATEGORY_META[c].group === "integration" && isGrantedIn(record, c),
  );
}
