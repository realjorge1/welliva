/**
 * health-os/platform/id.ts
 *
 * Identifier generation for the Timeline. We use ULIDs: globally unique AND
 * lexicographically time-sortable, so a month partition is already chronological
 * (docs/architecture/02-data-and-schema.md §2).
 *
 * `ulidFromSeed` is the migration's idempotency key: the SAME seed always yields the
 * SAME id, so re-importing a source record never duplicates it (§04 §4). Uses
 * mulberry32 — the deterministic PRNG already used across the codebase (RivalEngine,
 * ChallengeService) — seeded by a hash of the seed string.
 */

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(timeMs: number, len: number): string {
  let t = Math.max(0, Math.floor(timeMs));
  let out = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = t % ENCODING_LEN;
    out = ENCODING.charAt(mod) + out;
    t = (t - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(len: number, rng: () => number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ENCODING.charAt(Math.floor(rng() * ENCODING_LEN));
  }
  return out;
}

/** FNV-1a 32-bit string hash → seed for mulberry32. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG in [0,1). Same seed → same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random, time-sortable ULID. */
export function ulid(timeMs: number = Date.now(), rng: () => number = Math.random): string {
  return encodeTime(timeMs, TIME_LEN) + encodeRandom(RANDOM_LEN, rng);
}

/**
 * A DETERMINISTIC ULID derived from `seed`. Same seed (+ time) → identical id, so
 * imports are idempotent. `timeMs` should be the source record's local-midnight ms
 * so imported events stay chronologically sortable.
 */
export function ulidFromSeed(seed: string, timeMs = 0): string {
  const rng = mulberry32(hashString(seed));
  return encodeTime(timeMs, TIME_LEN) + encodeRandom(RANDOM_LEN, rng);
}
