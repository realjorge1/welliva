/**
 * Life Context — the hooks and panels behind "what's ahead".
 *
 *   import { useLifeContext, UpcomingCard, AddSheet } from "@/components/lifecontext";
 */
export {
  AddSheet,
  AnticipationSection,
  SignalsPanel,
  UpcomingCard,
  presetTitleFor,
  usePhaseTone,
} from "./LifePanels";
export { useAnticipation } from "./useAnticipation";
export { useLifeContext } from "./useLifeContext";
export { useSignals } from "./useSignals";

export type { AddPreset } from "./LifePanels";
export type { UseAnticipation } from "./useAnticipation";
export type { LifeRow, UseLifeContext } from "./useLifeContext";
export type { UseSignals } from "./useSignals";
