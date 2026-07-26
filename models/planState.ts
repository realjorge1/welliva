/**
 * PLAN STATE MODEL
 * Tracks what plans are active, when they were generated,
 * and whether regeneration is needed.
 */

export interface PlanState {
  /** Currently active diet plan ID (from scheduled diets) */
  activeDietId: string | null;
  /** Currently active workout plan ID */
  activeWorkoutPlanId: string | null;
  /** Date stamp when the plan was last evaluated (YYYY-MM-DD) */
  dateStamp: string;
  /** Week start date if weekly plans exist */
  weekStartDate: string | null;
  /** ISO timestamp of last generation */
  lastGeneratedAt: string | null;
  /** Whether a regeneration is pending (user changed prefs, etc.) */
  needsRegen: boolean;
  /** Reason for pending regen */
  regenReason: string | null;
}

export const DEFAULT_PLAN_STATE: PlanState = {
  activeDietId: null,
  activeWorkoutPlanId: null,
  dateStamp: "",
  weekStartDate: null,
  lastGeneratedAt: null,
  needsRegen: false,
  regenReason: null,
};
