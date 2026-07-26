/**
 * RIVAL ENGINE — the AI pacer's brain (pure + deterministic).
 *
 * The Consistency League paces a user against ONE calibrated AI rival for the
 * calendar month. This engine owns who that rival IS (a seeded archetype + name)
 * and, crucially, how its score MOVES day by day — never a real person, never a
 * teleporting bot, but a believable, contingent pacer that stays neck-and-neck.
 *
 * It is honest by construction:
 *  - The rival is explicitly an "AI pacer" everywhere it surfaces (see the UI).
 *  - Its cumulative score is `calibratedTarget × shape(dayProgress)` — a smooth,
 *    archetype-specific curve — then gently rubber-banded toward the user within
 *    a small bounded band, so the lead can change but the rival can never jump.
 *
 * Pure: no persistence, no clock, no Math.random. Determinism comes from the
 * period key (YYYY-MM) seeding the same mulberry32 PRNG ChallengeService uses, so
 * the rival is stable all month and fresh each month.
 */

/** The four pacer personalities — each with a distinct day-by-day momentum shape. */
export type RivalArchetype = "tortoise" | "sprinter" | "streaker" | "comeback";

export interface Rival {
  archetype: RivalArchetype;
  /** Display name — clearly an alias, never implied to be a real human. */
  name: string;
  /** One-line persona blurb shown beside the "AI pacer" label. */
  blurb: string;
  /** Short archetype label, e.g. "The Tortoise". */
  label: string;
}

// ──────────────────────────────────────────────
// SEEDED DETERMINISM (mirrors ChallengeService)
// ──────────────────────────────────────────────

/** Deterministic 32-bit hash of a string → seed. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, good-enough deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ──────────────────────────────────────────────
// ARCHETYPES — persona + a distinct momentum shape
// ──────────────────────────────────────────────

const ARCHETYPES: RivalArchetype[] = [
  "tortoise",
  "sprinter",
  "streaker",
  "comeback",
];

/** A friendly, clearly-an-alias name pool per archetype. */
const NAMES: Record<RivalArchetype, readonly string[]> = {
  tortoise: ["Sage", "River", "Juniper", "Atlas"],
  sprinter: ["Blaze", "Nova", "Dash", "Ember"],
  streaker: ["Steady", "Marlow", "Indigo", "Wren"],
  comeback: ["Phoenix", "Echo", "Onyx", "Vale"],
};

const ARCHETYPE_META: Record<
  RivalArchetype,
  { label: string; blurb: string }
> = {
  tortoise: {
    label: "The Tortoise",
    blurb:
      "Starts unhurried and builds quietly — a slow, steady climb that rarely misses a day.",
  },
  sprinter: {
    label: "The Sprinter",
    blurb:
      "Comes out fast and banks an early lead, then eases off as the month wears on.",
  },
  streaker: {
    label: "The Streaker",
    blurb:
      "Perfectly even — the same calm effort every single day, start to finish.",
  },
  comeback: {
    label: "The Comeback",
    blurb:
      "Takes a while to warm up, dips mid-month, then surges hard down the stretch.",
  },
};

/**
 * The rival for a period. Deterministic in `periodKey`: stable all month,
 * different month to month, identical across users (so shared/league features
 * drop in later for free).
 */
export function pickRival(periodKey: string): Rival {
  const rng = mulberry32(hashSeed(`rival:${periodKey}`));
  const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  const pool = NAMES[archetype];
  const name = pool[Math.floor(rng() * pool.length)];
  const meta = ARCHETYPE_META[archetype];
  return { archetype, name, blurb: meta.blurb, label: meta.label };
}

/** The archetype's short label, e.g. "The Tortoise". */
export function rivalLabel(archetype: RivalArchetype): string {
  return ARCHETYPE_META[archetype].label;
}

/** The archetype's persona blurb. */
export function rivalBlurb(archetype: RivalArchetype): string {
  return ARCHETYPE_META[archetype].blurb;
}

// ──────────────────────────────────────────────
// MOMENTUM SHAPES
// ──────────────────────────────────────────────

/**
 * Normalized cumulative-progress curve per archetype: g(0)=0, g(1)=1, monotonic
 * increasing. The differing curvature is what makes leads change and momentum
 * swing naturally over the month.
 */
function shape(archetype: RivalArchetype, p: number): number {
  const x = clamp01(p);
  switch (archetype) {
    // Slow and steady, gently building — a touch conservative early.
    case "tortoise":
      return Math.pow(x, 1.15);
    // Front-loaded: banks fast early, flattens late.
    case "sprinter":
      return Math.pow(x, 0.6);
    // Perfectly even daily increments.
    case "streaker":
      return x;
    // Dips early, surges down the stretch (convex, strong finish).
    case "comeback":
      return 0.7 * Math.pow(x, 1.9) + 0.3 * x;
    default:
      return x;
  }
}

/** Rubber-band band: the rival stays within ±15% of its own paced curve. */
const BAND = 0.15;
/** How far inside the band the rival drifts toward the user (0–1). */
const PULL = 0.5;

/**
 * The rival's cumulative score for the current day.
 *
 * `dayProgress` is 0–1 through the race window, `calibratedTarget` is the rival's
 * intended finish (≈ the user's own trailing pace, set by TournamentService), and
 * `userScore` is where the user stands right now. The rival paces along its
 * archetype curve, then drifts a BOUNDED amount toward the user — close enough
 * for a real race, never a teleport. Pure + deterministic.
 */
export function rivalScoreAt(
  archetype: RivalArchetype,
  dayProgress: number,
  calibratedTarget: number,
  userScore: number,
): number {
  const target = Math.max(0, calibratedTarget);
  const raw = target * shape(archetype, dayProgress);
  if (raw <= 0) return 0;
  // Pull toward the user, but never further than ±BAND from the paced curve.
  const lo = raw * (1 - BAND);
  const hi = raw * (1 + BAND);
  const pulledTarget = clamp(Math.max(0, userScore), lo, hi);
  const score = raw + (pulledTarget - raw) * PULL;
  return Math.max(0, Math.round(score));
}
