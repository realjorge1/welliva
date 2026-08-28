/**
 * GOZLIN AGENT — package barrel.
 *
 * The LLM-first coaching path: the model decides, the on-device engines answer.
 * See ./GozlinAgent.ts for the loop and ./tools.ts for why the engines run on
 * the phone rather than the server.
 */

export { runAgentTurn } from "./GozlinAgent";

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
} from "./GozlinAgent";

export { GOZLIN_TOOLS, TOOL_SCHEMAS, findTool } from "./tools";
export type {
  GozlinTool,
  GozlinToolActions,
  GozlinToolContext,
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
  resetGroundingStats,
  validateNumbers,
} from "./grounding";
export type { GroundingResult } from "./grounding";

export {
  collectWithProvenance,
  createLedger,
  originLabel,
  pathLabel,
  receiptsFor,
  sourcesFor,
} from "./receipts";
export type { NumberLedger, NumberSource, Receipt } from "./receipts";
