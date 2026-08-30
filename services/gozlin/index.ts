/**
 * GOZLIN — engine package barrel.
 *
 * The persona + orchestration + memory layer on top of Welliva's deterministic
 * intelligence (services/intelligence/*). Everything here is offline-first and
 * deterministic; the optional LLM provider only ever rephrases open-ended chat.
 *
 * See docs/gozlin/ for the Personality Bible (Phase 1) and Intelligence
 * Architecture (Phase 2).
 */

// Types
export type * from "./gozlin.types";

// Twin (central read-model)
export { buildTwin } from "./GozlinTwin";

// Persona (voice)
export {
  celebrate,
  closer,
  pickVariant,
  PHRASES,
  reset,
  timeGreeting,
  TONE_META,
  voice,
} from "./GozlinPersona";

// Engines
export { computeRecovery } from "./GozlinRecoveryEngine";
export type { RecoveryInput } from "./GozlinRecoveryEngine";

export { buildBriefing } from "./GozlinBriefingEngine";
export type { BriefingInput } from "./GozlinBriefingEngine";

export { buildForecast } from "./GozlinForecastEngine";
export type { ForecastInput } from "./GozlinForecastEngine";

export {
  buildWeeklyReview,
  detectFindings,
  detectHabits,
} from "./GozlinProgressEngine";
export type {
  HabitInput,
  ProgressInput,
  WeeklyReviewInput,
} from "./GozlinProgressEngine";

// Progress Detective (Phase 8)
export { buildDetectiveReport } from "./GozlinDetectiveEngine";
export type { DetectiveInput } from "./GozlinDetectiveEngine";

// Coach Presence — Gozlin everywhere (Phase 9 / CXO)
export { buildMoments, topMoment } from "./GozlinMomentEngine";
export type { MomentInput } from "./GozlinMomentEngine";

// Proactive notification planning (Proactive Companion P2)
export { buildNotificationCandidates } from "./GozlinNotificationPlanner";
export type { NotificationCandidateInput } from "./GozlinNotificationPlanner";

// Anticipation + Coaching Modes (Proactive Companion P1)
export { buildAnticipations, COACHING_MODE_META } from "./GozlinAnticipationEngine";
export type {
  Anticipation,
  AnticipationInput,
  AnticipationKind,
  AnticipationResult,
  CoachingMode,
  CoachingModeMeta,
} from "./GozlinAnticipationEngine";

// Habit Awareness System (Phase 7)
export {
  buildHabitReport,
  buildRescues,
  detectHabitPatterns,
  predictRisks,
  scoreBehavior,
} from "./GozlinHabitEngine";
export type { HabitReportInput } from "./GozlinHabitEngine";

// Adaptive Workout Intelligence (Phase 5)
export {
  analyzeExercisePerformance,
  applyWorkoutAdaptation,
  applyWorkoutAdaptations,
  buildWorkoutAdaptations,
  isApplicable,
  scaleReps,
} from "./GozlinAdaptiveWorkoutEngine";
export type { WorkoutAdaptationInput } from "./GozlinAdaptiveWorkoutEngine";

// Adaptive Nutrition Intelligence (Phase 6)
export {
  analyzeFoodAvoidances,
  buildNutritionAdaptations,
} from "./GozlinAdaptiveNutritionEngine";
export type { NutritionAdaptationInput } from "./GozlinAdaptiveNutritionEngine";

// Conversation
export {
  buildGroundingPrompt,
  classifyIntent,
  respond,
  respondDeterministic,
  userMsg,
} from "./GozlinChatEngine";
export type {
  GozlinChatContext,
  GozlinChatResult,
  GozlinIntent,
  GozlinProvider,
} from "./GozlinChatEngine";

// Memory store
export {
  addCheckin,
  addEpisode,
  archiveConversation,
  clearArchive,
  clearGozlinMemory,
  deleteArchivedConversation,
  getLastBriefing,
  getLastWeeklyReview,
  getTodayCheckin,
  loadArchive,
  loadBehavioral,
  loadCheckins,
  loadConversation,
  loadEpisodes,
  loadIdentity,
  loadMemorySnapshot,
  rememberMotivation,
  rememberPreference,
  removeEpisode,
  saveBehavioral,
  saveConversation,
  saveIdentity,
  setLastBriefing,
  setLastWeeklyReview,
} from "./GozlinMemoryStore";
export type { ArchivedConversation, LastBriefingMeta } from "./GozlinMemoryStore";

// What a conversation is about, and whether it was ever finished
export {
  COACH_SUBHEADS,
  CONTINUE_NUDGES,
  deriveConversationTitle,
  findOpenThread,
  OPEN_MAX_AGE_MS,
  OPEN_MIN_AGE_MS,
  pickCoachSubhead,
} from "./conversationTitle";
export type { OpenThread } from "./conversationTitle";
