/**
 * MUSCLE EMPHASIS — resolves an exercise's worked muscles onto the schematic
 * body ZONES the demonstration figure can light up, so the animated athlete
 * visibly fires the muscles the movement trains (a warm activation accent over
 * the working limbs, front and side).
 *
 * Pure TS (no React / Skia) so the fitness suite can prove every catalogued
 * exercise maps to a drawable set of zones. Reuses the same free-text →
 * MuscleRegion mapping the MuscleMap diagram uses, then collapses regions onto
 * the coarser limb/torso segments a stick-and-capsule figure can shade.
 */
import { EXERCISE_DATABASE } from "@/constants/ExerciseDatabase";
import { musclesToRegions, type MuscleRegion } from "@/constants/muscleRegions";

/** The limb/torso zones the figure can highlight (shared by front & side). */
export type FigureZone =
  | "shoulder"
  | "torsoUpper"
  | "torsoLower"
  | "upperArm"
  | "foreArm"
  | "pelvis"
  | "thigh"
  | "shin";

const REGION_TO_ZONES: Record<MuscleRegion, FigureZone[]> = {
  shoulders: ["shoulder"],
  chest: ["torsoUpper"],
  biceps: ["upperArm"],
  triceps: ["upperArm"],
  forearms: ["foreArm"],
  core: ["torsoLower"],
  obliques: ["torsoLower"],
  upperBack: ["torsoUpper"],
  lowerBack: ["torsoLower"],
  glutes: ["pelvis"],
  quads: ["thigh"],
  adductors: ["thigh"],
  hamstrings: ["thigh"],
  calves: ["shin"],
};

/** Collapse resolved muscle regions onto the figure's highlightable zones. */
export function regionsToZones(regions: readonly MuscleRegion[]): FigureZone[] {
  const out = new Set<FigureZone>();
  for (const r of regions) for (const z of REGION_TO_ZONES[r] ?? []) out.add(z);
  return [...out];
}

export interface EmphasisInput {
  /** Muscle names as written in EXERCISE_DATABASE (wins when present). */
  muscles?: readonly string[];
  /** Fallback: look the exercise up in the local DB for its targetMuscles. */
  exerciseId?: string;
}

/**
 * Resolve the worked zones for an exercise. Explicit muscles win; otherwise the
 * local DB is consulted by id. Never throws — AI exercises with no muscle data
 * simply return an empty set (the figure animates with no emphasis).
 */
export function resolveEmphasisZones({ muscles, exerciseId }: EmphasisInput): FigureZone[] {
  let names = muscles;
  if ((!names || names.length === 0) && exerciseId) {
    names = EXERCISE_DATABASE.find((e) => e.id === exerciseId)?.targetMuscles;
  }
  return regionsToZones(musclesToRegions(names ?? []));
}
