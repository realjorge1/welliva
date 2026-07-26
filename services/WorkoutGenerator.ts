/**
 * WORKOUT PLAN GENERATOR
 *
 * Deterministic generator that creates weekly workout plans
 * based on user profile and preferences.
 *
 * Rules:
 * - Same inputs + same week → same output (deterministic via seeded selection)
 * - Exercises filtered by difficulty & equipment
 * - Movement patterns balanced across sessions
 * - Duration cap enforced per session
 * - Volume rules per level (beginner: 3 sets, intermediate: 3-4, advanced: 4)
 */

import type { ExerciseDBEntry } from "../constants/ExerciseDatabase";
import { Difficulty } from "../models/exercise";
import { MedicalCondition, UserBio } from "../models/user";
import {
    Equipment,
    GeneratedWorkoutPlan,
    MovementPattern,
    PlannedExercise,
    WorkoutSession,
} from "../models/workout";

// ============================================================================
// LAZY EXERCISE POOL (Phase D — bundle trim)
// ============================================================================
//
// ExerciseDatabase (~189 KB) is otherwise pulled onto the cold-start path via
// AppContext → this generator. It's now dynamic-imported into a module-local
// cache so it stays out of the initial bundle (on web) / off the cold-start eval
// (native). The rest of the app (fitness screens, WorkoutCatalog, tests) keeps
// importing EXERCISE_DATABASE synchronously — this cache is private to the
// generator. `generateWorkoutPlan` stays synchronous, so callers must warm the
// cache first via `ensureWorkoutExercisesLoaded()`; until then the pool is empty
// (an empty plan), which the app avoids by warming up on boot + at the async
// generation boundaries (see AppContext / PlanSync / the onboarding preview).

let _exercisePool: ExerciseDBEntry[] = [];
let _exercisesLoading: Promise<ExerciseDBEntry[]> | null = null;

/** Idempotent, memoized loader for the exercise pool. Cheap to await repeatedly. */
export function ensureWorkoutExercisesLoaded(): Promise<ExerciseDBEntry[]> {
  return (_exercisesLoading ??= (async () => {
    const { EXERCISE_DATABASE } = await import("../constants/ExerciseDatabase");
    if (_exercisePool.length === 0) _exercisePool = EXERCISE_DATABASE;
    return _exercisePool;
  })());
}

// ============================================================================
// TYPES
// ============================================================================

interface GeneratorInput {
  goal: UserBio["primaryGoal"];
  difficulty: Difficulty;
  daysPerWeek: number; // 2-6
  equipment: Equipment[];
  durationCapMinutes: number; // per session, e.g., 30-60
  weekStart: string; // YYYY-MM-DD for determinism
}

// ============================================================================
// SPLIT TEMPLATES
// ============================================================================

interface SplitDay {
  label: string;
  focus: string;
  patterns: MovementPattern[];
}

const SPLITS: Record<string, SplitDay[]> = {
  "2-day": [
    {
      label: "Day 1 – Full Body A",
      focus: "Full Body",
      patterns: ["push", "squat", "pull", "core"],
    },
    {
      label: "Day 2 – Full Body B",
      focus: "Full Body",
      patterns: ["push", "hinge", "pull", "cardio", "core"],
    },
  ],
  "3-day": [
    {
      label: "Day 1 – Push & Core",
      focus: "Push + Core",
      patterns: ["push", "push", "core", "core"],
    },
    {
      label: "Day 2 – Pull & Legs",
      focus: "Pull + Legs",
      patterns: ["pull", "pull", "squat", "hinge"],
    },
    {
      label: "Day 3 – Full Body",
      focus: "Full Body",
      patterns: ["push", "pull", "squat", "core", "cardio"],
    },
  ],
  "4-day": [
    {
      label: "Day 1 – Upper Push",
      focus: "Upper Push",
      patterns: ["push", "push", "push", "core"],
    },
    {
      label: "Day 2 – Lower",
      focus: "Lower Body",
      patterns: ["squat", "squat", "hinge", "hinge"],
    },
    {
      label: "Day 3 – Upper Pull",
      focus: "Upper Pull",
      patterns: ["pull", "pull", "pull", "core"],
    },
    {
      label: "Day 4 – Full Body + Cardio",
      focus: "Full Body + Cardio",
      patterns: ["push", "squat", "cardio", "core"],
    },
  ],
  "5-day": [
    {
      label: "Day 1 – Push",
      focus: "Push",
      patterns: ["push", "push", "push", "core"],
    },
    {
      label: "Day 2 – Legs A",
      focus: "Legs (Quad focus)",
      patterns: ["squat", "squat", "squat", "core"],
    },
    {
      label: "Day 3 – Pull",
      focus: "Pull",
      patterns: ["pull", "pull", "pull", "core"],
    },
    {
      label: "Day 4 – Legs B",
      focus: "Legs (Hinge focus)",
      patterns: ["hinge", "hinge", "squat", "core"],
    },
    {
      label: "Day 5 – Full Body + Cardio",
      focus: "Full Body + Cardio",
      patterns: ["push", "pull", "cardio", "cardio", "flexibility"],
    },
  ],
  "6-day": [
    {
      label: "Day 1 – Push A",
      focus: "Push",
      patterns: ["push", "push", "push", "core"],
    },
    {
      label: "Day 2 – Pull A",
      focus: "Pull",
      patterns: ["pull", "pull", "pull", "core"],
    },
    {
      label: "Day 3 – Legs A",
      focus: "Legs",
      patterns: ["squat", "hinge", "squat", "core"],
    },
    {
      label: "Day 4 – Push B",
      focus: "Push",
      patterns: ["push", "push", "core", "cardio"],
    },
    {
      label: "Day 5 – Pull B",
      focus: "Pull",
      patterns: ["pull", "pull", "core", "cardio"],
    },
    {
      label: "Day 6 – Legs B + Cardio",
      focus: "Legs + Cardio",
      patterns: ["squat", "hinge", "cardio", "flexibility"],
    },
  ],
};

// ============================================================================
// SAFETY / CONTRAINDICATIONS
//
// Injuries and certain medical conditions must reshape the plan, not just be
// stored. Each rule excludes whole movement patterns and/or exercises that load
// specific muscle groups, and can cap intensity. Filtering is graceful — if it
// would empty the pool, the generator falls back so a user always gets a plan.
// ============================================================================

const DIFFICULTY_ORDER: Difficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

interface SafetyRule {
  patterns?: MovementPattern[];
  /** lowercase substrings matched against an exercise's targetMuscles */
  muscles?: string[];
  /** hardest difficulty allowed while this applies */
  maxDifficulty?: Difficulty;
}

/**
 * Injury BODY-AREA keyword → movement patterns / muscles to avoid. Tokens come
 * from the profile's body-area picker (leg, chest, knee…) but free text works
 * too (substring match), e.g. "lower back", "rotator cuff", "right foot".
 */
const INJURY_RULES: { keywords: string[]; rule: SafetyRule }[] = [
  { keywords: ["neck"], rule: { muscles: ["trap", "neck"] } },
  {
    keywords: ["shoulder", "rotator", "delt"],
    rule: {
      patterns: ["push", "pull"],
      muscles: ["deltoid", "shoulder", "trap", "lat"],
    },
  },
  {
    keywords: ["arm", "elbow", "bicep", "tricep", "forearm"],
    rule: { patterns: ["push", "pull"], muscles: ["tricep", "bicep", "forearm"] },
  },
  {
    keywords: ["wrist", "hand"],
    rule: { patterns: ["push"], muscles: ["forearm", "wrist"] },
  },
  {
    keywords: ["chest", "pec"],
    rule: { patterns: ["push"], muscles: ["chest", "pec"] },
  },
  {
    keywords: ["back", "spine", "spinal", "lumbar", "disc", "sciatica"],
    rule: {
      patterns: ["hinge", "pull"],
      muscles: ["back", "spinal", "erector", "lat"],
    },
  },
  {
    keywords: ["core", "abs", "abdom", "oblique"],
    rule: { patterns: ["core"] },
  },
  {
    keywords: ["hip", "glute"],
    rule: { patterns: ["hinge", "squat"], muscles: ["glute", "hip", "hamstring"] },
  },
  {
    keywords: ["leg", "thigh", "quad", "hamstring"],
    rule: {
      patterns: ["squat", "hinge"],
      muscles: ["quad", "hamstring", "glute", "calf"],
    },
  },
  {
    keywords: ["knee"],
    rule: { patterns: ["squat"], muscles: ["quad", "calf"] },
  },
  {
    keywords: ["ankle", "foot", "feet", "calf"],
    rule: { patterns: ["cardio"], muscles: ["calf"] },
  },
];

/** Non-pregnancy medical condition → safety rule (pregnancy is trimester-aware). */
const CONDITION_RULES: Partial<Record<MedicalCondition, SafetyRule>> = {
  // Gentle return: skip hard core work (diastasis risk), keep intensity moderate.
  postpartum: { patterns: ["core"], maxDifficulty: "intermediate" },
  // Avoid maximal strain / breath-holding heavy work.
  hypertension: { maxDifficulty: "intermediate" },
};

/**
 * Pregnancy restrictions tighten by trimester:
 *  • T1 — keep moving; just cap intensity.
 *  • T2 — add: no supine/loaded core work.
 *  • T3 — add: no high-impact jumping (cardio); beginner intensity only.
 * Unknown trimester ⇒ conservative (treat like T2/T3 blend).
 */
function pregnancyRule(trimester?: 1 | 2 | 3): SafetyRule {
  switch (trimester) {
    case 1:
      return { maxDifficulty: "intermediate" };
    case 2:
      return { patterns: ["core"], maxDifficulty: "intermediate" };
    case 3:
      return { patterns: ["core", "cardio"], maxDifficulty: "beginner" };
    default:
      return { patterns: ["core", "cardio"], maxDifficulty: "intermediate" };
  }
}

interface Contraindications {
  patterns: Set<MovementPattern>;
  muscles: string[];
  maxDifficulty: Difficulty | null;
}

/** Keep the more restrictive (lower) of two difficulty caps. */
function stricterDifficulty(
  a: Difficulty | null,
  b: Difficulty,
): Difficulty {
  if (!a) return b;
  return DIFFICULTY_ORDER.indexOf(a) <= DIFFICULTY_ORDER.indexOf(b) ? a : b;
}

/** Collapse a user's injuries + conditions into one set of restrictions. */
function buildContraindications(bio: UserBio): Contraindications {
  const patterns = new Set<MovementPattern>();
  const muscles: string[] = [];
  let maxDifficulty: Difficulty | null = null;

  for (const injury of bio.injuries ?? []) {
    const text = injury.toLowerCase();
    for (const { keywords, rule } of INJURY_RULES) {
      if (keywords.some((k) => text.includes(k))) {
        rule.patterns?.forEach((p) => patterns.add(p));
        if (rule.muscles) muscles.push(...rule.muscles);
        if (rule.maxDifficulty)
          maxDifficulty = stricterDifficulty(maxDifficulty, rule.maxDifficulty);
      }
    }
  }

  for (const condition of bio.medicalConditions ?? []) {
    const rule =
      condition === "pregnancy"
        ? pregnancyRule(bio.pregnancyTrimester)
        : CONDITION_RULES[condition];
    if (!rule) continue;
    rule.patterns?.forEach((p) => patterns.add(p));
    if (rule.muscles) muscles.push(...rule.muscles);
    if (rule.maxDifficulty)
      maxDifficulty = stricterDifficulty(maxDifficulty, rule.maxDifficulty);
  }

  return { patterns, muscles, maxDifficulty };
}

function isContraindicated(
  ex: ExerciseDBEntry,
  contra: Contraindications,
): boolean {
  if (contra.patterns.has(ex.movementPattern)) return true;
  if (contra.muscles.length > 0) {
    const target = ex.targetMuscles.map((m) => m.toLowerCase());
    if (contra.muscles.some((k) => target.some((m) => m.includes(k))))
      return true;
  }
  return false;
}

/**
 * Stable signature of a user's injuries + conditions, folded into the plan's
 * inputHash so a new injury/condition triggers regeneration (and the weekly
 * regen stays stable while nothing changes).
 */
function contraindicationKey(bio: UserBio): string {
  const injuries = (bio.injuries ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
  const conditions = (bio.medicalConditions ?? [])
    .filter((c) => c !== "none")
    .slice()
    .sort()
    .join("|");
  // Trimester changes which pregnancy restrictions apply ⇒ part of the key.
  const trimester = (bio.medicalConditions ?? []).includes("pregnancy")
    ? `t${bio.pregnancyTrimester ?? 0}`
    : "";
  return `${injuries}#${conditions}#${trimester}`;
}

// ============================================================================
// SUITABILITY (consumed by the UI for match % + subtle cautions)
// ============================================================================

/**
 * Whether an exercise is contraindicated for this user, with a short, human
 * reason. Powers the "use caution" hints when browsing the exercise library.
 */
export function exerciseContraindication(
  ex: ExerciseDBEntry,
  bio: UserBio,
): { blocked: boolean; reason?: string } {
  const contra = buildContraindications(bio);
  if (!isContraindicated(ex, contra)) return { blocked: false };

  const conditions = bio.medicalConditions ?? [];
  if (conditions.includes("pregnancy"))
    return { blocked: true, reason: "Best skipped at this stage of pregnancy" };
  if (conditions.includes("postpartum"))
    return { blocked: true, reason: "Ease back in — hold off postpartum" };
  const injuries = (bio.injuries ?? []).filter((s) => s.trim());
  if (injuries.length > 0)
    return { blocked: true, reason: `Could strain your ${injuries[0]}` };
  return { blocked: true, reason: "Not ideal for your profile" };
}

/**
 * Per-exercise suitability for a user as a match %, with an optional caution.
 * Contraindicated movements score low and carry a reason; otherwise the score
 * reflects difficulty fit and whether the user owns the needed equipment.
 */
export function exerciseSuitability(
  ex: ExerciseDBEntry,
  bio: UserBio,
): { percent: number; caution?: string } {
  const c = exerciseContraindication(ex, bio);
  if (c.blocked) return { percent: 55, caution: c.reason };

  let percent = 99;
  const userIdx = DIFFICULTY_ORDER.indexOf(bio.exerciseLevel);
  const exIdx = DIFFICULTY_ORDER.indexOf(ex.difficulty);
  if (exIdx > userIdx) percent -= (exIdx - userIdx) * 7; // above your level

  const equipment = bio.equipment ?? ["none"];
  if (
    ex.equipment.length > 0 &&
    !ex.equipment.every((eq) => equipment.includes(eq as Equipment))
  ) {
    percent -= 6; // needs kit you didn't list
  }
  return { percent: Math.max(70, Math.min(99, percent)) };
}

/**
 * Whole-plan "personalized for you" match %, plus the tailoring notes. The
 * generated plan is already safe + filtered to the user, so it scores high; the
 * number nudges up the more it's actively adapted (equipment, injuries, etc.).
 */
export function workoutPlanMatch(bio: UserBio): {
  percent: number;
  notes: string[];
} {
  const notes = describeAdaptations(bio);
  let percent = 92;
  if ((bio.equipment ?? ["none"]).some((e) => e !== "none")) percent += 2;
  if (notes.length > 0) percent += 4;
  return { percent: Math.min(99, percent), notes };
}

/**
 * Plain-language list of how the plan is tailored to the user's body right now
 * (injuries protected, pregnancy-safe, etc.). Empty when nothing special.
 */
export function describeAdaptations(bio: UserBio): string[] {
  const notes: string[] = [];
  const injuries = (bio.injuries ?? []).filter((s) => s.trim());
  if (injuries.length > 0) notes.push(`Protects your ${injuries.join(", ")}`);

  const conditions = bio.medicalConditions ?? [];
  if (conditions.includes("pregnancy")) {
    notes.push(
      bio.pregnancyTrimester
        ? `Pregnancy-safe · trimester ${bio.pregnancyTrimester}`
        : "Pregnancy-safe movements",
    );
  }
  if (conditions.includes("postpartum")) notes.push("Gentle postpartum return");
  if (conditions.includes("hypertension"))
    notes.push("Lower-intensity for blood pressure");
  return notes;
}

// ============================================================================
// DETERMINISTIC SEED
// ============================================================================

/** Simple seeded pseudo-random to make plan deterministic for same week+inputs */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // to 32-bit int
  }
  return Math.abs(hash);
}

// ============================================================================
// GENERATOR
// ============================================================================

export function generateWorkoutPlan(
  bio: UserBio,
  weekStart: string,
  options?: {
    daysPerWeek?: number;
    durationCapMinutes?: number;
    equipment?: Equipment[];
    salt?: string;
  },
): GeneratedWorkoutPlan {
  const input: GeneratorInput = {
    goal: bio.primaryGoal,
    difficulty: bio.exerciseLevel,
    daysPerWeek: Math.min(
      Math.max(options?.daysPerWeek ?? daysFromGoal(bio), 2),
      6,
    ),
    equipment: options?.equipment ?? ["none"],
    durationCapMinutes:
      options?.durationCapMinutes ?? durationFromLevel(bio.exerciseLevel),
    weekStart,
  };

  // Create hash from inputs (salt breaks determinism for manual regeneration).
  // Injuries/conditions are folded in so a new one regenerates the plan.
  const baseHash = `${input.goal}_${input.difficulty}_${input.daysPerWeek}_${input.equipment.sort().join(",")}_${input.durationCapMinutes}_${input.weekStart}_${contraindicationKey(bio)}`;
  const saltPart = options?.salt ? `_${options.salt}` : "";
  const seedHash = `${baseHash}${saltPart}`;
  const seed = hashString(seedHash);
  const rand = seededRandom(seed);

  // Pick split
  const splitKey = `${input.daysPerWeek}-day`;
  const split = SPLITS[splitKey] || SPLITS["3-day"];

  // Filter exercise pool by difficulty, equipment, and injury/condition safety
  const contra = buildContraindications(bio);
  const pool = filterExercisePool(input.difficulty, input.equipment, contra);

  // Distribute sessions across week days using randomized spacing
  const availableDays = [0, 1, 2, 3, 4, 5, 6]; // Mon-Sun
  const sessionDays: number[] = [];
  if (split.length >= availableDays.length) {
    // If as many sessions as days, use all days
    for (let i = 0; i < split.length; i++) sessionDays.push(i % 7);
  } else {
    // Shuffle available days and pick the first N, then sort
    const shuffled = [...availableDays];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, split.length).sort((a, b) => a - b);
    sessionDays.push(...picked);
  }

  // Generate sessions
  const sessions: WorkoutSession[] = split.map((day, i) => {
    return buildSession(day, pool, input, rand, sessionDays[i]);
  });

  return {
    id: `wplan_${seed}`,
    createdAt: new Date().toISOString(),
    weekStart,
    splitType: `${split.length}-Day ${split.length <= 3 ? "Full Body" : "Push/Pull/Legs"}`,
    sessions,
    inputHash: baseHash, // Store base hash WITHOUT salt for shouldRegenerate comparison
  };
}

/**
 * Check if a workout plan needs regeneration
 * Returns true only if the user's bio has changed in ways that affect the plan
 */
export function shouldRegenerateWorkoutPlan(
  existingPlan: GeneratedWorkoutPlan | null,
  bio: UserBio,
  weekStart: string,
  options?: {
    daysPerWeek?: number;
    durationCapMinutes?: number;
    equipment?: Equipment[];
  },
): boolean {
  if (!existingPlan) return true;
  if (existingPlan.weekStart !== weekStart) return true;

  const daysPerWeek = Math.min(
    Math.max(options?.daysPerWeek ?? daysFromGoal(bio), 2),
    6,
  );
  const durationCap =
    options?.durationCapMinutes ?? durationFromLevel(bio.exerciseLevel);
  const equipment = options?.equipment ?? ["none"];

  const expectedHash = `${bio.primaryGoal}_${bio.exerciseLevel}_${daysPerWeek}_${equipment.sort().join(",")}_${durationCap}_${weekStart}_${contraindicationKey(bio)}`;
  return existingPlan.inputHash !== expectedHash;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function daysFromGoal(bio: UserBio): number {
  switch (bio.primaryGoal) {
    case "lose_weight":
      return 4;
    case "build_muscle":
      return 4;
    case "athletic_performance":
      return 5;
    case "improve_fitness":
      return 3;
    case "increase_energy":
      return 3;
    case "better_health":
      return 3;
    default:
      return 3;
  }
}

function durationFromLevel(level: Difficulty): number {
  switch (level) {
    case "beginner":
      return 30;
    case "intermediate":
      return 45;
    case "advanced":
      return 60;
    default:
      return 40;
  }
}

function filterExercisePool(
  difficulty: Difficulty,
  equipment: Equipment[],
  contra: Contraindications,
): ExerciseDBEntry[] {
  // Difficulty ceiling = the stricter of the user's level and any condition cap.
  const userMaxIdx = DIFFICULTY_ORDER.indexOf(difficulty);
  const condMaxIdx = contra.maxDifficulty
    ? DIFFICULTY_ORDER.indexOf(contra.maxDifficulty)
    : userMaxIdx;
  const maxDiffIdx = Math.min(userMaxIdx, condMaxIdx);

  const base = _exercisePool.filter((ex) => {
    // Difficulty: include exercises at or below the effective ceiling
    const exDiffIdx = DIFFICULTY_ORDER.indexOf(ex.difficulty);
    if (exDiffIdx > maxDiffIdx) return false;

    // Equipment: exercise needs no equipment, or user has the equipment
    if (ex.equipment.length === 0) return true; // bodyweight always OK
    return ex.equipment.every((eq) => equipment.includes(eq as Equipment));
  });

  // Drop injury/condition-contraindicated exercises. If that empties the pool
  // (over-restriction), fall back to `base` so a plan is always produced — the
  // per-pattern slot fill already skips patterns with no safe candidates.
  const safe = base.filter((ex) => !isContraindicated(ex, contra));
  return safe.length > 0 ? safe : base;
}

function buildSession(
  day: SplitDay,
  pool: ExerciseDBEntry[],
  input: GeneratorInput,
  rand: () => number,
  dayIndex: number,
): WorkoutSession {
  const warmupMinutes = 3;
  const cooldownMinutes = 2;
  let remainingMinutes =
    input.durationCapMinutes - warmupMinutes - cooldownMinutes;

  const usedIds = new Set<string>();
  const exercises: PlannedExercise[] = [];

  for (const pattern of day.patterns) {
    if (remainingMinutes <= 0) break;

    const candidates = pool.filter(
      (ex) => ex.movementPattern === pattern && !usedIds.has(ex.id),
    );

    if (candidates.length === 0) continue;

    // Deterministic pick using seeded random
    const idx = Math.floor(rand() * candidates.length);
    const selected = candidates[idx];
    usedIds.add(selected.id);

    const sets = setsForLevel(input.difficulty);
    const planned: PlannedExercise = {
      exerciseId: selected.id,
      name: selected.name,
      category: selected.category,
      movementPattern: selected.movementPattern,
      sets,
      reps: selected.defaultReps,
      restSeconds: selected.restSeconds,
      durationMinutes: selected.durationMinutes,
      difficulty: selected.difficulty,
    };

    exercises.push(planned);
    remainingMinutes -= selected.durationMinutes;
  }

  const totalDuration =
    warmupMinutes +
    exercises.reduce((sum, ex) => sum + ex.durationMinutes, 0) +
    cooldownMinutes;

  return {
    id: `session_${dayIndex}_${input.weekStart}`,
    dayLabel: day.label,
    dayOfWeek: dayIndex,
    focus: day.focus,
    warmupMinutes,
    exercises,
    cooldownMinutes,
    totalDurationMinutes: totalDuration,
    isRestDay: false,
  };
}

function setsForLevel(level: Difficulty): number {
  switch (level) {
    case "beginner":
      return 3;
    case "intermediate":
      return 3;
    case "advanced":
      return 4;
    default:
      return 3;
  }
}
