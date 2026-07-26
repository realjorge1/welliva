/**
 * GOZLIN — Persona (the voice).
 *
 * Encodes the Phase 1 Personality Bible as deterministic phrasing helpers. The
 * engines decide *what* to say (grounded in the Twin); the Persona decides *how*
 * Gozlin says it. Pure — variant selection is seeded so the voice feels alive
 * day-to-day but stays deterministic and testable.
 *
 * See docs/gozlin/01-personality-bible.md.
 */

import type { GozlinTone } from "./gozlin.types";

/** Stable hash for seeded variant selection (no Math.random — determinism). */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick one variant deterministically from `seed`. */
export function pickVariant<T>(arr: readonly T[], seed: string): T {
  if (arr.length === 0) throw new Error("pickVariant: empty array");
  return arr[hashSeed(seed) % arr.length];
}

/** Time-of-day opener. */
export function timeGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 22) return "Evening";
  return "Late one";
}

/** UI metadata per tone — Ionicons name + design-system color role. */
export const TONE_META: Record<
  GozlinTone,
  { icon: string; colorRole: "brand" | "success" | "warning" | "error" | "water" }
> = {
  warm: { icon: "sparkles-outline", colorRole: "brand" },
  proud: { icon: "flame", colorRole: "success" },
  steady: { icon: "checkmark-circle-outline", colorRole: "brand" },
  curious: { icon: "help-circle-outline", colorRole: "water" },
  honest: { icon: "compass-outline", colorRole: "warning" },
  gentle: { icon: "heart-outline", colorRole: "water" },
  alert: { icon: "alert-circle-outline", colorRole: "error" },
};

// ── Phrase banks (Phase 1, Appendix A) ──────────────────────────────

export const PHRASES = {
  celebration: [
    "Quietly proud of you.",
    "That's the hard part — nice.",
    "This is becoming who you are.",
    "Not a fluke anymore.",
  ],
  setbackReset: [
    "Life happened — totally fine.",
    "No catch-up, no guilt.",
    "One small win resets everything.",
    "We just pick it back up — that's all this is.",
  ],
  honestOpener: ["Real talk —", "Here's the thing:", "Small thing I noticed:"],
  onTrack: [
    "Right on pace.",
    "Nothing to fix — keep coasting.",
    "Exactly where you want to be.",
  ],
  threadClosers: [
    "I'll check in tomorrow.",
    "I'm right here if you need me.",
    "Want me to adjust anything?",
  ],
} as const;

/**
 * Compose a short, on-voice line: optional opener + body. Keeps Gozlin terse
 * (Phase 1 §3: 1–3 sentences). `seed` makes the opener vary by day, not randomly.
 */
export function voice(
  body: string,
  opts: { tone?: GozlinTone; seed?: string } = {},
): string {
  const seed = opts.seed ?? body;
  if (opts.tone === "honest") {
    return `${pickVariant(PHRASES.honestOpener, seed)} ${body}`;
  }
  return body;
}

/** A celebration tail, e.g. for streak milestones. */
export function celebrate(seed: string): string {
  return pickVariant(PHRASES.celebration, seed);
}

/** A compassion-first setback line. */
export function reset(seed: string): string {
  return pickVariant(PHRASES.setbackReset, seed);
}

/** A non–dead-end closer. */
export function closer(seed: string): string {
  return pickVariant(PHRASES.threadClosers, seed);
}
