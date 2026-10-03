/**
 * TRAINING ENGINE — the weekly plan, built from one person's data and
 * explained line by line. See week.ts for the shape of a build.
 *
 * Pure: no storage, no React, no network. Callers load the inputs (PlanSync
 * does, for the app) and persist the result.
 */

export { ENGINE_VERSION, buildTrainingWeek, trainingInputHash, type BuildWeekInput } from "./week";
export {
  DEFAULT_DAYS_FOR_GOAL,
  normalizeDays,
  resolveTrainingPrefs,
  spacedDays,
  type TrainingPrefs,
} from "./prefs";
export { deriveContext, EMPHASIS_LABEL, type Emphasis, type TrainingContext } from "./context";
export { lightenSession, type LighterSession, type Readiness } from "./lighten";
export { formatDose } from "./dose";
export { DAY_NAMES, DAY_SHORT } from "./templates";
export {
  buildContraindications,
  contraindicationKey,
  isContraindicated,
  safetyLabel,
  type Contraindications,
} from "./safety";
