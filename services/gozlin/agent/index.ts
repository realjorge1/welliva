/**
 * GOZLIN AGENT — package barrel.
 *
 * The LLM-first coaching path: the model decides, the on-device engines answer.
 * See ./GozlinAgent.ts for the loop and ./tools.ts for why the engines run on
 * the phone rather than the server.
 */

export { COACH_LOCKED_CODE, runAgentTurn } from "./GozlinAgent";

export { DEEP_DIVE_MODE, runDeepDive } from "./deepDive";
export type {
  DeepDiveFailure,
  DeepDiveInput,
  DeepDiveOptions,
  DeepDiveResult,
} from "./deepDive";
export type {
  AgentTurnOptions,
  AgentTurnResult,
  CoachTransport,
  CoachTurnRequest,
  CoachTurnResponse,
  ContentBlock,
  TurnCuriosity,
} from "./GozlinAgent";

export {
  SORENESS_WORDS,
  experienceEvidence,
  isVerbatim,
  resolveNoteSubject,
  sayDay,
} from "./experiences";
export type { ExperienceEvidence, ResolvedNoteSubject } from "./experiences";

export { GOZLIN_TOOLS, TOOL_SCHEMAS, findTool } from "./tools";
export type {
  GozlinTool,
  GozlinToolActions,
  GozlinToolContext,
  ExperienceNote,
  FoodLogPreview,
  MealSlot,
  ToolConfirmRequest,
} from "./tools";

export {
  GOZLIN_SYSTEM,
  MAX_HISTORY_MESSAGES,
  buildTurnMessages,
  toWireMessages,
  twinStateMessage,
} from "./context";
export type { WireMessage } from "./context";

export { conditionRules, screenForClinicalRisk } from "./clinical";
export type { ClinicalRisk, ClinicalRiskKind } from "./clinical";

export {
  OUTPUT_FALLBACK,
  outputSafetyStats,
  recordOutputScreen,
  resetOutputSafetyStats,
  screenOutput,
} from "./outputSafety";
export type { OutputRisk, OutputRiskKind } from "./outputSafety";

export {
  collectAllowedNumbers,
  groundingStats,
  isRoundingOf,
  numberSpans,
  resetGroundingStats,
  validateNumbers,
} from "./grounding";
export type { GroundingResult, NumberSpan } from "./grounding";

export {
  collectWithProvenance,
  createLedger,
  howSpoken,
  originLabel,
  pathLabel,
  receiptsFor,
  sourceLabel,
  sourcesFor,
} from "./receipts";
export type { NumberLedger, NumberSource, RecallReceipt, Receipt } from "./receipts";
