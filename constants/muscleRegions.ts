/**
 * MUSCLE REGIONS — maps the free-text muscle names used across
 * EXERCISE_DATABASE (`targetMuscles`) onto the fixed set of body-map regions
 * that the MuscleMap diagram can actually draw.
 *
 * Pure TS (no React Native) so the fitness test suite can enforce that every
 * muscle name in the database resolves here — adding a new exercise with a
 * novel muscle string fails tests until it's mapped.
 */

export type MuscleRegion =
  | "shoulders"
  | "chest"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "obliques"
  | "upperBack"
  | "lowerBack"
  | "glutes"
  | "quads"
  | "adductors"
  | "hamstrings"
  | "calves";

/** Regions drawn on the front / back figure (a region may appear on both). */
export const FRONT_REGIONS: readonly MuscleRegion[] = [
  "shoulders",
  "chest",
  "biceps",
  "forearms",
  "core",
  "obliques",
  "quads",
  "adductors",
];
export const BACK_REGIONS: readonly MuscleRegion[] = [
  "shoulders",
  "triceps",
  "forearms",
  "upperBack",
  "lowerBack",
  "glutes",
  "hamstrings",
  "calves",
];

const FULL_BODY: MuscleRegion[] = [
  "shoulders",
  "chest",
  "core",
  "upperBack",
  "glutes",
  "quads",
  "hamstrings",
];

/**
 * Every `targetMuscles` string in EXERCISE_DATABASE must be a key here.
 * Skill tags (Balance, Agility) intentionally map to no drawable region.
 */
export const MUSCLE_TO_REGIONS: Record<string, MuscleRegion[]> = {
  Abs: ["core"],
  Adductors: ["adductors"],
  Agility: [],
  Ankles: ["calves"],
  Back: ["upperBack", "lowerBack"],
  Balance: [],
  Biceps: ["biceps"],
  Calves: ["calves"],
  Chest: ["chest"],
  Core: ["core"],
  Forearms: ["forearms"],
  "Front Deltoids": ["shoulders"],
  "Full Body": FULL_BODY,
  Glutes: ["glutes"],
  Hamstrings: ["hamstrings"],
  "Hip Abductors": ["glutes"],
  "Hip Flexors": ["core"],
  Hips: ["glutes"],
  "Inner Chest": ["chest"],
  Lats: ["upperBack"],
  Legs: ["quads", "hamstrings", "glutes", "calves"],
  "Lower Abs": ["core"],
  "Lower Back": ["lowerBack"],
  "Lower Traps": ["upperBack"],
  Obliques: ["obliques"],
  Quads: ["quads"],
  "Rear Deltoids": ["shoulders"],
  Shoulders: ["shoulders"],
  "Side Deltoids": ["shoulders"],
  Spine: ["upperBack", "lowerBack"],
  "T-Spine": ["upperBack"],
  Traps: ["upperBack"],
  Triceps: ["triceps"],
  "Upper Back": ["upperBack"],
  "Upper Chest": ["chest"],
};

/**
 * Resolve muscle names (as written in the database) to a deduped region list.
 * Unknown names are skipped — the diagram degrades gracefully rather than
 * throwing on AI-generated exercises with novel muscle strings.
 */
export function musclesToRegions(names: readonly string[]): MuscleRegion[] {
  const out = new Set<MuscleRegion>();
  for (const name of names) {
    const regions = MUSCLE_TO_REGIONS[name.trim()];
    if (regions) regions.forEach((r) => out.add(r));
  }
  return [...out];
}
