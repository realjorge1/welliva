/**
 * "Trying something new" — the pure engines. docs/gozlin/11-trying-something-new.md.
 *
 *   subjects   what "the same exercise" means across catalog and AI-plan ids
 *   detector   the seen-ledger, and what was first seen in the last 48 hours
 *   curiosity  whether, and when, to ask — every gate, the window, the budget
 *   recall     which memories to offer when a subject comes back
 */

export * from "./types";
export {
  catalogIdForName,
  difficultyRank,
  familyByRules,
  mentionsSubject,
  normalizeName,
  subjectFor,
  type ExerciseSubject,
} from "./subjects";
export { EXERCISE_FAMILY, FAMILY_RULES } from "./exerciseFamilies";
export {
  CANDIDATE_HORIZON_MS,
  COVERAGE,
  HISTORY_CAP,
  detectNovelty,
  emptyLedger,
  ingestSessions,
  wasPerformed,
  wasTried,
  type SeenEntry,
  type SeenLedger,
} from "./detector";
export {
  BUDGET,
  CHAT_LIMITS,
  EXERCISE_WINDOW,
  afterTurn,
  backoffDays,
  chatStage,
  chipVisible,
  effectiveStatus,
  entryFor,
  exerciseWindow,
  ignoredStreak,
  markAnswered,
  markDismissed,
  sampledIn,
  selectQuestion,
  type ChatStage,
  type SelectInput,
  type TurnOutcome,
} from "./curiosity";
export {
  RECALL,
  askedInReply,
  hasContent,
  recallFor,
  recallsUsed,
  refersTo,
  type RecallInput,
  type RecallPick,
  type RecallTrigger,
} from "./recall";
