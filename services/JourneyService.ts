/**
 * JOURNEY SERVICE — chapters of the journey.
 *
 * A health app used for *years* isn't one goal — it's a series of them. The
 * single biggest way an app goes stale is letting a user hit their goal (lose
 * the weight) and then just… keep running the same plan with nothing left to
 * chase. This closes that loop: when a goal is reached we mark a chapter
 * complete and invite the user to re-consult and set the next one, restarting
 * the whole motivation curve against a fresh objective.
 *
 * Pure + tiny: detection math here, persistence in one namespaced key. The UX
 * (celebration + re-consultation screen) lives in app/new-chapter.tsx; the
 * wiring lives in AppContext.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PrimaryGoal } from "../models/user";

const JOURNEY_KEY = "@welliva_journey";

export interface JourneyRecord {
  /** 1-based chapter number — increments each time the user starts anew. */
  chapter: number;
  /** A reached goal awaiting the user's pivot (drives the Profile CTA). */
  goalAchievedPending: boolean;
  /** Signature of the goal already celebrated, so we fire the moment once. */
  lastGoalSignature: string;
  /**
   * Weight (kg) at the start of THIS chapter. Makes goal-direction inference
   * chapter-relative (a later "gain back" chapter isn't judged against the very
   * first lifetime weigh-in). Unset for chapter 1 → falls back to earliest log.
   */
  chapterStartWeightKg?: number;
}

export const EMPTY_JOURNEY: JourneyRecord = {
  chapter: 1,
  goalAchievedPending: false,
  lastGoalSignature: "",
};

/** Stable identifier for a goal+target pair — changes when either changes. */
export function goalSignature(
  goal: PrimaryGoal | undefined,
  targetWeightKg: number | undefined,
): string {
  return `${goal ?? "none"}:${targetWeightKg ?? "none"}`;
}

export interface GoalReachedInput {
  goal: PrimaryGoal | undefined;
  targetWeightKg?: number;
  startWeightKg?: number | null;
  currentWeightKg?: number | null;
}

/**
 * Has the user reached their weight goal? Direction is inferred from where they
 * started relative to the target, so it works for both cuts and bulks without
 * assuming the goal label. Returns false when there's no weight target or not
 * enough signal to judge — we never fabricate a milestone.
 */
export function isGoalReached({
  targetWeightKg,
  startWeightKg,
  currentWeightKg,
}: GoalReachedInput): boolean {
  if (targetWeightKg == null || currentWeightKg == null || startWeightKg == null) {
    return false;
  }
  const losing = targetWeightKg < startWeightKg;
  const gaining = targetWeightKg > startWeightKg;
  if (losing) return currentWeightKg <= targetWeightKg;
  if (gaining) return currentWeightKg >= targetWeightKg;
  return false; // target equals start → not a directional goal
}

export async function loadJourney(): Promise<JourneyRecord> {
  try {
    const raw = await AsyncStorage.getItem(JOURNEY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<JourneyRecord>;
      return { ...EMPTY_JOURNEY, ...parsed };
    }
  } catch (e) {
    console.error("Error loading journey:", e);
  }
  return { ...EMPTY_JOURNEY };
}

export async function saveJourney(record: JourneyRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(JOURNEY_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("Error saving journey:", e);
  }
}
