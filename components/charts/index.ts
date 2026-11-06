/**
 * welliva charts — interactive, Skia-drawn trend lines you can scrub.
 *
 *   import { TrendCard, buildCaloriesTrend } from "@/components/charts";
 *
 * `TrendCard` is the drop-in surface; `InteractiveChart` is the raw scrubbable
 * line; `series.ts` holds the pure builders that turn app history into points.
 */
export { InteractiveChart } from "./InteractiveChart";
export type { InteractiveChartProps } from "./InteractiveChart";
export { TrendCard } from "./TrendCard";
export type { TrendCardProps } from "./TrendCard";
export { MacroTrendCard } from "./MacroTrendCard";
export type { MacroTrendCardProps, MacroTrendMetric } from "./MacroTrendCard";
export { WeekPie } from "./WeekPie";
export type { WeekPieProps } from "./WeekPie";
export { ActivityRings } from "./ActivityRings";
export type { ActivityRingsProps, ActivityRingMetric } from "./ActivityRings";
export { WeekBars } from "./WeekBars";
export type { WeekBarsProps } from "./WeekBars";
export type { ChartPoint, TrendSeries } from "./types";
export {
  buildAdherenceTrend,
  buildCaloriesTrend,
  buildCarbsTrend,
  buildFatTrend,
  buildMacroMatrix,
  buildProteinTrend,
  buildSessionVolume,
  buildWeeklyMinutes,
  buildWeightTrend,
  fullDate,
  indexToStart,
  shortDate,
  weekStartOf,
} from "./series";
export type { MacroMatrixPoint } from "./series";
