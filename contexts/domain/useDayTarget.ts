/**
 * useDayCalorieDelta — a date's target change, live (services/nutrition/dayTargets).
 *
 * The cycle provider sits below AppProvider, so anything above it (the coach
 * insights) can't read it through context. This store is how both sides agree.
 */
import {
  dayAdjustmentsSnapshot,
  dayCalorieDelta,
  subscribeDayAdjustments,
  type DayTargetAdjustments,
} from "@/services/nutrition/dayTargets";
import { useSyncExternalStore } from "react";

export function useDayAdjustments(): DayTargetAdjustments {
  return useSyncExternalStore(subscribeDayAdjustments, dayAdjustmentsSnapshot);
}

export function useDayCalorieDelta(date: string): number {
  return dayCalorieDelta(date, useDayAdjustments());
}
