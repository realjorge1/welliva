/**
 * SUBJECTS — what "the same exercise" means, across every place an exercise id
 * comes from.
 *
 * ── THE TRAP THIS EXISTS FOR ────────────────────────────────────────────────
 * An AI-generated plan names its exercises by POSITION:
 * `ai_<session>_<index>_<slug>` (backend src/services/workout.ts). The same
 * Goblet Squat is `ai_0_2_goblet-squat` this week and `ai_1_0_goblet-squat`
 * the next. Key novelty on `exerciseId` and every AI exercise is "brand new"
 * every single week — the detector would be a random question generator.
 *
 * So every result is reduced to two keys:
 *
 *   · the VARIANT key — a catalog id when the exercise is one (or its name
 *     matches one), else `ai:` + the normalised name. Stable across plans.
 *   · the FAMILY key — see ./exerciseFamilies.ts. What "would this feel new
 *     tomorrow?" is actually asked about.
 *
 * Pure. The catalog is read lazily inside functions only: it is ~190 KB and
 * metro's inlineRequires keeps it off the boot path as long as nothing touches
 * it at module scope (see constants/ExerciseDatabase.ts).
 */

import { EXERCISE_DATABASE } from "../../../constants/ExerciseDatabase";
import type { Difficulty, ExerciseCategory } from "../../../models/exercise";
import { EXERCISE_FAMILY, FAMILY_RULES } from "./exerciseFamilies";

export interface ExerciseSubject {
  /** Stable across plans: a catalog id, or `ai:<normalised-name>`. */
  variantKey: string;
  /** What novelty is judged at. */
  familyKey: string;
  /** The name as the person saw it in the player. */
  label: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
}

/** Catalog ids look like `push_03`, `flex_12` — never positional. */
const CATALOG_ID = /^(push|pull|legs|hinge|core|cardio|flex)_\d+$/;
/** The positional prefix of an AI plan's id. */
const AI_ID = /^ai_\d+_\d+_/;

/**
 * Words that say what the exercise is done WITH, not what it is. Stripped for
 * the second, looser catalog match only — "Dumbbell Goblet Squat" is the
 * catalog's Goblet Squats, but "Dumbbell Rows" and "Resistance Band Rows" are
 * both just "row" once stripped, so a stripped match is trusted only when it
 * is unique.
 */
const EQUIPMENT = new Set([
  "dumbbell", "dumbbells", "kettlebell", "barbell", "band", "resistance",
  "bodyweight", "weighted", "cable", "machine", "db", "kb", "bw", "towel",
]);

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/**
 * Lowercase words, singular, no punctuation, no parenthetical asides:
 * "Tricep Dips (chair)" → "tricep dip", "Push-ups" → "push up",
 * "pushups" → "push up". Both sides of every comparison go through this, so
 * what matters is that it is consistent, not that it is good English.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(push|pull|chin|sit|step|press)-?ups?\b/g, "$1 up")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular)
    .join(" ");
}

function stripEquipment(normalized: string): string {
  return normalized
    .split(" ")
    .filter((w) => !EQUIPMENT.has(w))
    .join(" ");
}

interface CatalogIndex {
  exact: Map<string, string>;
  /** Equipment-stripped name → id, or null when two catalog entries collide. */
  loose: Map<string, string | null>;
  byId: Map<string, (typeof EXERCISE_DATABASE)[number]>;
}

let INDEX: CatalogIndex | null = null;

/** Built on first use, never at import — see the header on the catalog's size. */
function catalogIndex(): CatalogIndex {
  if (INDEX) return INDEX;
  const exact = new Map<string, string>();
  const loose = new Map<string, string | null>();
  const byId = new Map<string, (typeof EXERCISE_DATABASE)[number]>();
  for (const e of EXERCISE_DATABASE) {
    byId.set(e.id, e);
    const n = normalizeName(e.name);
    exact.set(n, e.id);
    const s = stripEquipment(n);
    loose.set(s, loose.has(s) ? null : e.id);
  }
  INDEX = { exact, loose, byId };
  return INDEX;
}

/** The catalog id a name refers to, if the catalog has it. */
export function catalogIdForName(name: string): string | null {
  const n = normalizeName(name);
  if (!n) return null;
  const idx = catalogIndex();
  const hit = idx.exact.get(n);
  if (hit) return hit;
  return idx.loose.get(stripEquipment(n)) ?? null;
}

/** The family a name implies, by the ordered rules; null when none fits. */
export function familyByRules(name: string): string | null {
  const n = normalizeName(name);
  for (const [re, family] of FAMILY_RULES) if (re.test(n)) return family;
  return null;
}

/**
 * The two keys for one exercise, from whatever id and name it arrived with.
 *
 * A catalog id wins outright. Otherwise the NAME decides — never the id, whose
 * position part changes every plan — first by catalog match, then by family
 * rule, and failing both the exercise is its own family: it is genuinely
 * something the table has never heard of, and pretending it is "a squat"
 * because its pattern says so would make every unknown move look familiar.
 */
export function subjectFor(input: {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
}): ExerciseSubject {
  const { exerciseId, category, difficulty } = input;
  const name = input.name?.trim() || exerciseId.replace(AI_ID, "").replace(/-/g, " ");

  let catalogId: string | null = CATALOG_ID.test(exerciseId) ? exerciseId : null;
  if (!catalogId) catalogId = catalogIdForName(name);

  if (catalogId) {
    const entry = catalogIndex().byId.get(catalogId);
    return {
      variantKey: catalogId,
      familyKey: EXERCISE_FAMILY[catalogId] ?? familyByRules(name) ?? `ai:${normalizeName(name)}`,
      label: name,
      category: entry?.category ?? category,
      difficulty,
    };
  }

  const variantKey = `ai:${normalizeName(name).replace(/ /g, "-")}`;
  return {
    variantKey,
    familyKey: familyByRules(name) ?? variantKey,
    label: name,
    category,
    difficulty,
  };
}

// ── Mentions: does a piece of text talk about this exercise? ─────────────

/**
 * Words too generic to identify an exercise on their own. "Single-leg" names
 * half the leg day; "hold" names half the core day.
 */
const GENERIC = new Set([
  ...EQUIPMENT,
  "standing", "seated", "single", "leg", "arm", "hold", "chair", "wall",
  "the", "and", "with", "exercise", "body",
]);

function tokens(text: string): Set<string> {
  return new Set(normalizeName(text).split(" ").filter(Boolean));
}

/**
 * Does `text` talk about this exercise?
 *
 * Two ways to say yes, and both are deliberately narrow — the same stance as
 * the habit tracker's crossReference: a coach who "remembers" the wrong thing
 * is worse than one who remembers nothing.
 *
 *   1. every distinctive word of the name is there ("nordic hamstring curl"
 *      needs nordic + hamstring + curl, generic words aside), or
 *   2. every word of the FAMILY is there ("nordic curls" → nordic + curl;
 *      "push-ups" → push + up).
 *
 * "My hamstrings are sore" matches neither — hamstring alone is a body part,
 * not the exercise.
 */
export function mentionsSubject(
  text: string,
  subject: { label: string; familyKey: string },
): boolean {
  const said = tokens(text);
  if (said.size === 0) return false;

  const nameWords = [...tokens(subject.label)].filter((w) => !GENERIC.has(w));
  if (nameWords.length > 0 && nameWords.every((w) => said.has(w))) return true;

  // Every word of the family, generic ones included: "single-leg-squat" must
  // not shrink to "squat", or "my squats felt heavy" would recall a pistol.
  if (subject.familyKey.startsWith("ai:")) return false;
  const familyWords = subject.familyKey.split("-").map(singular);
  return familyWords.length > 0 && familyWords.every((w) => said.has(w));
}

// ── Difficulty ──

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export function difficultyRank(d: Difficulty | undefined): number {
  return d ? (DIFFICULTY_RANK[d] ?? 0) : 0;
}
