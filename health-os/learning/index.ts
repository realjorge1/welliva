/**
 * health-os/learning — the closed loop.
 *
 * Learning = a prediction is recorded, an outcome is observed, and a parameter
 * changes as a result. Storage is not learning; this is where the three legs
 * actually connect.
 *
 *   ledger          the falsifiable record + resolver     (build first, ship dark)
 *   tdee            learned maintenance, Kalman            (what to ask for)
 *   fitnessFatigue  fitted training response               (what to ask for)
 *   bandit          learned delivery, Thompson sampling    (how, and whether, to ask)
 *   changepoint     noticing an absence, CUSUM             (when to speak)
 *   adherence       pre-emption, logistic regression       (shrink before the miss)
 */

export * from "./types";

export {
  adherenceBucket,
  adherenceRate,
  dayType,
  decodeContext,
  encodeContext,
  failureBreakdown,
  loadLedger,
  makeRecommendation,
  recordRecommendation,
  resolveDue,
  saveLedger,
  scoreOutcome,
  successRate,
} from "./ledger";
export type { ResolveReport } from "./ledger";

export {
  initKalman,
  read as readTdee,
  runFilter,
  step as stepTdee,
  tdeeDisclosure,
  tdeeForTargets,
} from "./tdee";
export type { TdeeReading } from "./tdee";

export {
  POPULATION_PRIOR,
  armMean,
  createPosteriorStore,
  divergenceFromPrior,
  sampleBeta,
  sampleGamma,
  selectArm,
  silenceReward,
  update as updateBandit,
} from "./bandit";
export type { Rng } from "./bandit";

export {
  MIN_SESSIONS_TO_FIT,
  POPULATION_PARAMS,
  componentsOn,
  fitParams,
  performanceOn,
  readinessOn,
  residual,
} from "./fitnessFatigue";
export type { PerformanceObservation } from "./fitnessFatigue";

export {
  DEFAULT_H,
  DEFAULT_K,
  RATE_H,
  REFERENCE_WINDOW,
  cusum,
  cusumRate,
  describeChange,
  detectAcross,
} from "./changepoint";
export type { ChangePoint } from "./changepoint";

export {
  AT_RISK_THRESHOLD,
  auc,
  calibrationError,
  decide,
  fit as fitAdherence,
  populationModel,
  predict as predictAdherence,
  vectorize,
} from "./adherence";
export type {
  AdherenceAction,
  AdherenceFeatures,
  LogisticModel,
  TrainingSample,
} from "./adherence";
