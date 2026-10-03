/**
 * WORKOUT PLAN GENERATOR — the app's door into the training engine.
 *
 * The week itself is built by services/training (see week.ts there): every
 * exercise chosen by score from the user's own data, every dose climbed from
 * what they logged, every choice carrying the plain line that explains it. No
 * random numbers anywhere — the same person, preferences, history and week
 * always build the same plan.
 *
 * This module keeps what the rest of the app already imports from here:
 *   • the lazily loaded exercise pool (bundle trim, below),
 *   • per-exercise suitability for the library screens,
 *   • `generateWorkoutPlan` / `shouldRegenerateWorkoutPlan`, now thin wrappers
 *     over the engine.
 *
 * What it no longer has: the seeded shuffle that picked a random move for each
 * slot, and the "Tailored to you 92–98%" match number — a constant dressed up
 * as a measurement. The plan's own reasons replace it.
 */

import type { ExerciseDBEntry } from "../constants/ExerciseDatabase";
import type { WorkoutDefinition } from "../fitness/types";
import type { SessionSummaryData } from "../models/session";
import type { UserBio } from "../models/user";
import type { Equipment, GeneratedWorkoutPlan } from "../models/workout";
import {
  ENGINE_VERSION,
  buildContraindications,
  buildTrainingWeek,
  isContraindicated,
  resolveTrainingPrefs,
  trainingInputHash,
  type TrainingPrefs,
} from "./training";
import { difficultyIndex } from "./training/safety";
import { toLocalDateString } from "./OfflineStorage";

// ============================================================================
// LAZY EXERCISE POOL (Phase D — bundle trim)
// ============================================================================
//
// ExerciseDatabase (~189 KB) is otherwise pulled onto the cold-start path via
// AppContext → this generator. It's dynamic-imported into a module-local cache
// so it stays out of the initial bundle (on web) / off the cold-start eval
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
// SUITABILITY (consumed by the library UI for match % + subtle cautions)
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
  const userIdx = difficultyIndex(bio.exerciseLevel);
  const exIdx = difficultyIndex(ex.difficulty);
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
 * Plain-language list of how training is tailored to the user's body right
 * now (injuries protected, pregnancy-safe, etc.). Empty when nothing special.
 * Used by the "here's what I changed" summary after a profile edit.
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
// THE PLAN
// ============================================================================

export interface GenerateOptions {
  /** Training preferences (days, length, styles, mode…). Default: from the bio alone. */
  prefs?: TrainingPrefs;
  /** Logged guided sessions — what progression reads. Default: none. */
  sessions?: SessionSummaryData[];
  /** The plan being replaced, if any. */
  previous?: GeneratedWorkoutPlan | null;
  /** Today (YYYY-MM-DD). Default: the local date now. */
  today?: string;
  /** Library workouts for "Let me choose" days. */
  library?: (id: string) => WorkoutDefinition | undefined;
}

export function generateWorkoutPlan(
  bio: UserBio,
  weekStart: string,
  options: GenerateOptions = {},
): GeneratedWorkoutPlan {
  return buildTrainingWeek({
    bio,
    prefs: options.prefs ?? resolveTrainingPrefs(bio, null),
    sessions: options.sessions ?? [],
    weekStart,
    today: options.today ?? toLocalDateString(new Date()),
    pool: _exercisePool,
    library: options.library,
    previous: options.previous ?? null,
  });
}

/**
 * Whether the stored plan is stale: built by an older engine, for another
 * week, or from inputs that have since changed. The training LOG is not an
 * input here — progression moves at the weekly rebuild, so finishing a session
 * never reshuffles the rest of the week.
 */
export function shouldRegenerateWorkoutPlan(
  existingPlan: GeneratedWorkoutPlan | null,
  bio: UserBio,
  weekStart: string,
  prefs?: TrainingPrefs,
): boolean {
  if (!existingPlan) return true;
  if (existingPlan.engineVersion !== ENGINE_VERSION) return true;
  if (existingPlan.weekStart !== weekStart) return true;
  return existingPlan.inputHash !== trainingInputHash(bio, prefs ?? resolveTrainingPrefs(bio, null), weekStart);
}
